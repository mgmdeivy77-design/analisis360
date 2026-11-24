import express, { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import dotenv from "dotenv";
import {
  ANALYSIS_STAGE_ORDER,
  filterValidStageIds,
  normalizeSafeHttpUrl,
  pickSafePartialAnalysisData,
  sanitizeAnalysisResponse,
  sanitizeResourceList,
} from "../src/utils.js";
import {
  AnalysisJobStateResponse,
  AnalysisStageId,
  ComprehensiveAnalysisResponse,
  RecommendedResources,
  ResourceItem,
} from "../src/types.js";

dotenv.config();

// In-memory rate limiters (effective per instance & warm serverless container)
const apiMutationRequests = new Map<string, { count: number; resetAt: number }>();
const apiPollRequests = new Map<string, { count: number; resetAt: number }>();

const JOB_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const MAX_IN_MEMORY_JOBS = 100;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const JOB_CACHE_DIR = path.resolve(os.tmpdir(), "analisispro-jobs");

interface AnalysisJobRecord {
  jobId: string;
  status: "running" | "completed" | "paused_error";
  topic: string;
  focusType: string;
  tradicionTeologica: string;
  completedStages: AnalysisStageId[];
  currentStage: AnalysisStageId | null;
  failedStage: AnalysisStageId | null;
  partialData: Record<string, any>;
  result?: ComprehensiveAnalysisResponse;
  error?: string;
  retryable?: boolean;
  createdAt: number;
  updatedAt: number;
}

const jobsMap = new Map<string, AnalysisJobRecord>();
const activeJobRunners = new Set<string>();

function isValidUuid(id: unknown): id is string {
  return typeof id === "string" && UUID_REGEX.test(id);
}

function getSafeJobCachePath(jobId: string): string | null {
  if (!isValidUuid(jobId)) return null;
  const resolved = path.resolve(JOB_CACHE_DIR, `${jobId}.json`);
  if (!resolved.startsWith(JOB_CACHE_DIR + path.sep)) {
    return null;
  }
  return resolved;
}

function persistJobCheckpoint(job: AnalysisJobRecord): void {
  // Evict expired or excess entries in memory
  const now = Date.now();
  for (const [key, entry] of jobsMap.entries()) {
    if (now - entry.updatedAt > JOB_TTL_MS && !activeJobRunners.has(key)) {
      jobsMap.delete(key);
    }
  }
  while (jobsMap.size >= MAX_IN_MEMORY_JOBS && !jobsMap.has(job.jobId)) {
    const oldestKey = jobsMap.keys().next().value;
    if (!oldestKey) break;
    jobsMap.delete(oldestKey);
  }
  jobsMap.set(job.jobId, job);

  // Best-effort checkpoint on tmp disk so restarts/reloads can recover seamlessly
  const filePath = getSafeJobCachePath(job.jobId);
  if (!filePath) return;
  try {
    fs.mkdirSync(JOB_CACHE_DIR, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(job), "utf8");
  } catch {
    // Read-only filesystem (e.g. some serverless sandboxes) — memory store + client checkpoint still work
  }
}

function loadJobCheckpoint(jobId: string): AnalysisJobRecord | null {
  if (!isValidUuid(jobId)) return null;
  const now = Date.now();
  const mem = jobsMap.get(jobId);
  if (mem) {
    if (now - mem.updatedAt <= JOB_TTL_MS || activeJobRunners.has(jobId)) {
      return mem;
    }
    jobsMap.delete(jobId);
  }

  const filePath = getSafeJobCachePath(jobId);
  if (!filePath) return null;
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as AnalysisJobRecord;
    if (!parsed || typeof parsed !== "object" || parsed.jobId !== jobId) return null;
    if (now - (parsed.updatedAt || 0) > JOB_TTL_MS) {
      try {
        fs.unlinkSync(filePath);
      } catch {
        // ignore
      }
      return null;
    }
    // If process died while status was "running" and no active runner exists in this new process,
    // downgrade to paused_error so client/resume can cleanly continue from last completed stage.
    if (parsed.status === "running" && !activeJobRunners.has(jobId)) {
      parsed.status = "paused_error";
      parsed.error =
        "El servidor se reinició durante la generación, pero tu progreso previo se conservó. Pulsa 'Continuar donde se quedó'.";
      parsed.retryable = true;
    }
    parsed.completedStages = filterValidStageIds(parsed.completedStages);
    parsed.partialData = pickSafePartialAnalysisData(parsed.partialData);
    jobsMap.set(jobId, parsed);
    return parsed;
  } catch {
    return null;
  }
}

function getNextPendingStage(completedStages: AnalysisStageId[]): AnalysisStageId | null {
  for (const stage of ANALYSIS_STAGE_ORDER) {
    if (!completedStages.includes(stage)) {
      return stage;
    }
  }
  return null;
}

function getExecutionMode(): "background" | "step-by-step" {
  // Vercel serverless freezes background tasks after HTTP response returns; step-by-step avoids premature freezes
  return process.env.VERCEL === "1" ? "step-by-step" : "background";
}

function serializeJobState(job: AnalysisJobRecord): AnalysisJobStateResponse {
  const completedCount = job.completedStages.length;
  const totalStages = ANALYSIS_STAGE_ORDER.length;
  const progressPct =
    job.status === "completed"
      ? 100
      : Math.min(95, Math.round((completedCount / totalStages) * 100));

  return {
    jobId: job.jobId,
    status: job.status,
    executionMode: getExecutionMode(),
    topic: job.topic,
    focusType: job.focusType,
    tradicionTeologica: job.tradicionTeologica,
    completedStages: job.completedStages,
    currentStage: job.currentStage,
    failedStage: job.failedStage,
    totalStages,
    progressPct,
    partialData: job.partialData,
    ...(job.result ? { result: job.result } : {}),
    ...(job.error ? { error: job.error } : {}),
    ...(job.retryable !== undefined ? { retryable: job.retryable } : {}),
    updatedAt: job.updatedAt,
  };
}

function getClientIp(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.trim()) {
    return fwd.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || "unknown";
}

function isProductionEnv(): boolean {
  return process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
}

// Initialize Gemini client lazy/safely
let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required. Please set it in the Secrets panel.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

function safeParseModelJson(rawText: string): Record<string, any> | null {
  if (!rawText || typeof rawText !== "string") return null;
  let text = rawText.trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  }

  const tryParse = (candidate: string): Record<string, any> | null => {
    try {
      const parsed = JSON.parse(candidate);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  };

  let parsed = tryParse(text);
  if (parsed) return parsed;

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const sliced = text.slice(firstBrace, lastBrace + 1);
    parsed = tryParse(sliced);
    if (parsed) return parsed;

    // Strip common trailing commas before closing } or ]
    const cleanedTrailingCommas = sliced.replace(/,\s*([}\]])/g, "$1");
    parsed = tryParse(cleanedTrailingCommas);
    if (parsed) return parsed;
  }

  return null;
}

interface ModelAttemptTrace {
  model: string;
  ms: number;
  ok: boolean;
  error?: string;
}

