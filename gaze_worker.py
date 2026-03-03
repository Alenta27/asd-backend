import sys
import json
from pathlib import Path
import os

try:
    import cv2
except ImportError:
    print(json.dumps({'error': 'OpenCV not installed. Run: pip install opencv-python'}))
    sys.exit(1)

try:
    import numpy as np
except ImportError:
    print(json.dumps({'error': 'NumPy not installed. Run: pip install numpy'}))
    sys.exit(1)

try:
    import mediapipe as mp
except ImportError:
    print(json.dumps({'error': 'MediaPipe not installed. Run: pip install mediapipe'}))
    sys.exit(1)

class GazeAnalyzer:
    def __init__(self):
        self.mp_face_mesh = mp.solutions.face_mesh
        self.mp_drawing = mp.solutions.drawing_utils
        self.face_mesh = self.mp_face_mesh.FaceMesh(
            static_image_mode=True,
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5
        )
        
        self.face_3d = np.array([
            [0.0, 0.0, 0.0],
            [0.0, -330.0, -65.0],
            [-225.0, 170.0, -135.0],
            [225.0, 170.0, -135.0],
            [-150.0, -150.0, -125.0],
            [150.0, -150.0, -125.0]
        ], dtype=np.float32)
        
        self.face_2d = np.array([
            [0.0, 0.0],
            [0.0, -330.0],
            [-225.0, 170.0],
            [225.0, 170.0],
            [-150.0, -150.0],
            [150.0, -150.0]
        ], dtype=np.float32)

    def estimate_gaze(self, image_path):
        try:
            image = cv2.imread(image_path)
            if image is None:
                return {'error': f'Could not read image file: {image_path} (Invalid image format or corrupted file)'}
            
            h, w, c = image.shape
            rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            
            results = self.face_mesh.process(rgb_image)
            
            if not results.multi_face_landmarks:
                return {
                    'error': 'No face detected in image',
                    'gaze_direction': 'unknown',
                    'attention_score': 0.0,
                    'head_pitch': 0.0,
                    'head_yaw': 0.0
                }
            
            face_landmarks = results.multi_face_landmarks[0]
            landmarks = face_landmarks.landmark
            
            face_2d_detected = []
            face_3d_detected = []
            
            landmark_points = [33, 263, 1, 61, 291, 199]
            
            for idx, point in enumerate(landmark_points):
                x = landmarks[point].x * w
                y = landmarks[point].y * h
                
                face_2d_detected.append([x, y])
                face_3d_detected.append(self.face_3d[idx])
            
            face_2d_detected = np.array(face_2d_detected, dtype=np.float32)
            face_3d_detected = np.array(face_3d_detected, dtype=np.float32)
            
            focal_length = 1 * w
            cam_matrix = np.array([
                [focal_length, 0, h / 2],
                [0, focal_length, w / 2],
                [0, 0, 1]
            ], dtype=np.float32)
            
            dist_coeffs = np.zeros((4, 1), dtype=np.float32)
            
            success, rotation_vec, translation_vec = cv2.solvePnP(
                face_3d_detected, face_2d_detected, cam_matrix, dist_coeffs
            )
            
            rotation_mat, _ = cv2.Rodrigues(rotation_vec)
            
            angles = self.rotation_matrix_to_euler_angles(rotation_mat)
            pitch = angles[0]
            yaw = angles[1]
            
            left_eye = np.array([landmarks[33].x, landmarks[33].y, landmarks[33].z])
            right_eye = np.array([landmarks[263].x, landmarks[263].y, landmarks[263].z])
            eye_center = (left_eye + right_eye) / 2
            
            gaze_direction = self.classify_gaze_direction(pitch, yaw, eye_center, landmarks)
            attention_score = self.calculate_attention_score(pitch, yaw, eye_center, landmarks)
            
            return {
                'gaze_direction': gaze_direction,
                'attention_score': min(1.0, max(0.0, attention_score)),
                'head_pitch': float(pitch),
                'head_yaw': float(yaw)
            }
        
        except Exception as e:
            return {
                'error': str(e),
                'gaze_direction': 'unknown',
                'attention_score': 0.0,
                'head_pitch': 0.0,
                'head_yaw': 0.0
            }

    def rotation_matrix_to_euler_angles(self, rotation_mat):
        sy = np.sqrt(rotation_mat[0, 0] ** 2 + rotation_mat[1, 0] ** 2)
        
        singular = sy < 1e-6
        
        if not singular:
            x = np.arctan2(rotation_mat[2, 1], rotation_mat[2, 2])
            y = np.arctan2(-rotation_mat[2, 0], sy)
            z = np.arctan2(rotation_mat[1, 0], rotation_mat[0, 0])
        else:
            x = np.arctan2(-rotation_mat[1, 2], rotation_mat[1, 1])
            y = np.arctan2(-rotation_mat[2, 0], sy)
            z = 0
        
        return np.array([np.degrees(x), np.degrees(y), np.degrees(z)])

    def classify_gaze_direction(self, pitch, yaw, eye_center, landmarks):
        iris_x = (landmarks[473].x + landmarks[474].x + landmarks[475].x + landmarks[476].x) / 4
        iris_y = (landmarks[473].y + landmarks[474].y + landmarks[475].y + landmarks[476].y) / 4
        
        eye_left = landmarks[263].x
        eye_right = landmarks[33].x
        eye_top = min(landmarks[27].y, landmarks[257].y)
        eye_bottom = max(landmarks[30].y, landmarks[260].y)
        
        iris_horizontal = (iris_x - eye_left) / (eye_right - eye_left)
        iris_vertical = (iris_y - eye_top) / (eye_bottom - eye_top)
        
        if abs(yaw) > 15:
            if yaw > 0:
                return 'right'
            else:
                return 'left'
        
        if pitch > 10:
            return 'down'
        elif pitch < -10:
            return 'up'
        
        if iris_horizontal < 0.35:
            return 'left'
        elif iris_horizontal > 0.65:
            return 'right'
        elif iris_vertical < 0.4:
            return 'up'
        elif iris_vertical > 0.6:
            return 'down'
        else:
            return 'straight'

    def calculate_attention_score(self, pitch, yaw, eye_center, landmarks):
        straight_penalty = (abs(pitch) + abs(yaw)) / 180.0
        straight_score = max(0, 1.0 - straight_penalty)
        
        iris_x = (landmarks[473].x + landmarks[474].x + landmarks[475].x + landmarks[476].x) / 4
        iris_y = (landmarks[473].y + landmarks[474].y + landmarks[475].y + landmarks[476].y) / 4
        
        eye_left = landmarks[263].x
        eye_right = landmarks[33].x
        eye_top = min(landmarks[27].y, landmarks[257].y)
        eye_bottom = max(landmarks[30].y, landmarks[260].y)
        
        iris_h = (iris_x - eye_left) / max(0.001, (eye_right - eye_left))
        iris_v = (iris_y - eye_top) / max(0.001, (eye_bottom - eye_top))
        
        iris_h = max(0, min(1, iris_h))
        iris_v = max(0, min(1, iris_v))
        
        h_center_distance = abs(iris_h - 0.5) * 2
        v_center_distance = abs(iris_v - 0.5) * 2
        
        center_score = max(0, 1.0 - (h_center_distance + v_center_distance) / 2)
        
        eye_open = landmarks[386].y - landmarks[374].y
        eye_aspect_ratio = max(0, min(1, eye_open * 100))
        
        attention_score = (straight_score * 0.4 + center_score * 0.35 + eye_aspect_ratio * 0.25)
        
        return min(1.0, max(0.0, attention_score))


def main():
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'Image path required'}))
        sys.exit(1)
    
    image_path = sys.argv[1]
    
    if not os.path.exists(image_path):
        print(json.dumps({'error': f'File not found at path: {image_path}'}))
        sys.exit(1)
    
    if not os.path.isfile(image_path):
        print(json.dumps({'error': f'Path is not a file: {image_path}'}))
        sys.exit(1)
    
    if not os.access(image_path, os.R_OK):
        print(json.dumps({'error': f'No read permission for file: {image_path}'}))
        sys.exit(1)
    
    try:
        analyzer = GazeAnalyzer()
        result = analyzer.estimate_gaze(image_path)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({'error': f'Gaze analysis error: {str(e)}'}))


if __name__ == '__main__':
    main()
