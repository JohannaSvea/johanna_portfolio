import argparse
from pathlib import Path

import cv2
import numpy as np

DEFAULT_IMAGE = Path("content/photos/about_me/DSC05528.JPG")
DEFAULT_DEPTH = Path("tools/depth_output.png")


def depth_blur(
    image: np.ndarray,
    depth: np.ndarray,
    focus: float | None = None,
    focus_range: float = 0.04,
    max_sigma: float = 25.0,
    levels: int = 8,
) -> np.ndarray:
    """Blur `image` based on each pixel's distance from the focus plane in `depth` (0-1, bright = far)."""
    h, w = depth.shape
    if focus is None:
        # Use the median depth of the central region as the focus plane (the subject).
        focus = float(np.median(depth[h * 2 // 5 : h * 3 // 5, w * 2 // 5 : w * 3 // 5]))

    # Circle of confusion: 0 inside the in-focus band, rising to 1 further away.
    coc = np.clip((np.abs(depth - focus) - focus_range) / 0.25, 0.0, 1.0)
    coc = cv2.GaussianBlur(coc, (0, 0), 3)

    img = image.astype(np.float32)
    pos = coc * (levels - 1)
    out = np.zeros_like(img)
    for i, value in enumerate(np.linspace(0.0, 1.0, levels)):
        # Linear interpolation weight of this blur level for every pixel.
        level_weight = np.clip(1.0 - np.abs(pos - i), 0.0, 1.0)[..., None]
        if not level_weight.any():
            continue
        if i == 0:
            out += img * level_weight
            continue
        sigma = value * max_sigma
        # Only let pixels that are at least this blurry contribute, so the sharp
        # subject doesn't bleed (halo) into the blurred background.
        mask = (coc >= value * 0.5).astype(np.float32)
        num = cv2.GaussianBlur(img * mask[..., None], (0, 0), sigma)
        den = cv2.GaussianBlur(mask, (0, 0), sigma)[..., None]
        blurred = np.where(den > 1e-3, num / np.maximum(den, 1e-3), cv2.GaussianBlur(img, (0, 0), sigma))
        out += blurred * level_weight
    return np.clip(out, 0, 255).astype(np.uint8)


def main() -> None:
    parser = argparse.ArgumentParser(description="Blur the background of a photo using a depth map.")
    parser.add_argument("image", nargs="?", type=Path, default=DEFAULT_IMAGE)
    parser.add_argument("depth", nargs="?", type=Path, default=DEFAULT_DEPTH)
    parser.add_argument("-o", "--output", type=Path, help="Output path (default: <image>_blur.jpg)")
    parser.add_argument("--focus", type=float, help="Focus depth 0-1 (default: median of image center)")
    parser.add_argument("--focus-range", type=float, default=0.04, help="Depth band kept sharp")
    parser.add_argument("--max-sigma", type=float, default=25.0, help="Strongest blur (Gaussian sigma)")
    args = parser.parse_args()

    image = cv2.imdecode(np.fromfile(args.image, np.uint8), cv2.IMREAD_COLOR)
    depth = cv2.imdecode(np.fromfile(args.depth, np.uint8), cv2.IMREAD_GRAYSCALE)
    if depth.shape != image.shape[:2]:
        depth = cv2.resize(depth, (image.shape[1], image.shape[0]), interpolation=cv2.INTER_LINEAR)

    result = depth_blur(image, depth.astype(np.float32) / 255.0, args.focus, args.focus_range, args.max_sigma)

    output = args.output or args.image.with_name(f"{args.image.stem}_blur.jpg")
    cv2.imencode(output.suffix, result, [cv2.IMWRITE_JPEG_QUALITY, 92])[1].tofile(output)
    print(f"Saved blurred image to {output.resolve()}")


if __name__ == "__main__":
    main()
