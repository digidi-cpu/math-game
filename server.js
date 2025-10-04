const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Временное хранилище в памяти
let dailyScores = [];
let weeklyScores = [];

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Сервер работает! 🚀',
    database: 'In-memory (temporary)',
    timestamp: new Date().toISOString()
  });
});

// Сохранение результата
app.post('/api/save-score', (req, res) => {
  try {
    const { userId, username, score, streak, multiplier } = req.body;
    const today = new Date().toISOString().split('T')[0];
    
    // Сохраняем в ежедневный рейтинг
    const dailyIndex = dailyScores.findIndex(s => s.userId === userId && s.date === today);
    if (dailyIndex !== -1) {
      if (score > dailyScores[dailyIndex].score) {
        dailyScores[dailyIndex] = { userId, username, score, streak, multiplier, date: today };
      }
    } else {
      dailyScores.push({ userId, username, score, streak, multiplier, date: today });
    }
    
    // Сохраняем в еженедельный рейтинг
    const weekStart = getWeekStart();
    const weeklyIndex = weeklyScores.findIndex(s => s.userId === userId && s.weekStart === weekStart);
    if (weeklyIndex !== -1) {
      if (score > weeklyScores[weeklyIndex].score) {
        weeklyScores[weeklyIndex] = { userId, username, score, streak, multiplier, weekStart };
      }
    } else {
      weeklyScores.push({ userId, username, score, streak, multiplier, weekStart });
    }
    
    // Сортируем по очкам
    dailyScores.sort((a, b) => b.score - a.score);
    weeklyScores.sort((a, b) => b.score - a.score);
    
    res.json({ success: true, message: 'Результат сохранен' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Ежедневный лидерборд
app.get('/api/leaderboard/daily', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const todayScores = dailyScores
    .filter(s => s.date === today)
    .slice(0, 100)
    .map(({ userId, date, ...rest }) => rest); // Убираем служебные поля
  
  res.json(todayScores);
});

// Еженедельный лидерборд
app.get('/api/leaderboard/weekly', (req, res) => {
  const weekStart = getWeekStart();
  const weekScores = weeklyScores
    .filter(s => s.weekStart === weekStart)
    .slice(0, 100)
    .map(({ userId, weekStart, ...rest }) => rest);
  
  res.json(weekScores);
});

// Позиция пользователя
app.get('/api/user-position/:userId', (req, res) => {
  const { userId } = req.params;
  const today = new Date().toISOString().split('T')[0];
  const weekStart = getWeekStart();
  
  const dailyPosition = dailyScores
    .filter(s => s.date === today)
    .findIndex(s => s.userId === userId) + 1;
    
  const weeklyPosition = weeklyScores
    .filter(s => s.weekStart === weekStart)
    .findIndex(s => s.userId === userId) + 1;
  
  res.json({
    daily: dailyPosition || 0,
    weekly: weeklyPosition || 0
  });
});

// Вспомогательная функция для начала недели
function getWeekStart() {
  const date = new Date();
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff)).toISOString().split('T')[0];
}

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Health check: http://0.0.0.0:${PORT}/api/health`);
  console.log(`💾 Database: In-memory storage (temporary)`);
});
