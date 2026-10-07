import type { IncomingMessage, ServerResponse } from 'node:http';
import { walletScan } from '../server/handlers.ts';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const address = new URL(req.url ?? '', 'http://x').searchParams.get('address');
  const result = await walletScan(address, process.env.ETHERSCAN_API_KEY);
  res.statusCode = result.status;
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(result.body));
}
