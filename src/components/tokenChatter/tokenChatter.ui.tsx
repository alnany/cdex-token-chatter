/**
 * TokenChatter UI — social feed for the active perp symbol, rendered as
 * stacked chat bubbles (Telegram / Discord vibe).
 *
 * - Newest at the BOTTOM (real chat order). Auto-scrolls on first load and
 *   while the user is at the bottom; otherwise shows a "↓ N new" pill.
 * - Each message is a rounded bubble tinted with its source color; source
 *   dot + handle above, stats + relative time below.
 * - Inline styles only — zero CSS/Tailwind dependency on the host. Tuned
 *   for dark hosts (the Orderly SDK default); accent color configurable.
 */
import type { CSSProperties, FC } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChatMessage } from '../../lib/types'

const KEYFRAMES = `
@keyframes cdex-chatter-bubble-in {
  0% { opacity: 0; transform: translateY(8px) scale(0.96); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes cdex-chatter-bubble-pop {
  0% { opacity: 0; transform: translateY(14px) scale(0.9); }
  60% { transform: translateY(-2px) scale(1.02); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes cdex-chatter-ping {
  0% { transform: scale(1); opacity: 0.7; }
  75%, 100% { transform: scale(2.2); opacity: 0; }
}
.cdex-chatter-scroll { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.08) transparent; }
.cdex-chatter-scroll::-webkit-scrollbar { width: 6px; }
.cdex-chatter-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 3px; }
`

const SOURCE_THEME: Record<
  ChatMessage['source'],
  { dot: string; tint: string; ring: string; label: string }
> = {
  reddit: { dot: '#ff4500', tint: 'rgba(255,69,0,0.10)', ring: 'rgba(255,69,0,0.20)', label: 'reddit' },
  farcaster: { dot: '#855dcd', tint: 'rgba(133,93,205,0.10)', ring: 'rgba(133,93,205,0.22)', label: 'farcaster' },
  news: { dot: '#3b82f6', tint: 'rgba(59,130,246,0.10)', ring: 'rgba(59,130,246,0.22)', label: 'news' },
}

export interface TokenChatterUiProps {
  base: string
  messages: ChatMessage[]
  isLoading: boolean
  error: boolean
  /** Accent color for live dot / new pill. Default CDEX green. */
  accentColor?: string
  /** Optional note pinned under the feed (e.g. posting CTA). */
  footerNote?: string
}

