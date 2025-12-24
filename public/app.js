let chart = null;
const logsModal = document.getElementById("logsModal");
const logsList = document.getElementById("logsList");
const editModal = document.getElementById("editModal");

const editSubject = document.getElementById("editSubject");
const editHour = document.getElementById("editHour");
const editMin = document.getElementById("editMin");

let editingIndex = null;

const manualHour = document.getElementById("manualHour");
const manualMin = document.getElementById("manualMin");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const saveBtn = document.getElementById("saveBtn");
const timer = document.getElementById("timer");
const subject = document.getElementById("subject");
const manualSubject = document.getElementById("manualSubject");
const weeklyGoalInput = document.getElementById("weeklyGoalInput");
const levelEl = document.getElementById("level");
const exp = document.getElementById("exp");
const expInfo = document.getElementById("expInfo");
const settings = document.getElementById("settings");
const profile = document.getElementById("profile");
const profileText = document.getElementById("profileText");

let code, data;
let startTime, timerInterval;

const fmt = s =>
  new Date(s * 1000).toISOString().substr(11, 8);

/* ---------- 初期 ---------- */

async function newStart() {
  const r = await fetch("/api/new", { method: "POST" });
  const j = await r.json();
  code = j.code;
  alert("引き継ぎコード：" + code);
  loadData(await fetchData());
}

async function load() {
  code = document.getElementById("codeInput").value;
  loadData(await fetchData());
}

async function fetchData() {
  const r = await fetch("/api/load", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code })
  });
  return r.json();
}

function loadData(d) {
  data = d;

  settings.style.display = "none";
  profile.style.display = "none";

  document.getElementById("start").hidden = true;
  document.getElementById("app").hidden = false;

  checkWeeklyReset();
  updateUI();
}

/* ---------- UI ---------- */
function updateUI() {
  subject.innerHTML =
    data.subjects.map(s => `<option>${s}</option>`).join("");

  manualSubject.innerHTML = subject.innerHTML;

  manualHour.value = "";
  manualMin.value = "";

  weeklyGoalInput.value = data.weeklyGoal;
  updateExp();
  drawChart();
  updateWeeklyInfo();
}

/* ---------- タイマー ---------- */

function start() {
  startTime = Date.now();

  document.getElementById("timerFull").style.display = "flex";

  timerInterval = setInterval(() => {
    const t = fmt((Date.now() - startTime) / 1000);
    timer.innerText = t;
    timerFullTime.innerText = t;
  }, 1000);

  toggle(true);
}

function stop() {
  clearInterval(timerInterval);
  document.getElementById("timerFull").style.display = "none";
  toggle(false);
}

function save() {
  const sec = Math.floor((Date.now() - startTime) / 1000);
  if (!subject.value) return alert("科目を選択してください");

  if (sec >= 60) addLog(subject.value, sec);
  reset();
}

/* ---------- 手動記録 ---------- */
function manualSave() {
  const h = +manualHour.value || 0;
  const m = +manualMin.value || 0;
  const sec = h * 3600 + m * 60;

  if (!manualSubject.value) return alert("科目を選択してください");
  if (sec < 60) return alert("1分以上入力してください");

  addLog(manualSubject.value, sec);

  // ✅ 入力クリア
  manualHour.value = "";
  manualMin.value = "";
}

/* ---------- ログ ---------- */

function addLog(subject, sec) {
  data.logs.push({
    subject,
    sec,
    date: new Date().toISOString().slice(0, 10)
  });
  gainExp(sec / 60);
  saveServer();
  updateUI();
}

/* ---------- EXP ---------- */
function gainExp(min) {
  const beforeLevel = calcLevel(data.exp);
  data.exp += min * 2;
  const afterLevel = calcLevel(data.exp);

  updateExp();

  if (afterLevel > beforeLevel) {
    showLevelUp(afterLevel - beforeLevel);
  }
}

