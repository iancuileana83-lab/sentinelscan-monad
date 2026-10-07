import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Menu, ShieldCheck, X } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
import { REGISTRY_ADDRESS, explorerAddressUrl } from '@/lib/registryConfig';

// Pages are added here as they are built.
const NAV: { to: string; label: string; end?: boolean }[] = [
  { to: '/', label: 'Scanner', end: true },
  { to: '/registry', label: 'Registry' },
  { to: '/radar', label: 'Live radar' },
  { to: '/agents', label: 'For AI agents' },
  { to: '/how-it-works', label: 'How it works' },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3 py-2 text-sm font-medium transition ${isActive ? 'bg-brand/10 text-brand-ink' : 'text-muted hover:bg-card2 hover:text-ink'}`;

export default function Layout() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    setOpen(false);
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-ink2">
      <header className="sticky top-0 z-20 border-b border-line bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-violet-400 text-white shadow-card">
              <ShieldCheck size={22} aria-hidden />
            </span>
            <span>
              <span className="block text-lg font-semibold leading-tight text-ink">SentinelScan on Monad</span>
              <span className="block text-xs leading-tight text-faint">Risk signals · Monad Testnet only</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <nav aria-label="Main" className="hidden gap-1 md:flex">
              {NAV.map((n) => (
                <NavLink key={n.to} to={n.to} end={n.end} className={linkClass}>
                  {n.label}
                </NavLink>
              ))}
            </nav>
            <ThemeToggle />
            <button
              className="rounded-lg border border-line p-2 text-ink2 md:hidden"
              aria-label={open ? 'Close menu' : 'Open menu'}
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
        {open && (
          <nav aria-label="Main" className="flex flex-col gap-1 border-t border-line px-4 py-3 md:hidden">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={linkClass}>
                {n.label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:py-10">
        <Outlet />
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-6 text-xs leading-relaxed text-faint">
          <p>
            Scores are signals about patterns in public on-chain data, not verdicts and not financial advice. Monad Testnet tokens have no real value.
          </p>
          <p className="flex flex-wrap gap-x-4 gap-y-1">
            <a className="underline hover:text-ink2" href="https://github.com/iancuileana83-lab/sentinelscan-monad" target="_blank" rel="noreferrer">
              Source code (MIT)
            </a>
            <a className="underline hover:text-ink2" href={explorerAddressUrl(REGISTRY_ADDRESS)} target="_blank" rel="noreferrer">
              RiskRegistry contract
            </a>
            <span>Built for the Monad Metropolis hackathon. Not affiliated with Monad Labs.</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
