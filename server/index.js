import express from "express";
import fs from "fs";
import path from "path";

const app = express();
app.use(express.json());
app.use(express.static("public"));

const DATA_FILE = "./data.json";
let db = fs.existsSync(DATA_FILE)
  ? JSON.parse(fs.readFileSync(DATA_FILE))
  : {};

const saveDB = () =>
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));

const createCode = () =>
  Math.floor(10000000 + Math.random() * 90000000).toString();

/* 新規作成 */
app.post("/api/new", (_, res) => {
  const code = createCode();
  db[code] = {
    nickname: "名前なし",
    subjects: ["リスニング", "リーディング", "スピーキング", "世界史", "国語"],
    logs: [],
    weeklyGoal: 10,
    exp: 0,
    streak: 0,
    maxStreak: 0,
    lastDate: null,
    weeklyClear: 0
  };
  saveDB();
  res.json({ code });
});

/* 引き継ぎ */
app.post("/api/load", (req, res) => {
  const { code } = req.body;
  if (!db[code]) return res.status(404).end();
  res.json(db[code]);
});

/* 保存 */
app.post("/api/save", (req, res) => {
  const { code, data } = req.body;
  db[code] = data;
  saveDB();
  res.end();
});

app.listen(3000, () => console.log("Server running"));
