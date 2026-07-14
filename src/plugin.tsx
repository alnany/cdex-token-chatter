import React from 'react'
import type { OrderlySDK } from '@orderly.network/plugin-core'
import { TokenChatterWidget } from './components/tokenChatter'
import type { TokenChatterPluginOptions } from './types/plugin'

/**
 * Register the CdexTokenChatter plugin.
 *
 * Wraps the desktop TradingView chart slot with a "Chart | Chatter" tab
 * switch. The Chatter tab shows a live social feed (Reddit + Farcaster +
 * crypto news) for the active perp symbol, served from a public
 * CDN-cached aggregation layer — no host backend required.
 */
export function registerTokenChatterPlugin(
  options: TokenChatterPluginOptions = {},
) {
  return (SDK: OrderlySDK) => {
    SDK.registerPlugin({
      id: 'cdex-token-chatter',
      name: 'CdexTokenChatter',
      version: '0.1.0',
      orderlyVersion: '>=3.0.0',

      interceptors: [
        {
          // Runtime injectable path (not in the scaffold subset; see
          // handbook "Runtime injector targets").
          target: 'TradingView.Desktop',
          component: (
            Original: React.ComponentType<Record<string, unknown>>,
            props: Record<string, unknown>,
            _api: unknown,
          ) => {
            const symbol =
              (typeof props.symbol === 'string' && props.symbol) ||
              options.resolveSymbol?.(props) ||
              ''

            // No symbol resolvable — render the chart untouched rather
            // than showing a broken feed.
            if (!symbol) return <Original {...props} />

            return (
              <TokenChatterWidget
                chart={<Original {...props} />}
                symbol={symbol}
                accentColor={options.accentColor}
                footerNote={options.footerNote}
                gistRawUrl={options.gistRawUrl}
                pollIntervalMs={options.pollIntervalMs}
                defaultTab={options.defaultTab}
              />
            )
          },
        },
      ],

      setup: (_api) => {
        // No global event subscriptions needed.
      },
    })
  }
}
