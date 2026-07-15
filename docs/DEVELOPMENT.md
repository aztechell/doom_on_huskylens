# Development guide

This document contains the build, architecture, and verification details kept
out of the installation-focused README.

## Reproducible build

The bootstrap helper checks out pinned revisions of the Kendryte standalone
SDK and the kflash reference, and downloads the versioned Kendryte GNU
toolchain into the ignored `_deps/` directory.

```powershell
py tools/bootstrap_deps.py
. .\env.ps1
py tools/check_env.py
py tools/build_firmware.py doom
```

Generated outputs:

- `build/doom_huskylens.bin` — raw K210 firmware image;
- `dist/doom_huskylens.bin` — release copy;
- `dist/doom_huskylens.bin.json` — version, size, hash, and flash addresses;
- `dist/doom_huskylens.bin.sha256` — checksum file for release verification.

Build trees, downloaded dependencies, local paths, generated binaries, and
game data are excluded by `.gitignore`.

## Source layout

- `firmware/targets/doom.c` — boot flow and WAD-selection UI;
- `firmware/src/doom/` — platform bridge, storage, and engine bootstrap;
- `firmware/src/{board,drivers,hal,storage}/` — minimal HuskyLens hardware layer;
- `engine/doomgeneric/doomgeneric/` — exact engine source/header build closure;
- `web/` — separate MIT-licensed, release-driven Web Serial installer;
- `tools/build_firmware.py` — deterministic staging and SDK build helper;
- `tools/audit_doomgeneric_licenses.py` — strict file-level license audit.

Only explicitly listed source and header dependencies are copied into the SDK
staging tree. The larger HackyLens application, camera, QR, and UI layers are
not part of this target.

## Tests and audit

```powershell
py -B -m unittest discover -s tests -v
py -B tools/audit_doomgeneric_licenses.py --csv docs/GPL_AUDIT_FILES.csv --strict
npm.cmd --prefix web test
```

The strict audit follows the actual staged engine dependency closure and
compares every staged file with its current repository source.

The Pages workflow runs the web tests, downloads release assets through the
GitHub API, verifies their size and SHA-256 metadata, and publishes only a
generated `_site` artifact. Release binaries are never committed to Git.

## Display and storage

The engine renders at 320x200 inside the 320x240 LCD. WAD data is validated and
streamed from the FAT32 microSD card rather than embedded in firmware. The
current memory and image limits are recorded in [RAM_BUDGET.md](RAM_BUDGET.md).

## Dependencies and licensing

Exact revisions, modification notices, and the static-link analysis are in
[GPL_AUDIT.md](GPL_AUDIT.md). Redistributing a binary requires corresponding
source for that exact build, including the pinned SDK source and retained
notices. Commercial DOOM WAD data must never be added to the repository or a
firmware release.
