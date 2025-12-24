import express from "express";
import sqlite3 from "sqlite3";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

const db = new sqlite3.Database("./db.sqlite");

/* ===== 日本時間の日付 ===== */
function todayJP(offset = 0) {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000);
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

/* ===== DB初期化 ===== */
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      nickname TEXT,
      createdAt INTEGER
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS subjects (
      id TEXT PRIMARY KEY,
      userId TEXT,
      name TEXT
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
      exp INTEGER,
      level INTEGER,
      totalMinutes INTEGER,
      streak INTEGER,
      maxStreak INTEGER,
      lastRecordDate TEXT
    )
  `);
});

/* ===== 初期科目 ===== */
const BASE_SUBJECTS = ["リスニング","リーディング","スピーキング","世界史","国語"];

function generateCode() {
  return Math.floor(10000000 + Math.random() * 90000000).toString();
}

/* ===== 新規 / 引き継ぎ ===== */
app.post("/api/login", (req, res) => {
  const { code, nickname } = req.body;

  if (code) {
    db.get("SELECT id FROM users WHERE id=?", [code], (_, row) => {
      if (!row) return res.status(404).json({ error: "not found" });
      res.json({ userId: code });
    });
    return;
  }

  const userId = generateCode();

  db.run("INSERT INTO users VALUES (?,?,?)", [
    userId,
    nickname || "User",
    Date.now()
  ]);

  db.run(
    "INSERT INTO profile VALUES (?,?,?,?,?,?,?)",
    [userId, 0, 1, 0, 0, 0, null]
  );

  BASE_SUBJECTS.forEach(name => {
    db.run(
      "INSERT INTO subjects VALUES (?,?,?)",
      [crypto.randomUUID(), userId, name]
    );
  });

  res.json({ userId });
});

/* ===== 科目 ===== */
app.get("/api/subjects/:userId", (req, res) => {
  db.all(
    "SELECT * FROM subjects WHERE userId=?",
    [req.params.userId],
    (_, rows) => res.json(rows)
  );
});

app.post("/api/subject", (req, res) => {
  const { userId, name } = req.body;
  if (!name) return res.json({ ok: false });

  db.run(
    "INSERT INTO subjects VALUES (?,?,?)",
    [crypto.randomUUID(), userId, name],
    () => res.json({ ok: true })
  );
});

app.delete("/api/subject/:id", (req, res) => {
  db.run("DELETE FROM subjects WHERE id=?", [req.params.id], () =>
    res.json({ ok: true })
  );
});

/* ===== ログ（streak 正確計算） ===== */
app.post("/api/log", (req, res) => {
  const { userId, subjectId, minutes } = req.body;
  const today = todayJP();

  db.run(
    "INSERT INTO logs VALUES (?,?,?,?,?)",
    [crypto.randomUUID(), userId, subjectId, minutes, today]
  );

  db.get("SELECT * FROM profile WHERE userId=?", [userId], (_, p) => {
    let streak = p.streak;
    let last = p.lastRecordDate;

    if (last === today) {
      // 同日：何もしない
    } else if (last === todayJP(-1)) {
      streak += 1;
    } else {
      streak = 1;
    }

    const maxStreak = Math.max(streak, p.maxStreak);

    let exp = p.exp + minutes;
    let level = p.level;

    while (exp >= level * level * 20) {
      exp -= level * level * 20;
      level++;
    }

    db.run(
      `
      UPDATE profile
      SET exp=?, level=?, totalMinutes=totalMinutes+?,
          streak=?, maxStreak=?, lastRecordDate=?
      WHERE userId=?
      `,
      [
        Math.floor(exp),
        level,
        minutes,
        streak,
        maxStreak,
        today,
        userId
      ]
    );

    res.json({ ok: true });
  });
});

/* ===== プロフィール ===== */
app.get("/api/profile/:userId", (req, res) => {
  db.get(
    "SELECT * FROM profile WHERE userId=?",
    [req.params.userId],
    (_, row) => res.json(row)
  );
});

/* ===== ログ取得 ===== */
app.get("/api/logs/:userId", (req, res) => {
  db.all(
    "SELECT * FROM logs WHERE userId=?",
    [req.params.userId],
    (_, rows) => res.json(rows || [])
  );
});

/* ===== 起動 ===== */
app.listen(3000, () => console.log("Server running"));