export const TokenChatterUi: FC<TokenChatterUiProps> = ({
  base,
  messages: newestFirst,
  isLoading,
  error,
  accentColor = '#32c15f',
  footerNote,
}) => {
  // Newest at the bottom (real chat order); source arrays are newest-first.
  const messages = useMemo(
    () => [...newestFirst].reverse(),
    [newestFirst],
  )

  const recentHour = useMemo(
    () =>
      messages.filter((m) => Date.now() - m.timestamp < 60 * 60 * 1000).length,
    [messages],
  )

  // Track which ids are new since the previous response for the pop anim.
  const prevIdsRef = useRef<Set<string>>(new Set())
  const newIds = useMemo(() => {
    const prev = prevIdsRef.current
    const fresh = new Set<string>()
    for (const m of messages) if (!prev.has(m.id)) fresh.add(m.id)
    return fresh
  }, [messages])
  useEffect(() => {
    prevIdsRef.current = new Set(messages.map((m) => m.id))
  }, [messages])

  // Auto-scroll behavior.
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const [stuckToBottom, setStuckToBottom] = useState(true)
  const [pendingNew, setPendingNew] = useState(0)

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const onScroll = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight
      setStuckToBottom(distance < 40)
    }
    onScroll()
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const el = scrollerRef.current
    if (!el || messages.length === 0) return
    if (stuckToBottom) {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight
      })
      setPendingNew(0)
    } else if (newIds.size > 0) {
      setPendingNew((n) => n + newIds.size)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length])

  const jumpToLatest = () => {
    const el = scrollerRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    setPendingNew(0)
  }

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        minHeight: 0,
        background: 'transparent',
        fontFamily: 'inherit',
      }}
    >
      <style>{KEYFRAMES}</style>

      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          padding: '8px 12px',
          fontSize: 11,
          color: 'rgba(255,255,255,0.5)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.9)' }}>
            ${base}
          </span>
          <span style={{ color: 'rgba(255,255,255,0.3)' }}>·</span>
          <span style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>chatter</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: 'rgba(255,255,255,0.6)' }}>
            {recentHour > 0 ? `${recentHour} in last hour` : `${messages.length} total`}
          </span>
          <span style={{ position: 'relative', display: 'inline-flex', height: 8, width: 8 }}>
            <span
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                background: accentColor,
                animation: 'cdex-chatter-ping 1.2s cubic-bezier(0,0,0.2,1) infinite',
              }}
            />
            <span
              style={{
                position: 'relative',
                display: 'inline-flex',
                height: 8,
                width: 8,
                borderRadius: '50%',
                background: accentColor,
              }}
            />
          </span>
        </div>
      </div>

      {/* Scroller */}
      <div
        ref={scrollerRef}
        className="cdex-chatter-scroll"
        style={{
          minHeight: 0,
          flex: 1,
          overflowY: 'auto',
          padding: '8px 12px 12px',
        }}
      >
        {isLoading && messages.length === 0 ? (
          <SkeletonStack />
        ) : error || messages.length === 0 ? (
          <EmptyState
            text={
              error
                ? 'Could not reach the feed. Try again in a moment.'
                : `No recent ${base} chatter yet. Be the first to break the silence.`
            }
          />
        ) : (
          <ol
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              listStyle: 'none',
              margin: 0,
              padding: 0,
            }}
          >
            {messages.map((m, i) => (
              <Bubble
                key={m.id}
                message={m}
                index={i}
                isNew={newIds.has(m.id)}
                total={messages.length}
              />
            ))}
          </ol>
        )}
      </div>

      {pendingNew > 0 && (
        <button
          type="button"
          onClick={jumpToLatest}
          style={{
            position: 'absolute',
            bottom: footerNote ? 54 : 16,
            left: '50%',
            transform: 'translateX(-50%)',
            borderRadius: 999,
            background: accentColor,
            padding: '4px 12px',
            fontSize: 11,
            fontWeight: 500,
            color: '#000',
            border: 'none',
            cursor: 'pointer',
            boxShadow: `0 8px 20px -6px ${accentColor}55`,
          }}
        >
          ↓ {pendingNew} new
        </button>
      )}

      {footerNote && (
        <div
          style={{
            borderTop: '1px solid rgba(255,255,255,0.06)',
            padding: '8px 12px',
            fontSize: 11,
            color: 'rgba(255,255,255,0.35)',
          }}
        >
          {footerNote}
        </div>
      )}
    </div>
  )
}

