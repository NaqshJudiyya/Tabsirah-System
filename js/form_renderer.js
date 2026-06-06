// public/js/form_renderer.js
import { auth, db } from "../firebase/firebase-config.js";
import { 
  registerWithEmail, loginWithGoogle, loginAsGuest, onAuthStateChange 
} from "../firebase/auth.js";
import { 
  getFormById, submitFormResponse 
} from "../firebase/firestore-service.js";
import { 
  collection, getDocs, query, orderBy 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- متغيرات الحالة ---
let currentForm = null;
let currentQuestions = [];
let currentLevels = [];
let currentUser = null;
let requiredFields = 0;

// --- عناصر DOM ---
const gateway = document.getElementById('auth-gateway');
const dynamicForm = document.getElementById('dynamic-form');
const submitSection = document.getElementById('submit-section');
const resultSection = document.getElementById('result-section');

// --- التهيئة والتحقق ---
onAuthStateChange(async (user) => {
  currentUser = user;
  if (user) {
    gateway.classList.add('hidden'); // إخفية بوابة المصادقة إذا مسجل الدخول
  }
  await initializeForm();
});

async function initializeForm() {
  const urlParams = new URLSearchParams(window.location.search);
  const formId = urlParams.get('id');

  if (!formId) {
    dynamicForm.innerHTML = '<div class="text-center text-red-500 text-xl">خطأ: لم يتم تحديد استمارة.</div>';
    return;
  }

  try {
    // جلب بيانات الاستمارة الأساسية
    currentForm = await getFormById(formId);
    if (!currentForm || currentForm.status !== 'published') {
      dynamicForm.innerHTML = '<div class="text-center text-red-500 text-xl">هذه الاستمارة غير متاحة أو لم يتم نشرها بعد.</div>';
      return;
    }

    // تطبيق إعدادات المظهر (Theme Customizer)
    if (currentForm.cssConfig) {
      document.documentElement.style.setProperty('--primary-color', currentForm.cssConfig.primary || '#2563eb');
      document.documentElement.style.setProperty('--secondary-color', currentForm.cssConfig.secondary || '#1e40af');
      document.documentElement.style.setProperty('--border-radius', currentForm.cssConfig.radius || '0.75rem');
    }

    document.getElementById('form-title-display').textContent = currentForm.title;
    document.getElementById('form-desc-display').textContent = currentForm.description || '';

    // جلب الأسئلة ومستويات التقييم
    const qSnap = await getDocs(query(collection(db, "forms", formId, "questions"), orderBy("order")));
    currentQuestions = qSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const lSnap = await getDocs(collection(db, "forms", formId, "evaluationLevels"));
    currentLevels = lSnap.docs.map(doc => doc.data());

    renderFormQuestions();
    
  } catch (error) {
    console.error(error);
    dynamicForm.innerHTML = '<div class="text-center text-red-500">حدث خطأ أثناء تحميل الاستمارة.</div>';
  }
}

// --- بناء نموذج الأسئلة ديناميكياً ---
function renderFormQuestions() {
  dynamicForm.innerHTML = '';
  requiredFields = 0;

  currentQuestions.forEach((q, index) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'card mb-4';
    wrapper.dataset.qid = q.id;

    // عنوان القسم الفاصل
    if (q.type === 'section_title') {
      wrapper.innerHTML = `<h3 class="text-xl font-bold text-blue-600 border-b pb-2" style="font-family: var(--font-heading);">${q.label}</h3>`;
      dynamicForm.appendChild(wrapper);
      return;
    }

    let inputHTML = '';
    const reqStar = q.required ? '<span class="text-red-500">*</span>' : '';
    if (q.required) requiredFields++;

    switch (q.type) {
      case 'text':
      case 'email':
      case 'number':
      case 'date':
      case 'time':
        inputHTML = `<input type="${q.type}" name="${q.id}" class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" ${q.required ? 'required' : ''}>`;
        break;
      case 'long_text':
        inputHTML = `<textarea name="${q.id}" rows="4" class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" ${q.required ? 'required' : ''}></textarea>`;
        break;
      case 'radio':
        inputHTML = q.options.map(opt => `
          <label class="flex items-center gap-2 p-2 hover:bg-slate-50 rounded-lg cursor-pointer">
            <input type="radio" name="${q.id}" value="${opt.text}" data-points="${opt.points}" class="w-4 h-4 text-blue-600" ${q.required ? 'required' : ''}>
            <span>${opt.text}</span>
          </label>
        `).join('');
        break;
      case 'checkbox':
        // في الـ Checkbox، الـ required يتم التحقق منها يدوياً أو عبر JS
        inputHTML = q.options.map(opt => `
          <label class="flex items-center gap-2 p-2 hover:bg-slate-50 rounded-lg cursor-pointer">
            <input type="checkbox" name="${q.id}" value="${opt.text}" data-points="${opt.points}" class="w-4 h-4 text-blue-600 rounded">
            <span>${opt.text}</span>
          </label>
        `).join('');
        break;
      case 'select':
        inputHTML = `<select name="${q.id}" class="w-full px-4 py-2 border rounded-lg bg-white" ${q.required ? 'required' : ''}>
          <option value="">-- اختر --</option>
          ${q.options.map(opt => `<option value="${opt.text}" data-points="${opt.points}">${opt.text}</option>`).join('')}
        </select>`;
        break;
      case 'linear_scale':
        inputHTML = `
          <div class="flex justify-between items-center w-full">
            <span class="text-sm text-slate-500">${q.options.minLabel}</span>
            ${Array.from({length: (q.options.max - q.options.min + 1)}, (_, i) => i + q.options.min).map(val => `
              <label class="flex flex-col items-center gap-1 cursor-pointer">
                <input type="radio" name="${q.id}" value="${val}" class="w-4 h-4 text-blue-600" ${q.required ? 'required' : ''}>
                <span class="text-sm">${val}</span>
              </label>
            `).join('')}
            <span class="text-sm text-slate-500">${q.options.maxLabel}</span>
          </div>`;
        break;
    }

    wrapper.innerHTML = `
      <label class="block font-bold text-slate-700 mb-2">${index + 1}. ${q.label} ${reqStar}</label>
      <div class="space-y-2">${inputHTML}</div>
      <p class="text-xs text-red-400 hidden mt-2 error-msg">هذا الحقل إلزامي</p>
    `;
    
    dynamicForm.appendChild(wrapper);
  });

  // إضافة مستمعي أحداث لتحديث شريط التقدم
  dynamicForm.querySelectorAll('input, select, textarea').forEach(el => {
    el.addEventListener('input', updateProgressBar);
    el.addEventListener('change', updateProgressBar);
  });

  submitSection.classList.remove('hidden');
  updateProgressBar();
}

