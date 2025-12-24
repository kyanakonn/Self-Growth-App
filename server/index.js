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
      maxStreak INTEGER
    )
  `);
});

/* ===== ユーティリティ ===== */
const DEFAULT_SUBJECTS = [
  "リスニング",
  "リーディング",
  "スピーキング",
  "世界史",
  "国語"
];

function generateCode() {
  return Math.floor(10000000 + Math.random() * 90000000).toString();
}

/* ===== 新規 / 引き継ぎ ===== */
app.post("/api/login", (req, res) => {
  const { code, nickname } = req.body;

  if (code) {
    db.get("SELECT id FROM users WHERE id=?", [code], (e, row) => {
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

  db.run("INSERT INTO profile VALUES (?,?,?,?,?,?)", [
    userId,
    0,
    1,
    0,
    0,
    0
  ]);

  DEFAULT_SUBJECTS.forEach(name => {
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

/* ===== ログ ===== */
app.post("/api/log", (req, res) => {
  const { userId, subjectId, minutes } = req.body;
  const date = new Date().toISOString().slice(0, 10);

  db.run(
    "INSERT INTO logs VALUES (?,?,?,?,?)",
    [crypto.randomUUID(), userId, subjectId, minutes, date]
  );

  db.get("SELECT * FROM profile WHERE userId=?", [userId], (_, p) => {
    let exp = p.exp + minutes;
    let level = p.level;

    while (exp >= level * level * 20) {
      exp -= level * level * 20;
      level++;
    }

    db.run(
      `UPDATE profile
       SET exp=?, level=?, totalMinutes=totalMinutes+?
       WHERE userId=?`,
      [Math.floor(exp), level, minutes, userId]
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

/* ===== AI分析（強化版） ===== */
app.post("/api/ai-analysis", (req, res) => {
  const { userId } = req.body;
  const today = new Date().toISOString().slice(0, 10);

  db.all(
    `
    SELECT s.name, SUM(l.minutes) as minutes
    FROM subjects s
    LEFT JOIN logs l ON s.id=l.subjectId AND l.date=?
    WHERE s.userId=?
    GROUP BY s.name
    `,
    [today, userId],
    (_, rows) => {
      db.get(
        "SELECT * FROM profile WHERE userId=?",
        [userId],
        (_, p) => {
          const total = rows.reduce((a, b) => a + (b.minutes || 0), 0);

          const comments = [];
          if (total < 60) comments.push("今日は最低限。明日は必ず巻き返そう。");
          else if (total < 180) comments.push("合格者平均ライン。悪くない。");
          else comments.push("商学部上位層の学習量です。");

          if (p.streak >= 30)
            comments.push("完全に習慣化。合格する人の行動です。");
          else if (p.streak >= 7)
            comments.push("継続力が身についてきました。");

          res.json({
            total,
            streak: p.streak,
            comments,
            subjects: rows
          });
        }
      );
    }
  );
});

/* ===== 起動 ===== */
app.listen(3000, () => console.log("Server running"));