const Bubble: FC<{
  message: ChatMessage
  index: number
  isNew: boolean
  total: number
}> = ({ message, index, isNew, total }) => {
  const [expanded, setExpanded] = useState(false)
  const [hover, setHover] = useState(false)
  const hasMore = !!message.bodyExtended && message.bodyExtended.length > 0
  const theme = SOURCE_THEME[message.source] ?? SOURCE_THEME.news

  // First-paint stagger: only the bottom ~12 rows.
  const staggerWindow = Math.min(12, total)
  const fromBottom = total - 1 - index
  const staggered = fromBottom < staggerWindow
  const delayMs = staggered ? (staggerWindow - 1 - fromBottom) * 40 : 0

  const anim = isNew
    ? 'cdex-chatter-bubble-pop 360ms cubic-bezier(0.2,0.9,0.3,1.2) both'
    : `cdex-chatter-bubble-in 280ms cubic-bezier(0.2,0.7,0.3,1.05) ${delayMs}ms both`

  const metaStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '0 4px',
    fontSize: 10.5,
    color: 'rgba(255,255,255,0.45)',
  }

  return (
    <li style={{ display: 'flex', flexDirection: 'column', animation: anim }}>
      {/* Header strip: source dot + handle */}
      <div style={{ ...metaStyle, marginBottom: 2 }}>
        <span
          aria-label={theme.label}
          style={{
            display: 'inline-block',
            height: 6,
            width: 6,
            flexShrink: 0,
            borderRadius: '50%',
            background: theme.dot,
          }}
        />
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontWeight: 500,
            color: 'rgba(255,255,255,0.7)',
          }}
        >
          {message.handle}
        </span>
        {message.sourceLabel && message.sourceLabel !== message.handle && (
          <>
            <span style={{ color: 'rgba(255,255,255,0.2)' }}>·</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {message.sourceLabel}
            </span>
          </>
        )}
      </div>

      {/* Bubble */}
      <div
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          position: 'relative',
          maxWidth: '92%',
          borderRadius: 16,
          borderTopLeftRadius: 6,
          padding: '8px 12px',
          background: theme.tint,
          border: `1px solid ${theme.ring}`,
          transform: hover ? 'translateY(-1px)' : 'none',
          transition: 'transform 120ms ease',
        }}
      >
        <a
          href={message.permalinkUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'block',
            fontSize: 13,
            lineHeight: 1.375,
            color: hover ? '#fff' : 'rgba(255,255,255,0.9)',
            textDecoration: 'none',
          }}
        >
          {message.body}
        </a>
        {hasMore && expanded && (
          <p
            style={{
              marginTop: 4,
              marginBottom: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontSize: 12,
              lineHeight: 1.6,
              color: 'rgba(255,255,255,0.6)',
            }}
          >
            {message.bodyExtended}
          </p>
        )}
        {hasMore && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            style={{
              marginTop: 4,
              fontSize: 10.5,
              color: 'rgba(255,255,255,0.4)',
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
            }}
          >
            {expanded ? 'show less' : 'show more'}
          </button>
        )}
      </div>

      {/* Footer strip: stats + time */}
      <div style={{ ...metaStyle, marginTop: 2, color: 'rgba(255,255,255,0.35)' }}>
        {typeof message.score === 'number' && message.score > 0 && (
          <span>↑ {compactNumber(message.score)}</span>
        )}
        {typeof message.commentCount === 'number' && message.commentCount > 0 && (
          <span>💬 {compactNumber(message.commentCount)}</span>
        )}
        <span style={{ marginLeft: 'auto' }}>{relativeTime(message.timestamp)}</span>
      </div>
    </li>
  )
}

const SkeletonStack: FC = () => (
  <ol style={{ display: 'flex', flexDirection: 'column', gap: 6, listStyle: 'none', margin: 0, padding: 0 }}>
    {Array.from({ length: 6 }).map((_, i) => (
      <li
        key={i}
        style={{
          display: 'flex',
          flexDirection: 'column',
          animation: `cdex-chatter-bubble-in 280ms ${i * 40}ms both`,
        }}
      >
        <div style={{ marginBottom: 2, height: 8, width: 80, borderRadius: 4, background: 'rgba(255,255,255,0.04)' }} />
        <div
          style={{
            maxWidth: '88%',
            borderRadius: 16,
            borderTopLeftRadius: 6,
            border: '1px solid rgba(255,255,255,0.04)',
            background: 'rgba(255,255,255,0.02)',
            padding: '8px 12px',
          }}
        >
          <div style={{ height: 12, width: '100%', borderRadius: 4, background: 'rgba(255,255,255,0.05)' }} />
          <div style={{ marginTop: 6, height: 12, width: '75%', borderRadius: 4, background: 'rgba(255,255,255,0.05)' }} />
        </div>
      </li>
    ))}
  </ol>
)

const EmptyState: FC<{ text: string }> = ({ text }) => (
  <div
    style={{
      display: 'flex',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0 24px',
      textAlign: 'center',
      fontSize: 12.5,
      color: 'rgba(255,255,255,0.4)',
    }}
  >
    {text}
  </div>
)

function relativeTime(ts: number): string {
  const diff = Date.now() - ts
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${Math.max(1, s)}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d`
  return `${Math.floor(d / 7)}w`
}

function compactNumber(n: number): string {
  const abs = Math.abs(n)
  if (abs < 1000) return String(n)
  if (abs < 1_000_000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`
  return `${(n / 1_000_000).toFixed(1)}M`
}
