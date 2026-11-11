import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownUp, Check, ExternalLink, Loader2, Wallet } from "lucide-react";
import { formatUnits, parseUnits, type Address } from "viem";
import type { Asset } from "../lib/assets";
import { fetchBinQuote, fetchBinSwap, type WalletQuote } from "../lib/api";
import { money } from "../lib/format";
import {
  BSC_EXPLORER,
  READ_WALLET,
  USDT_ADDRESS,
  approveMax,
  ensureBsc,
  friendlyError,
  readAllowance,
  readBalance,
  sendSwapTx,
  waitReceipt,
} from "../lib/wallet";
import { AssetLogo } from "./ui";
import { addActivity } from "../lib/activity";
import { useWallet } from "../hooks/useWallet";

const USDT_LOGO = `${import.meta.env.BASE_URL}usdt.png`;
const SLIPPAGE = "0.5";

const units = new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 });

function unitText(value: number | null): string {
  if (value === null || !Number.isFinite(value) || value <= 0) return "0";
  return units.format(value);
}

function CoinMark() {
  const [failed, setFailed] = useState(false);

  return (
    <span className="coin-mark" aria-hidden="true">
      {failed ? (
        <span className="coin-fallback">T</span>
      ) : (
        <img
          src={USDT_LOGO}
          alt=""
          width={28}
          height={28}
          loading="eager"
          decoding="async"
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}

type Props = {
  asset: Asset;
  price: number | null;
  onConnect: () => void;
};

const ZERO = 0n;

export function TradeCard({ asset, price, onConnect }: Props) {
  const { account, connecting, connect } = useWallet();
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [balances, setBalances] = useState<{ usdt: bigint; token: bigint } | null>(null);
  const [allowance, setAllowance] = useState<bigint | null>(null);
  const [quote, setQuote] = useState<WalletQuote | null>(null);
  const [quoteState, setQuoteState] = useState<"idle" | "loading" | "error">("idle");
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "approving" | "swapping" | "done">("idle");
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const quoteSeq = useRef(0);
  const submitting = useRef(false);

  const tokenIn = side === "buy" ? USDT_ADDRESS : asset.address;
  const tokenOut = side === "buy" ? asset.address : USDT_ADDRESS;
  const payToken = side === "buy" ? "USDT" : asset.symbol;
  const receiveToken = side === "buy" ? asset.symbol : "USDT";

  const payDecimals = side === "buy" ? 18 : asset.decimals;

  const amountUnits = useMemo(() => {
    if (!amount || amount === ".") return ZERO;
    try {
      return parseUnits(amount, payDecimals);
    } catch {
      return ZERO;
    }
  }, [amount, payDecimals]);

  useEffect(() => {
    if (!account) {
      setBalances(null);
      setAllowance(null);
      return;
    }
    let alive = true;
    void Promise.all([readBalance(USDT_ADDRESS, account), readBalance(asset.address, account)])
      .then(([usdt, token]) => {
        if (alive) setBalances({ usdt, token });
      })
      .catch(() => {
        if (alive) setBalances(null);
      });
    return () => {
      alive = false;
    };
  }, [account, asset.address]);

  useEffect(() => {
    if (amountUnits <= ZERO) {
      quoteSeq.current += 1;
      setQuote(null);
      setQuoteState("idle");
      setQuoteError(null);
      return;
    }
    const seq = ++quoteSeq.current;
    setQuote(null);
    setQuoteState("loading");
    const timer = window.setTimeout(() => {
      void fetchBinQuote({
        from: tokenIn,
        to: tokenOut,
        amount: amountUnits.toString(),
        wallet: account ?? READ_WALLET,
      })
        .then((next) => {
          if (quoteSeq.current !== seq) return;
          setQuote(next);
          setQuoteState("idle");
          setQuoteError(null);
        })
        .catch((error: unknown) => {
          if (quoteSeq.current !== seq) return;
          setQuote(null);
          setQuoteState("error");
          setQuoteError(friendlyError(error));
        });
    }, 550);
    return () => {
      window.clearTimeout(timer);
      quoteSeq.current += 1;
    };
  }, [amountUnits, tokenIn, tokenOut, account]);

  useEffect(() => {
    const spender = quote?.approveTarget as Address | undefined;
    if (!account || !spender) {
      setAllowance(null);
      return;
    }
    let alive = true;
    void readAllowance(tokenIn, account, spender)
      .then((value) => {
        if (alive) setAllowance(value);
      })
      .catch(() => {
        if (alive) setAllowance(null);
      });
    return () => {
      alive = false;
    };
  }, [account, quote?.approveTarget, tokenIn]);

  function updateAmount(value: string) {
    const cleaned = value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
    setAmount(cleaned.slice(0, 18));
    setActionError(null);
    if (phase === "done") {
      setPhase("idle");
      setTxHash(null);
    }
  }

  const balanceForSide =
    balances === null
      ? null
      : Number(formatUnits(side === "buy" ? balances.usdt : balances.token, payDecimals));
  const insufficient =
    balances !== null && amountUnits > ZERO && amountUnits > (side === "buy" ? balances.usdt : balances.token);

  const receiveDecimals = side === "buy" ? asset.decimals : 18;
  const estimated =
    quote && amountUnits > ZERO
      ? Number(formatUnits(BigInt(quote.toTokenAmount), receiveDecimals))
      : null;
  const spender = quote?.approveTarget as Address | undefined;
  const needsApproval = allowance !== null && amountUnits > ZERO && allowance < amountUnits && Boolean(spender);
  const approvalPending = Boolean(spender) && amountUnits > ZERO && allowance === null;
  const busy = phase === "approving" || phase === "swapping";

  async function handleConnect() {
    setActionError(null);
    try {
      const wired = await connect();
      if (!wired) onConnect();
    } catch (error) {
      setActionError(friendlyError(error));
    }
  }

  async function handlePrimary() {
    if (!account || !quote || amountUnits <= ZERO || busy || submitting.current) return;
    submitting.current = true;
    setActionError(null);
    try {
      await ensureBsc();
      if (spender && allowance === null) throw new Error("Checking token approval, try again.");
      if (needsApproval && spender) {
        setPhase("approving");
        const hash = await approveMax(tokenIn, account, spender);
        const receipt = await waitReceipt(hash);
        if (receipt.status !== "success") throw new Error("Approval reverted on-chain.");
        const next = await readAllowance(tokenIn, account, spender);
        setAllowance(next);
        setPhase("idle");
        return;
      }
      setPhase("swapping");
      const fresh = await fetchBinQuote({
        from: tokenIn,
        to: tokenOut,
        amount: amountUnits.toString(),
        wallet: account,
      });
      const swap = await fetchBinSwap({
        quoteId: fresh.quoteId,
        from: tokenIn,
        to: tokenOut,
        amount: amountUnits.toString(),
        wallet: account,
        slippagePercent: SLIPPAGE,
      });
      const tx = swap.tx;
      if (!tx) throw new Error("Binance returned no transaction.");
      const hash = await sendSwapTx(
        account,
        tx.to as Address,
        tx.data as `0x${string}`,
        BigInt(tx.value || "0"),
      );
      setTxHash(hash);
      const receipt = await waitReceipt(hash);
      if (receipt.status !== "success") throw new Error("Transaction reverted on-chain.");
      const payAmount = Number(formatUnits(amountUnits, payDecimals));
      const receiveAmount = Number(formatUnits(BigInt(fresh.toTokenAmount), receiveDecimals));
      addActivity({
        hash,
        account,
        side,
        symbol: asset.symbol,
        name: asset.name,
        paySymbol: side === "buy" ? "USDT" : asset.symbol,
        payAmount,
        receiveSymbol: side === "buy" ? asset.symbol : "USDT",
        receiveAmount,
        usdValue: side === "buy" ? payAmount : receiveAmount,
        timestamp: Date.now(),
      });
      setPhase("done");
      void Promise.all([readBalance(USDT_ADDRESS, account), readBalance(asset.address, account)])
        .then(([usdt, token]) => setBalances({ usdt, token }))
        .catch(() => undefined);
    } catch (error) {
      setPhase("idle");
      setActionError(friendlyError(error));
    } finally {
      submitting.current = false;
    }
  }

  function reset() {
    setAmount("");
    setQuote(null);
    setQuoteState("idle");
    setQuoteError(null);
    setPhase("idle");
    setTxHash(null);
    setActionError(null);
  }

  let ctaLabel: string;
  if (phase === "done") ctaLabel = "New order";
  else if (!account) ctaLabel = "Connect wallet";
  else if (phase === "approving") ctaLabel = "Approving…";
  else if (phase === "swapping") ctaLabel = "Confirming…";
  else if (amountUnits <= ZERO) ctaLabel = "Enter an amount";
  else if (quoteState === "loading") ctaLabel = "Quoting…";
  else if (quoteState === "error") ctaLabel = "No quote available";
  else if (insufficient) ctaLabel = `Insufficient ${payToken}`;
  else if (needsApproval) ctaLabel = `Approve ${payToken}`;
  else ctaLabel = side === "buy" ? "Buy" : "Sell";

  const ctaDisabled =
    busy ||
    approvalPending ||
    (account !== null && (amountUnits <= ZERO || !quote || quoteState !== "idle" || insufficient));

  return (
    <section className="card trade-card" data-side={side} aria-label={`Trade ${asset.symbol}`}>
      <div className="seg" role="tablist" aria-label="Order side">
        <button
          type="button"
          role="tab"
          aria-selected={side === "buy"}
          className={side === "buy" ? "seg-btn active" : "seg-btn"}
          onClick={() => {
            if (side !== "buy" && phase === "done") reset();
            setSide("buy");
          }}
        >
          Buy
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={side === "sell"}
          className={side === "sell" ? "seg-btn active" : "seg-btn"}
          onClick={() => {
            if (side !== "sell" && phase === "done") reset();
            setSide("sell");
          }}
        >
          Sell
        </button>
      </div>

      <div className="trade-stack">
        <div className="trade-box">
          <div className="trade-box-head">
            <span className="trade-box-label">{side === "buy" ? "Buy with" : "Sell"}</span>
            <span className="trade-balance">
              {account === null
                ? "Wallet not connected"
                : balanceForSide === null
                  ? "…"
                  : `Balance ${unitText(balanceForSide)}`}
            </span>
          </div>
          <div className="trade-box-main">
            <input
              id={`amount-${asset.symbol}`}
              inputMode="decimal"
              placeholder="0"
              value={amount}
              onChange={(event) => updateAmount(event.target.value)}
              autoComplete="off"
              aria-label={side === "buy" ? "USDT amount" : `${asset.symbol} amount`}
            />
            <span className="token-chip">
              {side === "buy" ? <CoinMark /> : <AssetLogo asset={asset} size={28} round />}
              <span>{payToken}</span>
            </span>
          </div>
        </div>

        <button
          type="button"
          className="swap-mark"
          onClick={() => {
            if (phase === "done") reset();
            setSide((current) => (current === "buy" ? "sell" : "buy"));
          }}
          aria-label={`Switch to ${side === "buy" ? "sell" : "buy"}`}
        >
          <ArrowDownUp size={16} strokeWidth={2} aria-hidden="true" />
        </button>

        <div className="trade-box trade-box-receive">
          <div className="trade-box-head">
            <span className="trade-box-label">Receive</span>
            <span className="trade-balance">
              {quoteState === "loading" ? "Quoting" : "Binance aggregator"}
            </span>
          </div>
          <div className="trade-box-main">
            <span className="trade-amount">
              {quoteState === "loading" ? (
                <span className="quote-dots" role="status" aria-label="Loading quote">
                  <i />
                  <i />
                  <i />
                </span>
              ) : (
                unitText(estimated)
              )}
            </span>
            <span className="token-chip">
              {side === "buy" ? <AssetLogo asset={asset} size={28} round /> : <CoinMark />}
              <span>{receiveToken}</span>
            </span>
          </div>
        </div>
      </div>

      <dl className="trade-meta">
        <div>
          <dt>Route</dt>
          <dd>{quote?.vendorName ?? "Binance aggregator"}</dd>
        </div>
        <div>
          <dt>Est. received</dt>
          <dd>
            {estimated === null ? "n/a" : `${unitText(estimated)} ${receiveToken}`}
          </dd>
        </div>
        <div>
          <dt>Rate</dt>
          <dd>{money(price)}</dd>
        </div>
        <div>
          <dt>Network fee</dt>
          <dd>{quote ? "Paid in BNB at confirmation" : "Estimated by wallet"}</dd>
        </div>
      </dl>

      {actionError ? (
        <p className="trade-alert" role="alert">
          {actionError}
        </p>
      ) : quoteState === "error" && quoteError ? (
        <p className="trade-alert" role="alert">
          {quoteError}
        </p>
      ) : phase === "done" && txHash ? (
        <div className="swap-done" role="status">
          <Check size={14} strokeWidth={2.4} className="swap-done-check" aria-hidden="true" />
          <span>
            Swap confirmed.{" "}
            <a
              className="tx-link"
              href={`${BSC_EXPLORER}/tx/${txHash}`}
              target="_blank"
              rel="noreferrer"
            >
              View on BscScan
              <ExternalLink size={12} strokeWidth={2} aria-hidden="true" />
            </a>
          </span>
        </div>
      ) : null}

      <button
        type="button"
        className="btn btn-primary btn-lg btn-block"
        onClick={phase === "done" ? reset : account === null ? handleConnect : handlePrimary}
        disabled={
          phase === "done"
            ? false
            : busy || (account === null ? connecting : ctaDisabled)
        }
      >
        {busy ? (
          <Loader2 size={17} strokeWidth={2} className="spin" aria-hidden="true" />
        ) : (
          <Wallet size={17} strokeWidth={1.9} aria-hidden="true" />
        )}
        {ctaLabel}
      </button>

      <p className="trade-legal">
        Not offered to US persons or restricted jurisdictions. Tokenized equities carry issuer and
        custody risk.
      </p>
    </section>
  );
}
