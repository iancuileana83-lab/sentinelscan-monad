import type { IncomingMessage, ServerResponse } from 'node:http';
import { toolsRoute } from '../server/agentApi.ts';

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return toolsRoute(req, res, process.env.ETHERSCAN_API_KEY);
}
