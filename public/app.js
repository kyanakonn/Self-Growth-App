const API_BASE = ""; // 同一オリジン（Render）なので空でOK

const startScreen = document.getElementById("startScreen");
const homeScreen = document.getElementById("homeScreen");
const newStartBtn = document.getElementById("newStartBtn");
const userIdText = document.getElementById("userIdText");

// ===== 初期処理 =====
const savedUserId = localStorage.getItem("userId");
if (savedUserId) {
  showHome(savedUserId);
}

// ===== 新規スタート =====
newStartBtn.addEventListener("click", async () => {
  try {
    const res = await fetch(`${API_BASE}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });

    if (!res.ok) throw new Error("login failed");

    const data = await res.json();
    localStorage.setItem("userId", data.userId);
    showHome(data.userId);

  } catch (e) {
    alert("通信エラーが発生しました");
    console.error(e);
  }
});

// ===== 画面切り替え =====
function showHome(userId) {
  startScreen.classList.remove("active");
  homeScreen.classList.add("active");
  userIdText.textContent = `ユーザーID: ${userId}`;
}

// ===== ログアウト =====
function logout() {
  localStorage.removeItem("userId");
  location.reload();
}
