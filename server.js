const express = require('express');
const cors = require('cors');

const app = express();

// Безопасный CORS для Telegram Mini Apps
app.use(cors({
    origin: [
        'https://telegram.org',
        'https://web.telegram.org',
        'https://digidi-cpu.github.io', // ваш новый фронтенд
        'https://*.github.io', // все GitHub Pages
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
    
    // Валидация
    if (!userId || score === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    console.log('💾 Saving score:', { userId, username, score });
    
    // Удаляем старый результат пользователя (если есть)
    scores = scores.filter(s => s.userId !== userId);
    
    // Сохраняем новый результат
    scores.push({
      userId,
      username: username || 'Аноним', 
      score: Math.max(0, score),
      streak: Math.max(0, streak),
      multiplier: Math.max(1, multiplier),
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
      .slice(0, 50)
      .map((score, index) => ({
        ...score,
        rank: index + 1
      }));
    
    res.json(todayScores);
  } catch (error) {
    console.error('Error daily leaderboard:', error);
    res.json([]);
  }
});

app.get('/api/leaderboard/weekly', (req, res) => {
  try {
    const weeklyScores = scores
      .sort((a, b) => b.score - a.score)
      .slice(0, 50)
      .map((score, index) => ({
        ...score,
        rank: index + 1
      }));
    
    res.json(weeklyScores);
  } catch (error) {
    console.error('Error weekly leaderboard:', error);
    res.json([]);
  }
});

// Позиция пользователя (исправленная логика)
app.get('/api/user-position/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    
    const today = new Date().toISOString().split('T')[0];
    
    // Дневной рейтинг
    const dailyScores = scores
      .filter(s => s.timestamp.includes(today))
      .sort((a, b) => b.score - a.score);
    
    const dailyPosition = dailyScores.findIndex(s => s.userId === userId) + 1;
    
    // Недельный рейтинг  
    const weeklyScores = scores
      .sort((a, b) => b.score - a.score);
      
    const weeklyPosition = weeklyScores.findIndex(s => s.userId === userId) + 1;
    
    res.json({ 
      daily: dailyPosition || 0, 
      weekly: weeklyPosition || 0 
    });
    
  } catch (error) {
    console.error('Error user position:', error);
    res.json({ daily: 0, weekly: 0 });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Math Game API is running!',
    endpoints: [
      'GET /api/health',
      'POST /api/save-score',
      'GET /api/leaderboard/daily', 
      'GET /api/leaderboard/weekly',
      'GET /api/user-position/:userId'
    ]
  });
});

// Обработка 404
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
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
  console.log(`🌐 CORS enabled for: digidi-cpu.github.io`);
});
