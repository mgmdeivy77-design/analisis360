import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BookOpen,
  Brain,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Compass,
  Contrast,
  Copy,
  Download,
  Eraser,
  Eye,
  FileCode2,
  FileText,
  Glasses,
  History,
  Layers,
  Moon,
  PauseCircle,
  Play,
  Plus,
  Printer,
  RefreshCw,
  ScrollText,
  SlidersHorizontal,
  Sparkles,
  Star,
  Trees,
  WifiOff,
  X,
} from "lucide-react";
import {
  AnalysisJobStateResponse,
  AnalysisStageId,
  ComprehensiveAnalysisResponse,
  DictionaryDefinitionResponse,
} from "./types";
import {
  ANALYSIS_STAGE_ORDER,
  ANALYSIS_STAGES,
  filterValidStageIds,
  generateMarkdownReport,
  pickSafePartialAnalysisData,
  sanitizeAnalysisResponse,
} from "./utils";
import MarkdownViewerModal from "./components/MarkdownViewerModal";
import { PWAInstallButton } from "./components/PWAInstallButton";
import { OfflineIndicator } from "./components/OfflineIndicator";
import { HistoryDrawer, HistoryEntry } from "./components/HistoryDrawer";
import { AnalysisTabId, AnalysisWorkspace } from "./components/AnalysisWorkspace";
import {
  CATEGORY_OPTIONS,
  COLOR_THEMES,
  LOADING_PHASES,
  METHODOLOGICAL_PILLARS,
  PRESET_LIBRARY,
  PresetTemplate,
  THEME_META_COLORS,
  TRADITION_OPTIONS,
} from "./data/presets";

const safeGetStorage = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeSetStorage = (key: string, value: string): void => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore storage quota/sandbox errors
  }
};

const safeRemoveStorage = (key: string): void => {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
};

const THEME_ICONS: Record<string, typeof Trees> = {
  sage: Trees,
  sepia: ScrollText,
  slate: Contrast,
  midnight: Moon,
};

const ACTIVE_JOB_STORAGE_KEY = "sai_active_analysis_job_v2";
const ACTIVE_JOB_MAX_AGE_MS = 2 * 60 * 60 * 1000;

interface PersistedAnalysisJob {
  jobId: string;
  topic: string;
  focusType: string;
  tradition: string;
  executionMode: "background" | "step-by-step";
  status: "running" | "paused_error" | "interrupted";
  completedStages: AnalysisStageId[];
  currentStage: AnalysisStageId | null;
  failedStage?: AnalysisStageId | null;
  partialData: Record<string, any>;
  errorMessage?: string;
  updatedAt: number;
}

type PresetFilterGroup = "Todas" | PresetTemplate["group"];

