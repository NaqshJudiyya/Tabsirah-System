// firebase/auth.js - ملف المصادقة الكامل
import { auth, db } from "./firebase-config.js";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signInAnonymously, 
  onAuthStateChanged, 
  signOut,
  GoogleAuthProvider,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- دالة إنشاء مستند المستخدم (كانت ناقصة) ---
async function createUserDocument(user, additionalData = {}) {
  if (!user) return;
  
  const userRef = doc(db, "users", user.uid);
  const userData = {
    uid: user.uid,
    email: user.email,
    name: additionalData.name || user.displayName || 'مستخدم',
    role: additionalData.role || 'responder',
    createdAt: new Date().toISOString(),
    ...additionalData
  };
  
  try {
    await setDoc(userRef, userData, { merge: true });
    return userData;
  } catch (error) {
    console.error("خطأ في إنشاء مستند المستخدم:", error);
    throw error;
  }
}

// --- تسجيل الدخول بالبريد الإلكتروني (كانت ناقصة) ---
export async function loginWithEmail(email, password) {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    await createUserDocument(result.user);
    return result.user;
  } catch (error) {
    // ترجمة رسائل الخطأ إلى العربية
    let errorMessage = error.message;
    if (error.code === 'auth/user-not-found') {
      errorMessage = 'لم يتم العثور على حساب بهذا البريد الإلكتروني';
    } else if (error.code === 'auth/wrong-password') {
      errorMessage = 'كلمة المرور غير صحيحة';
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = 'صيغة البريد الإلكتروني غير صحيحة';
    } else if (error.code === 'auth/user-disabled') {
      errorMessage = 'تم تعطيل هذا الحساب';
    }
    const customError = new Error(errorMessage);
    customError.code = error.code;
    throw customError;
  }
}

// --- تسجيل حساب جديد (كانت ناقصة) ---
export async function registerWithEmail(email, password, name = 'مستخدم جديد') {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await createUserDocument(result.user, { name, role: 'responder' });
    return result.user;
  } catch (error) {
    let errorMessage = error.message;
    if (error.code === 'auth/email-already-in-use') {
      errorMessage = 'هذا البريد الإلكتروني مستخدم بالفعل';
    } else if (error.code === 'auth/weak-password') {
      errorMessage = 'كلمة المرور ضعيفة جداً (يجب أن تكون 6 أحرف على الأقل)';
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = 'صيغة البريد الإلكتروني غير صحيحة';
    }
    const customError = new Error(errorMessage);
    customError.code = error.code;
    throw customError;
  }
}

// --- تسجيل الدخول عبر Google (كانت ناقصة) ---
export async function loginWithGoogle() {
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    await createUserDocument(result.user, { role: 'responder' });
    return result.user;
  } catch (error) {
    let errorMessage = error.message;
    if (error.code === 'auth/popup-blocked') {
      errorMessage = 'تم منع نافذة تسجيل الدخول. يرجى السماح بالنوافذ المنبثقة.';
    } else if (error.code === 'auth/cancelled-popup-request') {
      errorMessage = 'تم إلغاء تسجيل الدخول';
    }
    const customError = new Error(errorMessage);
    customError.code = error.code;
    throw customError;
  }
}

// --- تسجيل الدخول كضيف (كانت ناقصة) ---
export async function loginAsGuest() {
  try {
    const result = await signInAnonymously(auth);
    await createUserDocument(result.user, { name: 'ضيف', role: 'guest' });
    return result.user;
  } catch (error) {
    const customError = new Error('فشل تسجيل الدخول كضيف');
    customError.code = error.code;
    throw customError;
  }
}

// --- تسجيل الخروج (كانت ناقصة) ---
export async function logout() {
  try {
    await signOut(auth);
    window.location.href = 'index.html';
  } catch (error) {
    console.error("خطأ في تسجيل الخروج:", error);
    throw new Error('فشل تسجيل الخروج');
  }
}

// --- مراقبة حالة المصادقة (محسّنة) ---
export function onAuthStateChange(callback) {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        callback({ uid: user.uid, email: user.email, ...userSnap.data() });
      } else {
        await createUserDocument(user);  // ← الآن الدالة موجودة!
        const newUserSnap = await getDoc(userRef);
        if (newUserSnap.exists()) {
          callback({ uid: user.uid, email: user.email, ...newUserSnap.data() });
        } else {
          callback({ uid: user.uid, email: user.email, role: 'responder', name: 'مستخدم' });
        }
      }
    } else {
      callback(null);
    }
  });
}
