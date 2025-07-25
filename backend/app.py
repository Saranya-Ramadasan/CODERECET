# backend/app.py
import os
from flask import Flask, request, jsonify
from dotenv import load_dotenv
import firebase_admin
from firebase_admin import credentials, firestore, auth
import spacy
from flask_cors import CORS # Import CORS

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)
CORS(app) # Enable CORS for all routes

# --- Firebase Initialization ---
# Get the path to the Firebase Admin SDK private key from environment variables
firebase_admin_sdk_path = os.getenv('FIREBASE_ADMIN_SDK_PATH')

if not firebase_admin_sdk_path or not os.path.exists(firebase_admin_sdk_path):
    print(f"Error: Firebase Admin SDK key file not found at {firebase_admin_sdk_path}")
    print("Please ensure FIREBASE_ADMIN_SDK_PATH is set in your .env and the file exists.")
    exit(1)

try:
    cred = credentials.Certificate(firebase_admin_sdk_path)
    firebase_admin.initialize_app(cred)
    db = firestore.client()
    print("Firebase Admin SDK initialized successfully.")
except Exception as e:
    print(f"Error initializing Firebase Admin SDK: {e}")
    exit(1)

# --- NLP Model Loading ---
try:
    nlp = spacy.load("en_core_web_sm")
    print("SpaCy NLP model loaded successfully.")
except Exception as e:
    print(f"Error loading SpaCy model: {e}. Please run 'python -m spacy download en_core_web_sm'")
    exit(1)

# --- Helper Functions ---
def verify_firebase_token(id_token):
    """Verifies Firebase ID token and returns user ID."""
    try:
        decoded_token = auth.verify_id_token(id_token)
        return decoded_token['uid']
    except Exception as e:
        print(f"Token verification failed: {e}")
        return None

# --- API Endpoints ---

@app.route('/')
def home():
    return "SafeBite Backend API is running!"

# --- User Profile Management ---
@app.route('/api/user/profile', methods=['GET', 'POST', 'PUT'])
def user_profile():
    id_token = request.headers.get('Authorization')
    if not id_token:
        return jsonify({"error": "Authorization token required"}), 401
    
    uid = verify_firebase_token(id_token.split('Bearer ')[1])
    if not uid:
        return jsonify({"error": "Invalid or expired token"}), 401

    user_profile_ref = db.collection('users').document(uid).collection('profiles').document('user_profile')

    if request.method == 'GET':
        try:
            profile_doc = user_profile_ref.get()
            if profile_doc.exists:
                return jsonify(profile_doc.to_dict()), 200
            else:
                return jsonify({"message": "Profile not found"}), 404
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    elif request.method == 'POST': # For initial profile creation
        data = request.json
        try:
            user_profile_ref.set(data)
            return jsonify({"message": "Profile created successfully", "profile": data}), 201
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    elif request.method == 'PUT': # For updating existing profile
        data = request.json
        try:
            user_profile_ref.update(data)
            return jsonify({"message": "Profile updated successfully", "profile": data}), 200
        except Exception as e:
            return jsonify({"error": str(e)}), 500

# --- Symptom & Exposure Logging ---
@app.route('/api/user/logs', methods=['GET', 'POST'])
def user_logs():
    id_token = request.headers.get('Authorization')
    if not id_token:
        return jsonify({"error": "Authorization token required"}), 401
    
    uid = verify_firebase_token(id_token.split('Bearer ')[1])
    if not uid:
        return jsonify({"error": "Invalid or expired token"}), 401

    logs_collection_ref = db.collection('users').document(uid).collection('logs')

    if request.method == 'GET':
        try:
            logs = [doc.to_dict() for doc in logs_collection_ref.stream()]
            return jsonify(logs), 200
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    elif request.method == 'POST':
        data = request.json
        # Add timestamp if not provided
        if 'timestamp' not in data:
            data['timestamp'] = firestore.SERVER_TIMESTAMP
        try:
            doc_ref = logs_collection_ref.add(data)
            return jsonify({"message": "Log added successfully", "id": doc_ref[1].id}), 201
        except Exception as e:
            return jsonify({"error": str(e)}), 500

# --- Allergen Database (Read-only for users) ---
@app.route('/api/allergens', methods=['GET'])
def get_allergens():
    # No token required for public allergen data
    try:
        allergens = [doc.to_dict() for doc in db.collection('allergens').stream()]
        return jsonify(allergens), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/allergens/<allergen_id>', methods=['GET'])
