import { useCallback, useEffect, useRef, useState } from "react";
import { formatUnits, type Address } from "viem";
import type { Asset } from "../lib/assets";
import { fetchStock, type MarketData } from "../lib/api";
import { USDT_ADDRESS, erc20Abi, friendlyError, publicClient } from "../lib/wallet";

export type Holding = {
  id: string;
  asset: Asset;
  units: number;
  changePct: number | null;
  value: number;
  isUsdt: boolean;
};

const usdtAsset = (): Asset => ({
  symbol: "USDT",
  ticker: "USDT",
  name: "Tether",
  address: USDT_ADDRESS,
  logo: `${import.meta.env.BASE_URL}usdt.png`,
  decimals: 18,
  cs: "USDT",
});

export function useHoldings(market: MarketData | null, account: Address | null) {
  const [holdings, setHoldings] = useState<Holding[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const lastAccount = useRef<Address | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    if (!account || !market) {
      lastAccount.current = account;
      loaded.current = false;
      setHoldings(null);
      setError(null);
      return;
    }
    let alive = true;
    const accountChanged = lastAccount.current !== account;
    lastAccount.current = account;
    setError(null);
    if (accountChanged || !loaded.current) setHoldings(null);

    const usdt = usdtAsset();
    const list = [usdt, ...market.assets];

    void (async () => {
      try {
        const results = await publicClient().multicall({
          contracts: list.map(
            (asset) =>
              ({
                address: asset.address,
                abi: erc20Abi,
                functionName: "balanceOf",
                args: [account],
              }) as const,
          ),
          allowFailure: true,
        });
        if (!alive) return;

        const next: Holding[] = [];
        const unpriced: Holding[] = [];
        results.forEach((result, index) => {
          if (result.status !== "success") return;
          const raw = result.result as bigint;
          if (raw <= 0n) return;
          const asset = list[index];
          const units = Number(formatUnits(raw, asset.decimals));
          if (asset.symbol === "USDT") {
            next.push({ id: "usdt", asset, units, changePct: 0, value: units, isUsdt: true });
            return;
          }
          const quote = market.quotes[asset.ticker];
          const price = quote?.price ?? null;
          const holding: Holding = {
            id: asset.address,
            asset,
            units,
            changePct: quote?.changePct ?? null,
            value: price ? units * price : 0,
            isUsdt: false,
          };
          next.push(holding);
          if (price === null) unpriced.push(holding);
        });

        if (unpriced.length > 0) {
          const settled = await Promise.allSettled(
            unpriced.map((holding) => fetchStock(holding.asset.ticker, "1M")),
          );
          if (!alive) return;
          settled.forEach((result, index) => {
            if (result.status !== "fulfilled") return;
            const price = result.value.quote?.price ?? null;
            if (price === null) return;
            const holding = unpriced[index];
            holding.value = holding.units * price;
            holding.changePct = result.value.quote?.changePct ?? holding.changePct;
          });
        }

        next.sort((a, b) => b.value - a.value);
        loaded.current = true;
        setHoldings(next);
      } catch (err: unknown) {
        if (alive) setError(friendlyError(err));
      }
    })();

    return () => {
      alive = false;
    };
  }, [account, market, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const loading = account !== null && market !== null && holdings === null && error === null;

  return { holdings, loading, error, reload };
}
