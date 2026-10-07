import type { IncomingMessage, ServerResponse } from 'node:http';
import { mcpRoute } from '../server/agentApi.ts';

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return mcpRoute(req, res, process.env.ETHERSCAN_API_KEY);
}
