/**
 * Token chatter feed — fetch + normalize + merge pipeline.
 *
 * Framework-free: runs anywhere `fetch` exists (browser, edge, node 18+).
 *
 * Data source
 * ───────────
 * Three JSON files per base symbol on a public GitHub Gist, refreshed every
 * 30 minutes by the CDEX aggregation service:
 *   reddit-{BASE}.json     — Reddit posts (multi-subreddit relevance search)
 *   farcaster-{BASE}.json  — Warpcast public search-casts
 *   news-{BASE}.json       — CoinDesk / CoinTelegraph / Bitcoinist RSS
 *                            (+ Yahoo Finance RSS for RWA/stock perps)
 * GitHub raw gist responses send `Access-Control-Allow-Origin: *`, so the
 * browser can fetch them directly — no backend required in the host DEX.
 *
 * Merge strategy
 * ──────────────
 * Fetch all source files in parallel, normalize, apply per-source quality
 * floors, rank by hot-score (engagement / age decay), enforce a per-source
 * quota for diversity, backfill gaps from the overflow pool, then sort the
 * final set freshest-first.
 */
import type { ChatFeed, ChatMessage, ChatSource } from './types'

export const DEFAULT_GIST_RAW =
  'https://gist.githubusercontent.com/alnany/4b150e9f5ea378fdc032618ca13b1732/raw'

const SOURCES: readonly ChatSource[] = ['reddit', 'farcaster', 'news']

/** Extract base ticker from an Orderly symbol — `PERP_BTC_USDC` → `BTC`. */
export function baseToken(symbol: string): string {
  const parts = symbol.split('_')
  if (parts.length >= 3 && parts[0] === 'PERP') return parts[1]
  return parts.find((p) => /^[A-Z0-9]+$/.test(p)) ?? symbol
}

// ─── Per-source normalizers ──────────────────────────────────────────────

/** Tiny FNV-1a — deterministic id from url + salt, no crypto dependency. */
function hashId(salt: string, url: string): string {
  let h = 2166136261
  const s = `${salt}|${url}`
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(36)
}

function normalizeReddit(raw: unknown[], base: string): ChatMessage[] {
  const out: ChatMessage[] = []
  for (const p of raw) {
    if (!p || typeof p !== 'object') continue
    const r = p as Record<string, unknown>
    const title = String(r.title ?? '').trim()
    const url = String(r.url ?? '')
    if (!title || !url) continue
    const subreddit = String(r.subreddit ?? '')
    const created = Number(r.created_utc ?? 0)
    out.push({
      id: `reddit:${hashId('reddit', url)}`,
      source: 'reddit',
      sourceLabel: subreddit ? `r/${subreddit}` : 'Reddit',
      handle: subreddit ? `r/${subreddit}` : 'reddit',
      body: title,
      bodyExtended: String(r.selftext ?? '') || undefined,
      score: Number(r.score ?? 0) || undefined,
      commentCount: Number(r.num_comments ?? 0) || undefined,
      timestamp: created > 0 ? created * 1000 : Date.now(),
      permalinkUrl: url,
      symbolBase: base,
    })
  }
  return out
}

function normalizeFarcaster(raw: unknown[], base: string): ChatMessage[] {
  const out: ChatMessage[] = []
  for (const c of raw) {
    if (!c || typeof c !== 'object') continue
    const r = c as Record<string, unknown>
    const text = String(r.text ?? '').trim()
    const hash = String(r.hash ?? '')
    if (!text) continue
    const author = String(r.author ?? '')
    const url =
      String(r.url ?? '') || (hash ? `https://warpcast.com/~/cast/${hash}` : '')
    out.push({
      id: hash ? `farcaster:${hash}` : `farcaster:${hashId('fc', url || text)}`,
      source: 'farcaster',
      sourceLabel: 'Warpcast',
      handle: author ? `@${author}` : '@warpcast',
      body: text,
      score: Number(r.reactions ?? 0) || undefined,
      commentCount: Number(r.recasts ?? 0) || undefined,
      timestamp: Number(r.timestamp ?? Date.now()),
      permalinkUrl: url,
      symbolBase: base,
    })
  }
  return out
}

function normalizeNews(raw: unknown[], base: string): ChatMessage[] {
  const out: ChatMessage[] = []
  for (const n of raw) {
    if (!n || typeof n !== 'object') continue
    const r = n as Record<string, unknown>
    const title = String(r.title ?? '').trim()
    const url = String(r.url ?? '')
    if (!title || !url) continue
    const published = String(r.published ?? '')
    const ts = published ? Date.parse(published) : 0
    let host = 'News'
    try {
      const src = String(r.source ?? url)
      const h = new URL(src).host.replace(/^www\./, '')
      host = h.split('.')[0]
      host = host.charAt(0).toUpperCase() + host.slice(1)
    } catch {
      /* keep default */
    }
    out.push({
      id: `news:${hashId('news', url)}`,
      source: 'news',
      sourceLabel: host,
      handle: host,
      body: title,
      bodyExtended: String(r.description ?? '') || undefined,
      timestamp: Number.isFinite(ts) && ts > 0 ? ts : Date.now(),
      permalinkUrl: url,
      symbolBase: base,
    })
  }
  return out
}

