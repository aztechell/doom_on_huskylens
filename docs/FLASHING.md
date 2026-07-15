# Flashing and UART guide

The top-level README contains the short installation path. This page documents
the advanced and diagnostic options.

## Installer-only setup

```powershell
py -m pip install pyserial
py tools/bootstrap_deps.py --flash-only
```

This downloads one pinned `kflash.py` reference file, verifies its SHA-256, and
extracts its ISP SRAM stub under ignored `_deps/`. It does not require Git and
does not install the compiler, toolchain, or SDK.

## Find the device

```powershell
py tools/hkflash.py list
```

The normal flash command can auto-detect common HuskyLens USB-UART adapters.
Use `--port COMx` when more than one matching adapter is attached.

## Normal firmware write

```powershell
py tools/hkflash.py flash build/doom_huskylens.bin --port COM10
```

The normal path writes the K210 image at `0x000000` and does not request a
full-chip erase. Do not add `--erase` unless you intentionally want the
explicit erase operation. The image-size guard keeps writes below the settings
area beginning at `0x7FE000`.

Useful options:

- `--manual` — wait for manual ISP-mode entry;
- `--auto-reset` — use the generic control-line sequence together with
  `--boot-rts`, `--reset-dtr`, or both;
- `--uploader-reset` — use the HuskyLens-compatible reset sequence (default);
- `--no-reboot` — leave the device in the ISP session after writing;
- `--verify` — request readback when supported by the selected ISP stub.

The current reference stub does not expose a flash-read command, so a verify
request may report that readback is unavailable. A successful reboot and UART
boot log provide the runtime write check.

## Monitor startup

```powershell
py tools/hkflash.py monitor --port COM10 --reset-before-read --duration 10
```

A healthy boot reports LCD initialization, SD-card initialization, FAT32
mounting, WAD validation, and the selected WAD path.

## Safety notes

- Never distribute a firmware image containing a commercial WAD.
- Do not disconnect USB power during a flash write.
- Keep the exact source commit and dependency revisions beside published
  binaries.
- Restoring the official product firmware is a separate DFRobot workflow.
