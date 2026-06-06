// public/js/app.js
import { 
  loginWithEmail, 
  loginWithGoogle, 
  loginAsGuest, 
  onAuthStateChange 
} from "../firebase/auth.js";

// عناصر DOM
const btnEmailLogin = document.getElementById('btn-email-login');
const btnGoogleLogin = document.getElementById('btn-google-login');
const btnGuestLogin = document.getElementById('btn-guest-login');
const emailInput = document.getElementById('email-input');
const passwordInput = document.getElementById('password-input');
const errorMsg = document.getElementById('error-message');

// عرض الأخطاء للمستخدم
function showError(message) {
  errorMsg.textContent = message;
  errorMsg.classList.remove('hidden');
  setTimeout(() => errorMsg.classList.add('hidden'), 4000);
}

// التحقق من صحة المدخلات قبل الإرسال
function validateEmailInputs() {
  const email = emailInput.value.trim();
  const pass = passwordInput.value.trim();
  
  if (!email || !pass) {
    showError("الرجاء إدخال البريد الإلكتروني وكلمة المرور.");
    return null;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showError("صيغة البريد الإلكتروني غير صحيحة.");
    return null;
  }
  if (pass.length < 6) {
    showError("كلمة المرور يجب أن تكون 6 أحرف على الأقل.");
    return null;
  }
  return { email, pass };
}

// مستمعي الأحداث (Event Listeners)
btnEmailLogin.addEventListener('click', async () => {
  const inputs = validateEmailInputs();
  if (!inputs) return;
  
  btnEmailLogin.disabled = true;
  btnEmailLogin.innerHTML = '<i class="fas fa-spinner fa-spin ml-2"></i>جاري الدخول...';
  
  try {
    await loginWithEmail(inputs.email, inputs.pass);
    // التوجيه سيتم تلقائياً عبر onAuthStateChange
  } catch (error) {
    showError(error.message);
  } finally {
    btnEmailLogin.disabled = false;
    btnEmailLogin.innerHTML = '<i class="fas fa-sign-in-alt ml-2"></i>دخول بالبريد الإلكتروني';
  }
});

btnGoogleLogin.addEventListener('click', async () => {
  try {
    await loginWithGoogle();
  } catch (error) {
    showError(error.message);
  }
});

btnGuestLogin.addEventListener('click', async () => {
  try {
    await loginAsGuest();
  } catch (error) {
    showError(error.message);
  }
});

// --- حماية المسارات والتوجيه (Route Guarding) ---
onAuthStateChange((user) => {
  const currentPath = window.location.pathname;
  
  // التحقق مما إذا كنا في الصفحة الرئيسية (تسجيل الدخول)
  const isLoginPage = currentPath.endsWith('index.html') || currentPath.endsWith('/tabassura-system/') || currentPath === '/';
  
  if (isLoginPage) {
    if (user) {
      if (user.role === 'admin' || user.role === 'counselor') {
        window.location.href = 'dashboard.html';
      } else {
        // المستجيب العادي يتم توجيهه لقائمة الاستمارات (سنتركه يذهل لصفحة الاستمارات كحل مؤقت)
        window.location.href = 'form_view.html';
      }
    }
  } else {
    // إذا كان في صفحة محمية ولم يسجل الدخول، أعهده للصفحة الرئيسية
    if (!user) {
      window.location.href = 'index.html';
    }
  }
});
