import pickle
import json

try:
    with open('survey_dt.pkl', 'rb') as f:
        model = pickle.load(f)
    print("Model loaded successfully")
    
    answers = [1, 1, 1, 1, 1, 1]
    pred = model.predict([answers])[0]
    print(f"Result: {pred}")
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
