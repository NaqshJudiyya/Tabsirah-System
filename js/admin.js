// public/js/admin.js
import { db } from "../firebase/firebase-config.js";
import { onAuthStateChange } from "../firebase/auth.js";
import { 
  createForm, updateForm, getAllForms, getFormById,
  saveFormQuestions, saveEvaluationLevels, 
  getAllUsers, updateUserRole 
} from "../firebase/firestore-service.js";

// --- متغيرات الحالة ---
let currentFormId = null;
let currentQuestions = [];
let currentLevels = [];
let sortableInstance = null;

// --- التهيئة وحماية المسارات ---
onAuthStateChange((user) => {
  if (!user || user.role !== 'admin') {
    window.location.href = 'index.html'; // إعادة توجيه إذا لم يكن أدمن
  } else {
    loadForms();
    loadUsers();
    switchTab('forms'); // التبويب الافتراضي
  }
});

// --- التنقل بين التبويبات ---
window.switchTab = (tabName) => {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('bg-slate-700'));
  
  document.getElementById(`section-${tabName}`).classList.remove('hidden');
  document.getElementById(`tab-${tabName}`).classList.add('bg-slate-700');
};

// --- إدارة الاستمارات (عرض القائمة) ---
async function loadForms() {
  const forms = await getAllForms();
  const container = document.getElementById('forms-list');
  container.innerHTML = '';
  
  forms.forEach(form => {
    container.innerHTML += `
      <div class="card hover:shadow-xl transition">
        <h3 class="text-xl font-bold mb-2">${form.title}</h3>
        <p class="text-slate-500 text-sm mb-4">${form.description || 'لا يوجد وصف'}</p>
        <div class="flex justify-between items-center">
          <span class="px-2 py-1 rounded-full text-xs font-bold ${form.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}">
            ${form.status === 'published' ? 'منشورة' : 'مسودة'}
          </span>
          <div class="flex gap-2">
            <button onclick="editForm('${form.id}')" class="text-blue-500 hover:text-blue-700"><i class="fas fa-edit"></i></button>
            <button onclick="copyShareLink('${form.id}')" class="text-slate-500 hover:text-slate-700"><i class="fas fa-share-alt"></i></button>
          </div>
        </div>
      </div>
    `;
  });
}

// --- بنّاء الاستمارات (Form Builder) ---
window.openFormBuilder = () => {
  document.getElementById('form-builder-container').classList.remove('hidden');
  document.getElementById('forms-list').classList.add('hidden');
  document.getElementById('builder-title').textContent = 'إنشاء استمارة جديدة';
  resetBuilderState();
};

window.closeFormBuilder = () => {
  document.getElementById('form-builder-container').classList.add('hidden');
  document.getElementById('forms-list').classList.remove('hidden');
  loadForms(); // تحديث القائمة
};

function resetBuilderState() {
  currentFormId = null;
  currentQuestions = [];
  currentLevels = [];
  document.getElementById('form-title').value = '';
  document.getElementById('form-desc').value = '';
  renderQuestionsList();
  renderLevelsList();
}

// تعديل استمارة موجودة
window.editForm = async (formId) => {
  openFormBuilder();
  document.getElementById('builder-title').textContent = 'تعديل الاستمارة';
  currentFormId = formId;
  
  const form = await getFormById(formId);
  document.getElementById('form-title').value = form.title;
  document.getElementById('form-desc').value = form.description;
  
  // جلب الأسئلة والمستويات (مفترض أن الدالة تعيد الكولكشن الفرعي)
  const questionsSnap = await getDocs(collection(db, "forms", formId, "questions"));
  currentQuestions = questionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  currentQuestions.sort((a, b) => a.order - b.order);
  
  const levelsSnap = await getDocs(collection(db, "forms", formId, "evaluationLevels"));
  currentLevels = levelsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  renderQuestionsList();
  renderLevelsList();
};

// --- التعامل مع الأسئلة ---
window.handleQuestionTypeChange = () => {
  const type = document.getElementById('q-type').value;
  const optionsContainer = document.getElementById('options-container');
  
  // إظهار خيارات النقاط المخفية فقط لأنواع معينة
  if (['radio', 'checkbox', 'select'].includes(type)) {
    optionsContainer.classList.remove('hidden');
    document.getElementById('options-list').innerHTML = '';
    addOptionField(); // إضافة خيار افتراضي
  } else {
    optionsContainer.classList.add('hidden');
  }
};

window.addOptionField = () => {
  const list = document.getElementById('options-list');
  const div = document.createElement('div');
  div.className = 'flex gap-2 items-center';
  div.innerHTML = `
    <input type="text" placeholder="نص الخيار" class="flex-1 px-2 py-1 border rounded text-sm option-text">
    <input type="number" placeholder="النقاط" class="w-20 px-2 py-1 border rounded text-sm option-points">
    <button onclick="this.parentElement.remove()" class="text-red-500 text-sm"><i class="fas fa-trash"></i></button>
  `;
  list.appendChild(div);
};

