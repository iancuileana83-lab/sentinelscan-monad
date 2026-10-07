import { lazy, Suspense } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import Layout from '@/components/Layout';
import Loading from '@/components/Loading';
import ScannerPage from '@/pages/ScannerPage';

const RegistryPage = lazy(() => import('@/pages/RegistryPage'));
const AddressPage = lazy(() => import('@/pages/AddressPage'));
const ReporterPage = lazy(() => import('@/pages/ReporterPage'));
const AgentsPage = lazy(() => import('@/pages/AgentsPage'));
const RadarPage = lazy(() => import('@/pages/RadarPage'));
const HowItWorksPage = lazy(() => import('@/pages/HowItWorksPage'));

function NotFound() {
  return (
    <div className="mx-auto max-w-xl space-y-3 py-12 text-center">
      <h1 className="text-xl font-semibold text-ink">Page not found</h1>
      <p className="text-sm text-muted">That page does not exist here.</p>
      <Link className="text-brand-ink underline" to="/">
        Back to the scanner
      </Link>
    </div>
  );
}

// The scanner is the first screen; every other page is loaded on demand (added below as built).
export default function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<ScannerPage />} />
          <Route path="registry" element={<RegistryPage />} />
          <Route path="address/:address" element={<AddressPage />} />
          <Route path="reporter/:address" element={<ReporterPage />} />
          <Route path="radar" element={<RadarPage />} />
          <Route path="agents" element={<AgentsPage />} />
          <Route path="how-it-works" element={<HowItWorksPage />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
