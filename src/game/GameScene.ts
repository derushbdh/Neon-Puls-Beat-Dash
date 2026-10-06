import Phaser from 'phaser';

/** Конфигурация баланса и визуала игры */
const GAME_CONFIG = {
  LANES_Y: [220, 340, 460],
  PLAYER_X: 180,
  START_SPEED: 380,
  MAX_SPEED: 680,
  SPEED_ACCELERATION: 6, // прирост скорости каждые несколько секунд
  INITIAL_LIVES: 3,
  SPAWN_INTERVAL_MS: 950,
  COLORS: {
    CYAN: 0x00f5ff,
    MAGENTA: 0xff007f,
    SPIKE: 0xff3b30,
    STAR: 0xffd700,
    BG_DARK: 0x070b19,
    LANE_LINE: 0x1e293b,
    LANE_GLOW: 0x334155,
  },
} as const;

type Polarity = 'CYAN' | 'MAGENTA';

interface GameItem {
  type: 'ORB' | 'SPIKE' | 'STAR';
  polarity?: Polarity;
  lane: number;
  container: Phaser.GameObjects.Container;
  collected?: boolean;
}

/** Встроенный легковесный звуковой синтезатор на Web Audio API */
class SoundEngine {
  private ctx: AudioContext | null = null;
  public isMuted = false;
  private beatIntervalId: number | null = null;

  init(): void {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  startBeat(): void {
    if (this.beatIntervalId !== null) return;
    this.init();
    let step = 0;
    // Базовый ритм 125 BPM (каждые 240 мс)
    this.beatIntervalId = window.setInterval(() => {
      if (this.isMuted || !this.ctx) return;
      if (step % 2 === 0) {
        this.playKick();
      } else {
        this.playHiHat();
      }
      step = (step + 1) % 4;
    }, 240);
  }

  stopBeat(): void {
    if (this.beatIntervalId !== null) {
      clearInterval(this.beatIntervalId);
      this.beatIntervalId = null;
    }
  }

  private playKick(): void {
    if (!this.ctx || this.isMuted) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;

    osc.frequency.setValueAtTime(130, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + 0.12);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  private playHiHat(): void {
    if (!this.ctx || this.isMuted) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;

    osc.type = 'highpass' as unknown as OscillatorType;
    osc.frequency.setValueAtTime(8000, now);

    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  playCollect(combo: number): void {
    if (!this.ctx || this.isMuted) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;

    // Пентатонические ноты в зависимости от комбо
    const notes = [440, 493.88, 554.37, 659.25, 739.99, 880];
    const freq = notes[Math.min(combo, notes.length - 1)];

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.5, now + 0.15);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  playSwitch(): void {
    if (!this.ctx || this.isMuted) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.08);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  playHit(): void {
    if (!this.ctx || this.isMuted) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.linearRampToValueAtTime(50, now + 0.2);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.21);
  }

  playLifeUp(): void {
    if (!this.ctx || this.isMuted) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, now);
    osc.frequency.linearRampToValueAtTime(1046.5, now + 0.25);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.26);
  }
}

/**
 * Основная сцена Neon Pulse: Beat Dash
 */
export class GameScene extends Phaser.Scene {
  private soundEngine = new SoundEngine();

  // Игрок и состояние
  private playerContainer!: Phaser.GameObjects.Container;
  private playerCore!: Phaser.GameObjects.Arc;
  private playerRing!: Phaser.GameObjects.Arc;
  private playerAura!: Phaser.GameObjects.Arc;
  private currentLane = 1; // 0: Top, 1: Middle, 2: Bottom
  private currentPolarity: Polarity = 'CYAN';
  private lives: number = GAME_CONFIG.INITIAL_LIVES;
  private score = 0;
  private highScore = 0;
  private combo = 0;
  private speed: number = GAME_CONFIG.START_SPEED;
  private isGameOver = false;
  private isStarted = false;

  // Объекты трассы
  private items: GameItem[] = [];
  private spawnTimer = 0;
  private stars: Phaser.GameObjects.Arc[] = [];
  private laneLines: Phaser.GameObjects.Graphics[] = [];

  // UI элементы
  private scoreText!: Phaser.GameObjects.Text;
  private highScoreText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private livesText!: Phaser.GameObjects.Text;
  private startPanel!: Phaser.GameObjects.Container;
  private gameOverPanel!: Phaser.GameObjects.Container;
  private finalScoreText!: Phaser.GameObjects.Text;

