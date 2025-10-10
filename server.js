// Сохранение результата
app.post('/api/save-score', (req, res) => {
  try {
    const { userId, username, score, streak, multiplier, sessionScore } = req.body;
    
    if (!userId || score === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    console.log('💾 Saving score:', { userId, username, score, sessionScore });
    
    // ИСПРАВЛЕНО: находим существующий результат пользователя
    const existingScore = scores.find(s => s.userId === userId);
    
    if (existingScore) {
      // Обновляем существующий результат
      existingScore.score = score; // это уже общая сумма с фронтенда
      existingScore.streak = Math.max(existingScore.streak, streak);
      existingScore.multiplier = Math.max(existingScore.multiplier, multiplier);
      existingScore.timestamp = new Date().toISOString();
    } else {
      // Создаем новый результат
      scores.push({
        userId,
        username: username || 'Аноним', 
        score: score,
        streak: streak,
        multiplier: multiplier,
        timestamp: new Date().toISOString()
      });
    }
    
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
