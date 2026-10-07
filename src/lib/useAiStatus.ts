import { useEffect, useState } from 'react';

export interface AiStatus {
  enabled: boolean;
  provider: string | null;
  model: string | null;
  runsLeftToday: number;
}

/** Whether the AI parts are switched on, and how many runs are left today. null while loading or unknown. */
export function useAiStatus(): AiStatus | null {
  const [status, setStatus] = useState<AiStatus | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/ai-status')
      .then((r) => r.json())
      .then((b) => {
        if (!cancelled && b?.data) setStatus(b.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return status;
}
