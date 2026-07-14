# HackyLens platform-layer provenance

Verification date: 2026-07-14

The hardware/platform layer used by this project originates from the author's
published HackyLens repository:

- upstream: `https://github.com/aztechell/hackylens`;
- verified commit: `d6e97dc1091dd4e95a0302abcf4675ed3995c0e3`;
- commit author: `aztechell <aztechell@gmail.com>`;
- upstream license: MIT;
- license commit: `5a75c051942f593c4848a7e312df903273e7f74e`;
- preserved license: `LICENSES/HACKYLENS-MIT.txt`.

Before adding local SPDX notices, Git blob comparison with the published
history established exact content provenance (with Git's text normalization)
for 14 of the 16 shared C files:

| File | Published Git blob |
| --- | --- |
| `firmware/src/board/board_hackylens.c` | `dc166cfee8758970a349b96f113b52feb405cf98` |
| `firmware/src/core/hk_binary.c` | `ce934ac247dfe8e748d9ed3a35d8b4da85b05cef` |
| `firmware/src/drivers/board_buttons.c` | `e7b22dfcaabbec03110aeb3d217191214d025b9d` |
| `firmware/src/drivers/lights.c` | `088646c7504d36e6365f90a526ac4b097901afe9` |
| `firmware/src/drivers/sd_spi.c` | `0742cdc2b5fd00b4c9ce372bcacf5765caca1c61` |
| `firmware/src/hal/hal_gpio.c` | `6591344295ae647f9c2c2ae3d43ffee6089456f0` |
| `firmware/src/hal/hal_pwm.c` | `8d5d32d84918f34bcf8b23c690ef9ee62dc170ee` |
| `firmware/src/hal/hal_spi.c` | `0e7582c3bf0ce919cf06c03e87a207bc459f5b34` |
| `firmware/src/hal/hal_time.c` | `728a97487dd6f9044af3f993ed53eed6da53064e` |
| `firmware/src/storage/fat32_alloc.c` | `9cbd5e502d79b972917872dccb05c537e1f25809` |
| `firmware/src/storage/fat32_file.c` | `10597ee6095e85ccb7246630088dbbffc9718acd` |
| `firmware/src/storage/fat32_sd.c` | `1cb6765dba3808384bee750c348380f95fb95897` |
| `firmware/src/storage/fat32_state.c` | `47ca89cfb3a73b396fc4428745b7cfb83a522c9a` |
| `firmware/src/storage/sd_card.c` | `e8d0c3e1126e2a7e2916bf57f0ded1b7f1eae881` |

Two files are intentional derivatives rather than byte-identical copies:

| Local file | Published base blob | Port modification |
| --- | --- | --- |
| `firmware/src/drivers/lcd_st7789.c` | `da3fbf99d81cbf015c5c592f3c692d80cd1bb165` | Makes the 153,600-byte LCD shadow optional. The Doom target builds with `HK_LCD_ENABLE_SHADOW=0` to preserve RAM. |
| `firmware/src/hal/hal_system.c` | `30684c553cce6314057e1ac84983124431f18c04` | Adds watchdog-based reboot used by `i_system_huskylens.c`. |

The published replacements for these two local adaptations are not copied
back because doing so would remove required Doom behavior or materially
increase its RAM use. The upstream MIT license permits retaining and modifying
these versions, subject to preserving its notice.
