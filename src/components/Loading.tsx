import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <div className="flex justify-center py-16 text-slate-500" role="status" aria-label="Loading">
      <Loader2 className="animate-spin" />
    </div>
  );
}
