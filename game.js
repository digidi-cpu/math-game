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
            return { success: false };
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
        
        this.initializeGame();
        this.createStars();
        this.preloadImages();
    }

    checkMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
               window.innerWidth <= 768 ||
               (window.Telegram && window.Telegram.WebApp);
    }

    preloadImages() {
        const allImages = [...this.rocketImages, ...this.planetImages, this.bombImage];
        allImages.forEach(src => {
            const img = new Image();
            img.src = src;
        });
    }

    initializeGame() {
        this.startSpawning();
        this.startTimer();
        this.setupEventListeners();
        this.updateUI();
    }

    startSpawning() {
        for (let i = 0; i < 4; i++) {
            setTimeout(() => this.spawnRocket(), i * 1000);
        }
        setTimeout(() => {
            for (let i = 0; i < 4; i++) {
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
        const gridSize = width + 30;
        const gridX = Math.floor(x / gridSize);
        return `pos_${gridX}`;
    }

    freePosition(x, width) {
        const positionKey = this.getPositionKey(x, width);
        this.occupiedPositions.delete(positionKey);
    }

    maintainRockets() {
        const currentRockets = this.activeRockets.size;
        const neededRockets = 4 - currentRockets;
        if (neededRockets > 0) {
            for (let i = 0; i < neededRockets; i++) {
                setTimeout(() => this.spawnRocket(), i * 800);
            }
        }
    }

    maintainPlanets() {
        const currentPlanets = this.activePlanets.size;
        const neededPlanets = 4 - currentPlanets;
        if (neededPlanets > 0) {
            for (let i = 0; i < neededPlanets; i++) {
                setTimeout(() => this.spawnPlanet(), i * 800);
            }
        }
    }

    spawnRocket() {
        if (this.activeRockets.size >= 4) return;
        
        const rocketId = this.rocketCounter++;
        const gameArea = document.getElementById('gameArea');
        if (!gameArea) return;
        
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
        
        const rocketWidth = 70;
        const rocketHeight = 50;
        
        const x = this.getFreePosition(rocketWidth, rocketHeight);
        rocket.style.left = x + 'px';
        rocket.style.top = '-100px';
        
        const fallDuration = 4 + Math.random() * 2;
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
        if (this.activePlanets.size >= 4) return;
        
        const planetId = this.planetCounter++;
        const gameArea = document.getElementById('gameArea');
        if (!gameArea) return;
        
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
        
        const planetWidth = 50;
        const planetHeight = 50;
        
        const x = this.getFreePosition(planetWidth, planetHeight);
        planet.style.left = x + 'px';
        planet.style.top = '-100px';
        
        const fallDuration = 5 + Math.random() * 2;
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
                if (rocket.element.parentNode) {
                    rocket.element.remove();
                }
                this.activeRockets.delete(rocketId);
                this.correctAnswers.delete(rocketId);
            }, 500);
        }
    }

    removePlanet(planetId) {
        const planet = this.activePlanets.get(planetId);
        if (planet) {
            this.freePosition(parseFloat(planet.element
