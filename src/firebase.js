import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBrjEVudOxs6hluSBhUW71tPce7gVmQi8c",
  authDomain: "exam-routine-f6e4a.firebaseapp.com",
  projectId: "exam-routine-f6e4a",
  storageBucket: "exam-routine-f6e4a",
  messagingSenderId: "1071804348540",
  appId: "1:1071804348540:web:85802822ca1e7b2644f1f9",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
