import express from "express";
import sqlite3 from "sqlite3";
import cors from "cors";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

const db = new sqlite3.Database("./db.sqlite");

/* ===== 日本日付 ===== */
function todayJP(offset = 0) {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000);
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

/* ===== DB ===== */
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS subjects (
      id TEXT PRIMARY KEY,
      userId TEXT,
      name TEXT,
      isDefault INTEGER
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS logs (
      id TEXT PRIMARY KEY,
      userId TEXT,
      subjectId TEXT,
      minutes INTEGER,
      date TEXT
    )
  `);

  db.run(`
  CREATE TABLE IF NOT EXISTS profile (
    userId TEXT PRIMARY KEY,
    nickname TEXT,
    exp INTEGER,
    level INTEGER,
    totalMinutes INTEGER,
    streak INTEGER,
    maxStreak INTEGER,
    lastRecordDate TEXT
  )
`);

  db.run(`
    CREATE TABLE IF NOT EXISTS profile (
      userId TEXT PRIMARY KEY,
      exp INTEGER,
      level INTEGER,
      totalMinutes INTEGER,
      streak INTEGER,
      maxStreak INTEGER,
      lastRecordDate TEXT
    )
  `);
});

/* ===== 初期5科目 ===== */
const DEFAULT_SUBJECTS = [
  "リスニング","リーディング","スピーキング","世界史","国語"
];

/* ===== ログイン ===== */
app.post("/api/login", (req, res) => {
  const userId = crypto.randomUUID();

  db.run(
    "INSERT INTO profile VALUES (?,?,?,?,?,?,?)",
    [userId, 0, 1, 0, 0, 0, null]
  );

  DEFAULT_SUBJECTS.forEach(name => {
    db.run(
      "INSERT INTO subjects VALUES (?,?,?,1)",
      [crypto.randomUUID(), userId, name]
    );
  });

  res.json({ userId });
});

/* ===== 取得 ===== */
app.get("/api/subjects/:userId", (req, res) => {
  db.all("SELECT * FROM subjects WHERE userId=?", [req.params.userId], (_, r) => res.json(r));
});
app.get("/api/logs/:userId", (req, res) => {
  db.all("SELECT * FROM logs WHERE userId=?", [req.params.userId], (_, r) => res.json(r));
});
app.get("/api/profile/:userId", (req, res) => {
  db.get("SELECT * FROM profile WHERE userId=?", [req.params.userId], (_, r) => res.json(r));
});

/* ===== 科目追加・削除 ===== */
app.post("/api/subject", (req, res) => {
  db.run(
    "INSERT INTO subjects VALUES (?,?,?,0)",
    [crypto.randomUUID(), req.body.userId, req.body.name]
  );
  res.json({ ok:true });
});

app.delete("/api/subject/:id", (req, res) => {
  db.run("DELETE FROM subjects WHERE id=? AND isDefault=0", [req.params.id]);
  res.json({ ok:true });
});

/* ===== 記録 ===== */
app.post("/api/log", (req, res) => {
  const { userId, subjectId, minutes } = req.body;
  if (!subjectId || minutes <= 0) return res.json({ ok:false });

  const today = todayJP();
  db.run(
    "INSERT INTO logs VALUES (?,?,?,?,?)",
    [crypto.randomUUID(), userId, subjectId, minutes, today]
  );

  db.get("SELECT * FROM profile WHERE userId=?", [userId], (_, p) => {
    let streak = p.lastRecordDate === today ? p.streak :
      p.lastRecordDate === todayJP(-1) ? p.streak + 1 : 1;

    db.run(`
      UPDATE profile
      SET totalMinutes=totalMinutes+?,
          streak=?, maxStreak=?,
          lastRecordDate=?
      WHERE userId=?
    `,[minutes, streak, Math.max(streak,p.maxStreak), today, userId]);

    res.json({ ok:true });
  });
});

/* ===== AI ===== */
app.post("/api/ai-analysis", (req, res) => {
  db.get("SELECT * FROM profile WHERE userId=?", [req.body.userId], (_, p) => {
    res.json({
      streak: p.streak,
      totalMinutes: p.totalMinutes,
      phrase: "継続は確実に力になっています。"
    });
  });
});

app.post("/api/login", (req, res) => {
  const userId = crypto.randomUUID();

  db.run(
    "INSERT INTO profile VALUES (?,?,?,?,?,?,?,?)",
    [userId, "名前なし", 0, 1, 0, 0, 0, null]
  );

  DEFAULT_SUBJECTS.forEach(name => {
    db.run(
      "INSERT INTO subjects VALUES (?,?,?,1)",
      [crypto.randomUUID(), userId, name]
    );
  });

  res.json({ userId });
});

app.post("/api/nickname", (req, res) => {
  db.run(
    "UPDATE profile SET nickname=? WHERE userId=?",
    [req.body.nickname, req.body.userId]
  );
  res.json({ ok:true });
});

app.listen(3000);
