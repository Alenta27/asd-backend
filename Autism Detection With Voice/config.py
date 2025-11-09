import torch

# --- Model & Audio Settings ---
model_name = 'facebook/wav2vec2-base-960h'
sampling_rate = 16000
pooling_mode = 'mean'

# --- Device Configuration ---
# This will automatically use your GPU if you have one, otherwise it will use the CPU
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")