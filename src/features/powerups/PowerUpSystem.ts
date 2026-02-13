import * as THREE from 'three';
import { ParticleSystem } from '@/features/effects/ParticleSystem';
import { BalloonPowerUp } from './BalloonPowerUp';
import { SpawnBalloon } from '@/features/effects/SpawnBalloon';

/**
 * 道具类型
 */
export enum PowerUpType {
  HEALTH = 'HEALTH',           // 恢复生命
  SHIELD = 'SHIELD',           // 护盾
  SPEED = 'SPEED',             // 速度提升
  DAMAGE = 'DAMAGE',           // 伤害提升
  MULTISHOT = 'MULTISHOT',     // 多重射击
  BOMB = 'BOMB',               // 清屏炸弹
}

/**
 * 道具配置
 */
export interface PowerUpConfig {
  type: PowerUpType;
  name: string;
  description: string;
  color: number;
  duration: number;    // 持续时间（秒），-1 表示永久
  value: number;       // 效果值
  icon: string;        // 图标
}

/**
 * 道具配置预设
 */
export const POWER_UP_CONFIGS: Record<PowerUpType, PowerUpConfig> = {
  [PowerUpType.HEALTH]: {
    type: PowerUpType.HEALTH,
    name: '生命恢复',
    description: '恢复 30 点生命值',
    color: 0x00ff00,
    duration: 0,  // 即时效果
    value: 30,
    icon: '❤️',
  },
  [PowerUpType.SHIELD]: {
    type: PowerUpType.SHIELD,
    name: '能量护盾',
    description: '获得 10 秒无敌护盾',
    color: 0x00ffff,
    duration: 10,
    value: 1,
    icon: '🛡️',
  },
  [PowerUpType.SPEED]: {
    type: PowerUpType.SPEED,
    name: '速度提升',
    description: '速度提升 50%，持续 15 秒',
    color: 0xffff00,
    duration: 15,
    value: 1.5,
    icon: '⚡',
  },
  [PowerUpType.DAMAGE]: {
    type: PowerUpType.DAMAGE,
    name: '伤害提升',
    description: '伤害提升 100%，持续 20 秒',
    color: 0xff4444,
    duration: 20,
    value: 2.0,
    icon: '🔥',
  },
  [PowerUpType.MULTISHOT]: {
    type: PowerUpType.MULTISHOT,
    name: '多重射击',
    description: '同时发射 3 发子弹，持续 12 秒',
    color: 0xff00ff,
    duration: 12,
    value: 3,
    icon: '🎯',
  },
  [PowerUpType.BOMB]: {
    type: PowerUpType.BOMB,
    name: '清屏炸弹',
    description: '消灭屏幕上所有敌人',
    color: 0xff8800,
    duration: 0,
    value: 1,
    icon: '💣',
  },
};

/**
 * 道具效果状态
 */
export interface ActivePowerUp {
  type: PowerUpType;
  config: PowerUpConfig;
  remainingTime: number;
  startTime: number;
}

/**
 * 道具管理器
 */
export class PowerUpManager {
  private scene: THREE.Scene;
  private balloons: BalloonPowerUp[] = [];
  private activePowerUps: ActivePowerUp[] = [];
  private particleSystem: ParticleSystem;
  private spawnEffects: SpawnBalloon[] = []; // 气球生成特效列表
  private spawningPositions: Set<string> = new Set(); // 正在生成的位置（避免重复生成）

  // 回调
  public onPowerUpCollected?: (type: PowerUpType, config: PowerUpConfig) => void;
  public onPowerUpExpired?: (type: PowerUpType) => void;
  public onBombUsed?: () => void;

  constructor(scene: THREE.Scene, particleSystem: ParticleSystem) {
    this.scene = scene;
    this.particleSystem = particleSystem;
  }

  /**
   * 生成气球道具
   */
  public spawn(position: THREE.Vector3, type?: PowerUpType, icon?: string): void {
    // 检查是否已有气球或特效在此位置生成（避免重复）
    const posKey = `${Math.floor(position.x)},${Math.floor(position.z)}`;
    if (this.spawningPositions.has(posKey)) {
      return;
    }
    this.spawningPositions.add(posKey);

    // 随机选择类型（如果没有指定）
    const powerUpType = type || this.getRandomPowerUpType();

    // 随机图标（如果没有指定）
    const displayIcon = icon || (Math.random() > 0.5 ? '?' : POWER_UP_CONFIGS[powerUpType].icon);

    // 创建生成特效
    const spawnEffect = new SpawnBalloon(position.clone(), () => {
      // 特效完成后创建气球
      const balloon = new BalloonPowerUp(position.clone(), powerUpType, displayIcon);
      this.balloons.push(balloon);
      this.scene.add(balloon.getMesh());

      // 移除生成位置标记
      this.spawningPositions.delete(posKey);

      // 移除特效
      const effectIndex = this.spawnEffects.indexOf(spawnEffect);
      if (effectIndex !== -1) {
        this.spawnEffects.splice(effectIndex, 1);
      }
      spawnEffect.dispose();
    });
    this.spawnEffects.push(spawnEffect);
    this.scene.add(spawnEffect.getMesh());
  }

