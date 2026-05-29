// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";

// TODO: Replace the following with your app's Firebase project configuration
// 1. Go to Firebase Console -> Project Settings
// 2. Scroll down to "Your apps" and copy the firebaseConfig object
const firebaseConfig = {
  apiKey: "AIzaSyC_aepuWttTfSJEl3t9j6-eo0BCKiigZyA",
  authDomain: "fir-fb6bc.firebaseapp.com",
  databaseURL: "https://fir-fb6bc-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "fir-fb6bc",
  storageBucket: "fir-fb6bc.firebasestorage.app",
  messagingSenderId: "578170956644",
  appId: "1:578170956644:web:4f28fddd5ed0b64a17a871"
};

// Initialize Firebase
let app;
let db;
let auth;

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
  console.log("Firebase initialized successfully");
} catch (error) {
  console.error("Error initializing Firebase: ", error);
  console.warn("Please ensure you have added your Firebase config in firebase-config.js");
}

export { db, auth };
