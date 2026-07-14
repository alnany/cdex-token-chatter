/**
 * TokenChatterWidget — "Chart | Chatter" tab wrap around the host's chart.
 *
 * The TradingView chart is expensive to remount, so BOTH panes stay mounted
 * and visibility toggles via CSS. Polling pauses while the chatter pane is
 * hidden.
 */
import type { FC, ReactNode } from 'react'
import { memo, useState } from 'react'
import { useChatterFeed } from './tokenChatter.script'
import { TokenChatterUi } from './tokenChatter.ui'
import { baseToken } from '../../lib/feed'

export interface TokenChatterWidgetProps {
  /** The host's original chart element. */
  chart: ReactNode
  /** Orderly symbol (`PERP_BTC_USDC`) or bare base (`BTC`). */
  symbol: string
  accentColor?: string
  footerNote?: string
  gistRawUrl?: string
  pollIntervalMs?: number
  /** Initial tab (default "chart"). */
  defaultTab?: 'chart' | 'chatter'
}

const tabButtonStyle = (active: boolean, accent: string) => ({
  appearance: 'none' as const,
  background: 'none',
  border: 'none',
  borderBottom: `2px solid ${active ? accent : 'transparent'}`,
  padding: '6px 10px 5px',
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: '0.06em',
  textTransform: 'uppercase' as const,
  color: active ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.45)',
  cursor: 'pointer',
  transition: 'color 120ms ease',
})

export const TokenChatterWidget: FC<TokenChatterWidgetProps> = memo(
  ({
    chart,
    symbol,
    accentColor = '#32c15f',
    footerNote,
    gistRawUrl,
    pollIntervalMs,
    defaultTab = 'chart',
  }) => {
    const [tab, setTab] = useState<'chart' | 'chatter'>(defaultTab)
    const showChatter = tab === 'chatter'

    const { feed, isLoading, error } = useChatterFeed({
      symbol,
      gistRawUrl,
      pollIntervalMs,
      paused: !showChatter,
    })

    const base = feed?.base ?? baseToken(symbol)

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          width: '100%',
          minHeight: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            padding: '0 8px',
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            style={tabButtonStyle(!showChatter, accentColor)}
            onClick={() => setTab('chart')}
          >
            Chart
          </button>
          <button
            type="button"
            style={tabButtonStyle(showChatter, accentColor)}
            onClick={() => setTab('chatter')}
          >
            Chatter
          </button>
        </div>

        {/* Both panes stay mounted; visibility toggles via CSS. */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: showChatter ? 'none' : 'block',
          }}
        >
          {chart}
        </div>
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: showChatter ? 'block' : 'none',
          }}
        >
          <TokenChatterUi
            base={base}
            messages={feed?.messages ?? []}
            isLoading={isLoading}
            error={error}
            accentColor={accentColor}
            footerNote={footerNote}
          />
        </div>
      </div>
    )
  },
)

TokenChatterWidget.displayName = 'TokenChatterWidget'
