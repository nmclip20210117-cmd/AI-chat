
// Standard modular Firebase v9+ configuration
// Fix: Use named imports from 'firebase/app' to resolve TypeScript errors.
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCkVqFZSunYewWFImn9B9PawkvieqLyjag",
  authDomain: "rina-ai-ebd9a.firebaseapp.com",
  projectId: "rina-ai-ebd9a",
  storageBucket: "rina-ai-ebd9a.firebasestorage.app",
  messagingSenderId: "674980418248",
  appId: "1:674980418248:web:5631e901730482bfa70bfd",
  measurementId: "G-3E3VBRHBBH"
};

// Initialize Firebase with the modular SDK functions.
// We use getApps() to check for existing instances to prevent re-initialization errors during development hot reloads.
// Using named imports for initializeApp, getApps and getApp as per Firebase v9+ standards.
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Export Auth and Firestore services initialized with the app instance
export const auth = getAuth(app);
export const db = getFirestore(app);
