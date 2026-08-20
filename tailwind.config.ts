import type { Config } from 'tailwindcss'
import animate from 'tailwindcss-animate'

export default {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: 'hsl(var(--card))',
        'card-foreground': 'hsl(var(--card-foreground))',
        primary: 'hsl(var(--primary))',
        'primary-2': 'hsl(var(--primary-2))',
        'primary-foreground': 'hsl(var(--primary-foreground))',
        muted: 'hsl(var(--muted))',
        'muted-foreground': 'hsl(var(--muted-foreground))',
        border: 'hsl(var(--border))',
        destructive: 'hsl(var(--destructive))',
        'destructive-foreground': 'hsl(var(--destructive-foreground))',
        success: 'hsl(var(--success))',
        'success-foreground': 'hsl(var(--success-foreground))',
        warning: 'hsl(var(--warning))',
        'warning-foreground': 'hsl(var(--warning-foreground))',
        // Modal scrim — see the token's comment in globals.css.
        overlay: 'hsl(var(--overlay))',
        // Per-platform brand accents — used sparingly (platform icon/badge
        // only) so the neutral UI still reads as one cohesive system rather
        // than borrowing each platform's whole palette.
        instagram: '#E1306C',
        github: '#6e40c9',
      },
      fontSize: {
        // The one step below `text-xs` the type scale needs: chart axis labels
        // and chart tooltips, where a 12px label would crowd the plot. Named
        // here rather than written as `text-[10px]` at each call site, so the
        // scale stays enumerable and consistent.
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      backgroundImage: {
        'gradient-brand': 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary-2)) 100%)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        heartbeat: {
          // Two beats then a rest, the shape of an actual pulse — a single
          // symmetric pulse reads as a throb rather than a heart. Scale only:
          // the glyph sits inline in a sentence, so anything that moves it
          // would shift the text baseline around it.
          '0%, 28%, 70%, 100%': { transform: 'scale(1)' },
          '14%': { transform: 'scale(1.25)' },
          '42%': { transform: 'scale(1.18)' },
        },
        'draw-in': {
          // A growing clip-path reveal (not stroke-dasharray) — the chart
          // uses preserveAspectRatio="none" with non-uniform x/y scaling,
          // where non-scaling-stroke + dasharray animation renders visibly
          // broken (banding) in Chromium. clip-path insets operate on the
          // element's actual rendered box, so they're immune to that.
          from: { clipPath: 'inset(0 100% 0 0)' },
          to: { clipPath: 'inset(0 0% 0 0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 300ms cubic-bezier(0.2, 0, 0, 1) both',
        // Backdrops fade only — no translate, or the whole modal reads as sliding.
        'fade-in': 'fade-in 200ms cubic-bezier(0.2, 0, 0, 1) both',
        'draw-in': 'draw-in 900ms cubic-bezier(0.2, 0, 0, 1) forwards',
        // Slow enough to read as a resting pulse rather than a nervous flicker;
        // globals.css collapses every animation under prefers-reduced-motion.
        heartbeat: 'heartbeat 1600ms ease-in-out infinite',
      },
      transitionTimingFunction: {
        emphasized: 'cubic-bezier(0.2, 0, 0, 1)',
      },
    },
  },
  plugins: [animate],
} satisfies Config
