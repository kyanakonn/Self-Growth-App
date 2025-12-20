import express from "express";
import sqlite3 from "sqlite3";
import { v4 as uuidv4 } from "uuid";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// ===== public（※APIだけ使うなら不要だが安全のため）=====
app.use(express.static(path.join(__dirname, "../public")));


// ===== DB =====
const db = new sqlite3.Database("./db.sqlite");

// ===== DB初期化 =====
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      createdAt INTEGER
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS subjects (
      id TEXT,
      userId TEXT,
      name TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS logs (
      id TEXT,
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
      weeklyTarget INTEGER
    )
  `);
});

// ===== ヘルスチェック（超重要）=====
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// ===== 新規 or 引き継ぎ =====
app.post("/api/login", (req, res) => {
  const { code } = req.body;

  if (code) {
    db.get("SELECT * FROM users WHERE id=?", [code], (e, row) => {
      if (!row) return res.status(404).json({ error: "not found" });
      res.json({ userId: code });
    });
  } else {
    const id = uuidv4();
    db.run("INSERT INTO users VALUES (?,?)", [id, Date.now()]);
    db.run(
      "INSERT INTO profile VALUES (?,?,?,?,?,?,?)",
      [id, 0, 1, 0, 0, 0, 600]
    );
    res.json({ userId: id });
  }
});

// ===== 科目 =====
app.post("/api/subject", (req, res) => {
  const { userId, name } = req.body;
  db.run("INSERT INTO subjects VALUES (?,?,?)", [
    uuidv4(),
    userId,
    name
  ]);
  res.json({ ok: true });
});

app.get("/api/subjects/:userId", (req, res) => {
  db.all(
    "SELECT * FROM subjects WHERE userId=?",
    [req.params.userId],
    (e, r) => res.json(r)
  );
});

// ===== 記録 =====
app.post("/api/log", (req, res) => {
  const { userId, subjectId, minutes } = req.body;
  const date = new Date().toISOString().slice(0, 10);

  db.run(
    "INSERT INTO logs VALUES (?,?,?,?,?)",
    [uuidv4(), userId, subjectId, minutes, date]
  );

  db.get("SELECT * FROM profile WHERE userId=?", [userId], (e, p) => {
    let exp = p.exp + minutes;
    let level = p.level;
    let need = level * level * 100;

    while (exp >= need) {
      exp -= need;
      level++;
      need = level * level * 100;
    }

    db.run(
      "UPDATE profile SET exp=?, level=?, totalMinutes=totalMinutes+? WHERE userId=?",
      [exp, level, minutes, userId]
    );

    calcStreak(userId);
    res.json({ ok: true, level, exp });
  });
});

// ===== プロフィール =====
app.get("/api/profile/:userId", (req, res) => {
  db.get(
    "SELECT * FROM profile WHERE userId=?",
    [req.params.userId],
    (e, r) => res.json(r)
  );
});

// ===== ログ取得 =====
app.get("/api/logs/:userId", (req, res) => {
  db.all(
    "SELECT * FROM logs WHERE userId=?",
    [req.params.userId],
    (e, r) => res.json(r)
  );
});

// ===== ストリーク計算 =====
function calcStreak(userId) {
  db.all(
    "SELECT DISTINCT date FROM logs WHERE userId=? ORDER BY date DESC",
    [userId],
    (e, rows) => {
      let streak = 0;
      let prev = null;

      for (const r of rows) {
        const d = new Date(r.date);
        if (!prev) streak = 1;
        else {
          const diff = (prev - d) / 86400000;
          if (diff === 1) streak++;
          else break;
        }
        prev = d;
      }

// 週間目標変更
app.post("/api/weekly-target", (req, res) => {
  const { userId, minutes } = req.body;
  db.run(
    "UPDATE profile SET weeklyTarget=? WHERE userId=?",
    [minutes, userId],
    () => res.json({ ok: true })
  );
});

      db.get(
        "SELECT maxStreak FROM profile WHERE userId=?",
        [userId],
        (e, p) => {
          db.run(
            "UPDATE profile SET streak=?, maxStreak=? WHERE userId=?",
            [streak, Math.max(streak, p.maxStreak), userId]
          );
        }
      );
    }
  );
}

import fetch from "node-fetch";

app.post("/api/ai-analysis", async (req, res) => {
  const { userId, targetUniv, mock } = req.body;

  // 学習ログ取得
  db.all(
    `SELECT subjectId, SUM(minutes) as minutes 
     FROM logs WHERE userId=? GROUP BY subjectId`,
    [userId],
    async (e, rows) => {

      // 科目名変換
      const subjects = {};
      for (const r of rows) {
        subjects[r.subjectId] = r.minutes;
      }

      const prompt = `
あなたは日本の大学受験専門AIです。

【志望大学】
${targetUniv}

【学習時間（分）】
${JSON.stringify(subjects, null, 2)}

【模試成績】
${JSON.stringify(mock, null, 2)}

以下を出力してください：
1. 現在の勉強配分の評価
2. 問題点
3. 次の1週間の具体的勉強時間配分（時間）
4. 今日やるべきこと3つ

日本語で、受験生向けに厳しめに。
`;

      const r2 = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4.1-mini",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.4
        })
      });

      const data = await r2.json();
      res.json({ result: data.choices[0].message.content });
    }
  );
});

// ===== 起動（Render対応）=====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
