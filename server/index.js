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
function todayJP() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
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
  "リスニング",
  "リーディング",
  "スピーキング",
  "世界史",
  "国語"
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

/* ===== 科目取得 ===== */
app.get("/api/subjects/:userId", (req, res) => {
  db.all(
    "SELECT * FROM subjects WHERE userId=?",
    [req.params.userId],
    (_, rows) => res.json(rows)
  );
});

/* ===== 記録 ===== */
app.post("/api/log", (req, res) => {
  const { userId, subjectId, minutes } = req.body;
  const today = todayJP();

  if (minutes >= 1) {
    db.run(
      "INSERT INTO logs VALUES (?,?,?,?,?)",
      [crypto.randomUUID(), userId, subjectId, minutes, today]
    );
  }

  db.get("SELECT * FROM profile WHERE userId=?", [userId], (_, p) => {
    let streak = p.streak;

    if (p.lastRecordDate === today) {
      // 変化なし
    } else if (p.lastRecordDate === todayJP(-1)) {
      streak++;
    } else {
      streak = 1;
    }

    const maxStreak = Math.max(streak, p.maxStreak);

    db.run(
      `
      UPDATE profile
      SET totalMinutes=totalMinutes+?,
          streak=?, maxStreak=?, lastRecordDate=?
      WHERE userId=?
      `,
      [minutes, streak, maxStreak, today, userId]
    );

    res.json({ ok: true });
  });
});

/* ===== 模擬AI評価 ===== */
app.post("/api/ai-analysis", (req, res) => {
  const { userId } = req.body;

  db.get("SELECT * FROM profile WHERE userId=?", [userId], (_, p) => {
    const phrases = [
      "今は基礎構築期。継続が最大の武器。",
      "確実に前進しています。",
      "合格者の平均に近づいています。",
      "この習慣は強いです。",
      "今の努力は必ず回収できます。"
    ];

    const seed = todayJP() + Math.floor(p.totalMinutes / 30);
    const index =
      seed.split("").reduce((a, c) => a + c.charCodeAt(0), 0) %
      phrases.length;

    res.json({
      streak: p.streak,
      totalMinutes: p.totalMinutes,
      phrase: phrases[index]
    });
  });
});

app.listen(3000, () => console.log("Server running"));