const NORMALIZERS: Record<
  ChatSource,
  (raw: unknown[], base: string) => ChatMessage[]
> = {
  reddit: normalizeReddit,
  farcaster: normalizeFarcaster,
  news: normalizeNews,
}

// ─── Fetch ───────────────────────────────────────────────────────────────

async function fetchSource(
  gistRaw: string,
  prefix: ChatSource,
  base: string,
): Promise<ChatMessage[]> {
  try {
    const res = await fetch(`${gistRaw}/${prefix}-${base}.json`, {
      cache: 'no-store',
    })
    if (!res.ok) return []
    const payload = (await res.json()) as unknown
    // Accept either a bare array (current shape) or { messages: [...] }
    // (future pre-normalized shape).
    if (Array.isArray(payload)) return NORMALIZERS[prefix](payload, base)
    if (
      payload &&
      typeof payload === 'object' &&
      Array.isArray((payload as { messages?: unknown }).messages)
    ) {
      return (payload as { messages: ChatMessage[] }).messages
    }
    return []
  } catch {
    return []
  }
}

// ─── Quality + ranking ───────────────────────────────────────────────────

const MIN = {
  reddit: { score: 2 },
  farcaster: { engagement: 1, maxAgeHours: 48 },
  news: { maxAgeHours: 36 },
} as const

/** HN-style hot rank: freshness traded against engagement. */
function quality(m: ChatMessage, nowMs: number): number {
  const ageH = Math.max(0.1, (nowMs - (m.timestamp ?? nowMs)) / 3_600_000)
  switch (m.source) {
    case 'reddit':
    case 'farcaster': {
      const eng = (m.score ?? 0) + (m.commentCount ?? 0) * 2
      return (eng + 1) / Math.pow(ageH + 2, 1.4)
    }
    case 'news':
    default:
      return 1 / Math.pow(ageH + 1, 1.2)
  }
}

function passesFloor(m: ChatMessage, nowMs: number): boolean {
  const ageH = (nowMs - (m.timestamp ?? nowMs)) / 3_600_000
  switch (m.source) {
    case 'reddit':
      return (m.score ?? 0) >= MIN.reddit.score
    case 'farcaster': {
      if (ageH > MIN.farcaster.maxAgeHours) return false
      const eng = (m.score ?? 0) + (m.commentCount ?? 0)
      return eng >= MIN.farcaster.engagement || ageH <= 6
    }
    case 'news':
      return ageH <= MIN.news.maxAgeHours
    default:
      return true
  }
}

/** Normalized first-8-words key so cross-posted titles dedup. */
function dedupKey(m: ChatMessage): string {
  const norm = m.body
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .split(/\s+/)
    .slice(0, 8)
    .join(' ')
  return `${m.source}:${norm}`
}

export interface FetchFeedOptions {
  /** Override the Gist raw base URL (self-hosted cache). */
  gistRawUrl?: string
  /** Max messages returned (default 20). */
  total?: number
}

/**
 * Fetch and assemble the chatter feed for an Orderly symbol
 * (e.g. `PERP_BTC_USDC`) or bare base ticker (e.g. `BTC`).
 */
export async function fetchChatterFeed(
  symbol: string,
  opts: FetchFeedOptions = {},
): Promise<ChatFeed> {
  const gistRaw = opts.gistRawUrl ?? DEFAULT_GIST_RAW
  const TOTAL = opts.total ?? 20
  const base = baseToken(symbol)

  const results = await Promise.all(
    SOURCES.map((s) => fetchSource(gistRaw, s, base)),
  )

  const QUOTA: Record<ChatSource, number> = {
    reddit: Math.round(TOTAL * 0.35),
    farcaster: Math.round(TOTAL * 0.35),
    news: TOTAL - 2 * Math.round(TOTAL * 0.35),
  }

  const nowMs = Date.now()
  const seen = new Set<string>()
  const dedup = new Set<string>()

  const pools: Record<ChatSource, ChatMessage[]> = {
    reddit: [],
    farcaster: [],
    news: [],
  }
  results.forEach((msgs, i) => {
    const prefix = SOURCES[i]
    pools[prefix] = msgs
      .filter((m) => m?.id && passesFloor(m, nowMs))
      .filter((m) => {
        const k = dedupKey(m)
        if (dedup.has(k)) return false
        dedup.add(k)
        return true
      })
      .sort((a, b) => quality(b, nowMs) - quality(a, nowMs))
  })

  const merged: ChatMessage[] = []
  const overflow: ChatMessage[] = []

  for (const s of SOURCES) {
    const pool = pools[s]
    for (const m of pool.slice(0, QUOTA[s])) {
      if (seen.has(m.id)) continue
      seen.add(m.id)
      merged.push(m)
    }
    for (const m of pool.slice(QUOTA[s])) {
      if (!seen.has(m.id)) overflow.push(m)
    }
  }

  if (merged.length < TOTAL) {
    overflow.sort((a, b) => quality(b, nowMs) - quality(a, nowMs))
    for (const m of overflow) {
      if (merged.length >= TOTAL) break
      if (seen.has(m.id)) continue
      seen.add(m.id)
      merged.push(m)
    }
  }

  const messages = [...merged]
    .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))
    .slice(0, TOTAL)

  return { base, messages, fetchedAt: Date.now() }
}
