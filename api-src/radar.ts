import type { IncomingMessage, ServerResponse } from 'node:http';
import { radarView } from '../server/handlers.ts';
import { clientIp } from '../server/http.ts';
import { allow } from '../server/limit.ts';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');
  if (!allow(`radar:${clientIp(req)}`, 120, 60_000)) {
    res.statusCode = 429;
    return res.end(JSON.stringify({ error: 'Radar rate limit: please slow down.' }));
  }
  const after = new URL(req.url ?? '', 'http://x').searchParams.get('after');
  const result = await radarView(after, process.env.ETHERSCAN_API_KEY);
  res.statusCode = result.status;
  res.end(JSON.stringify(result.body));
}
