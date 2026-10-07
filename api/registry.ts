import type { IncomingMessage, ServerResponse } from 'node:http';
import { registryView } from '../server/handlers.ts';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const params = new URL(req.url ?? '', 'http://x').searchParams;
  const result = await registryView(params.get('address'), params.get('reporter'));
  res.statusCode = result.status;
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(result.body));
}
