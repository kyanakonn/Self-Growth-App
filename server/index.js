import express from "express";
import sqlite3 from "sqlite3";
import { v4 as uuidv4 } from "uuid";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

/* ===== 基本設定 ===== */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// public 配信
app.use(express.static(path.join(__dirname, "../public")));

/* ===== DB ===== */
const db = new sqlite3.Database("./db.sqlite");

/* ===== DB初期化 ===== */
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
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
      weeklyTarget INTEGER
    )
  `);
});

/* ===== ヘルスチェック ===== */
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

/* ===== 新規 / 引き継ぎ ===== */
app.post("/api/login", (req, res) => {
  const { code } = req.body;

  // 引き継ぎ
  if (code) {
    db.get("SELECT id FROM users WHERE id=?", [code], (err, row) => {
      if (!row) return res.status(404).json({ error: "not found" });
      res.json({ userId: code });
    });
    return;
  }

  // 新規
  const userId = uuidv4();
  db.run("INSERT INTO users VALUES (?,?)", [userId, Date.now()]);
  db.run(
    "INSERT INTO profile VALUES (?,?,?,?,?,?,?)",
    [userId, 0, 1, 0, 0, 0, 600]
  );
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
  db.run(
    "INSERT INTO subjects VALUES (?,?,?)",
    [uuidv4(), userId, name],
    () => res.json({ ok: true })
  );
});

app.delete("/api/subject/:id", (req, res) => {
  db.run("DELETE FROM subjects WHERE id=?", [req.params.id], () =>
    res.json({ ok: true })
  );
});

/* ===== ログ記録 ===== */
app.post("/api/log", (req, res) => {
  const { userId, subjectId, minutes } = req.body;
  const date = new Date().toISOString().slice(0, 10);

  db.run(
    "INSERT INTO logs VALUES (?,?,?,?,?)",
    [uuidv4(), userId, subjectId, minutes, date]
  );

  // EXP & レベル計算
  db.get("SELECT * FROM profile WHERE userId=?", [userId], (e, p) => {
    let exp = p.exp + minutes;
    let level = p.level;

    let need = Math.floor(30 * Math.pow(level, 1.9));
    let leveledUp = false;

    while (exp >= need) {
      exp -= need;
      level++;
      leveledUp = true;
      need = Math.floor(30 * Math.pow(level, 1.9));
    }

    db.run(
      `UPDATE profile
       SET exp=?, level=?, totalMinutes=totalMinutes+?
       WHERE userId=?`,
      [exp, level, minutes, userId]
    );

    calcStreak(userId);

    res.json({ ok: true, level, exp, leveledUp });
  });
});

/* ===== プロフィール ===== */
app.get("/api/profile/:userId", (req, res) => {
  db.get(
    "SELECT * FROM profile WHERE userId=?",
    [req.params.userId],
    (e, row) => res.json(row)
  );
});

/* ===== ログ取得 ===== */
app.get("/api/logs/:userId", (req, res) => {
  db.all(
    "SELECT * FROM logs WHERE userId=?",
    [req.params.userId],
    (e, rows) => res.json(rows)
  );
});

/* ===== ストリーク計算 ===== */
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

/* ===== 週間目標 ===== */
app.post("/api/weekly-target", (req, res) => {
  const { userId, minutes } = req.body;
  db.run(
    "UPDATE profile SET weeklyTarget=? WHERE userId=?",
    [minutes, userId],
    () => res.json({ ok: true })
  );
});

// ===== AI分析（早稲田商学部特化・疑似AI） =====
app.post("/api/ai-analysis", (req, res) => {
  const { userId } = req.body;
  const today = new Date().toISOString().slice(0, 10);

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
        "SELECT totalMinutes FROM profile WHERE userId=?",
        [userId],
        (e, p) => {
          const totalHours = (p.totalMinutes / 60).toFixed(1);
          const progress = Math.min(
            Math.floor((p.totalMinutes / (3000 * 60)) * 100),
            100
          );

          const subjects = ["英語", "世界史", "国語"];
          const analysis = subjects.map(sub => {
            const row = rows.find(r => r.name === sub);
            const min = row ? row.minutes : 0;

            let praise =
              min === 0
                ? "今日はまだですが、焦らなくて大丈夫。明日が本番です。"
                : min < 60
                ? "短時間でも机に向かったのが素晴らしいです。"
                : min < 120
                ? "とても良いペースです。この積み重ねが合格に直結します。"
                : "完璧です。早稲田商学部レベルの学習量です。";

            return {
              subject: sub,
              minutes: min,
              comment: praise
            };
          });

          let overall =
            progress < 10
              ? "スタートとしては十分。今は習慣化できていることが最大の成果です。"
              : progress < 40
              ? "基礎を積み上げる最高の時期です。確実に合格へ近づいています。"
              : progress < 70
              ? "早稲田商学部合格圏内が見えてきました。非常に順調です。"
              : "完成度がかなり高いです。自信を持ってください。";

          res.json({
            date: today,
            totalHours,
            progress,
            analysis,
            overall
          });
        }
      );
    }
  );
});


/* ===== 起動 ===== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
