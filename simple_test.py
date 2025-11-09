import json
import pickle

print("Starting test...", flush=True)

try:
    print("Opening model file...", flush=True)
    with open('survey_dt.pkl', 'rb') as f:
        model = pickle.load(f)
    print("Model loaded", flush=True)
    
    print("Making prediction...", flush=True)
    answers = [1, 1, 1, 1, 1, 1]
    pred = model.predict([answers])[0]
    proba = model.predict_proba([answers])[0]
    
    feature_names = ['PoorEyeContact', 'DelayedSpeech', 'DifficultyPeerInteraction', 
                     'RepetitiveMovements', 'Sensitivity', 'PrefersRoutine']
    feature_importance = dict(zip(feature_names, model.feature_importances_))
    sorted_features = sorted(feature_importance.items(), key=lambda x: x[1], reverse=True)
    top_features = [feature for feature, importance in sorted_features[:3] if importance > 0]
    
    result = {
        'classification_result': pred,
        'probability': float(max(proba)),
        'important_features': top_features
    }
    
    print(json.dumps(result), flush=True)
    
except Exception as e:
    print(json.dumps({'error': str(e)}), flush=True)
    import traceback
    traceback.print_exc()
