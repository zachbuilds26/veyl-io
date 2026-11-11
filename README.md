# Veyl

Research and trade tokenized stocks (bStocks) priced in USDT on BNB Smart Chain, as a
Nimiq Pay mini app.

The bStock universe, spot prices, chart history, on-chain stats and swap routing all
come from Binance: the bStocks registry, Binance spot markets and the Binance Web3
aggregator. There is no other market data dependency.

## Requirements

- Node.js 20.12 or newer (the server uses `process.loadEnvFile`)
- A Nimiq Pay environment for wallet connect, signing and swaps

## Run

```bash
npm install
npm run build
npm start
```

The server serves `dist/` on `http://localhost:3001` and proxies Binance. For local
development run both processes:

```bash
npm run dev
```

Create `.env.local` with the trading credentials:

```
BINANCE_WEB3_API_KEY=...
BINANCE_WEB3_SECRET_KEY=...
```

Without the keys the market surface still loads; quote and swap endpoints return 503.

| Script | Purpose |
| --- | --- |
| `npm run dev` | API server plus Vite dev server |
| `npm run build` | Typecheck and build `dist/` |
| `npm start` | Serve `dist/` and the API |
| `npm run typecheck` | Typecheck only |

## Routes

| Route | Purpose |
| --- | --- |
| `GET /api/health` | Liveness plus cached universe size |
| `GET /api/market` | Assets, spot quotes and 24h token stats |
| `GET /api/stock/:param` | One asset by ticker, symbol or address, plus candles and on-chain stats |
| `GET /api/geo` | Country lookup for the eligibility gate |
| `GET /api/binance?ep=` | Signed Binance Web3 proxy (quote, swap, approve) |

Optional environment:

- `PORT` (default `3001`)
- `VITE_BSC_RPC` (build time, read RPC; defaults to a public BSC endpoint)
- `TRUST_PROXY=1` when running behind a trusted reverse proxy, so `X-Forwarded-For`
  is honoured for geo and rate limiting
- `GEO_FORCE_US=1` to exercise the blocked screen locally

## Eligibility

First-time visitors see a Terms and Conditions screen with two mandatory
confirmations: (1) not a citizen, resident, national or tax resident of the US or any
of its territories, and not located in or acting on behalf of anyone in a Restricted
Jurisdiction (US and territories, Cuba, Iran, North Korea, Syria, OFAC
comprehensively sanctioned jurisdictions); (2) agreement to the terms and risk
disclosures. Acceptance is stored per browser (`veyl.eligibility.v1`).

The server also exposes `/api/geo` (ipwho.is, 10 minute cache), which blocks US and
sanctioned country codes before the app renders. The check fails closed: if the
location cannot be resolved, the app stays closed and offers a retry instead of
opening.

## Wallet and trading

Veyl runs inside Nimiq Pay. Connect, sign and swap use the EIP-1193 provider Nimiq Pay
injects at `window.ethereum` (EIP-6963 discoverable), and chain switches to BNB Chain
(`0x38`) happen on demand. Outside Nimiq Pay the Connect action explains how to open
the app there instead. Balances are read over the public BSC RPC, so no keys leave the
wallet.

Portfolio shows the total USD value of USDT plus bStock balances at live Binance spot
prices, a holdings list, and a per-wallet feed of confirmed swaps linking to BscScan.

Quotes are executable against the Binance Web3 aggregator. The wallet must be on BNB
Chain and funded for gas; the sell token is approved once per token pair, and
`binanceChainId` is fixed server-side to 56. Veyl never holds keys or funds.

## Layout

- `server/index.mjs` static server plus Binance routes and the signed `/api/binance`
  proxy, with short-lived caches
- `src/lib/assets.ts` asset shape, filled from the live bStock universe
- `src/lib/api.ts` typed fetchers for market, chart and quote/swap
- `src/lib/wallet.ts` Nimiq Pay provider access, BSC helpers
- `src/lib/nimiq.ts` Nimiq Pay detection (`window.nimiqPay`)
- `src/hooks/useWallet.tsx` shared wallet state
- `src/hooks/useHoldings.ts` bToken and USDT balances in one multicall
- `src/lib/activity.ts` swap ledger persisted per wallet in localStorage
- `src/components/TradeCard.tsx` quote, approve and swap flow signed in the wallet
- `src/hooks/useMarket.ts` market polling
- `src/components/` Explore, StockDetail, Portfolio, Header, Footer

## Compliance

Tokenized equities are not offered to US persons or residents of restricted
jurisdictions. A production deployment needs country blocking, a non-US declaration
and the issuer's documents before launch.

## License

MIT. See [LICENSE](LICENSE).
