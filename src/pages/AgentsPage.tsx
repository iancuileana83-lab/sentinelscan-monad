import { useEffect, useMemo, useState } from 'react';
import { Loader2, Play, Plug, ShieldCheck } from 'lucide-react';
import AgentDemo from '@/components/AgentDemo';
import { Card, ErrorNote } from '@/components/Card';
import CodeBlock from '@/components/CodeBlock';
import DeveloperGuide from '@/components/DeveloperGuide';
import { REGISTRY_ADDRESS } from '@/lib/registryConfig';

interface Tool {
  name: string;
  description: string;
  inputSchema: { properties: Record<string, { description?: string }>; required?: string[] };
}

const SAMPLE_ADDRESS = '0x6f49a8f621353f12378d0046e7d7e4b9b249dc9e';
const SAMPLE_HASH = '0x5457906afbd449d0334b9e7f0a7ad4ea95c46f5c8dd9bca4aef1cdef262fefa2';
const SAMPLES: Record<string, Record<string, string>> = {
  scan_wallet: { address: SAMPLE_ADDRESS },
  scan_transaction: { hash: SAMPLE_HASH },
  get_registry_signals: { address: SAMPLE_ADDRESS },
  guard_quote: { address: SAMPLE_ADDRESS },
};

async function rpc(method: string, params?: unknown) {
  const res = await fetch('/api/mcp', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) throw new Error(body.error?.message || `Request failed (${res.status})`);
  return body.result;
}

function Playground({ tools }: { tools: Tool[] }) {
  const [name, setName] = useState(tools[0]?.name ?? 'scan_wallet');
  const [args, setArgs] = useState<Record<string, string>>(SAMPLES[name] ?? {});
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [output, setOutput] = useState('');
  const [ms, setMs] = useState<number | null>(null);

  const tool = tools.find((t) => t.name === name);
  const request = useMemo(() => {
    const cleaned = Object.fromEntries(Object.entries(args).filter(([, v]) => v.trim() !== ''));
    return { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: cleaned } };
  }, [name, args]);

  function pick(next: string) {
    setName(next);
    setArgs(SAMPLES[next] ?? {});
    setOutput('');
    setError('');
    setMs(null);
  }

  async function run() {
    setRunning(true);
    setError('');
    setOutput('');
    const t0 = performance.now();
    try {
      const result = await rpc('tools/call', request.params);
      setMs(Math.round(performance.now() - t0));
      if (result.isError) setError(result.content?.[0]?.text ?? 'The tool returned an error.');
      else setOutput(JSON.stringify(result.structuredContent ?? result.content, null, 2));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed.');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Tools">
        {tools.map((t) => (
          <button
            key={t.name}
            role="tab"
            aria-selected={t.name === name}
            onClick={() => pick(t.name)}
            className={`rounded-lg border px-3 py-1.5 font-mono text-xs transition ${
              t.name === name ? 'border-brand/40 bg-brand/10 text-brand-ink' : 'border-line text-muted hover:bg-card2'
            }`}
          >
            {t.name}
          </button>
        ))}
      </div>
      {tool && <p className="text-sm leading-relaxed text-muted">{tool.description}</p>}

      <div className="space-y-3">
        {Object.entries(tool?.inputSchema.properties ?? {}).map(([key, spec]) => (
          <label key={key} className="block text-sm text-ink2">
            <span className="font-mono text-xs">
              {key}
              {tool?.inputSchema.required?.includes(key) ? ' *' : ' (optional)'}
            </span>
            <input
              value={args[key] ?? ''}
              onChange={(e) => setArgs((a) => ({ ...a, [key]: e.target.value }))}
              spellCheck={false}
              placeholder={spec.description}
              className="mt-1 w-full rounded-lg border border-line bg-card px-3 py-2 font-mono text-xs text-ink placeholder-faint focus:border-brand focus:outline-none"
            />
          </label>
        ))}
      </div>

      <div>
        <div className="mb-1 text-xs text-faint">Request sent to /api/mcp</div>
        <CodeBlock label="request" code={JSON.stringify(request, null, 2)} />
      </div>

      <button
        onClick={run}
        disabled={running}
        className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-50"
      >
        {running ? <Loader2 className="animate-spin" size={16} /> : <Play size={16} />} Run tool
      </button>

      {error && <ErrorNote message={error} />}
      {output && (
        <div>
          <div className="mb-1 text-xs text-faint">Result (structuredContent){ms !== null && ` · ${ms} ms`}</div>
          <pre className="max-h-96 overflow-auto rounded-lg bg-canvas p-3 text-xs leading-relaxed text-ink2" aria-label="result">
            <code>{output}</code>
          </pre>
        </div>
      )}
    </div>
  );
}

