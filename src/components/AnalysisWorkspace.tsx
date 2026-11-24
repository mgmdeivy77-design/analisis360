import React, { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Award,
  BookMarked,
  BookOpen,
  Brain,
  BrainCircuit,
  Check,
  CheckCircle2,
  Compass,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Glasses,
  HelpCircle,
  Layers,
  Library,
  ListChecks,
  Printer,
  RotateCcw,
  Scale,
  Search,
  ShieldAlert,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Clock,
  Globe,
  Video,
  GraduationCap,
  Wrench,
  Cpu,
  LayoutTemplate,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  ComprehensiveAnalysisResponse,
  ResourceCategory,
  ResourceItem,
} from "../types";
import { resolveResourceLink } from "../utils";
import { DiagnosticTestView } from "./DiagnosticTestView";
import { ScenarioSimulator } from "./ScenarioSimulator";

export type AnalysisTabId =
  | "resumen"
  | "multidisciplinario"
  | "comparacion"
  | "decisiones"
  | "plan"
  | "auditoria"
  | "test"
  | "teologia"
  | "recursos";

interface AnalysisWorkspaceProps {
  analysis: ComprehensiveAnalysisResponse;
  topic: string;
  focusType: string;
  activeTradition: string;
  activeTab: AnalysisTabId;
  onTabChange: (tab: AnalysisTabId) => void;
  dictEnabled: boolean;
  onToggleDict: (enabled: boolean) => void;
  onCopyMarkdown: () => void;
  onDownloadMarkdown: () => void;
  onOpenMdViewer: () => void;
  copying: boolean;
  analysisContainerRef: React.RefObject<HTMLDivElement | null>;
  onTextSelection: () => void;
}

