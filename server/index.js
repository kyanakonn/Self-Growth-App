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

　db.run(`
  CREATE TABLE IF NOT EXISTS exams (
    id TEXT,
    userId TEXT,
    type TEXT,
    subject TEXT,
    score INTEGER,
    date TEXT
  )
`);


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

app.post("/api/ai-analysis", (req, res) => {
  const { userId } = req.body;
  const today = new Date().toISOString().slice(0, 10);

  const subjects = ["歴史","リーディング","リスニング","スピーキング","国語"];

  const unlockComments = [
    { days: 60, text: "到達点が異次元です。商学部トップ層と同水準です。" },
    { days: 30, text: "完全に合格圏内。今後は質の調整フェーズです。" },
    { days: 14, text: "受験生として非常に完成度が高い状態です。" },
    { days: 7,  text: "明確に受験生レベルへ移行しています。" },
    { days: 3,  text: "学習が習慣として定着し始めました。" }
  ];

  db.get(
    "SELECT * FROM profile WHERE userId=?",
    [userId],
    (e, profile) => {

      db.all(
        `
        SELECT s.name, SUM(l.minutes) as minutes
        FROM logs l JOIN subjects s ON l.subjectId=s.id
        WHERE l.userId=? AND l.date=?
        GROUP BY s.name
        `,
        [userId, today],
        (e, rows) => {

          db.all(
            "SELECT * FROM exams WHERE userId=? ORDER BY date DESC",
            [userId],
            (e, exams) => {

              const analysis = subjects.map(sub => {
                const r = rows.find(x => x.name === sub);
                const min = r ? r.minutes : 0;
                const exam = exams.find(x => x.subject === sub);

                let advice = "";

                if (min === 0) {
                  advice = "今日は未学習。最低20分で接触頻度を保ちましょう。";
                } else if (min < 40) {
                  advice = "時間が短め。明日は+20分が理想です。";
                } else if (min < 90) {
                  advice = "理想的な学習量です。継続が最優先。";
                } else {
                  advice = "学習量は十分。次は精度を意識してください。";
                }

                if (exam) {
                  if (exam.score >= 65 && min < 60) {
                    advice += " 偏差値は高いですが演習量が不足しています。";
                  }
                  if (exam.score < 55 && min >= 90) {
                    advice += " 時間は取れているので、方法改善が鍵です。";
                  }
                }

                return {
                  subject: sub,
                  minutes: min,
                  score: exam ? exam.score : null,
                  priority: min < 60 ? "重点" : "維持",
                  comment: advice
                };
              });

              const unlock =
                unlockComments.find(u => profile.streak >= u.days)?.text || null;

              const progress = Math.floor(
                (profile.totalMinutes / (3000 * 60)) * 100
              );

              res.json({
                streak: profile.streak,
                progress,
                recommendMinutes: 180 + profile.streak * 5,
                unlockComment: unlock,
                analysis,
                overall:
                  unlock ||
                  "学習量と継続の両面で順調です。この調子を保ちましょう。"
              });
            }
          );
        }
      );
    }
  );
});


app.post("/api/exam", (req, res) => {
  const { userId, type, subject, score } = req.body;
  const date = new Date().toISOString().slice(0, 10);

  db.run(
    "INSERT INTO exams VALUES (?,?,?,?,?,?)",
    [crypto.randomUUID(), userId, type, subject, score, date],
    () => res.json({ ok: true })
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
