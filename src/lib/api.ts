import type { Asset } from "./assets";

export type Range = "1D" | "1W" | "1M" | "6M" | "1Y";

export type MarketQuote = {
  ticker: string;
  symbol: string;
  price: number | null;
  previousClose: number | null;
  changePct: number | null;
  currency: string;
};

export type TokenStat = {
  address: string;
  priceUsd: number | null;
  volume24hUsd: number | null;
  count24h: number | null;
};

export type MarketData = {
  assets: Asset[];
  quotes: Record<string, MarketQuote>;
  tokens: Record<string, TokenStat>;
  updatedAt: string;
};

export type StockQuote = {
  price: number | null;
  previousClose: number | null;
  changePct: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  volume: number | null;
  currency: string;
};

export type Candle = { t: number; c: number };

export type StockToken = {
  address: string;
  priceUsd: number | null;
  volume24hUsd: number | null;
  liquidityUsd: number | null;
  holders: number | null;
  traders: number | null;
  openState: boolean | null;
};

export type StockData = {
  ticker: string;
  symbol: string;
  name: string;
  address: string;
  quote: StockQuote | null;
  candles: Candle[];
  token: StockToken | null;
  range: Range;
  updatedAt: string;
};

export type WalletQuote = {
  quoteId: string;
  vendorName: string;
  executionMode: string;
  fromTokenAmount: string;
  toTokenAmount: string;
  approveTarget?: string;
};

export type WalletSwap = {
  executionMode: string;
  tx: {
    from: string;
    to: string;
    data: string;
    value: string;
    gas: string;
    minReceiveAmount: string;
    slippagePercent: string;
  } | null;
  rfq: unknown;
};

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) message = body.error;
    } catch {
      /* keep the status message */
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

export function fetchMarket(signal?: AbortSignal): Promise<MarketData> {
  return getJson<MarketData>("/api/market", signal);
}

export function fetchStock(ticker: string, range: Range, signal?: AbortSignal): Promise<StockData> {
  return getJson<StockData>(
    `/api/stock/${encodeURIComponent(ticker)}?range=${encodeURIComponent(range)}`,
    signal,
  );
}

export async function fetchBinQuote(params: {
  from: string;
  to: string;
  amount: string;
  wallet: string;
  signal?: AbortSignal;
}): Promise<WalletQuote> {
  const qs = new URLSearchParams({
    ep: "quote",
    binanceChainId: "56",
    fromTokenAddress: params.from,
    toTokenAddress: params.to,
    amount: params.amount,
    userWalletAddress: params.wallet,
  });
  const json = await getJson<{
    code?: number | string;
    msg?: string;
    error?: string;
    data?: WalletQuote[];
  }>(`/api/binance?${qs.toString()}`, params.signal);
  if (String(json.code) !== "0") {
    throw new Error(json.error ?? json.msg ?? `Binance quote error ${json.code}`);
  }
  const row = json.data?.[0];
  if (!row) throw new Error("No route for this pair.");
  return row;
}

export async function fetchBinSwap(params: {
  quoteId: string;
  from: string;
  to: string;
  amount: string;
  wallet: string;
  slippagePercent: string;
  signal?: AbortSignal;
}): Promise<WalletSwap> {
  const qs = new URLSearchParams({
    ep: "swap",
    binanceChainId: "56",
    quoteId: params.quoteId,
    fromTokenAddress: params.from,
    toTokenAddress: params.to,
    amount: params.amount,
    userWalletAddress: params.wallet,
    slippagePercent: params.slippagePercent,
  });
  const json = await getJson<{
    code?: number | string;
    msg?: string;
    error?: string;
    data?: WalletSwap;
  }>(`/api/binance?${qs.toString()}`, params.signal);
  if (String(json.code) !== "0") {
    throw new Error(json.error ?? json.msg ?? `Binance swap error ${json.code}`);
  }
  const swap = json.data;
  if (!swap) throw new Error("Binance returned no swap.");
  if (!swap.tx?.to || !swap.tx?.data) {
    if (swap.executionMode === "RFQ" || swap.rfq) {
      throw new Error("This route needs RFQ signing, which Veyl does not support yet.");
    }
    throw new Error("Binance returned no transaction.");
  }
  return swap;
}
