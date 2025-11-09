import pandas as pd
import pickle
import json
from sklearn.tree import DecisionTreeClassifier, export_text
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report

df = pd.read_csv("parent_survey.csv")
X = df.drop("Label", axis=1)
y = df["Label"]

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

model = DecisionTreeClassifier(max_depth=3, random_state=42)
model.fit(X_train, y_train)

y_pred = model.predict(X_test)
accuracy = accuracy_score(y_test, y_pred)

print("Model Accuracy:", accuracy)
print("\nClassification Report:")
print(classification_report(y_test, y_pred))
print("\nDecision Tree Rules:")
print(export_text(model, feature_names=list(X.columns)))

with open("survey_dt.pkl", "wb") as f:
    pickle.dump(model, f)

feature_importance = {name: importance for name, importance in zip(X.columns, model.feature_importances_)}
feature_importance = dict(sorted(feature_importance.items(), key=lambda x: x[1], reverse=True))

with open("survey_dt_importance.json", "w") as f:
    json.dump(feature_importance, f, indent=2)

print("\nFeature Importances:")
print(json.dumps(feature_importance, indent=2))
print("\nModel saved as survey_dt.pkl")
print("Feature importances saved as survey_dt_importance.json")
