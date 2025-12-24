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
  weeklyGoalInput.value = data.weeklyGoal;
  updateExp();
  drawChart();
  updateWeeklyInfo();
}

/* ---------- タイマー ---------- */

function start() {
  startTime = Date.now();
  timerInterval = setInterval(() => {
    timer.innerText = fmt((Date.now() - startTime) / 1000);
  }, 1000);
  toggle(true);
}

function stop() {
  clearInterval(timerInterval);
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
  data.exp += min * 2;
}

function updateExp() {
  const lvl = Math.floor(Math.sqrt(data.exp / 30));
  level.innerText = `Lv.${lvl}`;
  exp.style.width = ((data.exp % 30) / 30) * 100 + "%";
}

/* ---------- グラフ ---------- */

function drawChart() {
  chart?.remove();
  const ctx = document.getElementById("chart");
  const days = {};
  data.logs.forEach(l => {
    days[l.date] = (days[l.date] || 0) + l.sec / 3600;
  });
  chart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: Object.keys(days),
      datasets: [{ data: Object.values(days) }]
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

function loadData(d) {
  data = d;

  // 🔒 念のためすべて閉じる
  settings.style.display = "none";
  profile.style.display = "none";

  document.getElementById("start").hidden = true;
  document.getElementById("app").hidden = false;

  updateUI();
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
}

function checkWeeklyReset() {
  if (data.weeklyGoalEnd && new Date() > new Date(data.weeklyGoalEnd)) {
    data.weeklyGoalLocked = false;
    data.weeklyGoalEnd = null;
    saveServer();
  }
}

