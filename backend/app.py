import os
from flask import Flask, request, jsonify
from dotenv import load_dotenv
import firebase_admin
from firebase_admin import credentials, firestore, auth
from flask_cors import CORS # Import CORS
import requests # For making HTTP requests to Gemini API
import json # For handling JSON payload

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


# --- Gemini API Configuration ---
GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"
# Retrieve the API key from environment variables
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')

if not GEMINI_API_KEY:
    print("Error: GEMINI_API_KEY environment variable not set.")
    print("Please ensure GEMINI_API_KEY is defined in your .env file.")
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

def call_gemini_api(prompt_text, response_schema=None):
    """
    Makes a call to the Gemini API using an explicit API key.
    Args:
        prompt_text (str): The text prompt for the LLM.
        response_schema (dict, optional): A JSON schema for structured responses.
    Returns:
        dict: The parsed JSON response from Gemini, or None on error.
    """
    chat_history = []
    chat_history.append({"role": "user", "parts": [{"text": prompt_text}]})

    payload = {"contents": chat_history}
    if response_schema:
        payload["generationConfig"] = {
            "responseMimeType": "application/json",
            "responseSchema": response_schema
        }

    # Construct the URL with the explicit API key
    api_url_with_key = f"{GEMINI_API_URL}?key={GEMINI_API_KEY}"

    try:
        response = requests.post(
            api_url_with_key,
            headers={'Content-Type': 'application/json'},
            data=json.dumps(payload)
        )
        response.raise_for_status() # Raise an exception for HTTP errors (4xx or 5xx)
        result = response.json()

        if result.get('candidates') and result['candidates'][0].get('content') and result['candidates'][0]['content'].get('parts'):
            text_response = result['candidates'][0]['content']['parts'][0].get('text') # Use .get for safety
            if response_schema:
                # Attempt to parse JSON. If it fails, return None or raise specific error
                try:
                    return json.loads(text_response)
                except json.JSONDecodeError:
                    print(f"Gemini API returned non-JSON for structured response: {text_response}")
                    return None
            return text_response
        else:
            print(f"Gemini API response missing expected structure: {result}")
            return None
    except requests.exceptions.RequestException as e:
        print(f"Error calling Gemini API: {e}")
        return None
    except json.JSONDecodeError as e:
        print(f"Error decoding Gemini API JSON response: {e}")
        print(f"Raw response text: {response.text}")
        return None


# --- API Endpoints (No changes needed in these endpoints themselves) ---

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
    user_allergen_ids = data.get('userAllergens', []) # List of allergen IDs from user profile

    if not text_to_analyze:
        return jsonify({"error": "No text provided for analysis"}), 400

    try:
        # Fetch all known allergens from Firestore to provide context to Gemini
        # This helps Gemini focus on the specific uncommon allergens in your database
        known_allergens_details = []
        for allergen_doc in db.collection('allergens').stream():
            allergen_data = allergen_doc.to_dict()
            if 'name' in allergen_data and 'id' in allergen_data:
                known_allergens_details.append({
                    "id": allergen_data['id'],
                    "name": allergen_data['name'],
                    "commonNames": allergen_data.get('commonNames', []),
                    "hiddenSources": allergen_data.get('hiddenSources', []),
                    "crossReactiveFoods": allergen_data.get('crossReactiveFoods', [])
                })
        
        # Construct a comprehensive prompt for Gemini
        gemini_prompt = f"""
        Analyze the following food item, recipe, or menu text for potential food allergy risks.
        The user has allergies to the following specific allergen IDs: {', '.join(user_allergen_ids)}.
        Here is a list of known uncommon allergens from our database, including their common names, hidden sources, and cross-reactive foods:
        {json.dumps(known_allergens_details, indent=2)}

        Text to analyze: "{text_to_analyze}"

        Your task is to:
        1. Identify any specific allergens present in the text that match the user's known allergies or are highly likely to be present (e.g., from brand names or common knowledge). For each identified allergen, state if it's a direct match or a high probability.
        2. Identify any potential hidden sources or cross-reactive foods from the text that relate to the user's allergies or the known uncommon allergens.
        3. Provide a concise, overall risk assessment summary.
        4. Suggest any clarifying questions if the text is ambiguous.

        Provide the output in a structured JSON format with the following keys:
        - "detected_allergens": An array of objects. Each object should have "allergenId" (string), "name" (string), "type" (string, e.g., "Direct Match", "High Probability", "Cross-Reactivity"), and "reason" (string, explaining why it was detected).
        - "overall_risk_summary": A narrative string summarizing the risks.
        - "clarifying_questions": An array of strings with questions if needed.
        """

        # Define the expected JSON schema for Gemini's structured response
        response_schema = {
            "type": "OBJECT",
            "properties": {
                "detected_allergens": {
                    "type": "ARRAY",
                    "items": {
                        "type": "OBJECT",
                        "properties": {
                            "allergenId": {"type": "STRING"},
                            "name": {"type": "STRING"},
                            "type": {"type": "STRING"},
                            "reason": {"type": "STRING"}
                        },
                        "required": ["allergenId", "name", "type", "reason"]
                    }
                },
                "overall_risk_summary": {"type": "STRING"},
                "clarifying_questions": {
                    "type": "ARRAY",
                    "items": {"type": "STRING"}
                }
            },
            "required": ["detected_allergens", "overall_risk_summary", "clarifying_questions"]
        }

        gemini_analysis_result = call_gemini_api(gemini_prompt, response_schema=response_schema)

        if gemini_analysis_result:
            return jsonify({
                "analysis_result": gemini_analysis_result
            }), 200
        else:
            return jsonify({"error": "Gemini analysis failed or returned unexpected format."}), 500

    except Exception as e:
        print(f"Error in NLP analysis: {e}") # Print full error for debugging
        return jsonify({"error": f"NLP analysis failed: {str(e)}"}), 500

