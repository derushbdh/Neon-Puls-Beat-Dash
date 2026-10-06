import Phaser from 'phaser';

const GAME_CONFIG = {
  LANES_Y: [220, 340, 460],
  PLAYER_X: 180,
  START_SPEED: 380,
  COLORS: {
    CYAN: 0x00f5ff,
    MAGENTA: 0xff007f,
    BG_DARK: 0x070b19,
    LANE_LINE: 0x1e293b,
    LANE_GLOW: 0x334155,
  },
} as const;

/**
 * Игровая сцена: 3-полосная трасса и перемещение импульса
 */
export class GameScene extends Phaser.Scene {
  private playerContainer!: Phaser.GameObjects.Container;
  private playerCore!: Phaser.GameObjects.Arc;
  private playerRing!: Phaser.GameObjects.Arc;
  private playerAura!: Phaser.GameObjects.Arc;
  private currentLane = 1;
  private stars: Phaser.GameObjects.Arc[] = [];

  constructor() {
    super('GameScene');
  }

  create(): void {
    const { width, height } = this.scale;

    this.createBackground(width, height);
    this.createLanes(width);
    this.createPlayer();
    this.setupInput();
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

  private setupInput(): void {
    if (!this.input.keyboard) return;

    this.input.keyboard.on('keydown', (event: KeyboardEvent) => {
      if (event.code === 'KeyW' || event.code === 'ArrowUp') {
        this.moveLane(-1);
      } else if (event.code === 'KeyS' || event.code === 'ArrowDown') {
        this.moveLane(1);
      }
    });
  }

  private moveLane(delta: number): void {
    const target = Phaser.Math.Clamp(this.currentLane + delta, 0, GAME_CONFIG.LANES_Y.length - 1);
    this.switchLaneTo(target);
  }

  private switchLaneTo(laneIdx: number): void {
    if (laneIdx === this.currentLane) return;
    this.currentLane = laneIdx;

    this.tweens.add({
      targets: this.playerContainer,
      y: GAME_CONFIG.LANES_Y[this.currentLane],
      duration: 120,
      ease: 'Cubic.easeOut',
    });
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;
    this.stars.forEach((star) => {
      star.x -= GAME_CONFIG.START_SPEED * 0.25 * dt;
      if (star.x < 0) {
        star.x = this.scale.width;
        star.y = Phaser.Math.Between(0, this.scale.height);
      }
    });
  }
}
