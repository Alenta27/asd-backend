import json
import sys
import numpy as np
from pathlib import Path

try:
    import joblib
    JOBLIB_AVAILABLE = True
except ImportError:
    JOBLIB_AVAILABLE = False

try:
    import pickle
    PICKLE_AVAILABLE = True
except ImportError:
    PICKLE_AVAILABLE = False

def predict_asd_risk_heuristic(features_dict):
    """
    Heuristic-based ASD risk prediction when model is unavailable.
    Uses behavioral ratings to estimate risk.
    """
    feature_names = [
        'communication',
        'eye_contact',
        'social_interaction',
        'emotional_response',
        'attention_span',
        'repetitive_actions',
        'sensory_sensitivity',
        'speech_clarity',
        'learning_adaptability'
    ]
    
    feature_values = []
    for feature_name in feature_names:
        value = features_dict.get(feature_name, 3)
        value = float(value) if value is not None else 3.0
        value = max(1, min(5, value))
        feature_values.append(value)
    
    avg_score = sum(feature_values) / len(feature_values)
    
    comm_eye_social = (
        feature_values[0] +
        feature_values[1] +
        feature_values[2]
    ) / 3.0
    
    repetitive = feature_values[5]
    sensory = feature_values[6]
    
    risk_score = 0
    
    if comm_eye_social < 2.5:
        risk_score += 3.0
    elif comm_eye_social < 3.0:
        risk_score += 1.5
    elif comm_eye_social > 4.0:
        risk_score -= 1.0
    
    if repetitive > 3.5:
        risk_score += 2.0
    
    if sensory > 3.5:
        risk_score += 1.5
    
    emotion_attention = (feature_values[3] + feature_values[4]) / 2.0
    if emotion_attention < 2.5:
        risk_score += 2.0
    
    speech = feature_values[7]
    if speech < 2.5:
        risk_score += 1.5
    
    low_prob = 0
    moderate_prob = 0
    high_prob = 0
    
    if risk_score < 1.5:
        low_prob = 75
        moderate_prob = 20
        high_prob = 5
        risk_level = 'Low'
    elif risk_score < 4.0:
        low_prob = 25
        moderate_prob = 60
        high_prob = 15
        risk_level = 'Moderate'
    else:
        low_prob = 10
        moderate_prob = 25
        high_prob = 65
        risk_level = 'High'
    
    return {
        "risk": risk_level,
        "probability": {
            "Low": low_prob,
            "Moderate": moderate_prob,
            "High": high_prob
        },
        "score": high_prob
    }

def predict_asd_risk(features_dict):
    """
    Predict ASD risk level based on behavioral parameters.
    
    Args:
        features_dict: Dictionary with keys like 'communication', 'eye_contact', etc.
                      Values should be 1-5 scale ratings.
    
    Returns:
        Dictionary with risk level and probabilities.
    """
    try:
        backend_dir = Path(__file__).parent
        model_path = backend_dir / 'asd_model.pkl'
        scaler_path = backend_dir / 'scaler.pkl'
        
        if not model_path.exists():
            return predict_asd_risk_heuristic(features_dict)
        
        model = None
        scaler = None
        
        if JOBLIB_AVAILABLE:
            try:
                model = joblib.load(model_path)
                scaler = joblib.load(scaler_path) if scaler_path.exists() else None
            except Exception as e:
                return predict_asd_risk_heuristic(features_dict)
        elif PICKLE_AVAILABLE:
            try:
                with open(model_path, 'rb') as f:
                    model = pickle.load(f)
                if scaler_path.exists():
                    with open(scaler_path, 'rb') as f:
                        scaler = pickle.load(f)
            except Exception as e:
                return predict_asd_risk_heuristic(features_dict)
        else:
            return predict_asd_risk_heuristic(features_dict)
        
        feature_names = [
            'communication',
            'eye_contact',
            'social_interaction',
            'emotional_response',
            'attention_span',
            'repetitive_actions',
            'sensory_sensitivity',
            'speech_clarity',
            'learning_adaptability'
        ]
        
        feature_values = []
        for feature_name in feature_names:
            value = features_dict.get(feature_name, 3)
            value = float(value) if value is not None else 3.0
            value = max(1, min(5, value))
            feature_values.append(value)
        
        X = np.array([feature_values])
        
        try:
            if scaler:
                X_scaled = scaler.transform(X)
            else:
                X_scaled = X
        except ValueError as e:
            # Feature dimension mismatch - model was trained on different data
            # Fall back to heuristic
            return predict_asd_risk_heuristic(features_dict)
        
        if hasattr(model, 'predict_proba'):
            probabilities = model.predict_proba(X_scaled)[0]
            classes = model.classes_
            
            prob_dict = {}
            for i, cls in enumerate(classes):
                cls_str = str(cls).lower().strip()
                if 'high' in cls_str:
                    prob_dict['High'] = float(probabilities[i]) * 100
                elif 'medium' in cls_str or 'moderate' in cls_str:
                    prob_dict['Moderate'] = float(probabilities[i]) * 100
                elif 'low' in cls_str:
                    prob_dict['Low'] = float(probabilities[i]) * 100
                else:
                    prob_dict[cls] = float(probabilities[i]) * 100
            
            prediction = model.predict(X_scaled)[0]
            pred_str = str(prediction).lower().strip()
            
            if 'high' in pred_str:
                risk_level = 'High'
            elif 'medium' in pred_str or 'moderate' in pred_str:
                risk_level = 'Moderate'
            elif 'low' in pred_str:
                risk_level = 'Low'
            else:
                risk_level = str(prediction)
            
            return {
                "risk": risk_level,
                "probability": prob_dict,
                "score": max(prob_dict.values()) if prob_dict else 0
            }
        else:
            prediction = model.predict(X_scaled)[0]
            return {
                "risk": str(prediction),
                "probability": {},
                "score": 0
            }
            
    except Exception as e:
        return {
            "error": str(e),
            "risk": "Unknown",
            "probability": {}
        }

def main():
    """Main entry point for the script."""
    if len(sys.argv) < 2:
        print(json.dumps({
            "error": "No input provided. Expected JSON string with features."
        }))
        return 1
    
    try:
        input_data = json.loads(sys.argv[1])
        result = predict_asd_risk(input_data)
        print(json.dumps(result))
        return 0
    except json.JSONDecodeError as e:
        print(json.dumps({
            "error": f"Invalid JSON input: {str(e)}",
            "risk": "Unknown",
            "probability": {}
        }))
        return 1
    except Exception as e:
        print(json.dumps({
            "error": f"Unexpected error: {str(e)}",
            "risk": "Unknown",
            "probability": {}
        }))
        return 1

if __name__ == "__main__":
    sys.exit(main())
