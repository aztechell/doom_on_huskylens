# kflash.py ISP stub

`isp_prog.bin` is the open K210 ISP SRAM stub embedded in
[`sipeed/kflash.py`](https://github.com/sipeed/kflash.py).

- Source revision: `550828c768b16ef329695d3f5eace3f6bcf14af2`
- Source file: `kflash.py`, variable `ISP_PROG`
- Extraction: zlib decompression of the hex-encoded value
- Size: 16,512 bytes
- SHA-256: `757776d0055048262ef92bd04a9f8cbad13647ec4f5c1f59494489a88d571129`
- License: MIT, reproduced in `LICENSE`

This helper runs from K210 SRAM only while flashing. It is not part of the
selected firmware image.
