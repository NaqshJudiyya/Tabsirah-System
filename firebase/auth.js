// firebase/auth.js
import { auth, db } from "./firebase-config.js";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signInAnonymously, 
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, setDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const ADMIN_EMAIL = "NaqshJudiyya@gmail.com"; // البريد الإلكتروني للمدير الافتراضي

// إنشاء أو تحديث مستند المستخدم في Firestore
async function createUserDocument(user, additionalData = {}) {
  if (!user) return;
  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    const { email, displayName } = user;
    const role = email === ADMIN_EMAIL ? "admin" : (additionalData.role || "responder");
    
    try {
      await setDoc(userRef, {
        uid: user.uid,
        name: displayName || additionalData.name || "مستخدم جديد",
        email: email || additionalData.email || null,
        role: role,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error("خطأ في إنشاء مستند المستخدم:", error);
    }
  }
  return userRef;
}

// تسجيل الدخول بالبريد الإلكتروني وكلمة المرور (للمستجيبين السريع)
export async function registerWithEmail(email, password, name) {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await createUserDocument(userCredential.user, { name, email });
    return userCredential.user;
  } catch (error) {
    throw new Error(getArabicError(error.code));
  }
}

// تسجيل الدخول بحساب جوجل
export async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    await createUserDocument(result.user);
    return result.user;
  } catch (error) {
    throw new Error(getArabicError(error.code));
  }
}

// تسجيل الدخول كضيف مجهول
export async function loginAsGuest() {
  try {
    const result = await signInAnonymously(auth);
    await createUserDocument(result.user, { name: "ضيف", role: "responder" });
    return result.user;
  } catch (error) {
    throw new Error(getArabicError(error.code));
  }
}

// تسجيل الدخول بالبريد الإلكتروني (للمشرفين)
export async function loginWithEmail(email, password) {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return result.user;
  } catch (error) {
    throw new Error(getArabicError(error.code));
  }
}

// مراقبة حالة المصادقة والتحقق من الدور
export function onAuthStateChange(callback) {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        callback({ ...user, role: userDoc.data().role, name: userDoc.data().name });
      } else {
        callback(user);
      }
    } else {
      callback(null);
    }
  });
}

// تسجيل الخروج
export async function logout() {
  await signOut(auth);
  window.location.href = "index.html";
}

// ترجمة أخطاء Firebase للعربية
function getArabicError(code) {
  const errors = {
    "auth/email-already-in-use": "هذا البريد الإلكتروني مستخدم بالفعل.",
    "auth/invalid-email": "صيغة البريد الإلكتروني غير صحيحة.",
    "auth/weak-password": "كلمة المرور ضعيفة (يجب أن تكون 6 أحرف على الأقل).",
    "auth/user-not-found": "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
    "auth/wrong-password": "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
    "auth/popup-closed-by-user": "تم إغلاق نافذة تسجيل الدخول."
  };
  return errors[code] || "حدث خطأ غير متوقع. حاول مرة أخرى.";
}