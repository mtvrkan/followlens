# Typefaces

Served from this repository rather than from `fonts.googleapis.com`. A Google
Fonts `<link>` sends every visitor's IP address and User-Agent to Google before
the page paints, which is not something a site arguing that nothing about you
leaves your machine gets to do — least of all on the page hosting the privacy
policy. With these four files, no page on the site names an outside host in its
Content-Security-Policy at all.

## Files

| File | Family | Subset | Weights |
| --- | --- | --- | --- |
| `inter-latin.woff2` | Inter | latin | 400–600 (variable) |
| `inter-latin-ext.woff2` | Inter | latin-ext | 400–600 (variable) |
| `manrope-latin.woff2` | Manrope | latin | 400–800 (variable) |
| `manrope-latin-ext.woff2` | Manrope | latin-ext | 400–800 (variable) |

Variable rather than static: the site uses Inter at three weights and Manrope
at four, which as static faces would be seven downloads per subset instead of
one.

Both subsets are needed. The `unicode-range` declarations in
`../css/style.css` are Google's own, so an English reader only ever fetches the
latin pair — but Turkish needs latin-ext for `ğ`, `ş` and `İ`. Only `ı`
(U+0131) sits in the base latin range.

## Updating

Request the CSS with a browser User-Agent so Google returns `woff2`, then take
the `latin` and `latin-ext` URLs from it:

```sh
curl -A "Mozilla/5.0 ... Chrome/120.0 Safari/537.36" \
  "https://fonts.googleapis.com/css2?family=Inter:wght@400..600&family=Manrope:wght@400..800&display=swap"
```

Copy the `unicode-range` values across with the files — a stale range silently
stops a character being rendered in the right face.

## Licence

Both families are licensed under the [SIL Open Font License 1.1][ofl], which
permits redistribution provided this notice travels with the files.

- **Inter** — Copyright (c) 2016 The Inter Project Authors
  (<https://github.com/rsms/inter>)
- **Manrope** — Copyright (c) 2018 The Manrope Project Authors
  (<https://github.com/sharanda/manrope>)

Reserved Font Names apply: a modified version of either may not be distributed
under its original name.

[ofl]: https://openfontlicense.org/