# --- Predictive Analytics (Enhanced with Gemini) ---
@app.route('/api/predictive-analytics', methods=['GET'])
def PredictiveAnalytics():
    id_token = request.headers.get('Authorization')
    if not id_token:
        return jsonify({"error": "Authorization token required"}), 401
    
    uid = verify_firebase_token(id_token.split('Bearer ')[1])
    if not uid:
        return jsonify({"error": "Invalid or expired token"}), 401

    try:
        # Fetch user's symptom and exposure logs from Firestore
        logs_collection_ref = db.collection('users').document(uid).collection('logs')
        user_logs = [doc.to_dict() for doc in logs_collection_ref.stream()]

        if not user_logs:
            return jsonify({
                "patterns": [],
                "suggestions": [],
                "gemini_insights": "No sufficient log data available yet to generate predictive insights. Please log more entries!"
            }), 200

        # Prepare log data for Gemini
        log_data_for_gemini = []
        for log in user_logs:
            # Convert Firestore Timestamp to readable string if present
            timestamp_str = log.get('timestamp').isoformat() if hasattr(log.get('timestamp'), 'isoformat') else str(log.get('timestamp'))
            log_data_for_gemini.append(
                f"Date: {timestamp_str}, Food: {log.get('foodIntake', 'N/A')}, "
                f"Symptoms: {', '.join(log.get('symptomsExperienced', []))}, "
                f"Severity: {log.get('severity', 'N/A')}, "
                f"Source: {log.get('potentialExposureSource', 'N/A')}"
            )
        
        # Construct prompt for Gemini
        gemini_prompt = f"""
        Analyze the following food allergy symptom and exposure logs for a user.
        Identify any recurring patterns, potential triggers, or correlations between food intake, symptoms, severity, and exposure sources.
        Based on these patterns, provide actionable suggestions for the user.

        Here are the user's logs:
        {json.dumps(log_data_for_gemini, indent=2)}

        Provide your analysis in a structured JSON format with two keys: "patterns" (a list of strings describing insights) and "suggestions" (a list of actionable advice strings).
        """

        # Define the expected JSON schema for Gemini's response
        response_schema = {
            "type": "OBJECT",
            "properties": {
                "patterns": {
                    "type": "ARRAY",
                    "items": {"type": "STRING"}
                },
                "suggestions": {
                    "type": "ARRAY",
                    "items": {"type": "STRING"}
                }
            },
            "required": ["patterns", "suggestions"]
        }

        gemini_insights = call_gemini_api(gemini_prompt, response_schema=response_schema)

        if gemini_insights:
            return jsonify({
                "patterns": gemini_insights.get('patterns', []),
                "suggestions": gemini_insights.get('suggestions', []),
                "gemini_insights": "Analysis completed successfully."
            }), 200
        else:
            return jsonify({
                "patterns": [],
                "suggestions": [],
                "gemini_insights": "Failed to generate insights from logs. Please try again later."
            }), 500

    except Exception as e:
        return jsonify({"error": f"Predictive analytics failed: {str(e)}"}), 500

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

