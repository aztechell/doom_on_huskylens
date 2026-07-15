# GPL compatibility audit: DOOM on HuskyLens

Audit date: 2026-07-15

This is an engineering license audit, not legal advice. It records what can be
proved from the repository, the actual completed build, and the pinned upstream
comparison. It deliberately does not infer a license from authorship or intent
when the files do not say so.

## Result

**The cleaned source repository is ready for publication as a GPLv3 project.**
The four ambiguous doomgeneric integration files are outside the repository,
all active replacements and platform files have explicit grants, modified
upstream files carry dated notices, and exact build dependencies are pinned.
A prebuilt binary must still be released together with the complete
corresponding source for that exact binary, including the pinned SDK source and
the installation/build instructions in this repository.

| Question | Finding |
| --- | --- |
| Are all compiled Doom files explicitly GPLv3-compatible? | **Yes.** 165 of 168 engine-closure files are GPL-2.0-or-later and three are GPL-3.0-or-later. |
| Can the binary be distributed as GPL-2.0-only? | **No.** `sha1.c` is GPL-3.0-or-later, and the binary statically incorporates Apache-2.0 SDK code. |
| Is GPLv3 a technically viable target? | **Yes.** GPL-2.0-or-later code may be used under GPLv3, the replacements are GPL-3.0-or-later, and Apache-2.0 is compatible with GPLv3. |
| Is removal of the Kendryte SDK required solely for license compatibility? | **No.** Moving the combined work to GPLv3 is the simpler route, provided all other code can lawfully be conveyed under GPLv3. |

The narrowest defensible conclusion is therefore: **publish the source under
GPLv3; publish a firmware binary only with its exact corresponding source and
retained third-party notices.**

The browser installer under `web/` is a separate MIT-licensed aggregate based
on HLWF. It is not compiled or linked into the GPLv3 firmware. Its license,
adaptation notice, and the provenance of its kflash.py SRAM helper are kept
inside `web/` and summarized in `THIRD_PARTY_NOTICES.md`.

## Audited build and method

The audit follows the actual `doom_huskylens` build rather than scanning every
vendored file. After verification, the generated build evidence is archived
under `../doom_on_huskylens_dump/generated/hackylens-mit-provenance-2026-07-14/build`;
rebuilding recreates the original paths below:

- build dependency evidence: per-object `*.obj.d` manifests below
  `../doom_on_huskylens_dump/generated/hackylens-mit-provenance-2026-07-14/build/sdk-doom/CMakeFiles/doom_huskylens.dir/src/doom_huskylens/doomgeneric`;
- linker evidence:
  `../doom_on_huskylens_dump/generated/hackylens-mit-provenance-2026-07-14/build/sdk-doom/CMakeFiles/doom_huskylens.dir/link.txt`;
- Doom source list:
  `DOOMGENERIC_SOURCES` in `tools/build_firmware.py`;
- pinned comparison upstream:
  `ozkl/doomgeneric@dcb7a8dbc7a16ce3dda29382ac9aae9d77d21284`;
- SDK used by the completed build:
  `kendryte/kendryte-standalone-sdk@02576ba67e8797444f3ee3f34c625b5ed048e707`.

The current verified build is 1,470,776 bytes with SHA-256
`938bdaee16fc520e8f4eab48ceedafb969517ca44c63597a8b14fdecb62f8c2f`.

The exact Doom dependency closure contains 168 local files:

| File-level classification | C files | Headers | Total |
| --- | ---: | ---: | ---: |
| GPL-2.0-or-later | 75 | 90 | 165 |
| GPL-3.0-or-later | 1 | 2 | 3 |
| No file-level notice | 0 | 0 | 0 |
| **Total** | **76** | **92** | **168** |

All 168 staged build inputs hash-match their current source files. The complete
per-file result, source mapping, evidence line, SHA-256, and staged-tree comparison are in
`docs/GPL_AUDIT_FILES.csv`. Reproduce it with:

```powershell
py -B tools\audit_doomgeneric_licenses.py --csv docs\GPL_AUDIT_FILES.csv --strict
```

The strict audit now returns exit code 0.

## Engine findings

### GPL-3.0-or-later file

`engine/doomgeneric/doomgeneric/sha1.c` states at lines 10–11 that it is
available under GPL version 3 or any later version. Its SHA-256 is:

```text
0aa4fc4d7801dace19989616981a675314060d8498952d0e30c913506e31b782
```

Because `sha1.c` is compiled and statically linked into the same executable,
it prevents distribution of that executable under GPLv2. The 165 files that
say GPL version 2 **or later** can instead be taken under GPLv3.

### Four ambiguous upstream files replaced

| Removed active file | Project replacement |
| --- | --- |
| `config.h` | `firmware/src/doom/doom_build_config.h` |
| `doomgeneric.c` | `firmware/src/doom/doom_engine_bootstrap.c` |
| `doomgeneric.h` | `firmware/src/doom/doom_port_api.h` |
| `dummy.c` | `firmware/src/doom/doom_compat_stubs.c` |

The upstream files remain preserved outside the active project at
`../doom_on_huskylens_dump/replaced_upstream/doomgeneric`. They are neither
compiled nor staged. The four replacements were independently written for the
small interface/build roles required by this port and each carries
`SPDX-License-Identifier: GPL-3.0-or-later`. See
`docs/DOOMGENERIC_REPLACEMENTS.md`.

### Local modifications requiring notices

