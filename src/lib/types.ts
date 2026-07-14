/**
 * Unified chat message shape across all sources.
 *
 * Every raw item (Reddit post, Farcaster cast, news article) is normalized
 * into this shape on read so the feed UI never branches on source for
 * layout — only for the small provenance badge.
 */
export type ChatSource = 'reddit' | 'farcaster' | 'news'

export interface ChatMessage {
  /** Stable id: `<source>:<hash>`. Used as React key + de-dup key. */
  id: string
  source: ChatSource
  /** Short human label like `r/CryptoCurrency`, `Warpcast`, `Coindesk`. */
  sourceLabel: string
  /** Author handle as displayed: `r/foo`, `@bar`, `Coindesk`. */
  handle: string
  /** Primary message text — for Reddit this is the post title. */
  body: string
  /** Optional longer text revealed on expand — Reddit selftext etc. */
  bodyExtended?: string
  /** Source-native score: Reddit upvotes, Farcaster reactions. */
  score?: number
  /** Source-native reply/comment count. */
  commentCount?: number
  /** Unix ms. Feed sorts desc by this. */
  timestamp: number
  /** Click target — opens original on the source platform. */
  permalinkUrl: string
  /** Resolved base token, e.g. "BTC". */
  symbolBase: string
}

export interface ChatFeed {
  base: string
  messages: ChatMessage[]
  /** Unix ms of the last successful fetch. */
  fetchedAt: number
}
