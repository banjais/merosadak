#!/usr/bin/env python3
"""Generate PWA icons from public/icon.svg using Pillow."""
from pathlib import Path
from PIL import Image, ImageDraw

OUTPUT_DIR = Path(__file__).resolve().parents[1] / "public" / "assets" / "icons"
SVG_PATH = Path(__file__).resolve().parents[1] / "public" / "icon.svg"

SIZES = [192, 512]

# Colors from icon.svg
BG = "#003893"
FG = "#ffffff"


def rounded_rectangle(draw, xy, radius, fill):
    x1, y1, x2, y2 = xy
    draw.rounded_rectangle([x1, y1, x2, y2], radius=radius, fill=fill)


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    for size in SIZES:
        img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)

        # Background rounded rectangle
        rx = int(96 * size / 512)
        rounded_rectangle(draw, (0, 0, size - 1, size - 1), rx, BG)

        # White road/path shape
        # Original path: M128 320 L256 128 L384 320 L336 320 L256 192 L176 320 Z
        pts = [
            (int(128 * size / 512), int(320 * size / 512)),
            (int(256 * size / 512), int(128 * size / 512)),
            (int(384 * size / 512), int(320 * size / 512)),
            (int(336 * size / 512), int(320 * size / 512)),
            (int(256 * size / 512), int(192 * size / 512)),
            (int(176 * size / 512), int(320 * size / 512)),
        ]
        draw.polygon(pts, fill=FG)

        # White circle
        cx = int(256 * size / 512)
        cy = int(336 * size / 512)
        r = int(40 * size / 512)
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=FG)

        out_path = OUTPUT_DIR / f"icon-{size}.png"
        img.save(out_path, "PNG")
        print(f"Generated {out_path}")

    # Also generate apple-touch-icon (180x180)
    size = 180
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    rx = int(96 * size / 512)
    rounded_rectangle(draw, (0, 0, size - 1, size - 1), rx, BG)
    pts = [
        (int(128 * size / 512), int(320 * size / 512)),
        (int(256 * size / 512), int(128 * size / 512)),
        (int(384 * size / 512), int(320 * size / 512)),
        (int(336 * size / 512), int(320 * size / 512)),
        (int(256 * size / 512), int(192 * size / 512)),
        (int(176 * size / 512), int(320 * size / 512)),
    ]
    draw.polygon(pts, fill=FG)
    cx = int(256 * size / 512)
    cy = int(336 * size / 512)
    r = int(40 * size / 512)
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=FG)
    out_path = OUTPUT_DIR / "apple-touch-icon.png"
    img.save(out_path, "PNG")
    print(f"Generated {out_path}")


if __name__ == "__main__":
    main()
