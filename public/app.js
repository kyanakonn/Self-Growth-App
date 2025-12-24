/* =====================
   グローバル
===================== */
let userId = localStorage.getItem("userId");
let subjects = [];
let logs = [];
let profile = null;
let userInfo = null;
let chart;
let chartMode = "day";

/* タイマー */
let timerStart = null;
let timerInterval = null;
let timerMinutes = 0;

/* 初期科目（削除不可） */
const BASE_SUBJECTS = ["リスニング","リーディング","スピーキング","世界史","国語"];

/* =====================
   起動時（重要）
===================== */
document.addEventListener("DOMContentLoaded", initApp);

async function initApp() {
  bindButtons();

  if (userId) {
    switchScreen("home");
    await loadAll();
  } else {
    switchScreen("start");
  }
}

/* =====================
   ボタン反応保証
===================== */
function bindButtons() {
  document.getElementById("profileBtn")?.addEventListener("click", goProfile);
  document.getElementById("homeBtn")?.addEventListener("click", goHome);
  document.getElementById("aiBtn")?.addEventListener("click", openAI);
}

/* =====================
   認証
===================== */
async function newStart() {
  const nickname = prompt("ニックネームを入力してください");
  if (!nickname) return;

  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nickname })
  });

  const data = await res.json();
  userId = data.userId;
  localStorage.setItem("userId", userId);

  switchScreen("home");
  await loadAll();
}

/* =====================
   初期ロード（順序厳守）
===================== */
async function loadAll() {
  subjects = await fetch(`/api/subjects/${userId}`).then(r => r.json());
  logs = await fetch(`/api/logs/${userId}`).then(r => r.json());
  profile = await fetch(`/api/profile/${userId}`).then(r => r.json());
  userInfo = await fetch(`/api/user/${userId}`).then(r => r.json());

  renderSubjects();          
  renderSubjectManage();     
  initChart();               
  updateProfile();
}

/* =====================
   画面制御
===================== */
function switchScreen(id) {
  document.querySelectorAll(".screen")
    .forEach(s => s.classList.remove("active"));
  document.getElementById(id)?.classList.add("active");
}

function goProfile() {
  if (!profile || !userInfo) return;

  pNickname.textContent = userInfo.nickname;
  pLevel.textContent = profile.level;
  pExp.textContent = profile.exp;
  pTime.textContent = (profile.totalMinutes / 60).toFixed(1);
  pCode.textContent = userId;
  pStreak.textContent = profile.streak;
  pMaxStreak.textContent = profile.maxStreak;

  switchScreen("profile");
}

function goHome() {
  switchScreen("home");
}

/* =====================
   プロフィール反映
===================== */
function updateProfile() {
  level.textContent = profile.level;
  const need = profile.level * profile.level * 20;
  expFill.style.width =
    Math.min(100, (profile.exp / need) * 100) + "%";
}

/* =====================
   手動記録
===================== */
async function manualSave() {
  const subjectId = manualSubject.value;
  const minutes = Number(h.value) * 60 + Number(m.value);
  if (!subjectId || minutes <= 0) return;

  await fetch("/api/log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, subjectId, minutes })
  });

  h.value = m.value = "";
  await loadAll();
}

/* =====================
   科目追加・削除
===================== */
async function addSubject() {
  if (!newSub.value.trim()) return;

  await fetch("/api/subject", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, name: newSub.value })
  });

  newSub.value = "";
  await loadAll();
}

async function deleteSubject(id) {
  if (!confirm("この科目を削除しますか？")) return;
  await fetch(`/api/subject/${id}`, { method: "DELETE" });
  await loadAll();
}

/* =====================
   科目描画（初期5科目完全反映）
===================== */
function renderSubjects() {
  manualSubject.innerHTML = "";
  timerSubject.innerHTML = "";

  subjects.forEach(s => {
    manualSubject.add(new Option(s.name, s.id));
    timerSubject.add(new Option(s.name, s.id));
  });
}

function renderSubjectManage() {
  subjectManage.innerHTML = "";

  subjects.forEach(s => {
    const canDelete = !BASE_SUBJECTS.includes(s.name);

    subjectManage.innerHTML += `
      <div class="card">
        ${s.name}
        ${canDelete
          ? `<button onclick="deleteSubject('${s.id}')">削除</button>`
          : `<span class="lock">固定</span>`
        }
      </div>
    `;
  });
}

/* =====================
   グラフ
===================== */
function initChart() {
  const colors = [
    "#2563eb","#16a34a","#dc2626","#9333ea","#ea580c","#0f172a"
  ];

  const labels = [...new Set(logs.map(l => l.date))];

  const datasets = subjects.map((s, i) => ({
    label: s.name,
    backgroundColor: colors[i % colors.length],
    data: labels.map(d =>
      logs
        .filter(l => l.date === d && l.subjectId === s.id)
        .reduce((a,b) => a + b.minutes, 0)
    )
  }));

  if (chart) chart.destroy();

  chart = new Chart(chartEl, {
    type: "bar",
    data: { labels, datasets },
    options: {
      responsive: true,
      scales: { x: { stacked: true }, y: { stacked: true } }
    }
  });
}

/* =====================
   タイマー
===================== */
function openTimer() {
  timerMinutes = 0;
  timerText.textContent = "0:00";
  startBtn.classList.remove("hidden");
  stopBtn.classList.add("hidden");
  saveBtn.classList.add("hidden");
  switchScreen("timerFull");
}

function startTimer() {
  timerStart = Date.now();
  startBtn.classList.add("hidden");
  stopBtn.classList.remove("hidden");

  timerInterval = setInterval(() => {
    const sec = Math.floor((Date.now() - timerStart) / 1000);
    timerText.textContent =
      Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0");
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerMinutes = Math.floor((Date.now() - timerStart) / 60000);
  stopBtn.classList.add("hidden");
  saveBtn.classList.remove("hidden");
}

/* ===== タイマー保存（1分未満OK） ===== */
async function saveTimer() {
  if (timerMinutes >= 1) {
    await fetch("/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        subjectId: timerSubject.value,
        minutes: timerMinutes
      })
    });
  }

  switchScreen("home");
  await loadAll();
}

/* =====================
   模擬AI評価（即時）
===================== */
async function openAI() {
  switchScreen("ai");

  const res = await fetch("/api/ai-analysis", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId })
  });

  const d = await res.json();

  aiOverall.innerHTML = `
    <p>🔥 streak：${d.streak} 日</p>
    <p>📚 合計：${Math.floor(d.totalMinutes / 60)} 時間</p>
    <p>🧠 評価：${d.phrase}</p>
  `;
}
