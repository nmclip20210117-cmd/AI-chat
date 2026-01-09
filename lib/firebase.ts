// Ensure standard modular Firebase v9+ imports
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCkVqFZSunYewWFImn9B9PawkvieqLyjag",
  authDomain: "rina-ai-ebd9a.firebaseapp.com",
  projectId: "rina-ai-ebd9a",
  storageBucket: "rina-ai-ebd9a.firebasestorage.app",
  messagingSenderId: "674980418248",
  appId: "1:674980418248:web:5631e901730482bfa70bfd",
  measurementId: "G-3E3VBRHBBH"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);