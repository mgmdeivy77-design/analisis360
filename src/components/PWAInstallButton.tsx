import React, { useState } from "react";
import { Download, Smartphone, X, CheckCircle2, Share2, MoreVertical } from "lucide-react";
import { usePWAInstall } from "../hooks/usePWAInstall";

interface PWAInstallButtonProps {
  compact?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handlePress = async () => {
    if (isInstallable) {
      const ok = await install();
      if (!ok) return;
    } else {
      setShowGuide(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handlePress}
        className={`flex items-center justify-center gap-1.5 rounded-lg border border-brand-gold/50 bg-brand-gold/15 hover:bg-brand-gold text-brand-gold hover:text-slate-950 font-bold transition cursor-pointer whitespace-nowrap shrink-0 active:scale-[0.98] ${
          compact
            ? "min-h-[40px] px-2.5 py-1.5 text-[11px]"
            : "min-h-[44px] px-3.5 py-2 text-xs"
        }`}
        title="Instalar como aplicación en Android / Samsung"
        id="pwa-install-btn"
      >
        {isAndroid || !compact ? (
          <Smartphone className="w-3.5 h-3.5 shrink-0" />
        ) : (
          <Download className="w-3.5 h-3.5 shrink-0" />
        )}
        <span>{isInstallable ? "Instalar App" : compact ? "Instalar" : "Instalar en Teléfono"}</span>
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/65 backdrop-blur-sm p-0 sm:p-4"
          onClick={() => setShowGuide(false)}
        >
          <div
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-brand-card border border-brand-gold/40 p-6 pb-8 sm:pb-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile bottom sheet handle */}
            <div className="w-10 h-1.5 bg-brand-border rounded-full mx-auto -mt-2 mb-1 sm:hidden" />

            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-brand-gold/15 border border-brand-gold/30 text-brand-gold">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-brand-text font-serif">
                    Instalar como App Nativa
                  </h3>
                  <p className="text-xs text-brand-text-muted">
                    {isIOS ? "Instrucciones para iPhone / iPad" : "Optimizado para Samsung Galaxy A57 y Android"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-brand-text-muted hover:text-brand-text hover:bg-brand-card-light transition cursor-pointer"
                aria-label="Cerrar guía de instalación"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isIOS ? (
              <ol className="space-y-2.5 text-xs text-brand-text leading-relaxed bg-brand-bg/70 p-4 rounded-xl border border-brand-border">
                <li className="flex items-start gap-2">
                  <Share2 className="w-4 h-4 text-brand-gold shrink-0 mt-0.5" />
                  <span>1. Toca el botón <strong>Compartir</strong> en la barra inferior de Safari.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-brand-gold shrink-0 mt-0.5" />
                  <span>2. Desliza y selecciona <strong>Agregar a inicio</strong>.</span>
                </li>
              </ol>
            ) : (
              <div className="space-y-3 text-xs text-brand-text leading-relaxed bg-brand-bg/70 p-4 rounded-xl border border-brand-border">
                <p className="text-brand-text-muted">
                  Cuando abras tu URL publicada de Vercel en tu <strong>Samsung A57</strong>:
                </p>
                <ol className="space-y-2.5">
                  <li className="flex items-start gap-2">
                    <MoreVertical className="w-4 h-4 text-brand-gold shrink-0 mt-0.5" />
                    <span>
                      <strong>En Chrome:</strong> Toca el menú <strong>(⋮)</strong> arriba a la derecha y selecciona <strong>"Instalar aplicación"</strong> o <strong>"Añadir a pantalla de inicio"</strong>.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Download className="w-4 h-4 text-brand-gold shrink-0 mt-0.5" />
                    <span>
                      <strong>En Samsung Internet:</strong> Toca el icono de descarga en la barra de direcciones o el menú <strong>(≡) → Añadir página a → Pantalla de inicio</strong>.
                    </span>
                  </li>
                </ol>
                <p className="text-[11px] text-brand-gold/90 pt-1 border-t border-brand-border/50">
                  Se instalará en tu cajón de aplicaciones sin barra del navegador, con icono propio y bloqueo privado.
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="w-full min-h-[46px] rounded-xl bg-brand-gold text-slate-950 font-bold text-sm hover:bg-brand-gold-hover transition cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
};
