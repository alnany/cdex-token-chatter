import { useEffect, useRef, useState } from 'react'
import { fetchChatterFeed } from '../../lib/feed'
import type { ChatFeed } from '../../lib/types'

export interface UseChatterFeedOptions {
  /** Orderly symbol (`PERP_BTC_USDC`) or bare base ticker (`BTC`). */
  symbol: string
  /** Poll interval in ms (default 45s). */
  pollIntervalMs?: number
  /** Override the Gist raw base URL. */
  gistRawUrl?: string
  /** Max messages (default 20). */
  total?: number
  /** Pause polling (e.g. when the panel is hidden). */
  paused?: boolean
}

export interface UseChatterFeedResult {
  feed: ChatFeed | null
  isLoading: boolean
  error: boolean
}

/**
 * Business-logic hook: polls the chatter feed for a symbol.
 * Keeps previous data while refreshing (no flash), resets on symbol change.
 */
export function useChatterFeed(
  opts: UseChatterFeedOptions,
): UseChatterFeedResult {
  const { symbol, pollIntervalMs = 45_000, gistRawUrl, total, paused } = opts
  const [feed, setFeed] = useState<ChatFeed | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(false)
  const generation = useRef(0)

  useEffect(() => {
    if (!symbol || paused) return
    const gen = ++generation.current
    let timer: ReturnType<typeof setTimeout> | undefined
    let cancelled = false

    setIsLoading(true)

    const tick = async () => {
      try {
        const next = await fetchChatterFeed(symbol, { gistRawUrl, total })
        if (cancelled || gen !== generation.current) return
        setFeed(next)
        setError(false)
      } catch {
        if (cancelled || gen !== generation.current) return
        setError(true)
      } finally {
        if (!cancelled && gen === generation.current) {
          setIsLoading(false)
          timer = setTimeout(tick, pollIntervalMs)
        }
      }
    }

    void tick()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [symbol, pollIntervalMs, gistRawUrl, total, paused])

  // Reset stale feed when the symbol changes so the old token's messages
  // never flash under the new token's header.
  const prevSymbol = useRef(symbol)
  useEffect(() => {
    if (prevSymbol.current !== symbol) {
      prevSymbol.current = symbol
      setFeed(null)
      setIsLoading(true)
    }
  }, [symbol])

  return { feed, isLoading, error }
}
