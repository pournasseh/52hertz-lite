# Languages

One file per language: `xx.json` or `xx-yy.json`, plus a line in
`index.json` so the editor can list it on static hosts (browsers cannot
scan a folder).

## Add a language

1. Copy `en.json` → `de.json` (or whatever code).
2. Translate the right-hand side of each string. Leave a line alone and
   English stays. A half-finished file is fine.
3. Add the code to `index.json`:

```json
["en", "fa", "de"]
```

Nothing else to edit in HTML/JS. Reload the editor; the UI language menu
and station `language` field pick up the new pack from
`language.name` / the code.

Player: set `language` in `station.json` to that code. It fetches
`languages/<code>.json` directly (no menu).

## `index.json`

Array of codes, or `{ "languages": ["en", "fa"] }`. Unknown/missing pack
files are skipped for labels (code is shown) but still listed if present
in the index.

## Pack shape

Top-level `language` block:

- `name` — language name in itself (shown in the editor UI picker)
- `direction` — `ltr` or `rtl`
- `locale` — for numbers/times
- `digits` — optional ten local digits (as in `fa.json`)

`player` is what listeners see. `editor` is what the playlist editor shows.
