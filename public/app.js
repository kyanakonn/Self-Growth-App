/* =====================
   グローバル状態
===================== */
let userId = localStorage.getItem("userId");

let subjects = [];
let logs = [];
let profile = null;

let chart;
let mode = "day";

/* =====================
   起動
===================== */
switchScreen("start");

/* =====================
   認証
===================== */
async function newStart(){
 const res = await fetch("/api/login",{
  method:"POST",
  headers:{ "Content-Type":"application/json" },
  body: JSON.stringify({})
 });
 const data = await res.json();

 userId = data.userId;
 localStorage.setItem("userId", userId);

 await loadAll();
 switchScreen("home");
}

async function login(){
 if(!codeInput.value) return;
 const res = await fetch("/api/login",{
  method:"POST",
  headers:{ "Content-Type":"application/json" },
  body: JSON.stringify({ code: codeInput.value })
 });

 if(!res.ok) return alert("引き継ぎコードが見つかりません");

 const data = await res.json();
 userId = data.userId;
 localStorage.setItem("userId", userId);

 await loadAll();
 switchScreen("home");
}

/* =====================
   初期ロード
===================== */
async function loadAll(){
 subjects = await fetch(`/api/subjects/${userId}`).then(r=>r.json());
 logs = await fetch(`/api/logs/${userId}`).then(r=>r.json());
 profile = await fetch(`/api/profile/${userId}`).then(r=>r.json());

 // 初回科目
 if(subjects.length === 0){
  await addSubject("英語");
  await addSubject("世界史");
  subjects = await fetch(`/api/subjects/${userId}`).then(r=>r.json());
 }

 renderSubjects();
 initChart();
 updateProfile();
 drawChart();
}

/* =====================
   画面制御
===================== */
function switchScreen(id){
 document.querySelectorAll(".screen")
  .forEach(s=>s.classList.remove("active"));
 document.getElementById(id).classList.add("active");
}

function goProfile(){
 pLevel.textContent = profile.level;
 pExp.textContent = profile.exp;
 pTime.textContent = (profile.totalMinutes / 60).toFixed(1);
 pCode.textContent = userId;
 switchScreen("profile");
}

function goHome(){
 switchScreen("home");
}

/* =====================
   科目
===================== */
function renderSubjects(){
 manualSubject.innerHTML = "";
 timerSubject.innerHTML = "";

 subjects.forEach(s=>{
  manualSubject.add(new Option(s.name, s.id));
  timerSubject.add(new Option(s.name, s.id));
 });
}

async function addSubject(name){
 await fetch("/api/subject",{
  method:"POST",
  headers:{ "Content-Type":"application/json" },
  body: JSON.stringify({ userId, name })
 });
 subjects = await fetch(`/api/subjects/${userId}`).then(r=>r.json());
 renderSubjects();
 drawChart();
}

async function addSubjectFromInput(){
 if(!newSub.value) return;
 await addSubject(newSub.value);
 newSub.value = "";
}

/* =====================
   記録
===================== */
async function manualSave(){
 const min = (+h.value||0)*60 + (+m.value||0);
 if(min <= 0) return;
 await saveLog(manualSubject.value, min);
}

async function saveLog(subjectId, minutes){
 const res = await fetch("/api/log",{
  method:"POST",
  headers:{ "Content-Type":"application/json" },
  body: JSON.stringify({ userId, subjectId, minutes })
 });

 const result = await res.json();
 if(result.leveledUp){
  alert(`🎉 ${result.level}レベルにレベルアップしました！`);
 }

 logs = await fetch(`/api/logs/${userId}`).then(r=>r.json());
 profile = await fetch(`/api/profile/${userId}`).then(r=>r.json());

 updateProfile();
 drawChart();
}

/* =====================
   プロフィール
===================== */
function updateProfile(){
 level.textContent = profile.level;
 const need = Math.floor(30 * Math.pow(profile.level, 1.9));
 expFill.style.width =
  Math.min(profile.exp / need * 100, 100) + "%";
}

/* =====================
   グラフ
===================== */
function changeMode(m){
 mode = m;
 drawChart();
}

function initChart(){
 chart = new Chart(document.getElementById("chart"),{
  type:"bar",
  data:{ labels:[], datasets:[] },
  options:{ responsive:true }
 });
}

function drawChart(){
 const map = {};

 logs.forEach(l=>{
  map[l.date] = map[l.date] || {};
  map[l.date][l.subjectId] =
   (map[l.date][l.subjectId] || 0) + l.minutes / 60;
 });

 const labels = Object.keys(map);
 chart.data.labels = labels;

 chart.data.datasets = subjects.map(s=>({
  label: s.name,
  data: labels.map(d=>map[d]?.[s.id] || 0)
 }));

 chart.update();
}

/* =====================
   タイマー
===================== */
let sec = 0;
let timer = null;

function openTimer(){
 sec = 0;
 timerText.textContent = "0:00";
 startBtn.disabled = false;
 startBtn.classList.remove("hidden");
 stopBtn.classList.add("hidden");
 saveBtn.classList.add("hidden");
 timerFull.style.display = "flex";
}

function startTimer(){
 if(timer) return;
 startBtn.disabled = true;
 stopBtn.classList.remove("hidden");

 timer = setInterval(()=>{
  sec++;
  timerText.textContent =
   Math.floor(sec/60) + ":" + String(sec%60).padStart(2,"0");
 },1000);
}

function stopTimer(){
 clearInterval(timer);
 timer = null;
 saveBtn.classList.remove("hidden");
}

async function saveTimer(){
 timerFull.style.display = "none";
 if(sec > 0){
  await saveLog(timerSubject.value, Math.floor(sec/60));
 }
 sec = 0;
}

/* =====================
   AI分析
===================== */
async function openAI(){
 const res = await fetch("/api/ai-analysis",{
  method:"POST",
  headers:{ "Content-Type":"application/json" },
  body: JSON.stringify({ userId })
 });

 const data = await res.json();

 aiDate.textContent = `📅 ${data.date}`;
 aiTotal.textContent = data.totalHours;
 aiProgress.textContent = data.progress;

 aiSubjects.innerHTML = "";
 data.analysis.forEach(a=>{
  const div = document.createElement("div");
  div.className = "card";
  div.innerHTML = `
    <h3>${a.subject}</h3>
    <p>学習時間：${a.minutes} 分</p>
    <p>${a.comment}</p>
  `;
  aiSubjects.appendChild(div);
 });

 aiOverall.textContent = data.overall;
 switchScreen("ai");
}

async function openAI(){
 const res = await fetch("/api/ai-analysis",{
  method:"POST",
  headers:{ "Content-Type":"application/json" },
  body: JSON.stringify({ userId })
 });
 const d = await res.json();

 aiStreak.textContent = `🔥 連続学習 ${d.streak} 日`;
 aiProgress.textContent = `📊 3000時間進捗 ${d.progress}%`;
 aiRecommend.textContent =
  `🎯 今日の満点目安：${d.recommendMinutes} 分`;

 aiSubjects.innerHTML="";
 d.analysis.forEach(a=>{
  const div=document.createElement("div");
  div.className="card";
  div.innerHTML=`
   <h3>${a.subject}（${a.priority}）</h3>
   <p>今日：${a.minutes} 分</p>
   ${a.score!==null?`<p>模試偏差値：${a.score}</p>`:""}
   <p>${a.comment}</p>
  `;
  aiSubjects.appendChild(div);
 });

 aiOverall.textContent=d.overall;
 switchScreen("ai");
}

