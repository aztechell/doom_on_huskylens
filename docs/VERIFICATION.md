# Release verification

Verification date: 2026-07-15

- Incremental firmware build after the WAD-menu/UI changes: passed.
- Unit/contract tests: 20 passed.
- Strict engine license audit: 168 files, no missing notices, staged hashes
  match the current source tree.
- Firmware size: 1,470,776 bytes.
- Firmware SHA-256:
  `938bdaee16fc520e8f4eab48ceedafb969517ca44c63597a8b14fdecb62f8c2f`.
- Flash target: HuskyLens on COM10, normal write path without full-chip erase.
- Final flash result: completed and rebooted successfully.
- Public installer path: the 16,512-byte ISP stub extracted by `--flash-only`
  wrote the complete final image and rebooted it successfully.
- Flash boundary guard: the final padded write is 1,474,560 bytes, and a test
  confirms that a package crossing `0x7FE000` is rejected before opening USB.
- Boot UART: LCD initialized, SDHC initialized, FAT32 mounted, and all three
  installed WADs passed validation.
- WAD-menu idle test on hardware: after 60 seconds without input, UART emitted
  `[WAD] sleep after 60s idle` and the display backlight sleep path ran.
- Palette regression: the `STARTING DOOM` overlay is guarded to the initial
  engine palette; pickup, damage, and power-up palette changes no longer call
  the loading renderer.

The selected ISP stub does not expose a flash-read command, so device
verification uses successful execution of the newly written image and its UART
boot log. Button-wake and in-game pickup appearance still require tactile and
visual confirmation on the physical unit; their state paths are covered by the
contract tests.
