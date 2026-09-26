# Changelog

## 1.0.0-rc.3 — 2026-09-26

- Deterministic DST semantics for daily station restarts.
- Empty stations resolve explicitly off air.
- Station-relative media and artwork URLs resolve from the published station root.
- Unsafe executable/data URL schemes are rejected.
- Track links survive editor round trips.
- The repository is standalone; the vendored clock engine is synchronized deliberately from [52hertz.js](https://github.com/pournasseh/52hertz.js).
