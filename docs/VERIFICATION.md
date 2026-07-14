# Release verification

Verification date: 2026-07-14

- Clean build after publication cleanup: passed.
- Unit/contract tests: 16 passed.
- Strict engine license audit: 168 files, no missing notices, staged hashes
  match the current source tree.
- Firmware size: 1,470,520 bytes.
- Firmware SHA-256:
  `c01be177e9ae564d37c6065b25b1d0a71c1b3d75da20198c7875b9ddef00a5a9`.
- Flash target: HuskyLens on COM10, normal write path without full-chip erase.
- Flash result: completed and rebooted successfully.
- Boot UART: LCD initialized, SDHC initialized, FAT32 mounted, WAD validation
  passed, and `/DOOM/DOOM.WAD` was selected.

The selected ISP stub does not expose a flash-read command, so `--verify`
reported that readback was unavailable. Successful execution of the newly
written image provides the device-level write/boot check. The double-click
jump gesture is covered by contract tests; final tactile/gameplay confirmation
requires pressing the physical buttons while the game is running.
