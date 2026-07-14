"""Build the lightweight, deterministic parchment loop used by the story HUD."""

from pathlib import Path
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public" / "assets" / "parchment-writing-source-v1.png"
OUTPUT = ROOT / "public" / "assets" / "parchment-writing-v1.gif"
SIZE = (640, 360)
FRAME_COUNT = 12
FRAME_DURATION_MS = 400


def candle_glow(frame: Image.Image, strength: int) -> Image.Image:
    glow = Image.new("RGBA", SIZE, (0, 0, 0, 0))
    draw = ImageDraw.Draw(glow)
    draw.ellipse((-42, -64, 182, 172), fill=(255, 143, 38, strength))
    glow = glow.filter(ImageFilter.GaussianBlur(22))
    return Image.alpha_composite(frame.convert("RGBA"), glow)


def draw_pixel_motion(frame: Image.Image, index: int) -> None:
    draw = ImageDraw.Draw(frame)
    # Candle flame pulses in deliberately chunky pixels.
    flame = [(57, 34), (59, 29), (61, 34), (60, 40), (57, 40)]
    wobble = (-1, 0, 1, 0)[index % 4]
    draw.polygon([(x + wobble, y) for x, y in flame], fill=(255, 238, 137, 255))
    draw.rectangle((58 + wobble, 34, 60 + wobble, 39), fill=(255, 131, 30, 255))

    # The nib writes one tiny, intentionally unreadable mark per cycle.
    progress = index % 6
    ink = (73, 38, 32, 255)
    draw.rectangle((451, 247, 454 + progress * 2, 249), fill=ink)
    if progress > 2:
        draw.rectangle((454 + progress * 2, 246, 456 + progress * 2, 248), fill=ink)

    # Sparse pixel glints keep the crystal, seal and quill alive without smooth motion.
    if index % 3 == 0:
        for x, y, color in [(40, 299, (238, 168, 255, 255)), (525, 205, (255, 220, 105, 255)), (578, 276, (221, 87, 126, 255))]:
            draw.rectangle((x, y, x + 2, y + 2), fill=color)
    if index % 4 == 2:
        draw.rectangle((508, 105, 510, 107), fill=(255, 246, 191, 255))


def build() -> None:
    source = Image.open(SOURCE).convert("RGB").resize(SIZE, Image.Resampling.NEAREST)
    # One shared palette prevents color shimmer and keeps the GIF compact.
    palette_source = source.quantize(colors=96, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    frames = []
    glow_strengths = (18, 25, 20, 31, 22, 16, 27, 20, 29, 18, 24, 16)
    for index in range(FRAME_COUNT):
        rgba = candle_glow(source, glow_strengths[index])
        if index % 4 == 1:
            rgba = ImageEnhance.Color(rgba).enhance(1.025)
        draw_pixel_motion(rgba, index)
        frame = rgba.convert("RGB").quantize(palette=palette_source, dither=Image.Dither.NONE)
        frames.append(frame)

    frames[0].save(
        OUTPUT,
        save_all=True,
        append_images=frames[1:],
        duration=FRAME_DURATION_MS,
        loop=0,
        disposal=1,
        optimize=True,
    )
    print(f"{OUTPUT} ({OUTPUT.stat().st_size} bytes, {FRAME_COUNT} frames)")


if __name__ == "__main__":
    build()
