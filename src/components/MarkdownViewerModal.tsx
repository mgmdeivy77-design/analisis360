import React, { useState, useRef } from "react";
import { X, Upload, Clipboard, BookOpen, AlertCircle, FileText, Check } from "lucide-react";
import MarkdownRenderer from "./MarkdownRenderer";

interface MarkdownViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentReportMarkdown?: string;
}

export default function MarkdownViewerModal({
  isOpen,
  onClose,
  currentReportMarkdown
}: MarkdownViewerModalProps) {
  const [mdContent, setMdContent] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [mobilePanel, setMobilePanel] = useState<"editor" | "preview">("preview");
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleFile = (file: File) => {
    if (!file.name.endsWith(".md") && !file.name.endsWith(".txt")) {
      showNotification("Por favor, sube un archivo con extensión .md o .txt");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setMdContent(text);
      setFileName(file.name);
      showNotification(`¡Archivo "${file.name}" cargado con éxito!`);
    };
    reader.onerror = () => {
      showNotification("Error al leer el archivo.");
    };
    reader.readAsText(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const loadCurrentReport = () => {
    if (currentReportMarkdown) {
      setMdContent(currentReportMarkdown);
      setFileName("Reporte_Actual_Generado.md");
      showNotification("Se cargó el reporte activo actual de la aplicación.");
    } else {
      showNotification("No hay ningún reporte activo generado todavía.");
    }
  };

  const clearViewer = () => {
    setMdContent("");
    setFileName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div 
        className="relative bg-brand-card border border-brand-border rounded-2xl w-full max-w-6xl h-[92dvh] sm:h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header bar */}
        <div className="flex items-start sm:items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b border-brand-border bg-brand-bg/80">
          <div className="flex items-start sm:items-center gap-2.5 min-w-0">
            <BookOpen className="w-5 h-5 text-brand-gold shrink-0 mt-0.5 sm:mt-0" />
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider sm:tracking-widest text-brand-text font-serif leading-snug">
                Visor Interactivo de Reportes Markdown (.md)
              </h2>
              <p className="text-[11px] text-brand-text-muted leading-snug mt-0.5">
                Arrastre un archivo, pegue texto o visualice el reporte generado en tiempo real.
              </p>
            </div>
          </div>
          
          <button 
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl hover:bg-brand-card-light text-brand-text-muted hover:text-brand-text transition shrink-0 cursor-pointer"
            title="Cerrar Visor"
            aria-label="Cerrar Visor"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mobile Panel Switcher */}
        <div className="lg:hidden grid grid-cols-2 gap-1 p-2 bg-brand-bg border-b border-brand-border shrink-0">
          <button
            type="button"
            onClick={() => setMobilePanel("preview")}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition cursor-pointer ${
              mobilePanel === "preview"
                ? "bg-brand-gold text-slate-950"
                : "text-brand-text-muted hover:text-brand-text"
            }`}
          >
            Vista Previa
          </button>
          <button
            type="button"
            onClick={() => setMobilePanel("editor")}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition cursor-pointer ${
              mobilePanel === "editor"
                ? "bg-brand-gold text-slate-950"
                : "text-brand-text-muted hover:text-brand-text"
            }`}
          >
            Subir / Editar .md
          </button>
        </div>

        {/* Floating Notification */}
        {notification && (
          <div className="absolute top-16 left-3 right-3 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-50 bg-brand-gold text-slate-950 px-4 py-2 rounded-lg text-xs font-bold font-serif shadow-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="break-words">{notification}</span>
          </div>
        )}

        {/* Body Workspace Grid */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 overflow-hidden min-h-0">
          
          {/* Left panel: Upload & Input area */}
          <div className={`${mobilePanel === "editor" ? "flex" : "hidden lg:flex"} p-4 sm:p-5 lg:border-r border-brand-border flex-col gap-4 overflow-y-auto min-h-0`}>
            
            {/* Drag and drop target */}
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded p-6 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 ${
                dragActive 
                  ? "border-brand-gold bg-brand-gold/10 text-brand-gold" 
                  : "border-brand-border hover:border-brand-gold/60 text-brand-text-muted hover:text-brand-text"
              }`}
            >
              <Upload className="w-8 h-8 text-brand-gold/80" />
              <div className="text-xs">
                <span className="font-bold text-brand-text">Arrastra y suelta tu archivo .md aquí</span> o haz clic para buscarlo
              </div>
              <p className="text-[10px] text-brand-text-muted/60">Soporta archivos Markdown (.md) y Texto (.txt)</p>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept=".md,.txt" 
                className="hidden" 
              />
            </div>

            {/* Quick Actions Panel */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-brand-bg/50 p-3 rounded border border-brand-border">
              <span className="text-[10px] font-mono text-brand-text-muted font-bold">
                {fileName ? `Archivo: ${fileName}` : "Escribe o pega texto abajo:"}
              </span>
              <div className="flex items-center gap-2">
                {currentReportMarkdown && (
                  <button
                    onClick={loadCurrentReport}
                    className="flex items-center gap-1.5 px-3 py-1 bg-brand-gold/10 text-brand-gold hover:bg-brand-gold hover:text-brand-bg border border-brand-gold/30 rounded text-[10px] font-bold uppercase transition"
                    title="Cargar el reporte que se analizó recientemente en el sistema"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Ver reporte activo</span>
                  </button>
                )}
                {mdContent && (
                  <button
                    onClick={clearViewer}
                    className="px-2.5 py-1 bg-sem-rose-bg hover:opacity-90 text-sem-rose border border-sem-rose-border rounded text-[10px] font-bold uppercase transition cursor-pointer"
                  >
                    Limpiar
                  </button>
                )}
              </div>
            </div>

            {/* Markdown Text Area */}
            <div className="flex-1 flex flex-col min-h-[220px]">
              <textarea
                value={mdContent}
                onChange={(e) => setMdContent(e.target.value)}
                placeholder="# Título del Reporte&#10;&#10;## Introducción&#10;Este es un ejemplo de texto en formato *Markdown* que puedes previsualizar directamente aquí...&#10;&#10;* **Rigor**: Alta fidelidad&#10;* **Tipografía**: Lora Serif&#10;&#10;> 'Escribe aquí o arrastra un archivo para comenzar'"
                className="w-full flex-1 p-4 rounded-xl bg-brand-bg text-brand-text border border-brand-border focus:outline-none focus:ring-1 focus:ring-brand-gold/60 text-xs font-mono leading-relaxed resize-none"
              />
            </div>
          </div>

          {/* Right panel: Live Preview rendered area */}
          <div className={`${mobilePanel === "preview" ? "flex" : "hidden lg:flex"} p-4 sm:p-6 bg-brand-bg/30 flex-col overflow-y-auto min-h-0`}>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-border pb-2 mb-4">
              <span className="text-[10px] font-mono uppercase tracking-widest text-brand-gold font-bold">
                Previsualización Estilizada
              </span>
              <span className="text-[10px] text-brand-text-muted font-mono bg-brand-card border border-brand-border px-2 py-0.5 rounded">
                Lora Serif
              </span>
            </div>

            {/* Viewport container */}
            <div className="flex-1 max-w-none p-4 sm:p-6 bg-brand-card/70 border border-brand-border rounded-xl overflow-y-auto selection:bg-brand-gold/20 select-text break-words">
              <MarkdownRenderer content={mdContent} />
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-4 sm:px-6 py-3 border-t border-brand-border bg-brand-bg/80 flex flex-wrap items-center justify-between gap-2 text-[10px] text-brand-text-muted">
          <span>Pulse Esc para salir de este panel interactivo.</span>
          <span>© 2026 Motor de Análisis. Diseñado con tipografía elegante.</span>
        </div>
      </div>
    </div>
  );
}
