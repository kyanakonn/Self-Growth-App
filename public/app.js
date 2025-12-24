let code, data;
let startTime, timerInterval;

const fmt = s =>
  new Date(s * 1000).toISOString().substr(11, 8);

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
  updateUI();
}

function updateUI() {
  document.getElementById("subject").innerHTML =
    data.subjects.map(s => `<option>${s}</option>`).join("");
  updateExp();
  drawChart();
}

function start() {
  startTime = Date.now();
  timerInterval = setInterval(() => {
    document.getElementById("timer").innerText =
      fmt((Date.now() - startTime) / 1000);
  }, 1000);
  toggle(true);
}

function stop() {
  clearInterval(timerInterval);
  toggle(false);
}

function save() {
  const sec = Math.floor((Date.now() - startTime) / 1000);
  if (sec >= 60) {
    data.logs.push({
      subject: subject.value,
      sec,
      date: new Date().toISOString().slice(0, 10)
    });
    gainExp(sec / 60);
  }
  reset();
}

function gainExp(min) {
  data.exp += min * 2;
  updateExp();
}

function updateExp() {
  const lvl = Math.floor(Math.sqrt(data.exp / 30));
  document.getElementById("level").innerText = `Lv.${lvl}`;
  document.getElementById("exp").style.width =
    ((data.exp % 30) / 30) * 100 + "%";
}

function drawChart() {
  const ctx = document.getElementById("chart");
  const days = {};
  data.logs.forEach(l => {
    days[l.date] = (days[l.date] || 0) + l.sec / 3600;
  });
  new Chart(ctx, {
    type: "bar",
    data: {
      labels: Object.keys(days),
      datasets: [{ data: Object.values(days) }]
    }
  });
}

function aiEval() {
  alert("判定：B\n合格確率：72%\n継続は力なり！");
}

function toggle(running) {
  startBtn.hidden = running;
  stopBtn.hidden = !running;
  saveBtn.hidden = running;
}

function reset() {
  document.getElementById("timer").innerText = "00:00:00";
  toggle(false);
  saveServer();
}

function saveServer() {
  fetch("/api/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, data })
  });
}
