<p align="center"><img src="assets/mark.png" alt="52Hertz Lite" width="140"></p>

# 52Hertz Lite

[![CI](https://github.com/pournasseh/52hertz-lite/actions/workflows/ci.yml/badge.svg)](https://github.com/pournasseh/52hertz-lite/actions/workflows/ci.yml)

A fully static radio player. No PHP, no database, no playout server. Put the
folder on any free static host, edit `station.json`, and listeners join a
station that is already playing.

Full [52Hertz](https://github.com/pournasseh/52hertz) is the same idea with a PHP panel, schedules and
programme days. Lite is for people who only have a phone and a free host.

## About

52Hertz Lite is the static-hosting form of the same deterministic radio model: `station.json` + hosted audio + a shared clock. It is designed for the smallest practical deployment surface — including free static hosting — with no PHP, database, or continuously running playout process.



## What you get

| Path | Role |
| --- | --- |
| `index.html` | Player (looks like the 52hertz player) |
| `editor/` | Playlist editor — load / edit / download `station.json` |
| `station.json` | The whole station |
| `js/52hertz.js` | Vendored playout engine (source: [`pournasseh/52hertz.js`](https://github.com/pournasseh/52hertz.js)) |
| `languages/` | Drop-in UI translations — add `xx.json` and list it in `index.json` |

Audio and cover art can stay on another host or live beside the player. Absolute `https://…` URLs and station-relative paths such as `media/song.mp3` are supported. The JSON stores resource references and exact durations.

## Editor workflow

The editor always opens the on-air `station.json` first. It never silently
replaces that with a draft or recovery blob.

| Action | Meaning |
| --- | --- |
| **Save / Save as new draft** | Named copy in this browser only (`localStorage`, max 20; ~1.5MB per store) |
| **Drafts** | Open or delete those browser drafts |
| **Load on-air** | Reload `station.json` from the host (or the last known snapshot) |
| **Load JSON** | Import a file into the editor (not published yet) |
| **Download JSON** | Export `station.json` to your device |
| **How to publish** | Remind where to put the file; can re-enable the post-download tip |

Download is **not** publish. Until you upload and replace `station.json` on the
host (same folder as the player / `index.html`), listeners still hear the old
playlist. The editor shows a short publish tip after download; you can hide it
for this browser. Opening **How to publish** does not clear that choice unless
you tick **Show tip after downloads again**.

Tests (helpers + dirty/on-air/publish decisions):

```sh
npm test
# or: node --test js/editor/persist-utils.test.mjs
```

Repository CI runs this Lite test suite on every push and pull request.

If the tab closes with unsaved edits, a recovery offer may appear on the next
visit. Restore is always explicit.

The status badge on the station card is the source of truth for edit state:
`unsaved`, a draft name, or on-air / off-air.

## How playback stays in sync

Playout math lives in [`52hertz.js`](https://github.com/pournasseh/52hertz.js) and is copied into
`js/52hertz.js`. `js/52hertz.js` is a vendored snapshot of the standalone
[52hertz.js](https://github.com/pournasseh/52hertz.js) primitive. Upstream engine
changes are synchronized deliberately when preparing a Lite release; a Lite
checkout has no sibling-repository requirement.

Each full pass through the library lasts the same length, so the current track
is:

```
position = (now - epoch) mod passLength
```

`mode` chooses how that pass is ordered:

- `shuffle` (default) — seeded permutation per cycle (same for every listener)
- `order` — playlist order from `station.json`, every cycle

Optional daily restart:

- `dayStart` — local time like `"06:00"`. Each broadcast day begins here.
- `timezone` — IANA zone (e.g. `"Asia/Tehran"`). Required when `dayStart` is set.

With `dayStart`, shuffle seeds include the calendar day, so Monday’s mixes differ
from Tuesday’s but stay identical for every listener that day. `epoch` still
means “never on air before this unix time.”
On daylight-saving transitions, a skipped `dayStart` minute starts at the first
real minute after the gap; a repeated minute uses its first occurrence.

Wrong `duration` values break that for everyone. Prefer measured lengths.
The editor **Health check** probes every audio URL and flags duration mismatches.

The player also nudges its clock from the `Date` header on `station.json`
(same trick as fn-rock).

## station.json

```json
{
  "id": "rock",
  "name": "My station",
  "tagline": "Already playing",
  "accent": "#DE4E4E",
  "language": "en",
  "logoUrl": "https://example.com/logo.png",
  "artUrl": "https://example.com/cover.jpg",
  "homeUrl": "https://example.com/",
  "colophon": "CC0",
  "mode": "shuffle",
  "dayStart": "06:00",
  "timezone": "Asia/Tehran",
  "epoch": 1767225600,
  "tracks": [
    {
      "url": "https://example.com/song.mp3",
      "duration": 187.44,
      "title": "Song",
      "credit": "Artist",
      "artUrl": "https://example.com/song.jpg",
      "link": "https://example.com/song",
      "description": "Optional notes"
    }
  ]
}
```

`language` must match a file in `languages/` (for example `fa` → `languages/fa.json`)
and should be listed in `languages/index.json` so the editor can offer it.
`epoch` is the shared clock start — change it only when you mean to restart the timeline for every listener.
Leave `dayStart` empty to use a single continuous clock from `epoch` only. If `dayStart` is present, `timezone` is required and must be a valid IANA timezone; invalid clock configuration is rejected instead of silently changing the timeline.

## Demo

The shipped `station.json` uses FA-NOOSE RADIO ROCK tracks and covers from
archive.org / fa-noose.netlify.app as a working sample. Replace it with your
own catalogue when you publish.

## Run locally

Static files need an HTTP origin (modules + fetch). From this folder:

```sh
python -m http.server 8080
```

Then open <http://localhost:8080/> and <http://localhost:8080/editor/>.

## License

52hertz-lite is free software under the [GNU Affero General Public License,
version 3 or later](LICENSE). The demo JSON points to externally hosted media;
those recordings and images remain under their own authors' terms and are not
relicensed by this repository.
