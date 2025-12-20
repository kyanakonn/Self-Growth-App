let userId = localStorage.getItem("userId");
let subjects = [];
let currentSubject = null;

let startTime = null;
let timerId = null;
let running = false;

const $ = id => document.getElementById(id);

if (userId) init();

/* ===== 新規 ===== */
async function newStart(){
  const r = await fetch("/api/login",{method:"POST"});
  const d = await r.json();
  userId = d.userId;
  localStorage.setItem("userId", userId);
  init();
}

/* ===== 初期化 ===== */
async function init(){
  $("start").classList.remove("active");
  $("home").classList.add("active");
  await loadSubjects();
  loadProfile();
  resetTimer();
}

/* ===== 科目 ===== */
async function loadSubjects(){
  const r = await fetch(`/api/subjects/${userId}`);
  subjects = await r.json();
  renderSubjects();
}

function renderSubjects(){
  const list = $("subjectList");
  list.innerHTML = "";
  subjects.forEach(s=>{
    const div = document.createElement("div");
    div.className = "subject";
    div.innerHTML = `
      <span onclick="selectSubject('${s.id}','${s.name}')">${s.name}</span>
      <button onclick="deleteSubject('${s.id}')">✕</button>
    `;
    list.appendChild(div);
  });

  if (!currentSubject && subjects[0]) {
    selectSubject(subjects[0].id, subjects[0].name);
  }
}

async function addSubject(){
  const name = $("newSubject").value.trim();
  if (!name) return;
  await fetch("/api/subject",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({userId,name})
  });
  $("newSubject").value="";
  loadSubjects();
}

async function deleteSubject(id){
  await fetch(`/api/subject/${id}`,{method:"DELETE"});
  currentSubject = null;
  loadSubjects();
}

function selectSubject(id,name){
  currentSubject = {id,name};
  $("currentSubject").textContent = name;
}

/* ===== タイマー ===== */
function startTimer(){
  if (running || !currentSubject) return;
  running = true;
  startTime = Date.now();
  $("timerFull").style.display="flex";
  $("startBtn").disabled=true;
  $("stopBtn").disabled=false;
  $("saveBtn").style.display="none";

  timerId = setInterval(updateTimer,1000);
}

function stopTimer(){
  if (!running) return;
  clearInterval(timerId);
  running = false;
  $("timerFull").style.display="none";
  $("startBtn").disabled=false;
  $("stopBtn").disabled=true;
  $("saveBtn").style.display="block";
}

async function saveTimer(){
  const sec = Math.floor((Date.now()-startTime)/1000);
  const min = Math.floor(sec/60);
  if (min<=0){ resetTimer(); return; }

  await fetch("/api/log",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      userId,
      subjectId:currentSubject.id,
      minutes:min
    })
  });

  resetTimer();
  loadProfile();
}

function resetTimer(){
  startTime=null;
  running=false;
  updateTimer();
  $("startBtn").disabled=false;
  $("stopBtn").disabled=true;
  $("saveBtn").style.display="none";
}

function updateTimer(){
  let sec = 0;
  if (running) sec = Math.floor((Date.now()-startTime)/1000);
  const text = `${Math.floor(sec/60)}:${(sec%60).toString().padStart(2,"0")}`;
  $("timer").textContent=text;
  $("timerFull").textContent=text;
}

/* ===== プロフィール ===== */
async function loadProfile(){
  const p = await (await fetch(`/api/profile/${userId}`)).json();
  $("level").textContent=p.level;
  $("streak").textContent=p.streak;
  $("expFill").style.width=`${(p.exp/(p.level*p.level*100))*100}%`;
}
