import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
const csp = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net; img-src 'self' data: blob:; connect-src 'self' ws://127.0.0.1:5174; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'";
export default defineConfig(({ mode, command }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  const target = env.VITE_APP_ENV || 'preview';
  if (!['preview', 'integration', 'production'].includes(target)) throw new Error('VITE_APP_ENV must be preview or production');
  if (target !== 'production' && env.VITE_API_BASE_URL) throw new Error('Preview uses in-memory fixtures: do not configure an API URL.');
  if (target === 'production' && (!env.VITE_API_BASE_URL || !env.VITE_API_BASE_URL.startsWith('https://'))) throw new Error('Release requires explicit HTTPS VITE_API_BASE_URL');
  if (env.VITE_NATIVE_SUPPORT_TEST === 'true' && target !== 'preview') throw new Error('Native support testing requires isolated preview fixtures.');
  const supportTest = env.VITE_SUPPORT_TEST_CHECKOUT === 'true';
  if (supportTest && (target !== 'preview' || command !== 'serve')) throw new Error('Support sandbox requires the local preview dev server.');
  const supportToken = supportTest ? readFileSync('/tmp/gos-support-sandbox-token', 'utf8').trim() : '';
  if (supportTest && !/^[a-f0-9]{64}$/.test(supportToken)) throw new Error('Start the isolated support sandbox API first.');
  const integration = target === 'integration';
  const policy = supportTest ? csp.replace('ws://127.0.0.1:5174', 'ws://127.0.0.1:5183') : integration ? csp.replace("connect-src 'self' ws://127.0.0.1:5174", "connect-src 'self' http://127.0.0.1:3007 ws://127.0.0.1:5175") : csp;
  return {
    plugins: [react(), ...(target !== 'production' ? [{ name: 'preview-csp', transformIndexHtml: () => [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: policy }, injectTo: 'head-prepend' }] }] : [])],
    server: { proxy: supportTest ? { '/__support-test/api/support': { target: 'http://127.0.0.1:3008', rewrite: path => path.replace('/__support-test', ''), headers: { Authorization: `Bearer ${supportToken}` } } } : undefined, host: '127.0.0.1', port: supportTest ? 5183 : integration ? 5175 : 5174, strictPort: true, headers: target !== 'production' ? { 'Content-Security-Policy': policy } : {} },
    preview: { host: '127.0.0.1', port: 4174, strictPort: true, headers: target !== 'production' ? { 'Content-Security-Policy': policy } : {} },
  };
});
