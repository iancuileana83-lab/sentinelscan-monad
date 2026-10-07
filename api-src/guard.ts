import type { IncomingMessage, ServerResponse } from 'node:http';
import { guardView } from '../server/handlers.ts';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const address = new URL(req.url ?? '', 'http://x').searchParams.get('address');
  const result = await guardView(address);
  res.statusCode = result.status;
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(result.body));
}
