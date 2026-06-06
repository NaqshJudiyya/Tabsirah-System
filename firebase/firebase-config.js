// firebase/firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAvWijotD3HlrQqHgLkhQP7toDtgbpcZN0",
  authDomain: "tabsirah-system.firebaseapp.com",
  projectId: "tabsirah-system",
  storageBucket: "tabsirah-system.firebasestorage.app",
  messagingSenderId: "685157900335",
  appId: "1:685157900335:web:de0f407afccf45644aa6da"
};

// تهيئة Firebase
const app = initializeApp(firebaseConfig);

// تصدير خدمات Firebase للاستخدام في باقي الملفات
export const auth = getAuth(app);
export const db = getFirestore(app);