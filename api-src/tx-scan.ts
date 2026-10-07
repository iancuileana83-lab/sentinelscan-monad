import type { IncomingMessage, ServerResponse } from 'node:http';
import { txScan } from '../server/handlers.ts';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const hash = new URL(req.url ?? '', 'http://x').searchParams.get('hash');
  const result = await txScan(hash, process.env.ETHERSCAN_API_KEY);
  res.statusCode = result.status;
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(result.body));
}
