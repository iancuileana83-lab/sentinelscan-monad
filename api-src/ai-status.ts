import type { IncomingMessage, ServerResponse } from 'node:http';
import { aiStatusRoute } from '../server/aiRoutes.ts';

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return aiStatusRoute(req, res, process.env);
}
