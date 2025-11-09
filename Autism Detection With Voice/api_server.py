import torch
import torchaudio
import io
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS
from transformers import AutoConfig, Wav2Vec2Processor

# --- Imports from your existing files ---
import config as conf
from model import Wav2Vec2ForSpeechClassification as Model

# --- 1. Initialize Flask App ---
app = Flask(__name__)
CORS(app)  # Enable cross-origin requests

# --- 2. Load Model and Processor (do this only once) ---
try:
    # This path should point to your trained model checkpoint folder
    exp_name = './asd_model' # Make sure this is the correct path to your model
    print(f"Loading model from: {exp_name}")
    
    config = AutoConfig.from_pretrained(exp_name)
    model = Model.from_pretrained(exp_name, config=config).to(conf.device)
    processor = Wav2Vec2Processor.from_pretrained(conf.model_name) # Uses 'facebook/wav2vec2-base-960h' from conf.py
    
    model.eval() # Set model to evaluation mode
    print("Model loaded successfully!")

except Exception as e:
    print(f"Error loading model: {e}")
    model = None # Set model to None if loading fails

# --- 3. Define the Prediction Function (adapted from your utils.py) ---
def predict_voice_prob(waveform):
    if model is None:
        raise RuntimeError("Model is not loaded. Cannot perform prediction.")
        
    # Process the audio waveform
    features = processor(waveform, sampling_rate=conf.sampling_rate, return_tensors="pt", padding=True)
    input_values = features.input_values.to(conf.device)

    with torch.no_grad():
        logits = model(input_values).logits

    # Get probabilities
    scores = torch.nn.functional.softmax(logits, dim=1)
    
    # Assuming the model has 2 labels: 0 for Non-Autistic, 1 for Autistic
    # The label mapping might need adjustment based on your training
    autistic_confidence = scores[0][1].item() 
    prediction = "Autistic" if autistic_confidence > 0.5 else "Non-Autistic"
    
    return {
        "prediction": prediction,
        "confidence": autistic_confidence
    }

# --- 4. Create the API Endpoint ---
@app.route("/predict-voice", methods=["POST"])
def handle_prediction():
    if 'audio_file' not in request.files:
        return jsonify({"error": "No audio file provided"}), 400

    audio_file = request.files['audio_file']
    
    try:
        # Read bytes and load with torchaudio
        file_bytes = audio_file.read()
        waveform, sr = torchaudio.load(io.BytesIO(file_bytes))
        
        # Convert to mono if multi-channel
        if waveform.ndim > 1:
            waveform = waveform.mean(dim=0)
        else:
            waveform = waveform.squeeze(0)
        
        # Resample if needed
        if sr != conf.sampling_rate:
            resampler = torchaudio.transforms.Resample(sr, conf.sampling_rate)
            waveform = resampler(waveform.unsqueeze(0)).squeeze(0)
        
        # Convert to numpy for the processor
        waveform = waveform.numpy()
        
        # Get prediction
        result = predict_voice_prob(waveform)
        
        return jsonify(result)

    except Exception as e:
        print(f"An error occurred during prediction: {e}")
        return jsonify({"error": "Failed to process audio file."}), 500

# --- 5. Run the Server ---
if __name__ == "__main__":
    # Run on a different port than your React app, e.g., 5001
    app.run(host='0.0.0.0', port=5001, debug=True)