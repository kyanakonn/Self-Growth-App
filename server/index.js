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

/* ===== 日本時間 ===== */
function todayJP(offset = 0) {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000);
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

/* ===== DB ===== */
db.serialize(() => {
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

/* ===== ログ（streak正確計算） ===== */
app.post("/api/log", (req, res) => {
  const { userId, subjectId, minutes } = req.body;
  const today = todayJP();

  db.run(
    "INSERT INTO logs VALUES (?,?,?,?,?)",
    [crypto.randomUUID(), userId, subjectId, minutes, today]
  );

  db.get("SELECT * FROM profile WHERE userId=?", [userId], (_, p) => {
    let streak = p.streak;
    if (p.lastRecordDate === today) {
    } else if (p.lastRecordDate === todayJP(-1)) {
      streak++;
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
      [Math.floor(exp), level, minutes, streak, maxStreak, today, userId]
    );

    res.json({ ok: true });
  });
});

/* ===== 🧠 合格確率AI ===== */
app.post("/api/ai-analysis", (req, res) => {
  const { userId } = req.body;

  db.get("SELECT * FROM profile WHERE userId=?", [userId], (_, p) => {
    db.all(
      `
      SELECT date, SUM(minutes) as minutes
      FROM logs
      WHERE userId=?
      GROUP BY date
      ORDER BY date DESC
      LIMIT 7
      `,
      [userId],
      (_, rows) => {

        const totalHours = p.totalMinutes / 60;
        const progress = Math.min(1, totalHours / 3000);

        const avg7 =
          rows.reduce((a, b) => a + b.minutes, 0) / Math.max(1, rows.length);

        /* ===== 合格確率計算 ===== */
        let prob =
          progress * 45 +
          Math.min(p.streak, 60) * 0.6 +
          Math.min(avg7 / 180, 1) * 25;

        prob = Math.min(95, Math.max(5, Math.round(prob)));

        let rank = "D";
        if (prob >= 80) rank = "S";
        else if (prob >= 65) rank = "A";
        else if (prob >= 45) rank = "B";
        else if (prob >= 25) rank = "C";

        const comments = {
          S: "合格は射程圏内。今の生活がそのまま合格ラインです。",
          A: "かなり現実的。継続すれば合格者平均を超えます。",
          B: "まだ差があるが、伸びる位置。streak維持が最重要。",
          C: "土台作り段階。量と連続性を最優先で。",
          D: "今は準備期。今日の1時間が未来を変えます。"
        };

        res.json({
          probability: prob,
          rank,
          comment: comments[rank],
          streak: p.streak,
          totalHours: totalHours.toFixed(1),
          avg7: Math.round(avg7)
        });
      }
    );
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

/* ===== 起動 ===== */
app.listen(3000, () => console.log("Server running"));
