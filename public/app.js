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

/* ===== 手動記録 ===== */
async function saveManual(){
  const sub = $("manualSubject").value;
  const h = Number($("manualHour").value||0);
  const m = Number($("manualMin").value||0);
  const minutes = h*60+m;
  if(minutes<=0) return;

  await fetch("/api/log",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      userId,
      subjectId:sub,
      minutes
    })
  });

  $("manualHour").value="";
  $("manualMin").value="";
  loadProfile();
}

/* ===== AI分析 ===== */
async function runAI(){
  const logs = await (await fetch(`/api/logs/${userId}`)).json();
  const total = {};
  logs.forEach(l=>{
    total[l.subjectId]=(total[l.subjectId]||0)+l.minutes;
  });

  const target = {
    waseda_sho:{
      英語:0.45,
      世界史:0.35,
      国語:0.20
    }
  };

  let msg = "📈 学習分析結果<br>";

  const sum = Object.values(total).reduce((a,b)=>a+b,0);

  for(const s in target.waseda_sho){
    const actual = (total[s]||0)/sum;
    const diff = actual - target.waseda_sho[s];

    if(diff > 0.1){
      msg += `⚠ ${s}に時間をかけすぎています<br>`;
    }else if(diff < -0.1){
      msg += `⚠ ${s}の勉強時間が不足しています<br>`;
    }else{
      msg += `✅ ${s}の配分は理想的です<br>`;
    }
  }

  msg += "<br>👉 次週は不足科目を重点強化しましょう。";
  $("aiResult").innerHTML = msg;
}

/* ===== 模試 ===== */
function saveMock(){
  const eng = Number($("mockEng").value);
  const world = Number($("mockWorld").value);

  let advice = "🎯 模試分析<br>";

  if(eng<70) advice+="英語は毎日1.5倍に増やしましょう<br>";
  if(world<65) advice+="世界史は通史の復習を優先<br>";

  $("aiResult").innerHTML = advice;
}

async function runRealAI() {
  const targetUniv = "早稲田大学 商学部";

  const mock = {
    英語: Number($("mockEng").value),
    世界史: Number($("mockWorld").value)
  };

  $("aiResult").textContent = "AI分析中…";

  const r = await fetch("/api/ai-analysis", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId,
      targetUniv,
      mock
    })
  });

  const d = await r.json();
  $("aiResult").innerText = d.result;
}

