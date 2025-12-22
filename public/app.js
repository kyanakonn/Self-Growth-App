let userId = localStorage.getItem("userId");

/* ===== データ ===== */
let subjects = ["英語","世界史"];
let colors = {};
let logs = [];
let profile = { level:1, exp:0, totalMin:0 };

let chart, mode="day";

/* ===== 起動 ===== */
switchScreen("start");

/* ===== スタート ===== */
async function newStart(){
 userId="USER-"+Date.now().toString(36);
 localStorage.setItem("userId",userId);

 await saveServer();
 init();
 switchScreen("home");
}

async function login(){
 if(!codeInput.value) return;
 userId=codeInput.value;
 localStorage.setItem("userId",userId);

 const data = await loadServer();
 if(!data) return alert("データが見つかりません");

 ({subjects,colors,logs,profile} = data);
 init();
 switchScreen("home");
}

/* ===== サーバー ===== */
async function loadServer(){
 const res = await fetch(`/api/user/${userId}`);
 return await res.json();
}

async function saveServer(){
 await fetch(`/api/user/${userId}`,{
  method:"POST",
  headers:{"Content-Type":"application/json"},
  body:JSON.stringify({subjects,colors,logs,profile})
 });
}

/* ===== 初期化 ===== */
function init(){
 renderSubjects();
 initChart();
 updateProfile();
 drawChart();
}

/* ===== UI ===== */
function switchScreen(id){
 document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
 document.getElementById(id).classList.add("active");
}

function goProfile(){
 pLevel.textContent=profile.level;
 pExp.textContent=profile.exp;
 pTime.textContent=(profile.totalMin/60).toFixed(1);
 pCode.textContent=userId;
 switchScreen("profile");
}
function goHome(){switchScreen("home")}

/* ===== 科目 ===== */
function renderSubjects(){
 manualSubject.innerHTML="";
 timerSubject.innerHTML="";
 subjects.forEach(s=>{
  if(!colors[s]) colors[s]=`hsl(${Math.random()*360},70%,50%)`;
  manualSubject.add(new Option(s,s));
  timerSubject.add(new Option(s,s));
 });
}

async function addSubject(){
 if(!newSub.value) return;
 subjects.push(newSub.value);
 newSub.value="";
 renderSubjects();
 drawChart();
 await saveServer();
}

/* ===== 記録 ===== */
async function manualSave(){
 const min=(+h.value||0)*60+(+m.value||0);
 if(min>0) await addLog(manualSubject.value,min);
}

async function addLog(sub,min){
 const today=new Date().toISOString().slice(0,10);
 profile.totalMin+=min;
 profile.exp+=min;
 logs.push({date:today,sub,min});

 checkLevel();
 await saveServer();
 updateProfile();
 drawChart();
}

/* ===== レベル ===== */
function checkLevel(){
 let up=false;
 while(profile.exp>=30*Math.pow(profile.level,1.9)){
  profile.exp-=30*Math.pow(profile.level,1.9);
  profile.level++;
  up=true;
 }
 if(up) alert(`🎉 ${profile.level}レベルにレベルアップしました！`);
}

function updateProfile(){
 level.textContent=profile.level;
 const need=30*Math.pow(profile.level,1.9);
 expFill.style.width=Math.min(profile.exp/need*100,100)+"%";
}

/* ===== グラフ ===== */
function changeMode(m){mode=m;drawChart();}

function initChart(){
 chart=new Chart(document.getElementById("chart"),{
  type:"bar",
  data:{labels:[],datasets:[]},
  options:{responsive:true}
 });
}

function drawChart(){
 const map={};
 logs.forEach(l=>{
  map[l.date]=map[l.date]||{};
  map[l.date][l.sub]=(map[l.date][l.sub]||0)+l.min/60;
 });

 chart.data.labels=Object.keys(map);
 chart.data.datasets=subjects.map(s=>({
  label:s,
  backgroundColor:colors[s],
  data:chart.data.labels.map(k=>map[k][s]||0)
 }));
 chart.update();
}

/* ===== タイマー ===== */
let sec=0,timer=null;

function openTimer(){
 sec=0;
 timerText.textContent="0:00";
 startBtn.disabled=false;
 startBtn.classList.remove("hidden");
 stopBtn.classList.add("hidden");
 saveBtn.classList.add("hidden");
 timerFull.style.display="flex";
}

function startTimer(){
 if(timer) return;
 startBtn.disabled=true;
 stopBtn.classList.remove("hidden");
 timer=setInterval(()=>{
  sec++;
  timerText.textContent=
   Math.floor(sec/60)+":"+String(sec%60).padStart(2,"0");
 },1000);
}

function stopTimer(){
 clearInterval(timer);
 timer=null;
 saveBtn.classList.remove("hidden");
}

async function saveTimer(){
 timerFull.style.display="none";
 if(sec>0) await addLog(timerSubject.value,Math.floor(sec/60));
 sec=0;
}
