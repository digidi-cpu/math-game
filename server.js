const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors({
    origin: [
        'https://telegram.org',
        'https://web.telegram.org',
        'https://splendid-narwhal-b0f1fb.netlify.app',
        'https://*.netlify.app',
        'http://localhost:3000',
        'http://localhost:8080'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.options('*', cors());
app.use(express.json());

let scores = [];

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Сервер работает стабильно! 🚀',
    scoresCount: scores.length,
    timestamp: new Date().toISOString()
  });
});

app.post('/api/save-score', (req, res) => {
  try {
    const { userId, username, score, streak, multiplier } = req.body;
    
    if (!userId || score === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    scores = scores.filter(s => s.userId !== userId);
    
    scores.push({
      userId,
      username: username || 'Аноним', 
      score: Math.max(0, score),
      streak: Math.max(0, streak),
      multiplier: Math.max(1, multiplier),
      timestamp: new Date().toISOString()
    });
    
    if (scores.length > 1000) {
      scores = scores.slice(-500);
    }
    
    res.json({ 
      success: true, 
      message: 'Результат сохранен',
      totalScores: scores.length 
    });
    
  } catch (error) {
    console.error('Error saving score:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

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
    res.json([]);
  }
});

app.get('/api/user-position/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    
    const today = new Date().toISOString().split('T')[0];
    
    const dailyScores = scores
      .filter(s => s.timestamp.includes(today))
      .sort((a, b) => b.score - a.score);
    
    const dailyPosition = dailyScores.findIndex(s => s.userId === userId) + 1;
    
    const weeklyScores = scores
      .sort((a, b) => b.score - a.score);
      
    const weeklyPosition = weeklyScores.findIndex(s => s.userId === userId) + 1;
    
    res.json({ 
      daily: dailyPosition || 0, 
      weekly: weeklyPosition || 0 
    });
    
  } catch (error) {
    res.json({ daily: 0, weekly: 0 });
  }
});

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

app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🎯 Server running on port ${PORT}`);
});
