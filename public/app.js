const API = "";
let userId = null;
let startTime = null;
let selectedSubject = null;

function newAccount() {
  fetch("/api/login", { method: "POST" })
    .then(r => r.json())
    .then(d => init(d.userId));
}

function login() {
  fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: code.value })
  })
    .then(r => r.json())
    .then(d => init(d.userId));
}

function init(id) {
  userId = id;
  login.hidden = true;
  app.hidden = false;
  loadSubjects();
  loadProfile();
}

function loadSubjects() {
  fetch(`/api/subjects/${userId}`)
    .then(r => r.json())
    .then(list => {
      subjects.innerHTML = "";
      list.forEach(s => {
        const li = document.createElement("li");
        li.textContent = s.name;
        li.onclick = () => selectedSubject = s.id;
        subjects.appendChild(li);
      });
    });
}

function addSubject() {
  fetch("/api/subject", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, name: newSub.value })
  }).then(loadSubjects);
}

function startTimer() {
  startTime = Date.now();
  start.disabled = true;
  stop.disabled = false;
}

function stopTimer() {
  stop.disabled = true;
  save.hidden = false;
}

function saveLog() {
  const minutes = Math.floor((Date.now() - startTime) / 60000);
  fetch("/api/log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, subjectId: selectedSubject, minutes })
  }).then(() => {
    save.hidden = true;
    start.disabled = false;
    timer.textContent = "00:00";
    loadProfile();
  });
}

function loadProfile() {
  fetch(`/api/profile/${userId}`)
    .then(r => r.json())
    .then(p => {
      level.textContent = `Lv.${p.level} EXP:${p.exp}`;
    });
}

function updateWeekly(logs, target) {
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
}

let chart;

function draw(type) {
  fetch(`/api/logs/${userId}`)
    .then(r => r.json())
    .then(logs => {
      const map = {};
      logs.forEach(l => {
        map[l.date] = (map[l.date] || 0) + l.minutes;
      });

      const labels = Object.keys(map);
      const data = Object.values(map);

      if (chart) chart.destroy();
      chart = new Chart(document.getElementById("chart"), {
        type: "bar",
        data: {
          labels,
          datasets: [{
            label: "勉強時間（分）",
            data,
            backgroundColor: "#4caf50"
          }]
        }
      });
    });
}

function levelUpAnim() {
  level.style.transform = "scale(1.5)";
  setTimeout(() => {
    level.style.transform = "scale(1)";
  }, 600);
}

function drawCalendar(logs) {
  calendar.innerHTML = "";
  const set = new Set(logs.map(l => l.date));

  for (let i = 1; i <= 31; i++) {
    const d = document.createElement("div");
    d.textContent = i;
    if (set.has(new Date().toISOString().slice(0, 8) + String(i).padStart(2, "0"))) {
      d.style.background = "#4caf50";
    }
    calendar.appendChild(d);
  }
}
