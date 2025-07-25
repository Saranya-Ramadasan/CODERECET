import React, { useState, useEffect } from 'react';
// These imports are for the Firebase *functions* that you will use in your components.
// They are separate from the initialized 'app', 'auth', 'db' instances.
import { getAuth, signInAnonymously, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, addDoc, onSnapshot, query } from 'firebase/firestore';

// CORRECT: Import the already initialized Firebase app, auth, and db instances from your config file
import { app, auth, db, analytics } from './firebase_config'; // Your Firebase client config

import './index.css'; // Tailwind CSS imports

// --- IMPORTANT ADJUSTMENTS FOR STANDALONE PROJECT ---
// Replace 'YOUR_FIREBASE_PROJECT_ID' with your actual Firebase Project ID string
// This is typically the 'projectId' value from your firebase_config.js
const appId = "safebite01"; // <--- Replace 'safebite01' with your actual Firebase Project ID if different.
// In a standalone project, you won't have __initial_auth_token from Canvas.
// We'll rely on signInAnonymously or your full authentication flow.
// const initialAuthToken = null; // No need for this variable if not using custom tokens from Canvas

// Components (defined within App.jsx for simplicity in this single file immersive)

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

const Footer = () => (
  <footer className="bg-gray-800 text-white p-4 mt-8 rounded-t-xl">
    <div className="container mx-auto text-center text-sm">
      &copy; {new Date().getFullYear()} SafeBite. All rights reserved.
    </div>
  </footer>
);

const SectionCard = ({ title, children }) => (
  <div className="bg-white p-6 rounded-lg shadow-xl border border-gray-200 hover:shadow-2xl transition-shadow duration-300">
    <h2 className="text-2xl font-semibold text-gray-800 mb-4 border-b pb-2">{title}</h2>
    {children}
  </div>
);

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
      // Use appId in Firestore path
      const userProfileRef = doc(db, `users/${userId}/profiles/user_profile`);
      await setDoc(userProfileRef, profileData, { merge: true }); // Use merge to avoid overwriting other fields
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
              onClick={handleSave}
              className="bg-green-600 text-white px-6 py-2 rounded-full shadow-md hover:bg-green-700 transition duration-300 ease-in-out"
            >
              Save Profile
            </button>
            <button
              onClick={() => setEditing(false)}
              className="bg-gray-400 text-white px-6 py-2 rounded-full shadow-md hover:bg-gray-500 transition duration-300 ease-in-out"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </SectionCard>
  );
};

