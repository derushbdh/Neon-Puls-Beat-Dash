import Phaser from 'phaser';

const GAME_CONFIG = {
  LANES_Y: [220, 340, 460],
  PLAYER_X: 180,
  START_SPEED: 380,
  MAX_SPEED: 680,
  SPEED_ACCELERATION: 6,
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

export class GameScene extends Phaser.Scene {
  private soundEngine = new SoundEngine();
  private playerContainer!: Phaser.GameObjects.Container;
  private playerCore!: Phaser.GameObjects.Arc;
  private playerRing!: Phaser.GameObjects.Arc;
  private playerAura!: Phaser.GameObjects.Arc;
  private currentLane = 1;
  private currentPolarity: Polarity = 'CYAN';
  private lives: number = GAME_CONFIG.INITIAL_LIVES;
  private score = 0;
  private combo = 0;
  private speed: number = GAME_CONFIG.START_SPEED;
  private isGameOver = false;

  private items: GameItem[] = [];
  private spawnTimer = 0;
  private stars: Phaser.GameObjects.Arc[] = [];

  private scoreText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private livesText!: Phaser.GameObjects.Text;

  constructor() {
    super('GameScene');
  }

  create(): void {
    const { width, height } = this.scale;

    this.createBackground(width, height);
    this.createLanes(width);
    this.createPlayer();
    this.createHUD(width);
    this.setupInput();
    this.updatePlayerVisuals();
    this.soundEngine.startBeat();
  }

  private createBackground(width: number, height: number): void {
    this.add.rectangle(width / 2, height / 2, width, height, GAME_CONFIG.COLORS.BG_DARK);

    for (let i = 0; i < 60; i++) {
      const star = this.add.circle(
        Phaser.Math.Between(0, width),
        Phaser.Math.Between(0, height),
        Phaser.Math.FloatBetween(1, 2.5),
        0xffffff,
        Phaser.Math.FloatBetween(0.2, 0.7)
      );
      this.stars.push(star);
    }
  }

  private createLanes(width: number): void {
    GAME_CONFIG.LANES_Y.forEach((laneY, idx) => {
      const g = this.add.graphics();
      g.lineStyle(2, GAME_CONFIG.COLORS.LANE_LINE, 0.6);
      g.lineBetween(0, laneY, width, laneY);
      g.lineStyle(10, GAME_CONFIG.COLORS.LANE_GLOW, 0.1);
      g.lineBetween(0, laneY, width, laneY);

      const zone = this.add.zone(width / 2, laneY, width, 100).setOrigin(0.5);
      zone.setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this.switchLaneTo(idx));
    });
  }

  private createPlayer(): void {
    this.playerContainer = this.add.container(
      GAME_CONFIG.PLAYER_X,
      GAME_CONFIG.LANES_Y[this.currentLane]
    );

    this.playerAura = this.add.circle(0, 0, 36, GAME_CONFIG.COLORS.CYAN, 0.25);
    this.playerRing = this.add.circle(0, 0, 24, GAME_CONFIG.COLORS.CYAN, 0.5);
    this.playerCore = this.add.circle(0, 0, 14, 0xffffff, 1);

    this.playerContainer.add([this.playerAura, this.playerRing, this.playerCore]);

    this.tweens.add({
      targets: this.playerAura,
      scale: 1.3,
      alpha: 0.1,
      duration: 500,
      yoyo: true,
      repeat: -1,
    });
  }

  private createHUD(width: number): void {
    this.scoreText = this.add.text(28, 24, 'SCORE: 0', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '26px',
      fontStyle: 'bold',
      color: '#00f5ff',
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
  }

  private setupInput(): void {
    if (!this.input.keyboard) return;

    this.input.keyboard.on('keydown', (event: KeyboardEvent) => {
      this.soundEngine.init();
      if (this.isGameOver) return;

      if (event.code === 'KeyW' || event.code === 'ArrowUp') {
        this.moveLane(-1);
      } else if (event.code === 'KeyS' || event.code === 'ArrowDown') {
        this.moveLane(1);
      } else if (event.code === 'Space' || event.code === 'KeyF' || event.code === 'KeyE') {
        this.togglePolarity();
      }
    });

    this.input.on('pointerdown', () => {
      this.soundEngine.init();
      this.soundEngine.startBeat();
    });
  }

  private moveLane(delta: number): void {
    const target = Phaser.Math.Clamp(this.currentLane + delta, 0, GAME_CONFIG.LANES_Y.length - 1);
    this.switchLaneTo(target);
  }

  private switchLaneTo(laneIdx: number): void {
    if (laneIdx === this.currentLane || this.isGameOver) return;
    this.currentLane = laneIdx;

    this.tweens.add({
      targets: this.playerContainer,
      y: GAME_CONFIG.LANES_Y[this.currentLane],
      duration: 120,
      ease: 'Cubic.easeOut',
    });

    this.createGhostTrail();
    this.soundEngine.playSwitch();
  }

  private togglePolarity(): void {
    if (this.isGameOver) return;
    this.currentPolarity = this.currentPolarity === 'CYAN' ? 'MAGENTA' : 'CYAN';
    this.updatePlayerVisuals();
    this.soundEngine.playSwitch();

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
  }

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
    if (this.isGameOver) return;
    const dt = delta / 1000;

    this.stars.forEach((star) => {
      star.x -= this.speed * 0.25 * dt;
      if (star.x < 0) {
        star.x = this.scale.width;
        star.y = Phaser.Math.Between(0, this.scale.height);
      }
    });

    if (this.speed < GAME_CONFIG.MAX_SPEED) {
      this.speed += GAME_CONFIG.SPEED_ACCELERATION * dt;
    }

    this.spawnTimer += delta;
    if (this.spawnTimer > GAME_CONFIG.SPAWN_INTERVAL_MS) {
      this.spawnTimer = 0;
      this.spawnTraffic();
    }

    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      item.container.x -= this.speed * dt;

      if (!item.collected && Math.abs(item.container.x - GAME_CONFIG.PLAYER_X) < 36 && item.lane === this.currentLane) {
        this.handleCollision(item);
      }

      if (item.container.x < -60) {
        item.container.destroy();
        this.items.splice(i, 1);
      }
    }
  }

  private spawnTraffic(): void {
    const lane = Phaser.Math.Between(0, 2);
    const rand = Math.random();

    if (rand < 0.65) {
      const polarity: Polarity = Math.random() < 0.5 ? 'CYAN' : 'MAGENTA';
      this.spawnOrb(lane, polarity);
    } else if (rand < 0.90) {
      this.spawnSpike(lane);
    } else {
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
    const spike = this.add.triangle(0, 0, -18, 18, 0, -18, 18, 18, GAME_CONFIG.COLORS.SPIKE);
    spike.setStrokeStyle(2, 0xffffff, 0.9);
    cont.add(spike);

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

    this.items.push({
      type: 'STAR',
      lane,
      container: cont,
    });
  }

  private handleCollision(item: GameItem): void {
    item.collected = true;

    if (item.type === 'ORB') {
      if (item.polarity === this.currentPolarity) {
        this.combo += 1;
        const multiplier = Math.min(8, 1 + Math.floor(this.combo / 4));
        const gain = 100 * multiplier;
        this.score += gain;

        this.showFloatingText(item.container.x, item.container.y, `+${gain}`, 0x00f5ff);
        this.createParticles(item.container.x, item.container.y, item.polarity === 'CYAN' ? GAME_CONFIG.COLORS.CYAN : GAME_CONFIG.COLORS.MAGENTA);
        this.soundEngine.playCollect(this.combo);
      } else {
        this.takeDamage('POLARITY MISMATCH!');
      }
    } else if (item.type === 'SPIKE') {
      this.takeDamage('HAZARD HIT!');
    } else if (item.type === 'STAR') {
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
      this.isGameOver = true;
      this.soundEngine.stopBeat();
    }
  }

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
    const mult = Math.min(8, 1 + Math.floor(this.combo / 4));
    this.comboText.setText(`COMBO x${mult} (${this.combo})`);
    const hearts = '❤️'.repeat(Math.max(0, this.lives)) + '🖤'.repeat(Math.max(0, 3 - this.lives));
    this.livesText.setText(`SHIELD: ${hearts}`);
  }
}
