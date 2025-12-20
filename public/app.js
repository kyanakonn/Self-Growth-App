let userId=localStorage.getItem("userId");
let subject="英語";
let sec=0,timer;
const qs=id=>document.getElementById(id);

if(userId) init();

async function newStart(){
  const r=await fetch("/api/login",{method:"POST"});
  const d=await r.json();
  localStorage.setItem("userId",d.userId);
  userId=d.userId;
  init();
}

function init(){
  qs("start").classList.remove("active");
  qs("home").classList.add("active");
  loadProfile();
}

function selectSubject(s){subject=s;}

function startTimer(){
  sec=0;
  qs("timerFull").style.display="flex";
  timer=setInterval(()=>{
    sec++;
    qs("timer").textContent=format(sec);
    qs("timerFull").textContent=format(sec);
  },1000);
}

function stopTimer(){
  clearInterval(timer);
  qs("timerFull").style.display="none";
}

async function saveTimer(){
  const min=sec/60|0;
  await fetch("/api/log",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({userId,subject,minutes:min})});
  stopTimer();
  levelUpEffect();
  loadProfile();
}

function levelUpEffect(){
  document.body.classList.add("flash");
  setTimeout(()=>document.body.classList.remove("flash"),600);
}

async function loadProfile(){
  const p=await (await fetch(`/api/profile/${userId}`)).json();
  qs("level").textContent=p.level;
  qs("streak").textContent=p.streak;
  qs("weeklyRemain").textContent=p.weeklyRemain+"分";
  qs("expFill").style.width=`${p.exp/(p.level*p.level*100)*100}%`;
}

function format(s){
  return `${(s/60|0).toString().padStart(2,"0")}:${(s%60).toString().padStart(2,"0")}`;
}