export default function App() {
  const [currentTheme, setCurrentTheme] = useState<string>(() => {
    return safeGetStorage("eye_care_theme") || "sage";
  });
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [toolsMenuOpen, setToolsMenuOpen] = useState(false);
  const [mobileNavTab, setMobileNavTab] = useState<"analizar" | "plantillas" | "resultados" | "historial">("analizar");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", currentTheme);
    safeSetStorage("eye_care_theme", currentTheme);
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute("content", THEME_META_COLORS[currentTheme] || "#0e1612");
    }
  }, [currentTheme]);

  // Clean up any legacy PIN keys
  useEffect(() => {
    try {
      localStorage.removeItem("sai_local_pin_hash");
      localStorage.removeItem("sai_server_session_token");
      localStorage.removeItem("sai_auto_lock_minutes");
      localStorage.removeItem("sai_lock_on_hide");
    } catch {
      // ignore
    }
  }, []);

  const [topic, setTopic] = useState("");
  const [focusType, setFocusType] = useState("General");
  const [customFocusText, setCustomFocusText] = useState("");
  const [tradicionTeologica, setTradicionTeologica] = useState("General / Neutral (Sin Sesgo)");
  const [activeTradition, setActiveTradition] = useState<string>("General / Neutral (Sin Sesgo)");
  const [loading, setLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState("");
  const [activeJob, setActiveJob] = useState<PersistedAnalysisJob | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [isPartialPreview, setIsPartialPreview] = useState(false);
  const [analysis, setAnalysis] = useState<ComprehensiveAnalysisResponse | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [activeTab, setActiveTab] = useState<AnalysisTabId>("resumen");
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [showArchitecture, setShowArchitecture] = useState(false);
  const [copying, setCopying] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [mdViewerOpen, setMdViewerOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const activeRunControllerRef = useRef<AbortController | null>(null);
  const activeRunIdRef = useRef<number>(0);

  // Template Library filters & page shuffle
  const [presetGroup, setPresetGroup] = useState<PresetFilterGroup>("Todas");
  const [presetOffset, setPresetOffset] = useState(0);

  const filteredPresets = useMemo(() => {
    if (presetGroup === "Todas") return PRESET_LIBRARY;
    return PRESET_LIBRARY.filter((p) => p.group === presetGroup);
  }, [presetGroup]);

  const visiblePresets = useMemo(() => {
    if (filteredPresets.length <= 4) return filteredPresets;
    const list: PresetTemplate[] = [];
    for (let i = 0; i < 4; i++) {
      list.push(filteredPresets[(presetOffset + i) % filteredPresets.length]);
    }
    return list;
  }, [filteredPresets, presetOffset]);

  const handleShufflePresets = () => {
    setPresetOffset((prev) => (prev + 4) % Math.max(filteredPresets.length, 1));
  };

  // Inline selection dictionary states
  const [dictEnabled, setDictEnabled] = useState(true);
  const [dictSelection, setDictSelection] = useState<{
    text: string;
    context: string;
    top: number;
    left: number;
  } | null>(null);
  const [dictLoading, setDictLoading] = useState(false);
  const [dictResult, setDictResult] = useState<DictionaryDefinitionResponse | null>(null);
  const [dictError, setDictError] = useState<string | null>(null);
  const [copiedDict, setCopiedDict] = useState(false);

  const analysisContainerRef = useRef<HTMLDivElement>(null);
  const dictPopupRef = useRef<HTMLDivElement>(null);
  const inputSectionRef = useRef<HTMLDivElement>(null);
  const presetsSectionRef = useRef<HTMLDivElement>(null);
  const resultsSectionRef = useRef<HTMLDivElement>(null);
  const themeDropdownRef = useRef<HTMLDivElement>(null);
  const toolsDropdownRef = useRef<HTMLDivElement>(null);

  // Close header menus on outside click / Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (themeDropdownRef.current && !themeDropdownRef.current.contains(e.target as Node)) {
        setThemeMenuOpen(false);
      }
      if (toolsDropdownRef.current && !toolsDropdownRef.current.contains(e.target as Node)) {
        setToolsMenuOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setThemeMenuOpen(false);
        setToolsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, []);

  const parseApiJsonResponse = async <T,>(response: Response, endpointLabel: string): Promise<T> => {
    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    const rawText = await response.text().catch(() => "");
    const trimmed = rawText.trim();

    if (!response.ok) {
      let parsedError = "";
      try {
        parsedError = JSON.parse(rawText)?.error || "";
      } catch {
        parsedError = "";
      }

      if (parsedError) {
        throw new Error(parsedError);
      }
      if (response.status === 504) {
        throw new Error("El servidor tardó demasiado en responder (Error 504). Intenta de nuevo en unos segundos.");
      }
      if (response.status === 502 || response.status === 503) {
        throw new Error(`El servidor estuvo temporalmente saturado o iniciándose (Error ${response.status}). Pulsa 'Reintentar ahora'.`);
      }
      if (response.status === 404) {
        throw new Error(`No se encontró el servicio de análisis (${endpointLabel} · 404). Verifica el despliegue.`);
      }
      if (trimmed.startsWith("<")) {
        throw new Error(
          `El servidor devolvió una página HTML (HTTP ${response.status}) en lugar de JSON al consultar ${endpointLabel}. Recarga la página o verifica que el backend /api esté activo.`
        );
      }
      throw new Error(
        `Error del servidor (HTTP ${response.status})${trimmed ? `: ${trimmed.replace(/<[^>]+>/g, " ").trim().slice(0, 120)}` : ""}`
      );
    }

    if (trimmed.startsWith("<") || (!contentType.includes("application/json") && !trimmed.startsWith("{") && !trimmed.startsWith("["))) {
      throw new Error(
        `El servidor devolvió una página HTML en lugar de datos JSON al consultar ${endpointLabel}. Esto ocurre si el servidor se está reiniciando o si la app se abrió en un alojamiento estático sin backend /api.`
      );
    }

    try {
      return JSON.parse(rawText) as T;
    } catch {
      throw new Error(`La respuesta de ${endpointLabel} no tiene un formato JSON válido. Pulsa 'Reintentar ahora'.`);
    }
  };

  const fetchDefinition = async (term: string, context: string) => {
    setDictLoading(true);
    setDictError(null);
    setDictResult(null);
    setCopiedDict(false);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    try {
      const res = await fetch("/api/define", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ term, context }),
      });
      const data = await parseApiJsonResponse<DictionaryDefinitionResponse>(res, "/api/define");
      setDictResult(data);
    } catch (err: any) {
      if (err?.name === "AbortError") {
        setDictError("La consulta del diccionario tardó demasiado. Intenta nuevamente.");
      } else {
        setDictError(err.message || "Error al definir palabra.");
      }
    } finally {
      clearTimeout(timer);
      setDictLoading(false);
    }
  };

  const handleTextSelection = useCallback(() => {
    if (!dictEnabled) return;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const rawText = selection.toString().trim();
    const cleanText = rawText.replace(/[\r\n]+/g, " ");

    if (!cleanText || cleanText.length < 2 || cleanText.length > 90) return;

    if (analysisContainerRef.current) {
      const isInside =
        (selection.anchorNode && analysisContainerRef.current.contains(selection.anchorNode)) ||
        (selection.focusNode && analysisContainerRef.current.contains(selection.focusNode));
      if (!isInside) return;
    }

    try {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const parentText = selection.anchorNode?.parentElement?.textContent || "";
      const isMobile = window.innerWidth < 640;

      let top = 0;
      let left = 0;

      if (!isMobile) {
        const popupWidth = Math.min(380, window.innerWidth - 32);
        left = rect.left + rect.width / 2 - popupWidth / 2;
        left = Math.max(16, Math.min(window.innerWidth - popupWidth - 16, left));

        top = rect.bottom + 8;
        if (rect.bottom > window.innerHeight - 260) {
          top = Math.max(16, rect.top - 240);
        }
      }

      setDictSelection({
        text: cleanText,
        context: parentText.slice(0, 200),
        top,
        left,
      });

      fetchDefinition(cleanText, parentText.slice(0, 200));
    } catch (e) {
      console.warn("Selection rect error:", e);
    }
  }, [dictEnabled]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const onSelectionChange = () => {
      if (!dictEnabled) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        handleTextSelection();
      }, 350);
    };

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if (dictPopupRef.current && !dictPopupRef.current.contains(e.target as Node)) {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed) {
          setDictSelection(null);
        }
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDictSelection(null);
      }
    };

    document.addEventListener("selectionchange", onSelectionChange);
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown, { passive: true });
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("selectionchange", onSelectionChange);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [dictEnabled, handleTextSelection]);

  // Load history
  useEffect(() => {
    const saved = safeGetStorage("comprehensive_analysis_history");
    if (saved) {
      try {
        const rawList = JSON.parse(saved);
        if (Array.isArray(rawList)) {
          const sanitizedList: HistoryEntry[] = rawList
            .filter((item: any) => item && typeof item === "object")
            .map((item: any, idx: number) => ({
              ...item,
              id: typeof item.id === "string" ? item.id : String(item.id || `hist-${idx}`),
              topic: typeof item.topic === "string" ? item.topic : "Consulta guardada",
              focusType: typeof item.focusType === "string" ? item.focusType : "General",
              tradition: typeof item.tradition === "string" ? item.tradition : undefined,
              timestamp: typeof item.timestamp === "string" ? item.timestamp : "",
              favorite: Boolean(item.favorite),
              data: sanitizeAnalysisResponse(item.data),
            }));
          setHistory(sanitizedList);
        }
      } catch (e) {
        console.error("Error loading history", e);
      }
    }
  }, []);

  const saveToHistory = useCallback((newItem: HistoryEntry) => {
    setHistory((prev) => {
      const updated = [newItem, ...prev.filter((h) => h.topic !== newItem.topic)].slice(0, 30);
      safeSetStorage("comprehensive_analysis_history", JSON.stringify(updated));
      return updated;
    });
  }, []);

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = history.map((h) => (h.id === id ? { ...h, favorite: !h.favorite } : h));
    setHistory(updated);
    safeSetStorage("comprehensive_analysis_history", JSON.stringify(updated));
  };

  const deleteHistoryItem = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const updated = history.filter((h) => h.id !== id);
    setHistory(updated);
    safeSetStorage("comprehensive_analysis_history", JSON.stringify(updated));
  };

  const clearHistory = () => {
    setHistory([]);
    safeRemoveStorage("comprehensive_analysis_history");
  };

  useEffect(() => {
    if (!loading) return;
    let phaseIndex = 0;
    setLoadingPhase(LOADING_PHASES[0]);
    const interval = setInterval(() => {
      phaseIndex = (phaseIndex + 1) % LOADING_PHASES.length;
      setLoadingPhase(LOADING_PHASES[phaseIndex]);
    }, 4500);
    return () => clearInterval(interval);
  }, [loading]);

  const persistActiveJob = useCallback((job: PersistedAnalysisJob | null) => {
    setActiveJob(job);
    if (!job) {
      safeRemoveStorage(ACTIVE_JOB_STORAGE_KEY);
      return;
    }
    safeSetStorage(ACTIVE_JOB_STORAGE_KEY, JSON.stringify(job));
  }, []);

  const completeAnalysisJob = useCallback(
    (
      rawFinal: any,
      meta: { topic: string; focusType: string; tradition: string }
    ) => {
      const result: ComprehensiveAnalysisResponse = sanitizeAnalysisResponse(rawFinal);
      setAnalysis(result);
      setIsPartialPreview(false);
      setActiveTradition(meta.tradition);
      setActiveTab("resumen");
      setMobileNavTab("resultados");
      setErrorMsg(null);
      setReconnecting(false);
      setLoading(false);
      persistActiveJob(null);

      saveToHistory({
        id: Date.now().toString(),
        topic: meta.topic,
        focusType: meta.focusType,
        tradition: meta.tradition,
        timestamp: new Date().toLocaleString("es-ES"),
        data: result,
      });

      setTimeout(() => {
        resultsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
    },
    [persistActiveJob, saveToHistory]
  );

  const pollBackgroundJobUntilDone = useCallback(
    async (initialJob: PersistedAnalysisJob) => {
      const runId = ++activeRunIdRef.current;
      activeRunControllerRef.current?.abort();
      const runController = new AbortController();
      activeRunControllerRef.current = runController;

      let latestJob = initialJob;
      let consecutiveNetworkErrors = 0;

      setLoading(true);
      setErrorMsg(null);
      setReconnecting(false);

      while (!runController.signal.aborted && activeRunIdRef.current === runId) {
        try {
          const pollController = new AbortController();
          const onRunAbort = () => pollController.abort();
          runController.signal.addEventListener("abort", onRunAbort, { once: true });
          const timer = setTimeout(() => pollController.abort(), 12000);

          let pollRes: Response;
          try {
            pollRes = await fetch(`/api/analyze/jobs/${latestJob.jobId}`, {
              method: "GET",
              signal: pollController.signal,
            });
          } finally {
            clearTimeout(timer);
            runController.signal.removeEventListener("abort", onRunAbort);
          }

          if (pollRes.status === 404) {
            // Server restarted and lost temp/RAM checkpoint — re-seed server cleanly with client partialData
            const rehydrateRes = await fetch(`/api/analyze/jobs/${latestJob.jobId}/resume`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              signal: runController.signal,
              body: JSON.stringify({
                topic: latestJob.topic,
                focusType: latestJob.focusType,
                tradicionTeologica: latestJob.tradition,
                completedStages: latestJob.completedStages,
                partialData: latestJob.partialData,
              }),
            });
            const rehydrated = await parseApiJsonResponse<AnalysisJobStateResponse>(
              rehydrateRes,
              "/api/analyze/jobs/resume"
            );
            consecutiveNetworkErrors = 0;
            setReconnecting(false);

            latestJob = {
              jobId: rehydrated.jobId,
              topic: rehydrated.topic || latestJob.topic,
              focusType: rehydrated.focusType || latestJob.focusType,
              tradition: rehydrated.tradicionTeologica || latestJob.tradition,
              executionMode: rehydrated.executionMode,
              status: rehydrated.status === "completed" ? "running" : rehydrated.status,
              completedStages: filterValidStageIds(rehydrated.completedStages),
              currentStage: rehydrated.currentStage,
              failedStage: rehydrated.failedStage,
              partialData: pickSafePartialAnalysisData(rehydrated.partialData),
              errorMessage: rehydrated.error,
              updatedAt: Date.now(),
            };
            persistActiveJob(latestJob);

            if (rehydrated.status === "completed" && rehydrated.result) {
              completeAnalysisJob(rehydrated.result, {
                topic: latestJob.topic,
                focusType: latestJob.focusType,
                tradition: latestJob.tradition,
              });
              return;
            }
            if (rehydrated.executionMode === "step-by-step") {
              break;
            }
            continue;
          }

          const state = await parseApiJsonResponse<AnalysisJobStateResponse>(
            pollRes,
            `/api/analyze/jobs/${latestJob.jobId}`
          );

          consecutiveNetworkErrors = 0;
          setReconnecting(false);

          const nextPersisted: PersistedAnalysisJob = {
            jobId: state.jobId,
            topic: state.topic || latestJob.topic,
            focusType: state.focusType || latestJob.focusType,
            tradition: state.tradicionTeologica || latestJob.tradition,
            executionMode: state.executionMode,
            status: state.status === "completed" ? "running" : state.status,
            completedStages: filterValidStageIds(state.completedStages),
            currentStage: state.currentStage,
            failedStage: state.failedStage,
            partialData:
              Object.keys(state.partialData || {}).length >= Object.keys(latestJob.partialData || {}).length
                ? pickSafePartialAnalysisData(state.partialData)
                : latestJob.partialData,
            errorMessage: state.error,
            updatedAt: Date.now(),
          };
          latestJob = nextPersisted;

          if (state.status === "completed" && state.result) {
            completeAnalysisJob(state.result, {
              topic: latestJob.topic,
              focusType: latestJob.focusType,
              tradition: latestJob.tradition,
            });
            return;
          }

          if (state.status === "paused_error") {
            persistActiveJob(nextPersisted);
            setErrorMsg(
              state.error ||
                "Se interrumpió una etapa en el servidor. Tu avance previo está guardado para continuar."
            );
            setLoading(false);
            return;
          }

          persistActiveJob(nextPersisted);
          await new Promise((resolve) => setTimeout(resolve, 1200));
        } catch (err: any) {
          if (runController.signal.aborted || activeRunIdRef.current !== runId) {
            return;
          }

          consecutiveNetworkErrors += 1;
          if (consecutiveNetworkErrors <= 12) {
            setReconnecting(true);
            const waitMs = Math.min(4000, 1200 + consecutiveNetworkErrors * 350);
            await new Promise((resolve) => setTimeout(resolve, waitMs));
            continue;
          }

          const interruptedJob: PersistedAnalysisJob = {
            ...latestJob,
            status: "interrupted",
            errorMessage:
              err?.message ||
              "Se perdió temporalmente la conexión con el servidor. Tu progreso guardado permanece intacto.",
            updatedAt: Date.now(),
          };
          persistActiveJob(interruptedJob);
          setErrorMsg(interruptedJob.errorMessage || "Conexión interrumpida.");
          setReconnecting(false);
          setLoading(false);
          return;
        }
      }
    },
    [completeAnalysisJob, persistActiveJob]
  );

  const runStepByStepStages = useCallback(
    async (initialJob: PersistedAnalysisJob) => {
      const runId = ++activeRunIdRef.current;
      activeRunControllerRef.current?.abort();
      const runController = new AbortController();
      activeRunControllerRef.current = runController;

      let latestJob = initialJob;
      setLoading(true);
      setErrorMsg(null);
      setReconnecting(false);

      const pendingStages = ANALYSIS_STAGE_ORDER.filter(
        (stageId) => !latestJob.completedStages.includes(stageId)
      );

      for (const stageId of pendingStages) {
        if (runController.signal.aborted || activeRunIdRef.current !== runId) return;

        latestJob = {
          ...latestJob,
          status: "running",
          currentStage: stageId,
          failedStage: null,
          errorMessage: undefined,
          updatedAt: Date.now(),
        };
        persistActiveJob(latestJob);

        let stageSucceeded = false;
        let lastErr: any = null;

        // Auto-retry ONLY on fast transient failures (< 8s); never double-wait after a timeout
        for (let attempt = 1; attempt <= 2; attempt++) {
          if (runController.signal.aborted || activeRunIdRef.current !== runId) return;
          const attemptStartedAt = Date.now();
          try {
            const stageController = new AbortController();
            const onAbort = () => stageController.abort();
            runController.signal.addEventListener("abort", onAbort, { once: true });
            const timer = setTimeout(() => stageController.abort(), 54000);

            let res: Response;
            try {
              res = await fetch("/api/analyze/stage", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                signal: stageController.signal,
                body: JSON.stringify({
                  jobId: latestJob.jobId,
                  stage: stageId,
                  topic: latestJob.topic,
                  focusType: latestJob.focusType,
                  tradicionTeologica: latestJob.tradition,
                  completedStages: latestJob.completedStages,
                  partialData: latestJob.partialData,
                }),
              });
            } finally {
              clearTimeout(timer);
              runController.signal.removeEventListener("abort", onAbort);
            }

            const state = await parseApiJsonResponse<AnalysisJobStateResponse>(
              res,
              "/api/analyze/stage"
            );

            setReconnecting(false);
            latestJob = {
              ...latestJob,
              completedStages: filterValidStageIds(state.completedStages),
              currentStage: state.currentStage,
              partialData: pickSafePartialAnalysisData(state.partialData),
              updatedAt: Date.now(),
            };
            persistActiveJob(latestJob);

            if (state.status === "completed" && state.result) {
              completeAnalysisJob(state.result, {
                topic: latestJob.topic,
                focusType: latestJob.focusType,
                tradition: latestJob.tradition,
              });
              return;
            }

            stageSucceeded = true;
            break;
          } catch (err: any) {
            if (runController.signal.aborted || activeRunIdRef.current !== runId) return;
            const elapsedMs = Date.now() - attemptStartedAt;
            const isAbortTimeout =
              err?.name === "AbortError" ||
              String(err?.message || "").toLowerCase().includes("time") ||
              String(err?.message || "").includes("504");
            lastErr =
              err?.name === "AbortError"
                ? new Error(
                    "Esta etapa excedió el tiempo máximo de respuesta. Tu avance previo quedó guardado para continuar desde aquí."
                  )
                : err;
            if (attempt < 2 && !isAbortTimeout && elapsedMs < 10000) {
              setReconnecting(true);
              await new Promise((r) => setTimeout(r, 1400));
              continue;
            }
            break;
          }
        }

        if (!stageSucceeded) {
          const pausedJob: PersistedAnalysisJob = {
            ...latestJob,
            status: "paused_error",
            failedStage: stageId,
            errorMessage:
              lastErr?.message ||
              "Se interrumpió la conexión durante esta etapa. Puedes continuar exactamente desde aquí.",
            updatedAt: Date.now(),
          };
          persistActiveJob(pausedJob);
          setErrorMsg(pausedJob.errorMessage || "Etapa interrumpida.");
          setReconnecting(false);
          setLoading(false);
          return;
        }
      }

      if (latestJob.completedStages.length === ANALYSIS_STAGE_ORDER.length) {
        completeAnalysisJob(latestJob.partialData, {
          topic: latestJob.topic,
          focusType: latestJob.focusType,
          tradition: latestJob.tradition,
        });
      }
    },
    [completeAnalysisJob, persistActiveJob]
  );

  // Restore saved checkpointed job on initial mount & reconnect automatically if it was running
  useEffect(() => {
    const rawSaved = safeGetStorage(ACTIVE_JOB_STORAGE_KEY);
    if (!rawSaved) return;
    try {
      const parsed = JSON.parse(rawSaved) as PersistedAnalysisJob;
      if (!parsed || typeof parsed !== "object" || !parsed.jobId || !parsed.topic) {
        safeRemoveStorage(ACTIVE_JOB_STORAGE_KEY);
        return;
      }
      if (Date.now() - (parsed.updatedAt || 0) > ACTIVE_JOB_MAX_AGE_MS) {
        safeRemoveStorage(ACTIVE_JOB_STORAGE_KEY);
        return;
      }

      const hydrated: PersistedAnalysisJob = {
        ...parsed,
        completedStages: filterValidStageIds(parsed.completedStages),
        partialData: pickSafePartialAnalysisData(parsed.partialData),
      };

      setTopic(hydrated.topic);
      if (hydrated.focusType && !hydrated.focusType.startsWith("Solicitud Manual:")) {
        setFocusType(hydrated.focusType);
      }
      if (hydrated.tradition) {
        setTradicionTeologica(hydrated.tradition);
      }

      if (hydrated.status === "running" && hydrated.executionMode === "background") {
        setActiveJob(hydrated);
        setMobileNavTab("resultados");
        void pollBackgroundJobUntilDone(hydrated);
      } else {
        const pausedOrInterrupted: PersistedAnalysisJob = {
          ...hydrated,
          status: hydrated.status === "running" ? "interrupted" : hydrated.status,
          errorMessage:
            hydrated.errorMessage ||
            `Análisis en pausa (${hydrated.completedStages.length}/${ANALYSIS_STAGE_ORDER.length} etapas guardadas).`,
        };
        persistActiveJob(pausedOrInterrupted);
      }
    } catch {
      safeRemoveStorage(ACTIVE_JOB_STORAGE_KEY);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-sync when mobile device wakes or network reconnects while a job is active
  useEffect(() => {
    const handleVisibilityOrOnline = () => {
      if (document.visibilityState === "visible" && loading && activeJob?.executionMode === "background") {
        setReconnecting(false);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityOrOnline);
    window.addEventListener("online", handleVisibilityOrOnline);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityOrOnline);
      window.removeEventListener("online", handleVisibilityOrOnline);
    };
  }, [loading, activeJob]);

  const handleAnalyze = async (textToAnalyze?: string, selectedFocus?: string, selectedTradition?: string) => {
    const queryText = textToAnalyze || topic;
    let queryFocus = selectedFocus || focusType;
    if (queryFocus === "Manual" || queryFocus === "Solicitud Manual (Enfoque Personalizado)") {
      queryFocus = customFocusText.trim()
        ? `Solicitud Manual: ${customFocusText.trim()}`
        : "Solicitud Manual Personalizada";
    }
    const queryTradition = selectedTradition || tradicionTeologica;

    if (loading || !queryText.trim()) return;

    setLoading(true);
    setErrorMsg(null);
    setAnalysis(null);
    setIsPartialPreview(false);
    setReconnecting(false);
    setHistoryOpen(false);
    setMobileNavTab("resultados");

    const initController = new AbortController();
    const initTimer = setTimeout(() => initController.abort(), 20000);

    try {
      const response = await fetch("/api/analyze/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: initController.signal,
        body: JSON.stringify({
          topic: queryText,
          focusType: queryFocus,
          tradicionTeologica: queryTradition,
        }),
      });
      clearTimeout(initTimer);

      const jobState = await parseApiJsonResponse<AnalysisJobStateResponse>(
        response,
        "/api/analyze/jobs"
      );

      if (jobState.status === "completed" && jobState.result) {
        completeAnalysisJob(jobState.result, {
          topic: queryText,
          focusType: queryFocus,
          tradition: queryTradition,
        });
        return;
      }

      const initialJob: PersistedAnalysisJob = {
        jobId: jobState.jobId,
        topic: queryText,
        focusType: queryFocus,
        tradition: queryTradition,
        executionMode: jobState.executionMode,
        status: "running",
        completedStages: filterValidStageIds(jobState.completedStages),
        currentStage: jobState.currentStage || "sintesis",
        partialData: pickSafePartialAnalysisData(jobState.partialData),
        updatedAt: Date.now(),
      };
      persistActiveJob(initialJob);

      if (jobState.executionMode === "step-by-step") {
        await runStepByStepStages(initialJob);
      } else {
        await pollBackgroundJobUntilDone(initialJob);
      }
    } catch (error: any) {
      clearTimeout(initTimer);
      console.warn("[Motor IA Aviso]:", error?.message || error);
      const rawMsg = error?.message || "";
      const friendlyMsg =
        error?.name === "AbortError" ||
        rawMsg.includes("Failed to fetch") ||
        rawMsg.includes("NetworkError") ||
        rawMsg.includes("Load failed")
          ? "No se pudo iniciar la sesión con el servidor por intermitencia de red. Pulsa 'Reintentar ahora'."
          : rawMsg || "Error al iniciar el análisis. Pulsa 'Reintentar ahora'.";
      setErrorMsg(friendlyMsg);
      setLoading(false);
      setMobileNavTab("analizar");
    }
  };

  const handleResumeSavedJob = async (jobOverride?: PersistedAnalysisJob) => {
    const jobToResume = jobOverride || activeJob;
    if (!jobToResume || loading) return;

    setTopic(jobToResume.topic);
    if (jobToResume.tradition) setTradicionTeologica(jobToResume.tradition);
    setAnalysis(null);
    setIsPartialPreview(false);
    setErrorMsg(null);
    setLoading(true);
    setReconnecting(false);
    setHistoryOpen(false);
    setMobileNavTab("resultados");

    if (jobToResume.executionMode === "step-by-step") {
      await runStepByStepStages(jobToResume);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const res = await fetch(`/api/analyze/jobs/${jobToResume.jobId}/resume`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          topic: jobToResume.topic,
          focusType: jobToResume.focusType,
          tradicionTeologica: jobToResume.tradition,
          completedStages: jobToResume.completedStages,
          partialData: jobToResume.partialData,
        }),
      });
      clearTimeout(timer);

      const resumed = await parseApiJsonResponse<AnalysisJobStateResponse>(
        res,
        `/api/analyze/jobs/${jobToResume.jobId}/resume`
      );

      if (resumed.status === "completed" && resumed.result) {
        completeAnalysisJob(resumed.result, {
          topic: jobToResume.topic,
          focusType: jobToResume.focusType,
          tradition: jobToResume.tradition,
        });
        return;
      }

      const nextJob: PersistedAnalysisJob = {
        jobId: resumed.jobId,
        topic: resumed.topic || jobToResume.topic,
        focusType: resumed.focusType || jobToResume.focusType,
        tradition: resumed.tradicionTeologica || jobToResume.tradition,
        executionMode: resumed.executionMode,
        status: "running",
        completedStages: filterValidStageIds(resumed.completedStages),
        currentStage: resumed.currentStage,
        partialData: pickSafePartialAnalysisData(resumed.partialData),
        updatedAt: Date.now(),
      };
      persistActiveJob(nextJob);

      if (resumed.executionMode === "step-by-step") {
        await runStepByStepStages(nextJob);
      } else {
        await pollBackgroundJobUntilDone(nextJob);
      }
    } catch (error: any) {
      clearTimeout(timer);
      const nextPaused: PersistedAnalysisJob = {
        ...jobToResume,
        status: "interrupted",
        errorMessage:
          error?.message ||
          "No se pudo reconectar con el servidor todavía. Tu avance sigue guardado.",
        updatedAt: Date.now(),
      };
      persistActiveJob(nextPaused);
      setErrorMsg(nextPaused.errorMessage || "Error al reanudar.");
      setLoading(false);
    }
  };

  const handlePauseCurrentJob = () => {
    activeRunIdRef.current += 1;
    activeRunControllerRef.current?.abort();
    setLoading(false);
    setReconnecting(false);
    if (activeJob) {
      const paused: PersistedAnalysisJob = {
        ...activeJob,
        status: "interrupted",
        errorMessage: `Análisis pausado manualmente (${activeJob.completedStages.length}/${ANALYSIS_STAGE_ORDER.length} etapas guardadas).`,
        updatedAt: Date.now(),
      };
      persistActiveJob(paused);
    }
  };

  const handleDiscardSavedJob = () => {
    activeRunIdRef.current += 1;
    activeRunControllerRef.current?.abort();
    setLoading(false);
    setReconnecting(false);
    setErrorMsg(null);
    persistActiveJob(null);
  };

  const handleViewPartialProgress = () => {
    if (!activeJob || activeJob.completedStages.length === 0) return;
    activeRunIdRef.current += 1;
    activeRunControllerRef.current?.abort();
    setLoading(false);
    setReconnecting(false);
    const partialSanitized = sanitizeAnalysisResponse(activeJob.partialData);
    setAnalysis(partialSanitized);
    setIsPartialPreview(true);
    setActiveTradition(activeJob.tradition || tradicionTeologica);
    setActiveTab("resumen");
    setMobileNavTab("resultados");
  };

  const handleCopyMarkdown = () => {
    if (!analysis) return;
    setCopying(true);
    const markdown = generateMarkdownReport(analysis, activeTradition);
    navigator.clipboard.writeText(markdown);
    setTimeout(() => setCopying(false), 2000);
  };

  const handleDownloadMarkdown = () => {
    if (!analysis) return;
    const markdown = generateMarkdownReport(analysis, activeTradition);
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `analisis_integral_${analysis.resumenEjecutivo.slice(0, 20).replace(/\s+/g, "_")}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleNewQuery = () => {
    setAnalysis(null);
    setIsPartialPreview(false);
    setErrorMsg(null);
    setHistoryOpen(false);
    setMobileNavTab("analizar");
    window.scrollTo({ top: 0, behavior: "smooth" });
    inputSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const activeCategoryMeta = CATEGORY_OPTIONS.find((c) => c.id === focusType) || CATEGORY_OPTIONS[0];
  const activeTraditionMeta = TRADITION_OPTIONS.find((t) => t.id === tradicionTeologica);
  const currentThemeObj = COLOR_THEMES.find((t) => t.id === currentTheme) || COLOR_THEMES[0];
  const CurrentThemeIcon = THEME_ICONS[currentTheme] || Trees;

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-clip bg-brand-bg text-brand-text font-sans flex flex-col antialiased">
      {/* Strict 1-Row 3-Zone Top Navigation Header */}
      <header className="sticky top-0 z-40 h-14 sm:h-16 bg-brand-card/95 backdrop-blur-md border-b border-brand-border px-3 sm:px-6 lg:px-8 flex items-center justify-between gap-2 sm:gap-8 pt-safe no-print">
        {/* Zone 1: 1-line Brand */}
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="flex items-center gap-2 sm:gap-2.5 whitespace-nowrap shrink-0 cursor-pointer group min-w-0"
        >
          <div className="w-8 h-8 rounded-lg bg-brand-bg border border-brand-gold/50 flex items-center justify-center text-brand-gold shrink-0">
            <Compass className="w-4 h-4" />
          </div>
          <span className="text-sm sm:text-base font-bold tracking-tight text-brand-text font-serif group-hover:text-brand-gold transition">
            AnálisisPro
          </span>
        </button>

        {/* Zone 2: Concise Single-Line Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 whitespace-nowrap shrink-0" aria-label="Navegación principal">
          <button
            type="button"
            onClick={() => {
              setHistoryOpen(false);
              inputSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-brand-text-muted hover:text-brand-text hover:bg-brand-bg/60 flex items-center gap-1.5 transition cursor-pointer"
          >
            <Brain className="w-3.5 h-3.5 text-brand-gold" />
            <span>Consulta</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setHistoryOpen(false);
              presetsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-brand-text-muted hover:text-brand-text hover:bg-brand-bg/60 flex items-center gap-1.5 transition cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-brand-gold" />
            <span>Plantillas</span>
          </button>

          <button
            type="button"
            onClick={() => setHistoryOpen(!historyOpen)}
            id="history-toggle-btn"
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
              historyOpen
                ? "bg-brand-gold/15 text-brand-gold"
                : "text-brand-text-muted hover:text-brand-text hover:bg-brand-bg/60"
            }`}
          >
            <History className="w-3.5 h-3.5 text-brand-gold" />
            <span>Historial</span>
            <span className="font-mono text-[11px] tabular-nums opacity-80">({history.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setMdViewerOpen(true)}
            id="md-viewer-btn"
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-brand-text-muted hover:text-brand-text hover:bg-brand-bg/60 flex items-center gap-1.5 transition cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5 text-brand-gold" />
            <span>Visor .md</span>
          </button>
        </nav>

        {/* Zone 3: Organized Action Menus & Primary Action */}
        <div className="flex items-center gap-1.5 sm:gap-2 whitespace-nowrap shrink-0">
          {/* Palette Dropdown */}
          <div className="relative" ref={themeDropdownRef}>
            <button
              type="button"
              onClick={() => {
                setThemeMenuOpen(!themeMenuOpen);
                setToolsMenuOpen(false);
              }}
              id="theme-selector-btn"
              className="min-h-[38px] px-2 sm:px-3 py-1.5 rounded-lg border border-brand-border bg-brand-bg hover:border-brand-gold/50 text-xs font-semibold text-brand-text flex items-center gap-1 sm:gap-1.5 transition cursor-pointer"
              title="Cambiar paleta visual ergonómica"
            >
              <CurrentThemeIcon className="w-3.5 h-3.5 text-brand-gold shrink-0" />
              <span className="hidden sm:inline">{currentThemeObj.shortName}</span>
              <ChevronDown className={`w-3 h-3 text-brand-text-muted transition-transform ${themeMenuOpen ? "rotate-180" : ""}`} />
            </button>

            <AnimatePresence>
              {themeMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.97 }}
                  className="fixed inset-x-3 top-16 sm:inset-x-auto sm:top-auto sm:absolute sm:right-0 sm:mt-2 w-auto sm:w-72 bg-brand-card border border-brand-border rounded-xl shadow-2xl p-3 z-50 space-y-2 max-h-[75vh] overflow-y-auto"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-brand-border">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-brand-gold flex items-center gap-1.5">
                      <Glasses className="w-3.5 h-3.5" />
                      <span>Paletas Anti-Fatiga</span>
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {COLOR_THEMES.map((th) => {
                      const ThIcon = THEME_ICONS[th.id] || Trees;
                      const isActive = currentTheme === th.id;
                      return (
                        <button
                          key={th.id}
                          type="button"
                          onClick={() => {
                            setCurrentTheme(th.id);
                            setThemeMenuOpen(false);
                          }}
                          className={`w-full text-left p-2.5 rounded-lg border text-xs transition flex items-center gap-2.5 cursor-pointer ${
                            isActive
                              ? "bg-brand-gold/12 border-brand-gold text-brand-text font-bold"
                              : "bg-brand-bg/50 border-brand-border text-brand-text-muted hover:text-brand-text hover:bg-brand-bg"
                          }`}
                        >
                          <span
                            className="w-6 h-6 rounded-md border border-brand-border flex items-center justify-center shrink-0"
                            style={{ backgroundColor: th.bgHex, color: th.accentHex }}
                          >
                            <ThIcon className="w-3.5 h-3.5" />
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-semibold truncate">{th.name}</span>
                              {isActive && <Check className="w-3.5 h-3.5 text-brand-gold shrink-0" />}
                            </div>
                            <p className="text-[10px] opacity-80 truncate font-normal">{th.tagline}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Tools / Export Dropdown */}
          <div className="relative" ref={toolsDropdownRef}>
            <button
              type="button"
              onClick={() => {
                setToolsMenuOpen(!toolsMenuOpen);
                setThemeMenuOpen(false);
              }}
              className="min-h-[38px] px-2 sm:px-3 py-1.5 rounded-lg border border-brand-border bg-brand-bg hover:border-brand-gold/50 text-xs font-semibold text-brand-text flex items-center gap-1 sm:gap-1.5 transition cursor-pointer"
              title="Herramientas y opciones de exportación"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-brand-gold shrink-0" />
              <span className="hidden sm:inline">Herramientas</span>
              <ChevronDown className={`w-3 h-3 text-brand-text-muted transition-transform ${toolsMenuOpen ? "rotate-180" : ""}`} />
            </button>

            <AnimatePresence>
              {toolsMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.97 }}
                  className="fixed inset-x-3 top-16 sm:inset-x-auto sm:top-auto sm:absolute sm:right-0 sm:mt-2 w-auto sm:w-64 bg-brand-card border border-brand-border rounded-xl shadow-2xl p-2 z-50 space-y-1 max-h-[75vh] overflow-y-auto"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setDictEnabled(!dictEnabled);
                      setToolsMenuOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-brand-text hover:bg-brand-bg transition cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <BookOpen className="w-3.5 h-3.5 text-brand-gold" />
                      <span>Diccionario In-line</span>
                    </span>
                    <span className={`font-mono text-[10px] font-bold ${dictEnabled ? "text-sem-emerald" : "text-brand-text-muted"}`}>
                      {dictEnabled ? "ON" : "OFF"}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMdViewerOpen(true);
                      setToolsMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-brand-text hover:bg-brand-bg transition cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 text-brand-gold" />
                    <span>Abrir Visor Markdown</span>
                  </button>

                  {analysis && (
                    <>
                      <div className="border-t border-brand-border my-1" />
                      <button
                        type="button"
                        onClick={() => {
                          handleCopyMarkdown();
                          setToolsMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-brand-text hover:bg-brand-bg transition cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5 text-brand-gold" />
                        <span>Copiar reporte (.md)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          handleDownloadMarkdown();
                          setToolsMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-brand-text hover:bg-brand-bg transition cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5 text-brand-gold" />
                        <span>Descargar archivo .md</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setToolsMenuOpen(false);
                          window.print();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-brand-text hover:bg-brand-bg transition cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5 text-brand-gold" />
                        <span>Imprimir / Guardar PDF</span>
                      </button>
                    </>
                  )}

                  <div className="border-t border-brand-border pt-1.5 mt-1 px-1">
                    <PWAInstallButton compact />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Primary Single Header Action */}
          {analysis ? (
            <button
              type="button"
              onClick={handleNewQuery}
              className="min-h-[38px] px-2.5 sm:px-4 py-1.5 rounded-lg bg-brand-gold hover:bg-brand-gold-hover text-slate-950 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5] shrink-0" />
              <span className="sm:hidden">Nueva</span>
              <span className="hidden sm:inline">Nueva Consulta</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleAnalyze()}
              disabled={loading || !topic.trim()}
              className={`min-h-[38px] px-2.5 sm:px-4 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition ${
                loading || !topic.trim()
                  ? "bg-brand-bg text-brand-text-muted/50 border border-brand-border cursor-not-allowed"
                  : "bg-brand-gold hover:bg-brand-gold-hover text-slate-950 cursor-pointer"
              }`}
            >
              <Brain className="w-3.5 h-3.5 shrink-0" />
              <span>{loading ? "Analizando..." : "Analizar"}</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full min-w-0 mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-7 flex flex-col gap-5 sm:gap-6 pb-mobile-nav">
        {/* Dynamic History Drawer */}
        <div className={mobileNavTab === "historial" ? "block" : "hidden md:block"}>
          <AnimatePresence>
            {(historyOpen || mobileNavTab === "historial") && (
              <HistoryDrawer
                isOpen={historyOpen || mobileNavTab === "historial"}
                onClose={() => {
                  setHistoryOpen(false);
                  if (mobileNavTab === "historial") {
                    setMobileNavTab(analysis ? "resultados" : "analizar");
                  }
                }}
                history={history}
                onSelect={(entry) => {
                  setAnalysis(entry.data);
                  setIsPartialPreview(false);
                  setErrorMsg(null);
                  setTopic(entry.topic);
                  setFocusType(entry.focusType);
                  if (entry.tradition) {
                    setTradicionTeologica(entry.tradition);
                    setActiveTradition(entry.tradition);
                  }
                  setActiveTab("resumen");
                  setHistoryOpen(false);
                  setMobileNavTab("resultados");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                onToggleFavorite={toggleFavorite}
                onDelete={deleteHistoryItem}
                onClearAll={clearHistory}
              />
            )}
          </AnimatePresence>
        </div>

        {/* Consultation Studio (Input + Organized Template Library) */}
        <section
          ref={inputSectionRef}
          className={`${
            mobileNavTab === "analizar" || mobileNavTab === "plantillas" ? "grid" : "hidden md:grid"
          } grid-cols-1 lg:grid-cols-12 gap-5 items-stretch no-print min-w-0`}
        >
          {/* Left: Query Composer & Focus Controls */}
          <div
            className={`${
              mobileNavTab === "analizar" ? "flex" : "hidden md:flex"
            } lg:col-span-8 min-w-0 bg-brand-card rounded-2xl border border-brand-border p-4 sm:p-6 flex-col gap-4 sm:gap-5`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-brand-border pb-4">
              <div className="space-y-1">
                <h1 className="text-lg sm:text-xl font-bold text-brand-text font-serif">
                  Estudio de Análisis Multidisciplinario
                </h1>
                <p className="text-xs text-brand-text-muted">
                  Formula cualquier dilema estratégico, hipótesis científica, decisión financiera o cuestión ética/teológica.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {topic.trim() && (
                  <button
                    type="button"
                    onClick={() => setTopic("")}
                    className="px-2.5 py-1.5 rounded-lg border border-brand-border bg-brand-bg hover:bg-brand-card-light text-xs font-semibold text-brand-text-muted hover:text-brand-text flex items-center gap-1.5 transition cursor-pointer"
                    title="Limpiar campo de consulta"
                  >
                    <Eraser className="w-3.5 h-3.5" />
                    <span>Limpiar</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setMobileNavTab("plantillas");
                    window.scrollTo({ top: 0, behavior: "smooth" });
                    setTimeout(() => {
                      presetsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }, 50);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-brand-gold/12 hover:bg-brand-gold/20 text-brand-gold border border-brand-gold/30 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Plantillas</span>
                </button>
              </div>
            </div>

            {/* Query Textarea */}
            <div className="space-y-2">
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Describe tu consulta con contexto relevante: metas, restricciones, alternativas en duda o hipótesis que deseas someter a escrutinio riguroso..."
                className="w-full min-h-[115px] p-4 rounded-xl bg-brand-bg text-brand-text border border-brand-border focus:outline-none focus:border-brand-gold text-sm resize-y leading-relaxed font-sans placeholder-brand-text-muted/50"
                id="main-query-input"
              />
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-brand-text-muted px-0.5">
                <span className="min-w-0">Mayor contexto produce matrices de decisión y auditorías más exactas.</span>
                <span className="font-mono tabular-nums shrink-0">{topic.length} caracteres</span>
              </div>
            </div>

            {/* Collapsible Focus Category Selector (Collapsed by default) */}
            <div className="space-y-3 pt-2 border-t border-brand-border/60">
              <button
                type="button"
                onClick={() => setShowAllCategories((prev) => !prev)}
                aria-expanded={showAllCategories}
                className="w-full flex items-center justify-between gap-3 p-3 rounded-xl border border-brand-border bg-brand-bg/60 hover:bg-brand-bg hover:border-brand-gold/50 transition text-left cursor-pointer"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Compass className="w-4 h-4 text-brand-gold shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-brand-text">
                      Enfoque Disciplinario Principal
                    </div>
                    <div className="text-[11px] text-brand-text-muted truncate">
                      Activo: <span className="font-semibold text-brand-gold">{activeCategoryMeta.label}</span>
                    </div>
                  </div>
                </div>
                <span className="flex items-center gap-1.5 text-xs font-semibold text-brand-gold shrink-0">
                  <span>{showAllCategories ? "Contraer" : `Expandir (${CATEGORY_OPTIONS.length})`}</span>
                  {showAllCategories ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </span>
              </button>

              {showAllCategories && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {CATEGORY_OPTIONS.map((cat) => {
                    const IconComp = cat.icon;
                    const isSelected = focusType === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setFocusType(cat.id)}
                        className={`flex items-start gap-2.5 p-3 rounded-xl border text-left transition cursor-pointer ${
                          isSelected
                            ? "bg-brand-gold/12 border-brand-gold text-brand-text"
                            : "bg-brand-bg/60 border-brand-border text-brand-text-muted hover:text-brand-text hover:border-brand-gold/40"
                        }`}
                      >
                        <IconComp className={`w-4 h-4 shrink-0 mt-0.5 ${isSelected ? "text-brand-gold" : "text-brand-text-muted"}`} />
                        <div className="min-w-0">
                          <div className={`text-xs font-bold truncate ${isSelected ? "text-brand-gold" : "text-brand-text"}`}>
                            {cat.shortLabel}
                          </div>
                          <div className="text-[11px] text-brand-text-muted line-clamp-1 mt-0.5">
                            {cat.desc}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              <p className="text-[11px] text-brand-text-muted font-serif italic px-1">
                Criterio activo ({activeCategoryMeta.label}): {activeCategoryMeta.methodologyNote}
              </p>
            </div>

            {/* Conditional Manual Focus */}
            {focusType === "Manual" && (
              <div className="p-3.5 bg-brand-bg rounded-xl border border-brand-gold/40 space-y-2">
                <label
                  htmlFor="manual-focus-input"
                  className="text-xs font-bold text-brand-gold flex items-center gap-1.5"
                >
                  <FileCode2 className="w-3.5 h-3.5" />
                  <span>Especifica tu enfoque o disciplina personalizada</span>
                </label>
                <input
                  type="text"
                  value={customFocusText}
                  onChange={(e) => setCustomFocusText(e.target.value)}
                  placeholder="Ejemplo: Derecho laboral comparado, Arquitectura de software, Bioética clínica..."
                  className="w-full p-2.5 bg-brand-card text-brand-text text-xs rounded-lg border border-brand-border focus:outline-none focus:border-brand-gold placeholder-brand-text-muted/50"
                  id="manual-focus-input"
                />
              </div>
            )}

            {/* Frame of Reference + Primary Submit Row */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pt-3 border-t border-brand-border/60 min-w-0">
              <div className="flex-1 min-w-0 space-y-1.5">
                <label
                  htmlFor="tradition-select"
                  className="text-xs font-bold text-brand-text flex items-center gap-1.5"
                >
                  <Glasses className="w-3.5 h-3.5 text-brand-gold shrink-0" />
                  <span>Marco de Referencia Adicional</span>
                </label>
                <select
                  id="tradition-select"
                  value={tradicionTeologica}
                  onChange={(e) => setTradicionTeologica(e.target.value)}
                  className="w-full max-w-full min-w-0 bg-brand-bg text-brand-text text-xs font-semibold py-2.5 px-3 rounded-xl border border-brand-border focus:outline-none focus:border-brand-gold cursor-pointer truncate"
                >
                  {TRADITION_OPTIONS.map((t) => (
                    <option key={t.id} value={t.id} className="bg-brand-card text-brand-text">
                      {t.label}
                    </option>
                  ))}
                </select>
                {activeTraditionMeta && (
                  <p className="text-[11px] text-brand-text-muted leading-snug">
                    {activeTraditionMeta.summary}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => handleAnalyze()}
                disabled={loading || !topic.trim()}
                id="submit-analysis-btn"
                className={`w-full md:w-auto min-h-[46px] px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition shrink-0 ${
                  loading || !topic.trim()
                    ? "bg-brand-bg text-brand-text-muted/40 cursor-not-allowed border border-brand-border"
                    : "bg-brand-gold hover:bg-brand-gold-hover text-slate-950 font-extrabold cursor-pointer shadow-md"
                }`}
              >
                <Brain className="w-4 h-4" />
                <span>{loading ? "Analizando..." : "Iniciar Análisis Riguroso"}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {(errorMsg || (activeJob && !loading && activeJob.completedStages.length < ANALYSIS_STAGE_ORDER.length)) && (
              <div className="bg-sem-amber-bg border border-sem-amber-border p-4 rounded-xl text-xs flex flex-col gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-sem-amber mt-0.5" />
                  <div className="min-w-0 space-y-1">
                    <div className="font-bold text-sem-amber">
                      {activeJob
                        ? `Progreso guardado (${activeJob.completedStages.length}/${ANALYSIS_STAGE_ORDER.length} etapas completadas)`
                        : "Aviso del Sistema"}
                    </div>
                    <p className="text-brand-text break-words">
                      {errorMsg ||
                        activeJob?.errorMessage ||
                        "El análisis quedó en pausa. Puedes reanudarlo exactamente donde se quedó."}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {activeJob ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleResumeSavedJob(activeJob)}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-brand-gold text-slate-950 hover:bg-brand-gold-hover font-bold text-xs rounded-lg transition cursor-pointer disabled:opacity-50"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>
                          Continuar donde se quedó (Etapa{" "}
                          {Math.min(activeJob.completedStages.length + 1, ANALYSIS_STAGE_ORDER.length)}/
                          {ANALYSIS_STAGE_ORDER.length})
                        </span>
                      </button>
                      {activeJob.completedStages.length > 0 && (
                        <button
                          type="button"
                          onClick={handleViewPartialProgress}
                          className="flex items-center gap-1.5 px-3 py-2 bg-brand-card border border-brand-border hover:border-brand-gold/50 text-brand-text font-semibold text-xs rounded-lg transition cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-brand-gold" />
                          <span>Ver avance parcial</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleDiscardSavedJob}
                        className="flex items-center gap-1.5 px-3 py-2 bg-brand-bg border border-brand-border hover:text-sem-rose text-brand-text-muted font-semibold text-xs rounded-lg transition cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Descartar</span>
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleAnalyze()}
                      disabled={loading}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-brand-gold text-slate-950 hover:bg-brand-gold-hover font-bold text-xs rounded-lg transition cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Reintentar ahora</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right: Organized Thematic Presets Library */}
          <div
            ref={presetsSectionRef}
            className={`${
              mobileNavTab === "plantillas" ? "flex" : "hidden md:flex"
            } lg:col-span-4 min-w-0 bg-brand-card rounded-2xl border border-brand-border p-4 sm:p-5 flex-col gap-3.5`}
          >
            <div className="flex items-center justify-between gap-2 border-b border-brand-border pb-3">
              <div>
                <h2 className="text-sm font-bold text-brand-text font-serif flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-brand-gold" />
                  <span>Biblioteca de Plantillas</span>
                </h2>
                <p className="text-[11px] text-brand-text-muted mt-0.5">
                  {filteredPresets.length} escenarios curados listos para ejecutar
                </p>
              </div>

              <button
                type="button"
                onClick={handleShufflePresets}
                id="refresh-presets-btn"
                className="px-2.5 py-1.5 rounded-lg bg-brand-bg hover:bg-brand-card-light text-brand-gold border border-brand-border text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shrink-0"
                title="Rotar lote de plantillas"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Más</span>
              </button>
            </div>

            {/* Category Filter Buttons */}
            <div className="flex flex-wrap gap-1">
              {(["Todas", "Decisiones", "Ciencia y Tech", "Finanzas", "Ética y Fe", "Salud", "Habilidades Sociales"] as PresetFilterGroup[]).map(
                (grp) => (
                  <button
                    key={grp}
                    type="button"
                    onClick={() => {
                      setPresetGroup(grp);
                      setPresetOffset(0);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                      presetGroup === grp
                        ? "bg-brand-gold text-slate-950 font-bold"
                        : "bg-brand-bg text-brand-text-muted hover:text-brand-text border border-brand-border"
                    }`}
                  >
                    {grp}
                  </button>
                )
              )}
            </div>

            {/* Template Cards */}
            <div className="flex flex-col gap-2.5 flex-1 justify-start">
              {visiblePresets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    const targetTrad = preset.tradition || "General / Neutral (Sin Sesgo)";
                    setTopic(preset.prompt);
                    setFocusType(preset.focus);
                    setTradicionTeologica(targetTrad);
                    handleAnalyze(preset.prompt, preset.focus, targetTrad);
                  }}
                  className="w-full min-w-0 overflow-hidden text-left bg-brand-bg/70 p-3.5 rounded-xl border border-brand-border hover:border-brand-gold/60 hover:bg-brand-card-light/30 transition group disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <span className="text-xs font-bold text-brand-text group-hover:text-brand-gold transition truncate min-w-0">
                      {preset.title}
                    </span>
                    <span className="text-[10px] font-mono text-brand-gold shrink-0">
                      {preset.group}
                    </span>
                  </div>
                  <p className="text-[11px] text-brand-text-muted line-clamp-2 leading-relaxed font-serif break-words">
                    {preset.prompt}
                  </p>
                  <p className="text-[10px] text-brand-text-muted/80 pt-1 border-t border-brand-border/40 break-words">
                    {preset.depthHint}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Checkpointed Stage Loading State */}
        {loading && (
          <section
            className={`${
              mobileNavTab === "resultados" ? "flex" : "hidden md:flex"
            } bg-brand-card rounded-2xl border border-brand-border p-5 sm:p-8 flex-col gap-5`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-brand-border pb-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="relative flex items-center justify-center shrink-0">
                  <div className="w-11 h-11 rounded-full border-2 border-brand-border border-t-brand-gold animate-spin" />
                  <Brain className="w-5 h-5 text-brand-gold absolute" />
                </div>
                <div className="min-w-0 space-y-1">
                  <h3 className="text-sm sm:text-base font-bold text-brand-text font-serif">
                    Construyendo Reporte por Etapas Verificadas
                  </h3>
                  <p className="text-xs text-brand-gold font-mono tracking-wide truncate">
                    {reconnecting
                      ? "Reconectando con el servidor sin perder avance..."
                      : activeJob?.currentStage
                      ? `Etapa ${Math.min((activeJob.completedStages.length || 0) + 1, ANALYSIS_STAGE_ORDER.length)}/${ANALYSIS_STAGE_ORDER.length}: ${
                          ANALYSIS_STAGES.find((s) => s.id === activeJob.currentStage)?.title || loadingPhase
                        }`
                      : loadingPhase}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {activeJob && activeJob.completedStages.length > 0 && (
                  <button
                    type="button"
                    onClick={handleViewPartialProgress}
                    className="px-3 py-1.5 rounded-lg bg-brand-bg border border-brand-border hover:border-brand-gold/50 text-xs font-semibold text-brand-text flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-brand-gold" />
                    <span>
                      Ver avance ({activeJob.completedStages.length}/{ANALYSIS_STAGE_ORDER.length})
                    </span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handlePauseCurrentJob}
                  className="px-3 py-1.5 rounded-lg bg-brand-bg border border-brand-border hover:border-brand-gold/50 text-xs font-semibold text-brand-text-muted hover:text-brand-text flex items-center gap-1.5 transition cursor-pointer"
                >
                  <PauseCircle className="w-3.5 h-3.5 text-brand-gold" />
                  <span>Pausar</span>
                </button>
              </div>
            </div>

            {reconnecting && (
              <div className="bg-sem-amber-bg border border-sem-amber-border rounded-xl px-3.5 py-2.5 text-xs text-sem-amber flex items-center gap-2">
                <WifiOff className="w-4 h-4 shrink-0" />
                <span>
                  Intermitencia detectada. Reintentando enlace automáticamente — tu progreso completado sigue seguro.
                </span>
              </div>
            )}

            {/* Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-brand-text-muted font-medium">
                  Avance guardado en servidor y dispositivo
                </span>
                <span className="font-mono font-bold text-brand-gold tabular-nums">
                  {Math.round(((activeJob?.completedStages.length || 0) / ANALYSIS_STAGE_ORDER.length) * 100)}%
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-brand-bg border border-brand-border overflow-hidden">
                <div
                  className="h-full bg-brand-gold transition-all duration-500"
                  style={{
                    width: `${Math.max(
                      8,
                      Math.round(((activeJob?.completedStages.length || 0) / ANALYSIS_STAGE_ORDER.length) * 100)
                    )}%`,
                  }}
                />
              </div>
            </div>

            {/* 4-Stage Checkpoint Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ANALYSIS_STAGES.map((stage) => {
                const isDone = activeJob?.completedStages.includes(stage.id);
                const isCurrent = !isDone && activeJob?.currentStage === stage.id;
                return (
                  <div
                    key={stage.id}
                    className={`p-3.5 rounded-xl border transition flex items-start gap-3 min-w-0 ${
                      isDone
                        ? "bg-sem-emerald-bg/40 border-sem-emerald-border"
                        : isCurrent
                        ? "bg-brand-gold/10 border-brand-gold/60"
                        : "bg-brand-bg/50 border-brand-border/70 opacity-70"
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {isDone ? (
                        <CheckCircle2 className="w-4 h-4 text-sem-emerald" />
                      ) : isCurrent ? (
                        <RefreshCw className="w-4 h-4 text-brand-gold animate-spin" />
                      ) : (
                        <Clock className="w-4 h-4 text-brand-text-muted" />
                      )}
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2 text-xs font-bold text-brand-text">
                        <span className="font-mono text-brand-gold">0{stage.order}</span>
                        <span className="truncate">{stage.title}</span>
                      </div>
                      <p className="text-[11px] text-brand-text-muted leading-snug break-words">
                        {stage.subtitle}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="text-xs text-brand-text-muted font-serif italic text-center border-t border-brand-border pt-3">
              Si la red cae o recargas la página, el motor retomará exactamente desde la última etapa sin completar.
            </p>
          </section>
        )}

        {/* Mobile recovery banner when paused/error occurs while Resultados tab is active */}
        {!loading && !analysis && (errorMsg || (activeJob && activeJob.completedStages.length < ANALYSIS_STAGE_ORDER.length)) && (
          <section
            className={`${
              mobileNavTab === "resultados" ? "flex md:hidden" : "hidden"
            } bg-sem-amber-bg border border-sem-amber-border p-4 rounded-2xl text-xs flex-col gap-3`}
          >
            <div className="flex items-start gap-2.5 min-w-0">
              <AlertTriangle className="w-4 h-4 shrink-0 text-sem-amber mt-0.5" />
              <div className="min-w-0 space-y-1">
                <div className="font-bold text-sem-amber">
                  {activeJob
                    ? `Progreso guardado (${activeJob.completedStages.length}/${ANALYSIS_STAGE_ORDER.length} etapas completadas)`
                    : "Aviso del Sistema"}
                </div>
                <p className="text-brand-text break-words">
                  {errorMsg ||
                    activeJob?.errorMessage ||
                    "El análisis quedó en pausa. Puedes reanudarlo exactamente donde se quedó."}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {activeJob ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleResumeSavedJob(activeJob)}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-brand-gold text-slate-950 hover:bg-brand-gold-hover font-bold text-xs rounded-lg transition cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>
                      Continuar (Etapa {Math.min(activeJob.completedStages.length + 1, ANALYSIS_STAGE_ORDER.length)}/
                      {ANALYSIS_STAGE_ORDER.length})
                    </span>
                  </button>
                  {activeJob.completedStages.length > 0 && (
                    <button
                      type="button"
                      onClick={handleViewPartialProgress}
                      className="flex items-center gap-1.5 px-3 py-2 bg-brand-card border border-brand-border text-brand-text font-semibold text-xs rounded-lg transition cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-brand-gold" />
                      <span>Ver avance</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleDiscardSavedJob}
                    className="flex items-center gap-1.5 px-3 py-2 bg-brand-bg border border-brand-border text-brand-text-muted font-semibold text-xs rounded-lg transition cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Descartar</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => handleAnalyze()}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-brand-gold text-slate-950 font-bold text-xs rounded-lg transition cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reintentar ahora</span>
                </button>
              )}
            </div>
          </section>
        )}

        {/* Analysis Workspace (Full or Partial Preview with Resume Banner) */}
        {analysis && !loading && (
          <section
            ref={resultsSectionRef}
            className={`${mobileNavTab === "resultados" ? "block" : "hidden md:block"} space-y-4`}
          >
            {isPartialPreview && activeJob && activeJob.completedStages.length < ANALYSIS_STAGE_ORDER.length && (
              <div className="bg-sem-amber-bg border border-sem-amber-border rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <AlertTriangle className="w-4 h-4 text-sem-amber shrink-0 mt-0.5" />
                  <div className="text-xs min-w-0">
                    <span className="font-bold text-sem-amber block">
                      Vista de avance parcial ({activeJob.completedStages.length}/{ANALYSIS_STAGE_ORDER.length} etapas)
                    </span>
                    <span className="text-brand-text">
                      Las secciones restantes aún no se han completado. Puedes continuar ahora desde donde se quedó.
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleResumeSavedJob(activeJob)}
                  className="shrink-0 px-4 py-2 rounded-xl bg-brand-gold hover:bg-brand-gold-hover text-slate-950 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>
                    Completar análisis ({activeJob.completedStages.length}/{ANALYSIS_STAGE_ORDER.length})
                  </span>
                </button>
              </div>
            )}

            <AnalysisWorkspace
              analysis={analysis}
              topic={topic}
              focusType={focusType}
              activeTradition={activeTradition}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              dictEnabled={dictEnabled}
              onToggleDict={setDictEnabled}
              onCopyMarkdown={handleCopyMarkdown}
              onDownloadMarkdown={handleDownloadMarkdown}
              onOpenMdViewer={() => setMdViewerOpen(true)}
              copying={copying}
              analysisContainerRef={analysisContainerRef}
              onTextSelection={handleTextSelection}
            />
          </section>
        )}

        {/* Mobile-visible recovery notice when on Resultados tab without analysis (e.g. paused/error) */}
        {!analysis && !loading && activeJob && mobileNavTab === "resultados" && (
          <section className="md:hidden bg-brand-card border border-brand-border rounded-2xl p-5 space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-sem-amber shrink-0 mt-0.5" />
              <div className="min-w-0 space-y-1">
                <h3 className="text-sm font-bold text-brand-text font-serif">
                  Análisis interrumpido ({activeJob.completedStages.length}/{ANALYSIS_STAGE_ORDER.length} etapas guardadas)
                </h3>
                <p className="text-xs text-brand-text-muted break-words">
                  {activeJob.errorMessage || "Puedes continuar exactamente desde la etapa pendiente sin perder lo ya generado."}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleResumeSavedJob(activeJob)}
                className="flex-1 min-h-[42px] px-4 py-2 rounded-xl bg-brand-gold text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Continuar donde se quedó</span>
              </button>
              {activeJob.completedStages.length > 0 && (
                <button
                  type="button"
                  onClick={handleViewPartialProgress}
                  className="min-h-[42px] px-3.5 py-2 rounded-xl bg-brand-bg border border-brand-border text-brand-text font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 text-brand-gold" />
                  <span>Ver parcial</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleDiscardSavedJob}
                className="min-h-[42px] px-3.5 py-2 rounded-xl bg-brand-bg border border-brand-border text-brand-text-muted font-semibold text-xs cursor-pointer"
              >
                Descartar
              </button>
            </div>
          </section>
        )}

        {/* Rich Pre-Analysis Overview (Methodological Architecture + Recent History) */}
        {!analysis && !loading && (
          <section className="space-y-6">
            <div
              className={`${
                mobileNavTab === "analizar" ? "block" : "hidden md:block"
              } bg-brand-card rounded-2xl border border-brand-border overflow-hidden`}
            >
              <button
                type="button"
                onClick={() => setShowArchitecture((prev) => !prev)}
                aria-expanded={showArchitecture}
                className="w-full p-4 sm:p-6 flex items-center justify-between gap-3 text-left hover:bg-brand-bg/40 transition cursor-pointer"
              >
                <div className="space-y-1 min-w-0">
                  <div className="text-[11px] sm:text-xs font-bold uppercase tracking-wider sm:tracking-widest text-brand-gold flex items-center gap-2">
                    <Layers className="w-4 h-4 shrink-0" />
                    <span className="truncate">Arquitectura del Motor Epistémico</span>
                  </div>
                  <h2 className="text-sm sm:text-lg font-bold text-brand-text font-serif leading-snug break-words">
                    Qué produce cada consulta en {METHODOLOGICAL_PILLARS.length} módulos integrados
                  </h2>
                </div>
                <span className="flex items-center gap-1.5 text-xs font-semibold text-brand-gold shrink-0">
                  <span>{showArchitecture ? "Contraer" : `Expandir (${METHODOLOGICAL_PILLARS.length})`}</span>
                  {showArchitecture ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </span>
              </button>

              {showArchitecture && (
                <div className="px-4 pb-5 pt-4 sm:px-6 sm:pb-6 border-t border-brand-border space-y-5">
                  <p className="text-xs text-brand-text-muted max-w-2xl leading-relaxed">
                    Cada análisis separa hechos verificables, inferencias lógicas, riesgos de ejecución y sesgos cognitivos potenciales.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {METHODOLOGICAL_PILLARS.map((pillar) => {
                      const Icon = pillar.icon;
                      return (
                        <div
                          key={pillar.step}
                          className="bg-brand-bg/60 border border-brand-border rounded-xl p-4 sm:p-5 space-y-2.5 min-w-0"
                        >
                          <div className="flex items-center justify-between">
                            <div className="w-8 h-8 rounded-lg bg-brand-card border border-brand-border flex items-center justify-center text-brand-gold shrink-0">
                              <Icon className="w-4 h-4" />
                            </div>
                            <span className="font-mono text-xs font-bold text-brand-text-muted tabular-nums">
                              {pillar.step}
                            </span>
                          </div>
                          <h3 className="text-sm font-bold text-brand-text font-serif break-words">
                            {pillar.title}
                          </h3>
                          <p className="text-xs text-brand-text-muted leading-relaxed break-words">
                            {pillar.desc}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {history.length > 0 && (
              <div className="hidden md:block bg-brand-card border border-brand-border rounded-2xl p-4 sm:p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-border pb-3">
                  <h3 className="text-sm font-bold text-brand-text font-serif flex items-center gap-2">
                    <History className="w-4 h-4 text-brand-gold shrink-0" />
                    <span>Consultas Recientes ({history.length})</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => setHistoryOpen(true)}
                    className="text-xs font-bold text-brand-gold hover:underline cursor-pointer"
                  >
                    Gestionar historial completo →
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {history.slice(0, 6).map((h) => (
                    <div
                      key={h.id}
                      onClick={() => {
                        setAnalysis(h.data);
                        setIsPartialPreview(false);
                        setErrorMsg(null);
                        setTopic(h.topic);
                        setFocusType(h.focusType);
                        if (h.tradition) {
                          setTradicionTeologica(h.tradition);
                          setActiveTradition(h.tradition);
                        }
                        setActiveTab("resumen");
                      }}
                      className="text-left bg-brand-bg/60 hover:bg-brand-card-light/30 border border-brand-border rounded-xl p-4 hover:border-brand-gold/50 cursor-pointer transition group flex flex-col justify-between gap-3"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2 text-[11px]">
                          <span className="font-bold text-brand-gold truncate">{h.focusType}</span>
                          <span className="font-mono text-brand-text-muted tabular-nums shrink-0">
                            {h.timestamp.split(",")[0]}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-brand-text line-clamp-2 leading-relaxed">
                          {h.topic}
                        </p>
                      </div>

                      <div className="flex items-center justify-between text-[11px] pt-2 border-t border-brand-border/50">
                        <span className="font-semibold text-brand-gold flex items-center gap-1 group-hover:underline">
                          Abrir análisis <ArrowRight className="w-3 h-3" />
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => toggleFavorite(h.id, e)}
                            className={`p-1 rounded transition cursor-pointer ${
                              h.favorite ? "text-brand-gold" : "text-brand-text-muted hover:text-brand-gold"
                            }`}
                            title="Favorito"
                          >
                            <Star className={`w-3.5 h-3.5 ${h.favorite ? "fill-current" : ""}`} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => deleteHistoryItem(h.id, e)}
                            className="p-1 rounded text-brand-text-muted hover:text-sem-rose transition cursor-pointer"
                            title="Eliminar del historial"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}
      </main>

      <footer className="hidden md:block border-t border-brand-border py-5 mt-8 text-center no-print">
        <p className="text-xs text-brand-text-muted">
          AnálisisPro · Sistema de Análisis Multidisciplinario, Matriz de Decisiones y Auditoría Crítica
        </p>
      </footer>

      {/* Mobile Bottom Thumb Navigation */}
      <nav
        aria-label="Navegación principal móvil"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-brand-card/95 backdrop-blur-lg border-t border-brand-border pb-safe shadow-2xl no-print"
      >
        <div className={`grid ${analysis || loading || activeJob ? "grid-cols-5" : "grid-cols-4"} gap-1 px-1.5 py-1`}>
          <button
            type="button"
            onClick={() => {
              setMobileNavTab("analizar");
              setHistoryOpen(false);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className={`min-h-[46px] min-w-0 px-1 flex flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-bold transition cursor-pointer ${
              mobileNavTab === "analizar"
                ? "text-brand-gold bg-brand-gold/12"
                : "text-brand-text-muted hover:text-brand-text"
            }`}
          >
            <Compass className="w-4 h-4 shrink-0" />
            <span className="truncate max-w-full">Consulta</span>
          </button>

          {(analysis || loading || activeJob) && (
            <button
              type="button"
              onClick={() => {
                setMobileNavTab("resultados");
                setHistoryOpen(false);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className={`relative min-h-[46px] min-w-0 px-1 flex flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-bold transition cursor-pointer ${
                mobileNavTab === "resultados"
                  ? "text-brand-gold bg-brand-gold/12"
                  : "text-brand-text-muted hover:text-brand-text"
              }`}
            >
              <BarChart3 className="w-4 h-4 shrink-0" />
              <span className="truncate max-w-full">Resultados</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setMobileNavTab("plantillas");
              setHistoryOpen(false);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className={`relative min-h-[46px] min-w-0 px-1 flex flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-bold transition cursor-pointer ${
              mobileNavTab === "plantillas"
                ? "text-brand-gold bg-brand-gold/12"
                : "text-brand-text-muted hover:text-brand-text"
            }`}
          >
            <Sparkles className="w-4 h-4 shrink-0" />
            <span className="truncate max-w-full">Plantillas</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMobileNavTab("historial");
              setHistoryOpen(true);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className={`relative min-h-[46px] min-w-0 px-1 flex flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-bold transition cursor-pointer ${
              mobileNavTab === "historial"
                ? "text-brand-gold bg-brand-gold/12"
                : "text-brand-text-muted hover:text-brand-text"
            }`}
          >
            <History className="w-4 h-4 shrink-0" />
            <span className="truncate max-w-full">Historial ({history.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setMdViewerOpen(true)}
            className={`min-h-[46px] min-w-0 px-1 flex flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-bold transition cursor-pointer ${
              mdViewerOpen
                ? "text-brand-gold bg-brand-gold/12"
                : "text-brand-text-muted hover:text-brand-text"
            }`}
          >
            <BookOpen className="w-4 h-4 shrink-0" />
            <span className="truncate max-w-full">Visor .md</span>
          </button>
        </div>
      </nav>

      {/* Inline Dictionary Floating Popup */}
      <AnimatePresence>
        {dictSelection && (
          <motion.div
            ref={dictPopupRef}
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            style={{
              position: "fixed",
              zIndex: 9999,
              ...(window.innerWidth >= 640
                ? { top: `${dictSelection.top}px`, left: `${dictSelection.left}px` }
                : { bottom: "calc(68px + env(safe-area-inset-bottom, 0px))", left: "12px", right: "12px" }),
            }}
            className="w-auto sm:w-[380px] bg-brand-card border-2 border-brand-gold/70 rounded-xl shadow-2xl p-4 text-brand-text flex flex-col gap-3 font-sans backdrop-blur-xl max-h-[65vh] sm:max-h-[80vh] overflow-y-auto break-words"
          >
            <div className="flex items-center justify-between border-b border-brand-border pb-2">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-brand-gold" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-brand-gold">
                  Diccionario Contextual
                </span>
              </div>
              <div className="flex items-center gap-2">
                {dictResult?.categoria && (
                  <span className="text-[10px] font-mono font-bold text-brand-text-muted">
                    {dictResult.categoria}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setDictSelection(null)}
                  className="text-brand-text-muted hover:text-brand-text p-1 rounded hover:bg-brand-bg transition cursor-pointer"
                  title="Cerrar (Esc)"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="flex items-baseline justify-between gap-2 flex-wrap">
              <h4 className="text-base font-bold font-serif text-brand-text">
                {dictResult?.termino || `"${dictSelection.text}"`}
              </h4>
              {dictResult?.etimologia && dictResult.etimologia !== "Etimología general" && (
                <span className="text-[11px] font-mono text-sem-rose">
                  {dictResult.etimologia}
                </span>
              )}
            </div>

            {dictLoading && (
              <div className="py-5 flex flex-col items-center justify-center gap-2 text-center">
                <Sparkles className="w-5 h-5 text-brand-gold animate-spin" />
                <span className="text-xs text-brand-text-muted font-serif">
                  Consultando léxico y etimología...
                </span>
              </div>
            )}

            {dictError && (
              <div className="p-3 bg-sem-rose-bg border border-sem-rose-border rounded-lg text-xs text-sem-rose flex flex-col gap-2">
                <p>{dictError}</p>
                <button
                  type="button"
                  onClick={() => fetchDefinition(dictSelection.text, dictSelection.context)}
                  className="self-end text-[11px] font-bold text-brand-gold underline cursor-pointer"
                >
                  Reintentar
                </button>
              </div>
            )}

            {dictResult && !dictLoading && (
              <div className="flex flex-col gap-2.5 text-xs">
                <div className="bg-brand-bg/60 p-3 rounded-lg border border-brand-border">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-brand-gold block mb-1">
                    Definición Técnica
                  </span>
                  <p className="text-brand-text leading-relaxed font-serif">
                    {dictResult.definicion}
                  </p>
                </div>

                {dictResult.explicacionSencilla && (
                  <div className="bg-brand-gold/10 p-3 rounded-lg border border-brand-gold/30 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-brand-gold block">
                      En lenguaje sencillo
                    </span>
                    <p className="text-brand-text leading-relaxed font-serif font-medium">
                      {dictResult.explicacionSencilla}
                    </p>
                  </div>
                )}

                {dictResult.contextoAcademico && (
                  <div className="bg-brand-bg/40 p-2.5 rounded-lg border border-brand-border text-[11px]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-brand-text-muted block mb-0.5">
                      Uso y Contexto Académico
                    </span>
                    <p className="text-brand-text-muted italic font-serif leading-relaxed">
                      "{dictResult.contextoAcademico}"
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-brand-border/50 text-[11px] text-brand-text-muted">
                  <span className="italic">Selecciona otro término para definirlo</span>
                  <button
                    type="button"
                    onClick={() => {
                      const textToCopy = `${dictResult.termino}: ${dictResult.definicion} (${dictResult.etimologia})`;
                      navigator.clipboard.writeText(textToCopy);
                      setCopiedDict(true);
                      setTimeout(() => setCopiedDict(false), 2000);
                    }}
                    className="flex items-center gap-1 text-brand-gold hover:underline font-bold cursor-pointer"
                  >
                    {copiedDict ? <Check className="w-3.5 h-3.5 text-sem-emerald" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedDict ? "Copiado" : "Copiar"}</span>
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <MarkdownViewerModal
        isOpen={mdViewerOpen}
        onClose={() => setMdViewerOpen(false)}
        currentReportMarkdown={analysis ? generateMarkdownReport(analysis, activeTradition) : undefined}
      />

      <OfflineIndicator />
    </div>
  );
}
