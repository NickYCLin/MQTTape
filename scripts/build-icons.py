from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
BUILD = ROOT / "build"
BUILD.mkdir(exist_ok=True)

size = 1024
scale = size / 64


def box(x1: float, y1: float, x2: float, y2: float) -> tuple[int, int, int, int]:
    return tuple(round(value * scale) for value in (x1, y1, x2, y2))


image = Image.new("RGBA", (size, size), "#10161e")
draw = ImageDraw.Draw(image)

draw.rounded_rectangle(box(0, 0, 64, 64), radius=16 * scale, fill="#10161e")
draw.rounded_rectangle(box(10, 16, 54, 48), radius=7 * scale, fill="#f0b35d")

for center_x in (24, 40):
    draw.ellipse(box(center_x - 6, 25, center_x + 6, 37), fill="#10161e")
    draw.ellipse(box(center_x - 2, 29, center_x + 2, 33), fill="#f0b35d")

line_width = round(3 * scale)
draw.line(box(24, 37, 40, 37), fill="#10161e", width=line_width)
draw.line(
    [(round(19 * scale), round(46 * scale)), (round(24 * scale), round(39 * scale))],
    fill="#10161e",
    width=line_width,
)
draw.line(
    [(round(24 * scale), round(39 * scale)), (round(40 * scale), round(39 * scale))],
    fill="#10161e",
    width=line_width,
)
draw.line(
    [(round(40 * scale), round(39 * scale)), (round(45 * scale), round(46 * scale))],
    fill="#10161e",
    width=line_width,
)

image.save(BUILD / "icon.png", optimize=True)
image.save(
    BUILD / "icon.ico",
    format="ICO",
    sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
)