  // Сенсорные кнопки управления
  private touchUpBtn!: Phaser.GameObjects.Container;
  private touchDownBtn!: Phaser.GameObjects.Container;
  private touchSwitchBtn!: Phaser.GameObjects.Container;

  constructor() {
    super('GameScene');
  }

  create(): void {
    const { width, height } = this.scale;

    // Загрузка рекорда из LocalStorage
    try {
      const savedHigh = localStorage.getItem('neon_pulse_high');
      if (savedHigh) this.highScore = parseInt(savedHigh, 10) || 0;
    } catch {
      this.highScore = 0;
    }

    this.createBackground(width, height);
    this.createLanes(width);
    this.createPlayer();
    this.createUI(width, height);
    this.createTouchControls(width, height);
    this.setupInput();

    // Первоначальное обновление визуализации
    this.updatePlayerVisuals();
    this.updateHUD();
  }

  /** Создание космического фона со звездами */
  private createBackground(width: number, height: number): void {
    // Темный неоновый фон
    this.add.rectangle(width / 2, height / 2, width, height, GAME_CONFIG.COLORS.BG_DARK);

    // Звездное поле (параллакс)
    for (let i = 0; i < 60; i++) {
      const x = Phaser.Math.Between(0, width);
      const y = Phaser.Math.Between(0, height);
      const radius = Phaser.Math.FloatBetween(1, 2.5);
      const alpha = Phaser.Math.FloatBetween(0.2, 0.7);
      const star = this.add.circle(x, y, radius, 0xffffff, alpha);
      this.stars.push(star);
    }
  }

