// frontend/src/App.jsx

import React, { useState, useEffect } from 'react';
// Firebase SDK imports (functions)
import { getAuth, signInAnonymously, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, doc, setDoc, collection, addDoc, onSnapshot, query } from 'firebase/firestore';

// Firebase initialized instances (app, auth, db) imported from config
import { app, auth, db } from './firebase_config'; // Make sure firebase_config.js exports these

import './index.css'; // Tailwind CSS imports

// --- Global/App-wide Constants ---
// Replace 'safebite01' with your actual Firebase Project ID if different.
const appId = "safebite01";


// --- COMPONENT DEFINITIONS (ALL COMPONENTS MUST BE DEFINED BEFORE THEY ARE USED IN App's JSX) ---

// --- SectionCard Component (Common UI element) ---
const SectionCard = ({ title, children }) => (
  <div className="bg-white p-6 rounded-lg shadow-xl border border-gray-200 hover:shadow-2xl transition-shadow duration-300">
    <h2 className="text-2xl font-semibold text-gray-800 mb-4 border-b pb-2">{title}</h2>
    {children}
  </div>
);

// --- Header Component ---
const Header = ({ user, onSignOut, userId }) => (
  <header className="bg-gradient-to-r from-green-500 to-teal-600 text-white p-4 shadow-lg rounded-b-xl">
    <div className="container mx-auto flex justify-between items-center">
      <h1 className="text-3xl font-bold font-inter">SafeBite</h1>
      <nav className="flex items-center space-x-4">
        {user ? (
          <>
            <span className="text-sm font-medium">Logged in as: {userId}</span>
            <button
              onClick={onSignOut}
              className="bg-white text-green-700 px-4 py-2 rounded-full shadow-md hover:bg-gray-100 transition duration-300 ease-in-out"
            >
              Sign Out
            </button>
          </>
        ) : (
          <span className="text-sm font-medium">Not signed in</span>
        )}
      </nav>
    </div>
  </header>
);

// --- Footer Component ---
const Footer = () => (
  <footer className="bg-gray-800 text-white p-4 mt-8 rounded-t-xl">
    <div className="container mx-auto text-center text-sm">
      &copy; {new Date().getFullYear()} SafeBite. All rights reserved.
    </div>
  </footer>
);