function updateExp() {
  const level = calcLevel(data.exp);
  const next = nextLevelExp(level);
  const prev = nextLevelExp(level - 1) || 0;

  const percent = ((data.exp - prev) / (next - prev)) * 100;

  levelEl.innerText = `Lv.${level}`;
  exp.style.width = Math.min(100, percent) + "%";

  expInfo.innerText =
    `EXP ${Math.floor(data.exp)} / ${next}（次のLvまで ${Math.max(0, next - data.exp)}）`;
}

/* ---------- グラフ ---------- */
function drawChart() {
  chart?.destroy();

  const ctx = document.getElementById("chart");
  const aggregated = aggregateLogs(currentGraph);
  const labels = Object.keys(aggregated).slice(-7);

  const datasets = data.subjects.map(sub => ({
    label: sub,
    data: labels.map(l => aggregated[l]?.[sub] || 0),
    backgroundColor: subjectColors[sub] || "#555"
  }));

  chart = new Chart(ctx, {
    type: "bar",
    data: { labels, datasets },
    options: {
      responsive: true,
      plugins: {
        tooltip: {
          callbacks: {
            label: c => `${c.dataset.label}: ${c.raw.toFixed(2)}h`
          }
        }
      },
      scales: {
        x: { stacked: true },
        y: { stacked: true }
      }
    }
  });
}

/* ---------- 設定・プロフィール ---------- */

function openSettings() {
  settings.style.display = "flex";
}

function closeSettings() {
  settings.style.display = "none";
}

function openProfile() {
  settings.style.display = "none";   // ← 先に閉じる
  profile.style.display = "flex";

  profileText.innerText = `
ニックネーム：${data.nickname}
レベル：${Math.floor(Math.sqrt(data.exp / 30))}
総EXP：${data.exp}
最高連続日数：${data.maxStreak || 0}
合計時間：${Math.floor(data.logs.reduce((a,l)=>a+l.sec,0)/3600)}h
引き継ぎコード：${code}
`;
}

function closeProfile() {
  profile.style.display = "none";
}

/* ---------- 共通 ---------- */

function toggle(running) {
  startBtn.hidden = running;
  stopBtn.hidden = !running;
  saveBtn.hidden = running;
}

function reset() {
  timer.innerText = "00:00:00";
  toggle(false);
}

function saveServer() {
  fetch("/api/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, data })
  });
}

function aiEval() {
  alert("判定：B\n合格確率：72%\nこの調子で継続しよう！");
}

function getWeekEnd() {
  const now = new Date();
  const day = now.getDay(); // 日0〜土6
  const diff = 6 - day;
  const end = new Date(now);
  end.setDate(now.getDate() + diff);
  end.setHours(23, 59, 59, 999);
  return end;
}

function saveSettings() {
  if (data.weeklyGoalLocked && new Date() < new Date(data.weeklyGoalEnd)) {
    alert("今週の目標は変更できません");
    return;
  }

  data.weeklyGoal = +weeklyGoalInput.value;
  data.weeklyGoalEnd = getWeekEnd().toISOString();
  data.weeklyGoalLocked = true;

  saveServer();
  closeSettings();
  updateWeeklyInfo();
}

function updateWeeklyInfo() {
  const box = document.getElementById("weeklyInfo");
  if (!data.weeklyGoal) {
    box.innerText = "週目標：未設定";
    return;
  }

  const weekLogs = data.logs.filter(l => {
    const d = new Date(l.date);
    return d <= new Date(data.weeklyGoalEnd);
  });

  const usedMin = weekLogs.reduce((a,l)=>a+l.sec,0)/60;
  const remain = Math.max(0, data.weeklyGoal*60 - usedMin);

  const h = Math.floor(remain / 60);
  const m = Math.floor(remain % 60);

  box.innerHTML = `
    <h3>週目標 ${data.weeklyGoal}時間</h3>
    <p>残り ${h}時間 ${m}分</p>
  `;

  if (remain <= 0 && !data.weeklyCleared) {
    data.weeklyCleared = true;
    showWeeklyClear();
    saveServer();
  }
} // ← ★ これが抜けていた

