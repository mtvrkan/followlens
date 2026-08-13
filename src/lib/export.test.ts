import { afterEach, describe, expect, it, vi } from 'vitest'
import { csvDelimiterFor, downloadFile, toCsv } from './export'

describe('toCsv', () => {
  it('joins headers and rows with commas and CRLF line endings', () => {
    const csv = toCsv(['username', 'count'], [['alice', 1], ['bob', 2]])
    expect(csv).toBe('username,count\r\nalice,1\r\nbob,2')
  })

  it('quotes and escapes values containing commas, quotes, or newlines', () => {
    const csv = toCsv(['name'], [['O, "Hi"\nthere']])
    expect(csv).toBe('name\r\n"O, ""Hi""\nthere"')
  })

  it('leaves plain values unquoted', () => {
    const csv = toCsv(['a'], [['plain']])
    expect(csv).toBe('a\r\nplain')
  })

  it('handles an empty row set (headers only)', () => {
    expect(toCsv(['a', 'b'], [])).toBe('a,b')
  })

  it('neutralizes spreadsheet formula injection in string cells', () => {
    expect(toCsv(['u'], [['=HYPERLINK("http://evil")']])).toBe(`u\r\n"'=HYPERLINK(""http://evil"")"`)
    expect(toCsv(['u'], [['+alice']])).toBe("u\r\n'+alice")
    expect(toCsv(['u'], [['-bob']])).toBe("u\r\n'-bob")
    expect(toCsv(['u'], [['@carol']])).toBe("u\r\n'@carol")
    expect(toCsv(['u'], [['|dave']])).toBe("u\r\n'|dave")
  })

  it('leaves negative numbers as numbers (no formula guard)', () => {
    expect(toCsv(['delta'], [[-5]])).toBe('delta\r\n-5')
  })

  it('joins with a semicolon when asked, and then quotes on semicolons instead of commas', () => {
    expect(toCsv(['a', 'b'], [['x;y', 'p,q']], ';')).toBe('a;b\r\n"x;y";p,q')
  })
})

describe('csvDelimiterFor', () => {
  it('uses a semicolon for languages whose Excel list separator is a semicolon', () => {
    expect(csvDelimiterFor('tr')).toBe(';')
    expect(csvDelimiterFor('de')).toBe(';')
  })

  it('uses a comma for the rest', () => {
    expect(csvDelimiterFor('en')).toBe(',')
    expect(csvDelimiterFor('ja')).toBe(',')
  })

  it('matches on the base language of a regional code', () => {
    expect(csvDelimiterFor('tr-TR')).toBe(';')
    expect(csvDelimiterFor('en-GB')).toBe(',')
  })

  it('falls back to a comma when the language is unknown or missing', () => {
    expect(csvDelimiterFor(undefined)).toBe(',')
    expect(csvDelimiterFor('xx')).toBe(',')
  })
})

describe('downloadFile', () => {
  /**
   * jsdom implements neither object URLs nor anchor navigation, so the blob is
   * intercepted at `createObjectURL`. Bytes are asserted rather than
   * `Blob.text()`, whose spec'd UTF-8 decode silently strips the very BOM under
   * test — the reader we care about (Excel) sees the raw bytes.
   */
  function captureBlob(): () => Promise<Uint8Array> {
    const blobs: Blob[] = []
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: (blob: Blob) => {
        blobs.push(blob)
        return 'blob:stub'
      },
      revokeObjectURL: () => {},
    })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    return async () => new Uint8Array(await blobs[blobs.length - 1].arrayBuffer())
  }

  const decode = (bytes: Uint8Array) => new TextDecoder('utf-8').decode(bytes)

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('prefixes CSV with a UTF-8 BOM so Excel reads Turkish characters correctly', async () => {
    const read = captureBlob()
    downloadFile('a.csv', toCsv(['name'], [['Şeyma Öztürk']]), 'text/csv;charset=utf-8;')
    const bytes = await read()
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    expect(decode(bytes.slice(3))).toBe('name\r\nŞeyma Öztürk')
  })

  it('does not prefix JSON with a BOM (it would break JSON.parse)', async () => {
    const read = captureBlob()
    const json = JSON.stringify({ name: 'Çağla İnce' })
    downloadFile('a.json', json, 'application/json')
    const text = decode(await read())
    expect(text).toBe(json)
    expect(() => JSON.parse(text)).not.toThrow()
  })

  it('does not prefix HTML with a BOM (it declares its own charset)', async () => {
    const read = captureBlob()
    downloadFile('a.html', '<meta charset="utf-8">Ğüş', 'text/html;charset=utf-8;')
    expect(decode(await read())).toBe('<meta charset="utf-8">Ğüş')
  })
})
