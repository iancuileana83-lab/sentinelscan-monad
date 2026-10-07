import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { Card, ErrorNote } from '@/components/Card';
import CopyLink from '@/components/CopyLink';
import Loading from '@/components/Loading';
import ScanResult from '@/components/ScanResult';
import { MONAD_TESTNET } from '@/lib/registryConfig';
import { useApi } from '@/lib/useApi';
import type { ScanView } from '@/lib/viewTypes';
import { EventRow, type FeedEvent } from '@/pages/RegistryPage';

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

export default function AddressPage() {
  const { address = '' } = useParams();
  const valid = ADDRESS.test(address);
  const scan = useApi<{ data: ScanView; warning?: string }>(valid ? `/api/wallet-scan?address=${address}` : null);
  const history = useApi<{ data: { events: FeedEvent[]; total: number } }>(valid ? `/api/registry-feed?subject=${address}` : null);

  useEffect(() => {
    document.title = valid ? `${address.slice(0, 8)}… · SentinelScan on Monad` : 'SentinelScan on Monad';
    return () => {
      document.title = 'SentinelScan on Monad';
    };
  }, [address, valid]);

  if (!valid) {
    return (
      <div className="mx-auto max-w-xl space-y-3 py-12 text-center">
        <h1 className="text-xl font-semibold text-slate-100">Not a valid address</h1>
        <p className="text-sm text-slate-400">An address is 0x followed by 40 hex characters.</p>
        <Link className="text-emerald-400 underline" to="/">
          Back to the scanner
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-slate-100">Address</h1>
          <p className="mt-1 break-all font-mono text-sm text-slate-400">{address}</p>
          <a
            className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500 underline"
            href={`${MONAD_TESTNET.explorer}/address/${address}`}
            target="_blank"
            rel="noreferrer"
          >
            View on the Monad Testnet explorer <ExternalLink size={11} />
          </a>
        </div>
        <CopyLink />
      </div>

      {scan.loading && <Loading />}
      {scan.error && <ErrorNote message={scan.error} />}
      {scan.data && <ScanResult view={scan.data.data} warning={scan.data.warning} linkToAddress={false} />}

      <Card title="History of signals about this address">
        {history.loading && <Loading />}
        {history.error && <ErrorNote message={history.error} />}
        {history.data &&
          (history.data.data.events.length === 0 ? (
            <p className="text-sm text-slate-400">Nothing has been recorded about this address yet.</p>
          ) : (
            <ul>
              {history.data.data.events.map((e, i) => (
                <EventRow key={`${e.txHash}-${i}`} e={e} show="reporter" />
              ))}
            </ul>
          ))}
      </Card>
    </div>
  );
}
