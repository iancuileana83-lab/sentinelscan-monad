import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { registryFeed, registryView, reporterView, txScan, walletScan, type HandlerResult } from './server/handlers.ts';
import { mcpRoute, toolsRoute } from './server/agentApi.ts';

// In development the same handlers that Vercel runs in production are served here,
// so the Etherscan key stays on the server side of the dev machine too.
function devApi(apiKey: string | undefined): Plugin {
  const q = (u: URL, k: string) => u.searchParams.get(k);
  const routes: Record<string, (u: URL) => Promise<HandlerResult>> = {
    '/api/wallet-scan': (u) => walletScan(q(u, 'address'), apiKey),
    '/api/tx-scan': (u) => txScan(q(u, 'hash'), apiKey),
    '/api/registry': (u) => registryView(q(u, 'address'), q(u, 'reporter'), apiKey),
    '/api/registry-feed': (u) => registryFeed(q(u, 'subject'), q(u, 'reporter'), apiKey),
    '/api/reporter': (u) => reporterView(q(u, 'address'), apiKey),
  };
  return {
    name: 'sentinelscan-dev-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? '', 'http://localhost');
        if (url.pathname === '/api/mcp') return void (await mcpRoute(req, res, apiKey));
        if (url.pathname === '/api/agent-tools') return void (await toolsRoute(req, res, apiKey));
        const run = routes[url.pathname];
        if (!run) return next();
        const result = await run(url);
        res.statusCode = result.status;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(result.body));
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), devApi(env.ETHERSCAN_API_KEY)],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    optimizeDeps: { exclude: ['lucide-react'] },
  };
});
