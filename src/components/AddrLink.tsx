import { Link } from 'react-router-dom';
import { shortAddr } from '@/lib/format';

/** A short, linked address: to the address page, or to the reporter page. */
export default function AddrLink({ address, to = 'address' }: { address: string; to?: 'address' | 'reporter' }) {
  return (
    <Link className="font-mono text-emerald-400 underline decoration-emerald-400/30 hover:decoration-emerald-400" to={`/${to}/${address}`} title={address}>
      {shortAddr(address)}
    </Link>
  );
}
