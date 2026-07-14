import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))

import build_firmware  # noqa: E402


class DoomgenericReplacementTests(unittest.TestCase):
    MIT_PLATFORM_SOURCES = {
        "firmware/src/board/board_hackylens.c",
        "firmware/src/core/hk_binary.c",
        "firmware/src/drivers/board_buttons.c",
        "firmware/src/drivers/lcd_st7789.c",
        "firmware/src/drivers/lights.c",
        "firmware/src/drivers/sd_spi.c",
        "firmware/src/hal/hal_gpio.c",
        "firmware/src/hal/hal_pwm.c",
        "firmware/src/hal/hal_spi.c",
        "firmware/src/hal/hal_system.c",
        "firmware/src/hal/hal_time.c",
        "firmware/src/storage/fat32_alloc.c",
        "firmware/src/storage/fat32_file.c",
        "firmware/src/storage/fat32_sd.c",
        "firmware/src/storage/fat32_state.c",
        "firmware/src/storage/sd_card.c",
    }

    def test_ambiguous_upstream_sources_are_not_active(self):
        self.assertNotIn("dummy.c", build_firmware.DOOMGENERIC_SOURCES)
        self.assertNotIn("doomgeneric.c", build_firmware.DOOMGENERIC_SOURCES)
        engine = ROOT / "engine" / "doomgeneric" / "doomgeneric"
        for name in ("config.h", "doomgeneric.c", "doomgeneric.h", "dummy.c"):
            with self.subTest(name=name):
                self.assertFalse((engine / name).exists())

    def test_project_replacements_are_compiled(self):
        sources = {path.as_posix() for path in build_firmware.DOOM_FIRMWARE_SOURCES}
        self.assertIn("firmware/src/doom/doom_engine_bootstrap.c", sources)
        self.assertIn("firmware/src/doom/doom_compat_stubs.c", sources)

    def test_replacements_have_explicit_gpl3_notices(self):
        directory = ROOT / "firmware" / "src" / "doom"
        for name in (
            "doom_build_config.h",
            "doom_compat_stubs.c",
            "doom_engine_bootstrap.c",
            "doom_port_api.h",
        ):
            with self.subTest(name=name):
                text = (directory / name).read_text(encoding="utf-8")
                self.assertIn("SPDX-License-Identifier: GPL-3.0-or-later", text)

    def test_all_compiled_project_sources_have_explicit_notices(self):
        sources = [Path("firmware/targets/doom.c"), *build_firmware.DOOM_FIRMWARE_SOURCES]
        self.assertEqual(23, len(sources))
        for source in sources:
            expected = "MIT" if source.as_posix() in self.MIT_PLATFORM_SOURCES else "GPL-3.0-or-later"
            with self.subTest(source=source.as_posix()):
                text = (ROOT / source).read_text(encoding="utf-8")
                self.assertIn(f"SPDX-License-Identifier: {expected}", text)

    def test_hackylens_mit_license_is_preserved(self):
        text = (ROOT / "LICENSES" / "HACKYLENS-MIT.txt").read_text(encoding="utf-8")
        self.assertIn("Copyright (c) 2026 aztechell", text)
        self.assertIn("Permission is hereby granted", text)


if __name__ == "__main__":
    unittest.main()
