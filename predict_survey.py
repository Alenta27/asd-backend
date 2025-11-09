import sys
import json
import pickle

def predict_survey(answers):
    with open('survey_dt.pkl', 'rb') as f:
        model = pickle.load(f)
    
    prediction = model.predict([answers])[0]
    probabilities = model.predict_proba([answers])[0]
    
    feature_names = ['PoorEyeContact', 'DelayedSpeech', 'DifficultyPeerInteraction', 
                     'RepetitiveMovements', 'Sensitivity', 'PrefersRoutine']
    feature_importance = dict(zip(feature_names, model.feature_importances_))
    
    sorted_features = sorted(feature_importance.items(), key=lambda x: x[1], reverse=True)
    top_features = [feature for feature, importance in sorted_features[:3] if importance > 0]
    
    result = {
        'classification_result': prediction,
        'probability': max(probabilities),
        'important_features': top_features
    }
    
    return result

if __name__ == '__main__':
    try:
        answers_str = sys.argv[1]
        answers = json.loads(answers_str)
        answers_list = [answers.get(f, 0) for f in ['PoorEyeContact', 'DelayedSpeech', 'DifficultyPeerInteraction', 
                                                      'RepetitiveMovements', 'Sensitivity', 'PrefersRoutine']]
        result = predict_survey(answers_list)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({'error': str(e)}))
        sys.exit(1)
