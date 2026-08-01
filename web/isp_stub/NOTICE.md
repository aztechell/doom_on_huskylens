# HuskyLens display ISP stub

`isp_prog_huskylens.bin` is the project's K210 SRAM ISP helper. It preserves
the kflash wire protocol and displays ST7789 update progress without full-screen
redraws during block writes.

- Protocol/flash source: `loboris/ktool` revision `0345aa90d9b3830641373fb4e3ce4edf45d0a46f`
- Kendryte SDK baseline: `02576ba67e8797444f3ee3f34c625b5ed048e707`
- Size: 17,664 bytes
- SHA-256: `30dd09e36d3b3e4fd912ae0f65f600960598531cd4e13826f2e3cfd3e4b95bb3`
- License: Apache-2.0, reproduced in `LICENSE`

The helper runs only from K210 SRAM while flashing. It is not part of the
selected firmware image.
