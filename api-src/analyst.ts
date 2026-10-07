import type { IncomingMessage, ServerResponse } from 'node:http';
import { analystRoute } from '../server/aiRoutes.ts';

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return analystRoute(req, res, process.env);
}
