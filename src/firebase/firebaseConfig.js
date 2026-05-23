import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const required = (value, name) => {
    if (!value) {
        console.error(`[StockHere] Missing Firebase env: ${name}. Add it to your .env file.`);
    }
    return value;
};

const firebaseConfig = {
    apiKey: required(import.meta.env.VITE_FIREBASE_API_KEY, "VITE_FIREBASE_API_KEY"),
    authDomain: required(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN, "VITE_FIREBASE_AUTH_DOMAIN"),
    projectId: required(import.meta.env.VITE_FIREBASE_PROJECT_ID, "VITE_FIREBASE_PROJECT_ID"),
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

function getFirebaseApp() {
    if (getApps().length > 0) {
        return getApp();
    }
    return initializeApp(firebaseConfig);
}

const app = getFirebaseApp();

export const db = getFirestore(app);
export const auth = getAuth(app);
