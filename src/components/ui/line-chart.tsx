import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

export interface ChartPoint {
  x: number
  y: number
}

export interface ChartSeries {
  color: string
  label?: string
  points: ChartPoint[]
}

interface LineChartProps {
  series: ChartSeries[]
  height?: number
  /** Describes the chart for assistive tech — the exact values live in the table below it, so this only needs to summarize the trend. */
  ariaLabel: string
  formatValue?: (value: number) => string
  formatX?: (x: number) => string
}

const VIEW_WIDTH = 100

/**
 * Dependency-free chart for the two short numeric series this app ever plots
 * (follower/following counts over time) — a full charting library would cost
 * far more bundle size than it's worth for that. `role="img"`/`ariaLabel`
 * stand in for assistive tech: the exact per-scan numbers are always
 * available in the accessible table this chart accompanies.
 */
export function LineChart({ series, height = 160, ariaLabel, formatValue = String, formatX = String }: LineChartProps) {
  const hasEnoughData = series.some((s) => s.points.length >= 2)
  const chartAreaRef = useRef<HTMLDivElement>(null)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  if (!hasEnoughData) return null

  const allPoints = series.flatMap((s) => s.points)
  const xs = allPoints.map((p) => p.x)
  const ys = allPoints.map((p) => p.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(0, ...ys)
  const maxY = Math.max(...ys)
  const yPad = Math.max((maxY - minY) * 0.1, 1)

  // x in view units (0-100, i.e. directly usable as a CSS left-% too).
  function projectX(x: number): number {
    return maxX === minX ? VIEW_WIDTH / 2 : ((x - minX) / (maxX - minX)) * VIEW_WIDTH
  }
  // y in view units (0-height); divide by height for a CSS top-%.
  function projectY(y: number): number {
    return height - ((y - minY + yPad) / (maxY - minY + yPad * 2)) * height
  }

  const referencePoints = series.find((s) => s.points.length >= 2)?.points ?? []

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const rect = chartAreaRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0 || referencePoints.length === 0) return
    const relX = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
    const targetX = minX + relX * (maxX - minX)

    let nearest = 0
    let nearestDelta = Infinity
    referencePoints.forEach((p, i) => {
      const delta = Math.abs(p.x - targetX)
      if (delta < nearestDelta) {
        nearestDelta = delta
        nearest = i
      }
    })
    setHoverIndex(nearest)
  }

  const hovered = hoverIndex !== null ? referencePoints[hoverIndex] : null
  const hoveredXPct = hovered ? projectX(hovered.x) : null
  // Flips the tooltip to the left once it would otherwise run off the right
  // edge of the chart.
  const tooltipAlign = hoveredXPct !== null && hoveredXPct > VIEW_WIDTH - 25 ? 'right' : 'left'

  return (
    <div className="flex h-full w-full flex-col gap-1">
      <div className="flex min-h-0 flex-1 gap-1.5">
        {/* text-end, not text-right: the axis column sits at the inline start
            of the row, so in RTL it renders to the right of the plot and its
            labels have to hug it from the other side. */}
        <div className="flex w-9 shrink-0 flex-col justify-between whitespace-nowrap py-0.5 text-end text-2xs leading-none tabular-nums text-muted-foreground">
          <span>{formatValue(maxY)}</span>
          <span>{formatValue(minY)}</span>
        </div>

        <div
          ref={chartAreaRef}
          className="relative min-w-0 flex-1"
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setHoverIndex(null)}
        >
          <svg
            viewBox={`0 0 ${VIEW_WIDTH} ${height}`}
            preserveAspectRatio="none"
            className="h-full w-full overflow-visible"
            role="img"
            aria-label={ariaLabel}
          >
            <defs>
              {series.map((s, i) => (
                <linearGradient key={i} id={`chart-fill-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>

            {series.map((s, i) => {
              if (s.points.length < 2) return null
              const linePath = s.points.map((p) => `${projectX(p.x)},${projectY(p.y)}`).join(' L ')
              const firstX = projectX(s.points[0].x)
              const lastX = projectX(s.points[s.points.length - 1].x)
              const fillPath = `M ${linePath} L ${lastX},${height} L ${firstX},${height} Z`

              return (
                // clip-path (not stroke-dasharray) draws this in — the chart
                // uses preserveAspectRatio="none" with non-uniform x/y
                // scaling, where non-scaling-stroke + a dasharray animation
                // renders visibly broken (banding) in Chromium. A clip-path
                // inset operates on the group's actual rendered box, so it's
                // immune to that.
                <g key={i} className="animate-draw-in">
                  {/* Only the first series gets an area fill to the zero
                      baseline — filling every series would stack multiple
                      translucent colors on top of each other and muddy into
                      a gray blob rather than reading as distinct trends. */}
                  {i === 0 && <path d={fillPath} fill={`url(#chart-fill-${i})`} stroke="none" />}
                  <path
                    d={`M ${linePath}`}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              )
            })}

            {hoveredXPct !== null && (
              <line
                x1={hoveredXPct}
                x2={hoveredXPct}
                y1={0}
                y2={height}
                stroke="hsl(var(--border))"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>

          {/* Rendered as HTML (not SVG) so the dots stay circular — the SVG
              above uses preserveAspectRatio="none" and non-uniform x/y
              scaling, which would otherwise stretch a plain <circle> into an
              ellipse. */}
          {hovered &&
            hoveredXPct !== null &&
            series.map((s, i) => {
              const point = s.points[hoverIndex ?? -1]
              if (!point) return null
              return (
                <span
                  key={i}
                  className="pointer-events-none absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card"
                  style={{ left: `${hoveredXPct}%`, top: `${(projectY(point.y) / height) * 100}%`, backgroundColor: s.color }}
                />
              )
            })}

          {hovered && hoveredXPct !== null && (
            <div
              className="pointer-events-none absolute top-0 z-10 min-w-max rounded-md border border-border bg-card px-2 py-1 text-2xs shadow-md"
              style={{
                left: tooltipAlign === 'left' ? `${hoveredXPct}%` : undefined,
                right: tooltipAlign === 'right' ? `${100 - hoveredXPct}%` : undefined,
                transform: tooltipAlign === 'left' ? 'translateX(8px)' : 'translateX(-8px)',
              }}
            >
              <p className="mb-0.5 font-medium text-foreground">{formatX(hovered.x)}</p>
              {series.map((s, i) => {
                const point = s.points[hoverIndex ?? -1]
                return point ? (
                  <p key={i} className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                    {formatValue(point.y)}
                  </p>
                ) : null
              })}
            </div>
          )}
        </div>
      </div>

      {/* Offset past the y-axis column (ps-9) and the row gap (ms-1.5) so the
          first x label lines up with the start of the plot — logical
          properties, so the offset follows the axis column in RTL. */}
      <div className="ms-1.5 flex justify-between ps-9 text-2xs leading-none text-muted-foreground">
        <span>{formatX(referencePoints[0]?.x ?? 0)}</span>
        <span>{formatX(referencePoints[referencePoints.length - 1]?.x ?? 0)}</span>
      </div>
    </div>
  )
}
