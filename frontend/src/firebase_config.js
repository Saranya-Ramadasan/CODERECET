// frontend/src/firebase_config.js

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth"; // <--- ADD THIS LINE for Authentication
import { getFirestore } from "firebase/firestore"; // <--- ADD THIS LINE for Firestore Database
import { getAnalytics } from "firebase/analytics"; // Analytics is optional but good to have

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDU4otZZKDp4eBZDfrF8aArBtf_2W0JVI4",
  authDomain: "safebite01.firebaseapp.com",
  projectId: "safebite01",
  storageBucket: "safebite01.firebasestorage.app",
  messagingSenderId: "784674057740",
  appId: "1:784674057740:web:da4aedb9b9b5083d234829",
  measurementId: "G-YD4GKJM5JN" // Optional, can be removed if not using Analytics
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app); // Optional, can be removed if not using Analytics

// Initialize Firebase services used by your app
const auth = getAuth(app);      // <--- ADD THIS LINE for Authentication
const db = getFirestore(app);   // <--- ADD THIS LINE for Firestore Database

// Export the initialized services so other parts of your app can use them
export { app, auth, db, analytics }; // <--- MODIFY THIS LINE to export auth and db