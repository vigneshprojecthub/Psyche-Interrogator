import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';

const firebaseConfig = {
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, process.env.VITE_FIREBASE_DATABASE_ID);

// Initialize Anonymous Auth
signInAnonymously(auth).catch(err => console.error("Auth failed:", err));

// Connection test
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. The client is offline.");
    }
    // Skip logging for other errors (e.g., permission denied is expected if 'test' collection doesn't exist)
  }
}
testConnection();
