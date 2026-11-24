import React, { useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  History,
  X,
  Search,
  Star,
  Trash2,
  ArrowUpRight,
  Download,
  AlertTriangle,
} from "lucide-react";
import { ComprehensiveAnalysisResponse } from "../types";

export interface HistoryEntry {
  id: string;
  topic: string;
  focusType: string;
  tradition?: string;
  timestamp: string;
  favorite?: boolean;
  notes?: string;
  data: ComprehensiveAnalysisResponse;
}

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  history: HistoryEntry[];
  onSelect: (entry: HistoryEntry) => void;
  onToggleFavorite: (id: string, e: React.MouseEvent) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  onClearAll: () => void;
}

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({
  isOpen,
  onClose,
  history,
  onSelect,
  onToggleFavorite,
  onDelete,
  onClearAll,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "favorites">("all");
  const [confirmClear, setConfirmClear] = useState(false);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return history.filter((item) => {
      if (filterMode === "favorites" && !item.favorite) return false;
      if (!q) return true;
      return (
        item.topic.toLowerCase().includes(q) ||
        item.focusType.toLowerCase().includes(q) ||
        (item.tradition || "").toLowerCase().includes(q)
      );
    });
  }, [history, searchQuery, filterMode]);

  const handleExportJson = () => {
    if (history.length === 0) return;
    const blob = new Blob([JSON.stringify(history, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `historial_analisis_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      className="bg-brand-card rounded-2xl border border-brand-border p-4 sm:p-6 overflow-hidden shadow-xl min-w-0"
    >
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-brand-border pb-4 mb-4">
        <div className="flex items-start justify-between gap-2.5 min-w-0">
          <div className="flex items-start sm:items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-brand-bg border border-brand-border flex items-center justify-center text-brand-gold shrink-0">
              <History className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-brand-text font-serif">
                Archivo de Consultas ({history.length})
              </h3>
              <p className="text-[11px] text-brand-text-muted leading-snug">
                Almacenamiento local persistente para retomar reportes completos al instante.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="sm:hidden min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-brand-text-muted hover:bg-brand-card-light hover:text-brand-text transition cursor-pointer shrink-0"
            aria-label="Cerrar historial"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {history.length > 0 && (
            <>
              <button
                type="button"
                onClick={handleExportJson}
                className="px-3 py-1.5 rounded-lg border border-brand-border bg-brand-bg hover:bg-brand-card-light text-xs font-semibold text-brand-text flex items-center gap-1.5 transition cursor-pointer"
                title="Descargar respaldo JSON del historial"
              >
                <Download className="w-3.5 h-3.5 text-brand-gold" />
                <span>Respaldar JSON</span>
              </button>

              {!confirmClear ? (
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  className="px-3 py-1.5 rounded-lg border border-sem-rose-border bg-sem-rose-bg text-sem-rose hover:opacity-90 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Vaciar</span>
                </button>
              ) : (
                <div className="flex flex-wrap items-center gap-1.5 bg-sem-rose-bg border border-sem-rose-border px-2.5 py-1 rounded-lg">
                  <AlertTriangle className="w-3.5 h-3.5 text-sem-rose shrink-0" />
                  <span className="text-[11px] font-semibold text-sem-rose">¿Confirmar?</span>
                  <button
                    type="button"
                    onClick={() => {
                      onClearAll();
                      setConfirmClear(false);
                    }}
                    className="px-2 py-0.5 rounded bg-brand-card text-sem-rose text-[11px] font-bold border border-sem-rose-border cursor-pointer"
                  >
                    Sí, borrar
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClear(false)}
                    className="px-2 py-0.5 rounded text-brand-text-muted hover:text-brand-text text-[11px] font-semibold cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </>
          )}

          <button
            type="button"
            onClick={onClose}
            className="hidden sm:flex p-2 rounded-lg text-brand-text-muted hover:bg-brand-card-light hover:text-brand-text transition cursor-pointer"
            aria-label="Cerrar historial"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search & Filter Row */}
      {history.length > 0 && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-brand-text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por tema, categoría o marco..."
              className="w-full pl-9 pr-3 py-2 bg-brand-bg border border-brand-border rounded-lg text-xs text-brand-text placeholder-brand-text-muted/60 focus:outline-none focus:border-brand-gold"
            />
          </div>

          <div className="flex items-center gap-1 bg-brand-bg p-1 rounded-lg border border-brand-border w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setFilterMode("all")}
              className={`flex-1 sm:flex-initial px-3 py-1.5 sm:py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                filterMode === "all"
                  ? "bg-brand-gold text-slate-950 font-bold"
                  : "text-brand-text-muted hover:text-brand-text"
              }`}
            >
              Todos ({history.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode("favorites")}
              className={`flex-1 sm:flex-initial px-3 py-1.5 sm:py-1 rounded-md text-xs font-semibold flex items-center justify-center gap-1 transition cursor-pointer ${
                filterMode === "favorites"
                  ? "bg-brand-gold text-slate-950 font-bold"
                  : "text-brand-text-muted hover:text-brand-text"
              }`}
            >
              <Star className="w-3 h-3 shrink-0" />
              <span>Favoritos ({history.filter((h) => h.favorite).length})</span>
            </button>
          </div>
        </div>
      )}

      {/* Results Grid */}
      {filtered.length === 0 ? (
        <div className="py-8 text-center text-xs text-brand-text-muted border border-dashed border-brand-border rounded-xl bg-brand-bg/40">
          {history.length === 0
            ? "Aún no hay consultas guardadas. Cada análisis generado se archiva automáticamente aquí."
            : "No hay consultas que coincidan con tu búsqueda o filtro."}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[65vh] md:max-h-[380px] overflow-y-auto pr-1">
          {filtered.map((h) => (
            <div
              key={h.id}
              onClick={() => onSelect(h)}
              className="text-left bg-brand-bg/70 border border-brand-border rounded-xl p-3.5 hover:border-brand-gold/50 hover:bg-brand-card-light/30 cursor-pointer transition relative group flex flex-col justify-between gap-2.5"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-[11px] text-brand-text-muted">
                  <span className="font-bold text-brand-gold truncate">{h.focusType}</span>
                  <span className="font-mono tabular-nums shrink-0">{h.timestamp.split(",")[0]}</span>
                </div>
                <p className="text-xs font-semibold text-brand-text line-clamp-2 leading-relaxed">
                  {h.topic}
                </p>
                {h.tradition && h.tradition !== "General / Neutral (Sin Sesgo)" && (
                  <p className="text-[11px] text-brand-text-muted truncate font-serif italic">
                    Marco: {h.tradition}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-brand-border/50 text-[11px]">
                <span className="text-brand-gold font-semibold flex items-center gap-1 group-hover:underline">
                  Abrir reporte
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </span>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={(e) => onToggleFavorite(h.id, e)}
                    className={`p-1.5 rounded-md transition cursor-pointer ${
                      h.favorite
                        ? "text-brand-gold bg-brand-gold/10"
                        : "text-brand-text-muted hover:text-brand-gold"
                    }`}
                    title={h.favorite ? "Quitar de favoritos" : "Marcar como favorito"}
                  >
                    <Star className={`w-3.5 h-3.5 ${h.favorite ? "fill-current" : ""}`} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => onDelete(h.id, e)}
                    className="p-1.5 rounded-md text-brand-text-muted hover:text-sem-rose hover:bg-sem-rose-bg transition cursor-pointer"
                    title="Eliminar consulta"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
};
