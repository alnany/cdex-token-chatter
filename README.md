# cdex-token-chatter

Live social chatter for every perp on your Orderly DEX — Reddit threads, Farcaster casts, and crypto/stock news for the active symbol, rendered as a chat-style feed in a **Chart | Chatter** tab on the trading page.

Built and battle-tested on [CDEX](https://cdex.me).

## Features

- **Zero backend** — the feed is served from a public, CORS-open, CDN-cached aggregation layer maintained by CDEX and refreshed every 30 minutes. No API keys, no proxy, no server.
- **~125 symbols covered** — every Orderly perp base, including RWA/stock perps (TSLA, NVDA, XAU, …) with market-appropriate news sources.
- **Quality-ranked merge** — per-source engagement/freshness floors, HN-style hot ranking, per-source diversity quotas, title dedup.
- **Chat UX** — newest at bottom, auto-scroll with a "↓ N new" pill when you've scrolled up, staggered bubble animations, expandable long posts, source provenance badges.
- **Chart-safe** — the TradingView chart never remounts when switching tabs; feed polling pauses while hidden.
- **Self-contained styling** — inline styles only, tuned for dark hosts; no Tailwind/CSS import required.

## Install

```bash
npm install cdex-token-chatter
```

## Usage

```tsx
import { OrderlyAppProvider } from "@orderly.network/react-app";
import { registerTokenChatterPlugin } from "cdex-token-chatter";

<OrderlyAppProvider
  brokerId="your-broker-id"
  networkId="mainnet"
  plugins={[registerTokenChatterPlugin()]}
>
  <TradingPage />
</OrderlyAppProvider>;
```

### Options

| Option | Default | Description |
| --- | --- | --- |
| `accentColor` | `#32c15f` | Tabs, live dot, "new messages" pill |
| `defaultTab` | `"chart"` | Initial tab on the chart slot |
| `pollIntervalMs` | `45000` | Refresh cadence while the Chatter tab is visible |
| `footerNote` | — | Optional note pinned under the feed |
| `gistRawUrl` | CDEX cache | Self-hosted aggregation cache override |
| `resolveSymbol` | — | `(props) => symbol` fallback if your host doesn't pass `symbol` to the chart |

## Interceptor

Targets the `TradingView.Desktop` injectable path (desktop trading page). Mobile layouts are unaffected.

## Data pipeline

Three JSON files per base symbol, refreshed every 30 minutes:

- `reddit-{BASE}.json` — multi-subreddit relevance search
- `farcaster-{BASE}.json` — Warpcast public search-casts
- `news-{BASE}.json` — CoinDesk / CoinTelegraph / Bitcoinist RSS (+ Yahoo Finance for RWA symbols)

The plugin fetches these directly from the browser, normalizes each source into a unified message shape, applies quality floors, and merges with per-source quotas.

You can also use the pipeline headlessly:

```ts
import { fetchChatterFeed } from "cdex-token-chatter";
const feed = await fetchChatterFeed("PERP_BTC_USDC");
```

## Development

```bash
npm install
npm run typecheck
npm run build
```

## License

MIT
