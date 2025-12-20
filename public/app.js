// ★★★★★こっこ★★★★★
const API = location.origin.includes("render")
  ? location.origin
  : "http://localhost:3000";
// ★★★★★★★★★★★★★★★★★★★

const loginScreen = document.getElementById("loginScreen");
const appScreen = document.getElementById("appScreen");

const newBtn = document.getElementById("newBtn");
const loginBtn = document.getElementById("loginBtn");
const codeInput = document.getElementById("codeInput");

const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const saveBtn = document.getElementById("saveBtn");

const timerText = document.getElementById("timer");
const subjectList = document.getElementById("subjectList");
const subjectInput = document.getElementById("subjectInput");

const weeklyRemain = document.getElementById("weeklyRemain");
const levelText = document.getElementById("levelText");

let userId = null;
let startTime = null;
let selectedSubject = null;
let timerInterval = null;

/* ======== デバッグ表示 ======== */
function debug(msg) {
  console.log("[DEBUG]", msg);
}

/* ========= ログイン ========= */

newBtn.onclick = () => {
  debug("新規スタート押下");

  fetch(`${API}/api/login`, { method: "POST" })
    .then(res => {
      debug("レスポンス受信");
      return res.json();
    })
    .then(data => {
      debug("ユーザーID: " + data.userId);
      initApp(data.userId);
    })
    .catch(err => {
      alert("通信エラー。サーバーが起動していません");
      console.error(err);
    });
};

loginBtn.onclick = () => {
  fetch(`${API}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: codeInput.value })
  })
    .then(res => res.json())
    .then(data => initApp(data.userId));
};

function initApp(id) {
  userId = id;
  loginScreen.hidden = true;
  appScreen.hidden = false;
  loadSubjects();
  loadProfile();
}

/* ========= 科目 ========= */

function loadSubjects() {
  fetch(`${API}/api/subjects/${userId}`)
    .then(r => r.json())
    .then(list => {
      subjectList.innerHTML = "";
      list.forEach(s => {
        const li = document.createElement("li");
        li.textContent = s.name;
        li.onclick = () => selectedSubject = s.id;
        subjectList.appendChild(li);
      });
    });
}

document.getElementById("addSubjectBtn").onclick = () => {
  fetch(`${API}/api/subject`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, name: subjectInput.value })
  }).then(loadSubjects);
};

/* ========= タイマー ========= */

startBtn.onclick = () => {
  if (!selectedSubject) {
    alert("科目を選択してください");
    return;
  }

  startTime = Date.now();
  startBtn.disabled = true;
  stopBtn.disabled = false;

  timerInterval = setInterval(() => {
    const diff = Date.now() - startTime;
    const min = Math.floor(diff / 60000);
    const sec = Math.floor((diff % 60000) / 1000);
    timerText.textContent =
      `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }, 1000);
};

stopBtn.onclick = () => {
  clearInterval(timerInterval);
  stopBtn.disabled = true;
  saveBtn.hidden = false;
};

saveBtn.onclick = () => {
  const minutes = Math.floor((Date.now() - startTime) / 60000);

  fetch(`${API}/api/log`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId,
      subjectId: selectedSubject,
      minutes
    })
  }).then(() => {
    saveBtn.hidden = true;
    startBtn.disabled = false;
    timerText.textContent = "00:00";
    loadProfile();
  });
};

/* ========= プロフィール ========= */

function loadProfile() {
  fetch(`${API}/api/profile/${userId}`)
    .then(r => r.json())
    .then(p => {
      levelText.textContent = `Lv.${p.level} EXP:${p.exp}`;
      updateWeekly(p.weeklyTarget);
    });
}

/* ========= 週間目標 ========= */

function updateWeekly(target) {
  fetch(`${API}/api/logs/${userId}`)
    .then(r => r.json())
    .then(logs => {
      const now = new Date();
      const monday = new Date(now);
      monday.setDate(now.getDate() - now.getDay() + 1);

      let sum = 0;
      logs.forEach(l => {
        if (new Date(l.date) >= monday) sum += l.minutes;
      });

      const remain = Math.max(0, target - sum);
      weeklyRemain.textContent =
        `あと ${Math.floor(remain / 60)}時間 ${remain % 60}分`;
    });
}
