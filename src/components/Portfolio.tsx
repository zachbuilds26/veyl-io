import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  History,
  RefreshCcw,
  Wallet,
} from "lucide-react";
import type { MarketData } from "../lib/api";
import { BSC_EXPLORER } from "../lib/wallet";
import {
  clearActivity,
  loadActivity,
  onActivityChange,
  type SwapActivity,
} from "../lib/activity";
import {
  compactUsd,
  dateTime,
  money,
  percent,
  shortAddress,
  tokenAmount,
} from "../lib/format";
import { useHoldings } from "../hooks/useHoldings";
import { useWallet } from "../hooks/useWallet";
import { AssetLogo, ChangePill, Skeleton } from "./ui";

type Props = {
  market: MarketData | null;
  marketError: string | null;
  onExplore: () => void;
  onSelect: (ticker: string) => void;
  onConnect: () => void;
};

type PanelTab = "holdings" | "activities";

const HIDE_KEY = "veyl.hideBalance";

export function Portfolio({ market, marketError, onExplore, onSelect, onConnect }: Props) {
  const { account, connecting, connect } = useWallet();
  const { holdings, loading, error, reload } = useHoldings(market, account);
  const [activities, setActivities] = useState<SwapActivity[]>([]);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<number | null>(null);
  const [panel, setPanel] = useState<PanelTab>("holdings");
  const [hidden, setHidden] = useState(() => {
    try {
      return window.localStorage.getItem(HIDE_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const refresh = () => setActivities(loadActivity(account));
    refresh();
    return onActivityChange(refresh);
  }, [account]);

  useEffect(() => {
    try {
      window.localStorage.setItem(HIDE_KEY, hidden ? "1" : "0");
    } catch {
      /* storage unavailable */
    }
  }, [hidden]);

  useEffect(
    () => () => {
      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
    },
    [],
  );

  const totals = useMemo(() => {
    if (!holdings) return null;
    let value = 0;
    let delta = 0;
    for (const holding of holdings) {
      value += holding.value;
      const pct = holding.changePct;
      if (holding.isUsdt || pct === null) continue;
      if (pct !== 0) delta += holding.value * (pct / (100 + pct));
    }
    const previous = value - delta;
    return {
      value,
      delta,
      pct: previous > 0 ? (delta / previous) * 100 : null,
    };
  }, [holdings]);

  async function handleConnect() {
    try {
      const wired = await connect();
      if (!wired) onConnect();
    } catch {
      /* the wallet surfaced its own rejection */
    }
  }

  async function copyAddress() {
    if (!account) return;
    try {
      await navigator.clipboard.writeText(account);
      setCopied(true);
      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  }

  function handleTabKeys(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next: PanelTab = panel === "holdings" ? "activities" : "holdings";
    setPanel(next);
    const tabs = event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    tabs[next === "holdings" ? 0 : 1]?.focus();
  }

  const connected = account !== null;
  const masked = hidden;
  const priceError = market ? null : marketError;
  const shownValue = !connected
    ? money(0)
    : totals === null
      ? error || priceError
        ? "—"
        : null
      : money(totals.value);

  return (
    <div className="page">
      <span className="dots-backdrop" aria-hidden="true" />
      <div className="container">
        <div className="page-head">
          <div>
            <h1 className="page-title-sm">Portfolio</h1>
            <p className="page-sub page-sub-sm">Total value in USD, your holdings and confirmed swaps.</p>
          </div>
        </div>

        <section className="balance-card" aria-label="Wallet balance">
          <span className="balance-label">Wallet balance</span>
          <div className="balance-row">
            {shownValue === null ? (
              <Skeleton className="sk-total balance-sk" />
            ) : (
              <span className="balance-value">{masked ? "••••••" : shownValue}</span>
            )}
            <button
              type="button"
              className="balance-eye-toggle"
              onClick={() => setHidden((value) => !value)}
              aria-label={masked ? "Show balance" : "Hide balance"}
              aria-pressed={masked}
            >
              {masked ? (
                <EyeOff size={21} strokeWidth={1.8} aria-hidden="true" />
              ) : (
                <Eye size={21} strokeWidth={1.8} aria-hidden="true" />
              )}
            </button>
          </div>
          {connected ? (
            <button
              type="button"
              className="balance-chip"
              onClick={() => void copyAddress()}
              title={copied ? "Copied" : `Copy address ${account}`}
              aria-label={copied ? "Address copied" : `Copy address ${account}`}
            >
              <span className="portfolio-dot" aria-hidden="true" />
              <span className="mono">{copied ? "Copied" : shortAddress(account)}</span>
              {copied ? (
                <Check size={13} strokeWidth={2.4} aria-hidden="true" />
              ) : (
                <Copy size={13} strokeWidth={2} aria-hidden="true" />
              )}
            </button>
          ) : (
            <button
              type="button"
              className="balance-connect-btn"
              onClick={() => void handleConnect()}
              disabled={connecting}
            >
              <Wallet size={17} strokeWidth={1.9} aria-hidden="true" />
              {connecting ? "Connecting…" : "Connect wallet"}
            </button>
          )}
          {connected && totals ? (
            <div className={`balance-delta ${totals.delta >= 0 ? "pos" : "neg"}`}>
              {masked ? (
                "••••"
              ) : (
                <>
                  {totals.delta >= 0 ? "+" : "−"}
                  {money(Math.abs(totals.delta))}
                  {totals.pct !== null ? ` (${percent(totals.pct)})` : ""} today
                </>
              )}
            </div>
          ) : null}
        </section>

        <div className="portfolio-panel-head">
          <div
            className="panel-toggle"
            role="tablist"
            aria-label="Holdings or activities"
            onKeyDown={handleTabKeys}
          >
            <button
              type="button"
              role="tab"
              id="panel-tab-holdings"
              aria-selected={panel === "holdings"}
              aria-controls="panel-holdings"
              tabIndex={panel === "holdings" ? 0 : -1}
              className={panel === "holdings" ? "panel-toggle-btn active" : "panel-toggle-btn"}
              onClick={() => setPanel("holdings")}
            >
              Holdings
            </button>
            <button
              type="button"
              role="tab"
              id="panel-tab-activities"
              aria-selected={panel === "activities"}
              aria-controls="panel-activities"
              tabIndex={panel === "activities" ? 0 : -1}
              className={panel === "activities" ? "panel-toggle-btn active" : "panel-toggle-btn"}
              onClick={() => setPanel("activities")}
            >
              Activities
            </button>
          </div>
          <button
            type="button"
            className="icon-btn-ghost"
            onClick={reload}
            disabled={loading}
            aria-label="Refresh balances"
          >
            <RefreshCcw
              size={17}
              strokeWidth={1.9}
              className={loading ? "spin" : undefined}
              aria-hidden="true"
            />
          </button>
        </div>

        {panel === "holdings" ? (
          <section
            className="portfolio-panel"
            role="tabpanel"
            id="panel-holdings"
            aria-labelledby="panel-tab-holdings"
          >
            {!connected ? (
              <div className="empty-state">
                <span className="empty-state-icon">
                  <Wallet size={22} strokeWidth={1.7} aria-hidden="true" />
                </span>
                <h3>Connect your wallet</h3>
                <p>Your bStock and USDT balances will appear here once you connect.</p>
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => void handleConnect()}
                  disabled={connecting}
                >
                  Connect wallet
                </button>
              </div>
            ) : error || priceError ? (
              <div className="empty-state">
                <h3>Balances unavailable</h3>
                <p>{error ?? "Market prices could not load. Check the connection and retry."}</p>
                <button type="button" className="btn-outline" onClick={reload}>
                  Retry
                </button>
              </div>
            ) : !holdings ? (
              <ul className="holding-list" aria-hidden="true">
                {[0, 1, 2, 3].map((row) => (
                  <li key={row} className="holding-row">
                    <Skeleton className="sk-logo" />
                    <div className="holding-text">
                      <Skeleton className="sk-line-sm" />
                      <Skeleton className="sk-line-sm w-60" />
                    </div>
                    <div className="holding-right">
                      <Skeleton className="sk-num" />
                    </div>
                  </li>
                ))}
              </ul>
            ) : holdings.length === 0 ? (
              <div className="empty-state">
                <span className="empty-state-icon">
                  <Wallet size={22} strokeWidth={1.7} aria-hidden="true" />
                </span>
                <h3>No holdings yet</h3>
                <p>You don’t hold any bStocks or USDT yet. Start with a stock you follow.</p>
                <button type="button" className="btn-outline" onClick={onExplore}>
                  Browse stocks
                  <ChevronRight size={15} strokeWidth={2} aria-hidden="true" />
                </button>
              </div>
            ) : (
              <ul className="holding-list">
                {holdings.map((holding) => {
                  const body = (
                    <>
                      <AssetLogo asset={holding.asset} size={36} round={holding.isUsdt} />
                      <div className="holding-text">
                        <span className="holding-symbol">{holding.asset.ticker}</span>
                        <span className="holding-sub">
                          {masked ? "••••" : tokenAmount(holding.units)} {holding.asset.symbol} ·{" "}
                          {holding.asset.name}
                        </span>
                      </div>
                      <div className="holding-right">
                        <span className="holding-value">
                          {masked ? "••••" : money(holding.value)}
                        </span>
                        {holding.isUsdt ? (
                          <span className="holding-flat">$1.00</span>
                        ) : (
                          <ChangePill value={holding.changePct} tone="plain" />
                        )}
                      </div>
                    </>
                  );
                  return (
                    <li key={holding.id}>
                      {holding.isUsdt ? (
                        <div className="holding-row">{body}</div>
                      ) : (
                        <button
                          type="button"
                          className="holding-row holding-row-btn"
                          onClick={() => onSelect(holding.asset.ticker)}
                        >
                          {body}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {connected && holdings && holdings.length > 0 ? (
              <p className="card-footnote">Priced from Binance spot. USDT shown at $1.00.</p>
            ) : null}
          </section>
        ) : (
          <section
            className="portfolio-panel"
            role="tabpanel"
            id="panel-activities"
            aria-labelledby="panel-tab-activities"
          >
            {activities.length > 0 ? (
              <div className="panel-row-head">
                <button
                  type="button"
                  className="btn-text"
                  disabled={!account}
                  onClick={() => clearActivity(account)}
                >
                  Clear
                </button>
              </div>
            ) : null}
            {activities.length === 0 ? (
              <div className="empty-state">
                <span className="empty-state-icon">
                  <History size={22} strokeWidth={1.7} aria-hidden="true" />
                </span>
                <h3>No activity yet</h3>
                <p>Swaps you confirm in Veyl will appear here with links to BscScan.</p>
                <button type="button" className="btn-outline" onClick={onExplore}>
                  Start trading
                  <ChevronRight size={15} strokeWidth={2} aria-hidden="true" />
                </button>
              </div>
            ) : (
              <ul className="activity-list">
                {activities.map((item) => (
                  <li key={item.id} className="activity-row">
                    <span
                      className={`activity-badge ${item.side === "buy" ? "buy" : "sell"}`}
                      aria-hidden="true"
                    >
                      {item.side === "buy" ? (
                        <ArrowDownLeft size={16} strokeWidth={2} />
                      ) : (
                        <ArrowUpRight size={16} strokeWidth={2} />
                      )}
                    </span>
                    <div className="activity-text">
                      <span className="activity-title">
                        {item.side === "buy" ? "Bought" : "Sold"} {item.symbol}
                      </span>
                      <span className="activity-sub">
                        {dateTime(item.timestamp)} ·{" "}
                        {masked ? "••••" : tokenAmount(item.payAmount)} {item.paySymbol} →{" "}
                        {masked ? "••••" : tokenAmount(item.receiveAmount)} {item.receiveSymbol}
                      </span>
                    </div>
                    <div className="activity-right">
                      <span className="activity-value">
                        {masked ? "••••" : compactUsd(item.usdValue)}
                      </span>
                      <a
                        className="activity-link"
                        href={`${BSC_EXPLORER}/tx/${item.hash}`}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="View transaction on BscScan"
                        title="View on BscScan"
                      >
                        <ExternalLink size={15} strokeWidth={2} aria-hidden="true" />
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
