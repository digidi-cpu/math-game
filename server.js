const express = require('express');
const cors = require('cors');

const app = express();

// Безопасный CORS для Telegram Mini Apps
app.use(cors({
    origin: [
        'https://telegram.org',
        'https://web.telegram.org',
        'https://digidi-cpu.github.io',
        'https://*.github.io',
        'http://localhost:3000',
        'http://localhost:8080'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Обработка preflight OPTIONS запросов
app.options('*', cors());

app.use(express.json());

// Хранилище в памяти
let scores = [];

// Health check
app.get('/api/health', (req, res) => {
  console.log('✅ Health check passed');
  res.json({ 
    status: 'OK', 
    message: 'Сервер работает стабильно! 🚀',
    scoresCount: scores.length,
    timestamp: new Date().toISOString()
  });
});

// Сохранение результата с суммированием очков
app.post('/api/save-score', (req, res) => {
  try {
    const { userId, username, score, streak, multiplier, sessionScore } = req.body;
    
    // Валидация
    if (!userId || score === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    console.log('💾 Saving score:', { 
      userId, 
      username, 
      totalScore: score,
      sessionScore: sessionScore || 0,
      streak, 
      multiplier 
    });
    
    // Находим существующий результат пользователя
    const existingScoreIndex = scores.findIndex(s => s.userId === userId);
    
    if (existingScoreIndex !== -1) {
      // Обновляем существующий результат - используем общую сумму с фронтенда
      scores[existingScoreIndex].score = score;
      scores[existingScoreIndex].streak = Math.max(scores[existingScoreIndex].streak, streak);
      scores[existingScoreIndex].multiplier = Math.max(scores[existingScoreIndex].multiplier, multiplier);
      scores[existingScoreIndex].username = username || scores[existingScoreIndex].username;
      scores[existingScoreIndex].lastSessionScore = sessionScore || 0;
      scores[existingScoreIndex].gamesPlayed = (scores[existingScoreIndex].gamesPlayed || 1) + 1;
      scores[existingScoreIndex].timestamp = new Date().toISOString();
      
      console.log('📊 Updated user score:', scores[existingScoreIndex]);
    } else {
      // Создаем новый результат
      const newScore = {
        userId,
        username: username || 'Аноним', 
        score: score,
        streak: streak,
        multiplier: multiplier,
        lastSessionScore: sessionScore || 0,
        gamesPlayed: 1,
        firstPlayed: new Date().toISOString(),
        timestamp: new Date().toISOString()
      };
      
      scores.push(newScore);
      console.log('🆕 New user score:', newScore);
    }
    
    // Ограничиваем размер массива
    if (scores.length > 1000) {
      scores = scores.slice(-500);
    }
    
    res.json({ 
      success: true, 
      message: 'Результат сохранен',
      totalScores: scores.length,
      userScore: scores.find(s => s.userId === userId)
    });
    
  } catch (error) {
    console.error('❌ Error saving score:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Ежедневный лидерборд
app.get('/api/leaderboard/daily', (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Фильтруем по сегодняшним играм
    const todayScores = scores
      .filter(s => {
        const scoreDate = s.timestamp.split('T')[0];
        return scoreDate === today;
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 50)
      .map((score, index) => ({
        userId: score.userId,
        username: score.username,
        score: score.score,
        streak: score.streak,
        multiplier: score.multiplier,
        lastSessionScore: score.lastSessionScore,
        gamesPlayed: score.gamesPlayed,
        rank: index + 1
      }));
    
    console.log(`📅 Daily leaderboard: ${todayScores.length} scores for ${today}`);
    res.json(todayScores);
    
  } catch (error) {
    console.error('Error daily leaderboard:', error);
    res.json([]);
  }
});

// Недельный лидерборд (все время)
app.get('/api/leaderboard/weekly', (req, res) => {
  try {
    const weeklyScores = scores
      .sort((a, b) => b.score - a.score)
      .slice(0, 50)
      .map((score, index) => ({
        userId: score.userId,
        username: score.username,
        score: score.score,
        streak: score.streak,
        multiplier: score.multiplier,
        lastSessionScore: score.lastSessionScore,
        gamesPlayed: score.gamesPlayed,
        rank: index + 1
      }));
    
    console.log(`📊 Weekly leaderboard: ${weeklyScores.length} scores total`);
    res.json(weeklyScores);
    
  } catch (error) {
    console.error('Error weekly leaderboard:', error);
    res.json([]);
  }
});

// Позиция пользователя в лидербордах
app.get('/api/user-position/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const today = new Date().toISOString().split('T')[0];
    
    if (!userId) {
      return res.json({ daily: 0, weekly: 0 });
    }
    
    // Дневной рейтинг
    const dailyScores = scores
      .filter(s => {
        const scoreDate = s.timestamp.split('T')[0];
        return scoreDate === today;
      })
      .sort((a, b) => b.score - a.score);
    
    const dailyPosition = dailyScores.findIndex(s => s.userId === userId) + 1;
    
    // Недельный рейтинг  
    const weeklyScores = scores
      .sort((a, b) => b.score - a.score);
      
    const weeklyPosition = weeklyScores.findIndex(s => s.userId === userId) + 1;
    
    const userScore = scores.find(s => s.userId === userId);
    
    console.log(`👤 User position: ${userId} - daily: ${dailyPosition}, weekly: ${weeklyPosition}`);
    
    res.json({ 
      daily: dailyPosition || 0, 
      weekly: weeklyPosition || 0,
      totalScore: userScore?.score || 0,
      gamesPlayed: userScore?.gamesPlayed || 0
    });
    
  } catch (error) {
    console.error('Error user position:', error);
    res.json({ daily: 0, weekly: 0, totalScore: 0, gamesPlayed: 0 });
  }
});

// Получить статистику пользователя
app.get('/api/user-stats/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const userScore = scores.find(s => s.userId === userId);
    
    if (!userScore) {
      return res.json({
        exists: false,
        totalScore: 0,
        gamesPlayed: 0,
        bestStreak: 0,
        bestMultiplier: 1
      });
    }
    
    res.json({
      exists: true,
      totalScore: userScore.score,
      gamesPlayed: userScore.gamesPlayed,
      bestStreak: userScore.streak,
      bestMultiplier: userScore.multiplier,
      lastSessionScore: userScore.lastSessionScore,
      firstPlayed: userScore.firstPlayed,
      lastPlayed: userScore.timestamp
    });
    
  } catch (error) {
    console.error('Error user stats:', error);
    res.json({
      exists: false,
      totalScore: 0,
      gamesPlayed: 0,
      bestStreak: 0,
      bestMultiplier: 1
    });
  }
});

// Сброс всех результатов (для тестирования)
app.delete('/api/reset-scores', (req, res) => {
  try {
    const previousCount = scores.length;
    scores = [];
    console.log('🗑️ All scores reset');
    res.json({ 
      success: true, 
      message: 'All scores reset',
      previousScores: previousCount,
      currentScores: 0
    });
  } catch (error) {
    console.error('Error resetting scores:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Получить все результаты (для администрирования)
app.get('/api/all-scores', (req, res) => {
  try {
    res.json({
      totalScores: scores.length,
      scores: scores.sort((a, b) => b.score - a.score)
    });
  } catch (error) {
    console.error('Error getting all scores:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Math Game API is running! 🚀',
    version: '1.0.0',
    endpoints: [
      'GET  /api/health',
      'POST /api/save-score',
      'GET  /api/leaderboard/daily', 
      'GET  /api/leaderboard/weekly',
      'GET  /api/user-position/:userId',
      'GET  /api/user-stats/:userId',
      'GET  /api/all-scores',
      'DELETE /api/reset-scores'
    ],
    statistics: {
      totalPlayers: scores.length,
      topScore: scores.length > 0 ? Math.max(...scores.map(s => s.score)) : 0,
      activeToday: scores.filter(s => s.timestamp.split('T')[0] === new Date().toISOString().split('T')[0]).length
    }
  });
});

// Обработка 404
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    availableEndpoints: [
      '/api/health',
      '/api/save-score',
      '/api/leaderboard/daily',
      '/api/leaderboard/weekly',
      '/api/user-position/:userId'
    ]
  });
});

// Глобальная обработка ошибок
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
  console.log(`🌐 CORS enabled for: GitHub Pages & Telegram`);
  console.log(`📊 API endpoints ready!`);
  console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
});
