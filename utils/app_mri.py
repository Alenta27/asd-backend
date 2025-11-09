from flask import Flask, request, jsonify
from flask_cors import CORS # 1. Import CORS
import os
import joblib
import numpy as np
import werkzeug.utils

from nilearn import datasets
from nilearn.maskers import NiftiLabelsMasker
from nilearn.connectome import ConnectivityMeasure

app = Flask(__name__)
CORS(app) # 2. Initialize CORS for your app

# --- Load the saved model, scaler, and atlas ---
model = joblib.load('asd_model.pkl')
scaler = joblib.load('scaler.pkl')
atlas = datasets.fetch_atlas_harvard_oxford('cort-maxprob-thr25-2mm')

# --- Create the tools for feature extraction ---
masker = NiftiLabelsMasker(labels_img=atlas.maps, standardize=True, memory='nilearn_cache')
correlation_measure = ConnectivityMeasure(kind='correlation')

def process_new_scan(scan_path):
    try:
        time_series = masker.fit_transform(scan_path)
        correlation_matrix = correlation_measure.fit_transform([time_series])[0]
        upper_triangle_indices = np.triu_indices(correlation_matrix.shape[0], k=1)
        feature_vector = correlation_matrix[upper_triangle_indices]
        return feature_vector.reshape(1, -1)
    except Exception as e:
        print(f"Error during MRI processing: {e}")
        return None

@app.route('/predict_mri', methods=['POST'])
def predict():
    if 'mri_scan' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['mri_scan']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    filename = werkzeug.utils.secure_filename(file.filename)
    upload_folder = 'temp_uploads'
    os.makedirs(upload_folder, exist_ok=True)
    filepath = os.path.join(upload_folder, filename)
    file.save(filepath)

    features = process_new_scan(filepath)

    if features is not None:
        scaled_features = scaler.transform(features)
        prediction = model.predict(scaled_features)
        # Make sure the labels match what your React code expects (ASD/Control)
        result = "ASD" if prediction[0] == 1 else "Control" 
        
        os.remove(filepath)
        return jsonify({'prediction': result})
    else:
        os.remove(filepath)
        return jsonify({'error': 'Failed to process MRI scan'}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5002)