/* =====================
   グローバル
===================== */
let userId = localStorage.getItem("userId");
let subjects = [];
let logs = [];
let profile = null;
let userInfo = null;
let chart;

/* =====================
   起動時処理
===================== */
if (userId) {
  loadAll().then(() => switchScreen("home"));
} else {
  switchScreen("start");
}

/* =====================
   認証
===================== */
async function newStart() {
  const nickname = prompt("ニックネームを入力してください");
  if (!nickname) return;

  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname })
    });

    if (!res.ok) throw new Error("login failed");

    const data = await res.json();
    userId = data.userId;
  } catch (e) {
    //  通信失敗時の保険
    console.warn("API login failed → local start", e);
    userId = "local_" + Date.now();
  }

  //  ここは必ず実行
  localStorage.setItem("userId", userId);
  localStorage.setItem("nickname", nickname);

  await loadAll();
  switchScreen("home");
}

async function login() {
  if (!codeInput.value) return;

  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: codeInput.value })
  });

  if (!res.ok) return alert("引き継ぎコードが見つかりません");

  const data = await res.json();
  userId = data.userId;
  localStorage.setItem("userId", userId);

  await loadAll();
  switchScreen("home");
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
  updateProfile();
  drawChart();
}

/* =====================
   画面制御
===================== */
function switchScreen(id) {
  document.querySelectorAll(".screen")
    .forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
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

function renderAI(d) {
  if (d.unlockComment) {
    aiOverall.textContent = "🔓 " + d.unlockComment;
  } else {
    aiOverall.textContent = d.overall;
  }
}

