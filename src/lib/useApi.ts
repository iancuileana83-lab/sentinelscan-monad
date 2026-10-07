import { useEffect, useState } from 'react';

interface State<T> {
  data?: T;
  error?: string;
  loading: boolean;
}

/** GET a JSON endpoint of this app; the endpoints answer { data } or { error }. */
export function useApi<T>(url: string | null): State<T> {
  const [state, setState] = useState<State<T>>({ loading: !!url });

  useEffect(() => {
    if (!url) {
      setState({ loading: false });
      return;
    }
    let cancelled = false;
    setState({ loading: true });
    fetch(url)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
        if (!cancelled) setState({ data: body as T, loading: false });
      })
      .catch((e) => {
        if (!cancelled) setState({ error: e instanceof Error ? e.message : 'Something went wrong.', loading: false });
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return state;
}
