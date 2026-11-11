import express from "express";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
try {
  process.loadEnvFile(path.join(__dirname, "..", ".env.local"));
} catch {
  /* .env.local is optional; the server runs without it until a wallet connects */
}
const TRUST_PROXY = process.env.TRUST_PROXY === "1";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const BSC = "56";
const BINANCE = "https://www.binance.com";
const SPOT = "https://api.binance.com";
const BINANCE_WEB3 = "https://web3.binance.com/build";

const BAPI_HEADERS = {
  "Accept-Encoding": "identity",
  "User-Agent": "veyl/0.1",
  "Accept": "application/json",
};

const app = express();
app.disable("x-powered-by");

const cache = new Map();
const GEO_BLOCKED = new Set(["US", "PR", "GU", "VI", "AS", "MP", "UM", "CU", "IR", "KP", "SY"]);
const geoCache = new Map();
const GEO_TTL_MS = 10 * 60 * 1000;

function isPrivateIp(ip) {
  if (!ip || ip === "unknown") return true;
  const addr = ip.replace(/^\[|\]$/g, "").replace(/^::ffff:/i, "").toLowerCase();
  if (addr === "::1" || addr === "::" || addr === "0.0.0.0") return true;
  if (addr.startsWith("127.") || addr.startsWith("10.") || addr.startsWith("192.168.")) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(addr)) return true;
  if (/^169\.254\./.test(addr) || /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(addr)) return true;
  if (/^(fc|fd|fe80|ff)/.test(addr)) return true;
  return false;
}

async function resolveCountry(ip) {
  const hit = geoCache.get(ip);
  if (hit && hit.expiresAt > Date.now()) return hit.country;
  let country = null;
  try {
    const res = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, {
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      const body = await res.json();
      const code = typeof body?.country_code === "string" ? body.country_code.toUpperCase() : null;
      if (body?.success !== false && code && /^[A-Z]{2}$/.test(code)) country = code;
    }
  } catch (error) {
    console.warn(`geo lookup failed for ${ip}:`, error?.message ?? error);
  }
  geoCache.set(ip, { country, expiresAt: Date.now() + GEO_TTL_MS });
  return country;
}

const inflight = new Map();