// --- شريط التقدم الديناميكي ---
function updateProgressBar() {
  let filledCount = 0;
  // التحقق من الحقول الإلزامية المملوءة
  const uniqueRequiredIds = new Set(currentQuestions.filter(q => q.required).map(q => q.id));
  
  uniqueRequiredIds.forEach(qid => {
    const elements = dynamicForm.querySelectorAll(`[name="${qid}"]`);
    let isFilled = false;

    if (elements[0].type === 'checkbox') {
      elements.forEach(cb => { if(cb.checked) isFilled = true; });
    } else if (elements[0].type === 'radio') {
      elements.forEach(rb => { if(rb.checked) isFilled = true; });
    } else {
      if (elements[0].value.trim() !== '') isFilled = true;
    }

    if (isFilled) filledCount++;
  });

  const progress = uniqueRequiredIds.size === 0 ? 100 : Math.round((filledCount / uniqueRequiredIds.size) * 100);
  document.getElementById('progress-bar').style.width = progress + '%';
  document.getElementById('progress-text').textContent = progress + '%';
}

// --- المصادقة السريعة من بوابة الاستمارة ---
document.getElementById('btn-gw-register').addEventListener('click', async () => {
  const name = document.getElementById('gw-name').value.trim();
  const email = document.getElementById('gw-email').value.trim();
  const pass = document.getElementById('gw-password').value.trim();
  
  if (!name || !email || !pass) {
    document.getElementById('gw-error').textContent = "الرجاء تعبئة جميع الحقول.";
    document.getElementById('gw-error').classList.remove('hidden');
    return;
  }
  try {
    await registerWithEmail(email, pass, name);
  } catch (err) {
    document.getElementById('gw-error').textContent = err.message;
    document.getElementById('gw-error').classList.remove('hidden');
  }
});

document.getElementById('btn-gw-guest').addEventListener('click', async () => {
  try { await loginAsGuest(); } catch (err) { alert(err.message); }
});

document.getElementById('btn-gw-login-google').addEventListener('click', async () => {
  try { await loginWithGoogle(); } catch (err) { alert(err.message); }
});

// --- إرسال الاستمارة ومنطق النقاط المخفية ---
document.getElementById('btn-submit-form').addEventListener('click', async () => {
  if (!currentUser) {
    alert("الرجاء تسجيل الدخول أولاً من البوابة أعلاه.");
    gateway.classList.remove('hidden');
    return;
  }

  // 1. التحقق من صحة المدخلات
  if (!validateForm()) return;

  // 2. حساب النقاط المخفية
  const { answers, totalScore } = calculateScores();

  // 3. مطابقة مستوى التقييم
  const matchedLevel = currentLevels.find(lvl => totalScore >= lvl.scoreMin && totalScore <= lvl.scoreMax) || { label: "غير محدد", color: "#6b7280", recommendation: "" };

  // 4. الإرسال إلى Firestore عبر Batch Write
  document.getElementById('btn-submit-form').disabled = true;
  document.getElementById('btn-submit-form').innerHTML = '<i class="fas fa-spinner fa-spin ml-2"></i>جاري الحفظ...';

  try {
    await submitFormResponse(currentForm.id, currentUser.uid, answers, totalScore, matchedLevel.id || null);
    
    // إخفاء النموذج وإظهار النتيجة
    dynamicForm.classList.add('hidden');
    submitSection.classList.add('hidden');
    showResult(totalScore, matchedLevel);

  } catch (error) {
    console.error(error);
    alert("حدث خطأ أثناء حفظ الإجابات.");
    document.getElementById('btn-submit-form').disabled = false;
    document.getElementById('btn-submit-form').innerHTML = '<i class="fas fa-paper-plane ml-2"></i>إرسال الاستمارة';
  }
});

