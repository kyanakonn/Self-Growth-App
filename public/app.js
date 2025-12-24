let userId = localStorage.getItem("userId");
let subjects=[], logs=[], profile=null;
let chart, chartMode="week";

/* 起動 */
document.addEventListener("DOMContentLoaded", init);

async function init(){
  bindButtons();
  if(userId){switchScreen("home"); await loadAll();}
  else switchScreen("start");
}

function bindButtons(){
  document.getElementById("profileBtn")?.addEventListener("click", goProfile);
  document.getElementById("timerBtn")?.addEventListener("click", openTimer);
}

/* 新規 */
async function newStart(){
  const r = await fetch("/api/login",{method:"POST"});
  userId=(await r.json()).userId;
  localStorage.setItem("userId",userId);
  switchScreen("home"); await loadAll();
}

/* 読込 */
async function loadAll(){
  subjects=await fetch(`/api/subjects/${userId}`).then(r=>r.json());
  logs=await fetch(`/api/logs/${userId}`).then(r=>r.json());
  profile=await fetch(`/api/profile/${userId}`).then(r=>r.json());
  renderSubjects(); renderManage(); renderChart();
}

/* 画面 */
function switchScreen(id){
  document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}
function goProfile(){switchScreen("profile");}

/* 科目描画 */
function renderSubjects(){
  manualSubject.innerHTML="<option value=''>選択</option>";
  timerSubject.innerHTML="<option value=''>選択</option>";
  subjects.forEach(s=>{
    manualSubject.add(new Option(s.name,s.id));
    timerSubject.add(new Option(s.name,s.id));
  });
}

/* 管理 */
function renderManage(){
  subjectManage.innerHTML="";
  subjects.forEach(s=>{
    subjectManage.innerHTML+=`
      <div>${s.name}
      ${s.isDefault? "🔒":
      `<button onclick="deleteSubject('${s.id}')">削除</button>`}
      </div>`;
  });
}

/* 保存 */
async function manualSave(){
  if(!manualSubject.value) return alert("科目を選択してください");
  const min=Number(h.value)*60+Number(m.value);
  if(min<=0) return;
  await fetch("/api/log",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({userId,subjectId:manualSubject.value,minutes:min})});
  await loadAll();
}

/* タイマー */
function openTimer(){switchScreen("timerFull");}

/* グラフ（週） */
function renderChart(){
  const days=[...Array(7)].map((_,i)=>{
    const d=new Date(); d.setDate(d.getDate()-6+i);
    return d.toISOString().slice(0,10);
  });
  const data=days.map(d=>logs.filter(l=>l.date===d).reduce((a,b)=>a+b.minutes,0));
  if(chart)chart.destroy();
  chart=new Chart(chartEl,{
    type:"bar",
    data:{labels:days,datasets:[{label:"合計",data}]}
  });
}
