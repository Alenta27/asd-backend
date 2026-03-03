import base64
import json
import math
from typing import Dict, Tuple, Optional

import cv2
import numpy as np

try:
    import mediapipe as mp
except ImportError as e:
    raise RuntimeError("mediapipe must be installed: pip install mediapipe opencv-python") from e


# Indices for key eye landmarks (MediaPipe FaceMesh with refine_landmarks=True)
# Using canonical eye corner/inner/outer canthi and iris ring points.
# Left eye (from subject's perspective):
LEFT_EYE_OUTER = 33   # outer canthus
LEFT_EYE_INNER = 133  # inner canthus
LEFT_IRIS_POINTS = [468, 469, 470, 471, 472]  # iris landmarks (center + ring)

# Right eye:
RIGHT_EYE_INNER = 362  # inner canthus
RIGHT_EYE_OUTER = 263  # outer canthus
RIGHT_IRIS_POINTS = [473, 474, 475, 476, 477]


mp_face_mesh = mp.solutions.face_mesh


def _b64_to_bgr(base64_str: str) -> np.ndarray:
    """Decode a base64 image data URL or raw base64 to BGR image (OpenCV)."""
    # Handle data URL prefix if present
    if base64_str.startswith("data:"):
        base64_str = base64_str.split(",", 1)[1]
    img_bytes = base64.b64decode(base64_str)
    nparr = np.frombuffer(img_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Invalid image data")
    return img


def _normalized_to_pixel(landmark, image_shape: Tuple[int, int, int]) -> Tuple[int, int]:
    h, w = image_shape[:2]
    x_px = int(round(landmark.x * w))
    y_px = int(round(landmark.y * h))
    return x_px, y_px


def _eye_ratio(outer_px: Tuple[int, int], inner_px: Tuple[int, int], iris_px: Tuple[int, int]) -> float:
    """Compute normalized ratio of iris horizontal position between outer and inner canthus.

    Returns a value in [0,1] where 0 ~ outer canthus, 1 ~ inner canthus.
    """
    ox, oy = outer_px
    ix, iy = inner_px
    cx, cy = iris_px

    # Project iris center onto the canthi line to be robust to tilt.
    # Vector from outer to inner
    vx, vy = (ix - ox), (iy - oy)
    vlen2 = vx * vx + vy * vy
    if vlen2 <= 1e-6:
        return 0.5
    # Vector from outer to iris
    wx, wy = (cx - ox), (cy - oy)
    t = (vx * wx + vy * wy) / vlen2
    # Clamp to [0,1] to keep ratio stable when iris projects outside segment
    t = max(0.0, min(1.0, t))
    return float(t)


def _iris_center_px(landmarks, iris_indices, image_shape) -> Tuple[int, int]:
    # Average of iris points to stabilize the center
    xs, ys, n = 0.0, 0.0, 0
    for idx in iris_indices:
        lm = landmarks[idx]
        x, y = _normalized_to_pixel(lm, image_shape)
        xs += x
        ys += y
        n += 1
    if n == 0:
        raise ValueError("No iris landmarks available")
    return int(round(xs / n)), int(round(ys / n))


def _gaze_from_ratio(ratio: float, left_threshold: float = 0.4, right_threshold: float = 0.6) -> str:
    # Ratio is 0 at outer canthus, 1 at inner canthus.
    # When looking to the subject's left: left eye iris moves toward inner (ratio -> 1), right eye iris moves toward outer (ratio -> 0).
    # For a single-eye metric, use both eyes and average their centeredness; for direction, we choose based on combined deviation.
    # We'll decide direction later using both eyes, so this helper is for reference.
    if ratio < left_threshold:
        return "Right"  # iris near outer canthus -> user likely looking to their right
    elif ratio > right_threshold:
        return "Left"   # iris near inner canthus -> user likely looking to their left
    return "Center"


def analyze_gaze_from_base64(base64_image: str) -> Dict[str, object]:
    """Analyze gaze direction and attention score from a base64-encoded image.

    Returns JSON-serializable dict: { 'gaze_direction': 'Center|Left|Right', 'attention_score': float }
    """
    image_bgr = _b64_to_bgr(base64_image)
    image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)

    with mp_face_mesh.FaceMesh(static_image_mode=True,
                               max_num_faces=1,
                               refine_landmarks=True,  # critical for iris landmarks 468-477
                               min_detection_confidence=0.5) as face_mesh:
        results = face_mesh.process(image_rgb)

    if not results.multi_face_landmarks:
        return {"error": "No face detected"}

    face_landmarks = results.multi_face_landmarks[0].landmark

    # Compute per-eye ratios
    try:
        # Left eye
        left_outer_px = _normalized_to_pixel(face_landmarks[LEFT_EYE_OUTER], image_bgr.shape)
        left_inner_px = _normalized_to_pixel(face_landmarks[LEFT_EYE_INNER], image_bgr.shape)
        left_iris_center = _iris_center_px(face_landmarks, LEFT_IRIS_POINTS, image_bgr.shape)
        left_ratio = _eye_ratio(left_outer_px, left_inner_px, left_iris_center)

        # Right eye
        right_outer_px = _normalized_to_pixel(face_landmarks[RIGHT_EYE_OUTER], image_bgr.shape)
        right_inner_px = _normalized_to_pixel(face_landmarks[RIGHT_EYE_INNER], image_bgr.shape)
        right_iris_center = _iris_center_px(face_landmarks, RIGHT_IRIS_POINTS, image_bgr.shape)
        right_ratio = _eye_ratio(right_outer_px, right_inner_px, right_iris_center)
    except Exception:
        return {"error": "No face detected"}

    # Determine gaze direction using both eyes
    # For left eye: ratio<0.4 => looking Right; ratio>0.6 => looking Left
    # For right eye the mapping is mirrored relative to the face, but our ratio is always outer->inner (0->1),
    # so the same thresholds apply per-eye. We assess combined tendency.
    left_dir = _gaze_from_ratio(left_ratio)
    right_dir = _gaze_from_ratio(right_ratio)

    if left_dir == right_dir:
        gaze_direction = left_dir
    else:
        # If mixed, decide by magnitude of deviation from center (0.5)
        dl = abs(left_ratio - 0.5)
        dr = abs(right_ratio - 0.5)
        if max(dl, dr) < 0.1:
            gaze_direction = "Center"
        else:
            # pick side of the eye farther from center
            if dl >= dr:
                gaze_direction = left_dir
            else:
                gaze_direction = right_dir

    # Attention score: how centered both eyes are.
    # Compute per-eye centeredness: 1 at 0.5, drop linearly to 0 at 0.0 or 1.0.
    def centeredness(r: float) -> float:
        return max(0.0, 1.0 - (abs(r - 0.5) / 0.5))

    attention_score = float(max(0.0, min(1.0, (centeredness(left_ratio) + centeredness(right_ratio)) / 2.0)))

    return {
        "gaze_direction": gaze_direction,
        "attention_score": round(attention_score, 4)
    }


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Gaze analysis from base64 image using MediaPipe FaceMesh.")
    parser.add_argument("--base64", type=str, required=True, help="Base64 string or data URL of the image")
    args = parser.parse_args()
    result = analyze_gaze_from_base64(args.base64)
    print(json.dumps(result))