  /** Создание 3 неоновых направляющих дорожек */
  private createLanes(width: number): void {
    GAME_CONFIG.LANES_Y.forEach((laneY, idx) => {
      const g = this.add.graphics();
      // Линия направляющей
      g.lineStyle(2, GAME_CONFIG.COLORS.LANE_LINE, 0.6);
      g.lineBetween(0, laneY, width, laneY);

      // Свечение рельса
      g.lineStyle(10, GAME_CONFIG.COLORS.LANE_GLOW, 0.1);
      g.lineBetween(0, laneY, width, laneY);

      this.laneLines.push(g);

      // Интерактивная зона полосы для клика/тапа мыши
      const zone = this.add.zone(width / 2, laneY, width, 100).setOrigin(0.5);
      zone.setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => {
        if (!this.isStarted) {
          this.startGame();
          return;
        }
        if (this.isGameOver) return;
        this.switchLaneTo(idx);
      });
    });
  }

  /** Создание пульсирующего энергетического ядра игрока */
  private createPlayer(): void {
    this.playerContainer = this.add.container(
      GAME_CONFIG.PLAYER_X,
      GAME_CONFIG.LANES_Y[this.currentLane]
    );

    // Внешняя аура свечения
    this.playerAura = this.add.circle(0, 0, 36, GAME_CONFIG.COLORS.CYAN, 0.25);
    // Вращающееся кольцо
    this.playerRing = this.add.circle(0, 0, 24, GAME_CONFIG.COLORS.CYAN, 0.5);
    // Центральное ядро
    this.playerCore = this.add.circle(0, 0, 14, 0xffffff, 1);

    this.playerContainer.add([this.playerAura, this.playerRing, this.playerCore]);

    // Пульсация ауры игрока
    this.tweens.add({
      targets: this.playerAura,
      scale: 1.3,
      alpha: 0.1,
      duration: 500,
      yoyo: true,
      repeat: -1,
    });
  }

  /** Интерфейс: счет, комбо, жизни, стартовое и финальное окна */
  private createUI(width: number, height: number): void {
    // Верхняя панель HUD
    this.scoreText = this.add.text(28, 24, 'SCORE: 0', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '26px',
      fontStyle: 'bold',
      color: '#00f5ff',
    });

    this.highScoreText = this.add.text(28, 56, `BEST: ${this.highScore}`, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '15px',
      color: '#94a3b8',
    });

    this.comboText = this.add.text(width / 2, 28, 'COMBO x1', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '24px',
      fontStyle: 'bold',
      color: '#facc15',
    }).setOrigin(0.5, 0);

    this.livesText = this.add.text(width - 28, 24, 'SHIELD: ❤️❤️❤️', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '22px',
      color: '#ff007f',
    }).setOrigin(1, 0);

    // Кнопка звука (Mute)
    const muteBtn = this.add.text(width - 28, 60, '🔊 SOUND: ON', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '14px',
      color: '#64748b',
    })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });

    muteBtn.on('pointerdown', () => {
      this.soundEngine.isMuted = !this.soundEngine.isMuted;
      muteBtn.setText(this.soundEngine.isMuted ? '🔇 SOUND: OFF' : '🔊 SOUND: ON');
      muteBtn.setColor(this.soundEngine.isMuted ? '#ef4444' : '#10b981');
    });

    // 1. Стартовый оверлей
    this.startPanel = this.add.container(width / 2, height / 2);
    const startBg = this.add.rectangle(0, 0, 580, 320, 0x090d21, 0.95);
    startBg.setStrokeStyle(2, 0x00f5ff, 0.8);

    const title = this.add.text(0, -90, '⚡ NEON PULSE: BEAT DASH ⚡', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '28px',
      fontStyle: 'bold',
      color: '#00f5ff',
    }).setOrigin(0.5);

    const desc1 = this.add.text(0, -35, '↑ / ↓ или W / S — Смена полосы', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '18px',
      color: '#e2e8f0',
    }).setOrigin(0.5);

    const desc2 = this.add.text(0, 0, 'ПРОБЕЛ — Смена цвета (Голубой / Розовый)', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '18px',
      color: '#ff007f',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const desc3 = this.add.text(0, 35, 'Собирай сферы своего цвета! Уклоняйся от шипов!', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '15px',
      color: '#94a3b8',
    }).setOrigin(0.5);

    const startBtn = this.add.text(0, 95, '▶ НАЖМИ ДЛЯ СТАРТА', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '22px',
      fontStyle: 'bold',
      color: '#facc15',
      backgroundColor: '#1e293b',
      padding: { x: 20, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    startBtn.on('pointerdown', () => this.startGame());

    this.startPanel.add([startBg, title, desc1, desc2, desc3, startBtn]);

    // 2. Экран Game Over
    this.gameOverPanel = this.add.container(width / 2, height / 2).setVisible(false);
    const goBg = this.add.rectangle(0, 0, 520, 300, 0x090d21, 0.95);
    goBg.setStrokeStyle(2, 0xff007f, 0.8);

    const goTitle = this.add.text(0, -80, 'PULSE OVERLOAD', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '32px',
      fontStyle: 'bold',
      color: '#ff3b30',
    }).setOrigin(0.5);

    this.finalScoreText = this.add.text(0, -20, 'SCORE: 0', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '26px',
      color: '#00f5ff',
    }).setOrigin(0.5);

    const restartBtn = this.add.text(0, 60, '🔄 ИГРАТЬ СНОВА (R / Клик)', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '20px',
      fontStyle: 'bold',
      color: '#ffffff',
      backgroundColor: '#ff007f',
      padding: { x: 24, y: 12 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    restartBtn.on('pointerdown', () => this.restartGame());

    this.gameOverPanel.add([goBg, goTitle, this.finalScoreText, restartBtn]);
  }

  /** Сенсорные экранные кнопки (для игры на смартфонах и планшетах) */
  private createTouchControls(_width: number, height: number): void {
    // Кнопка ВВЕРХ (слева снизу)
    this.touchUpBtn = this.createButton(70, height - 70, '▲ ВВЕРХ', 0x334155, () => {
      this.moveLane(-1);
    });

    // Кнопка ВНИЗ (рядом)
    this.touchDownBtn = this.createButton(180, height - 70, '▼ ВНИЗ', 0x334155, () => {
      this.moveLane(1);
    });

    // Кнопка СМЕНЫ ЦВЕТА (справа снизу)
    this.touchSwitchBtn = this.createButton(850, height - 70, '⚡ ЦВЕТ', GAME_CONFIG.COLORS.CYAN, () => {
      this.togglePolarity();
    }, 140);
  }

  private createButton(
    x: number,
    y: number,
    label: string,
    color: number,
    callback: () => void,
    w = 90,
    h = 56
  ): Phaser.GameObjects.Container {
    const cont = this.add.container(x, y);
    const rect = this.add.rectangle(0, 0, w, h, color, 0.45).setStrokeStyle(2, 0xffffff, 0.4);
    const txt = this.add.text(0, 0, label, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '16px',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);

    cont.add([rect, txt]);
    rect.setInteractive({ useHandCursor: true });
    rect.on('pointerdown', () => {
      if (!this.isStarted) {
        this.startGame();
        return;
      }
      callback();
      // Анимация нажатия
      this.tweens.add({
        targets: cont,
        scale: 0.9,
        duration: 60,
        yoyo: true,
      });
    });

    return cont;
  }

  /** Настройка клавиатуры и событий */
  private setupInput(): void {
    if (!this.input.keyboard) return;

    this.input.keyboard.on('keydown', (event: KeyboardEvent) => {
      // Инициализация звука при первом нажатии
      this.soundEngine.init();

      if (!this.isStarted) {
        this.startGame();
        return;
      }

      if (this.isGameOver) {
        if (event.code === 'KeyR' || event.code === 'Space') {
          this.restartGame();
        }
        return;
      }

      switch (event.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.moveLane(-1);
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.moveLane(1);
          break;
        case 'Space':
        case 'KeyF':
        case 'KeyE':
          this.togglePolarity();
          break;
        case 'KeyR':
          this.restartGame();
          break;
      }
    });

    // Клик мышью в любой точке для старта, если не начато
    this.input.on('pointerdown', () => {
      this.soundEngine.init();
      if (!this.isStarted) {
        this.startGame();
      }
    });
  }

  private startGame(): void {
    if (this.isStarted) return;
    this.isStarted = true;
    this.startPanel.setVisible(false);
    this.soundEngine.startBeat();
  }

  /** Перемещение между полосами (-1: вверх, +1: вниз) */
  private moveLane(delta: number): void {
    const target = Phaser.Math.Clamp(this.currentLane + delta, 0, GAME_CONFIG.LANES_Y.length - 1);
    this.switchLaneTo(target);
  }

  private switchLaneTo(laneIdx: number): void {
    if (laneIdx === this.currentLane) return;
    this.currentLane = laneIdx;

    // Плавное скольжение на новую полосу
    this.tweens.add({
      targets: this.playerContainer,
      y: GAME_CONFIG.LANES_Y[this.currentLane],
      duration: 120,
      ease: 'Cubic.easeOut',
    });

    this.createGhostTrail();
    this.soundEngine.playSwitch();
  }

  /** Переключение полярности (Цвета) */
  private togglePolarity(): void {
    this.currentPolarity = this.currentPolarity === 'CYAN' ? 'MAGENTA' : 'CYAN';
    this.updatePlayerVisuals();
    this.soundEngine.playSwitch();

    // Вспышка свечения при переключении
    this.tweens.add({
      targets: this.playerRing,
      scale: 1.6,
      duration: 100,
      yoyo: true,
    });
  }

  private updatePlayerVisuals(): void {
    const color = this.currentPolarity === 'CYAN' ? GAME_CONFIG.COLORS.CYAN : GAME_CONFIG.COLORS.MAGENTA;
    this.playerAura.setFillStyle(color, 0.3);
    this.playerRing.setFillStyle(color, 0.75);

    // Обновляем цвет сенсорной кнопки
    if (this.touchSwitchBtn) {
      const rect = this.touchSwitchBtn.getAt(0) as Phaser.GameObjects.Rectangle;
      if (rect) rect.setFillStyle(color, 0.65);
    }
  }

  /** Создание следа/шлейфа за игроком */
  private createGhostTrail(): void {
    const color = this.currentPolarity === 'CYAN' ? GAME_CONFIG.COLORS.CYAN : GAME_CONFIG.COLORS.MAGENTA;
    const ghost = this.add.circle(
      this.playerContainer.x,
      this.playerContainer.y,
      18,
      color,
      0.6
    );

    this.tweens.add({
      targets: ghost,
      alpha: 0,
      scale: 0.2,
      x: ghost.x - 40,
      duration: 250,
      onComplete: () => ghost.destroy(),
    });
  }

  update(_time: number, delta: number): void {
    if (!this.isStarted || this.isGameOver) return;

    const dt = delta / 1000;

    // 1. Движение фоновых звезд (параллакс)
    this.stars.forEach((star) => {
      star.x -= this.speed * 0.25 * dt;
      if (star.x < 0) {
        star.x = this.scale.width;
        star.y = Phaser.Math.Between(0, this.scale.height);
      }
    });

    // 2. Постепенное увеличение скорости игры
    if (this.speed < GAME_CONFIG.MAX_SPEED) {
      this.speed += GAME_CONFIG.SPEED_ACCELERATION * dt;
    }

    // 3. Создание новых объектов на трассе
    this.spawnTimer += delta;
    const currentSpawnInterval = Math.max(500, GAME_CONFIG.SPAWN_INTERVAL_MS - (this.speed - GAME_CONFIG.START_SPEED) * 0.9);
    if (this.spawnTimer > currentSpawnInterval) {
      this.spawnTimer = 0;
      this.spawnTraffic();
    }

    // 4. Движение и коллизии встречных объектов
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      item.container.x -= this.speed * dt;

      // Проверка столкновения с игроком
      if (!item.collected && Math.abs(item.container.x - GAME_CONFIG.PLAYER_X) < 36 && item.lane === this.currentLane) {
        this.handleCollision(item);
      }

      // Удаление вышедших за левую границу объектов
      if (item.container.x < -60) {
        item.container.destroy();
        this.items.splice(i, 1);
      }
    }
  }

  /** Генерация встречных объектов с гарантией проходимости */
  private spawnTraffic(): void {
    const lane = Phaser.Math.Between(0, 2);
    const rand = Math.random();

    if (rand < 0.65) {
      // Сфера ритма (Циан или Маджента)
      const polarity: Polarity = Math.random() < 0.5 ? 'CYAN' : 'MAGENTA';
      this.spawnOrb(lane, polarity);
    } else if (rand < 0.90) {
      // Опасный шип
      this.spawnSpike(lane);
    } else {
      // Звезда восстановления
      this.spawnStar(lane);
    }
  }

  private spawnOrb(lane: number, polarity: Polarity): void {
    const color = polarity === 'CYAN' ? GAME_CONFIG.COLORS.CYAN : GAME_CONFIG.COLORS.MAGENTA;
    const cont = this.add.container(this.scale.width + 40, GAME_CONFIG.LANES_Y[lane]);

    const outer = this.add.circle(0, 0, 22, color, 0.3);
    const core = this.add.circle(0, 0, 14, color, 1);
    const inner = this.add.circle(0, 0, 6, 0xffffff, 0.9);

    cont.add([outer, core, inner]);

    this.items.push({
      type: 'ORB',
      polarity,
      lane,
      container: cont,
    });
  }

  private spawnSpike(lane: number): void {
    const cont = this.add.container(this.scale.width + 40, GAME_CONFIG.LANES_Y[lane]);

    // Красный треугольный шип
    const spike = this.add.triangle(0, 0, -18, 18, 0, -18, 18, 18, GAME_CONFIG.COLORS.SPIKE);
    spike.setStrokeStyle(2, 0xffffff, 0.9);

    cont.add(spike);

    // Вращение для динамики
    this.tweens.add({
      targets: spike,
      angle: 360,
      duration: 1200,
      repeat: -1,
    });

    this.items.push({
      type: 'SPIKE',
      lane,
      container: cont,
    });
  }

  private spawnStar(lane: number): void {
    const cont = this.add.container(this.scale.width + 40, GAME_CONFIG.LANES_Y[lane]);
    const starGlow = this.add.circle(0, 0, 24, GAME_CONFIG.COLORS.STAR, 0.4);
    const star = this.add.star(0, 0, 5, 8, 18, GAME_CONFIG.COLORS.STAR);

    cont.add([starGlow, star]);

    this.tweens.add({
      targets: cont,
      scale: 1.2,
      duration: 400,
      yoyo: true,
      repeat: -1,
    });

    this.items.push({
      type: 'STAR',
      lane,
      container: cont,
    });
  }

  /** Обработка столкновения */
  private handleCollision(item: GameItem): void {
    item.collected = true;

    if (item.type === 'ORB') {
      if (item.polarity === this.currentPolarity) {
        // Успешный сбор в цвет!
        this.combo += 1;
        const multiplier = Math.min(8, 1 + Math.floor(this.combo / 4));
        const gain = 100 * multiplier;
        this.score += gain;

        this.showFloatingText(item.container.x, item.container.y, `+${gain}`, 0x00f5ff);
        this.createParticles(item.container.x, item.container.y, item.polarity === 'CYAN' ? GAME_CONFIG.COLORS.CYAN : GAME_CONFIG.COLORS.MAGENTA);
        this.soundEngine.playCollect(this.combo);
      } else {
        // Несовпадение полярности!
        this.takeDamage('POLARITY MISMATCH!');
      }
    } else if (item.type === 'SPIKE') {
      // Столкновение с шипом
      this.takeDamage('HAZARD HIT!');
    } else if (item.type === 'STAR') {
      // Золотая звезда
      this.lives = Math.min(3, this.lives + 1);
      this.score += 500;
      this.showFloatingText(item.container.x, item.container.y, '+500 SHIELD REPAIRED', 0xffd700);
      this.createParticles(item.container.x, item.container.y, GAME_CONFIG.COLORS.STAR, 16);
      this.soundEngine.playLifeUp();
    }

    item.container.destroy();
    this.updateHUD();
  }

  private takeDamage(reason: string): void {
    this.lives -= 1;
    this.combo = 0;
    this.soundEngine.playHit();
    this.cameras.main.shake(200, 0.015);

    this.showFloatingText(this.playerContainer.x, this.playerContainer.y - 30, reason, 0xff3b30);
    this.createParticles(this.playerContainer.x, this.playerContainer.y, 0xff3b30, 20);

    if (this.lives <= 0) {
      this.gameOver();
    }
  }

  private gameOver(): void {
    this.isGameOver = true;
    this.soundEngine.stopBeat();

    if (this.score > this.highScore) {
      this.highScore = this.score;
      try {
        localStorage.setItem('neon_pulse_high', this.highScore.toString());
      } catch {
        // игнорируем ошибку LocalStorage
      }
    }

    this.finalScoreText.setText(`FINAL SCORE: ${this.score}\nRECORD: ${this.highScore}`);
    this.gameOverPanel.setVisible(true);
  }

  private restartGame(): void {
    this.items.forEach((it) => it.container.destroy());
    this.items = [];

    this.score = 0;
    this.combo = 0;
    this.lives = GAME_CONFIG.INITIAL_LIVES;
    this.speed = GAME_CONFIG.START_SPEED;
    this.currentLane = 1;
    this.playerContainer.y = GAME_CONFIG.LANES_Y[this.currentLane];
    this.currentPolarity = 'CYAN';
    this.isGameOver = false;

    this.gameOverPanel.setVisible(false);
    this.updatePlayerVisuals();
    this.updateHUD();
    this.soundEngine.startBeat();
  }

  /** Всплывающий текст с анимацией */
  private showFloatingText(x: number, y: number, message: string, colorHex: number): void {
    const text = this.add.text(x, y, message, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '20px',
      fontStyle: 'bold',
      color: '#' + colorHex.toString(16).padStart(6, '0'),
    }).setOrigin(0.5);

    this.tweens.add({
      targets: text,
      y: y - 50,
      alpha: 0,
      duration: 650,
      ease: 'Cubic.easeOut',
      onComplete: () => text.destroy(),
    });
  }

  /** Эффект взрыва неоновых частиц */
  private createParticles(x: number, y: number, color: number, count = 12): void {
    for (let i = 0; i < count; i++) {
      const p = this.add.circle(x, y, Phaser.Math.Between(3, 6), color, 0.9);
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const dist = Phaser.Math.Between(30, 90);

      this.tweens.add({
        targets: p,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        alpha: 0,
        scale: 0.1,
        duration: Phaser.Math.Between(300, 500),
        ease: 'Quad.easeOut',
        onComplete: () => p.destroy(),
      });
    }
  }

  private updateHUD(): void {
    this.scoreText.setText(`SCORE: ${this.score}`);
    this.highScoreText.setText(`BEST: ${this.highScore}`);

    const mult = Math.min(8, 1 + Math.floor(this.combo / 4));
    this.comboText.setText(`COMBO x${mult} (${this.combo})`);

    const hearts = '❤️'.repeat(Math.max(0, this.lives)) + '🖤'.repeat(Math.max(0, 3 - this.lives));
    this.livesText.setText(`SHIELD: ${hearts}`);
  }
}
