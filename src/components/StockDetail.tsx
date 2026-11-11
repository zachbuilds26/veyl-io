import { useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, Copy, RefreshCcw } from "lucide-react";
import type { Asset } from "../lib/assets";
import { fetchStock, type MarketData, type Range, type StockData } from "../lib/api";
import { asOf, compact, compactUsd, money, rangeText } from "../lib/format";
import { ChangePill, Skeleton } from "./ui";
import { PriceChart } from "./PriceChart";
import { TradeCard } from "./TradeCard";

const RANGES: Range[] = ["1D", "1W", "1M", "6M", "1Y"];

type Props = {
  ticker: string;
  market: MarketData | null;
  onBack: () => void;
  onConnect: () => void;
};

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="stat">
      <dt>{label}</dt>
      <dd className={mono ? "mono" : undefined}>{value}</dd>
    </div>
  );
}

function toAsset(data: StockData): Asset {
  return {
    symbol: data.symbol,
    ticker: data.ticker,
    name: data.name,
    address: data.address as `0x${string}`,
    logo: `${import.meta.env.BASE_URL}tokens/${data.address.toLowerCase()}.png`,
    decimals: 18,
    cs: data.symbol,
  };
}

export function StockDetail({ ticker, market, onBack, onConnect }: Props) {
  const [range, setRange] = useState<Range>("1M");
  const [data, setData] = useState<StockData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [copied, setCopied] = useState(false);
  const [pricePulse, setPricePulse] = useState(false);
  const lastPrice = useRef<number | null>(null);
  const copyTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
    },
    [],
  );

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetchStock(ticker, range, controller.signal)
      .then((next) => {
        if (controller.signal.aborted) return;
        setData(next);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Price data is unavailable.");
        setLoading(false);
      });

    return () => controller.abort();
  }, [ticker, range, nonce]);

  const livePrice = data?.quote?.price ?? market?.quotes[ticker.toUpperCase()]?.price ?? null;

  useEffect(() => {
    if (livePrice === null) return;
    const previous = lastPrice.current;
    lastPrice.current = livePrice;
    if (previous === null || previous === livePrice) return;
    setPricePulse(true);
    const timer = window.setTimeout(() => setPricePulse(false), 420);
    return () => window.clearTimeout(timer);
  }, [livePrice]);

  const fromMarket = market?.assets.find(
    (candidate) =>
      candidate.ticker.toUpperCase() === ticker.toUpperCase() ||
      candidate.symbol.toUpperCase() === ticker.toUpperCase(),
  );
  const asset = fromMarket ?? (data ? toAsset(data) : null);

  if (!asset) {
    if (loading) {
      return (
        <div className="page detail">
          <div className="container">
            <div className="chart-skeleton">
              <Skeleton className="sk-chart" />
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="page">
        <span className="dots-backdrop" aria-hidden="true" />
        <div className="container">
          <div className="empty-card">
            <h1>{error ? "Asset unavailable" : "Asset not found"}</h1>
            <p>
              {error ??
                `The ticker “${ticker}” is not in the Binance bStock universe.`}
            </p>
            {error ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setNonce((n) => n + 1)}
              >
                Retry
              </button>
            ) : null}
            <button type="button" className="btn btn-ghost" onClick={onBack}>
              Back to stocks
            </button>
          </div>
        </div>
      </div>
    );
  }

  const quote = data?.quote ?? null;
  const marketQuote = market?.quotes[asset.ticker];
  const price = quote?.price ?? marketQuote?.price ?? null;
  const changePct = quote?.changePct ?? marketQuote?.changePct ?? null;
  const token = data?.token ?? null;
  const chartCandles = data && data.range === range ? data.candles : null;
  const stamp = data?.updatedAt ? asOf(new Date(data.updatedAt).getTime()) : "Loading market data";
  const address = asset.address;
  const marketState =
    token?.openState === true ? "Open" : token?.openState === false ? "Closed" : "n/a";

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard can be blocked; the address is still visible */
    }
  }

  return (
    <div className="page detail">
      <span className="dots-backdrop" aria-hidden="true" />
      <div className="container">
        <div className="detail-topline">
          <nav className="detail-crumb" aria-label="Breadcrumb">
            <button type="button" className="back" onClick={onBack}>
              <ChevronLeft size={16} strokeWidth={2} aria-hidden="true" />
              Stocks
            </button>
            <span className="crumb-sep" aria-hidden="true">
              /
            </span>
            <h1 className="detail-crumb-name">{asset.name}</h1>
            <span className="detail-crumb-ticker">${asset.symbol}</span>
            <button
              type="button"
              className="icon-btn-ghost crumb-refresh"
              onClick={() => setNonce((n) => n + 1)}
              disabled={loading}
              aria-label="Refresh market data"
            >
              <RefreshCcw
                size={16}
                strokeWidth={1.9}
                aria-hidden="true"
                className={loading ? "spin" : undefined}
              />
            </button>
          </nav>
        </div>

        <div className="detail-grid">
          <section className="card chart-card" aria-label="Price chart">
            <div className="chart-quote">
              <div className="detail-price">
                <div className="big">
                  {loading || pricePulse ? (
                    <span className="sk sk-price" aria-hidden="true" />
                  ) : (
                    money(price)
                  )}
                </div>
                <div className="detail-price-meta">
                  {loading || pricePulse ? (
                    <span className="sk sk-pill" aria-hidden="true" />
                  ) : (
                    <ChangePill value={changePct} />
                  )}
                  <span className="detail-asof">{stamp}</span>
                </div>
              </div>
            </div>

            {error && !data ? (
              <div className="chart-error">
                <p>{error}</p>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setNonce((n) => n + 1)}
                >
                  <RefreshCcw size={14} strokeWidth={1.9} aria-hidden="true" />
                  Retry
                </button>
              </div>
            ) : !chartCandles ? (
              <div className="chart-skeleton">
                <Skeleton className="sk-chart" />
              </div>
            ) : (
              <PriceChart
                candles={chartCandles}
                range={range}
                baseline={quote?.previousClose}
                changePct={changePct}
              />
            )}
            {error && data ? (
              <div className="chart-error chart-error-inline" role="alert">
                <p>{error}</p>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setNonce((n) => n + 1)}
                >
                  <RefreshCcw size={14} strokeWidth={1.9} aria-hidden="true" />
                  Retry
                </button>
              </div>
            ) : null}

            <div className="chart-tools">
              <div
                className="ranges"
                role="tablist"
                aria-label="Chart range"
                onKeyDown={(event) => {
                  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
                  event.preventDefault();
                  const index = RANGES.indexOf(range);
                  const step = event.key === "ArrowRight" ? 1 : -1;
                  const next = RANGES[(index + step + RANGES.length) % RANGES.length];
                  setRange(next);
                  event.currentTarget
                    .querySelectorAll<HTMLButtonElement>('[role="tab"]')
                    [RANGES.indexOf(next)]?.focus();
                }}
              >
                {RANGES.map((item) => (
                  <button
                    key={item}
                    type="button"
                    role="tab"
                    aria-selected={item === range}
                    tabIndex={item === range ? 0 : -1}
                    className={item === range ? "range active" : "range"}
                    onClick={() => setRange(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <span className="chart-note">Priced in USD, settles in USDT</span>
            </div>
          </section>

          <aside className="detail-side">
            <TradeCard asset={asset} price={price} onConnect={onConnect} />
          </aside>

          <div className="detail-lower">
            <section className="card" aria-label="Key statistics">
              <div className="card-head">
                <h2 className="card-title">Key stats</h2>
                <span className="card-sub">Spot and on-chain</span>
              </div>
              <dl className="stats">
                <Stat label="Day range" value={rangeText(quote?.dayLow, quote?.dayHigh)} />
                <Stat
                  label="52-week range"
                  value={rangeText(quote?.fiftyTwoWeekLow, quote?.fiftyTwoWeekHigh)}
                />
                <Stat
                  label="Volume"
                  value={
                    quote?.volume === null || quote?.volume === undefined
                      ? "n/a"
                      : compactUsd(quote.volume)
                  }
                />
                <Stat label="Liquidity" value={compactUsd(token?.liquidityUsd)} />
                <Stat label="Holders" value={compact(token?.holders)} />
                <Stat label="Traders" value={compact(token?.traders)} />
                <Stat label="Network" value="BNB Chain" />
                <Stat label="Market" value={marketState} />
                <Stat label="Ticker" value={asset.ticker} mono />
                <div className="stat wide">
                  <dt>Contract</dt>
                  <dd className="contract">
                    <code>{address}</code>
                    <button
                      type="button"
                      className="copy-btn"
                      onClick={copyAddress}
                      aria-label="Copy contract address"
                    >
                      {copied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </dd>
                </div>
              </dl>
            </section>

            <section className="card" aria-label={`About ${asset.name}`}>
              <div className="card-head">
                <h2 className="card-title">About {asset.name}</h2>
                <span className="pill-quiet">bStock</span>
              </div>
              <div className="prose">
                <p>
                  {asset.name} ({asset.ticker}) is issued on BNB Chain as {asset.symbol}, a Binance
                  bStock. Each token tracks the listed equity, trades against USDT and settles
                  on-chain.
                </p>
                <p>
                  Tokenized equities carry issuer, custody and jurisdiction risk. On-chain pricing
                  can diverge from the underlying equity, especially in thin markets.
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