Compared with the pinned doomgeneric checkout, exactly seven upstream files in
the active compiled closure are modified:

- `g_game.c`
- `i_video.c`
- `m_config.c`
- `m_menu.c`
- `m_misc.c`
- `p_user.c`
- `w_file.c`

All seven files carry GPL-2.0-or-later grants and now contain prominent
project modification/date notices without deleting upstream copyright or
license text.

### Original DOOM provenance caveat

The official id Software repository describes the original release as GPL 2.0,
and the Chocolate Doom FAQ also describes that project as GPL version 2. The
actual vendored files audited here mostly contain explicit GPL-2.0-or-later
notices, which is the operative file-level evidence used for the counts above.
For a high-value commercial release, counsel should still confirm the authority
chain for applying the `or later` option to portions inherited from the original
DOOM code. This caveat is separate from the four directly ambiguous files.

## Project firmware layer

The target also compiles 23 project C files: `firmware/targets/doom.c` plus the
22 entries in `DOOM_FIRMWARE_SOURCES`. All 23 now carry explicit file-level
notices:

- 16 shared platform files are MIT-licensed HackyLens sources;
- five Doom-specific port files are GPL-3.0-or-later;
- two independent doomgeneric integration replacements are
  GPL-3.0-or-later.

The platform source is publicly available from
`https://github.com/aztechell/hackylens` at verified commit
`d6e97dc1091dd4e95a0302abcf4675ed3995c0e3`, with an MIT license naming
`aztechell` as copyright holder. Fourteen local C files were matched to exact
published Git blobs before adding local SPDX headers. The remaining two,
`lcd_st7789.c` and `hal_system.c`, are documented derivatives required for
the Doom RAM budget and reboot path. The MIT notice is preserved at
`LICENSES/HACKYLENS-MIT.txt`; the complete mapping and blob evidence are in
`docs/HACKYLENS_PROVENANCE.md`.

This resolves the prior repository-evidence gap for the 16 sibling-derived
platform files. The public license establishes permission independently of
whether the local port remains byte-identical to the latest upstream version.

## Kendryte SDK and link result

The completed build used clean SDK checkout
`02576ba67e8797444f3ee3f34c625b5ed048e707`, whose root license is Apache-2.0.
The linker command is static and wraps `libkendryte.a` in `--whole-archive`, so
the SDK is not merely a build tool: its object code is incorporated into the
firmware.

The Apache Software Foundation records Apache-2.0 as compatible with GPLv3 but
not GPLv2. This confirms:

- the current `GPL-2.0-only` statements in the project are not suitable for the
  combined firmware;
- the SDK does not block a GPLv3 release;
- Apache copyright, license, attribution, and any upstream NOTICE obligations
  still have to be preserved in the distribution.

`tools/bootstrap_deps.py` verifies the exact SDK revision above and the pinned
`kflash.py` reference revision. The versioned Kendryte GNU toolchain URL is
fixed to release `v8.2.0-20190409`. The SDK Apache-2.0 text is preserved at
`LICENSES/KENDRYTE-SDK-APACHE-2.0.txt`. The completed build retains its linker
command and per-object dependency manifests under `build/sdk-doom`.

## Distribution obligations after remediation

For a GPLv3 firmware release, provide at least:

1. the complete corresponding source for the exact binary, including local
   modifications, SDK source, interface headers, and build/control scripts;
2. the GPLv3 text plus retained third-party copyright, Apache-2.0, and other
   applicable notices;
3. prominent modification/date notices on modified upstream files;
4. exact dependency revisions and instructions sufficient to rebuild;
5. equivalent source access next to a downloadable binary;
6. installation information if the firmware is conveyed for a GPLv3 "User
   Product" in circumstances covered by GPLv3 section 6.

Commercial DOOM WAD data is outside this audit and must not be bundled. A
user-supplied Freedoom WAD is a separate work and needs its own license and
notices if redistributed.

## Required release gates

- [x] Replace `config.h`, `doomgeneric.c`, `doomgeneric.h`, and `dummy.c` with
  independently maintained GPL-3.0-or-later integration files.
- [x] Record public MIT provenance for the 16 HackyLens-derived C files,
  preserve its license, and add explicit notices to all 23 project C files.
- [x] Add truthful change/date notices to the seven modified upstream
  doomgeneric files.
- [x] Change the project-level declaration and full root license text to GPLv3.
- [x] Pin SDK, kflash, and toolchain inputs and preserve their applicable
  release notices.
- [x] Rebuild from the cleaned tree and regenerate the strict per-file audit.
- [x] Keep all commercial WADs and unlicensed ISP blobs out of the publication.

For each binary release, tag the exact source commit, attach the matching SDK
source (or provide equivalent corresponding-source access), and retain these
license/notices files beside the download.

## Primary references

- [GNU GPL FAQ: GPLv2/GPLv3 compatibility](https://www.gnu.org/licenses/gpl-faq.en.html#v2v3Compatibility)
- [GNU GPL version 2, section 2](https://www.gnu.org/licenses/old-licenses/gpl-2.0.html)
- [GNU GPL version 3, sections 5–6](https://www.gnu.org/licenses/gpl-3.0.html)
- [Apache License 2.0 and GPL compatibility](https://www.apache.org/licenses/GPL-compatibility)
- [Official id Software DOOM source release](https://github.com/id-Software/DOOM)
- [Chocolate Doom licensing FAQ](https://www.chocolate-doom.org/wiki/index.php/FAQ)
