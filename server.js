const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

// PostgreSQL подключение (Railway автоматически предоставит DATABASE_URL)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Создание таблиц при запуске
async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS daily_scores (
      id SERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL,
      username VARCHAR(100) NOT NULL,
      score INTEGER NOT NULL,
      streak INTEGER NOT NULL,
      multiplier INTEGER NOT NULL,
      game_date DATE NOT NULL DEFAULT CURRENT_DATE,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(user_id, game_date)
    );
    
    CREATE TABLE IF NOT EXISTS weekly_scores (
      id SERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL,
      username VARCHAR(100) NOT NULL,
      score INTEGER NOT NULL,
      streak INTEGER NOT NULL,
      multiplier INTEGER NOT NULL,
      week_start DATE NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(user_id, week_start)
    );
    
    CREATE INDEX IF NOT EXISTS idx_daily_date ON daily_scores(game_date);
    CREATE INDEX IF NOT EXISTS idx_weekly_week ON weekly_scores(week_start);
  `);
  console.log('Database initialized');
}

initDatabase();

// Сохранение результата
app.post('/api/save-score', async (req, res) => {
  try {
    const { userId, username, score, streak, multiplier } = req.body;
    const today = new Date().toISOString().split('T')[0];
    const weekStart = getWeekStart();
    
    await pool.query(
      `INSERT INTO daily_scores (user_id, username, score, streak, multiplier, game_date) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       ON CONFLICT (user_id, game_date) 
       DO UPDATE SET score = GREATEST(daily_scores.score, $3),
                     username = $2,
                     streak = $4,
                     multiplier = $5,
                     created_at = NOW()`,
      [userId, username, score, streak, multiplier, today]
    );
    
    await pool.query(
      `INSERT INTO weekly_scores (user_id, username, score, streak, multiplier, week_start) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       ON CONFLICT (user_id, week_start) 
       DO UPDATE SET score = GREATEST(weekly_scores.score, $3),
                     username = $2,
                     streak = $4,
                     multiplier = $5,
                     created_at = NOW()`,
      [userId, username, score, streak, multiplier, weekStart]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving score:', error);
    res.status(500).json({ error: error.message });
  }
});

// Ежедневный лидерборд
app.get('/api/leaderboard/daily', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const result = await pool.query(
      `SELECT username, score, streak, multiplier 
       FROM daily_scores 
       WHERE game_date = $1 
       ORDER BY score DESC, created_at ASC 
       LIMIT 100`,
      [today]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching daily leaderboard:', error);
    res.status(500).json({ error: error.message });
  }
});

// Еженедельный лидерборд
app.get('/api/leaderboard/weekly', async (req, res) => {
  try {
    const weekStart = getWeekStart();
    const result = await pool.query(
      `SELECT username, score, streak, multiplier 
       FROM weekly_scores 
       WHERE week_start = $1 
       ORDER BY score DESC, created_at ASC 
       LIMIT 100`,
      [weekStart]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching weekly leaderboard:', error);
    res.status(500).json({ error: error.message });
  }
});

// Позиция пользователя
app.get('/api/user-position/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const today = new Date().toISOString().split('T')[0];
    const weekStart = getWeekStart();
    
    const dailyPosition = await pool.query(
      `SELECT COUNT(*) + 1 as position 
       FROM daily_scores 
       WHERE game_date = $1 AND score > (
         SELECT score FROM daily_scores WHERE user_id = $2 AND game_date = $1
       )`,
      [today, userId]
    );
    
    const weeklyPosition = await pool.query(
      `SELECT COUNT(*) + 1 as position 
       FROM weekly_scores 
       WHERE week_start = $1 AND score > (
         SELECT score FROM weekly_scores WHERE user_id = $2 AND week_start = $1
       )`,
      [weekStart, userId]
    );
    
    res.json({
      daily: parseInt(dailyPosition.rows[0]?.position) || 0,
      weekly: parseInt(weeklyPosition.rows[0]?.position) || 0
    });
  } catch (error) {
    console.error('Error fetching user position:', error);
    res.status(500).json({ error: error.message });
  }
});

// Статус сервера
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Вспомогательная функция для начала недели
function getWeekStart() {
  const date = new Date();
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff)).toISOString().split('T')[0];
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
});