let userId = localStorage.getItem("userId");
let nickname = "";

async function newStart(){
 nickname = prompt("ニックネームを入力してください");
 if(!nickname) return;

 const res = await fetch("/api/login",{
  method:"POST",
  headers:{ "Content-Type":"application/json" },
  body: JSON.stringify({ nickname })
 });

 const data = await res.json();
 userId = data.userId;
 localStorage.setItem("userId", userId);

 await loadAll();
 switchScreen("home");
}
