import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import type { MarketData } from "../lib/api";
import { compactUsd, money } from "../lib/format";
import { AssetLogo, ChangePill, Skeleton } from "./ui";

type Props = {
  market: MarketData | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onSelect: (ticker: string) => void;
};

export function Explore({ market, loading, error, onRetry, onSelect }: Props) {
  const [query, setQuery] = useState("");

  const assets = market?.assets ?? [];
  const quotes = market?.quotes ?? {};
  const tokens = market?.tokens ?? {};
  const initialLoading = loading && !market;

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return assets;
    return assets.filter((asset) =>
      `${asset.name} ${asset.ticker} ${asset.symbol} ${asset.address}`.toLowerCase().includes(q)
    );
  }, [assets, query]);

  return (
    <div className="page">
      <span className="dots-backdrop" aria-hidden="true" />
      <div className="container">
        <div className="page-head page-head-tight">
          <div>
            <h1 className="page-title-sm">Stocks</h1>
            <p className="page-sub page-sub-sm">Tokenized US stocks, tradable 24/7.</p>
          </div>
        </div>

        {error && !market ? (
          <div className="banner" role="alert">
            <span>Market data could not load. {error}</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onRetry}>
              Retry
            </button>
          </div>
        ) : null}

        <div className="list-toolbar">
          <h2 className="list-title">
            All stocks
            <span className="list-count">
              {query
                ? `${rows.length} ${rows.length === 1 ? "match" : "matches"}`
                : `${assets.length} bStocks`}
            </span>
          </h2>
          <div className="search search-compact">
            <Search size={16} strokeWidth={1.9} aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search symbol or 0x address"
              aria-label="Search stocks"
              autoComplete="off"
              spellCheck={false}
            />
            {query ? (
              <button
                type="button"
                className="search-clear"
                onClick={() => setQuery("")}
                aria-label="Clear search"
              >
                <X size={14} aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>

        <div className="asset-list">
          {initialLoading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div className="asset-card is-skeleton" key={i} aria-hidden="true">
                  <Skeleton className="sk-card-logo" />
                  <span className="asset-card-body">
                    <Skeleton className="sk-bar w-35" />
                    <Skeleton className="sk-bar w-60" />
                    <Skeleton className="sk-bar w-35" />
                  </span>
                  <span className="asset-card-stat">
                    <Skeleton className="sk-num" />
                    <Skeleton className="sk-pill" />
                  </span>
                </div>
              ))
            : rows.map((asset, index) => {
                const quote = quotes[asset.ticker];
                const token = tokens[asset.address.toLowerCase()];
                return (
                  <button
                    type="button"
                    className="asset-card"
                    key={asset.symbol}
                    aria-label={`${asset.name} (${asset.symbol})`}
                    onClick={() => onSelect(asset.ticker)}
                  >
                    <AssetLogo asset={asset} size={56} priority={index === 0} />
                    <span className="asset-card-body">
                      <span className="asset-card-meta">@binance · bStock</span>
                      <span className="asset-card-title">{asset.name}</span>
                      <span className="asset-card-sub">
                        {asset.symbol} ·{" "}
                        {token?.volume24hUsd === null || token?.volume24hUsd === undefined
                          ? "Volume n/a"
                          : `Vol ${compactUsd(token.volume24hUsd)}`}
                      </span>
                    </span>
                    <span className="asset-card-stat">
                      <span className="asset-card-price">
                        {quote?.price === null || quote?.price === undefined ? "n/a" : money(quote.price)}
                      </span>
                      <ChangePill value={quote?.changePct} />
                    </span>
                  </button>
                );
              })}

          {!initialLoading && rows.length === 0 ? (
            <div className="empty-row">
              <p>No assets match “{query}”.</p>
              <button
                type="button"
                className="link-btn"
                onClick={() => setQuery("")}
              >
                Clear search
              </button>
            </div>
          ) : null}
        </div>

        <p className="fine-print">
          Prices from Binance spot markets, denominated in USDT. Volume is rolling 24 hours.
        </p>
      </div>
    </div>
  );
}
