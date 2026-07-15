#!/usr/bin/env python3
"""Build the DOOM on HuskyLens firmware through Kendryte standalone SDK."""

from __future__ import annotations

import argparse
import os
from pathlib import Path
import shutil
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[1]
WORKSPACE = ROOT.parent
LOCAL_DEPS = ROOT / "_deps"
LEGACY_DEPS = WORKSPACE / "hackylens-legacy" / "_deps"
SETTINGS_FLASH_OFFSET = 0x007FE000
FLASH_WRITE_BLOCK = 4096
# One I/O-mode byte, a 4-byte image length, and a 32-byte SHA-256 digest.
K210_IMAGE_OVERHEAD = 1 + 4 + 32

PROJECT = "doom_huskylens"
OUTPUT = "doom_huskylens.bin"
BUILD_DIR = "sdk-doom"
TARGET_SOURCE = ROOT / "firmware" / "targets" / "doom.c"


def padded_image_write_size(raw_size: int) -> int:
    payload_size = raw_size + K210_IMAGE_OVERHEAD
    return (payload_size + FLASH_WRITE_BLOCK - 1) // FLASH_WRITE_BLOCK * FLASH_WRITE_BLOCK

DOOM_FIRMWARE_SOURCES = [
    Path("firmware/src/board/board_hackylens.c"),
    Path("firmware/src/core/hk_binary.c"),
    Path("firmware/src/doom/doom_platform.c"),
    Path("firmware/src/doom/doom_storage.c"),
    Path("firmware/src/doom/doom_engine_bootstrap.c"),
    Path("firmware/src/doom/doom_compat_stubs.c"),
    Path("firmware/src/doom/i_system_huskylens.c"),
    Path("firmware/src/doom/w_file_huskylens.c"),
    Path("firmware/src/drivers/board_buttons.c"),
    Path("firmware/src/drivers/lcd_st7789.c"),
    Path("firmware/src/drivers/lights.c"),
    Path("firmware/src/drivers/sd_spi.c"),
    Path("firmware/src/hal/hal_gpio.c"),
    Path("firmware/src/hal/hal_pwm.c"),
    Path("firmware/src/hal/hal_spi.c"),
    Path("firmware/src/hal/hal_system.c"),
    Path("firmware/src/hal/hal_time.c"),
    Path("firmware/src/storage/fat32_alloc.c"),
    Path("firmware/src/storage/fat32_file.c"),
    Path("firmware/src/storage/fat32_sd.c"),
    Path("firmware/src/storage/fat32_state.c"),
    Path("firmware/src/storage/sd_card.c"),
]

DOOM_FIRMWARE_HEADERS = [
    Path(name)
    for name in (
        "board/board_hackylens.h board/board_pins.h "
        "config/display_config.h config/fat32_config.h config/input_config.h config/sd_config.h "
        "core/camera_types.h core/file_name.h core/hk_app.h core/hk_binary.h "
        "doom/doom_platform.h doom/doom_port_api.h doom/doom_storage.h "
        "drivers/hk_input.h drivers/hk_lcd.h drivers/hk_lights.h drivers/hk_sd.h drivers/sd_spi.h "
        "hal/hal_gpio.h hal/hal_pwm.h hal/hal_spi.h hal/hal_system.h hal/hal_time.h "
        "storage/fat_file_entry.h storage/fat32_allocation.h storage/fat32_file.h "
        "storage/fat32_stream.h storage/fat32_types.h storage/fat32_volume.h "
        "storage/internal/fat32_state_private.h"
    ).split()
]

DOOM_ASSET_HEADERS = [
    Path("doom_loading_rgb565.h"),
    Path("hackylens_boot_logo_1bpp.h"),
    Path("hackylens_font_1bpp.h"),
]

