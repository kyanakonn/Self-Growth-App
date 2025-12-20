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
