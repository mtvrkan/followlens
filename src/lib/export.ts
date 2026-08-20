export type CsvDelimiter = ',' | ';'

/**
 * Excel splits a CSV on the system list separator, which is `;` in every locale
 * that writes decimals with a comma — so a comma-separated file dumps each row
 * into a single cell on a Turkish or German machine. There is no per-file way
 * to override that, so the delimiter follows the language the user picked in
 * the app. Google Sheets sniffs the delimiter either way.
 */
const SEMICOLON_LANGUAGES = new Set(['tr', 'de', 'es', 'fr', 'pt', 'ru'])

export function csvDelimiterFor(language: string | undefined): CsvDelimiter {
  return SEMICOLON_LANGUAGES.has((language ?? 'en').split('-')[0]) ? ';' : ','
}

function escapeCsvValue(value: string | number, delimiter: CsvDelimiter): string {
  let str = String(value)
  // Formula-injection guard: a username like `=HYPERLINK(...)` would execute
  // when the export opens in Excel/Sheets. `|` is included for older
  // Excel/Lotus DDE-style formula payloads. Only string cells are prefixed —
  // numeric cells (e.g. negative deltas) must stay plain numbers.
  if (typeof value === 'string' && /^[=+\-@|\t]/.test(str)) {
    str = `'${str}`
  }
  return str.includes(delimiter) || /["\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
}

export function toCsv(headers: string[], rows: (string | number)[][], delimiter: CsvDelimiter = ','): string {
  return [headers, ...rows].map((row) => row.map((cell) => escapeCsvValue(cell, delimiter)).join(delimiter)).join('\r\n')
}

// Excel ignores the `charset=utf-8` MIME parameter of a locally opened file and
// falls back to the system ANSI codepage, which turns "Şahin" into "Åžahin" on a
// Turkish machine. A leading BOM is the only signal it honours. JSON is
// deliberately excluded — a BOM makes `JSON.parse` throw — and HTML declares its
// charset in a <meta> tag, so neither needs one.
const UTF8_BOM = String.fromCharCode(0xfeff)

export function downloadFile(filename: string, content: string, mimeType: string): void {
  const body = mimeType.startsWith('text/csv') ? UTF8_BOM + content : content
  const blob = new Blob([body], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
