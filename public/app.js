let userId = localStorage.getItem("userId");
let chart;
const $ = id => document.getElementById(id);

if(userId) init();

async function newStart(){
  const r = await fetch("/api/login",{method:"POST"});
  const d = await r.json();
  userId = d.userId;
  localStorage.setItem("userId",userId);
  init();
}

async function init(){
  $("start").classList.remove("active");
  $("home").classList.add("active");
  loadProfile();
  loadCalendar();
  loadGraph(7);
}

/* ===== プロフィール ===== */
async function loadProfile(){
  const p = await (await fetch(`/api/profile/${userId}`)).json();
  $("level").textContent=p.level;
  $("streak").textContent=p.streak;

  const used = Math.floor(p.totalMinutes/60);
  const remain = Math.max(0,Math.floor(p.weeklyTarget/60)-used);
  $("weeklyRemain").textContent = remain>0 ? remain+"h" : "達成！";

  $("expFill").style.width = `${(p.exp/(p.level*p.level*100))*100}%`;

  if(Math.floor(p.totalMinutes/6000)>localStorage.getItem("bonus")){
    bonusEffect();
    localStorage.setItem("bonus",Math.floor(p.totalMinutes/6000));
  }
}

/* ===== 週間目標 ===== */
async function updateWeekly(){
  const h = Number($("weeklyInput").value);
  await fetch("/api/weekly",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({userId,minutes:h*60})});
  loadProfile();
}

/* ===== カレンダー ===== */
async function loadCalendar(){
  const logs = await (await fetch(`/api/logs/${userId}`)).json();
  const days = [...new Set(logs.map(l=>l.date))];
  const cal = $("calendar");
  cal.innerHTML="";
  for(let i=1;i<=30;i++){
    const d = document.createElement("div");
    d.className="day";
    if(days.some(x=>x.endsWith(`-${String(i).padStart(2,"0")}`))){
      d.classList.add("fire");
      d.textContent="🔥";
    }else d.textContent=i;
    cal.appendChild(d);
  }
}

/* ===== グラフ ===== */
async function loadGraph(type){
  const logs = await (await fetch(`/api/logs/${userId}`)).json();
  const data = {};
  logs.forEach(l=>{
    data[l.subjectId]=(data[l.subjectId]||0)+l.minutes;
  });

  if(chart) chart.destroy();
  chart = new Chart($("chart"),{
    type:"bar",
    data:{
      labels:Object.keys(data),
      datasets:[{data:Object.values(data),backgroundColor:"#0f172a"}]
    }
  });
}

function changeGraph(v){ loadGraph(v); }

/* ===== 覚醒演出 ===== */
function bonusEffect(){
  document.body.classList.add("flash");
  alert("🎉 100時間達成！おめでとう！");
  setTimeout(()=>document.body.classList.remove("flash"),600);
}