def get_allergen_detail(allergen_id):
    try:
        allergen_doc = db.collection('allergens').document(allergen_id).get()
        if allergen_doc.exists:
            return jsonify(allergen_doc.to_dict()), 200
        else:
            return jsonify({"message": "Allergen not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- NLP for Recipe/Menu Analysis ---
@app.route('/api/analyze-text', methods=['POST'])
def analyze_text():
    id_token = request.headers.get('Authorization')
    if not id_token:
        return jsonify({"error": "Authorization token required"}), 401
    
    uid = verify_firebase_token(id_token.split('Bearer ')[1])
    if not uid:
        return jsonify({"error": "Invalid or expired token"}), 401

    data = request.json
    text_to_analyze = data.get('text')
    user_allergens = data.get('userAllergens', []) # List of allergen names from user profile

    if not text_to_analyze:
        return jsonify({"error": "No text provided for analysis"}), 400

    try:
        doc = nlp(text_to_analyze.lower()) # Process text with SpaCy

        # --- Basic Allergen Detection (Conceptual) ---
        # In a real app, this would be much more sophisticated,
        # involving a pre-loaded dictionary of allergen names,
        # hidden sources, and derivatives, potentially with fuzzy matching.
        
        # Fetch all allergens from Firestore for matching
        all_allergens = {}
        for allergen_doc in db.collection('allergens').stream():
            allergen_data = allergen_doc.to_dict()
            # Store primary name and common names for matching
            all_allergens[allergen_data['name'].lower()] = allergen_data['id']
            if 'commonNames' in allergen_data:
                for name in allergen_data['commonNames']:
                    all_allergens[name.lower()] = allergen_data['id']
            if 'hiddenSources' in allergen_data:
                for source in allergen_data['hiddenSources']:
                    all_allergens[source.lower()] = allergen_data['id']


        detected_allergens = set()
        for token in doc:
            if token.text in all_allergens:
                detected_allergens.add(all_allergens[token.text])
            # Simple phrase matching (can be expanded)
            for phrase in all_allergens:
                if phrase in text_to_analyze.lower():
                    detected_allergens.add(all_allergens[phrase])

        # Cross-reference with user's specific allergies
        potential_issues = []
        for detected_id in detected_allergens:
            # Get detailed allergen info
            allergen_info = db.collection('allergens').document(detected_id).get().to_dict()
            if allergen_info:
                if detected_id in user_allergens:
                    potential_issues.append({
                        "allergenId": detected_id,
                        "name": allergen_info.get('name'),
                        "type": "Direct Match",
                        "reason": f"'{allergen_info.get('name')}' detected and is in your profile."
                    })
                # Check for cross-reactivity if applicable
                if 'crossReactiveFoods' in allergen_info:
                    for cross_food in allergen_info['crossReactiveFoods']:
                        # This is a very basic check. A real system would need to
                        # map cross_food names to detected ingredients.
                        if cross_food.lower() in text_to_analyze.lower():
                             potential_issues.append({
                                "allergenId": detected_id,
                                "name": allergen_info.get('name'),
                                "type": "Cross-Reactivity Warning",
                                "reason": f"Potential cross-reactivity with '{cross_food}' related to '{allergen_info.get('name')}'."
                            })

        return jsonify({
            "analysis_result": {
                "detected_ingredients": list(detected_allergens),
                "potential_allergy_issues": potential_issues
            }
        }), 200

    except Exception as e:
        return jsonify({"error": f"NLP analysis failed: {str(e)}"}), 500

# --- Predictive Analytics (Conceptual Endpoint) ---
@app.route('/api/predictive-analytics', methods=['GET'])
def predictive_analytics():
    id_token = request.headers.get('Authorization')
    if not id_token:
        return jsonify({"error": "Authorization token required"}), 401
    
    uid = verify_firebase_token(id_token.split('Bearer ')[1])
    if not uid:
        return jsonify({"error": "Invalid or expired token"}), 401

    # In a real application, this would:
    # 1. Fetch user's symptom and exposure logs from Firestore.
    # 2. Apply machine learning algorithms (e.g., clustering, classification, time-series analysis)
    #    to identify patterns (e.g., "Symptoms worse with allergen X + high pollen").
    # 3. Return insights.
    
    # Placeholder for demonstration
    mock_insights = {
        "patterns": [
            "You tend to react to oats when consumed with dairy.",
            "Your symptoms are worse on days with high pollen counts (requires external data integration).",
            "Increased severity observed when consuming 'pea protein' from processed foods."
        ],
        "suggestions": [
            "Consider avoiding oats with dairy for a week.",
            "Check local pollen forecasts.",
            "Carefully read labels for hidden pea protein in snacks."
        ]
    }
    return jsonify(mock_insights), 200

# --- Educational Resources ---
@app.route('/api/educational-resources', methods=['GET'])
def get_educational_resources():
    try:
        resources = [doc.to_dict() for doc in db.collection('educational_resources').stream()]
        return jsonify(resources), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- Recall and Contamination Alerts (Conceptual) ---
@app.route('/api/alerts', methods=['GET'])
def get_alerts():
    id_token = request.headers.get('Authorization')
    if not id_token:
        return jsonify({"error": "Authorization token required"}), 401
    
    uid = verify_firebase_token(id_token.split('Bearer ')[1])
    if not uid:
        return jsonify({"error": "Invalid or expired token"}), 401

    # In a real application, this would:
    # 1. Fetch real-time recall data from external APIs (e.g., FDA, local food safety agencies).
    # 2. Filter alerts based on user's registered allergens.
    # 3. Push notifications (via WebSockets or Firebase Cloud Messaging).

    mock_alerts = [
        {"id": "alert1", "type": "Recall", "title": "Recall: Brand X Oat Milk", "description": "Undeclared almond allergen found.", "relevantAllergens": ["almond"]},
        {"id": "alert2", "type": "Contamination", "title": "Warning: Restaurant Y Update", "description": "Reported cross-contamination risk for sesame.", "relevantAllergens": ["sesame"]}
    ]
    # Filter by user's allergens (requires fetching user profile first)
    # For now, just return all mock alerts
    return jsonify(mock_alerts), 200


if __name__ == '__main__':
    # For development, run on all interfaces and a specific port
    app.run(host='0.0.0.0', port=5000, debug=True)