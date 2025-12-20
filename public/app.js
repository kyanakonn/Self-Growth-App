let userId=localStorage.getItem("userId");
let seconds=0,timer;

const qs=id=>document.getElementById(id);
const screens={start:qs("start"),home:qs("home")};

if(userId) init();

async function newStart(){
  const r=await fetch("/api/login",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});
  const d=await r.json();
  localStorage.setItem("userId",d.userId);
  userId=d.userId;
  init();
}

async function loginWithCode(){
  const code=qs("codeInput").value;
  const r=await fetch("/api/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({code})});
  const d=await r.json();
  localStorage.setItem("userId",d.userId);
  userId=d.userId;
  init();
}

async function init(){
  screens.start.classList.remove("active");
  screens.home.classList.add("active");
  qs("userCode").textContent=userId;
  loadProfile();
  loadSubjects();
  loadLogs();
}

async function loadProfile(){
  const p=await (await fetch(`/api/profile/${userId}`)).json();
  qs("level").textContent=p.level;
  qs("exp").textContent=p.exp;
  qs("streak").textContent=p.streak;
  const need=p.level*p.level*100;
  qs("expFill").style.width=`${p.exp/need*100}%`;
}

async function updateWeekly(){
  const m=qs("weeklyInput").value;
  await fetch("/api/weekly-target",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({userId,minutes:m})});
  loadProfile();
}

async function loadSubjects(){
  const s=await (await fetch(`/api/subjects/${userId}`)).json();
  qs("subjectSelect").innerHTML=s.map(x=>`<option value="${x.id}">${x.name}</option>`).join("");
}

async function addSubject(){
  await fetch("/api/subject",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({userId,name:qs("subjectInput").value})});
  qs("subjectInput").value="";
  loadSubjects();
}

function startTimer(){
  seconds=0;
  timer=setInterval(()=>{seconds++;qs("timer").textContent=`${seconds/60|0}:${seconds%60}`},1000);
}
function stopTimer(){clearInterval(timer);}
async function saveTimer(){
  const min=seconds/60|0;
  await fetch("/api/log",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({userId,subjectId:qs("subjectSelect").value,minutes:min})});
  loadProfile();
  loadLogs();
}

async function loadLogs(){
  const logs=await (await fetch(`/api/logs/${userId}`)).json();
  const map={};
  logs.forEach(l=>{
    map[l.date]=map[l.date]||[];
    map[l.date].push(l);
  });
  qs("logList").innerHTML=Object.keys(map).map(d=>`
    <div class="list-item">
      <b>${d}</b>
      ${map[d].map(x=>`<div class="small">${x.subjectId} ${x.minutes}分</div>`).join("")}
    </div>`).join("");
}
