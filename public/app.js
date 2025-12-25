let chart = null;
const nicknameText = document.getElementById("nicknameText");
const timerFullTime = document.getElementById("timerFullTime");
const nicknameInput = document.getElementById("nicknameInput");
const dailyGoalInput = document.getElementById("dailyGoalInput");
const dailyGoalEl = document.getElementById("dailyGoalText");
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
const levelEl = document.getElementById("levelText");
const exp = document.getElementById("exp");
const expInfo = document.getElementById("expInfo");
const settings = document.getElementById("settings");
const profile = document.getElementById("profile");
const profileText = document.getElementById("profileText");
const weeklyGoalEl = document.getElementById("weeklyGoalText");
let dailyGoalMinutes = 0; // 1日の目標（分）
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

  // ★ これを追加
  data.exp ??= 0;
  data.logs ??= [];
  data.subjects ??= [];
  data.nickname ??= "Player";

  settings.style.display = "none";
  profile.style.display = "none";

  document.getElementById("start").hidden = true;
  document.getElementById("app").hidden = false;

  checkWeeklyReset();
  checkDailyReset();
  updateUI();
}

/* ---------- UI ---------- */
function updateUI() {
  nicknameText.innerText = data.nickname || "Player";

  subject.innerHTML =
    data.subjects.map(s => `<option>${s}</option>`).join("");

  manualSubject.innerHTML = subject.innerHTML;

  manualHour.value = "";
  manualMin.value = "";

  weeklyGoalInput.value = data.weeklyGoal;

  updateExp();
  drawChart();
  updateWeeklyInfo();
  updateGoalsUI();
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

function deleteLog() {
  if (editingIndex === null) return;
  if (!confirm("この記録を削除しますか？")) return;

  const sec = data.logs[editingIndex].sec;
  const diffExp = -(sec / 60) * 2;

  data.logs.splice(editingIndex, 1);

  if (data.exp + diffExp < 0) {
    data.exp = 0;
  } else {
    animateExpDiff(diffExp);
  }

  saveServer();
  updateUI();
  renderLogs();
  closeEdit();
}
/* ---------- EXP ---------- */
function gainExp(min) {
  const beforeLevel = calcLevel(data.exp);
  data.exp += min * 2;
+ showExpFloat(min * 2);
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

  let percent = ((data.exp - prev) / (next - prev)) * 100;
  if (!Number.isFinite(percent)) percent = 0;

  levelEl.innerText = `Lv.${level}`;
  exp.style.width = Math.min(100, percent) + "%";

  expInfo.innerText =
    `EXP ${Math.floor(data.exp)} / ${next}（次のLvまで ${Math.max(0, next - data.exp)}）`;
}

function animateExpDiff(diffExp) {
  if (diffExp === 0) return;

  const steps = 30;
  const step = diffExp / steps;
  let current = 0;

  const beforeLevel = calcLevel(data.exp);

  // ✅ EXPフロートは最初に1回だけ
  showExpFloat(diffExp);

  exp.classList.add("exp-animate");
  setTimeout(() => exp.classList.remove("exp-animate"), 300);

  const interval = setInterval(() => {
    data.exp += step;

    // ✅ EXPは0未満禁止
    if (data.exp < 0) data.exp = 0;

    current += step;
    updateExp();

    if (
      (step > 0 && current >= diffExp) ||
      (step < 0 && current <= diffExp)
    ) {
      clearInterval(interval);

      // ✅ 最終補正
      data.exp = Math.max(0, Math.round(data.exp));
      updateExp();

      const afterLevel = calcLevel(data.exp);
      if (afterLevel > beforeLevel) {
        showLevelUp(afterLevel - beforeLevel);
      }
    }
  }, 30);
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
  settings.style.display = "none";
  profile.style.display = "flex";

  // 🔹 現在のニックネームを入力欄へ
  nicknameInput.value = data.nickname || "";

profileText.innerText = `
ニックネーム：${data.nickname}
レベル：${calcLevel(data.exp)}
総EXP：${Math.floor(data.exp)}

日目標達成率：${calcAchievementRate(data.dailyGoalHistory)}
週目標達成率：${calcAchievementRate(data.weeklyGoalHistory)}

日目標連続達成：${data.dailyStreak || 0}日
週目標連続達成：${data.weeklyStreak || 0}週

合計時間：${Math.floor(
  data.logs.reduce((a,l)=>a+l.sec,0)/3600
)}h

引き継ぎコード：${code}
`;
}

function closeProfile() {
  profile.style.display = "none";
}

function saveNickname() {
  const input = document.getElementById("nicknameInput");
  const name = input.value.trim();

  data.nickname = name || "Player";

  saveServer();

  // ✅ 即反映
  nicknameText.innerText = data.nickname;

  updateUI(); // 念のため全体も更新
}

function saveGoals() {
  const today = new Date().toISOString().slice(0, 10);
  const d = Number(dailyGoalInput.value);

  // すでに今日設定済みならブロック
  if (data.dailyGoalDate === today) {
    alert("日目標は1日1回まで設定できます");
    return;
  }

  if (d > 0) {
    data.dailyGoalMinutes = d * 60;
    data.dailyGoalDate = today;
  }

  saveServer();
  closeSettings();
  updateUI();
}

function updateGoalsUI() {
  const today = new Date().toISOString().slice(0, 10);

  const dailyGoalMinutes = data.dailyGoalMinutes || 0;
  const todayMinutes = getTodayTotalMinutes();

  // 日付が変わったら解除
  if (data.dailyGoalDate !== today) {
    data.dailyGoalMinutes = 0;
    data.dailyGoalDate = null;
    dailyGoalInput.disabled = false;
  } else {
    dailyGoalInput.disabled = true;
  }

  const dailyRemain = Math.max(0, dailyGoalMinutes - todayMinutes);

  dailyGoalEl.textContent =
  dailyGoalMinutes > 0
    ? `日目標 残り ${h}時間 ${m}分（${data.dailyStreak || 0}日連続達成）`
    : "日目標 未設定";

  // 🎉 クリア演出
  if (dailyGoalMinutes > 0 && dailyRemain <= 0 && !data.dailyCleared) {
    data.dailyCleared = true;
    showDailyClear();
    saveServer();
  }
}

function onDailyGoalCleared() {
  const today = new Date().toISOString().slice(0, 10);

  data.dailyGoalHistory ??= {};

  if (!data.dailyGoalHistory[today]) {
    data.dailyGoalHistory[today] = true;
    data.dailyStreak = (data.dailyStreak || 0) + 1;
  }

  saveServer();
}

function showDailyClear() {
  const o = document.getElementById("dailyClearOverlay");
  if (o.style.display === "flex") return;

  o.style.display = "flex";
  document.body.classList.add("flash");

  setTimeout(() => {
    o.style.display = "none";
    document.body.classList.remove("flash");
  }, 1200);
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
  <h3>
    週目標 ${data.weeklyGoal}時間
    <small>（${data.weeklyStreak || 0}週連続達成）</small>
  </h3>
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
  if (!Number.isFinite(exp) || exp <= 0) return 0;
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

function onWeeklyGoalCleared() {
  const now = new Date();
  const weekKey =
    `${now.getFullYear()}-W${getWeekNumber(now)}`;

  data.weeklyGoalHistory ??= {};

  if (!data.weeklyGoalHistory[weekKey]) {
    data.weeklyGoalHistory[weekKey] = true;
    data.weeklyStreak = (data.weeklyStreak || 0) + 1;
  }

  saveServer();
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

function getWeekNumber(d) {
  const firstDay = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(
    ((d - firstDay) / 86400000 + firstDay.getDay() + 1) / 7
  );
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
  const newSec = h * 3600 + m * 60;

  if (newSec < 60) return alert("1分以上にしてください");

  const log = data.logs[editingIndex];
  const oldSec = log.sec;

  // 🔥 差分EXP計算
  const diffMin = (newSec - oldSec) / 60;
  const diffExp = diffMin * 2;

  log.subject = editSubject.value;
  log.sec = newSec;

  // ⭐ EXP差分アニメーション
  if (diffExp !== 0) {
    animateExpDiff(diffExp);
  }

  saveServer();
  updateUI();
  renderLogs();
  closeEdit();
}

function closeEdit() {
  editModal.style.display = "none";
  editingIndex = null;
}

function getTodayTotalMinutes() {
  const today = new Date().toISOString().slice(0, 10);

  return data.logs
    .filter(l => l.date === today)
    .reduce((sum, l) => sum + l.sec, 0) / 60;
}

function getThisWeekTotalMinutes() {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  return data.logs
    .filter(l => new Date(l.date) >= startOfWeek)
    .reduce((sum, l) => sum + l.sec, 0) / 60;
}

function showExpFloat(diffExp) {
  const div = document.createElement("div");
  div.className = "exp-float";

  const sign = diffExp > 0 ? "+" : "";
  div.textContent = `${sign}${Math.round(diffExp)} EXP`;

  document.body.appendChild(div);

  setTimeout(() => div.remove(), 1200);
}

function checkDailyReset() {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000)
    .toISOString().slice(0, 10);

  if (data.dailyGoalDate !== today) {
    if (!data.dailyGoalHistory?.[yesterday]) {
      data.dailyStreak = 0; // 途切れた
    }

    data.dailyGoalDate = null;
    data.dailyCleared = false;
  }
}

function calcAchievementRate(history) {
  if (!history) return "0%";
  const total = Object.keys(history).length;
  const cleared = Object.values(history).filter(v => v).length;
  return total ? `${Math.round((cleared / total) * 100)}%` : "0%";
}

