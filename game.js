class TelegramIntegration {
    constructor() {
        this.tg = window.Telegram?.WebApp;
        this.isTelegram = !!this.tg;
        this.init();
    }

    init() {
        if (!this.isTelegram) {
            console.log('Telegram Web App not detected, running in browser mode');
            this.setupBrowserMode();
            return;
        }

        this.tg.expand();
        this.tg.enableClosingConfirmation();
        this.tg.ready();
        this.applyTelegramTheme();
        this.setupTelegramUI();
        this.tg.onEvent('themeChanged', this.applyTelegramTheme.bind(this));
    }

    applyTelegramTheme() {
        document.body.classList.add('tg-app');
        if (this.tg.themeParams) {
            const root = document.documentElement;
            Object.entries(this.tg.themeParams).forEach(([key, value]) => {
                if (value) root.style.setProperty(`--tg-theme-${key}`, value);
            });
        }
    }

    setupTelegramUI() {
        this.showUserWelcome();
        this.setupMainButton();
        document.getElementById('share').style.display = 'none';
    }

    showUserWelcome() {
        const user = this.tg.initDataUnsafe?.user;
        if (user) {
            const welcomeElement = document.getElementById('userWelcome');
            if (welcomeElement) {
                welcomeElement.style.display = 'block';
                welcomeElement.innerHTML = `
                    Привет, ${user.first_name || 'Космонавт'}! 🎮
                    ${user.username ? `<br><small>@${user.username}</small>` : ''}
                `;
            }
        }
    }

    setupMainButton() {
        this.tg.MainButton.setText('Поделиться результатом');
        this.tg.MainButton.onClick(this.shareResults.bind(this));
        this.tg.MainButton.hide();
    }

    showMainButton(visible) {
        if (visible) {
            this.tg.MainButton.show();
        } else {
            this.tg.MainButton.hide();
        }
    }

    shareResults(score, streak, multiplier) {
        const shareText = `🚀 Я набрал ${score} очков в Космическом Математическом Бое! 
Страйк: ${streak}, Множитель: x${multiplier}`;

        this.tg.showPopup({
            title: 'Поделиться результатом',
            message: shareText,
            buttons: [
                {id: 'share', type: 'default', text: 'Поделиться'},
                {type: 'cancel'}
            ]
        }, (buttonId) => {
            if (buttonId === 'share') {
                this.sendToTelegram(shareText);
            }
        });
    }

    sendToTelegram(text) {
        const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(text)}`;
        window.open(shareUrl, '_blank');
    }

    setupBrowserMode() {
        document.getElementById('share').style.display = 'inline-block';
    }
}

class GameAPI {
    constructor() {
        this.baseURL = 'https://math-game-production-f196.up.railway.app';
    }

    async saveScore(userData) {
        try {
            const response = await fetch(`${this.baseURL}/api/save-score`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userData)
            });
            return await response.json();
        } catch (error) {
            console.error('Error saving score:', error);
        }
    }

    async getDailyLeaderboard() {
        try {
            const response = await fetch(`${this.baseURL}/api/leaderboard/daily`);
            return await response.json();
        } catch (error) {
            console.error('Error fetching daily leaderboard:', error);
            return [];
        }
    }

    async getWeeklyLeaderboard() {
        try {
            const response = await fetch(`${this.baseURL}/api/leaderboard/weekly`);
            return await response.json();
        } catch (error) {
            console.error('Error fetching weekly leaderboard:', error);
            return [];
        }
    }

    async getUserPosition(userId) {
        try {
            const response = await fetch(`${this.baseURL}/api/user-position/${userId}`);
            return await response.json();
        } catch (error) {
            console.error('Error fetching user position:', error);
            return { daily: 0, weekly: 0 };
        }
    }
}

class MathGame {
    constructor() {
        this.score = 0;
        this.timeLeft = 60;
        this.streak = 0;
        this.multiplier = 1;
        this.selectedRocket = null;
        this.activeRockets = new Map();
        this.activePlanets = new Map();
        this.correctAnswers = new Map();
        this.rocketCounter = 0;
        this.planetCounter = 0;
        this.spawnInterval = null;
        this.timer = null;
        this.isMobile = this.checkMobile();
        
        this.tg = new TelegramIntegration();
        this.api = new GameAPI();
        this.userId = this.getUserId();
        
        this.rocketImages = ['https://i.imgur.com/tP950oJ.png'];
        this.planetImages = [
            'https://i.imgur.com/DO3jQJd.png',
            'https://i.imgur.com/O4Cpefe.png',
            'https://i.imgur.com/MzJB39S.png', 
            'https://i.imgur.com/KcDW0uG.png'
        ];
        this.bombImage = 'https://i.imgur.com/v9hisDN.png';
        
        this.occupiedPositions = new Set();
        this.leaderboard = { daily: [], weekly: [] };
        
        this.setupViewport();
        this.initializeGame();
        this.createStars();
        this.preloadImages();
    }

    setupViewport() {
        const viewport = document.querySelector('meta[name="viewport"]');
        if (viewport && this.isMobile) {
            viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover');
        }
        
        document.body.style.width = '100vw';
        document.body.style.height = '100vh';
        document.body.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
    }

    checkMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
               window.innerWidth <= 768 ||
               (window.Telegram && window.Telegram.WebApp);
    }

    preloadImages() {
        const allImages = [...this.rocketImages, ...this.planetImages, this.bombImage];
        allImages.forEach(src => { const img = new Image(); img.src = src; });
    }

    initializeGame() {
        this.startSpawning();
        this.startTimer();
        this.setupEventListeners();
        this.updateUI();
    }

    startSpawning() {
        for (let i = 0; i < 5; i++) {
            setTimeout(() => this.spawnRocket(), i * 1000);
        }
        setTimeout(() => {
            for (let i = 0; i < 5; i++) {
                setTimeout(() => this.spawnPlanet(), i * 1000);
            }
        }, 1500);
        this.spawnInterval = setInterval(() => {
            this.maintainRockets();
            this.maintainPlanets();
        }, 1000);
    }

    getFreePosition(elementWidth, elementHeight, padding = 10) {
        const gameArea = document.getElementById('gameArea');
        if (!gameArea) return padding;
        
        const maxX = gameArea.offsetWidth - elementWidth - padding;
        const minX = padding;
        
        const maxAttempts = this.isMobile ? 20 : 50;
        let attempts = 0;
        
        while (attempts < maxAttempts) {
            const x = minX + Math.random() * (maxX - minX);
            const positionKey = this.getPositionKey(x, elementWidth);
            
            if (!this.occupiedPositions.has(positionKey)) {
                this.occupiedPositions.add(positionKey);
                return x;
            }
            attempts++;
        }
        
        return minX + Math.random() * (maxX - minX);
    }

    getPositionKey(x, width) {
        const gridSize = width + 40;
        const gridX = Math.floor(x / gridSize);
        return `pos_${gridX}`;
    }

    freePosition(x, width) {
        const positionKey = this.getPositionKey(x, width);
        this.occupiedPositions.delete(positionKey);
    }

    maintainRockets() {
        const currentRockets = this.activeRockets.size;
        const neededRockets = (this.isMobile ? 4 : 5) - currentRockets;
        if (neededRockets > 0) {
            for (let i = 0; i < neededRockets; i++) {
                setTimeout(() => this.spawnRocket(), i * 800);
            }
        }
    }

    maintainPlanets() {
        const currentPlanets = this.activePlanets.size;
        const neededPlanets = (this.isMobile ? 4 : 5) - currentPlanets;
        if (neededPlanets > 0) {
            for (let i = 0; i < neededPlanets; i++) {
                setTimeout(() => this.spawnPlanet(), i * 800);
            }
        }
    }

    spawnRocket() {
        if (this.activeRockets.size >= (this.isMobile ? 4 : 5)) return;
        
        const rocketId = this.rocketCounter++;
        const gameArea = document.getElementById('gameArea');
        const { example, answer } = this.generateMathExample();
        
        const rocket = document.createElement('div');
        rocket.className = 'rocket falling';
        rocket.id = `rocket-${rocketId}`;
        
        const rocketImage = document.createElement('img');
        rocketImage.className = 'rocket-image';
        rocketImage.src = this.rocketImages[0];
        rocketImage.alt = 'Ракета';
        rocketImage.loading = 'eager';
        
        const rocketText = document.createElement('div');
        rocketText.className = 'rocket-text';
        rocketText.textContent = example;
        
        rocket.appendChild(rocketImage);
        rocket.appendChild(rocketText);
        
        const rocketWidth = this.isMobile ? 70 : 120;
        const rocketHeight = this.isMobile ? 50 : 80;
        
        const x = this.getFreePosition(rocketWidth, rocketHeight);
        rocket.style.left = x + 'px';
        rocket.style.top = '-100px';
        
        const fallDuration = this.isMobile ? 4 + Math.random() * 2 : 6 + Math.random() * 2;
        rocket.style.animationDuration = fallDuration + 's';
        
        this.activeRockets.set(rocketId, {
            element: rocket,
            answer: answer,
            x: x,
            fallDuration: fallDuration,
            width: rocketWidth
        });
        
        this.correctAnswers.set(rocketId, answer);
        gameArea.appendChild(rocket);
        
        setTimeout(() => {
            if (this.activeRockets.has(rocketId)) this.removeRocket(rocketId);
        }, fallDuration * 1000);
        
        rocket.addEventListener('click', () => this.selectRocket(rocketId));
        rocket.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.selectRocket(rocketId);
        }, { passive: false });
    }

    spawnPlanet() {
        if (this.activePlanets.size >= (this.isMobile ? 4 : 5)) return;
        
        const planetId = this.planetCounter++;
        const gameArea = document.getElementById('gameArea');
        const answer = this.generatePlanetAnswer();
        const isBomb = this.isBombAnswer(answer);
        
        const planet = document.createElement('div');
        planet.className = 'planet falling';
        planet.id = `planet-${planetId}`;
        
        const planetImage = document.createElement('img');
        planetImage.className = 'planet-image';
        if (isBomb) {
            planetImage.src = this.bombImage;
            planet.classList.add('bomb');
        } else {
            const planetImageIndex = Math.floor(Math.random() * this.planetImages.length);
            planetImage.src = this.planetImages[planetImageIndex];
        }
        planetImage.alt = isBomb ? 'Бомба' : 'Планета';
        planetImage.loading = 'eager';
        
        const planetText = document.createElement('div');
        planetText.className = 'planet-text';
        planetText.textContent = isBomb ? '💣' : answer;
        
        planet.appendChild(planetImage);
        planet.appendChild(planetText);
        
        const planetWidth = this.isMobile ? 50 : 80;
        const planetHeight = this.isMobile ? 50 : 80;
        
        const x = this.getFreePosition(planetWidth, planetHeight);
        planet.style.left = x + 'px';
        planet.style.top = '-100px';
        
        const fallDuration = this.isMobile ? 5 + Math.random() * 2 : 7 + Math.random() * 2;
        planet.style.animationDuration = fallDuration + 's';
        
        this.activePlanets.set(planetId, {
            element: planet,
            answer: answer,
            isBomb: isBomb,
            fallDuration: fallDuration,
            width: planetWidth
        });
        
        gameArea.appendChild(planet);
        
        setTimeout(() => {
            if (this.activePlanets.has(planetId)) this.removePlanet(planetId);
        }, fallDuration * 1000);
        
        planet.addEventListener('click', () => this.checkPlanetAnswer(planetId));
        planet.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.checkPlanetAnswer(planetId);
        }, { passive: false });
    }

    generatePlanetAnswer() {
        if (Math.random() < 0.3 && this.activePlanets.size > 2) {
            let bombAnswer;
            do {
                bombAnswer = Math.floor(Math.random() * 50) + 1;
            } while (Array.from(this.correctAnswers.values()).includes(bombAnswer));
            return bombAnswer;
        }
        const correctAnswers = Array.from(this.correctAnswers.values());
        if (correctAnswers.length > 0) {
            return correctAnswers[Math.floor(Math.random() * correctAnswers.length)];
        }
        return Math.floor(Math.random() * 50) + 1;
    }

    isBombAnswer(answer) {
        return !Array.from(this.correctAnswers.values()).includes(answer);
    }

    selectRocket(rocketId) {
        this.activeRockets.forEach((rocket, id) => {
            rocket.element.classList.remove('selected');
        });
        const rocket = this.activeRockets.get(rocketId);
        if (rocket) {
            rocket.element.classList.add('selected');
            this.selectedRocket = rocketId;
        }
    }

    checkPlanetAnswer(planetId) {
        if (this.selectedRocket === null) {
            this.showMessage('Сначала выбери ракету!');
            return;
        }
        const planet = this.activePlanets.get(planetId);
        const rocket = this.activeRockets.get(this.selectedRocket);
        if (!planet || !rocket) return;

        if (planet.isBomb) {
            this.handleBomb(planetId);
        } else if (planet.answer === rocket.answer) {
            this.handleCorrectAnswer(planetId);
        } else {
            this.handleWrongAnswer(planetId);
        }
        this.selectedRocket = null;
    }

    handleCorrectAnswer(planetId) {
        const rocketId = this.selectedRocket;
        this.streak++;
        this.multiplier = Math.pow(2, Math.min(this.streak - 1, 4));
        const points = 10 * this.multiplier;
        this.score += points;
        
        this.playSound('correct');
        this.showStreakEffect();
        this.highlightCorrect(planetId);
        this.updateUI();
        
        this.removeRocket(rocketId);
        this.removePlanet(planetId);
        
        setTimeout(() => {
            this.maintainRockets();
            this.maintainPlanets();
        }, 500);
    }

    handleWrongAnswer(planetId) {
        this.streak = 0;
        this.multiplier = 1;
        this.score = Math.max(0, this.score - 5);
        
        this.playSound('wrong');
        this.vibrate();
        this.highlightWrong(planetId);
        this.updateUI();
        
        this.removePlanet(planetId);
        setTimeout(() => this.maintainPlanets(), 500);
    }

    handleBomb(planetId) {
        this.streak = 0;
        this.multiplier = 1;
        this.score = Math.max(0, this.score - 5);
        
        this.playSound('bomb');
        this.vibrate(200);
        this.showBombEffect();
        this.updateUI();
        
        this.removePlanet(planetId);
        setTimeout(() => this.maintainPlanets(), 500);
    }

    removeRocket(rocketId) {
        const rocket = this.activeRockets.get(rocketId);
        if (rocket) {
            this.freePosition(rocket.x, rocket.width);
            rocket.element.style.transition = 'all 0.5s';
            rocket.element.style.transform = 'scale(0)';
            rocket.element.style.opacity = '0';
            setTimeout(() => {
                rocket.element.remove();
                this.activeRockets.delete(rocketId);
                this.correctAnswers.delete(rocketId);
            }, 500);
        }
    }

    removePlanet(planetId) {
        const planet = this.activePlanets.get(planetId);
        if (planet) {
            this.freePosition(parseFloat(planet.element.style.left), planet.width);
            planet.element.style.transition = 'all 0.5s';
            planet.element.style.transform = 'scale(0)';
            planet.element.style.opacity = '0';
            setTimeout(() => {
                planet.element.remove();
                this.activePlanets.delete(planetId);
            }, 500);
        }
    }

    generateMathExample() {
        const a = Math.floor(Math.random() * 15) + 1;
        const b = Math.floor(Math.random() * 15) + 1;
        const operators = ['+', '-', '*'];
        const operator = operators[Math.floor(Math.random() * operators.length)];
        
        let example, answer;
        switch(operator) {
            case '+':
                example = `${a}+${b}`;
                answer = a + b;
                break;
            case '-':
                const max = Math.max(a, b);
                const min = Math.min(a, b);
                example = `${max}-${min}`;
                answer = max - min;
                break;
            case '*':
                example = `${a}×${b}`;
                answer = a * b;
                break;
        }
        return { example, answer };
    }

    highlightCorrect(planetId) {
        const rocket = this.activeRockets.get(this.selectedRocket);
        const planet = this.activePlanets.get(planetId);
        if (rocket) rocket.element.classList.add('solved');
        if (planet) planet.element.classList.add('correct');
    }

    highlightWrong(planetId) {
        const planet = this.activePlanets.get(planetId);
        if (planet) {
            planet.element.classList.add('wrong');
            const rocket = this.activeRockets.get(this.selectedRocket);
            if (rocket) {
                const correctPlanets = Array.from(this.activePlanets.entries())
                    .filter(([id, p]) => p.answer === rocket.answer && !p.isBomb);
                correctPlanets.forEach(([id, p]) => {
                    p.element.classList.add('correct');
                    setTimeout(() => p.element.classList.remove('correct'), 1000);
                });
            }
        }
    }

    showStreakEffect() {
        if (this.streak >= 2) {
            const effect = document.createElement('div');
            effect.className = 'streak-effect';
            effect.textContent = `СТРАЙК ${this.streak}! x${this.multiplier}`;
            document.body.appendChild(effect);
            setTimeout(() => effect.remove(), 1000);
        }
    }

    showBombEffect() {
        const effect = document.createElement('div');
        effect.className = 'streak-effect';
        effect.textContent = '💣 БОМБА! -5';
        effect.style.color = '#ff4444';
        document.body.appendChild(effect);
        setTimeout(() => effect.remove(), 1000);
    }

    showMessage(message) {
        const msg = document.createElement('div');
        msg.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 255, 255, 0.9);
            color: black;
            padding: 15px 25px;
            border-radius: 10px;
            z-index: 1000;
            font-weight: bold;
            text-align: center;
            max-width: 80%;
        `;
        msg.textContent = message;
        document.body.appendChild(msg);
        setTimeout(() => msg.remove(), 1500);
    }

    playSound(type) {
        if (this.isMobile) return;
    }

    vibrate(duration = 100) {
        if (navigator.vibrate && this.isMobile) {
            navigator.vibrate(duration);
        }
    }

    startTimer() {
        this.timer = setInterval(() => {
            this.timeLeft--;
            document.getElementById('timer').textContent = this.timeLeft;
            if (this.timeLeft <= 0) this.endGame();
        }, 1000);
    }

    async endGame() {
        clearInterval(this.timer);
        clearInterval(this.spawnInterval);
        this.occupiedPositions.clear();
        
        this.activeRockets.forEach((rocket, id) => this.removeRocket(id));
        this.activePlanets.forEach((planet, id) => this.removePlanet(id));
        
        if (this.tg.isTelegram) {
            this.tg.showMainButton(true);
        }
        
        const userData = {
            userId: this.userId,
            username: this.getUsername(),
            score: this.score,
            streak: this.streak,
            multiplier: this.multiplier
        };
        
        await this.api.saveScore(userData);
        
        setTimeout(() => {
            this.showResultModal();
        }, 1000);
    }
    
    showResultModal() {
        const modal = document.getElementById('resultModal');
        const finalScore = document.getElementById('finalScore');
        const finalStreak = document.getElementById('finalStreak');
        const finalMultiplier = document.getElementById('finalMultiplier');
        
        if (modal && finalScore) {
            finalScore.textContent = this.score;
            finalStreak.textContent = this.streak;
            finalMultiplier.textContent = this.multiplier;
            modal.style.display = 'flex';
        }
    }

    updateUI() {
        document.getElementById('score').textContent = this.score;
        document.getElementById('streak').textContent = this.streak;
        document.getElementById('multiplier').textContent = this.multiplier;
    }

    getUserId() {
        if (window.Telegram?.WebApp) {
            return window.Telegram.WebApp.initDataUnsafe?.user?.id.toString();
        }
        return 'user_' + Math.random().toString(36).substr(2, 9);
    }

    getUsername() {
        if (window.Telegram?.WebApp) {
            const user = window.Telegram.WebApp.initDataUnsafe?.user;
            return user.username || user.first_name || 'Аноним';
        }
        return 'Гость';
    }

    createStars() {
        function createStarLayer(selector, count, size, speed) {
            const layer = document.querySelector(selector);
            if (!layer) return;
            
            layer.innerHTML = '';
            for (let i = 0; i < count; i++) {
                const star = document.createElement('div');
                star.style.position = 'absolute';
                star.style.width = size + 'px';
                star.style.height = size + 'px';
                star.style.background = '#fff';
                star.style.borderRadius = '50%';
                star.style.left = Math.random() * 100 + '%';
                star.style.top = Math.random() * 100 + '%';
                star.style.animation = `fall ${speed}s linear infinite`;
                star.style.opacity = Math.random() * 0.7 + 0.3;
                layer.appendChild(star);
            }
        }

        const starCount = this.isMobile ? [80, 40, 15] : [150, 80, 30];
        createStarLayer('#stars', starCount[0], 1, 50);
        createStarLayer('#stars2', starCount[1], 2, 100);
        createStarLayer('#stars3', starCount[2], 3, 150);
    }

    setupEventListeners() {
        document.getElementById('restart')?.addEventListener('click', () => this.restartGame());
        document.getElementById('playAgain')?.addEventListener('click', () => {
            document.getElementById('resultModal').style.display = 'none';
            this.restartGame();
        });
        document.getElementById('closeModal')?.addEventListener('click', () => {
            document.getElementById('resultModal').style.display = 'none';
        });
        document.getElementById('share')?.addEventListener('click', () => this.shareResults());
        document.getElementById('showLeaderboard')?.addEventListener('click', () => {
            this.showLeaderboard();
        });
        document.getElementById('closeLeaderboard')?.addEventListener('click', () => {
            document.getElementById('leaderboardModal').style.display = 'none';
        });
        
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });
        
        window.addEventListener('resize', this.handleResize.bind(this));
        window.addEventListener('orientationchange', this.handleOrientationChange.bind(this));
    }

    handleResize() {
        setTimeout(() => {
            this.createStars();
        }, 100);
    }

    handleOrientationChange() {
        setTimeout(() => {
            this.createStars();
            const gameArea = document.getElementById('gameArea');
            if (gameArea) {
                gameArea.style.width = '100%';
                gameArea.style.height = '100%';
            }
        }, 300);
    }

    async showLeaderboard() {
        await this.loadLeaderboards();
        document.getElementById('leaderboardModal').style.display = 'flex';
    }

    async loadLeaderboards() {
        try {
            const [daily, weekly, userPosition] = await Promise.all([
                this.api.getDailyLeaderboard(),
                this.api.getWeeklyLeaderboard(),
                this.api.getUserPosition(this.userId)
            ]);
            
            this.leaderboard.daily = daily;
            this.leaderboard.weekly = weekly;
            this.updateLeaderboardUI();
            this.updateUserPosition(userPosition);
        } catch (error) {
            console.error('Error loading leaderboards:', error);
        }
    }

    updateLeaderboardUI() {
        this.renderLeaderboard('daily', this.leaderboard.daily);
        this.renderLeaderboard('weekly', this.leaderboard.weekly);
    }

    renderLeaderboard(type, data) {
        const container = document.getElementById(`${type}Leaderboard`)?.querySelector('.leaderboard-list');
        if (!container) return;
        
        if (data.length === 0) {
            container.innerHTML = '<div class="empty-leaderboard">Пока нет результатов</div>';
            return;
        }
        container.innerHTML = data.map((user, index) => `
            <div class="leaderboard-item">
                <div class="leaderboard-rank">${index + 1}</div>
                <div class="leaderboard-user">
                    <div class="leaderboard-username">${user.username}</div>
                    <div class="leaderboard-stats">
                        Страйк: ${user.streak}x • Множитель: x${user.multiplier}
                    </div>
                </div>
                <div class="leaderboard-score">${user.score}</div>
            </div>
        `).join('');
    }

    updateUserPosition(position) {
        const dailyEl = document.getElementById('dailyPosition');
        const weeklyEl = document.getElementById('weeklyPosition');
        if (dailyEl) dailyEl.textContent = position.daily || '-';
        if (weeklyEl) weeklyEl.textContent = position.weekly || '-';
    }

    switchTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.toggle('active', pane.id === `${tabName}Leaderboard`);
        });
    }

    shareResults() {
        if (this.tg.isTelegram) {
            this.tg.shareResults(this.score, this.streak, this.multiplier);
        } else {
            const text = `🚀 Я набрал ${this.score} очков в Космическом Математическом Бое! 
Страйк: ${this.streak}, Множитель: x${this.multiplier}`;
            
            if (navigator.share) {
                navigator.share({
                    title: 'Космический Математический Бой',
                    text: text,
                    url: window.location.href
                });
            } else {
                navigator.clipboard.writeText(text + '\n' + window.location.href)
                    .then(() => alert('Результат скопирован в буфер обмена!'));
            }
        }
    }

    restartGame() {
        clearInterval(this.timer);
        clearInterval(this.spawnInterval);
        this.occupiedPositions.clear();
        
        this.activeRockets.forEach((rocket, id) => this.removeRocket(id));
        this.activePlanets.forEach((planet, id) => this.removePlanet(id));
        
        if (this.tg.isTelegram) {
            this.tg.showMainButton(false);
        }
        
        this.score = 0;
        this.timeLeft = 60;
        this.streak = 0;
        this.multiplier = 1;
        this.selectedRocket = null;
        this.rocketCounter = 0;
        this.planetCounter = 0;
        
        document.getElementById('resultModal').style.display = 'none';
        setTimeout(() => this.initializeGame(), 500);
    }
}

window.addEventListener('load', () => {
    new MathGame();
});
