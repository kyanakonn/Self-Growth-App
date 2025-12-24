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

/* =====================
   起動時
===================== */
document.addEventListener("DOMContentLoaded", async () => {
  if (userId) {
    switchScreen("home");
    await loadAll();
  } else {
    switchScreen("start");
  }
});

/* =====================
   認証
===================== */
async function newStart() {
  const nickname = prompt("ニックネームを入力してください");
  if (!nickname) return;

  localStorage.setItem("nickname", nickname);

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

async function login() {
  if (!codeInput.value) return;

  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: codeInput.value })
  });

  if (!res.ok) return alert("引き継ぎ失敗");

  const data = await res.json();
  userId = data.userId;
  localStorage.setItem("userId", userId);

  switchScreen("home");
  await loadAll();
}

/* =====================
   初期ロード
===================== */
async function loadAll() {
  subjects = await fetch(`/api/subjects/${userId}`).then(r => r.json());
  logs = await fetch(`/api/logs/${userId}`).then(r => r.json());
  profile = await fetch(`/api/profile/${userId}`).then(r => r.json());
  userInfo = await fetch(`/api/user/${userId}`).then(r => r.json());

  renderSubjects();
  initChart();
  drawChart();
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
   科目追加
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

/* =====================
   科目描画
===================== */
function renderSubjects() {
  manualSubject.innerHTML = "";
  timerSubject.innerHTML = "";

  subjects.forEach(s => {
    manualSubject.add(new Option(s.name, s.id));
    timerSubject.add(new Option(s.name, s.id));
  });
}

/* =====================
   グラフ
===================== */
function initChart() {
  chart = new Chart(document.getElementById("chart"), {
    type: "bar",
    data: { labels: [], datasets: [{ label: "分", data: [] }] }
  });
}

function changeMode(mode) {
  chartMode = mode;
  drawChart();
}

function drawChart() {
  const map = {};
  logs.forEach(l => {
    const key = chartMode === "day" ? l.date : l.date.slice(0,7);
    map[key] = (map[key] || 0) + l.minutes;
  });

  chart.data.labels = Object.keys(map);
  chart.data.datasets[0].data = Object.values(map);
  chart.update();
}

/* =====================
   ⏱ タイマー
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

async function saveTimer() {
  if (timerMinutes <= 0) return;

  await fetch("/api/log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId,
      subjectId: timerSubject.value,
      minutes: timerMinutes
    })
  });

  await loadAll();
  switchScreen("home");
}

/* =====================
   🤖 AI分析（進化版）
===================== */
async function openAI() {
  switchScreen("ai");

  const res = await fetch("/api/ai-analysis", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId })
  });

  const data = await res.json();

  const progress = data.progress;
  let tone =
    progress < 10 ? "よく始めたね。ここから一緒に積み上げよう。" :
    progress < 40 ? "基礎は整ってきた。次は精度だ。" :
    progress < 70 ? "完全に受験生上位層。勝ち切る段階だ。" :
    "ここまで来た。合格は現実だ。";

  aiOverall.textContent = tone + " " + data.overall;

  /* 連続日数セリフ解放 */
  if (data.streak >= 30) {
    aiOverall.textContent += " 🔓《継続者の領域》";
  } else if (data.streak >= 7) {
    aiOverall.textContent += " 🔓《習慣化達成》";
  }

  aiSubjects.innerHTML = "";

  /* 弱点警告（早稲田商） */
  const warn = [];

  data.analysis.forEach(a => {
    if (a.subject.includes("リーディング") || a.subject.includes("リスニング")) {
      if (a.minutes < 60) warn.push("⚠️ 英語が不足しています");
    }
    if (a.subject === "国語" && a.minutes < 30) {
      warn.push("⚠️ 国語の演習量が不足");
    }
    if (a.subject === "歴史" && a.minutes < 20) {
      warn.push("⚠️ 世界史の接触頻度が低い");
    }

    aiSubjects.innerHTML += `
      <div class="card">
        <b>${a.subject}</b><br>
        ${a.minutes}分<br>
        ${a.comment}
      </div>
    `;
  });

  if (warn.length) {
    aiSubjects.innerHTML =
      `<div class="card" style="border:2px solid red">
        <b>🚨 商学部弱点警告</b><br>${warn.join("<br>")}
       </div>` + aiSubjects.innerHTML;
  }
}
