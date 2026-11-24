import React from "react";
import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "../hooks/useOnlineStatus";

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-20 md:bottom-4 left-4 right-4 md:right-auto z-50 flex items-center gap-2.5 rounded-xl bg-amber-950/95 border border-amber-500/50 px-3.5 py-2.5 text-xs font-semibold text-amber-200 shadow-xl backdrop-blur-md"
    >
      <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
      <span>Modo sin conexión — Puedes consultar tu historial guardado localmente.</span>
    </div>
  );
};
