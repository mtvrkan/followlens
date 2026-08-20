import { buildAccountHealth } from './analytics'
import { profileUrl } from './profile-url'
import type { GrowthPoint } from './analytics'
import type { FilterKey, Row } from './rows'
import type { PlatformId, Snapshot } from './types'

/**
 * Every piece of chrome the report prints, resolved by the caller. The builder
 * takes finished strings rather than a `t` function so it stays a pure
 * string-in/string-out module with no i18n runtime of its own — and so the
 * report is written in whichever language the app is currently showing, not
 * the English it used to be hardcoded to.
 */
export interface ReportStrings {
  reportTitle: string
  generatedAt: string
  summary: string
  scans: string
  latestScan: string
  followers: string
  following: string
  net7d: string
  net30d: string
  ratio: string
  noScans: string
  growth: string
  growthChartAlt: string
  date: string
  change: string
  results: string
  columnUsername: string
  columnDisplayName: string
  columnTags: string
  columnIgnored: string
  yes: string
  no: string
  emptyResults: string
  footer: string
}

/** Maps translation keys to `ReportStrings`, so both report callers word it identically. */
export function buildReportStrings(t: (key: string) => string): ReportStrings {
  return {
    reportTitle: t('reportTitle'),
    generatedAt: t('reportGeneratedAt'),
    summary: t('reportSummary'),
    scans: t('reportScans'),
    latestScan: t('reportLatestScan'),
    followers: t('healthFollowers'),
    following: t('chartLegendFollowing'),
    net7d: t('healthNet7d'),
    net30d: t('healthNet30d'),
    ratio: t('healthRatio'),
    noScans: t('reportNoScans'),
    growth: t('reportGrowth'),
    growthChartAlt: t('reportGrowthChartAlt'),
    date: t('tableDate'),
    change: t('tableChange'),
    results: t('reportResults'),
    columnUsername: t('exportColumn_username'),
    columnDisplayName: t('exportColumn_displayName'),
    columnTags: t('exportColumn_tags'),
    columnIgnored: t('exportColumn_ignored'),
    yes: t('reportYes'),
    no: t('reportNo'),
    emptyResults: t('reportEmptyResults'),
    footer: t('reportFooter'),
  }
}

export interface HtmlReportInput {
  appName: string
  platform: PlatformId
  accountLabel: string
  generatedAt: number
  snapshots: Snapshot[]
  /**
   * Omit the key entirely to drop the results section — the analytics report is
   * about the account over time and has no row list to show. An empty array is
   * a different thing: a row list that came out empty, which gets the empty
   * state so the reader knows nothing was silently lost.
   */
  rows?: Row[]
  /** BCP 47 tag — drives both the `lang` attribute and every date/number format in the document. */
  language: string
  dir: 'ltr' | 'rtl'
  strings: ReportStrings
  /** Localized name for a row's category tag. */
  tagLabel: (tag: FilterKey) => string
  /** Growth over the selected range. Omitted by the results-list export, which has no range. */
  series?: GrowthPoint[]
}

function escapeHtml(value: string | number): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Inline SVG rather than a canvas or a charting library: the report has to open
 * from `file://` with no network and print cleanly, and an SVG is the only one
 * of the three that is both self-contained and vector-sharp on paper.
 */
function sparkline(series: GrowthPoint[], ariaLabel: string): string {
  if (series.length < 2) return ''

  const WIDTH = 720
  const HEIGHT = 160
  const PAD = 4
  const values = series.flatMap((point) => [point.followers, point.following])
  const min = Math.min(...values)
  const max = Math.max(...values)
  // A flat line would divide by zero and collapse to the top edge; centring it
  // is the honest rendering of "this value never changed".
  const span = max - min || 1

  const path = (pick: (point: GrowthPoint) => number) =>
    series
      .map((point, index) => {
        const x = PAD + (index / (series.length - 1)) * (WIDTH - PAD * 2)
        const y = HEIGHT - PAD - ((pick(point) - min) / span) * (HEIGHT - PAD * 2)
        return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
      })
      .join(' ')

  return `<svg class="chart" viewBox="0 0 ${WIDTH} ${HEIGHT}" preserveAspectRatio="none" role="img" aria-label="${escapeHtml(ariaLabel)}">
    <path d="${path((p) => p.followers)}" fill="none" stroke="var(--accent)" stroke-width="2.5" vector-effect="non-scaling-stroke" />
    <path d="${path((p) => p.following)}" fill="none" stroke="var(--accent-2)" stroke-width="2.5" stroke-dasharray="6 4" vector-effect="non-scaling-stroke" />
  </svg>`
}

