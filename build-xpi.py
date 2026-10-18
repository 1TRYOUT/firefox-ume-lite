#!/usr/bin/env python3
"""Package this extension directory into an installable .xpi.

XPI is a ZIP whose entries must use forward slashes, so this script builds the
archive with Python's zipfile instead of Compress-Archive, which can emit
backslash separators on Windows.

    python build-xpi.py            # -> ume-lite-1.0.0.xpi
"""

from __future__ import annotations

import json
import os
import zipfile

ROOT = os.path.dirname(os.path.abspath(__file__))

# Runtime files only: dev/ test pages and the build artifacts stay out.
INCLUDE = [
    "manifest.json",
    "_locales",
    "background.js",
    "content.js",
    "controller.css",
    "shadow.css",
    "options.html",
    "options.js",
    "options.css",
    "options.v3.css",
    "popup",
    "icons",
    "README.md",
    "LICENSE",
]


def version() -> str:
    with open(os.path.join(ROOT, "manifest.json"), encoding="utf-8") as handle:
        return json.load(handle)["version"]


def collect() -> list[tuple[str, str]]:
    """Return (absolute path, archive name) pairs, in a stable order."""
    entries: list[tuple[str, str]] = []
    for item in INCLUDE:
        path = os.path.join(ROOT, item)
        if os.path.isfile(path):
            entries.append((path, item))
            continue
        if not os.path.isdir(path):
            raise SystemExit(f"missing: {item}")
        for current, _dirs, files in os.walk(path):
            for name in sorted(files):
                full = os.path.join(current, name)
                rel = os.path.relpath(full, ROOT).replace(os.sep, "/")
                entries.append((full, rel))
    return entries


def main() -> None:
    target = os.path.join(ROOT, f"ume-lite-{version()}.xpi")
    entries = collect()

    if os.path.exists(target):
        os.remove(target)

    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as archive:
        for full, name in entries:
            if "\\" in name:
                raise SystemExit(f"bad archive name: {name}")
            archive.write(full, name)

    names = [name for _full, name in entries]
    if "manifest.json" not in names:
        raise SystemExit("manifest.json missing from the archive root")

    size_kb = os.path.getsize(target) / 1024
    print(f"built {os.path.basename(target)} ({size_kb:.1f} KB, {len(names)} entries)")
    for name in names:
        print(f"  {name}")


if __name__ == "__main__":
    main()
