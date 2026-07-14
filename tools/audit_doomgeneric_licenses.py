#!/usr/bin/env python3
"""Audit file-level licenses in the exact doomgeneric build dependency closure."""

from __future__ import annotations

import argparse
import csv
import hashlib
import re
import sys
from pathlib import Path

import build_firmware


ROOT = Path(__file__).resolve().parents[1]
ENGINE = ROOT / "engine" / "doomgeneric" / "doomgeneric"
REPLACEMENT_SOURCES = {
    "config.h": ROOT / "firmware" / "src" / "doom" / "doom_build_config.h",
    "doomgeneric.h": ROOT / "firmware" / "src" / "doom" / "doom_port_api.h",
}
DEPENDENCIES = (
    ROOT
    / "build"
    / "sdk-doom"
    / "CMakeFiles"
    / "doom_huskylens.dir"
    / "compiler_depend.make"
)
OBJECT_DEPENDENCIES = DEPENDENCIES.parent / "src" / "doom_huskylens" / "doomgeneric"

DEPENDENCY_PATTERN = re.compile(
    r"(?i)([A-Za-z]:/[^\r\n]*?src/doom_huskylens/doomgeneric/"
    r"([A-Za-z0-9_.-]+\.(?:c|h)))"
)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def classify(text: str) -> tuple[str, int | None]:
    lines = text.splitlines()
    for index, line in enumerate(lines, start=1):
        spdx = re.search(r"SPDX-License-Identifier:\s*([^\s*]+)", line)
        if spdx:
            return spdx.group(1), index
        if "either version 2" in line:
            window = "\n".join(lines[index - 1 : index + 3])
            if "any later version" in window:
                return "GPL-2.0-or-later", index
        if "either version 3" in line:
            window = "\n".join(lines[index - 1 : index + 3])
            if "any later version" in window:
                return "GPL-3.0-or-later", index
    return "NO-FILE-LEVEL-NOTICE", None


def dependency_files() -> dict[str, Path]:
    dependency_manifests = [DEPENDENCIES]
    dependency_manifests.extend(sorted(OBJECT_DEPENDENCIES.glob("*.obj.d")))
    if not any(path.is_file() and path.stat().st_size for path in dependency_manifests):
        raise RuntimeError(
            "compiler dependency manifests are missing; build target 'doom' before auditing"
        )

    result: dict[str, Path] = {}
    for manifest in dependency_manifests:
        if not manifest.is_file():
            continue
        text = manifest.read_text(encoding="utf-8", errors="replace")
        for match in DEPENDENCY_PATTERN.finditer(text.replace("\\", "/")):
            staged = Path(match.group(1).replace("/", "\\"))
            name = match.group(2).lower()
            result.setdefault(name, staged)
    return result


def audit_rows() -> list[dict[str, str]]:
    staged_files = dependency_files()
    compiled = {name.lower() for name in build_firmware.DOOMGENERIC_SOURCES}
    dependency_sources = {name for name in staged_files if name.endswith(".c")}
    if compiled != dependency_sources:
        missing = sorted(compiled - dependency_sources)
        unexpected = sorted(dependency_sources - compiled)
        raise RuntimeError(
            f"build/source mismatch; missing={missing}, unexpected={unexpected}"
        )

    rows: list[dict[str, str]] = []
    for name, staged in sorted(staged_files.items()):
        local = REPLACEMENT_SOURCES.get(name, ENGINE / name)
        if not local.is_file() or not staged.is_file():
            raise RuntimeError(f"dependency is unavailable: {name}")
        license_id, line = classify(local.read_text(encoding="utf-8", errors="replace"))
        local_hash = sha256(local)
        staged_hash = sha256(staged)
        rows.append(
            {
                "file": name,
                "source_file": local.relative_to(ROOT).as_posix(),
                "type": local.suffix[1:],
                "classification": license_id,
                "evidence_line": str(line or ""),
                "sha256": local_hash,
                "staged_matches_current": str(local_hash == staged_hash).lower(),
            }
        )
    return rows


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--csv", type=Path, help="Write the complete file-level audit as CSV")
    parser.add_argument("--strict", action="store_true", help="Fail if any file lacks an explicit notice")
    args = parser.parse_args(argv)

    try:
        rows = audit_rows()
    except Exception as exc:
        print(f"[ERR] {exc}", file=sys.stderr)
        return 2

    counts: dict[str, int] = {}
    for row in rows:
        key = row["classification"]
        counts[key] = counts.get(key, 0) + 1

    print(f"dependency closure: {len(rows)} files")
    print(f"compiled C sources: {sum(row['type'] == 'c' for row in rows)}")
    print(f"included local headers: {sum(row['type'] == 'h' for row in rows)}")
    for key in sorted(counts):
        print(f"{key}: {counts[key]}")
    print(
        "staged sources match current tree: "
        + str(all(row["staged_matches_current"] == "true" for row in rows)).lower()
    )

    ambiguous = [row for row in rows if row["classification"] == "NO-FILE-LEVEL-NOTICE"]
    if ambiguous:
        print("files without an explicit file-level license notice:")
        for row in ambiguous:
            print(f"  {row['file']}")

    if args.csv:
        args.csv.parent.mkdir(parents=True, exist_ok=True)
        with args.csv.open("w", encoding="utf-8", newline="") as stream:
            writer = csv.DictWriter(stream, fieldnames=list(rows[0]))
            writer.writeheader()
            writer.writerows(rows)
        print(f"CSV: {args.csv.resolve()}")

    return 1 if args.strict and ambiguous else 0


if __name__ == "__main__":
    raise SystemExit(main())