// --- AllergenProfile Component ---
const AllergenProfile = ({ userId, db, userProfile, setUserProfile, allAllergens }) => {
  const [editing, setEditing] = useState(false);
  const [selectedAllergens, setSelectedAllergens] = useState([]);
  const [emergencyContacts, setEmergencyContacts] = useState([]);
  const [secondaryRestrictions, setSecondaryRestrictions] = useState('');
  const [emergencyPlan, setEmergencyPlan] = useState({ medication: '', dosage: '', instructions: '' });
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (userProfile) {
      setSelectedAllergens(userProfile.allergens || []);
      setEmergencyContacts(userProfile.emergencyContacts || []);
      setSecondaryRestrictions(userProfile.secondaryRestrictions || '');
      setEmergencyPlan(userProfile.emergencyPlan || { medication: '', dosage: '', instructions: '' });
    }
  }, [userProfile]);

  const handleAllergenChange = (e) => {
    const { value, checked } = e.target;
    setSelectedAllergens(prev =>
      checked ? [...prev, value] : prev.filter(a => a !== value)
    );
  };

  const handleContactChange = (index, field, value) => {
    const newContacts = [...emergencyContacts];
    newContacts[index] = { ...newContacts[index], [field]: value };
    setEmergencyContacts(newContacts);
  };

  const addContact = () => {
    setEmergencyContacts(prev => [...prev, { name: '', phone: '' }]);
  };

  const removeContact = (index) => {
    setEmergencyContacts(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!userId) {
      setMessage("Please sign in to save your profile.");
      return;
    }
    setMessage("Saving profile...");
    try {
      const profileData = {
        allergens: selectedAllergens,
        emergencyContacts,
        secondaryRestrictions,
        emergencyPlan,
      };
      const userProfileRef = doc(db, `users/${userId}/profiles/user_profile`);
      await setDoc(userProfileRef, profileData, { merge: true });
      setUserProfile(profileData);
      setEditing(false);
      setMessage("Profile saved successfully!");
    } catch (error) {
      console.error("Error saving profile:", error);
      setMessage(`Error saving profile: ${error.message}`);
    }
  };

  if (!userId) {
    return (
      <SectionCard title="Allergy Profile">
        <p className="text-gray-600">Please sign in to manage your allergy profile.</p>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Allergy Profile">
      {message && <p className="text-sm text-green-600 mb-4">{message}</p>}
      {!editing ? (
        <div>
          <h3 className="text-lg font-medium mb-2">My Allergens:</h3>
          {userProfile?.allergens?.length > 0 ? (
            <ul className="list-disc list-inside mb-4">
              {userProfile.allergens.map(allergenId => {
                const allergen = allAllergens.find(a => a.id === allergenId);
                return <li key={allergenId}>{allergen ? allergen.name : allergenId}</li>;
              })}
            </ul>
          ) : (
            <p className="text-gray-600 mb-4">No allergens specified. Click 'Edit' to add them.</p>
          )}

          <h3 className="text-lg font-medium mb-2">Emergency Contacts:</h3>
          {userProfile?.emergencyContacts?.length > 0 ? (
            <ul className="list-disc list-inside mb-4">
              {userProfile.emergencyContacts.map((contact, index) => (
                <li key={index}>{contact.name} - {contact.phone}</li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-600 mb-4">No emergency contacts added.</p>
          )}

          <h3 className="text-lg font-medium mb-2">Emergency Action Plan:</h3>
          {userProfile?.emergencyPlan?.medication ? (
            <div className="mb-4 text-gray-700">
              <p><strong>Medication:</strong> {userProfile.emergencyPlan.medication}</p>
              <p><strong>Dosage:</strong> {userProfile.emergencyPlan.dosage}</p>
              <p><strong>Instructions:</strong> {userProfile.emergencyPlan.instructions}</p>
            </div>
          ) : (
            <p className="text-gray-600 mb-4">No emergency plan details.</p>
          )}

          <button
            onClick={() => setEditing(true)}
            className="bg-blue-600 text-white px-6 py-2 rounded-full shadow-md hover:bg-blue-700 transition duration-300 ease-in-out"
          >
            Edit Profile
          </button>
        </div>
      ) : (
        <div>
          <h3 className="text-lg font-medium mb-2">Select Your Allergens:</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4 max-h-60 overflow-y-auto p-2 border rounded-md bg-gray-50">
            {allAllergens.map(allergen => (
              <label key={allergen.id} className="flex items-center space-x-2 text-gray-700">
                <input
                  type="checkbox"
                  value={allergen.id}
                  checked={selectedAllergens.includes(allergen.id)}
                  onChange={handleAllergenChange}
                  className="form-checkbox h-4 w-4 text-green-600 rounded"
                />
                <span>{allergen.name}</span>
              </label>
            ))}
          </div>

          <h3 className="text-lg font-medium mb-2">Emergency Contacts:</h3>
          {emergencyContacts.map((contact, index) => (
            <div key={index} className="flex space-x-2 mb-2">
              <input
                type="text"
                placeholder="Name"
                value={contact.name}
                onChange={(e) => handleContactChange(index, 'name', e.target.value)}
                className="flex-1 p-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
              <input
                type="text"
                placeholder="Phone"
                value={contact.phone}
                onChange={(e) => handleContactChange(index, 'phone', e.target.value)}
                className="flex-1 p-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
              <button onClick={() => removeContact(index)} className="bg-red-500 text-white px-3 py-1 rounded-md hover:bg-red-600">
                Remove
              </button>
            </div>
          ))}
          <button onClick={addContact} className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 mb-4">
            Add Contact
          </button>

          <h3 className="text-lg font-medium mb-2">Emergency Action Plan:</h3>
          <textarea
            placeholder="Medication (e.g., EpiPen)"
            value={emergencyPlan.medication}
            onChange={(e) => setEmergencyPlan(prev => ({ ...prev, medication: e.target.value }))}
            className="w-full p-2 border rounded-md mb-2 focus:ring-blue-500 focus:border-blue-500"
          ></textarea>
          <textarea
            placeholder="Dosage (e.g., 0.3mg)"
            value={emergencyPlan.dosage}
            onChange={(e) => setEmergencyPlan(prev => ({ ...prev, dosage: e.target.value }))}
            className="w-full p-2 border rounded-md mb-2 focus:ring-blue-500 focus:border-blue-500"
          ></textarea>
          <textarea
            placeholder="Instructions (e.g., How to administer)"
            value={emergencyPlan.instructions}
            onChange={(e) => setEmergencyPlan(prev => ({ ...prev, instructions: e.target.value }))}
            rows="3"
            className="w-full p-2 border rounded-md mb-4 focus:ring-blue-500 focus:border-blue-500"
          ></textarea>

          <div className="flex space-x-4">
            <button
              onClick={() => setEditing(false)}
              className="bg-gray-400 text-white px-6 py-2 rounded-full shadow-md hover:bg-gray-500 transition duration-300 ease-in-out"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="bg-green-600 text-white px-6 py-2 rounded-full shadow-md hover:bg-green-700 transition duration-300 ease-in-out"
            >
              Save Profile
            </button>
          </div>
        </div>
      )}
    </SectionCard>
  );
};


// --- SYMPTOM LOG COMPONENT ---
const SymptomLog = ({ userId, db }) => {
  const [currentLogType, setCurrentLogType] = useState('food');
  const [foodIntakeText, setFoodIntakeText] = useState('');
  const [foodIntakeDate, setFoodIntakeDate] = useState(new Date().toISOString().split('T')[0]);
  const [foodIntakeTime, setFoodIntakeTime] = useState(new Date().toTimeString().split(' ')[0].substring(0, 5));
  const [symptomsText, setSymptomsText] = useState('');
  const [symptomDate, setSymptomDate] = useState(new Date().toISOString().split('T')[0]);
  const [symptomTime, setSymptomTime] = useState(new Date().toTimeString().split(' ')[0].substring(0, 5));
  const [noSymptoms, setNoSymptoms] = useState(false);
  const [severity, setSeverity] = useState('Mild');
  const [potentialExposureSource, setPotentialExposureSource] = useState('');
  const [logs, setLogs] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const logsCollectionRef = collection(db, `users/${userId}/logs`);
    const q = query(logsCollectionRef);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedLogs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate().toLocaleString() || 'N/A'
      }));
      fetchedLogs.sort((a, b) => {
        const dateA = a.type === 'food_intake' ? new Date(`${a.foodIntakeDate}T${a.foodIntakeTime}`) : new Date(`${a.symptomDate}T${a.symptomTime}`);
        const dateB = b.type === 'food_intake' ? new Date(`${b.foodIntakeDate}T${b.foodIntakeTime}`) : new Date(`${b.symptomDate}T${b.symptomTime}`);
        return dateB - dateA;
      });
      setLogs(fetchedLogs);
    }, (error) => {
      console.error("Error fetching logs:", error);
      setMessage(`Error fetching logs: ${error.message}`);
    });
    return () => unsubscribe();
  }, [userId, db]);

  const handleSubmitFood = async (e) => {
    e.preventDefault();
    if (!userId) { setMessage("Please sign in to log food intake."); return; }
    setLoading(true); setMessage("Adding food intake log...");
    try {
      const logData = { type: 'food_intake', foodIntakeText, foodIntakeDate, foodIntakeTime, timestamp: new Date(), };
      await addDoc(collection(db, `users/${userId}/logs`), logData);
      setMessage("Food intake log added successfully!");
      setFoodIntakeText(''); setFoodIntakeDate(new Date().toISOString().split('T')[0]); setFoodIntakeTime(new Date().toTimeString().split(' ')[0].substring(0, 5));
    } catch (error) { console.error("Error adding food intake log:", error); setMessage(`Error adding log: ${error.message}`); } finally { setLoading(false); }
  };

  const handleSubmitSymptom = async (e) => {
    e.preventDefault();
    if (!userId) { setMessage("Please sign in to log symptoms."); return; }
    setLoading(true); setMessage("Adding symptom log...");
    try {
      const logData = { type: 'symptom', symptomDate, symptomTime, timestamp: new Date(), };
      if (noSymptoms) { logData.symptomsExperienced = ['Nil']; } else { logData.symptomsExperienced = symptomsText.split(',').map(s => s.trim()).filter(s => s); logData.severity = severity; logData.potentialExposureSource = potentialExposureSource; }
      await addDoc(collection(db, `users/${userId}/logs`), logData);
      setMessage("Symptom log added successfully!");
      setSymptomsText(''); setSeverity('Mild'); setPotentialExposureSource(''); setNoSymptoms(false);
      setSymptomDate(new Date().toISOString().split('T')[0]); setSymptomTime(new Date().toTimeString().split(' ')[0].substring(0, 5));
    } catch (error) { console.error("Error adding symptom log:", error); setMessage(`Error adding log: ${error.message}`); } finally { setLoading(false); }
  };

  if (!userId) {
    return (
      <SectionCard title="Symptom & Exposure Log">
        <p className="text-gray-600">Please sign in to log your symptoms and exposures.</p>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Symptom & Exposure Log">
      {message && <p className="text-sm text-green-600 mb-4">{message}</p>}
      <div className="flex justify-center mb-6 space-x-4">
        <button onClick={() => setCurrentLogType('food')} className={`px-6 py-2 rounded-full font-medium transition duration-300 ${currentLogType === 'food' ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>Log Food Intake</button>
        <button onClick={() => setCurrentLogType('symptom')} className={`px-6 py-2 rounded-full font-medium transition duration-300 ${currentLogType === 'symptom' ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>Log Symptoms</button>
      </div>
      {currentLogType === 'food' && (
        <form onSubmit={handleSubmitFood} className="space-y-4 mb-6 p-4 border rounded-lg bg-blue-50">
          <h3 className="text-xl font-semibold text-blue-800">New Food Intake Entry</h3>
          <div><label htmlFor="foodIntakeText" className="block text-gray-700 font-medium mb-1">Food Intake Description:</label><input type="text" id="foodIntakeText" value={foodIntakeText} onChange={(e) => setFoodIntakeText(e.target.value)} className="w-full p-2 border rounded-md focus:ring-blue-500 focus:border-blue-500" placeholder="e.g., Oatmeal with almond milk, apple" required/></div>
          <div className="flex space-x-4"><div className="flex-1"><label htmlFor="foodIntakeDate" className="block text-gray-700 font-medium mb-1">Date:</label><input type="date" id="foodIntakeDate" value={foodIntakeDate} onChange={(e) => setFoodIntakeDate(e.target.value)} className="w-full p-2 border rounded-md focus:ring-blue-500 focus:border-blue-500" required/></div><div className="flex-1"><label htmlFor="foodIntakeTime" className="block text-gray-700 font-medium mb-1">Time:</label><input type="time" id="foodIntakeTime" value={foodIntakeTime} onChange={(e) => setFoodIntakeTime(e.target.value)} className="w-full p-2 border rounded-md focus:ring-blue-500 focus:border-blue-500" required/></div></div>
          <button type="submit" className="bg-green-600 text-white px-6 py-2 rounded-full shadow-md hover:bg-green-700 transition duration-300 ease-in-out disabled:opacity-50" disabled={loading}>{loading ? 'Adding...' : 'Add Food Log'}</button>
        </form>
      )}
      {currentLogType === 'symptom' && (
        <form onSubmit={handleSubmitSymptom} className="space-y-4 mb-6 p-4 border rounded-lg bg-red-50">
          <h3 className="text-xl font-semibold text-red-800">New Symptom Entry</h3>
          <div className="flex space-x-4"><div className="flex-1"><label htmlFor="symptomDate" className="block text-gray-700 font-medium mb-1">Date:</label><input type="date" id="symptomDate" value={symptomDate} onChange={(e) => setSymptomDate(e.target.value)} className="w-full p-2 border rounded-md focus:ring-blue-500 focus:border-blue-500" required/></div><div className="flex-1"><label htmlFor="symptomTime" className="block text-gray-700 font-medium mb-1">Time:</label><input type="time" id="symptomTime" value={symptomTime} onChange={(e) => setSymptomTime(e.target.value)} className="w-full p-2 border rounded-md focus:ring-blue-500 focus:border-blue-500" required/></div></div>
          <div><label className="flex items-center space-x-2 text-gray-700 font-medium mb-1"><input type="checkbox" checked={noSymptoms} onChange={(e) => setNoSymptoms(e.target.checked)} className="form-checkbox h-4 w-4 text-green-600 rounded"/><span>No Symptoms Occurred (Nil)</span></label></div>
          {!noSymptoms && (<><div/><label htmlFor="symptomsText" className="block text-gray-700 font-medium mb-1">Symptoms (comma-separated):</label><input type="text" id="symptomsText" value={symptomsText} onChange={(e) => setSymptomsText(e.target.value)} className="w-full p-2 border rounded-md focus:ring-blue-500 focus:border-blue-500" placeholder="e.g., Hives, stomach ache, difficulty breathing" required={!noSymptoms}/><div/><label htmlFor="severity" className="block text-gray-700 font-medium mb-1">Severity:</label><select id="severity" value={severity} onChange={(e) => setSeverity(e.target.value)} className="w-full p-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"><option>Mild</option><option>Moderate</option><option>Severe</option></select><div/><label htmlFor="potentialExposureSource" className="block text-gray-700 font-medium mb-1">Potential Exposure Source:</label><input type="text" id="potentialExposureSource" value={potentialExposureSource} onChange={(e) => setPotentialExposureSource(e.target.value)} className="w-full p-2 border rounded-md focus:ring-blue-500 focus:border-blue-500" placeholder="e.g., Restaurant X, new product, cross-contamination"/></>)}
          <button type="submit" className="bg-green-600 text-white px-6 py-2 rounded-full shadow-md hover:bg-green-600 transition duration-300 ease-in-out disabled:opacity-50" disabled={loading}>{loading ? 'Adding...' : 'Add Symptom Log'}</button>
        </form>
      )}
      <h3 className="text-lg font-medium mb-2 mt-8">My Log History:</h3>
      {logs.length === 0 ? (<p className="text-gray-600">No log entries yet.</p>) : (<div className="space-y-4 max-h-80 overflow-y-auto p-2 border rounded-md bg-gray-50">{logs.map((log) => (<div key={log.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">{log.type === 'food_intake' ? (<><p className="text-sm text-gray-500"><span className="font-semibold text-blue-700">Food Intake:</span> {log.foodIntakeDate} at {log.foodIntakeTime}</p><p className="text-gray-800"><strong>Description:</strong> {log.foodIntakeText}</p></>) : (<><p className="text-sm text-gray-500"><span className="font-semibold text-red-700">Symptoms:</span> {log.symptomDate} at {log.symptomTime}</p>{log.symptomsExperienced && log.symptomsExperienced[0] === 'Nil' ? (<p className="text-green-600 font-semibold">No symptoms reported (Nil)</p>) : (<><p><strong>Symptoms:</strong> {log.symptomsExperienced?.join(', ') || 'N/A'}</p><p><strong>Severity:</strong> <span className={`font-semibold ${log.severity === 'Severe' ? 'text-red-600' : log.severity === 'Moderate' ? 'text-orange-500' : 'text-green-600'}`}>{log.severity || 'N/A'}</span></p>{log.potentialExposureSource && <p><strong>Source:</strong> {log.potentialExposureSource}</p>}</>)}</>)}<p className="text-xs text-gray-400 mt-2">Logged on: {log.timestamp}</p></div>))}</div>)}
    </SectionCard>
  );
};


// --- NLP ANALYZER COMPONENT ---
const NLPAnalyzer = ({ userId, userProfile, allAllergens }) => {
  const [text, setText] = useState('');
  const [analysisResult, setAnalysisResult] = useState(null); // This will now hold structured data from Gemini
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleAnalyze = async () => {
    if (!userId) {
      setMessage("Please sign in to analyze text.");
      return;
    }
    if (!text.trim()) {
      setMessage("Please enter text to analyze.");
      return;
    }
    setLoading(true);
    setMessage("Analyzing text with AI...");
    setAnalysisResult(null); // Clear previous results

    try {
      const response = await fetch('http://localhost:5000/api/analyze-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await auth.currentUser.getIdToken()}`
        },
        body: JSON.stringify({
          text: text,
          userAllergens: userProfile?.allergens || [] // Send user's allergens for context
        }),
      });

      const data = await response.json();
      if (response.ok && data.analysis_result) {
        setAnalysisResult(data.analysis_result);
        setMessage("Analysis complete!");
      } else {
        setMessage(`Error: ${data.error || 'Failed to analyze text'}`);
      }
    } catch (error) {
      console.error("Error during NLP analysis:", error);
      setMessage(`Network or server error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!userId) {
    return (
      <SectionCard title="Recipe/Menu Analyzer">
        <p className="text-gray-600">Please sign in to use the recipe/menu analyzer.</p>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Recipe/Menu Analyzer">
      {message && <p className="text-sm text-green-600 mb-4">{message}</p>}
      <textarea
        className="w-full p-3 border rounded-md mb-4 focus:ring-blue-500 focus:border-blue-500"
        rows="6"
        placeholder="Paste recipe ingredients or menu description here..."
        value={text}
        onChange={(e) => setText(e.target.value)}
      ></textarea>
      <button
        onClick={handleAnalyze}
        className="bg-purple-600 text-white px-6 py-2 rounded-full shadow-md hover:bg-purple-700 transition duration-300 ease-in-out disabled:opacity-50"
        disabled={loading}
      >
        {loading ? 'Analyzing...' : 'Analyze Text'}
      </button>

      {analysisResult && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="text-lg font-medium mb-3 text-gray-800">AI Analysis Results:</h3>
          {analysisResult.detected_allergens && analysisResult.detected_allergens.length > 0 ? (
            <div className="space-y-3 mb-4">
              <p className="font-semibold text-red-600">Potential Allergy Issues Detected:</p>
              {analysisResult.detected_allergens.map((issue, index) => (
                <div key={index} className="bg-red-50 border border-red-200 p-3 rounded-md">
                  <p className="font-medium text-red-700">Allergen: {issue.name} ({issue.allergenId})</p>
                  <p className="text-sm text-red-600">Type: {issue.type}</p>
                  <p className="text-sm text-red-600">Reason: {issue.reason}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-green-600 font-semibold mb-4">No direct allergy issues detected by AI based on your profile and known allergens. Always exercise caution!</p>
          )}

          {analysisResult.overall_risk_summary && (
            <div className="mt-4 bg-blue-50 border border-blue-200 p-3 rounded-md mb-4">
              <h3 className="text-lg font-medium text-blue-800 mb-2">Overall Risk Summary:</h3>
              <p className="text-sm text-blue-700 whitespace-pre-wrap">{analysisResult.overall_risk_summary}</p>
            </div>
          )}

          {analysisResult.clarifying_questions && analysisResult.clarifying_questions.length > 0 && (
            <div className="mt-4 bg-yellow-50 border border-yellow-200 p-3 rounded-md">
              <h3 className="text-lg font-medium text-yellow-800 mb-2">Clarifying Questions:</h3>
              <ul className="list-disc list-inside text-sm text-yellow-700">
                {analysisResult.clarifying_questions.map((question, index) => (
                  <li key={index}>{question}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </SectionCard>
  );
};


// --- PREDICTIVE ANALYTICS COMPONENT ---
const PredictiveAnalytics = ({ userId }) => {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const fetchInsights = async () => {
    if (!userId) { setMessage("Please sign in to get predictive insights."); return; }
    setLoading(true); setMessage("Analyzing your logs for patterns..."); setInsights(null);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) { setMessage("Authentication token not available. Please try signing in again."); setLoading(false); return; }
      const response = await fetch('http://localhost:5000/api/predictive-analytics', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
      });
      const data = await response.json();
      if (response.ok) { setInsights(data); setMessage(data.gemini_insights || "Insights generated successfully!"); } else { setMessage(`Error: ${data.error || 'Failed to generate insights'}`); }
    } catch (error) { console.error("Error fetching predictive analytics:", error); setMessage(`Network or server error: ${error.message}`); } finally { setLoading(false); }
  };

  if (!userId) {
    return (
      <SectionCard title="Predictive Analytics">
        <p className="text-gray-600">Please sign in to access predictive insights.</p>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Predictive Analytics">
      {message && <p className="text-sm text-green-600 mb-4">{message}</p>}
      <button onClick={fetchInsights} className="bg-indigo-600 text-white px-6 py-2 rounded-full shadow-md hover:bg-indigo-700 transition duration-300 ease-in-out disabled:opacity-50" disabled={loading}>{loading ? 'Generating Insights...' : 'Generate Predictive Insights'}</button>
      {insights && (<div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200"><h3 className="text-lg font-medium mb-3 text-gray-800">Your Personalized Insights:</h3>{insights.patterns && insights.patterns.length > 0 ? (<div className="mb-4"><p className="font-semibold text-gray-700 mb-2">Identified Patterns:</p><ul className="list-disc list-inside space-y-1 text-gray-700">{insights.patterns.map((pattern, index) => (<li key={index}>{pattern}</li>))}</ul></div>) : (<p className="text-gray-600 mb-4">No specific patterns identified yet. Keep logging your data!</p>)} {insights.suggestions && insights.suggestions.length > 0 && (<div><p className="font-semibold text-gray-700 mb-2">Actionable Suggestions:</p><ul className="list-disc list-inside space-y-1 text-gray-700">{insights.suggestions.map((suggestion, index) => (<li key={index}>{suggestion}</li>))}</ul></div>)} {insights.gemini_insights && <p className="text-sm text-gray-500 mt-4">{insights.gemini_insights}</p>}</div>)}
    </SectionCard>
  );
};

// --- POSSIBLE ALLERGEN PREDICTOR COMPONENT ---
const PredictAllergen = ({ userId }) => { // Renamed from PossibleAllergenPredictor to PredictAllergen
  const [predictionResult, setPredictionResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handlePredict = async () => {
    if (!userId) { setMessage("Please sign in to predict possible allergens."); return; }
    setLoading(true); setMessage("Analyzing your food and symptom logs to predict possible allergens..."); setPredictionResult(null);
    try {
      const idToken = await auth.currentUser.getIdToken(); // 'auth' is imported directly
      if (!idToken) { setMessage("Authentication token not available. Please try signing in again."); setLoading(false); return; }
      const response = await fetch('http://localhost:5000/api/predict-allergen', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
      });
      const data = await response.json();
      if (response.ok) { setPredictionResult(data); setMessage(data.gemini_message || "Prediction complete!"); } else { setMessage(`Error: ${data.error || 'Failed to predict allergens'}`); }
    } catch (error) { console.error("Error during allergen prediction:", error); setMessage(`Network or server error: ${error.message}`); } finally { setLoading(false); }
  };

  if (!userId) {
    return (
      <SectionCard title="Possible Allergen Predictor">
        <p className="text-gray-600">Please sign in to use the possible allergen predictor.</p>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Possible Allergen Predictor">
      {message && <p className="text-sm text-green-600 mb-4">{message}</p>}
      <p className="text-gray-700 mb-4">This tool uses AI to analyze your logged food intake and symptoms to suggest potential uncommon allergens.**Always consult a healthcare professional for diagnosis.**</p>
      <button onClick={handlePredict} className="bg-orange-600 text-white px-6 py-2 rounded-full shadow-md hover:bg-orange-700 transition duration-300 ease-in-out disabled:opacity-50" disabled={loading}>{loading ? 'Predicting...' : 'Predict Possible Allergens'}</button>
      {predictionResult && (<div className="mt-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200"><h3 className="text-lg font-medium mb-3 text-yellow-800">Prediction Results:</h3>{predictionResult.predicted_allergens && predictionResult.predicted_allergens.length > 0 ? (<div className="space-y-3">{predictionResult.predicted_allergens.map((item, index) => (<div key={index} className="bg-yellow-100 border border-yellow-300 p-3 rounded-md"><p className="font-medium text-yellow-900">Possible Allergen: <span className="font-bold">{item.allergen}</span></p><p className="text-sm text-yellow-800">Reasoning: {item.reasoning}</p></div>))}</div>) : (<p className="text-gray-700">{predictionResult.gemini_message}</p>)}</div>)}
    </SectionCard>
  );
};


// --- CHEF CARD GENERATOR COMPONENT ---
const ChefCardGenerator = ({ userId, userProfile, allAllergens }) => {
  const [chefCardText, setChefCardText] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (userProfile && allAllergens.length > 0) {
      generateCard();
    }
  }, [userProfile, allAllergens]);

  const generateCard = () => {
    if (!userProfile || !userProfile.allergens || userProfile.allergens.length === 0) {
      setChefCardText("Please set up your allergy profile first to generate a chef card.");
      return;
    }
    let card = `Dear Chef/Restaurant Staff,\n\n`;
    card += `I have severe food allergies. Please ensure that my meal is prepared without any cross-contamination with the following ingredients:\n\n`;
    userProfile.allergens.forEach(allergenId => {
      const allergen = allAllergens.find(a => a.id === allergenId);
      if (allergen) {
        card += `- ${allergen.name} (${allergen.commonNames ? allergen.commonNames.join(', ') : ''})\n`;
        if (allergen.hiddenSources && allergen.hiddenSources.length > 0) {
          card += `  (Also known as: ${allergen.hiddenSources.join(', ')})\n`;
        }
      }
    });
    if (userProfile.secondaryRestrictions) {
      card += `\nAdditionally, I follow a ${userProfile.secondaryRestrictions} diet.\n`;
    }
    card += `\nMy reaction to these allergens can be severe. Your careful attention to this is greatly appreciated.\n\nThank Thank you!`;
    setChefCardText(card);
  };

  const copyToClipboard = () => {
    if (chefCardText) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(chefCardText).then(() => {
          setMessage('Chef card copied to clipboard!');
          setTimeout(() => setMessage(''), 3000);
        }).catch(err => {
          console.error('Failed to copy text: ', err);
          setMessage('Failed to copy automatically. Please copy manually.');
          setTimeout(() => setMessage(''), 5000);
        });
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = chefCardText;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        setMessage('Chef card copied to clipboard (fallback)!');
        setTimeout(() => setMessage(''), 3000);
      }
    }
  };

  if (!userId) {
    return (
      <SectionCard title="Chef Card Generator">
        <p className="text-gray-600">Please sign in to generate your personalized chef card.</p>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Chef Card Generator">
      {message && <p className="text-sm text-green-600 mb-4">{message}</p>}
      <p className="text-gray-700 mb-4">Generate a customizable card to share your allergies with restaurant staff.</p>
      <textarea className="w-full p-3 border rounded-md mb-4 font-mono text-sm bg-gray-50" rows="12" readOnly value={chefCardText}></textarea>
      <div className="flex space-x-4">
        <button onClick={generateCard} className="bg-blue-600 text-white px-6 py-2 rounded-full shadow-md hover:bg-blue-700 transition duration-300 ease-in-out">Regenerate Card</button>
        <button onClick={copyToClipboard} className="bg-teal-600 text-white px-6 py-2 rounded-full shadow-md hover:bg-teal-700 transition duration-300 ease-in-out">Copy to Clipboard</button>
      </div>
      <p className="text-xs text-gray-500 mt-2">Note: For multi-language support, you would integrate with a translation API.</p>
    </SectionCard>
  );
};


// --- EDUCATIONAL RESOURCES COMPONENT ---
const EducationalResources = ({ userId, db }) => {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    const resourcesCollectionRef = collection(db, 'educational_resources');
    const unsubscribe = onSnapshot(resourcesCollectionRef, (snapshot) => {
      const fetchedResources = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setResources(fetchedResources); setLoading(false);
    }, (error) => { console.error("Error fetching educational resources:", error); setMessage(`Error fetching resources: ${error.message}`); setLoading(false); });
    return () => unsubscribe();
  }, [userId, db]);

  if (!userId) {
    return (
      <SectionCard title="Educational Resources">
        <p className="text-gray-600">Please sign in to access educational resources.</p>
      </SectionCard>
    );
  }

  if (loading) {
    return (
      <SectionCard title="Educational Resources">
        <p className="text-gray-600">Loading resources...</p>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Educational Resources">
      {message && <p className="text-sm text-red-600 mb-4">{message}</p>}
      {resources.length === 0 ? (<p className="text-gray-600">No educational resources available yet. (Admin can add them via Firestore console).</p>) : (<div className="space-y-4 max-h-80 overflow-y-auto p-2 border rounded-md bg-gray-50">{resources.map(resource => (<div key={resource.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-100"><h3 className="text-lg font-semibold text-gray-800">{resource.title}</h3><p className="text-sm text-gray-500 mb-2">Source: {resource.source}</p><div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: resource.content }}></div>{Array.isArray(resource.allergensCovered) && resource.allergensCovered.length > 0 && (<p className="text-xs text-gray-600 mt-2">Relevant Allergens: {resource.allergensCovered.join(', ')}</p>)}</div>))}</div>)}
    </SectionCard>
  );
};


// --- MAIN APP COMPONENT ---
const App = () => {
  const [user, setUser] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [allAllergens, setAllAllergens] = useState([]);
  const [activeTab, setActiveTab] = useState('profile');

  // Firebase Auth Listener and Initialization
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setUserId(currentUser.uid);
      } else {
        try {
          await signInAnonymously(auth);
        } catch (error) {
          console.error("Error signing in:", error);
        }
      }
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Fetch user profile and all allergens once authenticated
  useEffect(() => {
    if (isAuthReady && userId) {
      const userProfileRef = doc(db, `users/${userId}/profiles/user_profile`);
      const unsubscribeProfile = onSnapshot(userProfileRef, (docSnap) => {
        if (docSnap.exists()) { setUserProfile(docSnap.data()); } else { setUserProfile(null); }
      }, (error) => { console.error("Error fetching user profile:", error); });

      const allergensCollectionRef = collection(db, 'allergens');
      const unsubscribeAllergens = onSnapshot(allergensCollectionRef, (snapshot) => {
        const fetchedAllergens = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAllAllergens(fetchedAllergens);
      }, (error) => { console.error("Error fetching all allergens:", error); });

      return () => { unsubscribeProfile(); unsubscribeAllergens(); };
    }
  }, [isAuthReady, userId, db]);

  const handleSignOut = async () => {
    try { await signOut(auth); setUser(null); setUserId(null); setUserProfile(null); console.log("User signed out."); }
    catch (error) { console.error("Error signing out:", error); }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 font-inter">
        <p className="text-xl text-gray-700">Loading SafeBite...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-100 font-inter text-gray-900">
      <Header user={user} onSignOut={handleSignOut} userId={userId} />

      <main className="container mx-auto p-6 flex-grow">
        <nav className="mb-6 bg-white p-3 rounded-lg shadow-md flex justify-center space-x-4 flex-wrap gap-2">
          <button onClick={() => setActiveTab('profile')} className={`px-5 py-2 rounded-full font-medium transition duration-300 ${activeTab === 'profile' ? 'bg-green-600 text-white shadow-lg' : 'text-gray-700 hover:bg-gray-100'}`}>My Profile</button>
          <button onClick={() => setActiveTab('log')} className={`px-5 py-2 rounded-full font-medium transition duration-300 ${activeTab === 'log' ? 'bg-green-600 text-white shadow-lg' : 'text-gray-700 hover:bg-gray-100'}`}>Symptom Log</button>
          <button onClick={() => setActiveTab('analyze')} className={`px-5 py-2 rounded-full font-medium transition duration-300 ${activeTab === 'analyze' ? 'bg-green-600 text-white shadow-lg' : 'text-gray-700 hover:bg-gray-100'}`}>Analyze Text</button>
          <button onClick={() => setActiveTab('predictive')} className={`px-5 py-2 rounded-full font-medium transition duration-300 ${activeTab === 'predictive' ? 'bg-green-600 text-white shadow-lg' : 'text-gray-700 hover:bg-gray-100'}`}>Predictive Insights</button>
          <button onClick={() => setActiveTab('allergen-predictor')} className={`px-5 py-2 rounded-full font-medium transition duration-300 ${activeTab === 'allergen-predictor' ? 'bg-green-600 text-white shadow-lg' : 'text-gray-700 hover:bg-gray-100'}`}>Possible Allergen</button>
          <button onClick={() => setActiveTab('chefcard')} className={`px-5 py-2 rounded-full font-medium transition duration-300 ${activeTab === 'chefcard' ? 'bg-green-600 text-white shadow-lg' : 'text-gray-700 hover:bg-gray-100'}`}>Chef Card</button>
          <button onClick={() => setActiveTab('education')} className={`px-5 py-2 rounded-full font-medium transition duration-300 ${activeTab === 'education' ? 'bg-green-600 text-white shadow-lg' : 'text-gray-700 hover:bg-gray-100'}`}>Education</button>
        </nav>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activeTab === 'profile' && (<div className="lg:col-span-2"><AllergenProfile userId={userId} db={db} userProfile={userProfile} setUserProfile={setUserProfile} allAllergens={allAllergens}/></div>)}
          {activeTab === 'log' && (<div className="lg:col-span-2"><SymptomLog userId={userId} db={db}/></div>)}
          {activeTab === 'analyze' && (<div className="lg:col-span-2"><NLPAnalyzer userId={userId} userProfile={userProfile} allAllergens={allAllergens}/></div>)}
          {activeTab === 'predictive' && (<div className="lg:col-span-2"><PredictiveAnalytics userId={userId}/></div>)}
          {activeTab === 'allergen-predictor' && (<div className="lg:col-span-2"><PredictAllergen userId={userId}/></div>)}
          {activeTab === 'chefcard' && (<div className="lg:col-span-2"><ChefCardGenerator userId={userId} userProfile={userProfile} allAllergens={allAllergens}/></div>)}
          {activeTab === 'education' && (<div className="lg:col-span-2"><EducationalResources userId={userId} db={db}/></div>)}
          {activeTab === 'profile' && (<SectionCard title="Quick Actions"><p className="text-gray-700 mb-4">Your User ID: <span className="font-semibold text-blue-600 break-all">{userId || 'N/A'}</span></p><p className="text-gray-600 text-sm">Share this ID for collaborative features (if implemented).</p></SectionCard>)}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default App;