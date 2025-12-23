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

/* ===== AI分析（実データ連動・早稲田商学部特化） ===== */
app.post("/api/ai-analysis", (req, res) => {
  const { userId } = req.body;
  const today = new Date().toISOString().slice(0, 10);

  const subjects = [
    "歴史",
    "リーディング",
    "リスニング",
    "スピーキング",
    "国語"
  ];

  const comments = {
    none: [
      "今日はまだ未着手ですが、今からでも十分巻き返せます。",
      "焦る必要はありません。明確に弱点として把握できています。"
    ],
    low: [
      "短時間でも集中できているのが素晴らしいです。",
      "最低限の接触ができているのは評価できます。"
    ],
    mid: [
      "合格圏に近づく非常に良い学習量です。",
      "このペースを維持できれば商学部レベルに到達します。"
    ],
    high: [
      "完全に早稲田商学部レベルの学習量です。",
      "この量を継続できる受験生は多くありません。"
    ]
  };

  // 今日の科目別学習時間
  db.all(
    `
    SELECT s.name, SUM(l.minutes) as minutes
    FROM logs l
    JOIN subjects s ON l.subjectId = s.id
    WHERE l.userId=? AND l.date=?
    GROUP BY s.name
    `,
    [userId, today],
    (e, rows) => {

      db.get(
        "SELECT totalMinutes, streak FROM profile WHERE userId=?",
        [userId],
        (e, p) => {

          const totalHours = (p.totalMinutes / 60).toFixed(1);
          const progress = Math.min(
            Math.floor((p.totalMinutes / (3000 * 60)) * 100),
            100
          );

          const analysis = subjects.map(sub => {
            const row = rows.find(r => r.name === sub);
            const min = row ? row.minutes : 0;

            let level;
            if (min === 0) level = "none";
            else if (min < 40) level = "low";
            else if (min < 90) level = "mid";
            else level = "high";

            return {
              subject: sub,
              minutes: min,
              priority: min < 60 ? "重点" : "維持",
              comment:
                comments[level][
                  Math.floor(Math.random() * comments[level].length)
                ]
            };
          });

          let overall;
          if (progress < 10) {
            overall =
              "学習習慣が形成され始めています。今は量より継続が最優先です。";
          } else if (progress < 40) {
            overall =
              "基礎固めとして理想的な段階です。合格に向けて順調です。";
          } else if (progress < 70) {
            overall =
              "早稲田大学商学部の合格圏が現実的に見えてきました。";
          } else {
            overall =
              "完成度が非常に高く、自信を持って過去問演習に入れる段階です。";
          }

          res.json({
            streak: p.streak,
            progress,
            recommendMinutes: 180 + p.streak * 5,
            analysis,
            overall
          });
        }
      );
    }
  );
});

/* ===== ユーザー情報 ===== */
app.get("/api/user/:userId", (req, res) => {
  db.get(
    "SELECT nickname FROM users WHERE id=?",
    [req.params.userId],
    (e, row) => res.json(row)
  );
});


/* ===== 起動 ===== */
app.listen(3000, () => console.log("Server running"));
