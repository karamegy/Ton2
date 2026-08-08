import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

// إعدادات Firebase الخاصة بك
const firebaseConfig = {
  apiKey: "AIzaSyAekw5iD-7t-BeRbrVBykXNWqtY0C7y7ug",
  authDomain: "tarazan-284f3.firebaseapp.com",
  projectId: "tarazan-284f3",
  storageBucket: "tarazan-284f3.firebasestorage.app",
  messagingSenderId: "382519802983",
  appId: "1:382519802983:web:c5826a8cdba73335a528c2",
  measurementId: "G-KCRSY63RTC"
};

// تهيئة الخدمة وقاعدة البيانات
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// جلب معرف اللاعب المسجل دخولاً (وفي حال لم يسجل الدخول يتم توجيهه لبوابة الدخول)
const playerId = localStorage.getItem("current_player_uid");

if (!playerId) {
    alert("يرجى تسجيل الدخول أولاً للوصول إلى إمبراطوريتك!");
    window.location.href = "auth.html";
}

// هيكل البيانات الافتراضي للإمبراطورية
let empireData = {
    gold: 2500,
    wood: 1500,
    stone: 1200,
    food: 3000,
    gems: 500,
    might: 12500,
    heroesCount: 3,
    castleLvl: 1
};

// تحديث واجهة المستخدم بالقيم الحالية
function updateUI() {
    document.getElementById('gold').innerText = empireData.gold;
    document.getElementById('wood').innerText = empireData.wood;
    document.getElementById('stone').innerText = empireData.stone;
    document.getElementById('food').innerText = empireData.food;
    document.getElementById('gems').innerText = empireData.gems;
    document.getElementById('might').innerText = empireData.might;
    document.getElementById('lord-lvl').innerText = `المستوى ${empireData.castleLvl}`;
}

// دالة كتابة السجلات
function logEvent(msg) {
    const box = document.getElementById('gameLog');
    if (box) {
        box.innerHTML += `<br>` + msg;
        box.scrollTop = box.scrollHeight;
    }
}

// حفظ البيانات سحابياً في Firestore بناءً على معرف الحساب الحقيقي
async function saveGameData() {
    try {
        await setDoc(doc(db, "empires", playerId), empireData);
    } catch (error) {
        console.error("خطأ في حفظ البيانات سحابياً: ", error);
    }
}

// جلب وحفظ البيانات عند بدء التشغيل
async function loadGameData() {
    try {
        const docSnap = await getDoc(doc(db, "empires", playerId));
        if (docSnap.exists()) {
            empireData = docSnap.data();
            updateUI();
            logEvent("☁️ [تم التحميل]: استرجاع بيانات إمبراطوريتك من سحابة Firebase بنجاح.");
        } else {
            logEvent("⚡ [إنشاء ملف]: لا توجد بيانات سابقة، جارٍ إنشاء ملف الإمبراطورية الجديد...");
            await saveGameData();
            updateUI();
        }
    } catch (error) {
        logEvent("⚠️ [خطأ اتصال]: تعذر الاتصال بقاعدة البيانات السحابية.");
        console.error(error);
        updateUI();
    }
}

// أزرار ووظائف اللعبة الفاعلة مع الحفظ التلقائي
window.gatherResources = function() {
    let g = 300 * empireData.castleLvl;
    empireData.gold += g;
    updateUI();
    saveGameData();
    logEvent(`[الموارد]: تمت جباية الإقليم بنجاح (+${g} ذهب).`);
};

window.upgradeCastle = function() {
    let cost = 1000 * empireData.castleLvl;
    if (empireData.gold >= cost) {
        empireData.gold -= cost;
        empireData.castleLvl++;
        empireData.might += 2500;
        updateUI();
        saveGameData();
        logEvent(`[القلعة]: تمت ترقية القلعة إلى المستوى (${empireData.castleLvl}) وحفظ التقدم سحابياً!`);
    } else {
        logEvent(`[خطأ]: الذهب غير كافٍ للترقية. تحتاج إلى ${cost} ذهب.`);
    }
};

window.summonHero = function() {
    if (empireData.gems >= 200) {
        empireData.gems -= 200;
        empireData.heroesCount++;
        empireData.might += 1200;
        updateUI();
        saveGameData();
        logEvent(`🦸‍♂️ [الأبطال]: تم استدعاء بطل أسطوري جديد بنجاح!`);
    } else {
        logEvent(`[خطأ]: الجواهر غير كافية للاستدعاء.`);
    }
};

window.trainTroops = function(name, cost, mightAdd, count) {
    if (empireData.gold >= cost) {
        empireData.gold -= cost;
        empireData.might += mightAdd;
        updateUI();
        saveGameData();
        logEvent(`⚔️ [الثكنات]: تم تدريب (${count} من ${name}) وانضموا للجيش.`);
    } else {
        logEvent(`[خطأ]: الذهب غير كافٍ للتدريب.`);
    }
};

window.huntMonster = function(name) {
    let gemsWin = 30;
    empireData.gems += gemsWin;
    empireData.might += 200;
    updateUI();
    saveGameData();
    logEvent(`🐉 [صيد الوحوش]: تم القضاء على (${name}) واغتنام +${gemsWin} جوهرة.`);
};

window.launchKingdomWar = function() {
    if (empireData.might < 5000) {
        logEvent(`⚠️ [حرب]: قوة جيشك منخفضة، قم بالتطوير أولاً.`);
        return;
    }
    let loot = 1000;
    empireData.gold += loot;
    updateUI();
    saveGameData();
    logEvent(`🏆 [انتصار]: تم سحق دفاعات العدو في حرب الممالك وغنم +${loot} ذهب وتم الحفظ السحابي.`);
};

// بدء التشغيل وتحميل السحابة فوراً
window.onload = function() {
    loadGameData();
};