export function buildPortableHtmlReport(input: HtmlReportInput): string {
  const { language, strings } = input
  const latest = input.snapshots[input.snapshots.length - 1]
  const health = buildAccountHealth(input.snapshots)

  const dateTime = (ms: number) => new Date(ms).toLocaleString(language)
  const date = (ms: number) => new Date(ms).toLocaleDateString(language)
  const number = (value: number) => value.toLocaleString(language)
  const signed = (value: number) => `${value > 0 ? '+' : ''}${number(value)}`

  const stat = (label: string, value: string, tone: 'plain' | 'up' | 'down' = 'plain') =>
    `<div class="stat"><span>${escapeHtml(label)}</span><strong class="${tone}">${escapeHtml(value)}</strong></div>`

  const summary = [
    stat(strings.scans, number(input.snapshots.length)),
    stat(strings.latestScan, latest ? dateTime(latest.takenAt) : strings.noScans),
    stat(strings.followers, number(health?.latestFollowers ?? 0)),
    stat(strings.following, number(health?.latestFollowing ?? 0)),
    stat(strings.ratio, health?.followingRatio == null ? '—' : health.followingRatio.toFixed(2)),
    stat(strings.net7d, health ? signed(health.net7d) : '—', (health?.net7d ?? 0) < 0 ? 'down' : 'up'),
    stat(strings.net30d, health ? signed(health.net30d) : '—', (health?.net30d ?? 0) < 0 ? 'down' : 'up'),
  ].join('')

  const growthSection =
    input.series && input.series.length > 0
      ? `<section>
      <h2>${escapeHtml(strings.growth)}</h2>
      <div class="card">
        <div class="legend">
          <span><i class="swatch followers"></i>${escapeHtml(strings.followers)}</span>
          <span><i class="swatch following"></i>${escapeHtml(strings.following)}</span>
        </div>
        ${sparkline(input.series, strings.growthChartAlt)}
        <table class="compact">
          <thead><tr>
            <th>${escapeHtml(strings.date)}</th>
            <th class="num">${escapeHtml(strings.followers)}</th>
            <th class="num">${escapeHtml(strings.following)}</th>
            <th class="num">${escapeHtml(strings.change)}</th>
          </tr></thead>
          <tbody>${[...input.series]
            .reverse()
            .map(
              (point) => `<tr>
                <td>${escapeHtml(date(point.takenAt))}</td>
                <td class="num">${escapeHtml(number(point.followers))}</td>
                <td class="num">${escapeHtml(number(point.following))}</td>
                <td class="num ${point.followersDelta < 0 ? 'down' : point.followersDelta > 0 ? 'up' : ''}">${escapeHtml(signed(point.followersDelta))}</td>
              </tr>`,
            )
            .join('')}</tbody>
        </table>
      </div>
    </section>`
      : ''

  const rows = (input.rows ?? [])
    .map((row) => {
      const url = profileUrl(input.platform, row.username)
      const tags = row.tags.map((tag) => `<span class="tag t-${escapeHtml(tag)}">${escapeHtml(input.tagLabel(tag))}</span>`).join('')
      return `<tr>
        <td><a href="${escapeHtml(url)}">@${escapeHtml(row.username)}</a></td>
        <td>${escapeHtml(row.displayName)}</td>
        <td class="tags">${tags}</td>
        <td>${escapeHtml(row.ignored ? strings.yes : strings.no)}</td>
      </tr>`
    })
    .join('')

  return `<!doctype html>
<html lang="${escapeHtml(language)}" dir="${input.dir}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(input.appName)} — ${escapeHtml(input.accountLabel)}</title>
  <style>
    /* Light only, deliberately: this document's other life is a printed page. */
    :root {
      color-scheme: light;
      --ink: #0f172a;
      --ink-soft: #64748b;
      --line: #e2e8f0;
      --surface: #ffffff;
      --page: #f1f5f9;
      --accent: #6d28d9;
      --accent-2: #0d9488;
      --up: #047857;
      --down: #b91c1c;
      --radius: 12px;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--page);
      color: var(--ink);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 14px;
      line-height: 1.6;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    main { max-width: 900px; margin: 0 auto; padding: 32px 24px 48px; }
    .masthead {
      background: linear-gradient(135deg, var(--accent) 0%, #4338ca 100%);
      color: #fff;
      border-radius: var(--radius);
      padding: 24px;
      margin-bottom: 24px;
    }
    .masthead h1 { margin: 0; font-size: 24px; line-height: 1.2; letter-spacing: -0.02em; }
    .masthead p { margin: 6px 0 0; opacity: 0.85; font-size: 13px; }
    h2 { margin: 32px 0 12px; font-size: 15px; letter-spacing: -0.01em; }
    section:first-of-type h2 { margin-top: 0; }
    .card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 16px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }
    .stat { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 14px 16px; }
    .stat span { display: block; color: var(--ink-soft); font-size: 12px; margin-bottom: 4px; }
    .stat strong { font-size: 20px; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
    .up { color: var(--up); }
    .down { color: var(--down); }
    .legend { display: flex; gap: 16px; color: var(--ink-soft); font-size: 12px; margin-bottom: 8px; }
    .swatch { display: inline-block; width: 10px; height: 10px; border-radius: 999px; margin-inline-end: 6px; }
    .swatch.followers { background: var(--accent); }
    .swatch.following { background: var(--accent-2); }
    .chart { display: block; width: 100%; height: 160px; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; background: var(--surface); }
    .card table { margin: 0; }
    section > table { border: 1px solid var(--line); border-radius: var(--radius); overflow: hidden; }
    th, td { border-bottom: 1px solid var(--line); padding: 10px 12px; text-align: start; vertical-align: top; }
    th { background: #f8fafc; color: var(--ink-soft); font-size: 12px; font-weight: 600; }
    tbody tr:last-child th, tbody tr:last-child td { border-bottom: none; }
    .num { text-align: end; font-variant-numeric: tabular-nums; }
    a { color: var(--accent); text-decoration: none; font-weight: 500; }
    a:hover { text-decoration: underline; }
    .tags { display: flex; flex-wrap: wrap; gap: 4px; }
    .tag { border-radius: 999px; padding: 2px 8px; font-size: 11px; font-weight: 500; background: #f1f5f9; color: var(--ink-soft); }
    .tag.t-notFollowingBack, .tag.t-lostFollowing { background: #fef3c7; color: #92400e; }
    .tag.t-newFollowers, .tag.t-newFollowing { background: #d1fae5; color: #065f46; }
    .tag.t-lostFollowers { background: #fee2e2; color: #991b1b; }
    .empty { background: var(--surface); border: 1px dashed #cbd5e1; border-radius: var(--radius); padding: 40px; text-align: center; color: var(--ink-soft); }
    footer { margin-top: 32px; color: var(--ink-soft); font-size: 12px; text-align: center; }

    @media print {
      /* The gradient masthead survives (print-color-adjust above), but the page
         tint behind it only wastes ink. */
      body { background: #fff; }
      main { max-width: none; padding: 0; }
      /* Repeat the header on every printed page and never split a person's row. */
      thead { display: table-header-group; }
      tr, .stat, .card { break-inside: avoid; }
      a { color: var(--ink); }
    }
    @page { margin: 14mm; }
  </style>
</head>
<body>
  <main>
    <header class="masthead">
      <h1>${escapeHtml(strings.reportTitle)}</h1>
      <p>${escapeHtml(input.platform)} · ${escapeHtml(input.accountLabel)} · ${escapeHtml(strings.generatedAt)} ${escapeHtml(dateTime(input.generatedAt))}</p>
    </header>

    <section>
      <h2>${escapeHtml(strings.summary)}</h2>
      <div class="grid">${summary}</div>
    </section>

    ${growthSection}

    ${
      input.rows === undefined
        ? ''
        : `<section>
      <h2>${escapeHtml(strings.results)}</h2>
      ${
        input.rows.length === 0
          ? `<div class="empty">${escapeHtml(strings.emptyResults)}</div>`
          : `<table>
              <thead><tr>
                <th>${escapeHtml(strings.columnUsername)}</th>
                <th>${escapeHtml(strings.columnDisplayName)}</th>
                <th>${escapeHtml(strings.columnTags)}</th>
                <th>${escapeHtml(strings.columnIgnored)}</th>
              </tr></thead>
              <tbody>${rows}</tbody>
            </table>`
      }
    </section>`
    }

    <footer>${escapeHtml(strings.footer)}</footer>
  </main>
</body>
</html>`
}
