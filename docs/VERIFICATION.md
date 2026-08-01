# Release verification

Verification date: 2026-07-15

- Incremental firmware build after the WAD-menu/UI changes: passed.
- Firmware unit/contract tests: 21 passed.
- Web flasher tests: 22 passed, including release-asset verification, the
  `0x7FE000` settings boundary, 4096-byte final-block padding, and non-repeating
  `BUSY` response handling.
- Pages package: same-origin CSP enforced; generated deployment excludes tests,
  build tools, package metadata, and unverified release binaries.
- Strict engine license audit: 168 files, no missing notices, staged hashes
  match the current source tree.
- Firmware size: 1,470,776 bytes.
- Firmware SHA-256:
  `938bdaee16fc520e8f4eab48ceedafb969517ca44c63597a8b14fdecb62f8c2f`.
- Pinned Kendryte SDK source archive: 3,033,192 bytes, SHA-256
  `19f9fd629a1649a35372541f8517cacb4be8dbee94eacd212856196c2af29562`.
- Flash target: HuskyLens on COM10, normal write path without full-chip erase.
- Final flash result: completed and rebooted successfully.
- Public installer path: the 17,664-byte HuskyLens display ISP at
  `web/isp_stub/isp_prog_huskylens.bin` was hardware-verified on COM10 at
  115,200/2,000,000 baud with a complete write, reboot, and successful boot.
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
