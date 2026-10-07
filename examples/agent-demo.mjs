// A short demo of an AI agent using SentinelScan on Monad through the official MCP client.
//
//   node examples/agent-demo.mjs [wallet-address] [--url https://.../api/mcp]
//
// The "agent" here is scripted (no language model), so it is repeatable and free. What it
// shows is the real part: a standard MCP client discovering the tools, calling them,
// and answering only from the evidence they return. A language-model agent (for example
// Claude Code) can use the same endpoint, see README.md.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const args = process.argv.slice(2);
const urlFlag = args.indexOf('--url');
const url = urlFlag >= 0 ? args.splice(urlFlag, 2)[1] : 'https://monad-risk-signals.vercel.app/api/mcp';
const address = args[0] ?? '0x6f49a8f621353f12378d0046e7d7e4b9b249dc9e';

const say = (text = '') => console.log(text);
const step = (n, text) => say(`\n[${n}] ${text}`);

const client = new Client({ name: 'scripted-agent-demo', version: '1.0.0' });
await client.connect(new StreamableHTTPClientTransport(new URL(url)));

say('Scripted agent (no language model) talking to SentinelScan on Monad over MCP');
say(`Server : ${client.getServerVersion()?.name} at ${url}`);
say(`Task   : "Is it wise to interact with ${address}?"`);

step(1, 'Discover tools');
const { tools } = await client.listTools();
for (const t of tools) say(`  - ${t.name}${t.annotations?.readOnlyHint ? '  (read-only)' : ''}`);

const call = async (name, argumentsObject) => {
  const res = await client.callTool({ name, arguments: argumentsObject });
  if (res.isError) throw new Error(res.content?.[0]?.text ?? 'tool error');
  return res.structuredContent;
};

step(2, `Call scan_wallet({ address })`);
const scan = await call('scan_wallet', { address });
say(`  risk signal : ${scan.riskSignal.score}/100 (${scan.riskSignal.level}), main reason: ${scan.riskSignal.reasonLabel}`);
say(`  facts       : ${scan.facts.transactionsAnalyzed} transactions analyzed, balance ${scan.facts.balanceMON} MON`);
for (const s of scan.signals) say(`  signal      : [${s.severity}] ${s.title}`);

step(3, 'Call get_registry_signals({ address })');
const registry = await call('get_registry_signals', { address });
say(`  on-chain reporters: ${registry.reporterCount}${registry.reporterCount ? `, average score ${registry.averageScore}` : ''}`);
const rw = registry.reputationWeighted;
if (rw?.reporters?.length) say(`  reputation-weighted score: ${rw.weightedAverage} (plain ${rw.plainAverage}, effective reporters ${rw.effectiveReporters}; weights ${rw.reporters.map((r) => r.weight).join(', ')})`);

step(4, 'Answer, using only the evidence above');
const top = scan.evidence.topCounterparties[0];
say(`  The scan gives a ${scan.riskSignal.level} signal (${scan.riskSignal.score}/100).`);
if (top) say(`  Most activity is with ${top.address} (${top.interactions} of ${scan.facts.transactionsAnalyzed} transactions).`);
say(`  ${registry.reporterCount} wallet(s) have recorded a public signal on Monad Testnet.`);
say(`  Caveat: ${scan.notice}`);
say('  (Evidence: ' + scan.evidence.recentTransactions.slice(0, 2).map((t) => t.hash.slice(0, 12) + '…').join(', ') + ')');

await client.close();
