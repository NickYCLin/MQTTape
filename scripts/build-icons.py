"""Render the MQTTape application icon.

The mark is a cassette drawn on a 64-unit grid: a light shell with a paper
label above and the reel window below, holding a part-wound and a full reel
joined by the exposed tape.

Two things keep it readable. The reels are deliberately different sizes and
joined by the tape band, because two equal circles side by side inside a
rounded box read as a face however they are drawn. And the large sizes are
tilted, which both removes any remaining upright-face reading and gives the
icon some life; below 48 px the tilt only costs legibility, so those frames
use the upright shell instead.

Everything is rendered at a multiple of the output size and downscaled,
because ImageDraw does not anti-alias its own primitives.
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
BUILD = ROOT / "build"
BUILD.mkdir(exist_ok=True)

GRID = 64
OUTPUT = 1024
SUPERSAMPLE = 3
CANVAS = OUTPUT * SUPERSAMPLE
UNIT = CANVAS / GRID

ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]
TILT_FROM = 48  # frames at least this wide use the tilted shell

GRADIENT_START = (160, 148, 255)  # --accent-hover
GRADIENT_END = (109, 94, 252)  # --accent, one step deeper
SHELL = (233, 230, 247, 255)
LABEL = (255, 255, 255, 255)
RULE = (198, 192, 224, 255)
WINDOW = (23, 16, 46, 255)  # --accent-on

PLATE_RADIUS = 14
TILT = -10

SHELL_BOX = (9.5, 18, 54.5, 46)
SHELL_RADIUS = 3.2
LABEL_BOX = (13, 21.5, 51, 30)
WINDOW_BOX = (13, 32, 51, 44)

SUPPLY_REEL = (23.5, 3.3)  # centre x, radius — part wound
TAKEUP_REEL = (40.7, 4.6)
HUB_SCALE = 0.32
TAPE_HEIGHT = 1.9

SHADOW_BLUR = 1.5
SHADOW_DROP = 1.3
SHADOW_ALPHA = 88


def unit(value: float) -> float:
    return value * UNIT


def line_width(value: float) -> int:
    return max(1, round(unit(value)))


def circle(draw: ImageDraw.ImageDraw, x: float, y: float, radius: float, **kwargs) -> None:
    draw.ellipse(
        (unit(x - radius), unit(y - radius), unit(x + radius), unit(y + radius)),
        **kwargs,
    )


def rounded(draw: ImageDraw.ImageDraw, box, radius: float, **kwargs) -> None:
    draw.rounded_rectangle(tuple(unit(value) for value in box), radius=unit(radius), **kwargs)


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


def plate() -> Image.Image:
    mask = Image.new("L", (CANVAS, CANVAS), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (0, 0, CANVAS - 1, CANVAS - 1),
        radius=unit(PLATE_RADIUS),
        fill=255,
    )

    surface = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    surface.paste(gradient_field(), (0, 0), mask)
    return surface


def spin(image: Image.Image, angle: float) -> Image.Image:
    if not angle:
        return image
    return image.rotate(
        angle,
        resample=Image.Resampling.BICUBIC,
        center=(CANVAS / 2, CANVAS / 2),
    )


def shell(labelled: bool) -> Image.Image:
    """The cassette itself. Without the label the shell closes up around a
    single window, which survives small frames better."""
    layer = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)

    rounded(draw, SHELL_BOX, SHELL_RADIUS, fill=SHELL)

    if labelled:
        rounded(draw, LABEL_BOX, 1.6, fill=LABEL)
        left, top, right, bottom = LABEL_BOX
        for position in (0.36, 0.64):
            y = top + (bottom - top) * position
            draw.line(
                [(unit(left + 2.4), unit(y)), (unit(right - 8), unit(y))],
                fill=RULE,
                width=line_width(0.85),
            )
        window = WINDOW_BOX
    else:
        window = (WINDOW_BOX[0], LABEL_BOX[1], WINDOW_BOX[2], WINDOW_BOX[3])

    rounded(draw, window, 2, fill=WINDOW)

    centre_y = (window[1] + window[3]) / 2
    (supply_x, supply_r), (takeup_x, takeup_r) = SUPPLY_REEL, TAKEUP_REEL
    if not labelled:
        supply_r += 0.9
        takeup_r += 1.1

    draw.rectangle(
        (
            unit(supply_x),
            unit(centre_y - TAPE_HEIGHT / 2),
            unit(takeup_x),
            unit(centre_y + TAPE_HEIGHT / 2),
        ),
        fill=SHELL,
    )
    for x, radius in ((supply_x, supply_r), (takeup_x, takeup_r)):
        circle(draw, x, centre_y, radius, fill=SHELL)
        circle(draw, x, centre_y, radius * HUB_SCALE, fill=WINDOW)

    return layer


def shadow(angle: float) -> Image.Image:
    layer = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    rounded(ImageDraw.Draw(layer), SHELL_BOX, SHELL_RADIUS, fill=(0, 0, 0, 255))
    layer = layer.filter(ImageFilter.GaussianBlur(unit(SHADOW_BLUR)))
    layer.putalpha(layer.getchannel("A").point(lambda value: value * SHADOW_ALPHA // 255))
    layer = spin(layer, angle)
    return layer.transform(
        layer.size,
        Image.AFFINE,
        (1, 0, 0, 0, 1, -unit(SHADOW_DROP)),
        resample=Image.Resampling.BICUBIC,
    )


def render(tilted: bool) -> Image.Image:
    angle = TILT if tilted else 0
    icon = Image.alpha_composite(plate(), shadow(angle))
    icon = Image.alpha_composite(icon, spin(shell(labelled=tilted), angle))
    return icon.resize((OUTPUT, OUTPUT), Image.Resampling.LANCZOS)


def main() -> None:
    tilted = render(tilted=True)
    upright = render(tilted=False)

    tilted.save(BUILD / "icon.png", optimize=True)

    # Pillow skips any requested size larger than the base image, so the
    # largest frame has to lead and the rest ride along as append_images.
    frames = [
        (tilted if size >= TILT_FROM else upright).resize(
            (size, size), Image.Resampling.LANCZOS
        )
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
