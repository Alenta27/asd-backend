import sys
import json
import pickle
import numpy as np
from tensorflow import keras

def predict_progress(child_data):
    model = keras.models.load_model('bpnn_progress_model.h5')
    
    with open('bpnn_scaler_x.pkl', 'rb') as f:
        scaler_x = pickle.load(f)
    
    with open('bpnn_scaler_y.pkl', 'rb') as f:
        scaler_y = pickle.load(f)
    
    input_features = np.array([
        child_data['week'],
        child_data['communication'],
        child_data['social_skills'],
        child_data['behavior_control'],
        child_data['attention_span'],
        child_data['sensory_response']
    ]).reshape(1, -1)
    
    input_scaled = scaler_x.transform(input_features)
    prediction_scaled = model.predict(input_scaled, verbose=0)[0][0]
    prediction = scaler_y.inverse_transform([[prediction_scaled]])[0][0]
    
    current_score = child_data.get('current_score', 0)
    predicted_next_week = prediction
    improvement = predicted_next_week - current_score
    improvement_percentage = (improvement / current_score * 100) if current_score > 0 else 0
    
    if improvement > 2:
        trend = 'improving'
    elif improvement < -2:
        trend = 'declining'
    else:
        trend = 'stable'
    
    result = {
        'current_score': float(current_score),
        'predicted_score': float(round(predicted_next_week, 2)),
        'improvement': float(round(improvement, 2)),
        'improvement_percentage': float(round(improvement_percentage, 2)),
        'trend': trend
    }
    
    return result

if __name__ == '__main__':
    try:
        child_data_str = sys.argv[1]
        child_data = json.loads(child_data_str)
        result = predict_progress(child_data)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({'error': str(e)}))
        sys.exit(1)
