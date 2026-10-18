#!/usr/bin/env python3
"""Assert that the fork's three behavioural changes stay wired together.

Static wiring check only — it proves the code paths were edited consistently, not
that Firefox behaves as intended. Run it after any edit:

    python dev/verify-wiring.py
"""

from __future__ import annotations

import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
failures: list[str] = []


def read(name: str) -> str:
    with open(os.path.join(ROOT, name), encoding="utf-8") as handle:
        return handle.read()


def check(label: str, condition: bool, detail: str = "") -> None:
    if condition:
        print(f"  ok   {label}")
        return
    failures.append(label)
    print(f"  FAIL {label}{'' if not detail else f' -> {detail}'}")


background = read("background.js")
content = read("content.js")
options_js = read("options.js")
options_html = read("options.html")
popup_html = read(os.path.join("popup", "popup.html"))
with open(os.path.join(ROOT, "manifest.json"), encoding="utf-8") as handle:
    manifest = json.load(handle)

print("1. multiple tabs may play at once (default on, opt-out available)")
check("defaults set allowMultiplePlaying: true", "allowMultiplePlaying: true" in background)
check(
    "auto-pause is gated by the setting",
    "!this.settings.get('allowMultiplePlaying')" in background,
)
check(
    "gate still pauses when the setting is off",
    "this.pauseTab(this.currentPlayingTab);" in background,
)
check(
    "background exposes the setting to content scripts",
    "allowMultiplePlaying: settings.allowMultiplePlaying !== false" in background,
)

print("2. overlay controller off by default, consistently")
check("background default is false", re.search(r"showController: false,", background) is not None)
check("content default is false", re.search(r"showController: false,", content) is not None)
check("options default is false", re.search(r"showController: false,", options_js) is not None)
check(
    "background does not re-enable it for undefined values",
    "showController: settings.showController === true" in background,
)

print("3. settings reach every tab through storage events")
check("background registers a storage listener", "setupStorageListener()" in background)
check(
    "background listener subscribes to storage.onChanged",
    "browserAPI.storage.onChanged.addListener" in background,
)
check("background merges changes into its settings", "this.settings.update(updates);" in background)
check("content registers a storage listener", "this.setupStorageListener();" in content)
check(
    "content listener subscribes to storage.onChanged",
    "browserAPI.storage.onChanged.addListener(this.storageListener)" in content,
)
check("content applies changes via handleSettingsUpdate", "this.handleSettingsUpdate(updates);" in content)
check(
    "content removes the listener on destroy",
    "browserAPI.storage.onChanged.removeListener(this.storageListener)" in content,
)

print("4. options page exposes the new switch in all three places")
check("markup has the checkbox", 'id="allowMultiplePlaying"' in options_html)
check(
    "loadSettings restores it",
    "allowMultiplePlayingEl.checked = currentSettings.allowMultiplePlaying !== false" in options_js,
)
check(
    "saveSettings persists it",
    "allowMultiplePlaying: document.getElementById('allowMultiplePlaying').checked" in options_js,
)

print("5. manifest hygiene")
check("permissions trimmed", manifest["permissions"] == ["storage", "tabs", "<all_urls>"], str(manifest["permissions"]))
check("no alarms permission", "alarms" not in manifest["permissions"])
check("no activeTab permission", "activeTab" not in manifest["permissions"])
check("data collection declared", "data_collection_permissions" in manifest["browser_specific_settings"]["gecko"])
check("gecko id is no longer the upstream placeholder", "example.com" not in manifest["browser_specific_settings"]["gecko"]["id"])

print("6. fork hygiene")
check("no donation links in popup", "coff.ee" not in popup_html)
check("no donation links in options", "coff.ee" not in options_html)
check("popup title no longer says 'Extention'", "Extention" not in popup_html)
check("upstream MIT notice retained", "amitbrown21" in read("LICENSE"))

print("7. localized name and summary")
check("manifest name is a locale placeholder", str(manifest.get("name", "")).startswith("__MSG_"))
check(
    "manifest description is a locale placeholder",
    str(manifest.get("description", "")).startswith("__MSG_"),
)
default_locale = manifest.get("default_locale")
check("default_locale points at an existing locale", default_locale in ("en", "zh_CN"), str(default_locale))
locales: dict[str, dict] = {}
for locale in ("en", "zh_CN"):
    with open(os.path.join(ROOT, "_locales", locale, "messages.json"), encoding="utf-8") as handle:
        locales[locale] = json.load(handle)
check("both locales define the same keys", set(locales["en"]) == set(locales["zh_CN"]),
      str(sorted(set(locales["en"]) ^ set(locales["zh_CN"]))))
for key in sorted(locales["en"]):
    messages = [locales[locale].get(key, {}).get("message", "") for locale in locales]
    check(f"'{key}' is non-empty in every locale", all(message for message in messages))
referenced = [
    value.strip("_").removeprefix("MSG_")
    for value in (manifest.get("name"), manifest.get("description"),
                  manifest.get("browser_action", {}).get("default_title"))
    if isinstance(value, str) and value.startswith("__MSG_")
]
for key in referenced:
    check(f"manifest placeholder '{key}' exists in every locale",
          all(key in locales[locale] for locale in locales))
check("Chinese locale actually contains Chinese text",
      any("\u4e00" <= char <= "\u9fff" for char in locales["zh_CN"]["extensionName"]["message"]))

print("\nPASS" if not failures else f"\nFAILED: {', '.join(failures)}")
sys.exit(0 if not failures else 1)
