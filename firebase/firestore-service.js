// firebase/firestore-service.js
import { db } from "./firebase-config.js";
import { 
  collection, doc, addDoc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, 
  query, where, orderBy, serverTimestamp, writeBatch 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- عمليات الاستمارات (Forms CRUD) ---
export async function createForm(formData) {
  try {
    const docRef = await addDoc(collection(db, "forms"), {
      ...formData,
      status: "draft",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    console.error("خطأ في إنشاء الاستمارة:", error);
    throw error;
  }
}

export async function updateForm(formId, formData) {
  try {
    const formRef = doc(db, "forms", formId);
    await updateDoc(formRef, {
      ...formData,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error("خطأ في تحديث الاستمارة:", error);
    throw error;
  }
}

export async function getFormById(formId) {
  const docSnap = await getDoc(doc(db, "forms", formId));
  return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
}

export async function getAllForms() {
  const q = query(collection(db, "forms"), orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// --- عمليات الأسئلة ومستويات التقييم ---
export async function saveFormQuestions(formId, questions) {
  const batch = writeBatch(db);
  const questionsRef = collection(db, "forms", formId, "questions");
  
  // حذف الأسئلة القديمة أولاً (طريقة مبسطة، في الإنتاج الكامل يتم مقارنة الـ IDs لتوفير العمليات)
  const existingQuestions = await getDocs(questionsRef);
  existingQuestions.forEach(doc => batch.delete(doc.ref));
  
  // إضافة الأسئلة الجديدة
  questions.forEach((q, index) => {
    const newDocRef = doc(questionsRef);
    batch.set(newDocRef, { ...q, order: index });
  });

  await batch.commit();
}

export async function saveEvaluationLevels(formId, levels) {
  const batch = writeBatch(db);
  const levelsRef = collection(db, "forms", formId, "evaluationLevels");
  
  const existingLevels = await getDocs(levelsRef);
  existingLevels.forEach(doc => batch.delete(doc.ref));
  
  levels.forEach(level => {
    const newDocRef = doc(levelsRef);
    batch.set(newDocRef, level);
  });

  await batch.commit();
}

// --- عمليات إرسال الاستجابة (Submission with Batch Write) ---
export async function submitFormResponse(formId, userId, answers, totalScore, evaluationLevelId) {
  const batch = writeBatch(db);
  
  // 1. إنشاء مستند الاستجابة الأساسي
  const responseRef = doc(collection(db, "responses"));
  batch.set(responseRef, {
    formId: formId,
    userId: userId,
    totalScore: totalScore,
    evaluationLevelId: evaluationLevelId,
    createdAt: serverTimestamp()
  });

  // 2. إنشاء مستندات الإجابات الفرعية
  answers.forEach(answer => {
    // ✅ الطريقة الصحيحة: استخدام المسار الكامل
    const answerRef = doc(collection(db, "responses", responseRef.id, "answers"));
    //                              ^^                  ^^^^^^^^^^^^
    //                        قاعدة البيانات          معرف المستند الأب
    //
    // هذا ينشئ المسار: db → responses → {responseId} → answers → {newAnswerId}
    
    batch.set(answerRef, {
      questionId: answer.questionId,
      value: answer.value,
      pointsAwarded: answer.pointsAwarded
    });
  });

  await batch.commit();
  return responseRef.id;
}

// --- عمليات المستخدمين ---
export async function getAllUsers() {
  const snapshot = await getDocs(collection(db, "users"));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function updateUserRole(uid, newRole) {
  const userRef = doc(db, "users", uid);
  await updateDoc(userRef, { role: newRole });
}