const SymptomLog = ({ userId, db }) => {
  const [logs, setLogs] = useState([]);
  const [foodIntake, setFoodIntake] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [severity, setSeverity] = useState('Mild');
  const [exposureSource, setExposureSource] = useState('');
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
        timestamp: doc.data().timestamp?.toDate().toLocaleString() || 'N/A' // Convert Firestore Timestamp to readable string
      }));
      // Sort by timestamp descending
      fetchedLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setLogs(fetchedLogs);
    }, (error) => {
      console.error("Error fetching logs:", error);
      setMessage(`Error fetching logs: ${error.message}`);
    });

    return () => unsubscribe(); // Cleanup listener on unmount
  }, [userId, db]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!userId) {
      setMessage("Please sign in to log symptoms.");
      return;
    }
    setLoading(true);
    setMessage("Adding log...");
    try {
      const logData = {
        foodIntake,
        symptomsExperienced: symptoms.split(',').map(s => s.trim()).filter(s => s),
        severity,
        potentialExposureSource: exposureSource,
        timestamp: new Date(), // Use JS Date object, Firestore will convert to Timestamp
      };
      await addDoc(collection(db, `users/${userId}/logs`), logData);
      setMessage("Log added successfully!");
      setFoodIntake('');
      setSymptoms('');
      setSeverity('Mild');
      setExposureSource('');
    } catch (error) {
      console.error("Error adding log:", error);
      setMessage(`Error adding log: ${error.message}`);
    } finally {
      setLoading(false);
    }
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
      <form onSubmit={handleSubmit} className="space-y-4 mb-6">
        <div>
          <label htmlFor="foodIntake" className="block text-gray-700 font-medium mb-1">Food Intake:</label>
          <input
            type="text"
            id="foodIntake"
            value={foodIntake}
            onChange={(e) => setFoodIntake(e.target.value)}
            className="w-full p-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
            placeholder="e.g., Oatmeal, apple, almond milk"
            required
          />
        </div>
        <div>
          <label htmlFor="symptoms" className="block text-gray-700 font-medium mb-1">Symptoms (comma-separated):</label>
          <input
            type="text"
            id="symptoms"
            value={symptoms}
            onChange={(e) => setSymptoms(e.target.value)}
            className="w-full p-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
            placeholder="e.g., Hives, stomach ache, difficulty breathing"
            required
          />
        </div>
        <div>
          <label htmlFor="severity" className="block text-gray-700 font-medium mb-1">Severity:</label>
          <select
            id="severity"
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className="w-full p-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            <option>Mild</option>
            <option>Moderate</option>
            <option>Severe</option>
          </select>
        </div>
        <div>
          <label htmlFor="exposureSource" className="block text-gray-700 font-medium mb-1">Potential Exposure Source:</label>
          <input
            type="text"
            id="exposureSource"
            value={exposureSource}
            onChange={(e) => setExposureSource(e.target.value)}
            className="w-full p-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
            placeholder="e.g., Restaurant X, new product, cross-contamination"
          />
        </div>
        <button
          type="submit"
          className="bg-green-600 text-white px-6 py-2 rounded-full shadow-md hover:bg-green-700 transition duration-300 ease-in-out disabled:opacity-50"
          disabled={loading}
        >
          {loading ? 'Adding...' : 'Add Log Entry'}
        </button>
      </form>

      <h3 className="text-lg font-medium mb-2">My Log History:</h3>
      {logs.length === 0 ? (
        <p className="text-gray-600">No log entries yet.</p>
      ) : (
        <div className="space-y-4 max-h-80 overflow-y-auto p-2 border rounded-md bg-gray-50">
          {logs.map((log) => (
            <div key={log.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
              <p className="text-sm text-gray-500">{log.timestamp}</p>
              <p><strong>Food:</strong> {log.foodIntake}</p>
              <p><strong>Symptoms:</strong> {log.symptomsExperienced.join(', ')}</p>
              <p><strong>Severity:</strong> <span className={`font-semibold ${log.severity === 'Severe' ? 'text-red-600' : log.severity === 'Moderate' ? 'text-orange-500' : 'text-green-600'}`}>{log.severity}</span></p>
              {log.potentialExposureSource && <p><strong>Source:</strong> {log.potentialExposureSource}</p>}
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
};

const NLPAnalyzer = ({ userId, userProfile, allAllergens }) => {
  const [text, setText] = useState('');
  const [analysisResult, setAnalysisResult] = useState(null);
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
    setMessage("Analyzing text...");
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
          userAllergens: userProfile?.allergens || []
        }),
      });

      const data = await response.json();
      if (response.ok) {
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
          <h3 className="text-lg font-medium mb-3 text-gray-800">Analysis Results:</h3>
          {analysisResult.potential_allergy_issues.length > 0 ? (
            <div className="space-y-3">
              <p className="font-semibold text-red-600">Potential Allergy Issues Detected:</p>
              {analysisResult.potential_allergy_issues.map((issue, index) => (
                <div key={index} className="bg-red-50 border border-red-200 p-3 rounded-md">
                  <p className="font-medium text-red-700">Allergen: {allAllergens.find(a => a.id === issue.allergenId)?.name || issue.name}</p>
                  <p className="text-sm text-red-600">Type: {issue.type}</p>
                  <p className="text-sm text-red-600">Reason: {issue.reason}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-green-600 font-semibold">No direct allergy issues detected based on your profile and known allergens. Always exercise caution!</p>
          )}

          <div className="mt-4">
            <p className="font-semibold text-gray-700">Detected Ingredients (raw):</p>
            <p className="text-sm text-gray-600">{analysisResult.detected_ingredients.length > 0 ? analysisResult.detected_ingredients.join(', ') : 'None'}</p>
          </div>
        </div>
      )}
    </SectionCard>
  );
};

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

    card += `\nMy reaction to these allergens can be severe. Your careful attention to this is greatly appreciated.\n\nThank you!`;
    setChefCardText(card);
  };

  const copyToClipboard = () => {
    if (chefCardText) {
      // Use navigator.clipboard.writeText for modern browsers, fallback for older ones
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(chefCardText).then(() => {
          setMessage('Chef card copied to clipboard!');
          setTimeout(() => setMessage(''), 3000);
        }).catch(err => {
          console.error('Failed to copy text: ', err);
          // Fallback if writeText fails (e.g., due to permission issues)
          // You might want to show a simple prompt for manual copy
          setMessage('Failed to copy automatically. Please copy manually.');
          setTimeout(() => setMessage(''), 5000);
        });
      } else {
        // Fallback for older browsers (document.execCommand is deprecated)
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
      <textarea
        className="w-full p-3 border rounded-md mb-4 font-mono text-sm bg-gray-50"
        rows="12"
        readOnly
        value={chefCardText}
      ></textarea>
      <div className="flex space-x-4">
        <button
          onClick={generateCard}
          className="bg-blue-600 text-white px-6 py-2 rounded-full shadow-md hover:bg-blue-700 transition duration-300 ease-in-out"
        >
          Regenerate Card
        </button>
        <button
          onClick={copyToClipboard}
          className="bg-teal-600 text-white px-6 py-2 rounded-full shadow-md hover:bg-teal-700 transition duration-300 ease-in-out"
        >
          Copy to Clipboard
        </button>
      </div>
      <p className="text-xs text-gray-500 mt-2">Note: For multi-language support, you would integrate with a translation API.</p>
    </SectionCard>
  );
};

const EducationalResources = ({ userId, db }) => {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const resourcesCollectionRef = collection(db, 'educational_resources');
    const unsubscribe = onSnapshot(resourcesCollectionRef, (snapshot) => {
      const fetchedResources = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setResources(fetchedResources);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching educational resources:", error);
      setMessage(`Error fetching resources: ${error.message}`);
      setLoading(false);
    });

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
      {resources.length === 0 ? (
        <p className="text-gray-600">No educational resources available yet. (Admin can add them via Firestore console).</p>
      ) : (
        <div className="space-y-4 max-h-80 overflow-y-auto p-2 border rounded-md bg-gray-50">
          {resources.map(resource => (
            <div key={resource.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-800">{resource.title}</h3>
              <p className="text-sm text-gray-500 mb-2">Source: {resource.source}</p>
              <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: resource.content }}></div>
              {/* Note: For real Markdown rendering, use a library like 'marked' or 'react-markdown' */}
              {resource.allergensCovered && resource.allergensCovered.length > 0 && (
                <p className="text-xs text-gray-600 mt-2">Relevant Allergens: {resource.allergensCovered.join(', ')}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
};


const App = () => {
  const [user, setUser] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [allAllergens, setAllAllergens] = useState([]);
  const [activeTab, setActiveTab] = useState('profile'); // For navigation

  // Firebase Auth Listener and Initialization
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setUserId(currentUser.uid);
      } else {
        // Sign in anonymously if no initial token or user is not logged in
        try {
          // initialAuthToken is from Canvas environment and not applicable here directly
          // We removed the __initial_auth_token variable, so just sign in anonymously
          await signInAnonymously(auth);
        } catch (error) {
          console.error("Error signing in:", error);
          // Handle error, maybe show a message to the user
        }
      }
      setIsAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  // Fetch user profile and all allergens once authenticated
  useEffect(() => {
    if (isAuthReady && userId) {
      // Fetch user profile
      const userProfileRef = doc(db, `users/${userId}/profiles/user_profile`);
      const unsubscribeProfile = onSnapshot(userProfileRef, (docSnap) => {
        if (docSnap.exists()) {
          setUserProfile(docSnap.data());
        } else {
          setUserProfile(null); // No profile yet
        }
      }, (error) => {
        console.error("Error fetching user profile:", error);
      });

      // Fetch all allergens (public data)
      const allergensCollectionRef = collection(db, 'allergens');
      const unsubscribeAllergens = onSnapshot(allergensCollectionRef, (snapshot) => {
        const fetchedAllergens = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setAllAllergens(fetchedAllergens);
      }, (error) => {
        console.error("Error fetching all allergens:", error);
      });

      return () => {
        unsubscribeProfile();
        unsubscribeAllergens();
      };
    }
  }, [isAuthReady, userId, db]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setUserId(null);
      setUserProfile(null);
      console.log("User signed out.");
    } catch (error) {
      console.error("Error signing out:", error);
    }
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
        <nav className="mb-6 bg-white p-3 rounded-lg shadow-md flex justify-center space-x-4">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-5 py-2 rounded-full font-medium transition duration-300 ${activeTab === 'profile' ? 'bg-green-600 text-white shadow-lg' : 'text-gray-700 hover:bg-gray-100'}`}
          >
            My Profile
          </button>
          <button
            onClick={() => setActiveTab('log')}
            className={`px-5 py-2 rounded-full font-medium transition duration-300 ${activeTab === 'log' ? 'bg-green-600 text-white shadow-lg' : 'text-gray-700 hover:bg-gray-100'}`}
          >
            Symptom Log
          </button>
          <button
            onClick={() => setActiveTab('analyze')}
            className={`px-5 py-2 rounded-full font-medium transition duration-300 ${activeTab === 'analyze' ? 'bg-green-600 text-white shadow-lg' : 'text-gray-700 hover:bg-gray-100'}`}
          >
            Analyze Text
          </button>
          <button
            onClick={() => setActiveTab('chefcard')}
            className={`px-5 py-2 rounded-full font-medium transition duration-300 ${activeTab === 'chefcard' ? 'bg-green-600 text-white shadow-lg' : 'text-gray-700 hover:bg-gray-100'}`}
          >
            Chef Card
          </button>
          <button
            onClick={() => setActiveTab('education')}
            className={`px-5 py-2 rounded-full font-medium transition duration-300 ${activeTab === 'education' ? 'bg-green-600 text-white shadow-lg' : 'text-gray-700 hover:bg-gray-100'}`}
          >
            Education
          </button>
          {/* Add more tabs for Predictive Analytics, Alerts etc. */}
        </nav>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activeTab === 'profile' && (
            <div className="lg:col-span-2">
              <AllergenProfile
                userId={userId}
                db={db}
                userProfile={userProfile}
                setUserProfile={setUserProfile}
                allAllergens={allAllergens}
              />
            </div>
          )}
          {activeTab === 'log' && (
            <div className="lg:col-span-2">
              <SymptomLog userId={userId} db={db} />
            </div>
          )}
          {activeTab === 'analyze' && (
            <div className="lg:col-span-2">
              <NLPAnalyzer userId={userId} userProfile={userProfile} allAllergens={allAllergens} />
            </div>
          )}
          {activeTab === 'chefcard' && (
            <div className="lg:col-span-2">
              <ChefCardGenerator userId={userId} userProfile={userProfile} allAllergens={allAllergens} />
            </div>
          )}
          {activeTab === 'education' && (
            <div className="lg:col-span-2">
              <EducationalResources userId={userId} db={db} />
            </div>
          )}
          {/* Placeholder for other features */}
          {activeTab === 'profile' && (
            <SectionCard title="Quick Actions">
              <p className="text-gray-700 mb-4">Your User ID: <span className="font-semibold text-blue-600 break-all">{userId || 'N/A'}</span></p>
              <p className="text-gray-600 text-sm">Share this ID for collaborative features (if implemented).</p>
            </SectionCard>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default App;