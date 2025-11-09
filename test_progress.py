import json
import pickle
from tensorflow import keras

print("Starting test...", flush=True)

try:
    print("Loading model...", flush=True)
    model = keras.models.load_model('bpnn_progress_model.h5')
    print("Model loaded successfully", flush=True)
    
    print("Loading scalers...", flush=True)
    with open('bpnn_scaler_x.pkl', 'rb') as f:
        scaler_x = pickle.load(f)
    
    with open('bpnn_scaler_y.pkl', 'rb') as f:
        scaler_y = pickle.load(f)
    
    print("Scalers loaded successfully", flush=True)
    
    import numpy as np
    input_features = np.array([9, 47, 42, 37, 45, 39]).reshape(1, -1)
    print(f"Input features shape: {input_features.shape}", flush=True)
    
    print("Scaling input...", flush=True)
    input_scaled = scaler_x.transform(input_features)
    print(f"Scaled input shape: {input_scaled.shape}", flush=True)
    
    print("Making prediction...", flush=True)
    prediction_scaled = model.predict(input_scaled, verbose=0)[0][0]
    print(f"Scaled prediction: {prediction_scaled}", flush=True)
    
    prediction = scaler_y.inverse_transform([[prediction_scaled]])[0][0]
    print(f"Final prediction: {prediction}", flush=True)
    
    current_score = 41
    improvement = prediction - current_score
    print(f"Improvement: {improvement}", flush=True)
    
    if improvement > 2:
        trend = 'improving'
    elif improvement < -2:
        trend = 'declining'
    else:
        trend = 'stable'
    
    result = {
        'current_score': float(current_score),
        'predicted_score': float(round(prediction, 2)),
        'improvement': float(round(improvement, 2)),
        'trend': trend
    }
    
    print(json.dumps(result), flush=True)
    
except Exception as e:
    print(f"Error: {e}", flush=True)
    import traceback
    traceback.print_exc()
