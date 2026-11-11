import { useCallback, useEffect, useRef, useState } from "react";
import { fetchMarket, type MarketData } from "../lib/api";

export function useMarket() {
  const [data, setData] = useState<MarketData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);
  const hasData = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;

    async function load(first: boolean) {
      try {
        const next = await fetchMarket(controller.signal);
        if (disposed) return;
        hasData.current = true;
        setData(next);
        setError(null);
      } catch (err) {
        if (disposed || (err instanceof DOMException && err.name === "AbortError")) return;
        setError(err instanceof Error ? err.message : "Market data is unavailable.");
      } finally {
        if (!disposed && first) setLoading(false);
      }
    }

    void load(true);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load(false);
    }, 60_000);

    return () => {
      disposed = true;
      controller.abort();
      window.clearInterval(timer);
    };
  }, [nonce]);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    setNonce((n) => n + 1);
  }, []);

  return { data, error, loading, reload };
}
