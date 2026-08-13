import { useState } from 'react'
import { cn } from '../../lib/utils'

interface AvatarProps {
  src?: string
  alt?: string
  fallbackText: string
  size?: number
  className?: string
}

// Platform CDN avatar URLs can be hotlink-protected and can expire over time
// since snapshots are kept long-term — so this always degrades to initials
// instead of a broken-image icon, and never reserves a different amount of
// space depending on which state it ends up in (fixes layout shift between
// rows). No referrerPolicy override: Instagram's CDN was confirmed (live) to
// fail with no-referrer, so this now sends the extension's default referrer
// rather than guessing at one policy that suits every platform's CDN.
export function Avatar({ src, alt = '', fallbackText, size = 36, className }: AvatarProps) {
  const [failed, setFailed] = useState(false)
  // Render-time reset (not an effect): a row whose src changes gets a fresh
  // chance to load instead of inheriting the previous image's failure.
  const [prevSrc, setPrevSrc] = useState(src)
  if (prevSrc !== src) {
    setPrevSrc(src)
    setFailed(false)
  }

  const showImage = Boolean(src) && !failed

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-medium text-muted-foreground',
        className,
      )}
      style={{ width: size, height: size }}
    >
      {showImage ? (
        <img
          src={src}
          alt={alt}
          width={size}
          height={size}
          loading="lazy"
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span>{fallbackText.slice(0, 2).toUpperCase()}</span>
      )}
    </div>
  )
}
