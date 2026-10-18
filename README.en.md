# UME Lite — find the tab that is still playing (Firefox)

[![build](https://github.com/1TRYOUT/firefox-ume-lite/actions/workflows/build.yml/badge.svg)](https://github.com/1TRYOUT/firefox-ume-lite/actions/workflows/build.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Firefox 140+](https://img.shields.io/badge/Firefox-140%2B-orange.svg)

One-click list of every tab playing audio or video, with jump-to-tab. Playback
speed, volume boost and hotkeys are kept.

> 中文说明见 [README.md](README.md)

## The problem it solves

You open a video, click a link, and the original page keeps playing somewhere in
a hundred open tabs. Firefox only draws a tiny speaker icon on the tab, which is
invisible once the tab strip overflows.

UME Lite lists **every tab with active media** (across windows) in the toolbar
popup; clicking an entry switches to that tab and focuses its window. It does
**not** silence background playback — that playback is precisely what you are
trying to find.

## Difference from upstream

A fork of [`amitbrown21/OneTab-Media`](https://github.com/amitbrown21/OneTab-Media)
(the Firefox Manifest V2 build, published upstream as "UME - Ultimate Media
Extension" v5.1). Full list: [CHANGELOG.md](CHANGELOG.md).

| Change | Upstream | This fork |
|---|---|---|
| **Simultaneous playback** | Unconditionally paused the previously playing tab when another started (hard-coded, no switch) | Allowed by default, so background playback survives and stays findable; opt out with *Allow Multiple Tabs to Play* |
| **Page overlay** | Injected on every page with video | Off by default (`showController: false`), can be re-enabled |
| **Settings sync** | Broadcast only to already-tracked media tabs, and the background never reloaded its own copy (upstream issue #1) | Background and content script both listen to `storage.onChanged`, so a save applies to every tab immediately |
| **Permissions** | `storage, tabs, alarms, <all_urls>, activeTab` | Unused `alarms` and `activeTab` dropped |
| **Repo hygiene** | `Extention` typo, donation links, unused 86 KB icon, 16 committed zips, test pages inside the extension | Renamed, donation links and unused assets removed, test pages moved to `dev/`, no build artifacts committed |

Media detection is untouched and deliberately **not** based on `tab.audible`:
the content script hooks `<video>`/`<audio>` `play`/`pause` events, so a video
that the page itself muted is still listed. A lightweight detector avoids
initialising the full content script on pages without media.

## Install

Download `ume-lite-<version>.xpi` from
[Releases](https://github.com/1TRYOUT/firefox-ume-lite/releases). Requires
**Firefox 140+** (142+ on Android).

The extension is unsigned, so release Firefox cannot install it permanently:

- **Temporary** — `about:debugging#/runtime/this-firefox` → *Load Temporary Add-on* → pick the `.xpi`.
- **Developer Edition / Nightly / ESR** — set `xpinstall.signatures.required` to `false`, then install the `.xpi` from `about:addons`.
- **Self-signed** — `npx web-ext sign --source-dir . --channel unlisted --api-key … --api-secret …` (the extension ID is fixed at `ume-lite@1tryout.github.io`).

## Use

Click the toolbar icon:

- **Active Media Tabs** — sorted `playing > has_media > paused > potential`; click an entry to switch to that tab (its window is focused).
- Per-tab pause, **Pause All**, and **Refresh**.
- **Current Speed** / **Volume Booster** (up to 500%).
- Header toggles disable the extension or switch the popup theme.

In-page hotkeys (rebindable in the options page): `S` slower, `D` faster, `R`
reset, `G` preferred speed, `Z`/`X` rewind/advance 10 s, `M`/`J` marker and jump
back, `V` toggle the controller, `↑`/`↓` volume.

Options page: domain blacklist, controller visibility and opacity, per-video
speed memory, hotkey rebinding, settings import/export.

## Develop

```bash
npm run verify   # static assertions that the fork's three changes stay wired
npm run lint     # web-ext lint (ignores dev/ and other non-runtime files)
npm run build    # build ume-lite-<version>.xpi
npm run start    # web-ext run — launch Firefox with the extension loaded
```

CI runs syntax checks, the wiring assertions, `web-ext lint` and the package
build on every push and pull request.

**Verification status:** syntax checks, `web-ext lint` on the unpacked package
(0 errors / 0 warnings) and 26/26 wiring assertions pass. No in-browser test has
been run yet, because the development machine has no Firefox installed — the
five manual steps are listed in the Chinese README.

## Privacy

No network requests of any kind (no `fetch`, `XMLHttpRequest`, `WebSocket`,
`sendBeacon`, remote scripts or `eval`), no telemetry, and the manifest declares
`"data_collection_permissions": { "required": ["none"] }`. Permissions are
`storage`, `tabs` and `<all_urls>` — the last one is inherent to detecting media
on arbitrary sites, and it does mean the extension can read and modify any page
you open.

## License

MIT. Original work © [amitbrown21](https://github.com/amitbrown21)
([OneTab-Media](https://github.com/amitbrown21/OneTab-Media)); fork
modifications © 1TRYOUT. See [LICENSE](LICENSE).
