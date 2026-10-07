import type { IncomingMessage, ServerResponse } from 'node:http';
import { agentDemoRoute } from '../server/aiRoutes.ts';

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return agentDemoRoute(req, res, process.env);
}
