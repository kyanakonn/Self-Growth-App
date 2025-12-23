import express from "express";
import sqlite3 from "sqlite3";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

/* ===== 基本設定 ===== */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

/* ===== DB ===== */
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
function generateCode() {
  return Math.floor(10000000 + Math.random() * 90000000).toString();
}

/* ===== 新規 / 引き継ぎ ===== */
app.post("/api/login", (req, res) => {
  const { code, nickname } = req.body;

  // 引き継ぎ
  if (code) {
    db.get("SELECT id FROM users WHERE id=?", [code], (e, row) => {
      if (!row) return res.status(404).json({ error: "not found" });
      res.json({ userId: code });
    });
    return;
  }

  // 新規
  const userId = generateCode();
  const createdAt = Date.now();

  db.run(
    "INSERT INTO users VALUES (?,?,?)",
    [userId, nickname || "User", createdAt]
  );

  db.run(
    "INSERT INTO profile VALUES (?,?,?,?,?,?)",
    [userId, 0, 1, 0, 0, 0]
  );

  const defaultSubjects = [
    "歴史",
    "リーディング",
    "リスニング",
    "スピーキング",
    "国語"
  ];

  defaultSubjects.forEach(name => {
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
    (e, rows) => res.json(rows)
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

  db.get("SELECT * FROM profile WHERE userId=?", [userId], (e, p) => {
    const streakBonus = 1 + Math.min(p.streak * 0.05, 0.5);
    let exp = p.exp + minutes * streakBonus;

    let level = p.level;
    let need;

    while (true) {
      need = Math.floor(20 * Math.pow(level, 2));
      if (exp < need) break;
      exp -= need;
      level++;
    }

    db.run(
      `UPDATE profile
       SET exp=?, level=?, totalMinutes=totalMinutes+?
       WHERE userId=?`,
      [Math.floor(exp), level, minutes, userId]
    );

    res.json({ leveledUp: level > p.level, level });
  });
});

/* ===== AI分析 ===== */
app.post("/api/ai-analysis", (req, res) => {
  const phrases = [
    "非常に良い流れです",
    "合格圏に近づいています",
    "この継続が最大の武器です",
    "早稲田商学部レベルに到達しています",
    "判断力が磨かれています",
    "基礎がかなり安定しています",
    "今のやり方で間違いありません"
  ];

  const subjects = ["歴史","リーディング","リスニング","スピーキング","国語"];

  const analysis = subjects.map(s => ({
    subject: s,
    minutes: Math.floor(Math.random() * 120),
    priority: Math.random() > 0.5 ? "重点" : "維持",
    comment: phrases[Math.floor(Math.random() * phrases.length)]
  }));

  res.json({
    streak: Math.floor(Math.random() * 30),
    progress: Math.floor(Math.random() * 100),
    recommendMinutes: 180,
    analysis,
    overall: "総合的に見て、早稲田大学商学部合格に向けて非常に良い状態です。"
  });
});

/* ===== 起動 ===== */
app.listen(3000, () => console.log("Server running"));
