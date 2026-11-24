import express, { Request, Response, NextFunction } from "express";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import dotenv from "dotenv";
import { normalizeSafeHttpUrl, sanitizeAnalysisResponse } from "../src/utils.js";
import { RecommendedResources, ResourceItem } from "../src/types.js";

dotenv.config();

// In-memory rate limiter (effective per instance & warm serverless container)
const apiRequests = new Map<string, { count: number; resetAt: number }>();

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
  systemInstruction: string
): Promise<{ response: any; modelUsed: string; trace: ModelAttemptTrace[] }> {
  const checkIsTransient = (error: any): boolean => {
    let errorCode = error.status || error.statusCode || error.code;
    let errorStatus = "";
    let errorMsgStr = error.message || "";

    try {
      if (error.message && (error.message.startsWith("{") || error.message.includes('"error"'))) {
        const startIdx = error.message.indexOf("{");
        const endIdx = error.message.lastIndexOf("}");
        if (startIdx !== -1 && endIdx !== -1) {
          const jsonStr = error.message.substring(startIdx, endIdx + 1);
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

    const isTransient =
      errorCode === 503 ||
      errorCode === 429 ||
      errorCode === 500 ||
      errorCode === 504 ||
      errorStatus === "UNAVAILABLE" ||
      errorStatus === "RESOURCE_EXHAUSTED" ||
      errorMsgStr.includes("503") ||
      errorMsgStr.includes("504") ||
      errorMsgStr.includes("UNAVAILABLE") ||
      errorMsgStr.includes("high demand") ||
      errorMsgStr.includes("Resource exhausted") ||
      errorMsgStr.includes("RESOURCE_EXHAUSTED") ||
      errorMsgStr.includes("429") ||
      errorMsgStr.includes("overloaded") ||
      errorMsgStr.includes("timeout") ||
      errorMsgStr.includes("Timeout") ||
      errorMsgStr.includes("aborted");

    return !!isTransient;
  };

  const modelsToTry = Array.from(
    new Set([primaryModel, fallbackModel, "gemini-3.1-flash-lite", "gemini-4-hydrogen"])
  );
  let lastError: any = null;
  let anyTransient = false;
  const trace: ModelAttemptTrace[] = [];

  for (let i = 0; i < modelsToTry.length; i++) {
    const currentModel = modelsToTry[i];
    const maxAttemptsForModel = i === 0 ? 2 : 1;
    let useThinking = true;

    for (let attempt = 1; attempt <= maxAttemptsForModel; attempt++) {
      const startedAt = Date.now();
      const timeoutMs = i === 0 ? 55000 : 20000;
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;

      try {
        console.log(`[Gemini API] Conectando con ${currentModel} (intento ${attempt}/${maxAttemptsForModel})...`);

        const timeoutPromise = new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new Error(`Timeout de respuesta en ${currentModel} tras ${timeoutMs / 1000}s`));
          }, timeoutMs);
        });

        const config: Record<string, any> = {
          abortSignal: controller.signal,
          systemInstruction,
          responseMimeType: "application/json",
        };
        if (useThinking) {
          config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
        }

        const generatePromise = ai.models.generateContent({
          model: currentModel,
          contents: userPrompt,
          config,
        });

        const response = await Promise.race([generatePromise, timeoutPromise]);
        const responseText = response?.text;
        const ms = Date.now() - startedAt;
        if (responseText && responseText.trim()) {
          console.log(`[Gemini API] Respuesta completada exitosamente con ${currentModel} en ${ms}ms`);
          trace.push({ model: currentModel, ms, ok: true });
          return { response, modelUsed: currentModel, trace };
        }
        throw new Error(`Respuesta vacía del modelo ${currentModel}.`);
      } catch (error: any) {
        const ms = Date.now() - startedAt;
        const errMsg = String(error?.message || "error").slice(0, 180);
        trace.push({ model: currentModel, ms, ok: false, error: errMsg });
        lastError = error;
        const isTransient = checkIsTransient(error);
        if (isTransient) {
          anyTransient = true;
        }
        console.log(`[Gemini API] Error en ${currentModel} (${ms}ms): ${errMsg}`);

        if (useThinking && errMsg.toLowerCase().includes("thinking")) {
          useThinking = false;
          if (attempt < maxAttemptsForModel) continue;
        }

        const isTimeout = errMsg.includes("Timeout de respuesta") || errMsg.includes("aborted");
        if (attempt < maxAttemptsForModel && isTransient && !isTimeout && ms < 8000) {
          await new Promise((r) => setTimeout(r, 700));
          continue;
        }
        break;
      } finally {
        if (timer) clearTimeout(timer);
      }
    }
  }

  const isHighDemand = anyTransient || checkIsTransient(lastError);
  const err: any = new Error(
    isHighDemand
      ? "Los servidores de Google AI Studio están experimentando una alta demanda temporal (503). Por favor, intenta de nuevo en unos instantes."
      : `No fue posible completar la solicitud con el motor de IA. Detalle: ${lastError?.message || "Servicio no disponible"}`
  );
  err.trace = trace;
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
    // AbortError or transient timeout on a known direct URL: keep direct URL unless DNS/conn refused
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
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const genPromise = ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: `Encuentra los mejores sitios web oficiales, artículos de referencia, cursos o herramientas confiables en línea sobre: "${topic.slice(0, 220)}"`,
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

  // Ensure sitiosWeb includes up to 3 top verified grounded web links if not already present
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

  // Compatibility auth status endpoint (PIN access lock removed per user request)
  app.get("/api/auth/status", (_req: Request, res: Response) => {
    res.json({
      serverProtected: false,
      pinConfigured: false,
      authenticated: true,
      isProduction: isProductionEnv(),
    });
  });

  // Per-IP quota guard (40 requests / 10 min) without PIN blocking
  const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    const ip = getClientIp(req);
    const now = Date.now();
    const usage = apiRequests.get(ip);
    if (!usage || usage.resetAt <= now) {
      apiRequests.set(ip, { count: 1, resetAt: now + 10 * 60 * 1000 });
    } else if (usage.count >= 40) {
      res.status(429).json({
        error: "Límite de seguridad de consultas alcanzado temporalmente. Intenta en unos minutos.",
      });
      return;
    } else {
      usage.count += 1;
    }

    next();
  };

  // REST API for comprehensive analysis
  app.post("/api/analyze", requireAuth, async (req: Request, res: Response) => {
    try {
      const { topic, focusType, tradicionTeologica } = req.body;

      const selectedTradition = tradicionTeologica || "General / No Denominacional";

      if (!topic || typeof topic !== "string") {
        res.status(400).json({ error: "El tema de consulta es requerido." });
        return;
      }

      const ai = getGeminiClient();

      const systemInstruction = `
Eres el "Sistema Universal de Análisis Integral, Investigación, Discernimiento y Toma de Decisiones Objetivas".
La aplicación es de carácter GENERAL, ABIERTO Y MULTIDISCIPLINARIO para responder y analizar cualquier tipo de consulta (ciencia, tecnología, negocios, finanzas, toma de decisiones personales, salud, psicología, filosofía, ética, sociedad, historia, derecho o teología).

Tu propósito es ayudar al usuario a comprender profundamente cualquier tema y tomar decisiones fundamentadas con la máxima OBJETIVIDAD, RIGOR Y NEUTRALIDAD METODOLÓGICA (SIN SESGO DE CONFIRMACIÓN O DOGMÁTICO).

REGLAS FUNDAMENTALES DE ADAPTACIÓN EPISTEMOLÓGICA SEGÚN EL TEMA:
1. RIGOR Y LENGUAJE ADAPTATIVO:
   - Si la consulta es NETAMENTE CIENTÍFICA, TÉCNICA, FINANCIERA O SECULAR (ej. medicina, informática, inversiones, derecho, biología, ingeniería): Aplica rigurosidad científica pura, basada en evidencia empírica, lógica formal, análisis de datos y costo/beneficio. NO fuerces lenguaje de estudio bíblico ni sermones teológicos sobre temas seculares donde no corresponda.
   - Si la consulta es TEOLÓGICA O BÍBLICA: Aplica máxima rigurosidad exegética y hermenéutica histórico-gramatical, analizando términos originales en idiomas bíblicos (hebreo/griego), contexto histórico y sintaxis.
   - Si la consulta es UN DILEMA ÉTICO O TOMA DE DECISIONES COMPLEJA: Pondera equilibradamente la lógica, la ciencia, la viabilidad práctica y los principios éticos/morales universales.

2. PONDERACIÓN MULTIDISCIPLINARIA:
   - Incluye perspectivas de múltiples disciplinas (Ciencia, Lógica, Filosofía, Ética, Economía, Psicología, Teología, Derecho, etc.), ajustando el peso de cada una a la naturaleza real del problema.
   - Distingue de forma estricta entre: Hechos comprobados empíricamente, Inferencias lógicas, Hipótesis, Opiniones, Tradiciones y Especulaciones. Nunca presentes opiniones como si fueran hechos.

3. REGLA OBLIGATORIA PARA DEFINICIONES CLAVE:
   - Para cada elemento en la lista 'definiciones', DEBES proporcionar DILIGENTEMENTE dos explicaciones distintas:
     a) 'definicion': La explicación técnica, académica o formal precisa.
     b) 'explicacionSencilla': Una explicación en lenguaje popular, sencillo y cotidiano (estilo 'Layman' / para principiantes) usando analogías o lenguaje común. NUNCA repitas el texto ni las palabras complejas de 'definicion'.

METODOLOGÍA OBLIGATORIA:
1. Comprender la pregunta y el verdadero problema subyacente.
2. Identificar objetivos y detectar supuestos ocultos.
3. Analizar riesgos y buscar alternativas creativas.
4. Comparar soluciones de manera objetiva y cuantitativa/cualitativa.
5. Realizar una auto-auditoría crítica del propio razonamiento.

FORMATO DE SALIDA:
Debes responder strictly en formato JSON utilizando el esquema que se te provee. No agregues explicaciones fuera de la estructura JSON.
El formato de respuesta JSON debe contener con exactitud los siguientes campos:

{
  "resumenEjecutivo": "Explicar el problema en pocas líneas de forma clara y directa.",
  "comprensionProblema": "Explicar qué realmente está preguntando el usuario y cuál es el verdadero problema o dilema de fondo.",
  "sintesisClave": {
    "deQueTrata": "Respuesta sintetizada, clara y directa a: ¿De qué trata el tema o la consulta?",
    "ideaPrincipal": "Respuesta precisa a: ¿Cuál es la idea principal o tesis fundamental?",
    "argumentos": [
      "Argumento principal 1 con su evidencia o lógica clave",
      "Argumento principal 2 de peso multidisciplinario",
      "Argumento principal 3 de contraste o viabilidad"
    ],
    "conclusion": "Respuesta determinante y clara a: ¿Cuál es la conclusión o dictamen final?"
  },
  "definiciones": [
    { 
      "termino": "Concepto clave 1", 
      "definicion": "Explicación académica o técnica detallada y precisa.",
      "explicacionSencilla": "Explicación súper sencilla y fácil de entender en lenguaje cotidiano / para principiantes (estilo 'Layman'). NUNCA repetir el texto de la definición técnica."
    }
  ],
  "contexto": {
    "historico": "Contexto histórico del asunto.",
    "cultural": "Contexto cultural o social actual o histórico.",
    "cientifico": "Contexto científico, descubrimientos o teorías asociadas.",
    "biblico": "Contexto bíblico o ético-teológico relevante.",
    "practico": "Contexto práctico o cotidiano donde se aplica el tema."
  },
  "analisisMultidisciplinario": [
    {
      "disciplina": "Biblia / Ciencia / Psicología / Filosofía / Ética / Medicina / Economía / Sociología / Historia / Educación / Administración / Tecnología / Derecho",
      "analisis": "Análisis profundo desde esta perspectiva disciplinaria.",
      "relevancia": "Alta"
    }
  ],
  "perspectivas": [
    {
      "nombre": "Perspectiva A (ej. Tradicional, Pragmática, Escéptica, Conservadora, etc.)",
      "fortalezas": ["Fortaleza 1", "Fortaleza 2"],
      "debilidades": ["Debilidad 1", "Debilidad 2"]
    }
  ],
  "comparacionObjetiva": {
    "evidencia": "Resumen de la solidez de la evidencia para cada postura.",
    "coherenciaLogica": "Análisis de la coherencia lógica interna de los argumentos.",
    "resultadosObservables": "Resultados prácticos que se pueden verificar empíricamente.",
    "compatibilidadBiblica": "Grado de alineación con principios bíblicos exegéticos.",
    "riesgos": "Comparación de riesgos de tomar una postura u otra.",
    "beneficios": "Comparación de beneficios esperados.",
    "limitaciones": "Limitaciones metodológicas o conceptuales de lo analizado."
  },
  "recursosRecomendados": {
    "libros": [
      { "titulo": "Título exacto del libro", "autor": "Nombre del autor", "url": "URL https:// real y verificable (sitio oficial, Google Books, OpenLibrary o editorial) si estás 100% seguro, o \"\"" }
    ],
    "articulos": [
      { "titulo": "Título exacto o referencia académica con autores", "url": "URL https:// real de DOI (https://doi.org/...), PubMed, SciELO o revista científica si estás 100% seguro, o \"\"" }
    ],
    "sitiosWeb": [
      { "titulo": "Nombre descriptivo del portal web confiable", "url": "URL oficial https:// exacta y real del sitio (ej. https://es.khanacademy.org)" }
    ],
    "videos": [
      { "titulo": "Título de conferencia, canal educativo o video relevante", "url": "URL https:// real de YouTube/TED/canal oficial si estás 100% seguro, o \"\"" }
    ],
    "cursos": [
      { "titulo": "Nombre del curso o especialización y plataforma", "url": "URL https:// real de Coursera, edX, MIT OCW, Platzi o plataforma oficial si estás 100% seguro, o \"\"" }
    ],
    "herramientas": [
      { "titulo": "Nombre de la herramienta o marco de trabajo", "url": "URL oficial https:// real de la herramienta si existe" }
    ],
    "ias": [
      { "titulo": "Aplicación de IA recomendada y caso de uso", "url": "URL oficial https:// real de la aplicación (ej. https://notebooklm.google.com)" }
    ],
    "software": [
      { "titulo": "Nombre del software, sistema o app digital", "url": "URL oficial https:// real del software (ej. https://www.notion.so)" }
    ],
    "plantillas": [
      { "titulo": "Nombre de la plantilla, hoja de cálculo o framework práctico", "url": "URL oficial https:// real si existe, o \"\"" }
    ]
  },
  "accionesPracticas": {
    "inmediatas": ["Acción específica, medible y realista para hoy/mañana"],
    "estaSemana": ["Acción para los siguientes 7 días"],
    "esteMes": ["Acción para las próximas 4 semanas"],
    "largoPlazo": ["Objetivo o práctica continua a largo plazo"]
  },
  "riesgos": [
    {
      "riesgo": "Descripción de un riesgo potencial al actuar o decidir.",
      "prevencion": "Cómo prevenir que este riesgo se materialice.",
      "solucion": "Cómo mitigar o solucionar si ocurre."
    }
  ],
  "matrizDecisiones": [
    {
      "alternativa": "Alternativa o curso de acción 1",
      "pros": ["Pro 1", "Pro 2"],
      "contras": ["Contra 1", "Contra 2"],
      "costo": "Bajo / Medio / Alto / Estimación",
      "tiempo": "Inmediato / Corto plazo / Mediano plazo / Largo plazo",
      "riesgo": "Bajo / Medio / Alto",
      "beneficio": "Bajo / Medio / Alto",
      "impacto": "Bajo / Medio / Alto / Muy Alto",
      "factibilidad": "Baja / Media / Alta"
    }
  ],
  "recomendacionFinal": {
    "recomendacion": "La recomendación u opción elegida de forma inequívoca y objetiva.",
    "justificacion": "Explicación sólida del porqué basada en toda la evidencia recolectada.",
    "nivelConfianza": 95,
    "porqueConfianza": "Justificación explícita de por qué este nivel de confianza."
  },
  "planPasoAPaso": [
    { "paso": 1, "titulo": "Título de la fase o paso", "descripcion": "Instrucciones detalladas de ejecución." }
  ],
  "erroresComunes": [
    { "error": "Error típico que comete la gente en este asunto", "comoEvitarlo": "Pautas para evadir este error." }
  ],
  "listaVerificacion": [
    "Elemento de checklist 1 para verificar que la decisión/acción va por buen camino",
    "Elemento de checklist 2..."
  ],
  "resumenFinal": {
    "queHacer": ["Acción clave recomendada"],
    "queNoHacer": ["Acción prohibida o desaconsejada"],
    "porque": "Breve explicación de la razón detrás de estas dos listas."
  },
  "esBiblico": false,
  "especificosBiblicos": {
    "contextoHistoricoBiblico": "Contexto histórico detallado del pasaje o doctrina.",
    "contextoLiterario": "Contexto literario (género, estructura, flujo de pensamiento).",
    "propositoAutor": "Propósito original del autor al escribir.",
    "destinatarios": "A quiénes iba dirigido originalmente.",
    "principioUniversal": "Principio espiritual o ético inmutable y universal.",
    "aplicacionActual": "Cómo se aplica ese principio el día de hoy.",
    "pasajesRelacionados": ["Libro Capítulo:Versículo - Explicación breve de la relación"],
    "posiblesMalasInterpretaciones": [
      { "interpretacion": "Interpretación errónea común (fuera de contexto)", "refutacion": "Refutación basada en exégesis." }
    ],
    "conclusionExegetica": "Conclusión formal exegética."
  },
  "esCientifico": false,
  "especificosCientificos": {
    "nivelEvidencia": "Nivel de evidencia (ej. Nivel Ia, Ib, IIa, etc. basados en tipo de estudios).",
    "consensoCientifico": "Estado actual del consenso de la comunidad de científicos.",
    "limitacionesCientificas": "Limitaciones de los estudios o teorías actuales.",
    "estudiosContradictorios": ["Estudio/Autor/Año que presenta resultados contrarios o alternativos"],
    "gradoCerteza": "Grado de certeza científica (ej. Alto, Moderado, Bajo) con justificación."
  },
  "auditoriaRazonamiento": {
    "supuestosHechos": ["¿Qué supuestos implícitos o explícitos se hicieron al formular la conclusión?"],
    "evidenciaContradictoria": ["¿Qué evidencia sólida, dato o pasaje contradice la conclusión recomendada?"],
    "informacionFaltante": ["¿Qué información o datos adicionales faltarían para elevar el nivel de certeza?"],
    "sesgosCognitivos": [
      {
        "sesgo": "Sesgo de confirmación / Sesgo de disponibilidad / Sesgo de autoridad / etc.",
        "descripcion": "Definición breve del sesgo.",
        "comoAfecta": "Cómo podría estar afectando este sesgo a esta decisión o análisis específico."
      }
    ],
    "escenariosFalla": ["Escenario específico en el cual la recomendación propuesta dejaría de ser la mejor opción."],
    "disparadoresCambio": ["Dato, evento o descubrimiento concreto que obligaría a cambiar la conclusión de inmediato."]
  },
  "testDiagnostico": {
    "tituloTest": "Test Diagnóstico de Nivel de Conocimiento y Realidad Psicológica sobre [Tema]",
    "descripcion": "Cuestionario de 4 a 5 preguntas para evaluar la precisión técnica y la disposición emocional/sesgos cognitivos del usuario respecto a este tema específico.",
    "preguntas": [
      {
        "id": 1,
        "pregunta": "Pregunta 1 evaluando comprensión de conceptos clave o datos duros del tema.",
        "dimension": "conocimiento",
        "opciones": [
          {
            "letra": "A",
            "texto": "Opción que refleja falta de información o mitos comunes.",
            "puntajeConocimiento": 5,
            "puntajePsicologico": 10,
            "explicacionEvaluativa": "Explica qué revela esta respuesta en cuanto a su nivel de conocimiento técnico."
          },
          {
            "letra": "B",
            "texto": "Opción con conocimiento parcial o superficial.",
            "puntajeConocimiento": 15,
            "puntajePsicologico": 15,
            "explicacionEvaluativa": "Diagnóstico de conocimiento intermedio."
          },
          {
            "letra": "C",
            "texto": "Opción basada en datos precisos y comprensión avanzada.",
            "puntajeConocimiento": 25,
            "puntajePsicologico": 25,
            "explicacionEvaluativa": "Excelente dominio conceptual del tema."
          }
        ]
      }
    ],
    "interpretacionConocimiento": {
      "nivelAlto": "Interpretación para puntuaciones altas en conocimiento técnico.",
      "nivelMedio": "Interpretación para puntuaciones intermedias.",
      "nivelBajo": "Interpretación y recomendación para principiantes o conocimiento intuitivo."
    },
    "interpretacionPsicologica": {
      "nivelMaduro": "Diagnóstico de alta estabilidad psicológica y objetividad.",
      "nivelModerado": "Diagnóstico de disposición intermedia con sesgos controlables.",
      "nivelVulnerable": "Diagnóstico de alta vulnerabilidad a sesgos emocionales, prisa o ansiedad."
    }
  },
  "teologiaEvangelica": {
    "evaluacionMotivosCorazon": {
      "motivosSubyacentes": ["Deseos profundos, temores latentes, anhelos o intenciones que motivan esta consulta o decisión en el corazón humano según Santiago 4 y Proverbios."],
      "posiblesIdolosCorazon": ["Identificar ídolos funcionales del corazón en juego en este tema, como control, comodidad, aprobación, poder, o seguridad."],
      "consejoPastoralDeseos": "Breve exégesis de consejería bíblica para redireccionar y alinear esos deseos del corazón con Cristo Jesús (Proverbios 4:23)."
    },
    "impactoEclesiologicoPastoral": {
      "servicioYComunidad": "Impacto del tema en la edificación, el servicio ministerial y la comunión de los santos en la iglesia local (Hebreos 10:24-25).",
      "testimonioPublico": "Implicaciones para el testimonio cristiano público y la proclamación del Evangelio ante la sociedad (Mateo 5:16).",
      "discipuladoYFamilia": "Efecto o pautas para el discipulado personal, la instrucción en santidad y la transmisión de la fe familiar."
    },
    "marcoRedentorCristocentrico": {
      "creacion": "Cómo refleja este tema el diseño original, la bondad y el orden de Dios en la Creación.",
      "caida": "De qué manera este asunto ha sido distorsionado, afectado o roto por el Pecado y la Caída del hombre.",
      "redencion": "La obra redentora de Jesucristo, la cruz, la gracia salvadora y la capacitación del Espíritu Santo en este dilema.",
      "consumacion": "La esperanza futura de la gloria final, la renovación de todas las cosas y el consuelo de la eternidad en la Consumación.",
      "conexionEvangelio": "La síntesis teológica de cómo este asunto en particular se conecta y depende directamente del Evangelio de la Gracia de Jesucristo."
    },
    "concordanciaOriginal": [
      {
        "pasaje": "Cita bíblica clave relevante para el tema (ej. Romanos 12:1 o Proverbios 4:23).",
        "palabrasOriginales": [
          {
            "palabra": "La palabra en su alfabeto original (Hebreo o Griego con sus caracteres correctos).",
            "transliteracion": "La transliteración fonética de la palabra original.",
            "idioma": "Hebreo o Griego",
            "strong": "Número de Concordancia Strong (ej. G3563 o H3820).",
            "traduccionLiteral": "Traducción literal palabra por palabra al español.",
            "significadoTeologico": "Significado e implicancia teológico-exegética profunda de este término en este contexto."
          }
        ],
        "contextoExegetico": "Análisis exegético breve del versículo completo en su idioma original y su sintaxis."
      }
    ]
  }
}

REGLAS DE RIGOR Y PROFUNDIDAD OBLIGATORIA:
- NUNCA inventes datos, cifras ficticias, citas bíblicas inexistentes o nombres de estudios científicos falsos. Si un dato empírico tiene incertidumbre o límites metodológicos, decláralo explícitamente.
- DENSIDAD Y ABUNDANCIA RELEVANTE (SIN RELLENO): Desarrolla cada bloque con sustancia analítica real, mecanismos causales concretos, criterios verificables y ejemplos claros en lugar de frases genéricas breves:
  * "resumenEjecutivo": 2 a 3 párrafos sustanciosos que sinteticen tesis, tensión central y veredicto.
  * "comprensionProblema": Desglose profundo entre la pregunta superficial, el dilema subyacente, las restricciones reales y efectos de segundo orden.
  * "definiciones": Incluye de 5 a 7 términos clave del dominio, cada uno con definición académica precisa Y una "explicacionSencilla" clara con analogía cotidiana.
  * "contexto": Desarrolla cada uno de los 5 ejes ("historico", "cultural", "cientifico", "biblico", "practico") con 3 a 5 oraciones concretas y pertinentes al tema.
  * "analisisMultidisciplinario": Incluye de 5 a 7 disciplinas verdaderamente relevantes al caso, explicando mecanismos, datos o principios concretos de cada campo.
  * "perspectivas": Incluye de 3 a 4 corrientes o posturas reales bien diferenciadas, con al menos 3 fortalezas y 3 debilidades específicas en cada una.
  * "matrizDecisiones": Incluye de 4 a 5 alternativas estratégicas realistas (incluyendo opción conservadora/status quo u opción híbrida), con al menos 3 pros y 3 contras claros, y todos los atributos evaluados.
  * "riesgos": Incluye de 4 a 5 riesgos concretos con su estrategia de prevención y solución de contingencia accionable.
  * "planPasoAPaso": Incluye de 5 a 7 fases secuenciales detalladas y accionables.
  * "accionesPracticas": Al menos 3 acciones medibles por cada horizonte temporal ("inmediatas", "estaSemana", "esteMes", "largoPlazo").
  * "erroresComunes": Incluye de 4 a 5 errores frecuentes con explicación clara de cómo evitarlos.
  * "listaVerificacion": Incluye de 6 a 8 criterios concretos de verificación.
  * "auditoriaRazonamiento": Incluye 3 a 4 supuestos, 3 a 4 evidencias contradictorias, 3 a 4 datos faltantes, 3 a 4 sesgos cognitivos analizados en profundidad, 3 escenarios de falla y 3 disparadores de cambio.
  * "testDiagnostico": Incluye 5 a 6 preguntas diagnósticas precisas con 4 opciones graduadas ("A" a "D") cada una.
- REGLA ESTRICTA PARA URLs EN "recursosRecomendados": Incluye de 2 a 4 recursos reales por categoría pertinente. Incluye el campo "url" únicamente con enlaces "https://" reales, oficiales y conocidos con certeza (portales oficiales, herramientas, software, DOI reales o plataformas educativas reconocidas). NUNCA inventes rutas largas o URLs ficticias; si no conoces la URL exacta con certeza, deja "url": "" para que el servidor o buscador genere el enlace verificado correspondiente.
- Si el usuario eligió un enfoque específico (ej. Bíblico, Científico, Toma de Decisiones), asegúrate de que esa sección esté sumamente desarrollada, pero completa TODO el esquema con rigor y exactitud.
`;

      const isSabiduriaPractica =
        selectedTradition === "Sabiduría práctica y habilidades sociales" ||
        selectedTradition.toLowerCase().includes("sabiduría práctica") ||
        selectedTradition.toLowerCase().includes("habilidades sociales");

      const sabiduriaPracticaPrompt = isSabiduriaPractica
        ? `
MARCO OBLIGATORIO ACTIVO: "Sabiduría práctica y habilidades sociales".
El usuario ha seleccionado explícitamente el marco de "Sabiduría práctica y habilidades sociales". DEBES AJUSTAR FIELMENTE todo el análisis, las decisiones y las recomendaciones a estas capacidades:
1. Sabiduría Práctica Aplicada (Phrónēsis / Prudencia Operativa):
   - Cada consejo y análisis debe aterrizar en la realidad cotidiana y en el sentido común más refinado, descartando dogmatismos abstractos o teorías académicas desconectadas del mundo real.
   - Ponderar el "timing" oportuno (cuándo actuar, cuándo esperar, cuándo guardar silencio), la sobriedad emocional y la anticipación de consecuencias de segundo y tercer orden.
2. Inteligencia Interpersonal y Habilidades Sociales Avanzadas:
   - Comunicación Asertiva: Proveer guías y tácticas concretas de cómo expresar posturas con firmeza pero sin agresividad, cuidando el tono, el lenguaje corporal y la elección exacta de palabras.
   - Empatía y Calibración: Analizar la perspectiva, motivaciones ocultas, miedos y necesidades de los otros involucrados (lectura de dinámicas de poder, estados de ánimo y tensiones relacionales).
   - Manejo de Conflictos y Negociación Ganar-Ganar: Proponer soluciones diplomáticas que construyan puentes, reduzcan la fricción social, eviten herir susceptibilidades y conviertan opositores en colaboradores.
   - Establecimiento de Límites Saludables: Enseñar cómo decir "no" con elegancia y respeto, cómo proteger la propia integridad sin generar rupturas innecesarias.
3. Desglose en las Secciones del Esquema JSON:
   - "resumenEjecutivo" y "comprensionProblema": Enfatizar la dimensión humana, relacional y pragmática del asunto.
   - "analisisMultidisciplinario": Debe incluir obligatoriamente disciplinas como "Psicología Social y Relacional", "Habilidades de Comunicación y Asertividad", "Pragmatismo Conductual y Negociación", y "Ética Interpersonal".
   - "accionesPracticas" y "planPasoAPaso": Cada paso debe incluir una instrucción clara sobre cómo gestionarlo con las personas involucradas (qué decir, cómo comunicarlo, a quién consultar o cómo mitigar resistencias).
   - "erroresComunes": Centrarse en errores típicos de ego, reactividad impulsiva, hablar de más, falta de tacto social, soberbia intelectual o pasivo-agresividad.
   - "matrizDecisiones": Evaluar el impacto en las relaciones interpersonales, capital social, reputación y bienestar emocional.
   - "testDiagnostico" y "simuladorEscenarios": Las preguntas y escenarios deben evaluar directamente el nivel de prudencia práctica, madurez emocional, asertividad y tacto social ante situaciones tensas.
`
        : "";

      const userPrompt = `Realiza un análisis integral, objetivo y riguroso para la siguiente consulta:
Tema de consulta: "${topic}"
Categoría / Enfoque solicitado: "${focusType}"
Marco de Referencia Adicional: "${selectedTradition}"
${sabiduriaPracticaPrompt}

Instrucciones de adaptación objetiva:
1. Determina autónomamente la naturaleza del tema. Si es predominantemente científico/técnico ("esCientifico": true), si es bíblico/teológico ("esBiblico": true), o si abarca ambas/múltiples dimensiones.
2. Mantén la mayor objetividad metodológica según la materia de que se trate.
3. Si el Marco de Referencia Adicional es "Sabiduría práctica y habilidades sociales", ajusta todo el reporte fielmente a las capacidades de prudencia cotidiana, asertividad comunicacional, inteligencia relacional, negociación ganar-ganar y resolución pacífica de conflictos.
4. Si el tema o enfoque no es bíblico/teológico, enfoca la mayor sustancia analítica en los datos, lógica, finanzas, ciencia y práctica. Para los campos teológicos o bíblicos, complétalos de manera prudente, respetuosa y neutral enfocándolos en valores éticos universales sin forzar dogmas religiosos sobre asuntos puramente seculares.
5. Si el tema es de naturaleza teológica o el enfoque es Bíblico/Teológico, desarrolla a plenitud la exégesis de idiomas originales, la tradición confesional indicada ("${selectedTradition}") y la consejería de vida.`;

      const groundedSourcesPromise = fetchGroundedSourcesForTopic(ai, topic).catch(() => [] as GroundedWebSource[]);

      const { response } = await generateContentWithRetryAndFallback(
        ai,
        "gemini-3.1-flash-lite",
        "gemini-4-hydrogen",
        userPrompt,
        systemInstruction
      );

      let text = response.text;
      if (!text) {
        throw new Error("No se pudo obtener una respuesta del modelo.");
      }

      text = text.trim();
      if (text.startsWith("```")) {
        text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
      }

      let parsedData;
      try {
        parsedData = JSON.parse(text);
      } catch {
        const firstBrace = text.indexOf("{");
        const lastBrace = text.lastIndexOf("}");
        if (firstBrace !== -1 && lastBrace > firstBrace) {
          try {
            parsedData = JSON.parse(text.slice(firstBrace, lastBrace + 1));
          } catch {
            parsedData = null;
          }
        }
        if (!parsedData) {
          console.warn("Aviso: Formato JSON no estándar recibido:", text?.slice(0, 100));
          res.status(500).json({
            error: "El modelo generó un formato no estándar. Pulsa 'Reintentar ahora'.",
          });
          return;
        }
      }

      const sanitizedData = sanitizeAnalysisResponse(parsedData);
      const groundedSources = await Promise.race([
        groundedSourcesPromise,
        new Promise<GroundedWebSource[]>((resolve) => setTimeout(() => resolve([]), 1500)),
      ]);
      sanitizedData.recursosRecomendados = await enrichAndVerifyRecommendedResources(
        sanitizedData.recursosRecomendados,
        groundedSources
      );
      res.json(sanitizedData);
    } catch (error: any) {
      const is503 = error.message?.includes("503") || error.message?.includes("alta demanda");
      res.status(is503 ? 503 : 500).json({ error: error.message || "Ocurrió un error inesperado al analizar." });
    }
  });

  // REST API for inline dictionary lookup
  app.post("/api/define", requireAuth, async (req: Request, res: Response) => {
    try {
      const { term, context } = req.body;

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
Contexto cercano del texto donde apareció: "${(context || "").slice(0, 300)}"`;

      const { response } = await generateContentWithRetryAndFallback(
        ai,
        "gemini-3.1-flash-lite",
        "gemini-4-hydrogen",
        userPrompt,
        systemInstruction
      );

      let text = response.text;
      if (!text) {
        throw new Error("No se obtuvo respuesta del diccionario.");
      }

      text = text.trim();
      if (text.startsWith("```")) {
        text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
      }

      let parsedData;
      try {
        parsedData = JSON.parse(text);
      } catch {
        const firstBrace = text.indexOf("{");
        const lastBrace = text.lastIndexOf("}");
        if (firstBrace !== -1 && lastBrace > firstBrace) {
          try {
            parsedData = JSON.parse(text.slice(firstBrace, lastBrace + 1));
          } catch {
            parsedData = null;
          }
        }
        if (!parsedData) {
          res.status(500).json({ error: "El diccionario devolvió un formato no estándar. Intenta de nuevo." });
          return;
        }
      }
      res.json(parsedData);
    } catch (error: any) {
      const is503 = error.message?.includes("503") || error.message?.includes("alta demanda");
      res.status(is503 ? 503 : 500).json({ error: error.message || "Error al consultar el diccionario." });
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
