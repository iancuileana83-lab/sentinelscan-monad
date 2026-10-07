import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { registryView, txScan, walletScan } from './server/handlers.ts';
import { mcpRoute, toolsRoute } from './server/agentApi.ts';

// In development the same handlers that Vercel runs in production are served here,
// so the Etherscan key stays on the server side of the dev machine too.
function devApi(apiKey: string | undefined): Plugin {
  return {
    name: 'sentinelscan-dev-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? '', 'http://localhost');
        if (url.pathname === '/api/mcp') return void (await mcpRoute(req, res, apiKey));
        if (url.pathname === '/api/agent-tools') return void (await toolsRoute(req, res, apiKey));
        const run =
          url.pathname === '/api/wallet-scan'
            ? () => walletScan(url.searchParams.get('address'), apiKey)
            : url.pathname === '/api/tx-scan'
              ? () => txScan(url.searchParams.get('hash'), apiKey)
              : url.pathname === '/api/registry'
                ? () => registryView(url.searchParams.get('address'), url.searchParams.get('reporter'))
                : null;
        if (!run) return next();
        const result = await run();
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
