export interface TokenChatterPluginOptions {
  /**
   * Accent color for tabs, live dot, and the "new messages" pill.
   * Default: CDEX green `#32c15f`.
   */
  accentColor?: string
  /**
   * Override the Gist raw base URL if you self-host the aggregation cache.
   * Default: the CDEX-maintained public cache (refreshed every 30 min).
   */
  gistRawUrl?: string
  /** Poll interval in ms while the Chatter tab is visible. Default 45000. */
  pollIntervalMs?: number
  /** Initial tab shown on the chart slot. Default "chart". */
  defaultTab?: 'chart' | 'chatter'
  /** Optional note pinned under the feed (e.g. a posting CTA). */
  footerNote?: string
  /**
   * Explicit symbol resolver, used when the host does not pass a `symbol`
   * prop to the chart widget. Receives the interceptor props.
   */
  resolveSymbol?: (props: Record<string, unknown>) => string | undefined
}
