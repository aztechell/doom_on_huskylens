# Third-party notices

This file records the upstream components used by DOOM on HuskyLens. Original
license files remain beside vendored source where applicable.

## doomgeneric

- Upstream: `https://github.com/ozkl/doomgeneric`
- Based on checkout: `dcb7a8dbc7a16ce3dda29382ac9aae9d77d21284`
- Active file-level licenses: GNU GPL-2.0-or-later and GPL-3.0-or-later
- Local license: `engine/doomgeneric/LICENSE`

The vendored tree contains HuskyLens-specific modifications and is not an
unmodified upstream checkout. The upstream integration files `config.h`,
`doomgeneric.c`, `doomgeneric.h`, and `dummy.c` are not used by the active
build. Project-owned GPL-3.0-or-later replacements and their mapping are
documented in `docs/DOOMGENERIC_REPLACEMENTS.md`.

Seven active upstream files carry dated local modification notices:
`g_game.c`, `i_video.c`, `m_config.c`, `m_menu.c`, `m_misc.c`, `p_user.c`, and
`w_file.c`.

The separate id Software reference checkout is not used by the build and is
not stored in this repository. Commercial `DOOM.WAD` and user-supplied IWAD or
PWAD files are likewise not part of the repository.

## HackyLens platform layer

- Upstream: `https://github.com/aztechell/hackylens`
- Verified commit: `d6e97dc1091dd4e95a0302abcf4675ed3995c0e3`
- Copyright: 2026 aztechell
- License: MIT
- Preserved license: `LICENSES/HACKYLENS-MIT.txt`
- Provenance record: `docs/HACKYLENS_PROVENANCE.md`

Sixteen compiled platform C files originate from the published HackyLens
source. Fourteen match published Git blobs after text normalization; the LCD
and system implementations contain documented Doom-port modifications. Those
files remain MIT-licensed and are compatible with the combined GPLv3 work.

## Kendryte standalone SDK and toolchain

- SDK upstream: `https://github.com/kendryte/kendryte-standalone-sdk`
- SDK revision: `02576ba67e8797444f3ee3f34c625b5ed048e707`
- SDK license: Apache License 2.0
- Preserved SDK license: `LICENSES/KENDRYTE-SDK-APACHE-2.0.txt`
- Toolchain release: `v8.2.0-20190409`

These dependencies are downloaded locally by `tools/bootstrap_deps.py` and are
not committed. The generated firmware statically links SDK code. The active
engine closure consists of GPL-2.0-or-later and GPL-3.0-or-later files, and the
combined firmware is distributed under GPLv3, under which Apache-2.0 is
compatible. Binary distributors must provide complete corresponding source
and retain all applicable notices. This is an engineering audit record, not
legal advice.

## kflash.py

- Upstream: `https://github.com/sipeed/kflash.py`
- Reference revision: `550828c768b16ef329695d3f5eace3f6bcf14af2`
- Copyright: 2019 Vowstar
- License: MIT

The command-line flashing workflow uses kflash.py as its protocol reference.
Its downloaded ISP stub remains an ignored local dependency. The web flasher
bundles the upstream MIT-licensed 16,512-byte ISP stub at
`web/third_party/kflash.py/isp_prog.bin`; its SHA-256 is
`757776d0055048262ef92bd04a9f8cbad13647ec4f5c1f59494489a88d571129`,
and the original license and provenance notice are stored beside it.

The separate local `isp_prog_huskylens.bin` is not published because its
provenance and redistribution terms have not been established.

## HLWF web flasher

- Upstream: `https://github.com/aztechell/HLWF`
- Based on commit: `513c13d`
- Copyright: 2026 HLWF contributors
- License: MIT
- Preserved license: `web/LICENSE`
- Adaptation notice: `web/NOTICE.md`

The release-selection UI and Web Serial K210 implementation under `web/` are
derived from HLWF and adapted specifically for DOOM on HuskyLens. The web
application is an aggregated MIT component; it is not linked into the GPLv3
firmware image.

## Freedoom

Freedoom WADs are supported as user-supplied SD-card content but are not shipped
in this repository. Freedoom is a separate project and must be redistributed
with its own license and attribution.

## Names and trademarks

DOOM is a trademark of id Software/ZeniMax. HuskyLens is a DFRobot product.
References identify compatibility only and do not imply affiliation or
endorsement.
