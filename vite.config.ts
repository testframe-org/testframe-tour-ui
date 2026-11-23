import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The plugin's base URL and token arrive from the environment (the repo-root scripts resolve them
// from package.json > config); nothing here hardcodes a port.
const runnerUrl = process.env.TESTFRAME_RUNNER_URL;
const runnerToken = process.env.TESTFRAME_RUNNER_TOKEN;

export default defineConfig({
  // Every asset must be served under /tour: the plugin gates every path outside /tour/** behind
  // its bearer token (api/ApiFilter), so a root-relative asset would answer 401.
  base: '/tour/',
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
    // @react-pdf/renderer and the subset fonts are already split out by src/pdf/index.ts's dynamic
    // import; this only keeps the warning threshold above the initial bundle's size.
    chunkSizeWarningLimit: 1200
  },
  server: {
    // `bun run dev` proxies the tour API to a running plugin. Without TESTFRAME_RUNNER_URL there
    // is no proxy and the screens show the API error instead of failing silently.
    proxy: runnerUrl
      ? {
          '/api/v1': {
            target: runnerUrl,
            changeOrigin: true,
            ...(runnerToken ? { headers: { Authorization: `Bearer ${runnerToken}` } } : {})
          }
        }
      : undefined
  }
});
