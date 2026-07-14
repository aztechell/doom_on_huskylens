# doomgeneric integration replacements

Date: 2026-07-13

The HuskyLens port does not compile or stage the upstream `config.h`,
`doomgeneric.c`, `doomgeneric.h`, or `dummy.c`. Those files lacked an explicit
file-level GPL-2.0-or-later grant in the pinned upstream tree.

The active integration layer is independently maintained in
`firmware/src/doom` under GPL-3.0-or-later:

| Active source | Build role |
| --- | --- |
| `doom_build_config.h` | Defines the small set of package and standard-header facts required by the K210 build; staged as `doomgeneric/config.h`. |
| `doom_port_api.h` | Declares the framebuffer and platform callback contract; staged as `doomgeneric/doomgeneric.h` for engine sources. |
| `doom_engine_bootstrap.c` | Owns the framebuffer, passes the command line to the engine, initializes the platform, and starts `D_DoomMain`. |
| `doom_compat_stubs.c` | Supplies the disabled network state and no-op Timidity configuration hook required by the selected source set. |

The replacements preserve only the interfaces and build facts required by the
compiled engine call sites. They do not reuse upstream comments, formatting,
or implementation text. The replacement mapping is explicit in
`tools/build_firmware.py` and is guarded by
`tests/test_doomgeneric_replacements.py`.
