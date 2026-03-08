/**
 * 游戏配置
 * 自动检测设备类型并调整游戏参数
 */
export type QualityPreset = 'auto' | 'performance' | 'balanced' | 'quality';
type ResolvedQualityPreset = Exclude<QualityPreset, 'auto'>;

type QualityParams = {
  maxPixelRatio: number;
  maxEnemies: number;
  particleCount: number;
  projectilePoolSize: number;
  targetFPS: number;
  shadowEnabled: boolean;
  antialiasEnabled: boolean;
};

type DeviceQualityParams = {
  mobile: QualityParams;
  desktop: QualityParams;
};

export class GameConfig {
  public static isMobile: boolean = this.detectMobile();
  private static qualityPreset: QualityPreset = 'auto';
  private static runtimeQualityOverride?: ResolvedQualityPreset;

  private static readonly QUALITY_PRESETS: Record<ResolvedQualityPreset, DeviceQualityParams> = {
    performance: {
      mobile: {
        maxPixelRatio: 1.2,
        maxEnemies: 4,
        particleCount: 12,
        projectilePoolSize: 80,
        targetFPS: 30,
        shadowEnabled: false,
        antialiasEnabled: false,
      },
      desktop: {
        maxPixelRatio: 1.5,
        maxEnemies: 6,
        particleCount: 35,
        projectilePoolSize: 160,
        targetFPS: 45,
        shadowEnabled: false,
        antialiasEnabled: false,
      },
    },
    balanced: {
      mobile: {
        maxPixelRatio: 1.5,
        maxEnemies: 5,
        particleCount: 20,
        projectilePoolSize: 100,
        targetFPS: 30,
        shadowEnabled: false,
        antialiasEnabled: false,
      },
      desktop: {
        maxPixelRatio: 2,
        maxEnemies: 10,
        particleCount: 50,
        projectilePoolSize: 200,
        targetFPS: 60,
        shadowEnabled: true,
        antialiasEnabled: true,
      },
    },
    quality: {
      mobile: {
        maxPixelRatio: 1.5,
        maxEnemies: 7,
        particleCount: 30,
        projectilePoolSize: 130,
        targetFPS: 45,
        shadowEnabled: false,
        antialiasEnabled: true,
      },
      desktop: {
        maxPixelRatio: 2,
        maxEnemies: 14,
        particleCount: 75,
        projectilePoolSize: 260,
        targetFPS: 75,
        shadowEnabled: true,
        antialiasEnabled: true,
      },
    },
  };

  public static setQualityPreset(preset: QualityPreset): void {
    this.qualityPreset = preset;
    this.normalizeRuntimeQualityOverride();
  }

  public static getQualityPreset(): QualityPreset {
    return this.qualityPreset;
  }

  public static setRuntimeQualityOverride(preset?: ResolvedQualityPreset): void {
    this.runtimeQualityOverride = preset;
    this.normalizeRuntimeQualityOverride();
  }

  public static clearRuntimeQualityOverride(): void {
    this.runtimeQualityOverride = undefined;
  }

  public static getRuntimeQualityOverride(): ResolvedQualityPreset | undefined {
    return this.runtimeQualityOverride;
  }

  public static getResolvedQualityPreset(): ResolvedQualityPreset {
    return this.resolveQualityPreset(this.qualityPreset);
  }

  public static getEffectiveQualityPreset(): ResolvedQualityPreset {
    return this.runtimeQualityOverride ?? this.getResolvedQualityPreset();
  }

  public static getTargetFPSForPreset(preset: QualityPreset): number {
    return this.getQualityProfileForPreset(preset).targetFPS;
  }

  private static getQualityRank(preset: ResolvedQualityPreset): number {
    const order: ResolvedQualityPreset[] = ['performance', 'balanced', 'quality'];
    return order.indexOf(preset);
  }

  private static resolveQualityPreset(preset: QualityPreset): ResolvedQualityPreset {
    if (preset === 'auto') {
      return this.isMobile ? 'performance' : 'balanced';
    }
    return preset;
  }

  private static normalizeRuntimeQualityOverride(): void {
    if (!this.runtimeQualityOverride) {
      return;
    }

    const resolvedPreset = this.getResolvedQualityPreset();
    if (this.getQualityRank(this.runtimeQualityOverride) >= this.getQualityRank(resolvedPreset)) {
      this.runtimeQualityOverride = undefined;
    }
  }

  private static getQualityProfileForPreset(preset: QualityPreset): QualityParams {
    const resolvedPreset = this.resolveQualityPreset(preset);
    const data = this.QUALITY_PRESETS[resolvedPreset];
    return this.isMobile ? data.mobile : data.desktop;
  }

  private static getQualityProfile(): QualityParams {
    return this.getQualityProfileForPreset(this.getEffectiveQualityPreset());
  }

  // 设备检测
  private static detectMobile(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      || (window.innerWidth <= 768)
      || ('ontouchstart' in window);
  }

  // 渲染设置
  public static getPixelRatio(): number {
    return Math.min(window.devicePixelRatio, this.getQualityProfile().maxPixelRatio);
  }

  public static getShadowEnabled(): boolean {
    return this.getQualityProfile().shadowEnabled;
  }

  public static getAntialiasEnabled(): boolean {
    return this.getQualityProfile().antialiasEnabled;
  }

  // 游戏参数
  public static getMaxEnemies(): number {
    return this.getQualityProfile().maxEnemies;
  }

  public static getParticleCount(): number {
    return this.getQualityProfile().particleCount;
  }

  public static getProjectilePoolSize(): number {
    return this.getQualityProfile().projectilePoolSize;
  }

  // 性能目标
  public static getTargetFPS(): number {
    return this.getQualityProfile().targetFPS;
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
    BASE_SPEED: 45,        // 基础速度
    MAX_SPEED: 45,         // 最大速度（与狙击机相同）
    BASE_HEALTH: 200,      // 基础生命值（翻倍）
    BASE_DAMAGE: 12.5,     // 基础伤害（减半）
    BASE_FIRE_RATE: 0.3,   // 基础射击间隔（加倍，降低射速）
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
    DAMAGE: 50,            // 导弹伤害（减半）
    TURN_SPEED: 2.0,       // 转向速度（弧度/秒）
    MAX_LIFETIME: 10,      // 最大寿命（秒）
    LOCK_TIME: 3.0,        // 锁定所需时间（秒）
    LOCK_BOX_SIZE: 0.15,   // 锁定框大小（屏幕比例）
    MAX_LOCK_DISTANCE: 600, // 最大锁定距离
    MAX_FLIGHT_DISTANCE: 2400, // 最大飞行距离（是锁定距离的4倍）
    STARTING_MISSILES: 2,  // 初始导弹数量
    MAX_MISSILES: 5,       // 最大导弹数量
    MISSILE_RESPAWN_TIME: 7.5, // 导弹补给时间（秒）
    MAX_RESPAWN_MISSILES: 5, // 导弹补给上限
  },
};
