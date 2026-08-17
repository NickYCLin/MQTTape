"""Render the MQTTape application icon.

The mark is drawn on a 64-unit grid so it matches TapeIcon in the renderer:
a cassette shell holding a part-wound and a full reel, joined by the tape
between them, stroked in near-black over the brand accent gradient.

The reels are deliberately different sizes and joined by the tape band. Two
equal circles side by side inside a rounded box read as a face no matter how
they are drawn, and the asymmetry plus the connecting band is what stops it.

Everything is rendered at a multiple of the output size and downscaled,
because ImageDraw does not anti-alias its own primitives.
"""

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
BUILD = ROOT / "build"
BUILD.mkdir(exist_ok=True)

GRID = 64
OUTPUT = 1024
SUPERSAMPLE = 3
CANVAS = OUTPUT * SUPERSAMPLE
UNIT = CANVAS / GRID

ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]

GRADIENT_START = (160, 148, 255)  # --accent-hover
GRADIENT_END = (109, 94, 252)  # --accent, one step deeper
GLYPH = (23, 16, 46, 255)  # --accent-on

CORNER_RADIUS = 14

SHELL = (10, 17, 54, 47)
SHELL_RADIUS = 7
SHELL_STROKE = 4

REEL_Y = 32
SUPPLY_REEL = (21, 5)  # centre x, radius — part wound
TAKEUP_REEL = (41, 7.5)
REEL_STROKE = 3
HUB_RADIUS = 1.5

TAPE = (27, 32.5)  # the exposed span between the two reels
TAPE_STROKE = 2.8


def unit(value: float) -> float:
    return value * UNIT


def stroke(value: float) -> int:
    return max(1, round(unit(value)))


def gradient_field(samples: int = 256) -> Image.Image:
    """A 135° linear gradient, computed small and scaled up smoothly."""
    field = Image.new("RGB", (samples, samples))
    pixels = field.load()
    span = 2 * (samples - 1)

    for y in range(samples):
        for x in range(samples):
            ratio = (x + y) / span
            pixels[x, y] = tuple(
                round(start + (end - start) * ratio)
                for start, end in zip(GRADIENT_START, GRADIENT_END)
            )

    return field.resize((CANVAS, CANVAS), Image.Resampling.BICUBIC)


def rounded_square() -> Image.Image:
    mask = Image.new("L", (CANVAS, CANVAS), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (0, 0, CANVAS - 1, CANVAS - 1),
        radius=unit(CORNER_RADIUS),
        fill=255,
    )

    plate = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    plate.paste(gradient_field(), (0, 0), mask)
    return plate


def circle(draw: ImageDraw.ImageDraw, x: float, y: float, radius: float, **kwargs) -> None:
    draw.ellipse(
        (unit(x - radius), unit(y - radius), unit(x + radius), unit(y + radius)),
        **kwargs,
    )


def cassette(compact: bool) -> Image.Image:
    """The cassette mark. The compact variant thickens the strokes and drops
    the reel hubs, which turn to mush below 32 px."""
    layer = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)

    draw.rounded_rectangle(
        tuple(unit(value) for value in SHELL),
        radius=unit(SHELL_RADIUS),
        outline=GLYPH,
        width=stroke(SHELL_STROKE + (1 if compact else 0)),
    )

    for centre, radius in (SUPPLY_REEL, TAKEUP_REEL):
        circle(
            draw,
            centre,
            REEL_Y,
            radius,
            outline=GLYPH,
            width=stroke(REEL_STROKE + (0.8 if compact else 0)),
        )
        if not compact:
            circle(draw, centre, REEL_Y, HUB_RADIUS, fill=GLYPH)

    tape_stroke = TAPE_STROKE + (0.6 if compact else 0)
    draw.line(
        [(unit(TAPE[0]), unit(REEL_Y)), (unit(TAPE[1]), unit(REEL_Y))],
        fill=GLYPH,
        width=stroke(tape_stroke),
    )

    return layer


def render(compact: bool = False) -> Image.Image:
    icon = Image.alpha_composite(rounded_square(), cassette(compact))
    return icon.resize((OUTPUT, OUTPUT), Image.Resampling.LANCZOS)


def main() -> None:
    full = render()
    compact = render(compact=True)

    full.save(BUILD / "icon.png", optimize=True)

    # ICO frames below 32 px use the compact mark; the rest keep every detail.
    # Pillow skips any requested size larger than the base image, so the
    # largest frame has to lead and the rest ride along as append_images.
    frames = [
        (compact if size < 32 else full).resize((size, size), Image.Resampling.LANCZOS)
        for size in sorted(ICO_SIZES, reverse=True)
    ]
    frames[0].save(
        BUILD / "icon.ico",
        format="ICO",
        sizes=[(size, size) for size in ICO_SIZES],
        append_images=frames[1:],
    )


if __name__ == "__main__":
    main()
