/**
 * The FollowLens mark — a lens with two accounts inside it, one solid and one
 * already fading out.
 *
 * The header used to draw a gradient square with Lucide's generic `Search`
 * glyph in it, which is a magnifier and nothing more: the toolbar icon, the
 * favicon, the landing page and the store tiles all carried the real mark, and
 * the one surface the user spends time in did not. Same geometry as
 * `docs/assets/img/logo.svg` and as the `#i-mark` sprite symbol on the site, so
 * all four now resolve to one drawing.
 *
 * Inline SVG rather than an `<img src>` pointing at the packaged PNG: at 32 CSS
 * pixels a 128px raster is soft on a HiDPI screen, and this costs no request.
 *
 * The gradient is the plate's own — it is the mark, not the theme, so it does
 * not follow light/dark. The `id` is suffixed per instance because a document
 * can hold several headers (popup and dashboard are separate documents today,
 * but duplicated gradient ids silently resolve to the first one).
 */
import { useId } from 'react'
import { cn } from '../lib/utils'

export function BrandMark({ className }: { className?: string }) {
  const gradientId = `fl-plate-${useId()}`

  return (
    <svg
      viewBox="0 0 128 128"
      className={cn('h-8 w-8 shrink-0', className)}
      role="img"
      aria-label="FollowLens"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6d3ff0" />
          <stop offset="1" stopColor="#3b5bf0" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="120" height="120" rx="29" fill={`url(#${gradientId})`} />
      <g fill="none" stroke="#fff" strokeWidth="10" strokeLinecap="round">
        <circle cx="54" cy="55" r="24" />
        <path d="M71 72 L95 96" />
      </g>
      <circle cx="45.5" cy="55" r="8" fill="#fff" />
      <circle cx="62.5" cy="55" r="6.8" fill="#fff" opacity=".42" />
    </svg>
  )
}
