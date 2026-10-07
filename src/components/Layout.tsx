import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Menu, ShieldCheck, X } from 'lucide-react';
import { REGISTRY_ADDRESS, explorerAddressUrl } from '@/lib/registryConfig';

// Pages are added here as they are built.
const NAV: { to: string; label: string; end?: boolean }[] = [
  { to: '/', label: 'Scanner', end: true },
  { to: '/registry', label: 'Registry' },
  { to: '/agents', label: 'For AI agents' },
  { to: '/how-it-works', label: 'How it works' },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3 py-2 text-sm font-medium transition ${
    isActive ? 'bg-emerald-500/10 text-emerald-300' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
  }`;

export default function Layout() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    setOpen(false);
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-200">
      <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-3">
            <ShieldCheck className="text-emerald-400" size={26} />
            <span>
              <span className="block text-lg font-semibold leading-tight text-slate-100">SentinelScan on Monad</span>
              <span className="block text-xs leading-tight text-slate-500">Risk signals · Monad Testnet only</span>
            </span>
          </Link>
          <nav aria-label="Main" className="hidden gap-1 md:flex">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={linkClass}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <button
            className="rounded-lg border border-slate-700 p-2 text-slate-300 md:hidden"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        {open && (
          <nav aria-label="Main" className="flex flex-col gap-1 border-t border-slate-800 px-4 py-3 md:hidden">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={linkClass}>
                {n.label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Outlet />
      </main>

      <footer className="border-t border-slate-800">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-6 text-xs leading-relaxed text-slate-600">
          <p>
            Scores are signals about patterns in public on-chain data, not verdicts and not financial advice. Monad Testnet tokens have no
            real value.
          </p>
          <p className="flex flex-wrap gap-x-4 gap-y-1">
            <a className="underline" href="https://github.com/iancuileana83-lab/sentinelscan-monad" target="_blank" rel="noreferrer">
              Source code (MIT)
            </a>
            <a className="underline" href={explorerAddressUrl(REGISTRY_ADDRESS)} target="_blank" rel="noreferrer">
              RiskRegistry contract
            </a>
            <span>Built for the Monad Metropolis hackathon</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
