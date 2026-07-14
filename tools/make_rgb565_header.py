import argparse
from pathlib import Path

from PIL import Image


def main() -> None:
    parser = argparse.ArgumentParser(description="Convert a loading image to an indexed RGB565 C header")
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--symbol", default="g_doom_loading_rgb565")
    args = parser.parse_args()

    image = Image.open(args.input).convert("RGB")
    if image.size != (320, 240):
        raise SystemExit(f"expected a 320x240 image, got {image.size[0]}x{image.size[1]}")
    image = image.resize((320, 200), Image.Resampling.LANCZOS)
    indexed = image.quantize(colors=256, method=Image.Quantize.MEDIANCUT,
                             dither=Image.Dither.FLOYDSTEINBERG)

    raw_palette = indexed.getpalette()[:256 * 3]
    palette = []
    for offset in range(0, len(raw_palette), 3):
        red, green, blue = raw_palette[offset:offset + 3]
        palette.append(((red & 0xF8) << 8) | ((green & 0xFC) << 3) | (blue >> 3))
    pixels = list(indexed.getdata())

    lines = [
        "#ifndef DOOM_LOADING_RGB565_H",
        "#define DOOM_LOADING_RGB565_H",
        "",
        "#include <stdint.h>",
        "",
        "#define DOOM_LOADING_WIDTH 320U",
        "#define DOOM_LOADING_HEIGHT 200U",
        f"static const uint16_t {args.symbol}_palette[256] = {{",
    ]
    for start in range(0, len(palette), 12):
        chunk = ", ".join(f"0x{value:04X}" for value in palette[start:start + 12])
        lines.append(f"    {chunk},")
    lines.extend([
        "};",
        "",
        f"static const uint8_t {args.symbol}_pixels[DOOM_LOADING_WIDTH * DOOM_LOADING_HEIGHT] = {{",
    ])
    for start in range(0, len(pixels), 24):
        chunk = ", ".join(f"0x{value:02X}" for value in pixels[start:start + 24])
        lines.append(f"    {chunk},")
    lines.extend(["};", "", "#endif", ""])
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text("\n".join(lines), encoding="ascii")


if __name__ == "__main__":
    main()