function checkWeeklyReset() {
  if (data.weeklyGoalEnd && new Date() > new Date(data.weeklyGoalEnd)) {
    data.weeklyGoalLocked = false;
    data.weeklyGoalEnd = null;
    data.weeklyCleared = false; // ← 追加
    saveServer();
  }
}

function calcLevel(exp) {
  return Math.floor(Math.sqrt(exp / 30));
}

function nextLevelExp(level) {
  return (level + 1) ** 2 * 30;
}

function showLevelUp(count) {
  const overlay = document.getElementById("levelUp");
  overlay.style.pointerEvents = "auto";

  let i = 0;
  const loop = () => {
    if (i >= count) {
      overlay.style.pointerEvents = "none";
      return;
    }
    overlay.style.display = "flex";
    setTimeout(() => {
      overlay.style.display = "none";
      i++;
      setTimeout(loop, 300);
    }, 800);
  };
  loop();
}

function showWeeklyClear() {
  const overlay = document.getElementById("weeklyClear");
  overlay.style.pointerEvents = "auto";
  overlay.style.display = "flex";

  document.body.classList.add("flash");

  setTimeout(() => {
    overlay.style.display = "none";
    overlay.style.pointerEvents = "none";
    document.body.classList.remove("flash");
  }, 1200);
}

let currentGraph = "day";
const subjectColors = {
  "リスニング": "#4caf50",
  "リーディング": "#2196f3",
  "スピーキング": "#ff9800",
  "世界史": "#e91e63",
  "国語": "#9c27b0"
};

function changeGraph(type) {
  currentGraph = type;
  drawChart();
}

function aggregateLogs(type) {
  const result = {};
  const now = new Date();

  data.logs.forEach(l => {
    const d = new Date(l.date);
    let key;

    if (type === "day") {
      key = l.date;
    } else if (type === "week") {
      const w = new Date(d);
      w.setDate(d.getDate() - d.getDay());
      key = w.toISOString().slice(0,10);
    } else {
      key = `${d.getFullYear()}-${d.getMonth()+1}`;
    }

    result[key] ??= {};
    result[key][l.subject] = (result[key][l.subject] || 0) + l.sec / 3600;
  });

  return result;
}

function openLogs() {
  logsModal.style.display = "flex";
  renderLogs();
}

function closeLogs() {
  logsModal.style.display = "none";
}

function renderLogs() {
  logsList.innerHTML = "";

  data.logs
    .slice()
    .reverse()
    .forEach((l, i) => {
      const h = Math.floor(l.sec / 3600);
      const m = Math.floor((l.sec % 3600) / 60);

      const div = document.createElement("div");
      div.className = "log-item";
      div.innerHTML = `
        <strong>${l.subject}</strong>
        <span>${h}時間 ${m}分</span>
        <small>${l.date}</small>
      `;
      div.onclick = () => openEdit(data.logs.length - 1 - i);

      logsList.appendChild(div);
    });
}

function openEdit(index) {
  editingIndex = index;
  const log = data.logs[index];

  editSubject.innerHTML =
    data.subjects.map(s => `<option>${s}</option>`).join("");
  editSubject.value = log.subject;

  editHour.value = Math.floor(log.sec / 3600);
  editMin.value = Math.floor((log.sec % 3600) / 60);

  editModal.style.display = "flex";
}

function saveEdit() {
  if (editingIndex === null) return;

  const h = +editHour.value || 0;
  const m = +editMin.value || 0;
  const sec = h * 3600 + m * 60;

  if (sec < 60) return alert("1分以上にしてください");

  data.logs[editingIndex].subject = editSubject.value;
  data.logs[editingIndex].sec = sec;

  saveServer();
  updateUI();
  renderLogs();
  closeEdit();
}

function deleteLog() {
  if (editingIndex === null) return;
  if (!confirm("この記録を削除しますか？")) return;

  data.logs.splice(editingIndex, 1);

  saveServer();
  updateUI();
  renderLogs();
  closeEdit();
}

function closeEdit() {
  editModal.style.display = "none";
  editingIndex = null;
}