  /**
   * 获取随机道具类型
   */
  private getRandomPowerUpType(): PowerUpType {
    const types = Object.values(PowerUpType);
    // 均匀分布：HEALTH, SHIELD, SPEED, DAMAGE, MULTISHOT, BOMB
    const weights = [25, 20, 20, 20, 10, 5];
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let random = Math.random() * totalWeight;

    for (let i = 0; i < types.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return types[i];
      }
    }

    return PowerUpType.HEALTH; // 默认为生命恢复
  }

  /**
   * 更新气球系统
   */
  public update(deltaTime: number): void {
    // 更新所有气球动画
    for (const balloon of this.balloons) {
      balloon.update(deltaTime);
    }

    // 更新生成特效
    for (let i = this.spawnEffects.length - 1; i >= 0; i--) {
      const effect = this.spawnEffects[i];
      effect.update(deltaTime);

      if (effect.isFinished()) {
        this.spawnEffects.splice(i, 1);
        effect.dispose();
      }
    }
  }

  /**
   * 检查子弹碰撞（打破气球）
   */
  public checkProjectileCollisions(
    projectilePositions: THREE.Vector3[],
    onHit: (balloon: BalloonPowerUp, type: PowerUpType) => void
  ): void {
    for (let i = this.balloons.length - 1; i >= 0; i--) {
      const balloon = this.balloons[i];

      // 检查气球是否可以被打破（无敌时间）
      if (!balloon.canBeHit()) {
        continue;
      }

      for (const projPos of projectilePositions) {
        // 检查碰撞（气球高度约 5，使用半径 3）
        if (balloon.getMesh().position.distanceTo(projPos) < 3) {
          // 击中！
          const type = balloon.getConfig().type;

          // 先触发回调（回调中可能会需要气球信息）
          onHit(balloon, type);

          // 创建爆炸粒子效果
          this.createExplosion(balloon.getMesh().position.clone(), type);

          // 移除气球
          balloon.dispose(this.scene);
          this.balloons.splice(i, 1);

          // 只处理一次碰撞
          break;
        }
      }
    }
  }

  /**
   * 检查玩家碰撞（收集道具）
   */
  public checkPlayerCollisions(
    playerPosition: THREE.Vector3,
    onCollect: (type: PowerUpType, config: PowerUpConfig) => void
  ): void {
    for (let i = this.balloons.length - 1; i >= 0; i--) {
      const balloon = this.balloons[i];

      // 检查碰撞（使用气球高度）
      if (balloon.getMesh().position.distanceTo(playerPosition) < 3) {
        const type = balloon.getConfig().type;
        const config = POWER_UP_CONFIGS[type];

        // 先触发收集回调
        onCollect(type, config);

        // 移除气球
        balloon.dispose(this.scene);
        this.balloons.splice(i, 1);

        // 只处理一次碰撞
        break;
      }
    }
  }

  /**
   * 创建爆炸粒子效果
   */
  private createExplosion(position: THREE.Vector3, _type: PowerUpType): void {
    // 使用最小的爆炸规模，避免性能问题
    this.particleSystem.createExplosion(position, 0.5);
  }

  /**
   * 检查是否有某种效果
   */
  public hasEffect(type: PowerUpType): boolean {
    return this.activePowerUps.some(p => p.type === type);
  }

  /**
   * 获取气球列表（用于碰撞检测）
   */
  public getBalloons(): BalloonPowerUp[] {
    return this.balloons;
  }

  /**
   * 气球被销毁时的回调
   */
  public onBalloonDestroyed?: (balloon: BalloonPowerUp, type: PowerUpType, config: PowerUpConfig) => void;

  /**
   * 清除所有道具
   */
  public clear(): void {
    for (const balloon of this.balloons) {
      balloon.dispose(this.scene);
    }
    this.balloons = [];
    this.activePowerUps = [];

    // 清除生成特效
    for (const effect of this.spawnEffects) {
      effect.dispose();
    }
    this.spawnEffects = [];

    // 清除生成位置记录
    this.spawningPositions.clear();
  }

  /**
   * 获取所有活跃效果
   */
  public getActiveEffects(): ActivePowerUp[] {
    return this.activePowerUps;
  }

  /**
   * 清除道具
   */
  public removeBalloon(balloon: BalloonPowerUp): void {
    const index = this.balloons.indexOf(balloon);
    if (index !== -1) {
      balloon.dispose(this.scene);
      this.balloons.splice(index, 1);
    }
  }
}
