/**
 * 游戏配置
 * 自动检测设备类型并调整游戏参数
 */
export class GameConfig {
  public static isMobile: boolean = this.detectMobile();

  // 设备检测
  private static detectMobile(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      || (window.innerWidth <= 768)
      || ('ontouchstart' in window);
  }

  // 渲染设置
  public static getPixelRatio(): number {
    return this.isMobile ? Math.min(window.devicePixelRatio, 1.5) : Math.min(window.devicePixelRatio, 2);
  }

  public static getShadowEnabled(): boolean {
    return !this.isMobile;
  }

  public static getAntialiasEnabled(): boolean {
    return !this.isMobile;
  }

  // 游戏参数
  public static getMaxEnemies(): number {
    return this.isMobile ? 5 : 10;
  }

  public static getParticleCount(): number {
    return this.isMobile ? 20 : 50;
  }

  public static getProjectilePoolSize(): number {
    return this.isMobile ? 100 : 200;
  }

  // 性能目标
  public static getTargetFPS(): number {
    return this.isMobile ? 30 : 60;
  }

  // 调试模式
  public static DEBUG: boolean = Boolean(import.meta.env.DEV);
}

/**
 * 游戏常量
 */
export const GAME_CONSTANTS = {
  // 玩家飞机参数（基础值）
  PLAYER: {
    PITCH_SPEED: 2.0,      // 俯仰速度
    YAW_SPEED: 1.5,        // 偏航速度
    ROLL_SPEED: 3.0,       // 翻滚速度
    BASE_SPEED: 25,        // 基础速度（减半）
    MAX_SPEED: 50,         // 最大速度（减半）
    BASE_HEALTH: 100,      // 基础生命值
    BASE_DAMAGE: 25,       // 基础伤害
    BASE_FIRE_RATE: 0.15,  // 基础射击间隔
  },

  // 子弹参数
  PROJECTILE: {
    SPEED: 100,            // 速度
    MAX_DISTANCE: 500,     // 最大飞行距离
    POOL_SIZE: 200,        // 对象池大小
  },

  // 相机参数
  CAMERA: {
    FOV: 75,
    NEAR: 0.1,
    FAR: 2000,
    OFFSET: { x: 0, y: 5, z: 15 },
    SMOOTH_FACTOR: 0.1,
  },

  // 世界参数
  WORLD: {
    FOG_NEAR: 100,
    FOG_FAR: 1000,
    SKYBOX_SIZE: 1000,
  },

  // 道具参数
  POWERUP: {
    SPAWN_CHANCE: 0.40,    // 敌人死亡时掉落道具的概率（提高至40%便于测试）
    COLLECT_RADIUS: 5,     // 拾取半径
  },

  // 关卡参数
  LEVEL: {
    START_DELAY: 2,        // 关卡开始延迟
    WAVE_DELAY: 5,         // 波次间隔
    SPAWN_INTERVAL: 3,     // 敌人生成间隔
  },

  // 导弹参数
  MISSILE: {
    SPEED: 80,             // 导弹速度
    DAMAGE: 100,           // 导弹伤害（较高）
    TURN_SPEED: 2.0,       // 转向速度（弧度/秒）
    MAX_LIFETIME: 10,      // 最大寿命（秒）
    LOCK_TIME: 3.0,        // 锁定所需时间（秒）
    LOCK_BOX_SIZE: 0.15,   // 锁定框大小（屏幕比例）
    MAX_LOCK_DISTANCE: 600, // 最大锁定距离
    MAX_FLIGHT_DISTANCE: 1200, // 最大飞行距离（是锁定距离的2倍）
    STARTING_MISSILES: 2,  // 初始导弹数量
  },
};
