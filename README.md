# DOOM on HuskyLens

Standalone, soundless DOOM firmware for the Kendryte K210-based HuskyLens.
Only the platform files needed by this target are kept in this repository.

> [!IMPORTANT]
> The original commercial `DOOM.WAD` is **not distributed** by this project.
> You must supply your own legally obtained game data, or use Freedoom under its
> own license.

## SD card and game data

Format an SD card as FAT32, create `/DOOM/`, and copy one or more IWADs using
exactly these supported names:

- `DOOM.WAD`
- `FREEDOOM1.WAD`
- `FREEDOOM2.WAD`

The firmware uses that priority order. WAD data remains on the SD card and is
never embedded into or written by the firmware.

Freedoom is a separate project. If you redistribute Freedoom, include the
license and attribution from the Freedoom distribution. This repository
intentionally contains no WAD files.

## Build the firmware

The build helper downloads pinned Kendryte standalone SDK and `kflash.py`
revisions plus the versioned Kendryte GNU toolchain release into ignored
`_deps/` directories.

```powershell
python tools/bootstrap_deps.py
. .\env.ps1
python tools/check_env.py
python tools/build_firmware.py doom
```

The default output is `build/doom_huskylens.bin`; a release sidecar is written
to `dist/doom_huskylens.bin.json`. Build directories, SDK/toolchain downloads,
local paths and generated binaries are ignored.

## Command-line flashing

The existing Python flasher remains the reference implementation:

```powershell
python tools/hkflash.py flash build/doom_huskylens.bin --port COM10
python tools/hkflash.py monitor --port COM10 --reset-before-read --duration 10
```

`hkflash.py` does not perform a full-chip erase in its normal path. It writes
the K210 image at `0x000000` and keeps the padded write below the settings area
starting at `0x7FE000`.

## Controls

- `LEFT`, `RIGHT`: turn; menu up/down
- `OK`: move forward; menu confirm
- `BACK`: fire
- click `BACK` once while continuously holding `OK`: use/open doors after the
  320 ms double-click window
- double-click `BACK` while continuously holding `OK`: jump
- hold `BACK + OK` for 350 ms: menu/pause
- hold `BACK + RIGHT` for 350 ms: next owned weapon

## Tests

```powershell
python -m unittest discover tests
```

Component licenses and pinned upstream origins are listed in
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
The published HackyLens platform-source mapping is recorded in
[`docs/HACKYLENS_PROVENANCE.md`](docs/HACKYLENS_PROVENANCE.md).

## License and trademarks

The combined firmware is distributed under GNU GPL version 3. Separately
licensed components retain their original licenses and notices; see
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) and
[`docs/GPL_AUDIT.md`](docs/GPL_AUDIT.md). A binary release must be accompanied
by the complete corresponding source and exact dependency revisions described
there.

DOOM is a trademark of id Software/ZeniMax. HuskyLens is a product of DFRobot.
This independent project is not affiliated with or endorsed by id Software,
ZeniMax or DFRobot.
