// Builds default to isolated fixtures. A release requires an explicit environment.
export const IS_INTEGRATION = import.meta.env.VITE_APP_ENV === 'integration';
export const IS_PREVIEW = import.meta.env.VITE_APP_ENV !== 'production';
export const API_BASE = IS_INTEGRATION ? 'http://127.0.0.1:3007/api' : IS_PREVIEW ? '/api' : import.meta.env.VITE_API_BASE_URL;
export const storage = {
  getItem: key => localStorage.getItem(IS_PREVIEW ? `${IS_INTEGRATION ? "gos-integration" : "gos-preview"}:${key}` : key),
  setItem: (key, value) => localStorage.setItem(IS_PREVIEW ? `${IS_INTEGRATION ? "gos-integration" : "gos-preview"}:${key}` : key, value),
  removeItem: key => localStorage.removeItem(IS_PREVIEW ? `${IS_INTEGRATION ? "gos-integration" : "gos-preview"}:${key}` : key),
};
export function preparePreview() {
  if (!IS_PREVIEW) return;
  // This runs before importing/rendering App, including native plugin code.
  const localFetch = IS_INTEGRATION ? window.fetch.bind(window) : null;
  window.fetch = async (input, options) => {
    if (IS_INTEGRATION) {
      const url = new URL(typeof input === 'string' ? input : input.url, location.href);
      if (url.origin === 'http://127.0.0.1:3007' && url.pathname.startsWith('/api/')) return localFetch(input, options);
    }
    throw new Error('Network requests are disabled in the isolated preview.');
  };
  const deny = () => { throw new Error('External communication is disabled in preview.'); };
  XMLHttpRequest.prototype.open = deny;
  if (navigator.sendBeacon) navigator.sendBeacon = () => false;
  window.open = () => null;
  document.addEventListener('click', e => {
    const link = e.target.closest('a');
    if (link && new URL(link.href, location.href).origin !== location.origin) e.preventDefault();
  }, true);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register = async () => { throw new Error('Preview service workers are disabled'); };
  // Do not reuse a live authToken. A separate local-only demo session is seeded once.
  if (!IS_INTEGRATION && !storage.getItem('initialized')) {
    storage.setItem('authToken', 'preview-alex');
    storage.setItem('initialized', 'yes');
  }
  document.documentElement.dataset.preview = 'true';
}