async function generateContentWithRetryAndFallback(
  ai: GoogleGenAI,
  primaryModel: string,
  fallbackModel: string,
  userPrompt: string,
  systemInstruction: string,
  options?: { stageLabel?: string }
): Promise<{ response: any; parsedJson?: Record<string, any>; modelUsed: string; trace: ModelAttemptTrace[] }> {
  const checkIsTransient = (error: any): boolean => {
    let errorCode = error?.status || error?.statusCode || error?.code;
    let errorStatus = "";
    let errorMsgStr = error?.message || "";

    try {
      if (errorMsgStr && (errorMsgStr.startsWith("{") || errorMsgStr.includes('"error"'))) {
        const startIdx = errorMsgStr.indexOf("{");
        const endIdx = errorMsgStr.lastIndexOf("}");
        if (startIdx !== -1 && endIdx !== -1) {
          const jsonStr = errorMsgStr.substring(startIdx, endIdx + 1);
          const parsed = JSON.parse(jsonStr);
          if (parsed.error) {
            errorCode = parsed.error.code || errorCode;
            errorStatus = parsed.error.status || errorStatus;
            errorMsgStr = parsed.error.message || errorMsgStr;
          }
        }
      }
    } catch {
      // ignore parsing error
    }

    const lowerMsg = String(errorMsgStr).toLowerCase();
    const isTransient =
      errorCode === 503 ||
      errorCode === 429 ||
      errorCode === 500 ||
      errorCode === 504 ||
      errorCode === 502 ||
      errorStatus === "UNAVAILABLE" ||
      errorStatus === "RESOURCE_EXHAUSTED" ||
      lowerMsg.includes("503") ||
      lowerMsg.includes("504") ||
      lowerMsg.includes("502") ||
      lowerMsg.includes("unavailable") ||
      lowerMsg.includes("high demand") ||
      lowerMsg.includes("resource exhausted") ||
      lowerMsg.includes("resource_exhausted") ||
      lowerMsg.includes("429") ||
      lowerMsg.includes("overloaded") ||
      lowerMsg.includes("timeout") ||
      lowerMsg.includes("aborted") ||
      lowerMsg.includes("econnreset") ||
      lowerMsg.includes("socket") ||
      lowerMsg.includes("fetch failed") ||
      lowerMsg.includes("formato no estándar") ||
      lowerMsg.includes("respuesta vacía");

    return Boolean(isTransient);
  };

  const modelsToTry = Array.from(
    new Set([primaryModel, fallbackModel, "gemini-4-hydrogen", "gemini-3.1-flash-lite"])
  );
  let lastError: any = null;
  let anyTransient = false;
  let anyTimeout = false;
  const trace: ModelAttemptTrace[] = [];
  const labelPrefix = options?.stageLabel ? `[${options.stageLabel}] ` : "";

  for (let i = 0; i < modelsToTry.length; i++) {
    const currentModel = modelsToTry[i];
    const maxAttemptsForModel = 2;
    let useThinking = true;

    for (let attempt = 1; attempt <= maxAttemptsForModel; attempt++) {
      const startedAt = Date.now();
      const firstChunkTimeoutMs = i === 0 ? 11500 : 10500;
      const stallTimeoutMs = 9000;
      const hardCapMs = i === 0 ? 22000 : 20000;
      const controller = new AbortController();
      let inactivityTimer: ReturnType<typeof setTimeout> | undefined;
      let hardCapTimer: ReturnType<typeof setTimeout> | undefined;
      let timeoutReason = "";

      const resetInactivityTimer = (msLimit: number) => {
        if (inactivityTimer) clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(() => {
          timeoutReason = `Timeout de respuesta en ${currentModel} tras ${Math.round((Date.now() - startedAt) / 1000)}s`;
          controller.abort();
        }, msLimit);
      };

      try {
        console.log(`[Gemini API] ${labelPrefix}Streaming con ${currentModel} (intento ${attempt}/${maxAttemptsForModel})...`);

        hardCapTimer = setTimeout(() => {
          timeoutReason = `Tiempo límite de etapa alcanzado en ${currentModel} (${hardCapMs / 1000}s)`;
          controller.abort();
        }, hardCapMs);
        resetInactivityTimer(firstChunkTimeoutMs);

        const config: Record<string, any> = {
          abortSignal: controller.signal,
          systemInstruction,
          responseMimeType: "application/json",
        };
        if (useThinking) {
          config.thinkingConfig = {
            thinkingLevel:
              currentModel === "gemini-3.1-flash-lite"
                ? ThinkingLevel.MINIMAL
                : ThinkingLevel.LOW,
          };
        }

        const stream = await ai.models.generateContentStream({
          model: currentModel,
          contents: userPrompt,
          config,
        });

        let responseText = "";
        for await (const chunk of stream) {
          if (controller.signal.aborted) {
            throw new Error(timeoutReason || `Timeout de respuesta en ${currentModel}`);
          }
          const part = chunk?.text || "";
          if (part) {
            responseText += part;
            resetInactivityTimer(stallTimeoutMs);
          }
        }

        if (controller.signal.aborted && !responseText.trim()) {
          throw new Error(timeoutReason || `Timeout de respuesta en ${currentModel}`);
        }

        const ms = Date.now() - startedAt;

        if (!responseText || !responseText.trim()) {
          throw new Error(`Respuesta vacía del modelo ${currentModel}.`);
        }

        const parsedJson = safeParseModelJson(responseText);
        if (!parsedJson) {
          throw new Error(`El modelo ${currentModel} generó un formato no estándar.`);
        }

        console.log(`[Gemini API] ${labelPrefix}Completado con ${currentModel} en ${ms}ms`);
        trace.push({ model: currentModel, ms, ok: true });
        return { response: { text: responseText }, parsedJson, modelUsed: currentModel, trace };
      } catch (error: any) {
        const ms = Date.now() - startedAt;
        const effectiveMsg = timeoutReason || String(error?.message || "error");
        const errMsg = effectiveMsg.slice(0, 200);
        trace.push({ model: currentModel, ms, ok: false, error: errMsg });
        lastError = timeoutReason ? new Error(timeoutReason) : error;
        const isTransient = checkIsTransient(lastError);
        const isTimedOut = Boolean(timeoutReason) || errMsg.toLowerCase().includes("timeout") || errMsg.toLowerCase().includes("aborted");
        if (isTransient) anyTransient = true;
        if (isTimedOut) anyTimeout = true;

        console.log(`[Gemini API] ${labelPrefix}Error en ${currentModel} (${ms}ms): ${errMsg}`);

        if (useThinking && errMsg.toLowerCase().includes("thinking")) {
          useThinking = false;
          if (attempt < maxAttemptsForModel) continue;
        }

        // Retry same model ONLY if failure was fast (< 2.5s) and transient; if timed out, move straight to fallback model
        if (attempt < maxAttemptsForModel && isTransient && !isTimedOut && ms < 2500) {
          const jitter = Math.floor(Math.random() * 300);
          await new Promise((r) => setTimeout(r, 450 + jitter));
          continue;
        }
        break;
      } finally {
        if (inactivityTimer) clearTimeout(inactivityTimer);
        if (hardCapTimer) clearTimeout(hardCapTimer);
      }
    }
  }

  const isHighDemand = anyTransient || checkIsTransient(lastError);
  const err: any = new Error(
    anyTimeout
      ? "El motor de IA tardó más de lo esperado en responder en esta etapa. Tu avance previo quedó guardado; pulsa 'Continuar' para retomar desde aquí."
      : isHighDemand
      ? "Los servidores de IA están experimentando alta demanda temporal (503). Tu avance previo quedó guardado para continuar sin perder nada."
      : `No fue posible completar esta etapa con el motor de IA. Detalle: ${lastError?.message || "Servicio no disponible"}`
  );
  err.trace = trace;
  err.retryable = isHighDemand;
  throw err;
}