export const AnalysisWorkspace: React.FC<AnalysisWorkspaceProps> = ({
  analysis,
  topic,
  focusType,
  activeTradition,
  activeTab,
  onTabChange,
  dictEnabled,
  onToggleDict,
  onCopyMarkdown,
  onDownloadMarkdown,
  onOpenMdViewer,
  copying,
  analysisContainerRef,
  onTextSelection,
}) => {
  // Interactive local states to make sections richer and functional
  const [glossarySearch, setGlossarySearch] = useState("");
  const [disciplineFilter, setDisciplineFilter] = useState<"Todas" | "Alta" | "Media" | "Baja">("Todas");
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({});
  const [resourceGroupFilter, setResourceGroupFilter] = useState<"todos" | "lectura" | "multimedia" | "herramientas">("todos");
  const [resourceSearch, setResourceSearch] = useState("");
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const totalResourcesCount = useMemo(() => {
    const r = analysis.recursosRecomendados;
    return (
      (r.libros?.length || 0) +
      (r.articulos?.length || 0) +
      (r.sitiosWeb?.length || 0) +
      (r.videos?.length || 0) +
      (r.cursos?.length || 0) +
      (r.herramientas?.length || 0) +
      (r.ias?.length || 0) +
      (r.software?.length || 0) +
      (r.plantillas?.length || 0)
    );
  }, [analysis.recursosRecomendados]);

  const navGroups: Array<{
    groupTitle: string;
    items: Array<{
      stepNum: string;
      id: AnalysisTabId;
      label: string;
      subtitle: string;
      icon: typeof FileText;
      count?: number | string;
    }>;
  }> = [
    {
      groupTitle: "1. Comprensión y Base",
      items: [
        {
          stepNum: "01",
          id: "resumen",
          label: "Resumen y Glosario",
          subtitle: "Tesis, conceptos y contexto",
          icon: FileText,
          count: analysis.definiciones.length,
        },
        {
          stepNum: "02",
          id: "multidisciplinario",
          label: "Investigación y Evidencia",
          subtitle: "Disciplinas, ciencia y exégesis",
          icon: Layers,
          count: analysis.analisisMultidisciplinario.length,
        },
      ],
    },
    {
      groupTitle: "2. Evaluación y Decisión",
      items: [
        {
          stepNum: "03",
          id: "comparacion",
          label: "Perspectivas y Contraste",
          subtitle: "Posturas y tabla comparativa",
          icon: Scale,
          count: analysis.perspectivas.length,
        },
        {
          stepNum: "04",
          id: "decisiones",
          label: "Matriz y Simulador",
          subtitle: "Alternativas y recomendación",
          icon: Compass,
          count: analysis.matrizDecisiones.length,
        },
        {
          stepNum: "05",
          id: "plan",
          label: "Plan, Riesgos y Checklist",
          subtitle: "Pasos, mitigación y control",
          icon: ListChecks,
          count: analysis.planPasoAPaso.length,
        },
      ],
    },
    {
      groupTitle: "3. Validación Crítica",
      items: [
        {
          stepNum: "06",
          id: "auditoria",
          label: "Auditoría de Sesgos",
          subtitle: "Supuestos, fallas y sesgos",
          icon: ShieldAlert,
          count: analysis.auditoriaRazonamiento.sesgosCognitivos.length,
        },
        {
          stepNum: "07",
          id: "test",
          label: "Test Diagnóstico",
          subtitle: "Nivel técnico y madurez",
          icon: BrainCircuit,
          count: analysis.testDiagnostico?.preguntas.length,
        },
      ],
    },
    {
      groupTitle: "4. Módulos Especializados",
      items: [
        {
          stepNum: "08",
          id: "teologia",
          label: "Teología y Exégesis",
          subtitle: "Motivos, marco e idiomas",
          icon: BookOpen,
        },
        {
          stepNum: "09",
          id: "recursos",
          label: "Biblioteca de Recursos",
          subtitle: "Libros, cursos, software e IA",
          icon: Library,
          count: totalResourcesCount,
        },
      ],
    },
  ];

  const flatTabs = navGroups.flatMap((g) => g.items);
  const currentStepIndex = Math.max(0, flatTabs.findIndex((t) => t.id === activeTab));
  const currentStepItem = flatTabs[currentStepIndex] || flatTabs[0];
  const prevStepItem = currentStepIndex > 0 ? flatTabs[currentStepIndex - 1] : null;
  const nextStepItem = currentStepIndex < flatTabs.length - 1 ? flatTabs[currentStepIndex + 1] : null;

  const filteredDefinitions = useMemo(() => {
    const q = glossarySearch.trim().toLowerCase();
    if (!q) return analysis.definiciones;
    return analysis.definiciones.filter(
      (d) =>
        d.termino.toLowerCase().includes(q) ||
        d.definicion.toLowerCase().includes(q) ||
        (d.explicacionSencilla || "").toLowerCase().includes(q)
    );
  }, [analysis.definiciones, glossarySearch]);

  const filteredDisciplines = useMemo(() => {
    if (disciplineFilter === "Todas") return analysis.analisisMultidisciplinario;
    return analysis.analisisMultidisciplinario.filter((item) => item.relevancia === disciplineFilter);
  }, [analysis.analisisMultidisciplinario, disciplineFilter]);

  const checklistTotal = analysis.listaVerificacion.length;
  const checklistDoneCount = analysis.listaVerificacion.filter((_, idx) => Boolean(checkedItems[idx])).length;

  const handleCopySummaryBlock = () => {
    const text = `${topic}\n\nResumen Ejecutivo:\n${analysis.resumenEjecutivo}\n\nRecomendación Final (${analysis.recomendacionFinal.nivelConfianza}%):\n${analysis.recomendacionFinal.recomendacion}\n\nJustificación:\n${analysis.recomendacionFinal.justificacion}`;
    navigator.clipboard.writeText(text);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  return (
    <div className="flex flex-col gap-5 min-w-0 w-full">
      {/* Report Toolbar Header */}
      <div className="bg-brand-card rounded-2xl border border-brand-border p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 min-w-0">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-sem-emerald-bg border border-sem-emerald-border text-sem-emerald flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="min-w-0 space-y-1 flex-1">
            <div className="flex items-center gap-x-2 gap-y-0.5 flex-wrap text-[11px] font-mono text-brand-text-muted">
              <span className="font-bold text-brand-gold uppercase">{focusType}</span>
              <span>·</span>
              <span className="break-words">{activeTradition}</span>
              <span>·</span>
              <span className="font-bold text-sem-emerald tabular-nums">
                Certeza {analysis.recomendacionFinal.nivelConfianza}%
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-brand-text font-serif leading-snug line-clamp-2 break-words">
              {topic}
            </h2>
          </div>
        </div>

        {/* Organized Action Button Bar */}
        <div className="flex flex-wrap items-center gap-2 shrink-0 no-print">
          <button
            type="button"
            onClick={() => onToggleDict(!dictEnabled)}
            className={`min-h-[38px] px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
              dictEnabled
                ? "bg-brand-gold/15 text-brand-gold border-brand-gold/40"
                : "bg-brand-bg text-brand-text-muted border-brand-border hover:text-brand-text"
            }`}
            title="Sombrea cualquier término dentro del reporte para consultar su definición y etimología"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Diccionario: {dictEnabled ? "Activo" : "Inactivo"}</span>
          </button>

          <button
            type="button"
            onClick={onCopyMarkdown}
            className="min-h-[38px] px-3 py-1.5 rounded-lg border border-brand-border bg-brand-bg hover:bg-brand-card-light text-xs font-semibold text-brand-text flex items-center gap-1.5 transition cursor-pointer"
          >
            {copying ? <Check className="w-3.5 h-3.5 text-sem-emerald" /> : <Copy className="w-3.5 h-3.5 text-brand-gold" />}
            <span>{copying ? "Copiado" : "Copiar .md"}</span>
          </button>

          <button
            type="button"
            onClick={onOpenMdViewer}
            className="min-h-[38px] px-3 py-1.5 rounded-lg border border-brand-border bg-brand-bg hover:bg-brand-card-light text-xs font-semibold text-brand-text flex items-center gap-1.5 transition cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-brand-gold" />
            <span>Visor .md</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="min-h-[38px] px-3 py-1.5 rounded-lg border border-brand-border bg-brand-bg hover:bg-brand-card-light text-xs font-semibold text-brand-text flex items-center gap-1.5 transition cursor-pointer hidden sm:flex"
            title="Imprimir o guardar como PDF"
          >
            <Printer className="w-3.5 h-3.5 text-brand-text-muted" />
            <span>Imprimir</span>
          </button>

          <button
            type="button"
            onClick={onDownloadMarkdown}
            className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-brand-gold hover:bg-brand-gold-hover text-slate-950 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Descargar .md</span>
          </button>
        </div>
      </div>

      {/* Main Workspace Split: Left Vertical Ordered Step Menu + Right Content Canvas */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
        {/* Vertical Step Navigation Rail (Always vertical from md+ up) */}
        <aside className="hidden md:flex md:col-span-4 lg:col-span-3 flex-col gap-4 bg-brand-card border border-brand-border rounded-2xl p-4 sticky top-20 no-print">
          <div className="flex items-center justify-between px-1 pb-2 border-b border-brand-border">
            <span className="text-[11px] font-bold uppercase tracking-widest text-brand-gold">
              Pasos del Análisis
            </span>
            <span className="text-[11px] font-mono text-brand-text-muted tabular-nums">
              {currentStepItem.stepNum} / 0{flatTabs.length}
            </span>
          </div>

          {navGroups.map((group) => (
            <div key={group.groupTitle} className="space-y-1.5">
              <div className="px-2 text-[10px] font-bold uppercase tracking-wider text-brand-text-muted">
                {group.groupTitle}
              </div>
              <nav className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onTabChange(item.id)}
                      className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-left transition cursor-pointer ${
                        isActive
                          ? "bg-brand-gold/15 text-brand-gold border border-brand-gold/50"
                          : "text-brand-text-muted hover:text-brand-text hover:bg-brand-bg/60 border border-transparent"
                      }`}
                    >
                      <span className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`w-6 h-6 rounded-lg font-mono text-[10px] font-bold flex items-center justify-center shrink-0 tabular-nums ${
                            isActive
                              ? "bg-brand-gold text-slate-950"
                              : "bg-brand-bg text-brand-text-muted border border-brand-border"
                          }`}
                        >
                          {item.stepNum}
                        </span>
                        <span className="min-w-0 flex flex-col">
                          <span className={`text-xs font-semibold truncate ${isActive ? "font-bold text-brand-gold" : "text-brand-text"}`}>
                            {item.label}
                          </span>
                          <span className="text-[10px] text-brand-text-muted truncate">
                            {item.subtitle}
                          </span>
                        </span>
                      </span>
                      {item.count !== undefined ? (
                        <span className="text-[11px] font-mono tabular-nums text-brand-text-muted shrink-0">
                          {item.count}
                        </span>
                      ) : (
                        <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-brand-gold" : "text-brand-text-muted/70"}`} />
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>
          ))}

          {/* Epistemic Signals Summary */}
          <div className="pt-3 border-t border-brand-border space-y-2 px-1">
            <div className="text-[10px] font-bold uppercase tracking-widest text-brand-text-muted">
              Estado de Capas
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-brand-text-muted">Rigor Científico</span>
                <span className={`font-mono text-[11px] font-bold ${analysis.esCientifico ? "text-sem-sky" : "text-brand-text-muted"}`}>
                  {analysis.esCientifico ? "Activo" : "Complementario"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-brand-text-muted">Exégesis Bíblica</span>
                <span className={`font-mono text-[11px] font-bold ${analysis.esBiblico ? "text-brand-gold" : "text-brand-text-muted"}`}>
                  {analysis.esBiblico ? "Activo" : "Ético / General"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-brand-text-muted">Checklist</span>
                <span className="font-mono text-[11px] font-bold text-sem-emerald tabular-nums">
                  {checklistDoneCount}/{checklistTotal}
                </span>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Viewport */}
        <div className="md:col-span-8 lg:col-span-9 flex flex-col gap-4 min-w-0">
          {/* Mobile Vertical Expandable Step Menu (No Horizontal Scrolling) */}
          <div className="md:hidden bg-brand-card border border-brand-border rounded-2xl overflow-hidden no-print">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="w-full px-4 py-3.5 flex items-center justify-between gap-3 text-left cursor-pointer hover:bg-brand-bg/40 transition"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-7 h-7 rounded-lg bg-brand-gold text-slate-950 font-mono text-xs font-extrabold flex items-center justify-center shrink-0 tabular-nums">
                  {currentStepItem.stepNum}
                </span>
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-brand-text-muted tabular-nums">
                    Paso {currentStepItem.stepNum} de 0{flatTabs.length}
                  </div>
                  <div className="text-xs font-bold text-brand-text truncate">
                    {currentStepItem.label}
                  </div>
                </div>
              </div>
              <span className="flex items-center gap-1 text-xs font-bold text-brand-gold shrink-0">
                <span>{mobileMenuOpen ? "Ocultar menú" : "Ver pasos"}</span>
                {mobileMenuOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </span>
            </button>

            {mobileMenuOpen && (
              <div className="border-t border-brand-border p-3 space-y-3 bg-brand-bg/40">
                {navGroups.map((group) => (
                  <div key={group.groupTitle} className="space-y-1.5">
                    <div className="px-2 text-[10px] font-bold uppercase tracking-wider text-brand-text-muted">
                      {group.groupTitle}
                    </div>
                    <div className="space-y-1">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const isSelected = activeTab === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              onTabChange(item.id);
                              setMobileMenuOpen(false);
                            }}
                            className={`w-full min-h-[44px] flex items-center justify-between gap-3 px-3 py-2 rounded-xl border text-left transition cursor-pointer ${
                              isSelected
                                ? "bg-brand-gold/15 border-brand-gold text-brand-gold"
                                : "bg-brand-card border-brand-border text-brand-text hover:border-brand-gold/40"
                            }`}
                          >
                            <span className="flex items-center gap-2.5 min-w-0">
                              <span
                                className={`w-6 h-6 rounded-md font-mono text-[10px] font-bold flex items-center justify-center shrink-0 tabular-nums ${
                                  isSelected
                                    ? "bg-brand-gold text-slate-950"
                                    : "bg-brand-bg text-brand-text-muted border border-brand-border"
                                }`}
                              >
                                {item.stepNum}
                              </span>
                              <span className="min-w-0">
                                <span className="text-xs font-bold block truncate">{item.label}</span>
                                <span className="text-[10px] text-brand-text-muted block truncate">{item.subtitle}</span>
                              </span>
                            </span>
                            <span className="flex items-center gap-1.5 shrink-0">
                              {item.count !== undefined && (
                                <span className="font-mono text-[11px] text-brand-text-muted tabular-nums">
                                  {item.count}
                                </span>
                              )}
                              <Icon className={`w-4 h-4 ${isSelected ? "text-brand-gold" : "text-brand-text-muted"}`} />
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Content Container */}
          <div
            ref={analysisContainerRef}
            onMouseUp={onTextSelection}
            onTouchEnd={onTextSelection}
            className="bg-brand-card rounded-2xl border border-brand-border p-4 sm:p-7 min-h-[460px] space-y-6 min-w-0 w-full break-words"
          >
            {dictEnabled && (
              <div className="bg-brand-bg/70 border border-brand-border rounded-xl px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-brand-text-muted no-print">
                <div className="flex items-start sm:items-center gap-2 min-w-0">
                  <BookOpen className="w-3.5 h-3.5 text-brand-gold shrink-0 mt-0.5 sm:mt-0" />
                  <span className="leading-snug">
                    <strong className="text-brand-text">Diccionario contextual:</strong> selecciona cualquier palabra o frase en el texto para consultar su definición y etimología.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onToggleDict(false)}
                  className="text-[11px] font-semibold text-brand-text-muted hover:text-brand-text underline cursor-pointer shrink-0 self-end sm:self-auto"
                >
                  Desactivar
                </button>
              </div>
            )}

            {activeTradition === "Sabiduría práctica y habilidades sociales" && (
              <div className="bg-brand-gold/10 border border-brand-gold/30 rounded-xl p-4 flex items-start gap-3">
                <Sparkles className="w-4 h-4 text-brand-gold shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs">
                  <div className="font-bold text-brand-gold">
                    Marco Calibrado: Sabiduría Práctica y Habilidades Sociales (Phrónēsis)
                  </div>
                  <p className="text-brand-text/90 leading-relaxed">
                    Enfocado en inteligencia interpersonal, guiones de comunicación asertiva, desescalamiento de tensiones, lectura de timing y negociación ganar-ganar.
                  </p>
                </div>
              </div>
            )}

            {/* TAB 1: RESUMEN Y GLOSARIO */}
            {activeTab === "resumen" && (
              <div className="space-y-7">
                {/* Executive Hero Block */}
                <div className="space-y-3 border-b border-brand-border pb-6">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-xs font-bold uppercase tracking-widest text-brand-gold">
                      1. Resumen Ejecutivo
                    </span>
                    <button
                      type="button"
                      onClick={handleCopySummaryBlock}
                      className="px-2.5 py-1 rounded-lg border border-brand-border bg-brand-bg hover:bg-brand-card-light text-[11px] font-semibold text-brand-text flex items-center gap-1.5 transition cursor-pointer no-print"
                    >
                      {copiedSummary ? <Check className="w-3 h-3 text-sem-emerald" /> : <Copy className="w-3 h-3 text-brand-gold" />}
                      <span>{copiedSummary ? "Resumen copiado" : "Copiar síntesis"}</span>
                    </button>
                  </div>
                  <div className="text-base sm:text-lg font-serif text-brand-text leading-relaxed whitespace-pre-line">
                    {analysis.resumenEjecutivo}
                  </div>
                </div>

                {/* 4-Pillar Synthesis */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-brand-gold">
                    <Sparkles className="w-4 h-4" />
                    <span>Síntesis Estructural en 4 Respuestas Clave</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-brand-bg/60 p-4 rounded-xl border border-brand-border space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-brand-text">
                        <HelpCircle className="w-4 h-4 text-brand-gold shrink-0" />
                        <span>1. ¿De qué trata realmente?</span>
                      </div>
                      <p className="text-xs sm:text-sm text-brand-text-muted leading-relaxed font-serif">
                        {analysis.sintesisClave?.deQueTrata || analysis.comprensionProblema}
                      </p>
                    </div>

                    <div className="bg-brand-bg/60 p-4 rounded-xl border border-brand-border space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-brand-text">
                        <Brain className="w-4 h-4 text-brand-gold shrink-0" />
                        <span>2. Idea Principal / Tesis Central</span>
                      </div>
                      <p className="text-xs sm:text-sm text-brand-text-muted leading-relaxed font-serif">
                        {analysis.sintesisClave?.ideaPrincipal || analysis.resumenEjecutivo}
                      </p>
                    </div>

                    <div className="bg-brand-bg/60 p-4 rounded-xl border border-brand-border space-y-2.5 md:col-span-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-brand-text">
                        <ListChecks className="w-4 h-4 text-brand-gold shrink-0" />
                        <span>3. Argumentos Fundamentales de Soporte</span>
                      </div>
                      <ul className="space-y-2">
                        {(analysis.sintesisClave?.argumentos && analysis.sintesisClave.argumentos.length > 0
                          ? analysis.sintesisClave.argumentos
                          : [analysis.recomendacionFinal.justificacion]
                        ).map((arg, idx) => (
                          <li key={idx} className="text-xs sm:text-sm text-brand-text-muted flex items-start gap-2.5 font-serif leading-relaxed">
                            <span className="font-mono text-xs font-bold text-brand-gold shrink-0 mt-0.5 tabular-nums">
                              0{idx + 1}.
                            </span>
                            <span>{arg}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="bg-brand-bg/80 p-4 rounded-xl border border-brand-gold/40 space-y-2 md:col-span-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-brand-gold">
                        <Award className="w-4 h-4 shrink-0" />
                        <span>4. Dictamen y Conclusión Directa</span>
                      </div>
                      <p className="text-sm text-brand-text font-serif leading-relaxed font-medium">
                        {analysis.sintesisClave?.conclusion || analysis.recomendacionFinal.recomendacion}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Deep Problem Dissection */}
                <div className="bg-brand-bg/50 border border-brand-border rounded-xl p-5 space-y-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-brand-gold">
                    Disección del Problema Subyacente y Efectos de Segundo Orden
                  </h3>
                  <p className="text-sm leading-relaxed text-brand-text-muted font-serif whitespace-pre-line">
                    {analysis.comprensionProblema}
                  </p>
                </div>

                {/* Dual Conceptual Glossary (Searchable, All Definitions) */}
                <div className="space-y-4 pt-2 border-t border-brand-border">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-widest text-brand-gold">
                        Glosario Conceptual Dual ({analysis.definiciones.length} términos)
                      </h3>
                      <p className="text-xs text-brand-text-muted mt-0.5">
                        Precisión técnica académica contrastada con explicaciones cotidianas claras.
                      </p>
                    </div>
                    {analysis.definiciones.length > 3 && (
                      <div className="relative w-full sm:w-64 no-print">
                        <Search className="w-3.5 h-3.5 text-brand-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={glossarySearch}
                          onChange={(e) => setGlossarySearch(e.target.value)}
                          placeholder="Filtrar definiciones..."
                          className="w-full pl-8 pr-3 py-1.5 bg-brand-bg border border-brand-border rounded-lg text-xs text-brand-text placeholder-brand-text-muted/60 focus:outline-none focus:border-brand-gold"
                        />
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {filteredDefinitions.map((def, idx) => (
                      <div
                        key={idx}
                        className="border border-brand-border bg-brand-bg/50 rounded-xl p-4 flex flex-col justify-between gap-3"
                      >
                        <div className="space-y-1.5">
                          <h4 className="text-sm font-bold text-brand-text font-serif border-b border-brand-border/60 pb-1.5">
                            {def.termino}
                          </h4>
                          <p className="text-xs text-brand-text-muted leading-relaxed">
                            {def.definicion}
                          </p>
                        </div>
                        {def.explicacionSencilla && (
                          <div className="bg-brand-card/70 border border-brand-border rounded-lg p-3 text-xs text-brand-text font-serif leading-relaxed">
                            <span className="font-sans font-bold text-[10px] uppercase tracking-wider text-brand-gold block mb-1">
                              En lenguaje cotidiano
                            </span>
                            {def.explicacionSencilla}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* 5-Axis Epistemic Context */}
                <div className="space-y-4 pt-2 border-t border-brand-border">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-brand-gold">
                    Contextualización Multidimensional (5 Ejes)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {[
                      { label: "Contexto Histórico", val: analysis.contexto.historico, icon: Clock, accent: "text-brand-gold" },
                      { label: "Contexto Científico y Empírico", val: analysis.contexto.cientifico, icon: Activity, accent: "text-sem-sky" },
                      { label: "Contexto Cultural y Social", val: analysis.contexto.cultural, icon: Globe, accent: "text-sem-emerald" },
                      { label: "Contexto Práctico y Operativo", val: analysis.contexto.practico, icon: Compass, accent: "text-sem-amber" },
                      { label: "Contexto Ético / Bíblico", val: analysis.contexto.biblico, icon: BookMarked, accent: "text-brand-gold", spanFull: true },
                    ].map((ctx, idx) => {
                      const CtxIcon = ctx.icon;
                      return (
                        <div
                          key={idx}
                          className={`bg-brand-bg/50 border border-brand-border rounded-xl p-4 space-y-2 ${
                            ctx.spanFull ? "md:col-span-2" : ""
                          }`}
                        >
                          <div className={`text-xs font-bold flex items-center gap-2 ${ctx.accent}`}>
                            <CtxIcon className="w-4 h-4 shrink-0" />
                            <span>{ctx.label}</span>
                          </div>
                          <p className="text-xs sm:text-sm text-brand-text-muted leading-relaxed font-serif">
                            {ctx.val || "Sin elementos particulares registrados para este eje."}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: INVESTIGACIÓN MULTIDISCIPLINARIA */}
            {activeTab === "multidisciplinario" && (
              <div className="space-y-7">
                {analysis.esBiblico && analysis.especificosBiblicos && (
                  <div className="border border-brand-gold/40 bg-brand-bg/70 rounded-xl p-5 space-y-4">
                    <div className="flex items-center gap-2 border-b border-brand-border pb-3">
                      <BookMarked className="w-4 h-4 text-brand-gold" />
                      <h3 className="text-xs font-bold uppercase tracking-widest text-brand-gold">
                        Módulo Hermenéutico y Exégesis Bíblica
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs sm:text-sm">
                      <div className="space-y-1.5">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-brand-gold">
                          Contexto Histórico y Literario
                        </span>
                        <p className="text-brand-text leading-relaxed font-serif">
                          {analysis.especificosBiblicos.contextoHistoricoBiblico}
                        </p>
                        <p className="text-xs text-brand-text-muted italic font-mono pt-1">
                          Género y estructura: {analysis.especificosBiblicos.contextoLiterario}
                        </p>
                      </div>

                      <div className="space-y-1.5">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-brand-gold">
                          Intención Autoral y Destinatarios
                        </span>
                        <p className="text-brand-text leading-relaxed">
                          Audiencia original: <strong>{analysis.especificosBiblicos.destinatarios}</strong>
                        </p>
                        <p className="text-brand-text-muted font-serif leading-relaxed">
                          {analysis.especificosBiblicos.propositoAutor}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-brand-card/70 border border-brand-border rounded-xl p-4 text-xs sm:text-sm">
                      <div className="space-y-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-brand-gold flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Principio Universal Inmutable
                        </span>
                        <p className="text-brand-text font-serif leading-relaxed">
                          {analysis.especificosBiblicos.principioUniversal}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-brand-gold flex items-center gap-1.5">
                          <Activity className="w-3.5 h-3.5" />
                          Aplicación Contemporánea
                        </span>
                        <p className="text-brand-text font-serif leading-relaxed">
                          {analysis.especificosBiblicos.aplicacionActual}
                        </p>
                      </div>
                    </div>

                    {analysis.especificosBiblicos.pasajesRelacionados.length > 0 && (
                      <div className="space-y-2 text-xs">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-brand-gold">
                          Pasajes de Soporte
                        </span>
                        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {analysis.especificosBiblicos.pasajesRelacionados.map((pasaje, idx) => (
                            <li key={idx} className="bg-brand-card border border-brand-border rounded-lg px-3 py-2 font-mono text-[11px] text-brand-text">
                              {pasaje}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {analysis.especificosBiblicos.posiblesMalasInterpretaciones?.length > 0 && (
                      <div className="space-y-2 text-xs">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-sem-rose">
                          Errores Hermenéuticos y Refutación
                        </span>
                        <div className="space-y-2">
                          {analysis.especificosBiblicos.posiblesMalasInterpretaciones.map((mi, idx) => (
                            <div key={idx} className="bg-sem-rose-bg border border-sem-rose-border rounded-xl p-3.5 space-y-1.5">
                              <div className="font-bold text-sem-rose">
                                Error común: "{mi.interpretacion}"
                              </div>
                              <p className="text-brand-text font-serif leading-relaxed">
                                <strong className="text-sem-emerald font-sans">Exégesis rigurosa:</strong> {mi.refutacion}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="bg-brand-card/60 border border-brand-gold/30 rounded-xl p-4 text-xs sm:text-sm font-serif text-brand-text leading-relaxed">
                      <span className="font-sans font-bold uppercase tracking-wider text-brand-gold text-[10px] block mb-1">
                        Conclusión Exegética
                      </span>
                      {analysis.especificosBiblicos.conclusionExegetica}
                    </div>
                  </div>
                )}

                {analysis.esCientifico && analysis.especificosCientificos && (
                  <div className="border border-sem-sky-border bg-brand-bg/70 rounded-xl p-5 space-y-4">
                    <div className="flex items-center gap-2 border-b border-brand-border pb-3">
                      <Activity className="w-4 h-4 text-sem-sky" />
                      <h3 className="text-xs font-bold uppercase tracking-widest text-sem-sky">
                        Módulo de Evidencia Científica Empírica
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 text-xs">
                      <div className="bg-brand-card border border-brand-border rounded-xl p-3.5 space-y-1.5">
                        <span className="font-bold text-sem-sky uppercase tracking-wider text-[10px]">
                          Nivel de Evidencia
                        </span>
                        <p className="font-mono font-bold text-brand-text text-xs">
                          {analysis.especificosCientificos.nivelEvidencia}
                        </p>
                      </div>
                      <div className="bg-brand-card border border-brand-border rounded-xl p-3.5 space-y-1.5">
                        <span className="font-bold text-sem-sky uppercase tracking-wider text-[10px]">
                          Consenso Científico
                        </span>
                        <p className="text-brand-text font-serif leading-relaxed">
                          {analysis.especificosCientificos.consensoCientifico}
                        </p>
                      </div>
                      <div className="bg-brand-card border border-brand-border rounded-xl p-3.5 space-y-1.5">
                        <span className="font-bold text-sem-sky uppercase tracking-wider text-[10px]">
                          Grado de Certeza
                        </span>
                        <p className="font-bold text-sem-emerald">
                          {analysis.especificosCientificos.gradoCerteza}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-xs sm:text-sm">
                      <span className="font-bold text-sem-sky uppercase tracking-wider text-[11px]">
                        Limitaciones Metodológicas de la Literatura Actual
                      </span>
                      <p className="text-brand-text-muted leading-relaxed font-serif">
                        {analysis.especificosCientificos.limitacionesCientificas}
                      </p>
                    </div>

                    {analysis.especificosCientificos.estudiosContradictorios?.length > 0 && (
                      <div className="space-y-1.5 text-xs">
                        <span className="font-bold text-sem-sky uppercase tracking-wider text-[11px]">
                          Estudios de Contraste o Hallazgos Divergentes
                        </span>
                        <ul className="list-disc pl-5 text-brand-text-muted space-y-1 font-mono text-[11px]">
                          {analysis.especificosCientificos.estudiosContradictorios.map((est, idx) => (
                            <li key={idx}>{est}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Multidisciplinary Grid with Relevance Filter */}
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-widest text-brand-gold">
                        Análisis Holístico por Disciplina ({filteredDisciplines.length})
                      </h3>
                      <p className="text-xs text-brand-text-muted mt-0.5">
                        Ponderación de mecanismos, datos y principios desde múltiples campos del saber.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-1 bg-brand-bg p-1 rounded-lg border border-brand-border self-start max-w-full no-print">
                      {(["Todas", "Alta", "Media", "Baja"] as const).map((lvl) => (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => setDisciplineFilter(lvl)}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                            disciplineFilter === lvl
                              ? "bg-brand-gold text-slate-950 font-bold"
                              : "text-brand-text-muted hover:text-brand-text"
                          }`}
                        >
                          {lvl}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredDisciplines.map((item, idx) => {
                      const relStyle =
                        item.relevancia === "Alta"
                          ? "bg-sem-emerald-bg text-sem-emerald border-sem-emerald-border"
                          : item.relevancia === "Media"
                          ? "bg-sem-amber-bg text-sem-amber border-sem-amber-border"
                          : "bg-brand-card text-brand-text-muted border-brand-border";

                      return (
                        <div
                          key={idx}
                          className="border border-brand-border rounded-xl p-4 sm:p-5 flex flex-col gap-2.5 bg-brand-bg/50 min-w-0"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-border/60 pb-2">
                            <span className="font-bold text-sm text-brand-text font-serif break-words min-w-0">
                              {item.disciplina}
                            </span>
                            <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border shrink-0 ${relStyle}`}>
                              Relevancia {item.relevancia}
                            </span>
                          </div>
                          <p className="text-xs sm:text-sm text-brand-text-muted leading-relaxed font-serif break-words">
                            {item.analisis}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: PERSPECTIVAS Y CONTRASTE */}
            {activeTab === "comparacion" && (
              <div className="space-y-7">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-brand-gold">
                      Corrientes de Pensamiento y Posturas Contrastadas ({analysis.perspectivas.length})
                    </h3>
                    <p className="text-xs text-brand-text-muted mt-0.5">
                      Evaluación simétrica de argumentos sólidos y vulnerabilidades de cada enfoque.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {analysis.perspectivas.map((pers, idx) => (
                      <div
                        key={idx}
                        className="border border-brand-border rounded-xl p-5 flex flex-col gap-4 bg-brand-bg/50"
                      >
                        <div className="font-bold text-sm text-brand-gold border-b border-brand-border pb-2 font-serif">
                          {pers.nombre}
                        </div>

                        <div className="space-y-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-sem-emerald flex items-center gap-1.5">
                            <ThumbsUp className="w-3.5 h-3.5" />
                            Fortalezas y Evidencia a Favor
                          </span>
                          <ul className="space-y-1.5 pl-4 list-disc text-xs sm:text-sm text-brand-text-muted font-serif leading-relaxed">
                            {pers.fortalezas.map((f, i) => (
                              <li key={i}>{f}</li>
                            ))}
                          </ul>
                        </div>

                        <div className="space-y-2 border-t border-brand-border/60 pt-3">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-sem-rose flex items-center gap-1.5">
                            <ThumbsDown className="w-3.5 h-3.5" />
                            Debilidades, Límites o Sesgos
                          </span>
                          <ul className="space-y-1.5 pl-4 list-disc text-xs sm:text-sm text-brand-text-muted font-serif leading-relaxed">
                            {pers.debilidades.map((d, i) => (
                              <li key={i}>{d}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Comparison Matrix Table */}
                <div className="border border-brand-border rounded-xl overflow-hidden">
                  <div className="bg-brand-bg px-5 py-3 border-b border-brand-border text-xs font-bold uppercase tracking-widest text-brand-gold">
                    Tabla Comparativa Objetiva por Criterio Metodológico
                  </div>
                  <div className="divide-y divide-brand-border text-xs sm:text-sm bg-brand-bg/30">
                    {[
                      { title: "Solidez de Evidencia", val: analysis.comparacionObjetiva.evidencia },
                      { title: "Coherencia Lógica Interna", val: analysis.comparacionObjetiva.coherenciaLogica },
                      { title: "Resultados Observables", val: analysis.comparacionObjetiva.resultadosObservables },
                      { title: "Alineación Ética / Bíblica", val: analysis.comparacionObjetiva.compatibilidadBiblica },
                      { title: "Riesgos Comparados", val: analysis.comparacionObjetiva.riesgos },
                      { title: "Beneficios Esperados", val: analysis.comparacionObjetiva.beneficios },
                      { title: "Limitaciones Conceptuales", val: analysis.comparacionObjetiva.limitaciones },
                    ].map((row, idx) => (
                      <div key={idx} className="grid grid-cols-1 md:grid-cols-4 p-4 gap-2 hover:bg-brand-bg/60 transition">
                        <span className="font-bold text-brand-text md:col-span-1">{row.title}</span>
                        <p className="text-brand-text-muted md:col-span-3 md:pl-4 md:border-l border-brand-border font-serif leading-relaxed">
                          {row.val}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: MATRIZ DE DECISIONES Y SIMULADOR */}
            {activeTab === "decisiones" && (
              <div className="space-y-7">
                <ScenarioSimulator
                  matrix={analysis.matrizDecisiones}
                  recommendation={analysis.recomendacionFinal}
                  topic={topic}
                />

                {/* Final Recommendation Gauge Card */}
                <div className="bg-brand-bg/70 rounded-xl p-5 sm:p-6 flex flex-col md:flex-row items-center gap-6 border border-brand-gold/40">
                  <div className="relative w-28 h-28 flex items-center justify-center shrink-0">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 112 112">
                      <circle
                        cx="56"
                        cy="56"
                        r="46"
                        className="text-brand-card"
                        strokeWidth="8"
                        stroke="currentColor"
                        fill="transparent"
                      />
                      <circle
                        cx="56"
                        cy="56"
                        r="46"
                        className="text-brand-gold"
                        strokeWidth="8"
                        strokeDasharray={2 * Math.PI * 46}
                        strokeDashoffset={
                          2 * Math.PI * 46 * (1 - analysis.recomendacionFinal.nivelConfianza / 100)
                        }
                        strokeLinecap="round"
                        stroke="currentColor"
                        fill="transparent"
                      />
                    </svg>
                    <div className="absolute flex flex-col items-center">
                      <span className="text-2xl font-extrabold text-brand-text font-mono tabular-nums">
                        {analysis.recomendacionFinal.nivelConfianza}%
                      </span>
                      <span className="text-[10px] font-mono tracking-wider text-brand-text-muted uppercase font-bold">
                        Certeza
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 text-center md:text-left">
                    <span className="text-[11px] font-bold uppercase tracking-widest text-brand-gold">
                      Recomendación Final del Sistema
                    </span>
                    <h4 className="text-base sm:text-lg font-bold text-brand-text leading-snug font-serif">
                      {analysis.recomendacionFinal.recomendacion}
                    </h4>
                    <p className="text-xs sm:text-sm text-brand-text-muted font-serif leading-relaxed">
                      {analysis.recomendacionFinal.justificacion}
                    </p>
                    <p className="text-xs text-brand-text-muted pt-1 border-t border-brand-border/60">
                      <strong className="text-brand-gold">Justificación de certeza:</strong>{" "}
                      {analysis.recomendacionFinal.porqueConfianza}
                    </p>
                  </div>
                </div>

                {/* Full Decision Matrix with ALL 6 metrics */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-brand-gold">
                    Matriz Completa de Alternativas Evaluadas ({analysis.matrizDecisiones.length})
                  </h3>

                  <div className="space-y-3.5">
                    {analysis.matrizDecisiones.map((item, idx) => (
                      <div
                        key={idx}
                        className="border border-brand-border rounded-xl p-4 sm:p-5 space-y-4 bg-brand-bg/50"
                      >
                        <div className="flex items-start gap-3 border-b border-brand-border/60 pb-3">
                          <span className="w-6 h-6 rounded-lg bg-brand-card text-brand-gold font-mono font-bold text-xs flex items-center justify-center border border-brand-border shrink-0 tabular-nums">
                            {idx + 1}
                          </span>
                          <h4 className="text-sm sm:text-base font-bold text-brand-text font-serif">
                            {item.alternativa}
                          </h4>
                        </div>

                        {/* 6-attribute clean metric bar */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
                          <div className="bg-brand-card/70 border border-brand-border rounded-lg px-2.5 py-2 min-w-0">
                            <span className="text-[10px] uppercase text-brand-text-muted block">Costo</span>
                            <span className="font-mono font-bold text-brand-text text-[11px] sm:text-xs break-words">{item.costo}</span>
                          </div>
                          <div className="bg-brand-card/70 border border-brand-border rounded-lg px-2.5 py-2 min-w-0">
                            <span className="text-[10px] uppercase text-brand-text-muted block">Tiempo</span>
                            <span className="font-mono font-bold text-brand-text text-[11px] sm:text-xs break-words">{item.tiempo}</span>
                          </div>
                          <div className="bg-brand-card/70 border border-brand-border rounded-lg px-2.5 py-2 min-w-0">
                            <span className="text-[10px] uppercase text-brand-text-muted block">Riesgo</span>
                            <span
                              className={`font-mono font-bold text-[11px] sm:text-xs break-words ${
                                item.riesgo.toLowerCase().includes("alto")
                                  ? "text-sem-rose"
                                  : "text-brand-text"
                              }`}
                            >
                              {item.riesgo}
                            </span>
                          </div>
                          <div className="bg-brand-card/70 border border-brand-border rounded-lg px-2.5 py-2 min-w-0">
                            <span className="text-[10px] uppercase text-brand-text-muted block">Beneficio</span>
                            <span className="font-mono font-bold text-sem-emerald text-[11px] sm:text-xs break-words">{item.beneficio}</span>
                          </div>
                          <div className="bg-brand-card/70 border border-brand-border rounded-lg px-2.5 py-2 min-w-0">
                            <span className="text-[10px] uppercase text-brand-text-muted block">Impacto</span>
                            <span className="font-mono font-bold text-brand-gold text-[11px] sm:text-xs break-words">{item.impacto}</span>
                          </div>
                          <div className="bg-brand-card/70 border border-brand-border rounded-lg px-2.5 py-2 min-w-0">
                            <span className="text-[10px] uppercase text-brand-text-muted block">Factibilidad</span>
                            <span className="font-mono font-bold text-sem-sky text-[11px] sm:text-xs break-words">{item.factibilidad}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs sm:text-sm text-brand-text-muted font-serif leading-relaxed">
                          <div>
                            <span className="font-sans font-bold text-xs text-sem-emerald block mb-1.5">
                              Ventajas y Retorno
                            </span>
                            <ul className="list-disc pl-4 space-y-1">
                              {item.pros.map((p, i) => (
                                <li key={i}>{p}</li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <span className="font-sans font-bold text-xs text-sem-rose block mb-1.5">
                              Desventajas y Fricción
                            </span>
                            <ul className="list-disc pl-4 space-y-1">
                              {item.contras.map((c, i) => (
                                <li key={i}>{c}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: PLAN, RIESGOS Y CHECKLIST */}
            {activeTab === "plan" && (
              <div className="space-y-7">
                {/* Step by Step Roadmap */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-brand-gold">
                    Hoja de Ruta de Implementación ({analysis.planPasoAPaso.length} fases)
                  </h3>
                  <div className="space-y-3">
                    {analysis.planPasoAPaso.map((item, idx) => (
                      <div key={idx} className="flex items-stretch gap-3">
                        <div className="flex flex-col items-center shrink-0">
                          <span className="min-w-[26px] h-7 px-1.5 rounded-lg bg-brand-gold text-slate-950 font-mono font-bold text-xs flex items-center justify-center tabular-nums">
                            {item.paso}
                          </span>
                          {idx < analysis.planPasoAPaso.length - 1 && (
                            <div className="w-px flex-1 bg-brand-border mt-2" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0 bg-brand-bg/60 border border-brand-border rounded-xl p-3.5 sm:p-4 space-y-1">
                          <h4 className="text-sm font-bold text-brand-text font-serif break-words">
                            {item.titulo}
                          </h4>
                          <p className="text-xs sm:text-sm text-brand-text-muted leading-relaxed font-serif break-words">
                            {item.descripcion}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Practical Actions by Horizon */}
                <div className="space-y-3 pt-2 border-t border-brand-border">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-brand-gold">
                    Acciones Prácticas por Horizonte Temporal
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { title: "Inmediatas (Próximas 24h)", val: analysis.accionesPracticas.inmediatas },
                      { title: "Corto Plazo (Esta Semana · 7 días)", val: analysis.accionesPracticas.estaSemana },
                      { title: "Consolidación (Este Mes · 30 días)", val: analysis.accionesPracticas.esteMes },
                      { title: "Sostenibilidad (Largo Plazo)", val: analysis.accionesPracticas.largoPlazo },
                    ].map((block, idx) => (
                      <div key={idx} className="border border-brand-border rounded-xl p-4 space-y-2 bg-brand-bg/50">
                        <span className="text-xs font-bold text-brand-gold block">
                          {block.title}
                        </span>
                        <ul className="space-y-1.5 list-disc pl-4 text-xs sm:text-sm text-brand-text-muted leading-relaxed font-serif">
                          {block.val.map((action, i) => (
                            <li key={i}>{action}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Risks, Prevention & Mitigation Matrix (Previously omitted!) */}
                {analysis.riesgos && analysis.riesgos.length > 0 && (
                  <div className="space-y-3 pt-2 border-t border-brand-border">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-sem-amber flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Matriz de Riesgos, Prevención y Plan de Contingencia ({analysis.riesgos.length})</span>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      {analysis.riesgos.map((r, idx) => (
                        <div
                          key={idx}
                          className="border border-brand-border bg-brand-bg/60 rounded-xl p-4 space-y-3"
                        >
                          <div className="text-xs sm:text-sm font-bold text-brand-text font-serif border-b border-brand-border/60 pb-2">
                            Riesgo {idx + 1}: {r.riesgo}
                          </div>
                          <div className="space-y-2 text-xs">
                            <div>
                              <span className="font-bold text-sem-emerald uppercase tracking-wider text-[10px] block">
                                Medida Preventiva
                              </span>
                              <p className="text-brand-text-muted font-serif leading-relaxed mt-0.5">
                                {r.prevencion}
                              </p>
                            </div>
                            <div>
                              <span className="font-bold text-sem-amber uppercase tracking-wider text-[10px] block">
                                Solución / Contingencia si Ocurre
                              </span>
                              <p className="text-brand-text-muted font-serif leading-relaxed mt-0.5">
                                {r.solucion}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Interactive Stateful Checklist & Common Errors */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-2 border-t border-brand-border">
                  {/* Checklist */}
                  <div className="bg-sem-emerald-bg border border-sem-emerald-border rounded-xl p-5 flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-sem-emerald flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        Lista de Verificación
                      </span>
                      <span className="text-xs font-mono font-bold text-sem-emerald tabular-nums">
                        {checklistDoneCount}/{checklistTotal}
                      </span>
                    </div>

                    <div className="w-full h-1.5 rounded-full bg-brand-bg overflow-hidden">
                      <div
                        className="h-full bg-sem-emerald transition-all duration-300"
                        style={{
                          width: `${checklistTotal > 0 ? (checklistDoneCount / checklistTotal) * 100 : 0}%`,
                        }}
                      />
                    </div>

                    <div className="space-y-2 text-xs sm:text-sm pt-1">
                      {analysis.listaVerificacion.map((item, i) => {
                        const checked = Boolean(checkedItems[i]);
                        return (
                          <label
                            key={i}
                            className={`flex items-start gap-2.5 p-2 rounded-lg cursor-pointer transition ${
                              checked ? "bg-brand-bg/50 text-brand-text-muted line-through" : "text-brand-text hover:bg-brand-bg/30"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setCheckedItems((prev) => ({ ...prev, [i]: !prev[i] }))
                              }
                              className="mt-1 accent-brand-gold rounded cursor-pointer shrink-0"
                            />
                            <span className="font-serif leading-relaxed">{item}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Common errors */}
                  <div className="bg-sem-rose-bg border border-sem-rose-border rounded-xl p-5 flex flex-col gap-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-sem-rose flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4" />
                      Errores Comunes a Evitar ({analysis.erroresComunes.length})
                    </span>
                    <div className="space-y-3 text-xs sm:text-sm">
                      {analysis.erroresComunes.map((item, i) => (
                        <div
                          key={i}
                          className="space-y-1 border-b border-sem-rose-border pb-2.5 last:border-0 last:pb-0"
                        >
                          <div className="font-bold text-sem-rose">Error: "{item.error}"</div>
                          <p className="text-brand-text font-serif leading-relaxed">
                            <strong className="font-sans text-xs">Cómo evitarlo:</strong> {item.comoEvitarlo}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Do vs Don't Behavioral Matrix */}
                <div className="border border-brand-border rounded-xl p-5 bg-brand-bg/40 space-y-4">
                  <span className="text-xs font-bold uppercase tracking-widest text-brand-gold block">
                    Reglas Prácticas de Comportamiento: Qué Hacer vs. Qué Evitar
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs sm:text-sm">
                    <div className="bg-brand-card p-4 rounded-xl border border-brand-border space-y-2">
                      <span className="font-bold text-sem-emerald block">Qué SÍ hacer</span>
                      <ul className="list-disc pl-4 text-brand-text-muted space-y-1 font-serif leading-relaxed">
                        {analysis.resumenFinal.queHacer.map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="bg-brand-card p-4 rounded-xl border border-brand-border space-y-2">
                      <span className="font-bold text-sem-rose block">Qué NO hacer</span>
                      <ul className="list-disc pl-4 text-brand-text-muted space-y-1 font-serif leading-relaxed">
                        {analysis.resumenFinal.queNoHacer.map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  {analysis.resumenFinal.porque && (
                    <p className="text-xs sm:text-sm text-brand-text-muted italic font-serif leading-relaxed">
                      Fundamento: {analysis.resumenFinal.porque}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* TAB 6: AUDITORÍA DE RAZONAMIENTO */}
            {activeTab === "auditoria" && (
              <div className="space-y-6">
                <div className="bg-sem-amber-bg border border-sem-amber-border rounded-xl p-4 sm:p-5 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-sem-amber">
                    <ShieldAlert className="w-4 h-4" />
                    <span>Auditoría Interna y Auto-Refutación Crítica</span>
                  </div>
                  <p className="text-xs sm:text-sm text-brand-text leading-relaxed font-serif">
                    Revisión adversaria donde el motor expone sus propios supuestos implícitos, datos faltantes, evidencia contraria y sesgos cognitivos potenciales antes de consolidar la recomendación.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-brand-text-muted flex items-center gap-1.5">
                      <Glasses className="w-4 h-4 text-brand-gold" />
                      A. Supuestos Adoptados
                    </span>
                    <ul className="space-y-2 text-xs sm:text-sm">
                      {(analysis.auditoriaRazonamiento?.supuestosHechos || []).map((sup, i) => (
                        <li key={i} className="bg-brand-bg/60 p-3.5 rounded-xl border border-brand-border text-brand-text font-serif leading-relaxed">
                          {sup}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-2.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-sem-rose flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4" />
                      B. Evidencia o Argumentos Contradictorios
                    </span>
                    <ul className="space-y-2 text-xs sm:text-sm">
                      {(analysis.auditoriaRazonamiento?.evidenciaContradictoria || []).map((ev, i) => (
                        <li key={i} className="bg-sem-rose-bg p-3.5 rounded-xl border border-sem-rose-border text-brand-text font-serif leading-relaxed">
                          {ev}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-2.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-brand-text-muted flex items-center gap-1.5">
                      <Search className="w-4 h-4 text-brand-gold" />
                      C. Información Faltante para Mayor Certeza
                    </span>
                    <ul className="space-y-2 text-xs sm:text-sm">
                      {(analysis.auditoriaRazonamiento?.informacionFaltante || []).map((inf, i) => (
                        <li key={i} className="bg-brand-bg/60 p-3.5 rounded-xl border border-brand-border text-brand-text font-serif leading-relaxed">
                          {inf}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-brand-bg/50 border border-brand-border rounded-xl p-4 space-y-4">
                    <div className="space-y-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-sem-amber flex items-center gap-1.5">
                        <Activity className="w-4 h-4" />
                        D. Escenarios Donde la Recomendación Falla
                      </span>
                      <ul className="list-disc pl-5 text-xs sm:text-sm text-brand-text-muted space-y-1 font-serif leading-relaxed">
                        {(analysis.auditoriaRazonamiento?.escenariosFalla || []).map((sc, i) => (
                          <li key={i}>{sc}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="space-y-2 border-t border-brand-border pt-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-brand-gold flex items-center gap-1.5">
                        <RotateCcw className="w-4 h-4" />
                        E. Disparadores que Obligarían a Cambiar de Postura
                      </span>
                      <ul className="list-disc pl-5 text-xs sm:text-sm text-brand-text-muted space-y-1 font-serif leading-relaxed">
                        {(analysis.auditoriaRazonamiento?.disparadoresCambio || []).map((disp, i) => (
                          <li key={i}>{disp}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Cognitive Biases */}
                <div className="space-y-3 pt-2 border-t border-brand-border">
                  <span className="text-xs font-bold uppercase tracking-wider text-brand-gold flex items-center gap-1.5">
                    <Brain className="w-4 h-4" />
                    F. Mapa de Sesgos Cognitivos Evaluados
                  </span>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(analysis.auditoriaRazonamiento?.sesgosCognitivos || []).map((s, i) => (
                      <div
                        key={i}
                        className="border border-brand-border rounded-xl p-4 bg-brand-bg/50 space-y-2"
                      >
                        <div className="font-bold text-brand-gold text-sm flex items-center gap-1.5 font-serif">
                          <ShieldAlert className="w-4 h-4 shrink-0" />
                          <span>{s.sesgo}</span>
                        </div>
                        <p className="text-xs text-brand-text-muted font-mono">{s.descripcion}</p>
                        <p className="text-xs sm:text-sm text-brand-text pl-3 border-l-2 border-brand-gold/40 font-serif leading-relaxed">
                          <strong className="font-sans text-[11px] uppercase tracking-wider text-brand-gold block">
                            Impacto en este análisis
                          </strong>
                          {s.comoAfecta}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 7: TEST DIAGNÓSTICO */}
            {activeTab === "test" && (
              <div>
                {analysis.testDiagnostico ? (
                  <DiagnosticTestView test={analysis.testDiagnostico} topic={topic} />
                ) : (
                  <div className="p-8 text-center text-brand-text-muted font-serif italic text-sm">
                    El test de autoevaluación diagnóstica no está disponible para este registro.
                  </div>
                )}
              </div>
            )}

            {/* TAB 8: TEOLOGÍA Y EXÉGESIS */}
            {activeTab === "teologia" && analysis.teologiaEvangelica && (
              <div className="space-y-6">
                <div className="bg-brand-bg/70 border border-brand-gold/30 rounded-xl p-5 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-brand-gold">
                    <BookOpen className="w-4 h-4" />
                    <span>Discernimiento Teológico, Pastoral y Léxico Original</span>
                  </div>
                  <p className="text-xs sm:text-sm text-brand-text-muted leading-relaxed font-serif">
                    Evaluación de motivaciones humanas, impacto comunitario, marco bíblico redentor y estudio de vocablos en hebreo y griego cuando aplica.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="border border-brand-border bg-brand-bg/50 p-5 rounded-xl space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-brand-gold border-b border-brand-border pb-2 flex items-center gap-2">
                      <Brain className="w-4 h-4" />
                      <span>1. Motivos del Corazón</span>
                    </h4>
                    <div className="space-y-3 text-xs sm:text-sm">
                      <div>
                        <span className="font-bold text-brand-text text-xs block mb-1">Motivos subyacentes:</span>
                        <ul className="list-disc pl-5 text-brand-text-muted space-y-1 font-serif">
                          {analysis.teologiaEvangelica.evaluacionMotivosCorazon.motivosSubyacentes.map((m, i) => (
                            <li key={i}>{m}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="pt-2 border-t border-brand-border/60">
                        <span className="font-bold text-sem-rose text-xs block mb-1.5">Ídolos funcionales en juego:</span>
                        <ul className="list-disc pl-5 text-brand-text-muted space-y-1 font-serif">
                          {analysis.teologiaEvangelica.evaluacionMotivosCorazon.posiblesIdolosCorazon.map((idolo, i) => (
                            <li key={i}>{idolo}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="bg-brand-card p-3.5 rounded-lg border border-brand-border italic font-serif text-brand-text-muted leading-relaxed">
                        <span className="font-sans not-italic font-bold text-brand-gold text-[10px] uppercase tracking-wider block mb-1">
                          Consejo Pastoral
                        </span>
                        "{analysis.teologiaEvangelica.evaluacionMotivosCorazon.consejoPastoralDeseos}"
                      </div>
                    </div>
                  </div>

                  <div className="border border-brand-border bg-brand-bg/50 p-5 rounded-xl space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-brand-gold border-b border-brand-border pb-2 flex items-center gap-2">
                      <Activity className="w-4 h-4" />
                      <span>2. Impacto Comunitario y Pastoral</span>
                    </h4>
                    <div className="space-y-3.5 text-xs sm:text-sm">
                      <div>
                        <span className="font-bold text-brand-text text-xs block mb-1">Servicio y comunidad local:</span>
                        <p className="text-brand-text-muted font-serif leading-relaxed">
                          {analysis.teologiaEvangelica.impactoEclesiologicoPastoral.servicioYComunidad}
                        </p>
                      </div>
                      <div className="pt-2.5 border-t border-brand-border/60">
                        <span className="font-bold text-brand-text text-xs block mb-1">Testimonio público:</span>
                        <p className="text-brand-text-muted font-serif leading-relaxed">
                          {analysis.teologiaEvangelica.impactoEclesiologicoPastoral.testimonioPublico}
                        </p>
                      </div>
                      <div className="pt-2.5 border-t border-brand-border/60">
                        <span className="font-bold text-brand-text text-xs block mb-1">Discipulado personal y familiar:</span>
                        <p className="text-brand-text-muted font-serif leading-relaxed">
                          {analysis.teologiaEvangelica.impactoEclesiologicoPastoral.discipuladoYFamilia}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Redemptive Framework */}
                <div className="border border-brand-border bg-brand-bg/50 p-5 rounded-xl space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-brand-gold border-b border-brand-border pb-2 flex items-center gap-2">
                    <Compass className="w-4 h-4" />
                    <span>3. Marco Redentor en 4 Actos</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                    {[
                      { title: "Creación (Diseño)", content: analysis.teologiaEvangelica.marcoRedentorCristocentrico.creacion },
                      { title: "Caída (Distorsión)", content: analysis.teologiaEvangelica.marcoRedentorCristocentrico.caida },
                      { title: "Redención (Gracia)", content: analysis.teologiaEvangelica.marcoRedentorCristocentrico.redencion },
                      { title: "Consumación (Esperanza)", content: analysis.teologiaEvangelica.marcoRedentorCristocentrico.consumacion },
                    ].map((stage, idx) => (
                      <div key={idx} className="bg-brand-card border border-brand-border rounded-xl p-4 space-y-1.5">
                        <div className="font-bold text-brand-text text-xs font-serif border-b border-brand-border/60 pb-1.5">
                          {stage.title}
                        </div>
                        <p className="text-xs text-brand-text-muted leading-relaxed font-serif">
                          {stage.content}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="bg-brand-gold/10 border border-brand-gold/30 rounded-xl p-4 text-xs sm:text-sm">
                    <span className="font-bold text-brand-gold uppercase tracking-wider text-[10px] block mb-1">
                      Conexión con el Evangelio de la Gracia
                    </span>
                    <p className="text-brand-text font-serif leading-relaxed">
                      {analysis.teologiaEvangelica.marcoRedentorCristocentrico.conexionEvangelio}
                    </p>
                  </div>
                </div>

                {/* Original Languages Concordance */}
                {analysis.teologiaEvangelica.concordanciaOriginal &&
                  analysis.teologiaEvangelica.concordanciaOriginal.length > 0 && (
                    <div className="border border-brand-border bg-brand-bg/50 p-5 rounded-xl space-y-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-brand-gold border-b border-brand-border pb-2 flex items-center gap-2">
                        <BookMarked className="w-4 h-4" />
                        <span>4. Concordancia Dinámica en Hebreo y Griego</span>
                      </h4>
                      <div className="space-y-4">
                        {analysis.teologiaEvangelica.concordanciaOriginal.map((pasaje, pIdx) => (
                          <div key={pIdx} className="bg-brand-card border border-brand-border rounded-xl p-4 space-y-4">
                            <div className="flex items-center justify-between border-b border-brand-border/60 pb-2">
                              <span className="font-serif font-bold text-sm text-brand-gold">{pasaje.pasaje}</span>
                              <span className="text-[11px] font-mono text-brand-text-muted">Idiomas Bíblicos</span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                              {pasaje.palabrasOriginales.map((p, wIdx) => (
                                <div
                                  key={wIdx}
                                  className="bg-brand-bg/60 border border-brand-border rounded-xl p-3.5 space-y-2 min-w-0"
                                >
                                  <div className="flex flex-wrap items-baseline justify-between gap-1.5 border-b border-brand-border/50 pb-1.5">
                                    <span className="font-serif text-lg font-bold text-brand-gold break-words">{p.palabra}</span>
                                    <span className="text-[11px] font-mono font-bold text-sem-rose shrink-0">
                                      {p.strong}
                                    </span>
                                  </div>
                                  <div className="text-[11px] space-y-0.5 font-mono text-brand-text-muted break-words">
                                    <div>
                                      Pronunciación: <strong className="text-brand-text italic">{p.transliteracion}</strong>
                                    </div>
                                    <div>
                                      Idioma: <strong className="text-brand-text">{p.idioma}</strong>
                                    </div>
                                    <div>
                                      Literal: <strong className="text-brand-text font-serif">"{p.traduccionLiteral}"</strong>
                                    </div>
                                  </div>
                                  <p className="text-xs text-brand-text-muted leading-relaxed font-serif pt-1.5 border-t border-brand-border/40 break-words">
                                    {p.significadoTeologico}
                                  </p>
                                </div>
                              ))}
                            </div>

                            <div className="bg-brand-bg/40 border border-brand-border/60 rounded-lg p-3 text-xs font-serif italic text-brand-text-muted leading-relaxed">
                              <strong className="not-italic font-sans text-brand-gold text-[10px] uppercase tracking-wider block mb-1">
                                Nota Hermenéutica
                              </strong>
                              "{pasaje.contextoExegetico}"
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            )}

            {activeTab === "teologia" && !analysis.teologiaEvangelica && (
              <div className="p-8 rounded-xl border border-brand-border bg-brand-bg/40 text-xs sm:text-sm text-brand-text-muted font-serif text-center">
                Este análisis guardado no contiene el módulo teológico detallado. Ejecuta un nuevo análisis si deseas incluirlo.
              </div>
            )}

            {/* TAB 9: BIBLIOTECA DE RECURSOS */}
            {activeTab === "recursos" && (
              <ResourcesLibraryPanel
                resources={analysis.recursosRecomendados}
                groupFilter={resourceGroupFilter}
                onGroupFilterChange={setResourceGroupFilter}
                search={resourceSearch}
                onSearchChange={setResourceSearch}
              />
            )}

            {/* Sequential Step Footer Navigation */}
            <div className="pt-5 mt-6 border-t border-brand-border flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 no-print">
              {prevStepItem ? (
                <button
                  type="button"
                  onClick={() => onTabChange(prevStepItem.id)}
                  className="w-full sm:w-auto px-3.5 py-2.5 rounded-xl border border-brand-border bg-brand-bg hover:border-brand-gold/50 text-xs font-semibold text-brand-text flex items-center justify-center sm:justify-start gap-2 transition cursor-pointer min-w-0"
                >
                  <ChevronLeft className="w-4 h-4 text-brand-gold shrink-0" />
                  <span className="truncate">
                    Paso {prevStepItem.stepNum}: {prevStepItem.label}
                  </span>
                </button>
              ) : (
                <div className="hidden sm:block" />
              )}

              {nextStepItem && (
                <button
                  type="button"
                  onClick={() => onTabChange(nextStepItem.id)}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-brand-gold hover:bg-brand-gold-hover text-slate-950 text-xs font-bold flex items-center justify-center sm:justify-end gap-2 transition cursor-pointer min-w-0 sm:ml-auto"
                >
                  <span className="truncate">
                    Siguiente ({nextStepItem.stepNum}): {nextStepItem.label}
                  </span>
                  <ChevronRight className="w-4 h-4 shrink-0" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Persistent Quick Access Shelf to Resources when reading other tabs */}
      {activeTab !== "recursos" && totalResourcesCount > 0 && (
        <div className="bg-brand-card rounded-2xl border border-brand-border p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-brand-border pb-3">
            <div className="flex items-center gap-2">
              <Library className="w-4 h-4 text-brand-gold" />
              <h3 className="text-xs font-bold uppercase tracking-widest text-brand-text">
                Biblioteca de Recursos de Soporte y Herramientas ({totalResourcesCount})
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onTabChange("recursos")}
              className="text-xs font-bold text-brand-gold hover:underline cursor-pointer self-start sm:self-auto"
            >
              Ver biblioteca filtrable completa →
            </button>
          </div>
          <ResourcesLibraryPanel
            resources={analysis.recursosRecomendados}
            groupFilter="todos"
            onGroupFilterChange={() => {}}
            search=""
            onSearchChange={() => {}}
            compact
          />
        </div>
      )}
    </div>
  );
};

interface ResourcesLibraryPanelProps {
  resources: ComprehensiveAnalysisResponse["recursosRecomendados"];
  groupFilter: "todos" | "lectura" | "multimedia" | "herramientas";
  onGroupFilterChange: (val: "todos" | "lectura" | "multimedia" | "herramientas") => void;
  search: string;
  onSearchChange: (val: string) => void;
  compact?: boolean;
}

const ResourcesLibraryPanel: React.FC<ResourcesLibraryPanelProps> = ({
  resources,
  groupFilter,
  onGroupFilterChange,
  search,
  onSearchChange,
  compact = false,
}) => {
  const sections: Array<{
    title: string;
    category: ResourceCategory;
    group: "lectura" | "multimedia" | "herramientas";
    icon: typeof BookOpen;
    items: ResourceItem[];
    showAuthor?: boolean;
  }> = [
    { title: "Libros y Monografías", category: "libros", group: "lectura", icon: BookOpen, items: resources.libros || [], showAuthor: true },
    { title: "Artículos Científicos y Papers", category: "articulos", group: "lectura", icon: FileText, items: resources.articulos || [] },
    { title: "Sitios Web Oficiales y Portales", category: "sitiosWeb", group: "multimedia", icon: Globe, items: resources.sitiosWeb || [] },
    { title: "Cursos y Especializaciones", category: "cursos", group: "multimedia", icon: GraduationCap, items: resources.cursos || [] },
    { title: "Videos y Conferencias", category: "videos", group: "multimedia", icon: Video, items: resources.videos || [] },
    { title: "Herramientas y Marcos", category: "herramientas", group: "herramientas", icon: Wrench, items: resources.herramientas || [] },
    { title: "Software y Aplicaciones", category: "software", group: "herramientas", icon: LayoutTemplate, items: resources.software || [] },
    { title: "Inteligencia Artificial", category: "ias", group: "herramientas", icon: Cpu, items: resources.ias || [] },
    { title: "Plantillas y Frameworks", category: "plantillas", group: "herramientas", icon: Layers, items: resources.plantillas || [] },
  ];

  const q = search.trim().toLowerCase();
  const visibleSections = sections.filter((sec) => {
    if (sec.items.length === 0) return false;
    if (!compact && groupFilter !== "todos" && sec.group !== groupFilter) return false;
    if (!q) return true;
    return sec.items.some(
      (item) =>
        item.titulo.toLowerCase().includes(q) ||
        (item.autor || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-5">
      {!compact && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-brand-border pb-4">
          <div className="flex flex-wrap items-center gap-1 bg-brand-bg p-1 rounded-lg border border-brand-border w-full sm:w-auto max-w-full">
            {[
              { id: "todos", label: "Todos" },
              { id: "lectura", label: "Libros y Papers" },
              { id: "multimedia", label: "Portales, Cursos y Videos" },
              { id: "herramientas", label: "Herramientas, Software e IA" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => onGroupFilterChange(tab.id as any)}
                className={`px-2.5 sm:px-3 py-1.5 rounded-md text-[11px] sm:text-xs font-semibold transition cursor-pointer ${
                  groupFilter === tab.id
                    ? "bg-brand-gold text-slate-950 font-bold"
                    : "text-brand-text-muted hover:text-brand-text"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64 shrink-0">
            <Search className="w-3.5 h-3.5 text-brand-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Buscar recurso o autor..."
              className="w-full pl-8 pr-3 py-2 sm:py-1.5 bg-brand-bg border border-brand-border rounded-lg text-xs text-brand-text placeholder-brand-text-muted/60 focus:outline-none focus:border-brand-gold"
            />
          </div>
        </div>
      )}

      {visibleSections.length === 0 ? (
        <div className="p-6 text-center text-xs text-brand-text-muted border border-dashed border-brand-border rounded-xl">
          No se encontraron recursos que coincidan con el filtro aplicado.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {visibleSections.map((sec) => {
            const SecIcon = sec.icon;
            const filteredItems = q
              ? sec.items.filter(
                  (item) =>
                    item.titulo.toLowerCase().includes(q) ||
                    (item.autor || "").toLowerCase().includes(q)
                )
              : sec.items;

            return (
              <div key={sec.category} className="space-y-2.5 min-w-0">
                <div className="flex items-center justify-between gap-2 border-b border-brand-border pb-1.5 text-xs font-bold text-brand-text">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <SecIcon className="w-3.5 h-3.5 text-brand-gold shrink-0" />
                    <span className="truncate">{sec.title}</span>
                  </span>
                  <span className="font-mono text-[11px] text-brand-text-muted tabular-nums shrink-0">
                    {filteredItems.length}
                  </span>
                </div>

                <ul className="space-y-2">
                  {filteredItems.map((item, i) => {
                    const resolved = resolveResourceLink(sec.category, item);
                    return (
                      <li key={`${sec.category}-${i}`} className="min-w-0">
                        <a
                          href={resolved.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group flex items-start justify-between gap-2.5 rounded-xl border border-brand-border bg-brand-bg/50 hover:bg-brand-card-light/40 hover:border-brand-gold/60 px-3 py-2.5 transition min-w-0 w-full"
                        >
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="font-serif text-xs text-brand-text group-hover:text-brand-gold group-hover:underline leading-snug break-words">
                              {sec.showAuthor ? (
                                <>
                                  <span className="italic">"{item.titulo}"</span>
                                  {item.autor ? ` — ${item.autor}` : ""}
                                </>
                              ) : (
                                item.titulo
                              )}
                            </div>
                            <div className="text-[10px] font-mono text-brand-text-muted flex items-center gap-1.5 truncate">
                              <span
                                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                  resolved.isDirect ? "bg-sem-emerald" : "bg-brand-gold"
                                }`}
                              />
                              <span className="truncate">
                                {resolved.isDirect ? `Directo · ${resolved.label}` : `Buscar en ${resolved.label}`}
                              </span>
                            </div>
                          </div>
                          <ExternalLink className="w-3.5 h-3.5 text-brand-gold/80 group-hover:text-brand-gold shrink-0 mt-0.5" />
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
