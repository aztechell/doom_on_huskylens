# RAM and flash budget

The DOOM target intentionally stages only its display, buttons, lights,
SD/FAT32, platform, and engine dependencies. Camera, QR, PNG, UI application,
and settings modules from the original HackyLens firmware are not part of the
build or this repository.

The verified 2026-07-14 build reports:

| Region | Bytes |
| --- | ---: |
| text | 1,234,938 |
| data | 235,492 |
| bss | 305,264 |
| K210 image | 1,470,520 |

The build guard requires the padded firmware write to end before `0x007FE000`,
preserving the two 4 KiB settings slots at `0x007FE000` and `0x007FF000`.
Current static display memory is owned by `drivers/lcd_st7789.c`; SD/FAT32
buffers are owned by the retained storage modules. WAD data is streamed from
the SD card and is not embedded in the firmware image.
