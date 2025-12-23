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
document.addEventListener("DOMContentLoaded", async () => {
  if (userId) {
    // ★ 先に画面を切り替える（重要）
    switchScreen("home");
    try {
      await loadAll();
    } catch (e) {
      console.warn("startup load failed", e);
    }
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

  // ★ 入力直後に最新ニックネームを確定
  localStorage.setItem("nickname", nickname);
  userInfo = { nickname };

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
    console.warn("API login failed → local start", e);
    userId = "local_" + Date.now();
  }

  localStorage.setItem("userId", userId);

  // ★ 必ず画面遷移
  switchScreen("home");

  try {
    await loadAll();
  } catch (e) {
    console.warn("loadAll failed but continue", e);
  }
}

async function login() {
  const codeInput = document.getElementById("codeInput");
  if (!codeInput || !codeInput.value) return;

  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: codeInput.value })
    });

    if (!res.ok) return alert("引き継ぎコードが見つかりません");

    const data = await res.json();
    userId = data.userId;
    localStorage.setItem("userId", userId);

    switchScreen("home");
    await loadAll();
  } catch (e) {
    alert("ログインに失敗しました");
    console.error(e);
  }
}

/* =====================
   初期ロード
===================== */
async function loadAll() {
  try {
    subjects = await fetch(`/api/subjects/${userId}`).then(r => r.json());
    logs = await fetch(`/api/logs/${userId}`).then(r => r.json());
    profile = await fetch(`/api/profile/${userId}`).then(r => r.json());
    userInfo = await fetch(`/api/user/${userId}`).then(r => r.json());
  } catch (e) {
    console.warn("API load failed → fallback", e);

    // フォールバック（既存機能保持）
    subjects = subjects || [];
    logs = logs || [];
    profile = profile || {
      level: 1,
      exp: 0,
      totalMinutes: 0,
      streak: 0,
      maxStreak: 0
    };

    // ★ 常に最新 nickname を使用
    userInfo = {
      nickname: localStorage.getItem("nickname") || "未設定"
    };
  }

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
  const target = document.getElementById(id);
  if (target) target.classList.add("active");
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
   AI表示
===================== */
function renderAI(d) {
  if (!d) return;
  aiOverall.textContent =
    d.unlockComment ? "🔓 " + d.unlockComment : d.overall;
}
