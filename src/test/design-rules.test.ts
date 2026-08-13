import { describe, expect, it } from 'vitest'

/**
 * Static guards for the two design rules that break silently — nothing fails at
 * build time, and the damage only shows up in a locale or on an input device
 * that day-to-day development never exercises:
 *
 *  1. RTL: Arabic is a shipped language, so a physical-direction utility
 *     (`ml-*`, `pl-*`, `left-*`, `text-left`) puts an icon on top of the text it
 *     was supposed to sit beside once `dir="rtl"` is set. The logical
 *     equivalents (`ms-*`, `ps-*`, `start-*`, `text-start`) work in both.
 *  2. Type scale: an inline pixel font size bypasses the scale entirely. New
 *     sizes belong in tailwind.config.ts as a named step (see `2xs`).
 *
 * Sources come from Vite's own glob import rather than the filesystem, so this
 * needs no Node typings. Comments are stripped first — the rules are about what
 * ships in `className`, and several of those comments name the bad pattern on
 * purpose to explain why the good one is there.
 */

const sources = import.meta.glob('../**/*.tsx', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1')
}

const PHYSICAL_DIRECTION_RE = /\b(?:ml|mr|pl|pr)-[0-9.]+|\btext-(?:left|right)\b|\b(?:left|right)-[0-9.]+\b|\b(?:border|rounded)-(?:l|r)-/g
const HARDCODED_FONT_SIZE_RE = /text-\[[0-9.]+(?:px|rem)\]/g

function findViolations(pattern: RegExp): string[] {
  const violations: string[] = []

  for (const [file, source] of Object.entries(sources)) {
    stripComments(source)
      .split('\n')
      .forEach((line, index) => {
        for (const match of line.matchAll(pattern)) {
          violations.push(`${file}:${index + 1} — ${match[0]}`)
        }
      })
  }

  return violations
}

describe('design rules', () => {
  it('uses logical direction utilities so RTL (Arabic) layouts do not break', () => {
    expect(findViolations(PHYSICAL_DIRECTION_RE)).toEqual([])
  })

  it('keeps font sizes on the named type scale instead of inline pixel values', () => {
    expect(findViolations(HARDCODED_FONT_SIZE_RE)).toEqual([])
  })

  // Guards the guards: a scanner that silently reads no files would report a
  // clean bill of health forever.
  it('actually scans the component tree', () => {
    const files = Object.keys(sources)
    expect(files.length).toBeGreaterThan(10)
    expect(files.some((file) => file.endsWith('Dashboard.tsx'))).toBe(true)
  })
})