window.addQuestion = () => {
  const label = document.getElementById('q-label').value.trim();
  const type = document.getElementById('q-type').value;
  const required = document.getElementById('q-required').checked;

  if (!label) return alert("الرجاء إدخال نص السؤال");

  const question = {
    id: generateUID(),
    type,
    label,
    required,
    options: []
  };

  // جمع الخيارات والنقاط إذا كان النوع يتطلب ذلك
  if (['radio', 'checkbox', 'select'].includes(type)) {
    const optionElements = document.querySelectorAll('#options-list > div');
    optionElements.forEach(el => {
      const text = el.querySelector('.option-text').value;
      const points = parseInt(el.querySelector('.option-points').value) || 0;
      if (text) question.options.push({ text, points });
    });
  } else if (type === 'linear_scale') {
    // مقياس خطي: النقاط تساوي القيمة المختارة تلقائياً
    question.options = { min: 1, max: 5, minLabel: "غير موافق", maxLabel: "موافق تماماً" };
  }

  currentQuestions.push(question);
  renderQuestionsList();
  
  // تنظيف الحقول
  document.getElementById('q-label').value = '';
  document.getElementById('q-required').checked = false;
};

function renderQuestionsList() {
  const list = document.getElementById('questions-list');
  list.innerHTML = '';
  
  currentQuestions.forEach((q, index) => {
    let optionsText = '';
    if (q.options && Array.isArray(q.options)) {
      optionsText = q.options.map(o => `${o.text} (${o.points}ن)`).join(' | ');
    } else if (q.type === 'linear_scale') {
      optionsText = `مقياس من ${q.options.min} إلى ${q.options.max}`;
    }

    list.innerHTML += `
      <li class="bg-slate-50 p-3 rounded-lg border flex justify-between items-center" data-id="${q.id}">
        <div>
          <span class="text-slate-400 ml-2">${index + 1}.</span>
          <span class="font-semibold">${q.label}</span>
          <span class="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full mr-2">${getTypeName(q.type)}</span>
          ${optionsText ? `<p class="text-xs text-slate-500 mr-8 mt-1">${optionsText}</p>` : ''}
        </div>
        <button onclick="removeQuestion('${q.id}')" class="text-red-400 hover:text-red-600"><i class="fas fa-trash-alt"></i></button>
      </li>
    `;
  });

  // تفعيل السحب والإفلات
  if (sortableInstance) sortableInstance.destroy();
  sortableInstance = new Sortable(list, {
    animation: 150,
    ghostClass: 'bg-blue-100',
    onEnd: function (evt) {
      const movedItem = currentQuestions.splice(evt.oldIndex, 1)[0];
      currentQuestions.splice(evt.newIndex, 0, movedItem);
    }
  });
}

window.removeQuestion = (id) => {
  currentQuestions = currentQuestions.filter(q => q.id !== id);
  renderQuestionsList();
};

function getTypeName(type) {
  const names = {
    text: 'نص', long_text: 'نص طويل', email: 'إيميل', number: 'رقم', date: 'تاريخ',
    time: 'وقت', radio: 'اختيار واحد', checkbox: 'متعدد', select: 'منسدلة',
    linear_scale: 'مقياس خطي', scale_matrix: 'مصفوفة', section_title: 'عنوان'
  };
  return names[type] || type;
}

// --- مستويات التقييم ---
window.addLevelField = () => {
  const level = { id: generateUID(), scoreMin: 0, scoreMax: 10, label: '', recommendation: '', color: '#ef4444' };
  currentLevels.push(level);
  renderLevelsList();
};

function renderLevelsList() {
  const list = document.getElementById('levels-list');
  list.innerHTML = '';
  currentLevels.forEach((lvl, index) => {
    list.innerHTML += `
      <div class="flex gap-2 items-center bg-white p-2 rounded border" data-id="${lvl.id}">
        <input type="number" value="${lvl.scoreMin}" class="w-16 px-2 py-1 border rounded text-sm lvl-min" placeholder="من">
        <input type="number" value="${lvl.scoreMax}" class="w-16 px-2 py-1 border rounded text-sm lvl-max" placeholder="إلى">
        <input type="text" value="${lvl.label}" class="flex-1 px-2 py-1 border rounded text-sm lvl-label" placeholder="اسم المستوى (مثال: منخفض)">
        <input type="text" value="${lvl.recommendation}" class="flex-1 px-2 py-1 border rounded text-sm lvl-rec" placeholder="التوصية">
        <input type="color" value="${lvl.color}" class="w-8 h-8 rounded cursor-pointer lvl-color">
        <button onclick="removeLevel('${lvl.id}')" class="text-red-500"><i class="fas fa-times"></i></button>
      </div>
    `;
  });
}

