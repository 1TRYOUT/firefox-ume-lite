# Changelog

This project is a fork of [`amitbrown21/OneTab-Media`](https://github.com/amitbrown21/OneTab-Media)
(Firefox Manifest V2 build, published there as "UME - Ultimate Media Extension" v5.1).
Only changes made by this fork are listed here; upstream history stays in the
upstream repository.

## 1.0.0 — first public release

Fork goal: turn a media-control extension whose headline behaviour was "only one
tab may play at a time" into a tool for **finding** the tab that is still playing.

### Changed

- **Simultaneous playback is now opt-in.** Upstream paused the previously playing
  tab unconditionally whenever another tab started playing (`background.js`,
  `handleNewMediaPlaying`). That call is now gated by a new `allowMultiplePlaying`
  setting, which defaults to `true`. Background playback therefore survives — and a
  tab that keeps playing is exactly what the popup list is for.
- **Overlay controller off by default** (`showController: false` in the background,
  content-script and options defaults; the background no longer treats an undefined
  value as "enabled"). Enable it again on the options page.
- **Naming**: extension, popup and options pages renamed to "UME Lite"; the upstream
  `Extention` typo is gone.

### Fixed

- **Settings did not reach every tab** (upstream issue #1: "Settings are not applied
  to any tabs except current"). Upstream broadcast settings only to tabs it already
  tracked as media tabs, and the background never refreshed its own in-memory copy
  from storage. Both the background and the content script now listen to
  `storage.onChanged` and apply changes in place; the content script removes its
  listener on teardown.

### Removed

- Unused `alarms` and `activeTab` permissions (`storage`, `tabs`, `<all_urls>` remain).
- The Chrome build (`chrome-extension/`) from the fork.
- Developer donation links in the popup and options page.
- An unused 86 KB `newIcon.png`, plus the 16 committed release zips and the test
  pages that upstream kept inside the extension directory (test pages moved to `dev/`).

### Added

- `build-xpi.py` — packages with Python's `zipfile` so archive paths always use
  forward slashes (XPI is a ZIP; `Compress-Archive` can emit backslashes on Windows).
- `dev/verify-wiring.py` — static assertions for the three behavioural changes above.
- `.github/workflows/build.yml` — syntax check, wiring assertions, `web-ext lint`
  and xpi build on every push/PR.
- `README.en.md`, `CHANGELOG.md`, `data_collection_permissions` manifest key.
- `_locales/` (en, zh_CN): the extension name, summary and toolbar tooltip follow
  the browser language — a Chinese Firefox shows "UME Lite（媒体标签定位）".

### Known limitations (unchanged from upstream)

- Manifest V2 with a persistent background page.
- Only HTML5 `<video>`/`<audio>` are detected; Web Audio-only output, unusual DRM
  pipelines and cross-origin iframes can be missed.
- The popup also lists tabs with media that is merely paused (`has_media`/`paused`),
  which is noisier than an `audible`-only list — by design, so a just-finished video
  can still be found.
- `updateSpeedSettings()` still drops a payload that contains `speed`; the new
  storage-event path means settings no longer depend on it, and it was left alone to
  avoid regressions.