// --- التحقق من الحقول الإلزامية ---
function validateForm() {
  let isValid = true;
  const errorMessages = dynamicForm.querySelectorAll('.error-msg');
  errorMessages.forEach(msg => msg.classList.add('hidden'));

  currentQuestions.forEach(q => {
    if (!q.required) return;
    const wrapper = dynamicForm.querySelector(`[data-qid="${q.id}"]`);
    const elements = dynamicForm.querySelectorAll(`[name="${q.id}"]`);
    let filled = false;

    if (q.type === 'checkbox') {
      elements.forEach(cb => { if(cb.checked) filled = true; });
    } else if (q.type === 'radio') {
      elements.forEach(rb => { if(rb.checked) filled = true; });
    } else if (q.type === 'select') {
      if(elements[0].value !== '') filled = true;
    } else {
      if(elements[0].value.trim() !== '') filled = true;
    }

    if (!filled) {
      isValid = false;
      wrapper.querySelector('.error-msg').classList.remove('hidden');
    }
  });

  if (!isValid) alert("الرجاء تعبئة جميع الحقول الإلزامية المميزة بنجمة (*)");
  return isValid;
}

// --- حساب النقاط المخفية (خوارزمية حرجة) ---
function calculateScores() {
  let totalScore = 0;
  let answers = [];

  currentQuestions.forEach(q => {
    if (q.type === 'section_title') return;

    let pointsAwarded = 0;
    let value = null;
    const elements = dynamicForm.querySelectorAll(`[name="${q.id}"]`);

    switch (q.type) {
      case 'radio':
        elements.forEach(rb => {
          if (rb.checked) {
            pointsAwarded = parseInt(rb.dataset.points) || 0;
            value = rb.value;
          }
        });
        break;
      
      case 'checkbox':
        value = [];
        elements.forEach(cb => {
          if (cb.checked) {
            pointsAwarded += parseInt(cb.dataset.points) || 0;
            value.push(cb.value);
          }
        });
        break;

      case 'select':
        const sel = elements[0];
        const selectedOpt = sel.options[sel.selectedIndex];
        if (sel.value) {
          pointsAwarded = parseInt(selectedOpt.dataset.points) || 0;
          value = sel.value;
        }
        break;

      case 'linear_scale':
        elements.forEach(rb => {
          if (rb.checked) {
            // في المقياس الخطي، القيمة نفسها هي النقطة
            pointsAwarded = parseInt(rb.value);
            value = rb.value;
          }
        });
        break;

      default:
        // أنواع النصوص والتواريخ لا تحتوي على نقاط
        value = elements[0].value.trim();
        break;
    }

    totalScore += pointsAwarded;
    answers.push({
      questionId: q.id,
      value: value,
      pointsAwarded: pointsAwarded
    });
  });

  return { answers, totalScore };
}

// --- عرض النتيجة وتوليد بطاقة المشاركة ---
function showResult(totalScore, level) {
  resultSection.classList.remove('hidden');
  document.getElementById('res-total-score').textContent = totalScore;
  
  const levelBadge = document.getElementById('res-level-label');
  levelBadge.textContent = level.label;
  levelBadge.style.backgroundColor = level.color;

  document.getElementById('res-recommendation').textContent = level.recommendation;

  // تعبئة البطاقة المخفية للتصدير
  document.getElementById('sc-form-title').textContent = currentForm.title;
  document.getElementById('sc-score').textContent = totalScore + " نقطة";
  document.getElementById('sc-level-badge').textContent = level.label;
  document.getElementById('sc-level-badge').style.backgroundColor = level.color;
  document.getElementById('sc-name').textContent = currentUser.name || "مستجيب";
}

// تحميل البطاقة كصورة PNG
document.getElementById('btn-download-card').addEventListener('click', () => {
  const cardElement = document.getElementById('share-card-capture');
  
  // إظهار العنصر مؤقتاً خارج الشاشة لالتقاطه
  cardElement.style.left = '0';
  cardElement.style.position = 'relative';

  html2canvas(cardElement, { 
    scale: 2, // جودة عالية
    useCORS: true 
  }).then(canvas => {
    const link = document.createElement('a');
    link.download = `tabassura-result-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    
    // إعادة إخفاء العنصر
    cardElement.style.left = '-9999px';
    cardElement.style.position = 'absolute';
  }).catch(err => {
    console.error("خطأ في إنشاء الصورة:", err);
    alert("حدث خطأ أثناء إنشاء بطاقة النتيجة.");
    cardElement.style.left = '-9999px';
    cardElement.style.position = 'absolute';
  });
});