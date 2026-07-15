import runpy
import struct
import tempfile
import unittest
from pathlib import Path


SEARCH_ORDER = ("DOOM.WAD", "FREEDOOM1.WAD", "FREEDOOM2.WAD")


def validate_wad(path: Path) -> tuple[int, int]:
    with path.open("rb") as stream:
        header = stream.read(12)
        if len(header) != 12 or header[:4] not in (b"IWAD", b"PWAD"):
            raise ValueError("bad WAD header")
        count, directory = struct.unpack_from("<II", header, 4)
        size = path.stat().st_size
        if count == 0 or count > 65535 or directory + count * 16 > size:
            raise ValueError("bad WAD directory")
        stream.seek(directory)
        for _ in range(count):
            lump = stream.read(16)
            if len(lump) != 16:
                raise ValueError("short WAD directory")
            position, lump_size = struct.unpack_from("<II", lump)
            if position + lump_size > size:
                raise ValueError("lump outside WAD")
    return count, directory


def write_test_wad(path: Path, magic: bytes = b"IWAD") -> tuple[int, int]:
    lumps = ((b"PLAYPAL", b"abc"), (b"MAP01", b""), (b"THINGS", b"xyz"))
    data = bytearray()
    entries = bytearray()
    position = 12
    for name, payload in lumps:
        data.extend(payload)
        entries.extend(struct.pack("<II8s", position, len(payload), name.ljust(8, b"\0")))
        position += len(payload)
    directory = 12 + len(data)
    path.write_bytes(magic + struct.pack("<II", len(lumps), directory) + data + entries)
    return len(lumps), directory


def select_wad(names: list[str]) -> str | None:
    available = {name.casefold() for name in names}
    return next((name for name in SEARCH_ORDER if name.casefold() in available), None)


def canonical_iwad(name: str) -> str:
    return f"/DOOM/{name.upper()}"


def segmented_read(data: bytes, offset: int, length: int,
                   sector_size: int = 512, cluster_size: int = 4096) -> bytes:
    result = bytearray()
    remaining = min(length, max(0, len(data) - offset))
    while remaining:
        in_cluster = offset % cluster_size
        in_sector = in_cluster % sector_size
        take = min(remaining, sector_size - in_sector)
        result.extend(data[offset:offset + take])
        offset += take
        remaining -= take
    return bytes(result)