# --- Possible Allergen Prediction (with Gemini) ---
@app.route('/api/predict-allergen', methods=['GET'])
def PredictAllergen():
    id_token = request.headers.get('Authorization')
    if not id_token:
        return jsonify({"error": "Authorization token required"}), 401
    
    uid = verify_firebase_token(id_token.split('Bearer ')[1])
    if not uid:
        return jsonify({"error": "Invalid or expired token"}), 401

    try:
        # Fetch all user logs (both food intake and symptoms)
        logs_collection_ref = db.collection('users').document(uid).collection('logs')
        user_logs = [doc.to_dict() for doc in logs_collection_ref.stream()]

        if not user_logs:
            return jsonify({
                "predicted_allergens": [],
                "gemini_message": "No log data available yet to predict possible allergens. Please log more entries!"
            }), 200

        # Sort logs by timestamp to provide chronological context to Gemini
        user_logs.sort(key=lambda x: x.get('timestamp', firestore.SERVER_TIMESTAMP))

        # Prepare log data for Gemini in a readable format
        log_data_for_gemini = []
        for log in user_logs:
            timestamp_str = log.get('timestamp').isoformat() if hasattr(log.get('timestamp'), 'isoformat') else str(log.get('timestamp'))
            
            if log.get('type') == 'food_intake':
                log_data_for_gemini.append(
                    f"Food Intake on {log.get('foodIntakeDate')} at {log.get('foodIntakeTime')}: {log.get('foodIntakeText', 'N/A')}"
                )
            elif log.get('type') == 'symptom':
                symptoms = log.get('symptomsExperienced', [])
                if symptoms and symptoms[0] == 'Nil':
                    log_data_for_gemini.append(
                        f"Symptoms on {log.get('symptomDate')} at {log.get('symptomTime')}: No symptoms reported (Nil)."
                    )
                else:
                    log_data_for_gemini.append(
                        f"Symptoms on {log.get('symptomDate')} at {log.get('symptomTime')}: "
                        f"Symptoms: {', '.join(symptoms)}, "
                        f"Severity: {log.get('severity', 'N/A')}, "
                        f"Source: {log.get('potentialExposureSource', 'N/A')}"
                    )
        
        # Construct prompt for Gemini
        gemini_prompt = f"""
        You are an AI assistant specialized in analyzing dietary logs and predicting possible food allergens.
        Analyze the following chronological log entries, which include food intake and symptom occurrences.
        Based on the patterns you observe (e.g., specific foods consumed before symptoms, consistency of symptoms),
        identify the most likely uncommon food allergens that might be causing the reactions.
        Consider cross-reactivity and hidden sources if implied by the data.

        Focus on providing a list of *possible* allergens, not definitive diagnoses.
        For each predicted allergen, provide a brief, clear reasoning based on the provided logs.
        If no clear patterns or allergens can be predicted, state that.

        User's chronological logs:
        {json.dumps(log_data_for_gemini, indent=2)}

        Provide your analysis in a structured JSON format. The response should be an array of objects.
        Each object must have two properties: "allergen" (string, the name of the possible allergen)
        and "reasoning" (string, a brief explanation based on the logs).
        If no allergens can be predicted, return an empty array for "predicted_allergens" and a message.
        """

        # Define the expected JSON schema for Gemini's structured response
        response_schema = {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "allergen": {"type": "STRING"},
                    "reasoning": {"type": "STRING"}
                },
                "required": ["allergen", "reasoning"]
            }
        }

        gemini_prediction_result = call_gemini_api(gemini_prompt, response_schema=response_schema)

        if gemini_prediction_result is not None:
            if isinstance(gemini_prediction_result, list): # Expected structured response
                if gemini_prediction_result:
                    return jsonify({
                        "predicted_allergens": gemini_prediction_result,
                        "gemini_message": "Analysis complete. Here are possible allergens based on your logs."
                    }), 200
                else:
                    return jsonify({
                        "predicted_allergens": [],
                        "gemini_message": "No clear patterns or possible allergens could be predicted from your current logs. Please log more data for better insights."
                    }), 200
            else: # Fallback if Gemini returns unexpected format but not an error
                return jsonify({
                    "predicted_allergens": [],
                    "gemini_message": "Gemini returned an unexpected format for allergen prediction. Please try again."
                }), 500
        else:
            return jsonify({
                "predicted_allergens": [],
                "gemini_message": "Failed to get allergen predictions from Gemini. Please check backend logs."
            }), 500

    except Exception as e:
        print(f"Error in predict_allergen endpoint: {e}")
        return jsonify({"error": f"Failed to predict allergens: {str(e)}"}), 500


if __name__ == '__main__':
    # For development, run on all interfaces and a specific port
    app.run(host='0.0.0.0', port=5000, debug=True)