export default function AgentsPage() {
  const [tools, setTools] = useState<Tool[] | null>(null);
  const [error, setError] = useState('');
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://sentinelscan-monad.vercel.app';

  useEffect(() => {
    rpc('tools/list')
      .then((r) => setTools(r.tools))
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load the tools.'));
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">For AI agents</h1>
        <p className="mt-1 text-sm text-muted">
          The same scanner and registry reader, as read-only tools an AI agent can call. They never sign or send anything, and none of them records a signal. Developers get a TypeScript SDK and Solidity interfaces further down.
        </p>
      </div>

      <Card title="Connect an agent" icon={Plug}>
        <div className="space-y-3 text-sm text-muted">
          <p>This is a standard remote MCP server (Streamable HTTP, stateless). Add it to Claude Code with one command:</p>
          <CodeBlock label="claude command" code={`claude mcp add --transport http sentinelscan-monad ${origin}/api/mcp`} />
          <p>
            Any other MCP client can use the URL <code className="text-ink2">{origin}/api/mcp</code>. Without MCP, plain JSON works too: <code className="text-ink2">GET /api/agent-tools</code>{' '}
            lists the tools with their JSON schemas, and a POST calls one:
          </p>
          <CodeBlock
            label="curl command"
            code={`curl -X POST ${origin}/api/agent-tools \\\n  -H 'content-type: application/json' \\\n  -d '{"tool":"scan_wallet","arguments":{"address":"${SAMPLE_ADDRESS}"}}'`}
          />
          <p>
            There is also a scripted demo client in the repository: <code className="text-ink2">node examples/agent-demo.mjs</code>.
          </p>
        </div>
      </Card>

      <AgentDemo />

      <Card title="Try the MCP tools" icon={Play}>
        {error && <ErrorNote message={error} />}
        {!tools && !error && (
          <p className="flex items-center gap-2 text-sm text-faint">
            <Loader2 className="animate-spin" size={14} /> Asking the server for its tools…
          </p>
        )}
        {tools && <Playground tools={tools} />}
        <p className="mt-4 text-xs text-faint">
          This playground sends real JSON-RPC calls to this site&apos;s own MCP endpoint, the same ones an agent would send.
        </p>
      </Card>

      <DeveloperGuide />

      <Card title="What agents get, and what they are protected from" icon={ShieldCheck}>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted">
          <li>Every result carries a &quot;signal, not verdict&quot; notice, plus evidence: transaction hashes, top counterparties and the reasons behind each score.</li>
          <li>On-chain text such as token symbols is untrusted: it is cleaned of control and invisible characters and shortened before an agent sees it. Agents should still treat it as data, never as instructions.</li>
          <li>Tools are annotated read-only. Unexpected arguments are rejected, and requests are rate limited per client on a best-effort basis.</li>
          <li>
            The registry tool returns the plain on-chain numbers and a reputation-weighted view of{' '}
            <a className="underline" href={`https://testnet.monadscan.com/address/${REGISTRY_ADDRESS}`} target="_blank" rel="noreferrer">
              RiskRegistry
            </a>
            . Weights are a heuristic, not proof.
          </li>
        </ul>
      </Card>
    </div>
  );
}