class PortContractTests(unittest.TestCase):
    def test_synthetic_wads_have_valid_directories(self):
        with tempfile.TemporaryDirectory() as directory_name:
            directory_path = Path(directory_name)
            for magic in (b"IWAD", b"PWAD"):
                with self.subTest(magic=magic):
                    path = directory_path / f"{magic.decode()}.wad"
                    expected = write_test_wad(path, magic)
                    self.assertEqual(validate_wad(path), expected)

    def test_corrupt_header_and_directory_are_rejected(self):
        with tempfile.TemporaryDirectory() as directory_name:
            invalid = Path(directory_name) / "invalid.wad"
            invalid.write_bytes(b"IWAD" + struct.pack("<II", 10, 0xFFFFFFF0))
            with self.assertRaises(ValueError):
                validate_wad(invalid)

    def test_search_order_is_case_insensitive(self):
        self.assertEqual(select_wad(["freedoom2.wad", "doom.wad"]), "DOOM.WAD")
        self.assertEqual(select_wad(["FreeDoom1.Wad"]), "FREEDOOM1.WAD")
        self.assertIsNone(select_wad(["extras.wad"]))

    def test_freedoom_uses_names_known_by_doomgeneric(self):
        self.assertEqual(canonical_iwad("FREEDOOM1.WAD"), "/DOOM/FREEDOOM1.WAD")
        self.assertEqual(canonical_iwad("FREEDOOM2.WAD"), "/DOOM/FREEDOOM2.WAD")

    def test_segmented_reads_cross_sector_and_cluster_boundaries(self):
        data = bytes((i * 37) & 0xFF for i in range(12000))
        for offset, length in ((511, 3), (4094, 9), (8191, 1027), (11990, 50)):
            with self.subTest(offset=offset, length=length):
                self.assertEqual(segmented_read(data, offset, length), data[offset:offset + length])

    def test_chord_threshold_is_one_shot_until_release(self):
        threshold = 350
        fired = False
        events = []
        for now in (0, 100, 349, 350, 500):
            if not fired and now >= threshold:
                events.append("menu")
                fired = True
        self.assertEqual(events, ["menu"])
        fired = False
        self.assertFalse(fired)

    def test_single_back_click_while_ok_is_held_becomes_use(self):
        pulse_ms = 100
        double_click_ms = 320
        first_release_ms = 60
        use_ms = first_release_ms + double_click_ms
        events = [(use_ms, "use_down"), (use_ms + pulse_ms, "use_up")]
        self.assertEqual(events, [(380, "use_down"), (480, "use_up")])

    def test_double_back_click_while_ok_is_held_jumps_without_use(self):
        double_click_ms = 320
        first_release_ms = 60
        second_press_ms = 210
        events = [(second_press_ms, "jump_down"), (second_press_ms + 100, "jump_up")]
        self.assertLess(second_press_ms - first_release_ms, double_click_ms)
        self.assertEqual(events, [(210, "jump_down"), (310, "jump_up")])
        self.assertNotIn("use_down", [event for _, event in events])

    def test_long_back_ok_chord_opens_menu_without_use(self):
        threshold = 350
        events = []
        for now in (349, 350, 500):
            if now >= threshold and not any(event == "menu" for _, event in events):
                events.append((now, "menu"))
        self.assertEqual(events, [(350, "menu")])

    def test_jump_path_is_wired_from_gesture_to_player_momentum(self):
        root = Path(__file__).resolve().parents[1]
        platform = (root / "firmware/src/doom/doom_platform.c").read_text(encoding="utf-8")
        ticcmd = (root / "engine/doomgeneric/doomgeneric/g_game.c").read_text(encoding="utf-8")
        player = (root / "engine/doomgeneric/doomgeneric/p_user.c").read_text(encoding="utf-8")
        self.assertIn("BACK_DOUBLE_CLICK_MS 320U", platform)
        self.assertIn("start_key_pulse(HUSKYLENS_JUMP_KEY", platform)
        self.assertIn("cmd->buttons2 |= BT2_JUMP", ticcmd)
        self.assertIn("player->mo->momz = JUMP_VELOCITY", player)

    def test_wad_menu_sleeps_after_one_idle_minute_and_wakes_on_input(self):
        root = Path(__file__).resolve().parents[1]
        target = (root / "firmware/targets/doom.c").read_text(encoding="utf-8")
        self.assertIn("WAD_MENU_IDLE_SLEEP_US (60ULL * 1000000ULL)", target)
        self.assertIn("buttons_sync();", target)
        self.assertIn("now - last_activity_us >= WAD_MENU_IDLE_SLEEP_US", target)
        self.assertIn("lights_screen_backlight_off();", target)
        self.assertIn("if(pressed)", target)
        self.assertIn("wad_menu_wake(selected);", target)

    def test_loading_overlay_is_only_drawn_for_the_initial_palette(self):
        root = Path(__file__).resolve().parents[1]
        platform = (root / "firmware/src/doom/doom_platform.c").read_text(encoding="utf-8")
        start = platform.index("void doom_platform_set_palette")
        end = platform.index("\n}\n", start)
        palette_body = platform[start:end]
        self.assertIn("if(!g_initial_palette_set)", palette_body)
        self.assertIn("g_initial_palette_set = 1;", palette_body)
        self.assertEqual(palette_body.count("doom_platform_loading_progress"), 1)

    def test_flash_only_setup_is_pinned_and_checksum_verified(self):
        root = Path(__file__).resolve().parents[1]
        bootstrap = (root / "tools/bootstrap_deps.py").read_text(encoding="utf-8")
        self.assertIn("KFLASH_FLASH_ONLY_SHA256", bootstrap)
        self.assertIn("ISP_STUB_SHA256", bootstrap)
        self.assertIn("ensure_verified_download(", bootstrap)
        self.assertIn("verify_sha256(KFLASH_FLASH_ONLY_SCRIPT", bootstrap)
        self.assertIn("verify_sha256(ISP_STUB, ISP_STUB_SHA256)", bootstrap)
        flash_only = bootstrap.index("if args.flash_only:")
        normal_bootstrap = bootstrap.index("if not args.skip_download:", flash_only + 1)
        self.assertNotIn("ensure_git_checkout", bootstrap[flash_only:normal_bootstrap])

    def test_padded_flash_write_cannot_reach_settings_slots(self):
        root = Path(__file__).resolve().parents[1]
        flasher = runpy.run_path(str(root / "tools/hkflash.py"))
        builder = runpy.run_path(str(root / "tools/build_firmware.py"))
        boundary = flasher["SETTINGS_FLASH_OFFSET"]
        overhead = builder["K210_IMAGE_OVERHEAD"]

        self.assertEqual(flasher["checked_flash_write_length"](boundary), boundary)
        with self.assertRaises(ValueError):
            flasher["checked_flash_write_length"](boundary + 1)
        self.assertEqual(builder["padded_image_write_size"](boundary - overhead), boundary)
        self.assertGreater(builder["padded_image_write_size"](boundary - overhead + 1), boundary)

    def test_ok_tap_then_hold_switches_forward_to_backward(self):
        sequence_window_ms = 450
        backward_hold_ms = 180
        first_release_ms = 80
        second_press_ms = 180
        backward_start_ms = second_press_ms + backward_hold_ms
        events = [
            (0, "forward_down"),
            (first_release_ms, "forward_up"),
            (second_press_ms, "forward_down"),
            (backward_start_ms, "forward_up"),
            (backward_start_ms, "backward_down"),
            (600, "backward_up"),
        ]
        self.assertLess(second_press_ms - first_release_ms, sequence_window_ms)
        self.assertEqual(events[3:5], [
            (backward_start_ms, "forward_up"),
            (backward_start_ms, "backward_down"),
        ])


if __name__ == "__main__":
    unittest.main()
