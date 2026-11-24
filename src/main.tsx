import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

function showFatalFallback(reason: string) {
  const rootEl = document.getElementById('root');
  if (!rootEl || rootEl.childElementCount > 0) return;

  rootEl.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:#101813;color:#e5eee7;font-family:system-ui,sans-serif;">
      <div style="max-width:440px;width:100%;background:#16221a;border:1px solid #2e4a38;border-radius:14px;padding:24px;text-align:center;">
        <h1 style="font-size:18px;font-weight:700;margin:0 0 8px;color:#6ec98f;">No se pudo cargar la vista</h1>
        <p id="sai-fatal-msg" style="font-size:13px;opacity:0.85;margin:0 0 16px;line-height:1.5;"></p>
        <button id="sai-fatal-reset" type="button" style="background:#6ec98f;color:#101813;font-weight:700;font-size:13px;padding:10px 18px;border-radius:8px;border:none;cursor:pointer;">
          Restablecer y recargar
        </button>
      </div>
    </div>
  `;
  const msgEl = document.getElementById('sai-fatal-msg');
  if (msgEl) msgEl.textContent = reason;
  document.getElementById('sai-fatal-reset')?.addEventListener('click', () => {
    try {
      localStorage.removeItem('comprehensive_analysis_history');
      localStorage.removeItem('eye_care_theme');
    } catch {
      // ignore
    }
    window.location.reload();
  });
}

window.addEventListener('error', (event) => {
  showFatalFallback(event.message || 'Error inesperado al iniciar la interfaz.');
});

if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    registerSW({
      immediate: true,
      onRegisterError(error) {
        console.warn('[PWA] Registro de Service Worker omitido:', error);
      },
    });
  } else {
    // In dev preview, clean up any stale Service Worker / Workbox cache from prior sessions
    navigator.serviceWorker
      .getRegistrations()
      .then(async (regs) => {
        if (regs.length === 0) return;
        const hadController = !!navigator.serviceWorker.controller;
        await Promise.all(regs.map((r) => r.unregister()));
        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
        if (hadController) {
          try {
            if (!sessionStorage.getItem('sai_dev_sw_cleaned')) {
              sessionStorage.setItem('sai_dev_sw_cleaned', '1');
              window.location.reload();
            }
          } catch {
            // ignore
          }
        }
      })
      .catch(() => {
        // ignore
      });
  }
}

try {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
} catch (err: any) {
  showFatalFallback(err?.message || 'Error al montar la aplicación.');
}
