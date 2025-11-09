import pandas as pd
import numpy as np
from sklearn.preprocessing import MinMaxScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, r2_score
import json
import pickle

import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers

df = pd.read_csv('progress_training_data.csv')

X = df[['week', 'communication', 'social_skills', 'behavior_control', 'attention_span', 'sensory_response']].values
y = df['avg_progress_score'].values

scaler_x = MinMaxScaler()
scaler_y = MinMaxScaler()

X_scaled = scaler_x.fit_transform(X)
y_scaled = scaler_y.fit_transform(y.reshape(-1, 1)).flatten()

X_train, X_test, y_train, y_test = train_test_split(X_scaled, y_scaled, test_size=0.2, random_state=42)

model = keras.Sequential([
    layers.Dense(16, activation='relu', input_shape=(6,)),
    layers.Dropout(0.2),
    layers.Dense(32, activation='relu'),
    layers.Dropout(0.2),
    layers.Dense(16, activation='relu'),
    layers.Dense(1)
])

model.compile(
    optimizer='adam',
    loss='mse',
    metrics=['mae']
)

history = model.fit(
    X_train, y_train,
    epochs=100,
    batch_size=8,
    validation_split=0.2,
    verbose=0
)

y_pred = model.predict(X_test, verbose=0)
y_pred_actual = scaler_y.inverse_transform(y_pred).flatten()
y_test_actual = scaler_y.inverse_transform(y_test.reshape(-1, 1)).flatten()

mse = mean_squared_error(y_test_actual, y_pred_actual)
r2 = r2_score(y_test_actual, y_pred_actual)

print(f"Mean Squared Error: {mse:.4f}")
print(f"R² Score: {r2:.4f}")

model.save('bpnn_progress_model.h5')

model_info = {
    'type': 'BPNN',
    'input_features': ['week', 'communication', 'social_skills', 'behavior_control', 'attention_span', 'sensory_response'],
    'output': 'avg_progress_score',
    'mse': float(mse),
    'r2_score': float(r2),
    'epochs_trained': 100
}

with open('bpnn_model_info.json', 'w') as f:
    json.dump(model_info, f, indent=2)

with open('bpnn_scaler_x.pkl', 'wb') as f:
    pickle.dump(scaler_x, f)

with open('bpnn_scaler_y.pkl', 'wb') as f:
    pickle.dump(scaler_y, f)

print("Model trained and saved successfully!")
print(f"Model saved as: bpnn_progress_model.h5")
print(f"Scalers saved as: bpnn_scaler_x.pkl, bpnn_scaler_y.pkl")
print(f"Model info saved as: bpnn_model_info.json")