interface GroundedWebSource {
  title: string;
  url: string;
  tokens: string[];
}

function tokenizeForMatch(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !["como", "para", "sobre", "entre", "desde", "hasta", "guia", "curso", "libro"].includes(w));
}

async function checkAndResolveUrl(rawUrl: string, timeoutMs = 2000): Promise<string | undefined> {
  const normalized = normalizeSafeHttpUrl(rawUrl);
  if (!normalized) return undefined;

  const isRedirectStub = normalized.includes("vertexaisearch.cloud.google.com/grounding-api-redirect");
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response: globalThis.Response;
    try {
      response = await fetch(normalized, {
        method: isRedirectStub ? "GET" : "HEAD",
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; LinkVerifier/1.0)",
        },
      });
      if (response.status === 405 && !isRedirectStub) {
        response = await fetch(normalized, {
          method: "GET",
          redirect: "follow",
          signal: controller.signal,
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; LinkVerifier/1.0)",
            Range: "bytes=0-0",
          },
        });
      }
    } finally {
      clearTimeout(timer);
    }

    if (response.status === 404 || response.status === 410 || response.status >= 500) {
      return undefined;
    }

    const finalUrl = normalizeSafeHttpUrl(response.url || normalized);
    if (!finalUrl || finalUrl.includes("vertexaisearch.cloud.google.com/grounding-api-redirect")) {
      return isRedirectStub ? undefined : normalized;
    }
    return finalUrl;
  } catch (err: any) {
    const code = err?.cause?.code || err?.code || "";
    if (code === "ENOTFOUND" || code === "ECONNREFUSED" || code === "ERR_TLS_CERT_ALTNAME_INVALID") {
      return undefined;
    }
    return isRedirectStub ? undefined : normalized;
  }
}