async function cached(key, ttlMs, fn) {
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value;
  if (inflight.has(key)) return inflight.get(key);

  const pending = (async () => {
    try {
      const value = await fn();
      cache.set(key, { value, expiresAt: Date.now() + ttlMs });
      return value;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, pending);
  return pending;
}

async function staleWhileRevalidate(key, ttlMs, fn) {
  const hit = cache.get(key);
  const run = async () => {
    const pending = (async () => {
      try {
        const value = await fn();
        cache.set(key, { value, expiresAt: Date.now() + ttlMs });
        return value;
      } finally {
        inflight.delete(key);
      }
    })();
    inflight.set(key, pending);
    return pending;
  };

  if (hit && hit.expiresAt > Date.now()) return hit.value;
  if (inflight.has(key)) return inflight.get(key);
  if (hit) {
    void run().catch(() => {
      /* keep serving stale until a refresh succeeds */
    });
    return hit.value;
  }
  return run();
}

async function getText(url, headers = {}) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9", ...headers },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`upstream ${res.status}`);
  return res.text();
}

async function getJson(url, headers = {}) {
  const text = await getText(url, { Accept: "application/json", ...headers });
  return JSON.parse(text);
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/* Binance RWA (bStocks) registry, cached 1h with meta names */

async function getUniverseRaw() {
  const json = await getJson(
    `${BINANCE}/bapi/defi/v1/public/wallet-direct/buw/wallet/market/token/rwa/stock/detail/list/ai?type=3`,
    BAPI_HEADERS,
  );
  if (json?.code !== "000000" || !json?.success) throw new Error(`universe error ${json?.code}`);
  const list = Array.isArray(json.data) ? json.data : (json.data?.list ?? []);
  return list
    .filter((item) => String(item.chainId) === "56")
    .map((item) => ({
      symbol: String(item.symbol ?? ""),
      ticker: String(item.ticker ?? "").toUpperCase(),
      address: String(item.contractAddress ?? ""),
      cs: String(item.cs ?? ""),
      decimals: Number(item.d ?? 18),
      multiplier: String(item.multiplier ?? "1"),
    }));
}

async function getMeta(address) {
  const json = await getJson(
    `${BINANCE}/bapi/defi/v1/public/wallet-direct/buw/wallet/dex/market/token/meta/info?chainId=${BSC}&contractAddress=${encodeURIComponent(address)}`,
    BAPI_HEADERS,
  );
  return json?.data?.name ?? null;
}

async function getUniverse() {
  return cached("universe", 3_600_000, async () => {
    const assets = await getUniverseRaw();
    await Promise.allSettled(
      chunk(assets, 15).map(async (group) => {
        const named = await Promise.allSettled(group.map((asset) => getMeta(asset.address)));
        group.forEach((asset, index) => {
          const name = named[index];
          if (name.status === "fulfilled" && name.value) {
            asset.name = name.value.replace(/ \(bStocks\)$/, "");
          } else {
            asset.name = asset.ticker;
          }
        });
      }),
    );
    return assets
      .filter((asset) => asset.cs)
      .map((asset) => ({
        symbol: asset.symbol,
        ticker: asset.ticker,
        address: asset.address,
        cs: asset.cs.toUpperCase(),
        decimals: asset.decimals,
        name: asset.name,
        logo: `/tokens/${asset.address.toLowerCase()}.png`,
      }));
  });
}

/* Binance spot 24h tickers, cached 15s with stale-while-revalidate */

async function spotGroup(symbols, attempt = 1) {
  try {
    const json = await getJson(
      `${SPOT}/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(symbols))}`,
      BAPI_HEADERS,
    );
    if (!Array.isArray(json)) throw new Error("spot malformed response");
    return json;
  } catch (error) {
    if (attempt >= 3) throw error;
    console.warn(`[spot] chunk failed (attempt ${attempt}):`, error?.message ?? error);
    await new Promise((resolve) => setTimeout(resolve, 1200 * attempt));
    return spotGroup(symbols, attempt + 1);
  }
}

async function getSpotTickers() {
  const assets = await getUniverse();
  const symbols = assets.map((asset) => asset.cs);
  return cached("spot", 15_000, async () => {
    const pairs = chunk(symbols, 100);
    const rows = [];
    for (const group of pairs) {
      try {
        rows.push(...(await spotGroup(group)));
      } catch (error) {
        console.warn("[spot] chunk dropped, retrying per symbol:", error?.message ?? error);
        const settled = await Promise.allSettled(
          group.map(async (symbol) => (await spotGroup([symbol]))[0]),
        );
        for (const result of settled) {
          if (result.status === "fulfilled" && result.value) rows.push(result.value);
        }
      }
    }
    if (rows.length === 0) throw new Error("spot returned no rows");
    const out = {};
    for (const row of rows) {
      out[String(row.symbol).toUpperCase()] = {
        price: numberOrNull(row.lastPrice),
        previousClose: numberOrNull(row.prevClosePrice),
        changePct: numberOrNull(row.priceChangePercent),
        high: numberOrNull(row.highPrice),
        low: numberOrNull(row.lowPrice),
        open: numberOrNull(row.openPrice),
        volume: numberOrNull(row.volume),
        quoteVolume: numberOrNull(row.quoteVolume),
        count: numberOrNull(row.count),
      };
    }
    return out;
  });
}

/* Klines for the chart */

const RANGES = {
  "1D": { interval: "15m", limit: 96 },
  "1W": { interval: "1h", limit: 168 },
  "1M": { interval: "1d", limit: 30 },
  "6M": { interval: "1d", limit: 182 },
  "1Y": { interval: "1d", limit: 300 },
};

async function getKline(address, interval, limit) {
  const path = `/bapi/defi/v1/public/wallet-direct/buw/wallet/dex/market/token/kline/ai?chainId=${BSC}&contractAddress=${encodeURIComponent(address)}&interval=${encodeURIComponent(interval)}&limit=${encodeURIComponent(limit)}`;
  const json = await staleWhileRevalidate(`kline:${path}`, 60_000, async () => {
    const res = await fetch(`${BINANCE}${path}`, {
      headers: BAPI_HEADERS,
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`bapi ${res.status} for kline`);
    const raw = await res.json();
    if (raw.code !== "000000" || !raw.success) throw new Error(`bapi error ${raw.code} for kline`);
    return (raw.data?.klineInfos ?? []).map((row) => [
      Number(row[0]),
      Number(row[1]),
      Number(row[2]),
      Number(row[3]),
      Number(row[4]),
      Number(row[5]),
      Number(row[6]),
    ]);
  });
  return json;
}

/* RWA dynamic data: on-chain price, holders, traders, market status */

async function getDynamic(address) {
  const path = `/bapi/defi/v2/public/wallet-direct/buw/wallet/market/token/rwa/dynamic/ai?chainId=${BSC}&contractAddress=${encodeURIComponent(address)}`;
  return staleWhileRevalidate(`dynamic:${address}`, 15_000, async () => {
    const json = await getJson(`${BINANCE}${path}`, BAPI_HEADERS);
    if (json?.code !== "000000" || !json?.success) throw new Error(`dynamic error ${json?.code}`);
    const data = json.data ?? {};
    const token = data.tokenInfo ?? {};
    const stock = data.stockInfo ?? {};
    const status = data.statusInfo ?? {};
    return {
      onchainPrice: numberOrNull(token.price),
      priceChangePct24h: numberOrNull(token.priceChangePct24h),
      volume24h: numberOrNull(token.volume24h),
      holders: numberOrNull(token.bnHolder),
      traders: numberOrNull(token.bnTrader),
      marketCap: numberOrNull(stock.marketCap),
      sharesMultiplier: numberOrNull(token.sharesMultiplier),
      openState: status.openState ?? null,
      reasonCode: status.reasonCode ?? null,
      fundamentals: {
        priceHigh52w: numberOrNull(stock.priceHigh52w),
        priceLow52w: numberOrNull(stock.priceLow52w),
        avgVolume30d: numberOrNull(stock.avgVolume30d),
        priceToEarnings: numberOrNull(stock.priceToEarnings),
        dividendYield: numberOrNull(stock.dividendYield),
        marketCap: numberOrNull(stock.marketCap),
      },
    };
  });
}

/* Order book depth: notional bid+ask liquidity (top 100 levels) */

async function getDepth(cs) {
  return staleWhileRevalidate(`depth:${cs}`, 30_000, async () => {
    const json = await getJson(`${SPOT}/api/v3/depth?symbol=${encodeURIComponent(cs)}&limit=100`, BAPI_HEADERS);
    const notional = (rows) =>
      (Array.isArray(rows) ? rows : []).reduce((sum, [price, qty]) => {
        const value = Number(price) * Number(qty);
        return Number.isFinite(value) ? sum + value : sum;
      }, 0);
    const total = notional(json.bids) + notional(json.asks);
    return Number.isFinite(total) ? total : null;
  });
}

/* Binance Web3 Trading API (quote/swap aggregator), HMAC-signed server-side */

const ALLOWED_ENDPOINTS = new Set([
  "supported/chain",
  "quote",
  "swap",
  "quote-and-swap",
  "approve-transaction",
  "history",
]);

const PARAM_WHITELIST = new Set([
  "binanceChainId",
  "fromTokenAddress",
  "toTokenAddress",
  "amount",
  "userWalletAddress",
  "quoteId",
  "slippagePercent",
]);

function binanceCreds() {
  const key = process.env.BINANCE_WEB3_API_KEY?.trim();
  const secret = process.env.BINANCE_WEB3_SECRET_KEY?.trim();
  return key && secret ? { key, secret } : null;
}

function clientIp(req) {
  if (TRUST_PROXY) {
    const fwd = String(req.headers["x-forwarded-for"] ?? "").split(",")[0].trim();
    if (fwd) return fwd;
  }
  return req.socket.remoteAddress || "unknown";
}

const rateLimitBuckets = new Map();
function rateLimit(key, limit, windowMs) {
  const now = Date.now();
  const bucket = rateLimitBuckets.get(key);
  if (!bucket || now - bucket.start >= windowMs) {
    rateLimitBuckets.set(key, { start: now, count: 1 });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= limit;
}

async function ocFetch(method, apiPath) {
  const creds = binanceCreds();
  if (!creds) {
    const error = new Error("Binance Web3 credentials missing (BINANCE_WEB3_API_KEY / BINANCE_WEB3_SECRET_KEY)");
    error.code = "credentials";
    throw error;
  }
  const ts = new Date().toISOString();
  const bodyStr = "";
  const prehash = ts + method + "/build" + apiPath + bodyStr;
  const sign = crypto.createHmac("sha256", creds.secret).update(prehash).digest("base64");
  const res = await fetch(BINANCE_WEB3 + apiPath, {
    method,
    headers: {
      "X-OC-APIKEY": creds.key,
      "X-OC-TIMESTAMP": ts,
      "X-OC-SIGN": sign,
      "User-Agent": UA,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Binance Web3 API HTTP ${res.status}`);
  return res.json();
}

/* Routes */

const ONE_HOUR_MS = 3_600_000;

setInterval(() => {
  const now = Date.now();
  for (const [key, value] of geoCache) {
    if (value.expiresAt <= now) geoCache.delete(key);
  }
  for (const [key, bucket] of rateLimitBuckets) {
    if (now - bucket.start >= ONE_HOUR_MS) rateLimitBuckets.delete(key);
  }
}, 10 * 60_000).unref();

app.get("/api/geo", async (req, res) => {
  if (!rateLimit(`geo:${clientIp(req)}`, 30, 60_000)) {
    res.status(429).json({ error: "Too many availability checks." });
    return;
  }
  if (process.env.GEO_FORCE_US === "1") {
    res.json({ country: "US", blocked: true });
    return;
  }
  const ip = clientIp(req);
  if (isPrivateIp(ip)) {
    res.json({ country: null, blocked: false });
    return;
  }
  const country = await resolveCountry(ip);
  if (!country) {
    res.status(503).json({ error: "Location unavailable. Try again shortly." });
    return;
  }
  res.json({ country, blocked: GEO_BLOCKED.has(country) });
});

app.get("/api/health", async (_req, res) => {
  const assets = await getUniverse().catch(() => []);
  res.json({ ok: assets.length > 0, assets: assets.length, updatedAt: new Date().toISOString() });
});

app.get("/api/market", async (_req, res) => {
  try {
    const assets = await getUniverse();
    const tickers = await getSpotTickers();
    const quotes = {};
    const tokens = {};
    for (const asset of assets) {
      const row = tickers[asset.cs];
      if (!row) continue;
      quotes[asset.ticker] = {
        ticker: asset.ticker,
        symbol: asset.cs,
        price: row.price,
        previousClose: row.previousClose,
        changePct: row.changePct,
        currency: "USDT",
      };
      tokens[asset.address.toLowerCase()] = {
        address: asset.address.toLowerCase(),
        priceUsd: row.price,
        volume24hUsd: row.quoteVolume,
        count24h: row.count,
      };
    }
    res.set("Cache-Control", "public, max-age=15, s-maxage=15, stale-while-revalidate=30");
    res.json({ assets, quotes, tokens, updatedAt: new Date().toISOString() });
  } catch (error) {
    console.error("[market] refresh failed:", error);
    res.status(502).json({ error: "Market data is unavailable right now." });
  }
});

app.get("/api/stock/:param", async (req, res) => {
  try {
    const param = String(req.params.param);
    const assets = await getUniverse();
    const asset = assets.find(
      (candidate) =>
        candidate.ticker.toUpperCase() === param.toUpperCase() ||
        candidate.symbol.toUpperCase() === param.toUpperCase() ||
        candidate.address.toLowerCase() === param.toLowerCase(),
    );
    if (!asset) {
      res.status(404).json({ error: "Unknown asset." });
      return;
    }
    const range = String(req.query.range ?? "1M").toUpperCase();
    if (!Object.prototype.hasOwnProperty.call(RANGES, range)) {
      res.status(400).json({ error: "Unsupported range." });
      return;
    }

    const tickers = await getSpotTickers();
    const spot = tickers[asset.cs] ?? null;
    const spec = RANGES[range];

    const [kline, dynamic, depth] = await Promise.allSettled([
      getKline(asset.address, spec.interval, spec.limit),
      getDynamic(asset.address),
      getDepth(asset.cs),
    ]);

    const candles = (kline.status === "fulfilled" ? kline.value : []).map((row) => ({
      t: row[0],
      c: row[4],
    }));
    const candlesClose = candles.map((point) => point.c);
    const low52 = dynamic.status === "fulfilled" ? dynamic.value.fundamentals.priceLow52w : null;

    const quote = spot
      ? {
          price: spot.price,
          previousClose: spot.previousClose,
          changePct: spot.changePct,
          dayHigh: spot.high,
          dayLow: spot.low,
          fiftyTwoWeekHigh: dynamic.status === "fulfilled" ? dynamic.value.fundamentals.priceHigh52w : null,
          fiftyTwoWeekLow: low52,
          volume: spot.quoteVolume,
          currency: "USDT",
          marketTime: null,
        }
      : dynamic.status === "fulfilled"
        ? {
            price: dynamic.value.onchainPrice,
            previousClose: null,
            changePct: dynamic.value.priceChangePct24h,
            dayHigh: null,
            dayLow: null,
            fiftyTwoWeekHigh: dynamic.value.fundamentals.priceHigh52w,
            fiftyTwoWeekLow: low52,
            volume: dynamic.value.volume24h,
            currency: "USDT",
            marketTime: null,
          }
        : null;

    res.set("Cache-Control", "public, max-age=30");
    res.json({
      ticker: asset.ticker,
      symbol: asset.symbol,
      name: asset.name,
      address: asset.address,
      priceFrom: "spot",
      quote,
      candles,
      token:
        dynamic.status === "fulfilled"
          ? {
              address: asset.address.toLowerCase(),
              priceUsd: dynamic.value.onchainPrice ?? spot?.price ?? null,
              volume24hUsd: spot?.quoteVolume ?? dynamic.value.volume24h,
              liquidityUsd: depth.status === "fulfilled" ? depth.value : null,
              holders: dynamic.value.holders,
              traders: dynamic.value.traders,
              openState: dynamic.value.openState,
              sharesMultiplier: dynamic.value.sharesMultiplier,
            }
          : null,
      range,
      candlesClose,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[stock] failed:", error);
    res.status(502).json({ error: "This asset is unavailable right now." });
  }
});

app.get("/api/binance", async (req, res) => {
  if (!rateLimit(`binance:${clientIp(req)}`, 60, 60_000)) {
    res.status(429).json({ error: "Too many requests. Try again in a minute." });
    return;
  }
  const ep = String(req.query.ep ?? "");
  if (!ALLOWED_ENDPOINTS.has(ep)) {
    res.status(400).json({ error: `unknown endpoint, allowed: ${[...ALLOWED_ENDPOINTS].join(", ")}` });
    return;
  }
  if (!binanceCreds()) {
    res.status(503).json({ error: "missing BINANCE_WEB3_API_KEY / BINANCE_WEB3_SECRET_KEY" });
    return;
  }

  const forward = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query)) {
    if (key === "ep") continue;
    if (!PARAM_WHITELIST.has(key)) {
      res.status(400).json({ error: `unsupported parameter: ${key}` });
      return;
    }
    const single = Array.isArray(value) ? value[0] : value;
    forward.set(key, String(single ?? ""));
  }
  forward.set("binanceChainId", BSC);
  for (const [key, value] of forward) {
    if (key.endsWith("Address") && !/^0x[0-9a-fA-F]{40}$/.test(value)) {
      res.status(400).json({ error: `invalid ${key} (expected 0x + 40 hex chars)` });
      return;
    }
    if (key === "amount" && !/^\d{1,78}$/.test(value)) {
      res.status(400).json({ error: "invalid amount (expected base-unit integer)" });
      return;
    }
    if (key === "slippagePercent" && !/^\d{1,2}(\.\d{1,4})?$/.test(value)) {
      res.status(400).json({ error: "invalid slippagePercent" });
      return;
    }
    if (key === "quoteId" && !/^[A-Za-z0-9_-]{1,128}$/.test(value)) {
      res.status(400).json({ error: "invalid quoteId" });
      return;
    }
  }

  try {
    const query = forward.toString();
    const data = await ocFetch("GET", `/api/v1/dex/aggregator/${ep}${query ? `?${query}` : ""}`);
    res.json(data);
  } catch (error) {
    console.error("[binance] upstream failure:", ep, error?.message ?? error);
    res.status(502).json({ error: "upstream failure" });
  }
});

if (process.env.VERCEL !== "1") {
const dist = path.join(__dirname, "..", "dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist, { index: false, maxAge: "1h" }));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api/")) {
      next();
      return;
    }
    res.set("Cache-Control", "no-cache");
    res.sendFile(path.join(dist, "index.html"));
  });
}

}
app.use((_req, res) => {
  res.status(404).json({ error: "Not found." });
});


export default app;
