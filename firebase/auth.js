// مراقبة حالة المصادقة والتحقق من الدور (معدلة لحل مشكلة السباق)
export function onAuthStateChange(callback) {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        // المستند موجود، نقرأ الدور منه
        callback({ uid: user.uid, email: user.email, ...userSnap.data() });
      } else {
        // المستند غير موجود (حدث سباق)، نقوم بإنشائه الآن
        await createUserDocument(user);
        const newUserSnap = await getDoc(userRef);
        if (newUserSnap.exists()) {
          callback({ uid: user.uid, email: user.email, ...newUserSnap.data() });
        } else {
          // في حال فشل إنشاء المستند، نعطيه دور افتراضي
          callback({ uid: user.uid, email: user.email, role: 'responder', name: 'مستخدم' });
        }
      }
    } else {
      callback(null);
    }
  });
}