DOOMGENERIC_SOURCES = [
    name for name in (
        "am_map.c doomdef.c doomstat.c dstrings.c d_event.c d_items.c "
        "d_iwad.c d_loop.c d_main.c d_mode.c d_net.c f_finale.c f_wipe.c "
        "g_game.c hu_lib.c hu_stuff.c info.c i_cdmus.c i_endoom.c "
        "i_joystick.c i_scale.c i_sound.c i_timer.c memio.c m_argv.c "
        "m_bbox.c m_cheat.c m_config.c m_controls.c m_fixed.c m_menu.c "
        "m_misc.c m_random.c p_ceilng.c p_doors.c p_enemy.c p_floor.c "
        "p_inter.c p_lights.c p_map.c p_maputl.c p_mobj.c p_plats.c "
        "p_pspr.c p_saveg.c p_setup.c p_sight.c p_spec.c p_switch.c "
        "p_telept.c p_tick.c p_user.c r_bsp.c r_data.c r_draw.c r_main.c "
        "r_plane.c r_segs.c r_sky.c r_things.c sha1.c sounds.c statdump.c "
        "st_lib.c st_stuff.c s_sound.c tables.c v_video.c wi_stuff.c "
        "w_checksum.c w_file.c w_main.c w_wad.c z_zone.c i_input.c "
        "i_video.c"
    ).split()
]


def dep_roots() -> list[Path]:
    return [LOCAL_DEPS, LEGACY_DEPS]


def find_sdk() -> Path | None:
    candidates: list[Path] = []
    if os.environ.get("KENDRYTE_SDK_DIR"):
        candidates.append(Path(os.environ["KENDRYTE_SDK_DIR"]))
    for root in dep_roots():
        candidates.append(root / "kendryte-standalone-sdk")
    for path in candidates:
        if (path / "CMakeLists.txt").is_file() and (path / "lib").is_dir():
            return path.resolve()
    return None


def find_toolchain_bin() -> Path | None:
    candidates: list[Path] = []
    if os.environ.get("KENDRYTE_TOOLCHAIN_BIN"):
        candidates.append(Path(os.environ["KENDRYTE_TOOLCHAIN_BIN"]))
    for name in ("riscv64-unknown-elf-gcc.exe", "riscv64-unknown-elf-gcc"):
        exe = shutil.which(name)
        if exe:
            candidates.append(Path(exe).parent)
    for root in dep_roots():
        if root.is_dir():
            for name in ("riscv64-unknown-elf-gcc.exe", "riscv64-unknown-elf-gcc"):
                candidates.extend(path.parent for path in root.rglob(name) if path.is_file())
    for path in candidates:
        for exe_name in ("riscv64-unknown-elf-gcc.exe", "riscv64-unknown-elf-gcc"):
            if (path / exe_name).is_file():
                return path.resolve()
    return None


def run(cmd: list[str], cwd: Path | None = None) -> None:
    print("+ " + " ".join(str(part) for part in cmd))
    subprocess.run(cmd, cwd=cwd, check=True)


def cmake_path(path: Path) -> str:
    return str(path).replace("\\", "/")


def copy_required(source: Path, output: Path) -> None:
    if not source.is_file():
        raise RuntimeError(f"required build input is missing: {source}")
    output.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, output)


def stage_target(sdk: Path) -> Path:
    stage = sdk / "src" / PROJECT
    if stage.exists():
        shutil.rmtree(stage)
    stage.mkdir(parents=True, exist_ok=True)

    copy_required(TARGET_SOURCE, stage / "main.c")
    firmware_src = ROOT / "firmware" / "src"
    for rel in DOOM_FIRMWARE_HEADERS:
        copy_required(firmware_src / rel, stage / rel)
    for rel in DOOM_FIRMWARE_SOURCES:
        source = ROOT / rel
        copy_required(source, stage / source.relative_to(firmware_src))

    doomgeneric = ROOT / "engine" / "doomgeneric" / "doomgeneric"
    for header in doomgeneric.glob("*.h"):
        copy_required(header, stage / "doomgeneric" / header.name)
    replacements = firmware_src / "doom"
    copy_required(replacements / "doom_port_api.h", stage / "doomgeneric" / "doomgeneric.h")
    copy_required(replacements / "doom_build_config.h", stage / "doomgeneric" / "config.h")
    for name in DOOMGENERIC_SOURCES:
        copy_required(doomgeneric / name, stage / "doomgeneric" / name)

    for name in DOOM_ASSET_HEADERS:
        copy_required(ROOT / "firmware" / "assets" / name, stage / name)

    (stage / "project.cmake").write_text(
        "target_compile_definitions(${PROJECT_NAME} PRIVATE "
        "HUSKYLENS=1 NORMALUNIX=1 CMAP256=1 "
        "DOOMGENERIC_RESX=320 DOOMGENERIC_RESY=200 "
        "HK_LCD_ENABLE_SHADOW=0)\n"
        "target_include_directories(${PROJECT_NAME} PRIVATE "
        "${CMAKE_CURRENT_LIST_DIR}/doomgeneric "
        "${CMAKE_CURRENT_LIST_DIR}/doom)\n"
        "target_compile_options(${PROJECT_NAME} PRIVATE "
        "-Wno-error=unused-const-variable -Wno-error=type-limits "
        "-Wno-error=unused-but-set-parameter "
        "-Wno-error=format-truncation)\n",
        encoding="utf-8",
    )
    return stage