async function fetchGroundedSourcesForTopic(
  ai: GoogleGenAI,
  topic: string
): Promise<GroundedWebSource[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4500);
  try {
    const genPromise = ai.models.generateContent({
      model: "gemini-4-hydrogen",
      contents: `Encuentra los mejores sitios web oficiales, artículos de referencia, cursos o herramientas confiables en línea sobre: "${topic.slice(0, 200)}"`,
      config: {
        abortSignal: controller.signal,
        tools: [{ googleSearch: {} }],
      },
    });
    const response = await genPromise;
    const chunks = response?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const rawCandidates = chunks
      .map((c: any) => ({
        title: typeof c?.web?.title === "string" ? c.web.title.trim() : "",
        uri: typeof c?.web?.uri === "string" ? c.web.uri.trim() : "",
      }))
      .filter((c: { title: string; uri: string }) => c.uri.startsWith("http"))
      .slice(0, 5);

    if (rawCandidates.length === 0) return [];

    const resolved = await Promise.all(
      rawCandidates.map(async (c: { title: string; uri: string }) => {
        const finalUrl = await checkAndResolveUrl(c.uri, 1500);
        if (!finalUrl) return null;
        const label = c.title || new URL(finalUrl).hostname.replace(/^www\./, "");
        return {
          title: label,
          url: finalUrl,
          tokens: tokenizeForMatch(`${label} ${finalUrl}`),
        };
      })
    );

    const seenUrls = new Set<string>();
    const unique: GroundedWebSource[] = [];
    for (const item of resolved) {
      if (!item) continue;
      if (seenUrls.has(item.url)) continue;
      seenUrls.add(item.url);
      unique.push(item);
    }
    return unique;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

async function enrichAndVerifyRecommendedResources(
  resources: RecommendedResources,
  groundedSources: GroundedWebSource[]
): Promise<RecommendedResources> {
  const categories = Object.keys(resources) as Array<keyof RecommendedResources>;
  const urlsToCheck = new Set<string>();

  for (const cat of categories) {
    for (const item of resources[cat]) {
      const safe = normalizeSafeHttpUrl(item.url);
      if (safe) urlsToCheck.add(safe);
    }
  }

  const urlCheckResults = new Map<string, string | undefined>();
  const urlList = Array.from(urlsToCheck).slice(0, 14);
  await Promise.all(
    urlList.map(async (u) => {
      const verified = await checkAndResolveUrl(u, 1300);
      urlCheckResults.set(u, verified);
    })
  );

  const matchGroundedSource = (item: ResourceItem): string | undefined => {
    if (groundedSources.length === 0) return undefined;
    const itemTokens = tokenizeForMatch(`${item.titulo} ${item.autor || ""}`);
    if (itemTokens.length === 0) return undefined;

    let bestUrl: string | undefined;
    let bestScore = 0;
    for (const src of groundedSources) {
      const overlap = itemTokens.filter((t) => src.tokens.includes(t)).length;
      if (overlap >= 2 && overlap > bestScore) {
        bestScore = overlap;
        bestUrl = src.url;
      }
    }
    return bestUrl;
  };

  const nextResources = { ...resources };
  for (const cat of categories) {
    nextResources[cat] = resources[cat].map((item) => {
      const safe = normalizeSafeHttpUrl(item.url);
      let finalUrl = safe ? (urlCheckResults.has(safe) ? urlCheckResults.get(safe) : safe) : undefined;
      if (!finalUrl) {
        finalUrl = matchGroundedSource(item);
      }
      return finalUrl ? { ...item, url: finalUrl } : { titulo: item.titulo, ...(item.autor ? { autor: item.autor } : {}) };
    });
  }

  if (groundedSources.length > 0) {
    const existingUrls = new Set(
      nextResources.sitiosWeb.map((s) => s.url).filter((u): u is string => Boolean(u))
    );
    const additions: ResourceItem[] = [];
    for (const src of groundedSources) {
      if (additions.length >= 3) break;
      if (existingUrls.has(src.url)) continue;
      existingUrls.add(src.url);
      additions.push({ titulo: src.title, url: src.url });
    }
    if (additions.length > 0) {
      nextResources.sitiosWeb = [...nextResources.sitiosWeb, ...additions];
    }
  }

  return nextResources;
}

function buildCoreSystemInstruction(selectedTradition: string): string {
  const isSabiduriaPractica =
    selectedTradition === "Sabiduría práctica y habilidades sociales" ||
    selectedTradition.toLowerCase().includes("sabiduría práctica") ||
    selectedTradition.toLowerCase().includes("habilidades sociales");

  const sabiduriaPracticaPrompt = isSabiduriaPractica
    ? `
MARCO OBLIGATORIO ACTIVO: "Sabiduría práctica y habilidades sociales".
Ajusta todo el análisis y recomendaciones a:
1. Sabiduría Práctica Aplicada (Phrónēsis): prudencia operativa, timing oportuno, sobriedad emocional y consecuencias de 2º/3º orden.
2. Inteligencia Interpersonal y Habilidades Sociales: comunicación asertiva (qué decir y tono), empatía/calibración, negociación ganar-ganar y límites saludables.
`
    : "";

  return `
Eres el "Sistema Universal de Análisis Integral, Investigación, Discernimiento y Toma de Decisiones Objetivas".
La aplicación es GENERAL, ABIERTA Y MULTIDISCIPLINARIA (ciencia, tecnología, negocios, finanzas, decisiones personales, salud, psicología, filosofía, ética, sociedad, historia, derecho o teología).

REGLAS EPISTEMOLÓGICAS:
1. ADAPTACIÓN OBJETIVA:
   - Consultas científicas, técnicas, financieras o seculares: aplica rigor empírico, lógica formal y análisis costo/beneficio sin forzar lenguaje teológico.
   - Consultas teológicas o bíblicas: aplica máxima rigurosidad exegética histórico-gramatical (hebreo/griego, contexto, sintaxis).
   - Dilemas éticos o complejos: pondera equilibradamente evidencia empírica, viabilidad y principios éticos universales.
2. RIGOR Y DISTINCIÓN:
   - Distingue estrictamente entre hechos comprobados, inferencias lógicas, hipótesis y opiniones.
   - NUNCA inventes datos, cifras ficticias, citas bíblicas inexistentes o estudios falsos. Declara límites metodológicos cuando existan.
3. ABUNDANCIA CON SUSTANCIA (SIN RELLENO):
   - Desarrolla cada apartado con mecanismos causales reales, criterios verificables y ejemplos concretos.
${sabiduriaPracticaPrompt}
4. SALIDA ESTRICTA:
   - Responde ÚNICAMENTE con un objeto JSON válido que cumpla exactamente el sub-esquema solicitado en esta etapa. No incluyas texto fuera del JSON.
`;
}

function buildStageDigest(partialData: Record<string, any>): string {
  const parts: string[] = [];
  if (typeof partialData.resumenEjecutivo === "string" && partialData.resumenEjecutivo) {
    parts.push(`Resumen previo: ${partialData.resumenEjecutivo.slice(0, 600)}`);
  }
  if (typeof partialData.comprensionProblema === "string" && partialData.comprensionProblema) {
    parts.push(`Problema central: ${partialData.comprensionProblema.slice(0, 450)}`);
  }
  if (partialData.sintesisClave?.ideaPrincipal) {
    parts.push(`Idea principal: ${String(partialData.sintesisClave.ideaPrincipal).slice(0, 300)}`);
  }
  if (typeof partialData.esBiblico === "boolean") {
    parts.push(`esBiblico=${partialData.esBiblico}, esCientifico=${Boolean(partialData.esCientifico)}`);
  }
  if (Array.isArray(partialData.perspectivas) && partialData.perspectivas.length > 0) {
    const names = partialData.perspectivas.map((p: any) => p?.nombre).filter(Boolean).join(" | ");
    if (names) parts.push(`Perspectivas evaluadas: ${names}`);
  }
  if (partialData.recomendacionFinal?.recomendacion) {
    parts.push(`Recomendación adoptada: ${String(partialData.recomendacionFinal.recomendacion).slice(0, 350)}`);
  }
  return parts.length > 0 ? `\nCONTEXTO YA GENERADO EN ETAPAS PREVIAS (mantén plena coherencia):\n${parts.join("\n")}\n` : "";
}

function buildStagePrompt(
  stage: AnalysisStageId,
  topic: string,
  focusType: string,
  selectedTradition: string,
  partialData: Record<string, any>
): string {
  const header = `Consulta a analizar: "${topic}"
Categoría / Enfoque solicitado: "${focusType}"
Marco de Referencia Adicional: "${selectedTradition}"
${buildStageDigest(partialData)}`;

  switch (stage) {
    case "sintesis":
      return `${header}
TAREA — ETAPA 1 DE 7 (Comprensión y Síntesis Central):
Genera ÚNICAMENTE un JSON válido con estos campos exactos:
{
  "resumenEjecutivo": "2 párrafos claros y sustanciosos que sinteticen tesis, tensión central y veredicto preliminar.",
  "comprensionProblema": "Desglose preciso entre la pregunta superficial, el dilema subyacente, restricciones reales y efectos de segundo orden.",
  "sintesisClave": {
    "deQueTrata": "Respuesta directa a ¿De qué trata?",
    "ideaPrincipal": "Tesis o idea fundamental.",
    "argumentos": ["Argumento clave 1", "Argumento clave 2", "Argumento clave 3"],
    "conclusion": "Conclusión sintética clara."
  },
  "esBiblico": false,
  "esCientifico": false
}
Regla: Ajusta "esBiblico" y "esCientifico" a true o false según la naturaleza real del tema y enfoque.`;

    case "fundamentos":
      return `${header}
TAREA — ETAPA 2 DE 7 (Glosario Dual y Contexto 5D):
Genera ÚNICAMENTE un JSON válido con estos campos exactos:
{
  "definiciones": [
    {
      "termino": "Término clave (4 a 5 términos relevantes)",
      "definicion": "Explicación académica o técnica precisa.",
      "explicacionSencilla": "Explicación sencilla cotidiana con analogía clara (SIN repetir el texto técnico)."
    }
  ],
  "contexto": {
    "historico": "2 a 4 oraciones concretas sobre el contexto histórico.",
    "cultural": "2 a 4 oraciones concretas sobre el contexto cultural/social.",
    "cientifico": "2 a 4 oraciones concretas sobre la base científica o empírica.",
    "biblico": "2 a 4 oraciones prudentes y objetivas sobre el ángulo ético o bíblico.",
    "practico": "2 a 4 oraciones sobre la aplicación práctica cotidiana."
  }
}`;

    case "investigacion": {
      const wantBiblical =
        Boolean(partialData.esBiblico) ||
        focusType.toLowerCase().includes("bíblic") ||
        focusType.toLowerCase().includes("teológ");
      const wantScientific =
        Boolean(partialData.esCientifico) ||
        focusType.toLowerCase().includes("cienc") ||
        focusType.toLowerCase().includes("salud");

      return `${header}
TAREA — ETAPA 3 DE 7 (Investigación Multidisciplinaria, Perspectivas y Evidencia):
Genera ÚNICAMENTE un JSON válido con estos campos exactos:
{
  "analisisMultidisciplinario": [
    {
      "disciplina": "Nombre de disciplina (4 a 6 disciplinas clave)",
      "analisis": "Análisis claro con mecanismos, datos o principios concretos.",
      "relevancia": "Alta | Media | Baja"
    }
  ],
  "perspectivas": [
    {
      "nombre": "Postura o corriente diferenciada (3 perspectivas)",
      "fortalezas": ["Fortaleza específica 1", "Fortaleza 2", "Fortaleza 3"],
      "debilidades": ["Debilidad específica 1", "Debilidad 2", "Debilidad 3"]
    }
  ],
  "comparacionObjetiva": {
    "evidencia": "Solidez empírica comparada entre posturas.",
    "coherenciaLogica": "Consistencia lógica interna.",
    "resultadosObservables": "Resultados verificables en la práctica.",
    "compatibilidadBiblica": "Alineación o tensión con principios éticos y bíblicos.",
    "riesgos": "Comparación de riesgos por postura.",
    "beneficios": "Comparación de beneficios esperados.",
    "limitaciones": "Limitaciones metodológicas o de alcance."
  }${
    wantBiblical
      ? `,
  "especificosBiblicos": {
    "contextoHistoricoBiblico": "Contexto histórico.",
    "contextoLiterario": "Género, estructura y flujo.",
    "propositoAutor": "Propósito original del autor.",
    "destinatarios": "Audiencia original.",
    "principioUniversal": "Principio ético/espiritual inmutable.",
    "aplicacionActual": "Aplicación contemporánea fiel.",
    "pasajesRelacionados": ["Libro Cap:Ver - relación breve"],
    "posiblesMalasInterpretaciones": [
      { "interpretacion": "Lectura errónea común", "refutacion": "Refutación exegética" }
    ],
    "conclusionExegetica": "Conclusión exegética."
  }`
      : ""
  }${
    wantScientific
      ? `,
  "especificosCientificos": {
    "nivelEvidencia": "Jerarquía de evidencia científica disponible.",
    "consensoCientifico": "Estado del consenso científico.",
    "limitacionesCientificas": "Brechas y limitaciones de los estudios.",
    "estudiosContradictorios": ["Línea de evidencia o hallazgos divergentes"],
    "gradoCerteza": "Grado de certeza científica (Alto/Moderado/Bajo) y razón."
  }`
      : ""
  }
}`;
    }

    case "decision":
      return `${header}
TAREA — ETAPA 4 DE 7 (Matriz de Decisiones, Veredicto y Riesgos):
Genera ÚNICAMENTE un JSON válido con estos campos exactos:
{
  "matrizDecisiones": [
    {
      "alternativa": "Alternativa realista (3 a 4 alternativas, incluyendo status quo e híbrida)",
      "pros": ["Pro 1", "Pro 2", "Pro 3"],
      "contras": ["Contra 1", "Contra 2", "Contra 3"],
      "costo": "Bajo / Medio / Alto",
      "tiempo": "Inmediato / Corto / Mediano / Largo plazo",
      "riesgo": "Bajo / Medio / Alto",
      "beneficio": "Bajo / Medio / Alto",
      "impacto": "Bajo / Medio / Alto / Muy Alto",
      "factibilidad": "Baja / Media / Alta"
    }
  ],
  "recomendacionFinal": {
    "recomendacion": "Recomendación estratégica clara y fundamentada.",
    "justificacion": "Justificación sólida basada en evidencia y ponderación de alternativas.",
    "nivelConfianza": 88,
    "porqueConfianza": "Razón explícita del porcentaje de confianza y factores limitantes."
  },
  "riesgos": [
    {
      "riesgo": "Riesgo concreto (3 a 4 riesgos)",
      "prevencion": "Medida concreta para evitarlo.",
      "solucion": "Plan de contingencia si ocurre."
    }
  ]
}`;

    case "accion":
      return `${header}
TAREA — ETAPA 5 DE 7 (Plan Paso a Paso, Acciones Prácticas y Checklist):
Genera ÚNICAMENTE un JSON válido con estos campos exactos:
{
  "planPasoAPaso": [
    { "paso": 1, "titulo": "Título de fase (4 a 6 pasos secuenciales)", "descripcion": "Instrucciones concretas y ejecutables." }
  ],
  "accionesPracticas": {
    "inmediatas": ["2 a 3 acciones medibles para hoy/mañana"],
    "estaSemana": ["2 a 3 acciones para los próximos 7 días"],
    "esteMes": ["2 a 3 acciones para las próximas 4 semanas"],
    "largoPlazo": ["2 a 3 hábitos o metas sostenibles"]
  },
  "erroresComunes": [
    { "error": "Error frecuente (3 a 4 errores)", "comoEvitarlo": "Pauta práctica para evitarlo." }
  ],
  "listaVerificacion": [
    "5 a 6 criterios concretos de verificación"
  ],
  "resumenFinal": {
    "queHacer": ["3 a 4 acciones clave recomendadas"],
    "queNoHacer": ["3 a 4 acciones desaconsejadas"],
    "porque": "Síntesis del fundamento de estas directrices."
  }
}`;

    case "auditoria":
      return `${header}
TAREA — ETAPA 6 DE 7 (Auditoría de Razonamiento y Test Diagnóstico):
Genera ÚNICAMENTE un JSON válido con estos campos exactos:
{
  "auditoriaRazonamiento": {
    "supuestosHechos": ["3 supuestos implícitos/explícitos del análisis"],
    "evidenciaContradictoria": ["3 datos o argumentos que desafían la conclusión"],
    "informacionFaltante": ["3 datos adicionales que elevarían la certeza"],
    "sesgosCognitivos": [
      { "sesgo": "Nombre del sesgo (3 sesgos)", "descripcion": "Definición breve.", "comoAfecta": "Cómo distorsiona este dilema." }
    ],
    "escenariosFalla": ["2 a 3 escenarios donde la recomendación dejaría de aplicar"],
    "disparadoresCambio": ["2 a 3 señales concretas que obligarían a cambiar de postura"]
  },
  "testDiagnostico": {
    "tituloTest": "Test Diagnóstico sobre ${topic.slice(0, 70)}",
    "descripcion": "Cuestionario de 4 preguntas para evaluar dominio objetivo y sesgos psicológicos.",
    "preguntas": [
      {
        "id": 1,
        "pregunta": "Pregunta precisa (4 preguntas)",
        "dimension": "conocimiento | psicologico | ambos",
        "opciones": [
          { "letra": "A", "texto": "Opción intuitiva o con mito", "puntajeConocimiento": 5, "puntajePsicologico": 8, "explicacionEvaluativa": "Qué revela esta opción." },
          { "letra": "B", "texto": "Opción parcial", "puntajeConocimiento": 12, "puntajePsicologico": 14, "explicacionEvaluativa": "Evaluación intermedia." },
          { "letra": "C", "texto": "Opción sólida", "puntajeConocimiento": 20, "puntajePsicologico": 20, "explicacionEvaluativa": "Evaluación avanzada." },
          { "letra": "D", "texto": "Opción rigurosa y madura", "puntajeConocimiento": 25, "puntajePsicologico": 25, "explicacionEvaluativa": "Evaluación sobresaliente." }
        ]
      }
    ],
    "interpretacionConocimiento": {
      "nivelAlto": "Interpretación puntaje alto.",
      "nivelMedio": "Interpretación puntaje medio.",
      "nivelBajo": "Interpretación puntaje bajo."
    },
    "interpretacionPsicologica": {
      "nivelMaduro": "Alta estabilidad y objetividad.",
      "nivelModerado": "Disposición moderada con sesgos controlables.",
      "nivelVulnerable": "Alta vulnerabilidad emocional o sesgo."
    }
  }
}`;

    case "recursos":
      return `${header}
TAREA — ETAPA 7 DE 7 (Discernimiento Profundo y Recursos Recomendados):
Genera ÚNICAMENTE un JSON válido con estos campos exactos:
{
  "teologiaEvangelica": {
    "evaluacionMotivosCorazon": {
      "motivosSubyacentes": ["2 a 3 motivaciones humanas profundas en juego"],
      "posiblesIdolosCorazon": ["Búsqueda de control, aprobación, comodidad, etc."],
      "consejoPastoralDeseos": "Consejo prudente, respetuoso y reflexivo sobre las motivaciones internas."
    },
    "impactoEclesiologicoPastoral": {
      "servicioYComunidad": "Impacto en comunidad y servicio al prójimo.",
      "testimonioPublico": "Integridad y testimonio público.",
      "discipuladoYFamilia": "Formación ética, familiar y carácter."
    },
    "marcoRedentorCristocentrico": {
      "creacion": "Principio de orden y propósito constructivo.",
      "caida": "Cómo la fragilidad o el error distorsionan este tema.",
      "redencion": "Camino de restauración, gracia y sabiduría.",
      "consumacion": "Perspectiva de esperanza y trascendencia.",
      "conexionEvangelio": "Síntesis respetuosa conectada con la gracia (sin forzar dogma en temas estrictamente técnicos)."
    },
    "concordanciaOriginal": [
      {
        "pasaje": "Pasaje pertinente o principio clásico",
        "palabrasOriginales": [
          { "palabra": "Término original", "transliteracion": "transliteracion", "idioma": "Griego | Hebreo", "strong": "G0000", "traduccionLiteral": "Traducción literal", "significadoTeologico": "Significado en contexto" }
        ],
        "contextoExegetico": "Nota breve de contexto."
      }
    ]
  },
  "recursosRecomendados": {
    "libros": [{ "titulo": "Título real (2 por categoría)", "autor": "Autor", "url": "" }],
    "articulos": [{ "titulo": "Artículo o referencia académica real", "url": "" }],
    "sitiosWeb": [{ "titulo": "Portal oficial reconocido", "url": "URL https:// real solo si estás 100% seguro, o \"\"" }],
    "videos": [{ "titulo": "Conferencia o canal educativo real", "url": "" }],
    "cursos": [{ "titulo": "Curso o plataforma reconocida", "url": "" }],
    "herramientas": [{ "titulo": "Herramienta o marco práctico", "url": "" }],
    "ias": [{ "titulo": "Aplicación de IA útil para este tema", "url": "" }],
    "software": [{ "titulo": "Software digital relevante", "url": "" }],
    "plantillas": [{ "titulo": "Plantilla o framework aplicable", "url": "" }]
  }
}
REGLA URLs: NUNCA inventes URLs ni rutas largas ficticias; deja "url": "" si no conoces el dominio oficial exacto con certeza absoluta.`;
  }
}

async function executeSingleStage(
  ai: GoogleGenAI,
  stage: AnalysisStageId,
  params: {
    topic: string;
    focusType: string;
    tradicionTeologica: string;
    partialData: Record<string, any>;
  }
): Promise<Record<string, any>> {
  const { topic, focusType, tradicionTeologica, partialData } = params;
  const systemInstruction = buildCoreSystemInstruction(tradicionTeologica);
  const userPrompt = buildStagePrompt(stage, topic, focusType, tradicionTeologica, partialData);

  const groundedSourcesPromise =
    stage === "recursos"
      ? fetchGroundedSourcesForTopic(ai, topic).catch(() => [] as GroundedWebSource[])
      : Promise.resolve([] as GroundedWebSource[]);

  const { parsedJson } = await generateContentWithRetryAndFallback(
    ai,
    "gemini-4-hydrogen",
    "gemini-3.1-flash-lite",
    userPrompt,
    systemInstruction,
    { stageLabel: `Etapa ${stage}` }
  );

  const safeStageFields = pickSafePartialAnalysisData(parsedJson);

  if (stage === "recursos") {
    const rawRec = safeStageFields.recursosRecomendados || {};
    const sanitizedResources: RecommendedResources = {
      libros: sanitizeResourceList(rawRec.libros, "Libro recomendado"),
      articulos: sanitizeResourceList(rawRec.articulos, "Artículo científico"),
      sitiosWeb: sanitizeResourceList(rawRec.sitiosWeb, "Sitio web recomendado"),
      videos: sanitizeResourceList(rawRec.videos, "Video recomendado"),
      cursos: sanitizeResourceList(rawRec.cursos, "Curso recomendado"),
      herramientas: sanitizeResourceList(rawRec.herramientas, "Herramienta recomendada"),
      ias: sanitizeResourceList(rawRec.ias, "Herramienta de IA"),
      software: sanitizeResourceList(rawRec.software, "Software recomendado"),
      plantillas: sanitizeResourceList(rawRec.plantillas, "Plantilla recomendada"),
    };

    const groundedSources = await Promise.race([
      groundedSourcesPromise,
      new Promise<GroundedWebSource[]>((resolve) => setTimeout(() => resolve([]), 1200)),
    ]);

    safeStageFields.recursosRecomendados = await Promise.race([
      enrichAndVerifyRecommendedResources(sanitizedResources, groundedSources),
      new Promise<RecommendedResources>((resolve) =>
        setTimeout(() => resolve(sanitizedResources), 2200)
      ),
    ]);
  }

  return safeStageFields;
}

function finalizeJobIfComplete(job: AnalysisJobRecord): boolean {
  const nextStage = getNextPendingStage(job.completedStages);
  if (!nextStage) {
    job.status = "completed";
    job.currentStage = null;
    job.failedStage = null;
    job.error = undefined;
    job.retryable = false;
    job.result = sanitizeAnalysisResponse(job.partialData);
    job.updatedAt = Date.now();
    persistJobCheckpoint(job);
    return true;
  }
  job.currentStage = nextStage;
  job.updatedAt = Date.now();
  persistJobCheckpoint(job);
  return false;
}

async function runJobStagesInBackground(jobId: string): Promise<void> {
  if (activeJobRunners.has(jobId)) return;
  activeJobRunners.add(jobId);

  try {
    const ai = getGeminiClient();
    const job = loadJobCheckpoint(jobId);
    if (!job) return;

    while (true) {
      const nextStage = getNextPendingStage(job.completedStages);
      if (!nextStage) {
        finalizeJobIfComplete(job);
        break;
      }

      job.status = "running";
      job.currentStage = nextStage;
      job.failedStage = null;
      job.error = undefined;
      job.updatedAt = Date.now();
      persistJobCheckpoint(job);

      try {
        const stageData = await executeSingleStage(ai, nextStage, {
          topic: job.topic,
          focusType: job.focusType,
          tradicionTeologica: job.tradicionTeologica,
          partialData: job.partialData,
        });

        job.partialData = {
          ...job.partialData,
          ...stageData,
        };
        job.completedStages = filterValidStageIds([...job.completedStages, nextStage]);
        const isDone = finalizeJobIfComplete(job);

        if (isDone) {
          break;
        }
      } catch (stageErr: any) {
        job.status = "paused_error";
        job.failedStage = nextStage;
        job.currentStage = nextStage;
        job.error = stageErr?.message || `Error al procesar la etapa ${nextStage}.`;
        job.retryable = stageErr?.retryable !== false;
        job.updatedAt = Date.now();
        persistJobCheckpoint(job);
        break;
      }
    }
  } catch (fatalErr: any) {
    const job = loadJobCheckpoint(jobId);
    if (job) {
      job.status = "paused_error";
      job.error = fatalErr?.message || "Error al inicializar el motor de análisis.";
      job.retryable = false;
      job.updatedAt = Date.now();
      persistJobCheckpoint(job);
    }
  } finally {
    activeJobRunners.delete(jobId);
  }
}

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(express.json({ limit: "10mb" }));

  // Global security & privacy headers
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    if (req.path.startsWith("/api/")) {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.setHeader("Pragma", "no-cache");
    }
    next();
  });

  app.get("/api/auth/status", (_req: Request, res: Response) => {
    res.json({
      serverProtected: false,
      pinConfigured: false,
      authenticated: true,
      isProduction: isProductionEnv(),
    });
  });

  // Per-IP mutation quota guard (60 requests / 10 min)
  const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    const ip = getClientIp(req);
    const now = Date.now();
    const usage = apiMutationRequests.get(ip);
    if (!usage || usage.resetAt <= now) {
      apiMutationRequests.set(ip, { count: 1, resetAt: now + 10 * 60 * 1000 });
    } else if (usage.count >= 60) {
      res.status(429).json({
        error: "Límite de seguridad de consultas alcanzado temporalmente. Intenta en unos minutos.",
      });
      return;
    } else {
      usage.count += 1;
    }
    next();
  };

  // Generous read-only limiter for job status polling (600 requests / 10 min)
  const pollQuotaGuard = (req: Request, res: Response, next: NextFunction) => {
    const ip = getClientIp(req);
    const now = Date.now();
    const usage = apiPollRequests.get(ip);
    if (!usage || usage.resetAt <= now) {
      apiPollRequests.set(ip, { count: 1, resetAt: now + 10 * 60 * 1000 });
    } else if (usage.count >= 600) {
      res.status(429).json({
        error: "Demasiadas solicitudes de verificación seguidas. Espera unos segundos.",
      });
      return;
    } else {
      usage.count += 1;
    }
    next();
  };

  // Start a checkpointed, resumable analysis job
  app.post("/api/analyze/jobs", requireAuth, (req: Request, res: Response) => {
    try {
      const {
        topic,
        focusType,
        tradicionTeologica,
        jobId: requestedJobId,
        completedStages: rawCompleted,
        partialData: rawPartial,
      } = req.body || {};

      if (!topic || typeof topic !== "string" || !topic.trim()) {
        res.status(400).json({ error: "El tema de consulta es requerido." });
        return;
      }

      const cleanTopic = topic.trim().slice(0, 4000);
      const cleanFocus =
        typeof focusType === "string" && focusType.trim() ? focusType.trim().slice(0, 200) : "General";
      const cleanTradition =
        typeof tradicionTeologica === "string" && tradicionTeologica.trim()
          ? tradicionTeologica.trim().slice(0, 200)
          : "General / Neutral (Sin Sesgo)";

      const jobId = isValidUuid(requestedJobId) ? requestedJobId : crypto.randomUUID();
      const existing = loadJobCheckpoint(jobId);

      const seededStages = filterValidStageIds(rawCompleted);
      const seededPartial = pickSafePartialAnalysisData(rawPartial);

      const mergedPartial = {
        ...seededPartial,
        ...(existing?.partialData || {}),
      };
      const mergedStages = filterValidStageIds([
        ...seededStages,
        ...(existing?.completedStages || []),
      ]);

      const nextStage = getNextPendingStage(mergedStages);
      const now = Date.now();

      const job: AnalysisJobRecord = existing
        ? {
            ...existing,
            topic: cleanTopic,
            focusType: cleanFocus,
            tradicionTeologica: cleanTradition,
            completedStages: mergedStages,
            partialData: mergedPartial,
            currentStage: nextStage,
            failedStage: null,
            error: undefined,
            status: nextStage ? "running" : "completed",
            updatedAt: now,
          }
        : {
            jobId,
            status: nextStage ? "running" : "completed",
            topic: cleanTopic,
            focusType: cleanFocus,
            tradicionTeologica: cleanTradition,
            completedStages: mergedStages,
            currentStage: nextStage,
            failedStage: null,
            partialData: mergedPartial,
            createdAt: now,
            updatedAt: now,
          };

      if (!nextStage) {
        job.result = sanitizeAnalysisResponse(job.partialData);
      }

      persistJobCheckpoint(job);

      if (job.status === "running" && getExecutionMode() === "background") {
        void runJobStagesInBackground(job.jobId);
        res.status(202).json(serializeJobState(job));
        return;
      }

      res.status(200).json(serializeJobState(job));
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "No se pudo iniciar el análisis." });
    }
  });

  // Poll current job checkpoint status
  app.get("/api/analyze/jobs/:jobId", pollQuotaGuard, (req: Request, res: Response) => {
    const jobId = req.params.jobId;
    if (!isValidUuid(jobId)) {
      res.status(400).json({ error: "Identificador de análisis inválido." });
      return;
    }

    const job = loadJobCheckpoint(jobId);
    if (!job) {
      res.status(404).json({ error: "Trabajo de análisis no encontrado o expirado." });
      return;
    }

    res.json(serializeJobState(job));
  });

  // Resume an interrupted/paused job (rehydrating from client checkpoint if server restarted)
  app.post("/api/analyze/jobs/:jobId/resume", requireAuth, (req: Request, res: Response) => {
    try {
      const jobId = req.params.jobId;
      if (!isValidUuid(jobId)) {
        res.status(400).json({ error: "Identificador de análisis inválido." });
        return;
      }

      const {
        topic,
        focusType,
        tradicionTeologica,
        completedStages: rawCompleted,
        partialData: rawPartial,
      } = req.body || {};

      let job = loadJobCheckpoint(jobId);
      const clientStages = filterValidStageIds(rawCompleted);
      const clientPartial = pickSafePartialAnalysisData(rawPartial);

      if (!job) {
        if (!topic || typeof topic !== "string" || !topic.trim()) {
          res.status(404).json({ error: "No se encontró el análisis previo ni los datos para reanudarlo." });
          return;
        }
        const now = Date.now();
        job = {
          jobId,
          status: "running",
          topic: topic.trim().slice(0, 4000),
          focusType:
            typeof focusType === "string" && focusType.trim() ? focusType.trim().slice(0, 200) : "General",
          tradicionTeologica:
            typeof tradicionTeologica === "string" && tradicionTeologica.trim()
              ? tradicionTeologica.trim().slice(0, 200)
              : "General / Neutral (Sin Sesgo)",
          completedStages: clientStages,
          currentStage: getNextPendingStage(clientStages),
          failedStage: null,
          partialData: clientPartial,
          createdAt: now,
          updatedAt: now,
        };
      } else {
        // Merge any newer client checkpoint stages cleanly
        const mergedStages = filterValidStageIds([...job.completedStages, ...clientStages]);
        job.completedStages = mergedStages;
        job.partialData = { ...clientPartial, ...job.partialData };
        job.failedStage = null;
        job.error = undefined;
        job.retryable = true;
      }

      const nextStage = getNextPendingStage(job.completedStages);
      if (!nextStage) {
        finalizeJobIfComplete(job);
        res.status(200).json(serializeJobState(job));
        return;
      }

      job.status = "running";
      job.currentStage = nextStage;
      job.updatedAt = Date.now();
      persistJobCheckpoint(job);

      if (getExecutionMode() === "background") {
        void runJobStagesInBackground(job.jobId);
        res.status(202).json(serializeJobState(job));
        return;
      }

      res.status(200).json(serializeJobState(job));
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "No se pudo reanudar el análisis." });
    }
  });

  // Execute a single checkpointed stage synchronously (for step-by-step / Vercel serverless mode)
  app.post("/api/analyze/stage", requireAuth, async (req: Request, res: Response) => {
    try {
      const {
        jobId: requestedJobId,
        stage,
        topic,
        focusType,
        tradicionTeologica,
        completedStages: rawCompleted,
        partialData: rawPartial,
      } = req.body || {};

      if (typeof stage !== "string" || !ANALYSIS_STAGE_ORDER.includes(stage as AnalysisStageId)) {
        res.status(400).json({ error: "Etapa de análisis inválida." });
        return;
      }
      if (!topic || typeof topic !== "string" || !topic.trim()) {
        res.status(400).json({ error: "El tema de consulta es requerido." });
        return;
      }

      const stageId = stage as AnalysisStageId;
      const cleanTopic = topic.trim().slice(0, 4000);
      const cleanFocus =
        typeof focusType === "string" && focusType.trim() ? focusType.trim().slice(0, 200) : "General";
      const cleanTradition =
        typeof tradicionTeologica === "string" && tradicionTeologica.trim()
          ? tradicionTeologica.trim().slice(0, 200)
          : "General / Neutral (Sin Sesgo)";

      const jobId = isValidUuid(requestedJobId) ? requestedJobId : crypto.randomUUID();
      const existing = loadJobCheckpoint(jobId);

      const clientStages = filterValidStageIds(rawCompleted);
      const clientPartial = pickSafePartialAnalysisData(rawPartial);
      const basePartial = { ...clientPartial, ...(existing?.partialData || {}) };
      const baseStages = filterValidStageIds([...clientStages, ...(existing?.completedStages || [])]);

      // If stage already completed in existing checkpoint, return immediately without re-billing AI
      if (existing && existing.completedStages.includes(stageId)) {
        finalizeJobIfComplete(existing);
        res.json(serializeJobState(existing));
        return;
      }

      const ai = getGeminiClient();
      const stageData = await executeSingleStage(ai, stageId, {
        topic: cleanTopic,
        focusType: cleanFocus,
        tradicionTeologica: cleanTradition,
        partialData: basePartial,
      });

      const mergedPartial = {
        ...basePartial,
        ...stageData,
      };
      const mergedStages = filterValidStageIds([...baseStages, stageId]);
      const now = Date.now();

      const updatedJob: AnalysisJobRecord = existing
        ? {
            ...existing,
            topic: cleanTopic,
            focusType: cleanFocus,
            tradicionTeologica: cleanTradition,
            completedStages: mergedStages,
            partialData: mergedPartial,
            failedStage: null,
            error: undefined,
            updatedAt: now,
          }
        : {
            jobId,
            status: "running",
            topic: cleanTopic,
            focusType: cleanFocus,
            tradicionTeologica: cleanTradition,
            completedStages: mergedStages,
            currentStage: getNextPendingStage(mergedStages),
            failedStage: null,
            partialData: mergedPartial,
            createdAt: now,
            updatedAt: now,
          };

      const isDone = finalizeJobIfComplete(updatedJob);
      if (!isDone) {
        updatedJob.status = "running";
        persistJobCheckpoint(updatedJob);
      }

      res.json(serializeJobState(updatedJob));
    } catch (error: any) {
      const is503 =
        error?.message?.includes("503") ||
        error?.message?.includes("saturación") ||
        error?.message?.includes("alta demanda");
      res.status(is503 ? 503 : 500).json({
        error: error?.message || "Ocurrió un error al ejecutar esta etapa del análisis.",
        retryable: error?.retryable !== false,
      });
    }
  });

  // Backwards-compatible synchronous comprehensive analysis (now powered by the 4-stage pipeline)
  app.post("/api/analyze", requireAuth, async (req: Request, res: Response) => {
    try {
      const { topic, focusType, tradicionTeologica } = req.body || {};

      if (!topic || typeof topic !== "string" || !topic.trim()) {
        res.status(400).json({ error: "El tema de consulta es requerido." });
        return;
      }

      const cleanTopic = topic.trim().slice(0, 4000);
      const cleanFocus =
        typeof focusType === "string" && focusType.trim() ? focusType.trim().slice(0, 200) : "General";
      const selectedTradition =
        typeof tradicionTeologica === "string" && tradicionTeologica.trim()
          ? tradicionTeologica.trim().slice(0, 200)
          : "General / Neutral (Sin Sesgo)";

      const ai = getGeminiClient();
      let accumulated: Record<string, any> = {};

      for (const stage of ANALYSIS_STAGE_ORDER) {
        const stageData = await executeSingleStage(ai, stage, {
          topic: cleanTopic,
          focusType: cleanFocus,
          tradicionTeologica: selectedTradition,
          partialData: accumulated,
        });
        accumulated = { ...accumulated, ...stageData };
      }

      const sanitizedData = sanitizeAnalysisResponse(accumulated);
      res.json(sanitizedData);
    } catch (error: any) {
      const is503 =
        error?.message?.includes("503") ||
        error?.message?.includes("saturación") ||
        error?.message?.includes("alta demanda");
      res.status(is503 ? 503 : 500).json({
        error: error?.message || "Ocurrió un error inesperado al analizar.",
      });
    }
  });

  // REST API for inline dictionary lookup
  app.post("/api/define", requireAuth, async (req: Request, res: Response) => {
    try {
      const { term, context } = req.body || {};

      if (!term || typeof term !== "string" || !term.trim()) {
        res.status(400).json({ error: "El término a definir es requerido." });
        return;
      }

      const cleanTerm = term.trim().slice(0, 100);
      const ai = getGeminiClient();

      const systemInstruction = `
Eres un lexicógrafo, erudito en idiomas bíblicos y teólogo profesional.
Tu tarea es proveer una definición concisa, rigurosa y enriquecedora en español para un término o frase corta seleccionada por el usuario en un documento de análisis.

Debes responder ÚNICAMENTE en formato JSON válido con esta estructura estricta:
{
  "termino": "El término corregido o capitalizado",
  "definicion": "Explicación académica o técnica, clara y precisa del significado del término (2 a 3 frases).",
  "explicacionSencilla": "Explicación accesible, directa y en lenguaje sencillo de uso cotidiano (estilo 'Layman' / para principiantes) para facilitar la comprensión inmediata.",
  "etimologia": "Origen etimológico o término en idioma original (Hebreo, Griego, Latín, Raíz germánica/romance) si aplica, con su transliteración y significado literal. Si no aplica, pon 'Etimología general'.",
  "contextoAcademico": "Breve explicación de la relevancia o uso del término en el ámbito teológico, exegético, filosófico o científico.",
  "categoria": "Teología / Exégesis / Filosofía / Ética / Ciencia / General"
}
`;

      const userPrompt = `Define el siguiente término o expresión seleccionada: "${cleanTerm}".
Contexto cercano del texto donde apareció: "${(typeof context === "string" ? context : "").slice(0, 300)}"`;

      const { parsedJson } = await generateContentWithRetryAndFallback(
        ai,
        "gemini-4-hydrogen",
        "gemini-3.1-flash-lite",
        userPrompt,
        systemInstruction,
        { stageLabel: "Diccionario" }
      );

      if (!parsedJson) {
        res.status(500).json({ error: "El diccionario devolvió un formato no estándar. Intenta de nuevo." });
        return;
      }
      res.json(parsedJson);
    } catch (error: any) {
      const is503 =
        error?.message?.includes("503") ||
        error?.message?.includes("saturación") ||
        error?.message?.includes("alta demanda");
      res.status(is503 ? 503 : 500).json({ error: error?.message || "Error al consultar el diccionario." });
    }
  });

  // Never let unmatched /api/* routes fall through to Vite SPA index.html
  app.use("/api", (_req: Request, res: Response) => {
    res.status(404).json({ error: "Ruta de API no encontrada." });
  });

  // Ensure any Express/body-parser error on /api/* returns JSON rather than HTML
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith("/api/")) {
      res.status(err?.status || 500).json({
        error: err?.message || "Error interno en el servidor API.",
      });
      return;
    }
    next(err);
  });

  return app;
}
