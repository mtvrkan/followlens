/**
 * How "export as PDF" works here: the report HTML is rendered into an offscreen
 * iframe and that frame is sent to the browser's print dialog, where "Save as
 * PDF" is one of the destinations.
 *
 * The alternative — jsPDF plus html2canvas — is ~300 KB of dependency that
 * rasterizes the page into an image, so the text stops being selectable or
 * searchable and non-Latin glyphs need fonts bundled by hand. Chrome's own
 * print pipeline renders the same HTML to vector PDF with working Unicode, at
 * zero bundle cost. The trade is that the user confirms a dialog rather than
 * getting a silent download, which is also the honest UX: they pick the paper
 * size and whether they want a file at all.
 */

/** Long stop in case `afterprint` never arrives (it does not fire if the tab is backgrounded mid-dialog). */
const CLEANUP_FALLBACK_MS = 60_000

export function printHtmlDocument(html: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const frame = document.createElement('iframe')
    frame.setAttribute('aria-hidden', 'true')
    frame.setAttribute('tabindex', '-1')
    frame.title = ''
    // Kept in the layout (not `display:none`) because a frame that was never
    // laid out has nothing to print; `visibility:hidden` at zero size renders
    // it without it ever being visible or focusable.
    frame.style.cssText = 'position:fixed;inset-block-end:0;inset-inline-end:0;width:0;height:0;border:0;visibility:hidden'
    frame.srcdoc = html

    let settled = false
    let fallbackTimer: ReturnType<typeof setTimeout> | undefined

    const cleanup = () => {
      clearTimeout(fallbackTimer)
      frame.remove()
    }

    frame.addEventListener('load', () => {
      const win = frame.contentWindow
      if (!win) {
        cleanup()
        if (!settled) {
          settled = true
          reject(new Error('Print frame has no content window'))
        }
        return
      }

      // Removing the frame the moment print() returns cancels the job in
      // Chrome, which keeps rendering from the live document while the dialog
      // is open — so cleanup waits for afterprint instead.
      win.addEventListener('afterprint', cleanup, { once: true })
      fallbackTimer = setTimeout(cleanup, CLEANUP_FALLBACK_MS)

      try {
        win.focus()
        win.print()
        if (!settled) {
          settled = true
          resolve()
        }
      } catch (error) {
        cleanup()
        if (!settled) {
          settled = true
          reject(error instanceof Error ? error : new Error(String(error)))
        }
      }
    })

    document.body.appendChild(frame)
  })
}
