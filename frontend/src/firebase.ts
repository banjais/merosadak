// frontend/src/firebase.ts
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";

// --------------------
// Firebase config (all keys intentionally empty for frontend)
// --------------------
const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
  measurementId: "",
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);

// Optional: services
export const auth = getAuth(firebaseApp);
export const storage = getStorage(firebaseApp);
export const analytics = getAnalytics(firebaseApp);

// Named and default export
export { firebaseApp };
export default firebaseApp;
