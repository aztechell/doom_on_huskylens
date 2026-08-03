# HuskyLens display ISP stub

`isp_prog_huskylens.bin` is the project's K210 SRAM ISP helper. It preserves
the kflash wire protocol and displays ST7789 update progress without full-screen
redraws during block writes.

- Protocol/flash source: `loboris/ktool` revision `0345aa90d9b3830641373fb4e3ce4edf45d0a46f`
- Kendryte SDK baseline: `02576ba67e8797444f3ee3f34c625b5ed048e707`
- Upstream release: `aztechell/huskylens-isp-stub` v1.1 (`2b86fb85de22467c52286735db8ad656e7f7b8a1`)
- Size: 17,856 bytes
- SHA-256: `da6305613ff9179afd439be1227ec877d583cde351afed604c7e053052f57cd7`
- License: Apache-2.0, reproduced in `LICENSE`

The helper runs only from K210 SRAM while flashing. It is not part of the
selected firmware image.
