const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Простое хранилище в памяти
let scores = [];

// Health check - всегда работает
app.get('/api/health', (req, res) => {
  console.log('✅ Health check passed');
  res.json({ 
    status: 'OK', 
    message: 'Сервер работает стабильно! 🚀',
    scoresCount: scores.length,
    timestamp: new Date().toISOString()
  });
});

// Сохранение результата
app.post('/api/save-score', (req, res) => {
  try {
    const { userId, username, score, streak, multiplier } = req.body;
    
    console.log('💾 Saving score:', { userId, username, score });
    
    // Просто сохраняем в массив
    scores.push({
      userId,
      username, 
      score,
      streak,
      multiplier,
      timestamp: new Date().toISOString()
    });
    
    // Ограничиваем размер массива
    if (scores.length > 1000) {
      scores = scores.slice(-500);
    }
    
    res.json({ 
      success: true, 
      message: 'Результат сохранен',
      totalScores: scores.length 
    });
    
  } catch (error) {
    console.error('❌ Error saving score:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Лидерборд
app.get('/api/leaderboard/daily', (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const todayScores = scores
      .filter(s => s.timestamp.includes(today))
      .sort((a, b) => b.score - a.score)
      .slice(0, 100)
      .map(({ userId, timestamp, ...rest }) => rest);
    
    res.json(todayScores);
  } catch (error) {
    res.json([]); // Всегда возвращаем массив
  }
});

app.get('/api/leaderboard/weekly', (req, res) => {
  try {
    const weeklyScores = scores
      .sort((a, b) => b.score - a.score)
      .slice(0, 100)
      .map(({ userId, timestamp, ...rest }) => rest);
    
    res.json(weeklyScores);
  } catch (error) {
    res.json([]);
  }
});

// Позиция пользователя
app.get('/api/user-position/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    res.json({ daily: 1, weekly: 1 }); // Упрощенная версия
  } catch (error) {
    res.json({ daily: 0, weekly: 0 });
  }
});

// Обработка всех ошибок
process.on('uncaughtException', (error) => {
  console.error('🔥 Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🔥 Unhandled Rejection at:', promise, 'reason:', reason);
});

// Запуск сервера
const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🎯 Server successfully started on port ${PORT}`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`💾 Storage: In-memory (${scores.length} scores)`);
});
