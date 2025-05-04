import os
import yaml
import uuid
import datetime
import numpy as np
from PIL import Image
from flask import Flask, request, jsonify, render_template
from flask_jwt_extended import JWTManager, create_access_token, jwt_required
from tensorflow.keras.models import load_model
import google.generativeai as genai

# Load environment variables
with open("config.yaml", "r") as f:
    config = yaml.safe_load(f)


app = Flask(__name__)
app.config['SECRET_KEY'] = config.get("secret_key", "your_secret_key")
app.config['JWT_SECRET_KEY'] = config.get("jwt_secret_key", "jwt_secret_key")



jwt = JWTManager(app)

GEMINI_API_KEY = config.get("gemini_api_key")
# Farmer-specific system prompt
SYSTEM_PROMPT = """You are a helpful assistant for farmers. Your role is to provide accurate and easy-to-understand information related to crop care, disease prevention, weather tips, fertilizer use, irrigation, and best agricultural practices. If a user asks a non-farming related question, politely tell them that you are only trained to assist with agricultural queries."""


# Preload models and label classes
MODEL_PATHS = {
    'pepper': 'models/pepper_bell_disease_model.h5',
    'potato': 'models/potato_disease_model.h5',
    'tomato': 'models/tomato_disease_model.h5'
}

LABELS = {
    'pepper': ['Pepper__bell___Bacterial_spot', 'Pepper__bell___healthy'],
    'potato': ['Potato___Late_blight', 'Potato___healthy', 'Potato___Early_blight'],
    'tomato': [
        'Tomato__Target_Spot', 'Tomato__Tomato_mosaic_virus', 'Tomato__Tomato_YellowLeaf__Curl_Virus',
        'Tomato_Bacterial_spot', 'Tomato_Early_blight', 'Tomato_healthy', 'Tomato_Late_blight',
        'Tomato_Leaf_Mold', 'Tomato_Septoria_leaf_spot', 'Tomato_Spider_mites_Two_spotted_spider_mite'
    ]
}

MODELS = {plant: load_model(path) for plant, path in MODEL_PATHS.items()}

# In-memory user store (for demo; use a DB in production)
users = {
    "user@example.com": "password123"
}

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    if email in users and users[email] == password:
        token = create_access_token(identity=email, expires_delta=datetime.timedelta(days=1))
        return jsonify(access_token=token), 200
    return jsonify(msg="Invalid credentials"), 401

def predict_disease(image_path, plant_type):
    if plant_type not in MODELS:
        return None, None, f"Unsupported plant type: {plant_type}"

    image = Image.open(image_path).resize((224, 224))
    image_array = np.expand_dims(np.array(image) / 255.0, axis=0)

    model = MODELS[plant_type]
    labels = LABELS[plant_type]

    prediction = model.predict(image_array)
    predicted_label = labels[np.argmax(prediction)]
    confidence = float(np.max(prediction))

    return predicted_label, confidence, None

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/api/predict', methods=['POST'])
@jwt_required()
def predict():
    if 'image' not in request.files or 'plant_type' not in request.form:
        return jsonify(msg="Missing image or plant_type"), 400

    plant_type = request.form['plant_type'].lower()
    if plant_type not in MODEL_PATHS:
        return jsonify(msg=f"Invalid plant type '{plant_type}'. Choose from: {list(MODEL_PATHS.keys())}"), 400

    image = request.files['image']
    filename = f"{uuid.uuid4().hex}_{image.filename}"
    local_path = os.path.join("uploads", filename)
    os.makedirs("uploads", exist_ok=True)
    image.save(local_path)

    disease, confidence, error = predict_disease(local_path, plant_type)
    if error:
        return jsonify(msg=error), 400

    return jsonify(plant=plant_type, disease=disease, confidence=confidence)


@app.route('/api/chatbot', methods=['POST'])
@jwt_required()
def chatbot():
    data = request.get_json()
    userPrompt = data.get("message", "")
    if not userPrompt:
        return jsonify(msg="Message is required"), 400

    try:
        gemini = genai.GenerativeModel(
            model_name="models/gemini-1.5-flash",  # Updated model name
            system_instruction=SYSTEM_PROMPT  # Using the correct constant name in uppercase
        )
        response = gemini.generate_content(userPrompt)

        if response and hasattr(response, 'text'):
            return jsonify(reply=response.text)
        else:
            return jsonify(reply="I couldn't generate a response. Please try again with a different question."), 500

    except Exception as e:
        print(f"Gemini API error: {str(e)}")  # Log the error for debugging
        return jsonify(reply="Sorry, I'm having trouble connecting to the knowledge base. Please try again later."), 500


if __name__ == '__main__':
    app.run(debug=True)
