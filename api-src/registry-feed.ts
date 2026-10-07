import type { IncomingMessage, ServerResponse } from 'node:http';
import { registryFeed } from '../server/handlers.ts';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const params = new URL(req.url ?? '', 'http://x').searchParams;
  const result = await registryFeed(params.get('subject'), params.get('reporter'), process.env.ETHERSCAN_API_KEY);
  res.statusCode = result.status;
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(result.body));
}
