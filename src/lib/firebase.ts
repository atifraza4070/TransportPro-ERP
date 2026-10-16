import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Auth
export const auth = getAuth(app);
export const googleAuthProvider = new GoogleAuthProvider();

// Initialize Firestore
const customDbId = (firebaseConfig as Record<string, any>).firestoreDatabaseId;
export const db = customDbId
  ? getFirestore(app, customDbId)
  : getFirestore(app);

// Connection test helper per skill requirement
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client offline, utilizing persistent local storage fallback.');
      return false;
    }
    return true;
  }
}