def build_target(sdk: Path, toolchain_bin: Path) -> Path:
    out_image = ROOT / "build" / OUTPUT
    stage = stage_target(sdk)
    print(f"[STAGE] {stage}")

    build_dir = ROOT / "build" / BUILD_DIR
    build_dir.mkdir(parents=True, exist_ok=True)

    generator = "MinGW Makefiles" if os.name == "nt" else "Ninja"
    cmake = shutil.which("cmake")
    if not cmake:
        raise RuntimeError("cmake not found")

    run([
        cmake,
        "-S",
        cmake_path(sdk),
        "-B",
        cmake_path(build_dir),
        "-G",
        generator,
        f"-DPROJ={PROJECT}",
        f"-DTOOLCHAIN={cmake_path(toolchain_bin)}",
        "-DCMAKE_POLICY_VERSION_MINIMUM=3.5",
    ])
    run([cmake, "--build", cmake_path(build_dir)])

    size_tool = toolchain_bin / ("riscv64-unknown-elf-size.exe" if os.name == "nt" else "riscv64-unknown-elf-size")
    executable = build_dir / PROJECT
    if size_tool.is_file() and executable.is_file():
        run([str(size_tool), str(executable)])

    built = build_dir / f"{PROJECT}.bin"
    if not built.is_file() or built.stat().st_size == 0:
        raise RuntimeError(f"build did not produce a non-empty image: {built}")
    raw_size = built.stat().st_size
    padded_write_size = padded_image_write_size(raw_size)
    if padded_write_size > SETTINGS_FLASH_OFFSET:
        raise RuntimeError(
            f"padded firmware write reaches settings flash slot "
            f"0x{SETTINGS_FLASH_OFFSET:06X}: {padded_write_size} bytes "
            f"from {raw_size} raw bytes"
        )

    out_image.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(built, out_image)
    run([sys.executable, str(ROOT / "tools" / "make_image.py"), str(out_image), "--out-dir", str(ROOT / "dist")])
    print(f"[OK] {out_image} ({out_image.stat().st_size} bytes)")
    return out_image


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build DOOM on HuskyLens firmware")
    parser.add_argument("target", nargs="?", choices=("doom",), default="doom")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    parse_args(argv)
    sdk = find_sdk()
    if not sdk:
        print("[ERR] Kendryte SDK not found. Run: py tools\\bootstrap_deps.py", file=sys.stderr)
        return 1
    toolchain = find_toolchain_bin()
    if not toolchain:
        print("[ERR] Kendryte toolchain not found. Run bootstrap_deps.py and . .\\env.ps1", file=sys.stderr)
        return 1

    build_target(sdk, toolchain)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        raise SystemExit(130)
    except subprocess.CalledProcessError as exc:
        print(f"[ERR] command failed with exit code {exc.returncode}", file=sys.stderr)
        raise SystemExit(exc.returncode)
    except Exception as exc:
        print(f"[ERR] {exc}", file=sys.stderr)
        raise SystemExit(1)
