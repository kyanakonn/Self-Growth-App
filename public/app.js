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
/* ===============================
   早稲田商学部 AI 定義
================================ */

const WASEDA_SUBJECTS = [
  "リーディング",
  "リスニング",
  "スピーキング",
  "国語",
  "世界史"
];

const SUBJECT_GROUPS = {
  英語: ["リーディング", "リスニング", "スピーキング"],
  国語: ["国語"],
  世界史: ["世界史"]
};

// 理想配分（統計ベース）
const IDEAL_RATIO = {
  英語: 0.6,
  国語: 0.2,
  世界史: 0.2
};

// 1日の理想学習時間（分）
const IDEAL_MINUTES = {
  weekday: 300, // 5h
  holiday: 600  // 10h
};

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

data.weeklyGoal ??= null;
data.weeklyGoalLocked ??= false;
data.weeklyGoalEnd ??= null;
data.weeklyCleared ??= false;

data.weeklyGoalHistory ??= {};
data.weeklyStreak ??= 0;

  data.longHolidayMode ??= false;

  data.exp ??= 0;
  data.logs ??= [];
  data.subjects ??= [];
  data.nickname ??= "Player";

   data.aiHistory ??= {
  daily: {},   // { "2025-09-01": { grade, totalMin } }
  weekly: {},  // { "2025-W36": { grade, totalMin } }
  monthly: {}  // { "2025-09": { grade, totalMin } }
};

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

  weeklyGoalInput.value =
  data.weeklyGoal == null ? "" : data.weeklyGoal;

  updateExp();
  drawChart();
  updateWeeklyInfo();
  updateGoalsUI();

  const t = document.getElementById("holidayModeText");
  if (t) {
    t.innerText = data.longHolidayMode
      ? "ON（休日扱い）"
      : "OFF（平日扱い）";
  }
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
   showExpFloat(min * 2);
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

/* ---------- グラフとカレンダー---------- */
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

function openCalendar() {
  document.getElementById("calendarModal").style.display = "flex";
  renderCalendar();
}

function closeCalendar() {
  document.getElementById("calendarModal").style.display = "none";
}