window.removeLevel = (id) => {
  currentLevels = currentLevels.filter(l => l.id !== id);
  renderLevelsList();
};

// --- حفظ ونشر الاستمارة ---
async function saveFormData(status) {
  const title = document.getElementById('form-title').value.trim();
  const description = document.getElementById('form-desc').value.trim();

  if (!title) return alert("الرجاء إدخال عنوان الاستمارة");

  // تحديث بيانات المستويات من الـ DOM
  const levelElements = document.querySelectorAll('#levels-list > div');
  levelElements.forEach(el => {
    const id = el.dataset.id;
    const lvl = currentLevels.find(l => l.id === id);
    if(lvl) {
      lvl.scoreMin = parseInt(el.querySelector('.lvl-min').value) || 0;
      lvl.scoreMax = parseInt(el.querySelector('.lvl-max').value) || 0;
      lvl.label = el.querySelector('.lvl-label').value;
      lvl.recommendation = el.querySelector('.lvl-rec').value;
      lvl.color = el.querySelector('.lvl-color').value;
    }
  });

  try {
    if (!currentFormId) {
      // إنشاء جديد
      currentFormId = await createForm({ title, description, status });
    } else {
      // تحديث موجود
      await updateForm(currentFormId, { title, description, status });
    }

    // حفظ الكولكشنات الفرعية
    await saveFormQuestions(currentFormId, currentQuestions);
    await saveEvaluationLevels(currentFormId, currentLevels);
    
    alert(status === 'published' ? "تم نشر الاستمارة بنجاح!" : "تم الحفظ كمسودة!");
    closeFormBuilder();
  } catch (error) {
    console.error(error);
    alert("حدث خطأ أثناء الحفظ: " + error.message);
  }
}

window.saveFormAsDraft = () => saveFormData('draft');
window.publishForm = () => saveFormData('published');

window.copyShareLink = (formId) => {
  const link = `${window.location.origin}/form_view.html?id=${formId}`;
  navigator.clipboard.writeText(link).then(() => {
    alert("تم نسخ رابط المشاركة!");
  });
};

// --- إدارة المستخدمين ---
async function loadUsers() {
  const users = await getAllUsers();
  const tbody = document.getElementById('users-table-body');
  tbody.innerHTML = '';
  
  users.forEach(user => {
    tbody.innerHTML += `
      <tr class="border-b hover:bg-slate-50">
        <td class="p-4 font-semibold">${user.name}</td>
        <td class="p-4 text-slate-600">${user.email || 'ضيف'}</td>
        <td class="p-4">
          <select onchange="changeRole('${user.uid}', this.value)" class="border rounded px-2 py-1 text-sm bg-white">
            <option value="responder" ${user.role === 'responder' ? 'selected' : ''}>مستجيب</option>
            <option value="counselor" ${user.role === 'counselor' ? 'selected' : ''}>مرشد</option>
            <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>مدير</option>
          </select>
        </td>
        <td class="p-4 text-slate-400 text-sm">${user.role === 'admin' ? 'مدير النظام' : 'مستخدم عادي'}</td>
      </tr>
    `;
  });
}

window.changeRole = async (uid, newRole) => {
  if (confirm("هل أنت متأكد من تغيير صلاحيات هذا المستخدم؟")) {
    await updateUserRole(uid, newRole);
    loadUsers();
  }
};

// --- تخصيص المظهر (Theme Customizer) ---
window.applyAndSaveTheme = async () => {
  const primary = document.getElementById('theme-primary').value;
  const secondary = document.getElementById('theme-secondary').value;
  const radius = document.getElementById('theme-radius').value + 'rem';

  // تطبيق فوري على الواجهة
  document.documentElement.style.setProperty('--primary-color', primary);
  document.documentElement.style.setProperty('--secondary-color', secondary);
  document.documentElement.style.setProperty('--border-radius', radius);

  // حفظ في Firestore (بافتراض أننا نحفظها في استمارة محددة أو إعدادات عامة)
  // للتبسيط، سنحفظها كإعدادات عامة في مستند خاص
  const configRef = doc(db, "settings", "theme");
  await setDoc(configRef, { primary, secondary, radius }, { merge: true });
  alert("تم حفظ المظهر بنجاح!");
};

// --- أدوات مساعدة ---
function generateUID() {
  return 'q_' + Math.random().toString(36).substr(2, 9);
}

// استيراد لدوال Firestore المباشرة المستخدمة في editForm
import { collection, getDocs, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";