function renderCalendar() {
  const grid = document.getElementById("calendarGrid");
  const title = document.getElementById("calendarMonthTitle");
  const monthlyBox = document.getElementById("monthlyEval");

  grid.innerHTML = "";

  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  title.innerText = `${y}年 ${m+1}月`;

  // 月評価（上部）
  const monthKey =
    `${y}-${String(m+1).padStart(2,"0")}`;
  const monthEval = data.aiHistory.monthly[monthKey];

  monthlyBox.innerText = monthEval
    ? `📊 今月の評価：${monthEval.grade}（${formatHourMin(monthEval.totalMin)}）`
    : "📊 今月の評価：未評価";

  // 日付生成
  const last = new Date(y, m+1, 0).getDate();

  for (let d = 1; d <= last; d++) {
    const key =
      `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;

    const cell = document.createElement("div");
    cell.className = "calendar-cell";
    cell.innerHTML = `<div>${d}</div>`;

    // 日評価
    const daily = data.aiHistory.daily[key];
    if (daily) {
      cell.innerHTML += `<strong>${daily.grade}</strong>`;
    }

    // 土曜に週評価表示
    const dateObj = new Date(key);
    if (dateObj.getDay() === 6) {
      const weekKey =
        `${y}-W${getWeekNumber(dateObj)}`;
      const weekly = data.aiHistory.weekly[weekKey];
      if (weekly) {
        cell.innerHTML += `<small>週:${weekly.grade}</small>`;
      }
    }

    grid.appendChild(cell);
  }
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

  if (data.dailyGoalDate !== today) {
    data.dailyGoalMinutes = 0;
    data.dailyGoalDate = null;
    dailyGoalInput.disabled = false;
  } else {
    dailyGoalInput.disabled = true;
  }

  const dailyRemain = Math.max(0, dailyGoalMinutes - todayMinutes);
  const h = Math.floor(dailyRemain / 60);
  const m = Math.floor(dailyRemain % 60);

  dailyGoalEl.textContent =
    dailyGoalMinutes > 0
      ? `日目標 残り ${h}時間 ${m}分（${data.dailyStreak || 0}日連続達成）`
      : "日目標 未設定";

  // ✅ クリア判定はここだけ
  if (dailyGoalMinutes > 0 && dailyRemain <= 0 && !data.dailyCleared) {
    data.dailyCleared = true;

    onDailyGoalCleared();   // ← 履歴・連続日数
    showDailyClear();       // ← 演出

    saveServer();
  }
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

/* ---------- 模擬AI ---------- */
function aiEval() {
  const d = evalDaily();
  const w = evalWeekly();
  const m = evalMonthly();
  const p = calcPassProbabilityAdvanced();

  if (!d) {
    alert("本日の記録がありません");
    return;
  }

   saveAIHistory(d, w, m);
   
  const dailyComment = dailyAIComment(d.grade);

  alert(
`📊 AI学習評価（早稲田商学部）

【本日】
評価：${d.grade}
学習時間：${formatHourMin(d.totalMin)}
コメント：
${dailyComment}

【今週】
評価：${w.grade}
学習時間：${formatHourMin(w.totalMin)}

【今月】
評価：${m.grade}
学習時間：${formatHourMin(m.totalMin)}

【合格判定】
可能性：${p.percent}%
判定：${p.grade}
`
  );
}

function dailyAIComment(grade) {
  const comments = {
    A: [
      "今日は理想的な学習内容です。早稲田商学部合格ラインを明確に超える1日でした。",
      "時間・配分・継続性のすべてが高水準です。このペースを維持してください。",
      "非常に完成度の高い学習日です。今後は弱点補強を意識するとさらに伸びます。",
      "今日の学習は合格者層の平均を上回っています。",
      "戦略的にも量的にも申し分ありません。A評価にふさわしい内容です。"
    ],
    B: [
      "全体として良好ですが、もう一段階上を目指せます。",
      "学習習慣は安定しています。科目配分を意識するとAが見えてきます。",
      "合格圏に向かう正しい学習です。少しだけ負荷を上げましょう。",
      "内容は良いので、継続が最大の課題です。",
      "今の努力は確実に積み上がっています。"
    ],
    C: [
      "最低限の学習はできていますが、改善余地が大きいです。",
      "今日はやや量・質ともに不足気味でした。",
      "まずは毎日の学習時間を安定させましょう。",
      "合格者平均との差はまだあります。焦らず積み上げが必要です。",
      "次回は目標時間の達成を意識してください。"
    ],
    D: [
      "学習量が不足しています。計画の見直しが必要です。",
      "継続性が途切れがちです。短時間でも毎日を意識しましょう。",
      "今日は合格戦略としては不十分な内容です。",
      "この状態が続くと危険です。生活リズムから整えましょう。",
      "まずは30分でも学習時間を確保してください。"
    ],
    E: [
      "学習記録がほとんどありません。早急な改善が必要です。",
      "現状では合格はかなり厳しい状況です。",
      "今日の学習内容では評価できません。",
      "まずは机に向かう習慣作りから始めましょう。",
      "今が立て直しのタイミングです。"
    ]
  };

  const list = comments[grade] || ["評価コメントを生成できませんでした。"];
  return list[Math.floor(Math.random() * list.length)];
}

function dateKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function getTotalBySubject() {
  const totals = {};
  WASEDA_SUBJECTS.forEach(s => totals[s] = 0);

  data.logs.forEach(log => {
    if (totals[log.subject] !== undefined) {
       totals[log.subject] += log.sec / 60;
    }
  });
  return totals;
}

function countStudyDays(days) {
  const set = new Set();
  const now = new Date();

  data.logs.forEach(log => {
    const d = new Date(log.date);
    const diff = (now - d) / 86400000;
    if (diff >= 0 && diff < days) {
      set.add(log.date);
    }
  });
  return set.size;
}

function getRecentTotal(days) {
  const now = new Date();
  return data.logs.reduce((sum, log) => {
    const d = new Date(log.date);
    const diff = (now - d) / 86400000;
    return diff >= 0 && diff < days ? sum + log.minutes : sum;
  }, 0);
}

function subjectBalanceScore() {
  const totals = getTotalBySubject();
  const totalMinutes = Object.values(totals).reduce((a,b)=>a+b,0);
  if (totalMinutes === 0) return 0;

  let diffSum = 0;
  for (const s of WASEDA_SUBJECTS) {
    const actual = totals[s] / totalMinutes;
    diffSum += Math.abs(actual - IDEAL_RATIO[s]);
  }

  return Math.max(0, 100 - diffSum * 200);
}

function calcPassProbability() {
  const total = data.logs.reduce((s,l)=>s+l.minutes,0);
  const balance = subjectBalanceScore();
  const days30 = countStudyDays(30);
  const recent7 = getRecentTotal(7);

  let score = 0;

  score += Math.min(total / 60000 * 35, 35); // 約1000時間で満点
  score += balance * 0.25;
  score += Math.min(days30 / 30 * 20, 20);
  score += Math.min(recent7 / 2100 * 10, 10); // 1日5h×7
  score += Math.min(getTodayTotalMinutes() / 180 * 10, 10);

  return Math.min(100, Math.round(score));
}

function passGrade(p) {
  if (p >= 85) return "A";
  if (p >= 70) return "B";
  if (p >= 55) return "C";
  if (p >= 40) return "D";
  return "E";
}

function safeRate(a, b) {
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= 0) return 0;
  return a / b;
}

function aiEvalAdvanced() {
  aiEval(); 
}

function toggleHolidayMode() {
  data.longHolidayMode = !data.longHolidayMode;
  document.getElementById("holidayModeText").innerText =
    data.longHolidayMode ? "ON（休日扱い）" : "OFF（平日扱い）";
  saveServer();
}

function sumSec(subjects, logs) {
  return logs
    .filter(l => subjects.includes(l.subject))
    .reduce((a, l) => a + l.sec, 0);
}

function todayLogs() {
  const today = new Date().toISOString().slice(0, 10);
  return data.logs.filter(l => l.date === today);
}

function formatHourMin(minutes) {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}.${String(m).padStart(2,"0")}h`;
}

function gradeFromScore(score) {
  if (score >= 0.9) return "A";
  if (score >= 0.75) return "B";
  if (score >= 0.6) return "C";
  if (score >= 0.45) return "D";
  return "E";
}

function clamp(v,min=0,max=1){
  return Math.max(min,Math.min(max,v));
}

function subjectRatioScore(logs) {
  const total = logs.reduce((a,l)=>a+l.sec,0);
  if (!total) return 0;

  const byGroup = {
    英語: sumSec(SUBJECT_GROUPS.英語, logs),
    国語: sumSec(SUBJECT_GROUPS.国語, logs),
    世界史: sumSec(SUBJECT_GROUPS.世界史, logs)
  };

  let diff = 0;
  for (const k in IDEAL_RATIO) {
    diff += Math.abs(
      (byGroup[k] / total) - IDEAL_RATIO[k]
    );
  }
  return clamp(1 - diff);
}

function evalDaily() {
  const logs = todayLogs();
  if (!logs.length) return null;

  const totalMin = logs.reduce((a,l)=>a+l.sec,0)/60;
  const ideal = data.longHolidayMode ? 600 : 300;

  const timeScore = clamp(totalMin / ideal);
  const ratioScore = subjectRatioScore(logs);
  const streakScore = clamp((data.dailyStreak||0)/7);

  const score =
    timeScore * 0.6 +
    ratioScore * 0.1 +
    streakScore * 0.3;

  return {
    score,
    grade: gradeFromScore(score),
    totalMin
  };
}

function evalWeekly() {
  const mins = getThisWeekTotalMinutes();
  const ideal = (data.longHolidayMode ? 600 : 300) * 7;

  const timeScore = clamp(mins / ideal);
  const ratioScore = subjectRatioScore(
    data.logs.filter(l=>new Date(l.date)>=getWeekStart())
  );

  const goalRate =
    calcAchievementRateRaw(data.dailyGoalHistory,7);

  const score =
    timeScore * 0.6 +
    ratioScore * 0.2 +
    goalRate * 0.2;

  return {
    score,
    grade: gradeFromScore(score),
    totalMin: mins
  };
}

function evalMonthly() {
  const logs = data.logs.filter(l=>{
    const d = new Date(l.date);
    const now = new Date();
    return d.getMonth()===now.getMonth();
  });

  const totalMin = logs.reduce((a,l)=>a+l.sec,0)/60;
  const ideal = (data.longHolidayMode ? 600 : 300) * 30;

  const timeScore = clamp(totalMin / ideal);
  const ratioScore = subjectRatioScore(logs);
  const goalRate =
    calcAchievementRateRaw(data.dailyGoalHistory,30);

  const score =
    timeScore * 0.5 +
    ratioScore * 0.3 +
    goalRate * 0.2;

  return {
    score,
    grade: gradeFromScore(score),
    totalMin
  };
}

function calcPassProbabilityAdvanced() {
  const totalHours =
    data.logs.reduce((a,l)=>a+l.sec,0)/3600;

  const timeRate = clamp(totalHours / 3000);
  const balance = subjectRatioScore(data.logs);
  const habit = clamp((data.dailyStreak||0)/30);

  const score =
    timeRate * 0.6 +
    balance * 0.25 +
    habit * 0.15;

  return {
    percent: Math.round(score * 100),
    grade: gradeFromScore(score)
  };
}

function saveAIHistory(d, w, m) {
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();

  // 日
  data.aiHistory.daily[today] = {
    grade: d.grade,
    totalMin: d.totalMin
  };

  // 週（その週の土曜日キー）
  const weekKey =
    `${now.getFullYear()}-W${getWeekNumber(now)}`;

  data.aiHistory.weekly[weekKey] = {
    grade: w.grade,
    totalMin: w.totalMin
  };

  // 月
  const monthKey =
    `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;

  data.aiHistory.monthly[monthKey] = {
    grade: m.grade,
    totalMin: m.totalMin
  };

  saveServer();
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
  if (data.weeklyGoal == null) {
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

  onWeeklyGoalCleared();

  showWeeklyClear();
  saveServer();
　}
}

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

function getWeekStart() {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay()); // 日曜始まり
  start.setHours(0, 0, 0, 0);
  return start;
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

function onDailyGoalCleared() {
  const today = new Date().toISOString().slice(0, 10);

  data.dailyGoalHistory ??= {};

  if (!data.dailyGoalHistory[today]) {
    data.dailyGoalHistory[today] = true;
    data.dailyStreak = (data.dailyStreak || 0) + 1;
  }

  saveServer();
}

function calcAchievementRateRaw(history, days) {
  if (!history) return 0;

  const now = new Date();
  let total = 0;
  let cleared = 0;

  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const key = d.toISOString().slice(0,10);

    if (history[key] !== undefined) {
      total++;
      if (history[key]) cleared++;
    }
  }

  if (total === 0) return 0;
  return cleared / total; // 0〜1
}
