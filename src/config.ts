/**
 * 游戏配置
 * 自动检测设备类型并调整游戏参数
 */
export type QualityPreset = 'auto' | 'performance' | 'balanced' | 'quality';
type ResolvedQualityPreset = Exclude<QualityPreset, 'auto'>;

type QualityParams = {
  maxPixelRatio: number;
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
  /**
   * 平板级设备判定阈值：设备屏幕（screen.width / screen.height，CSS px）的短边。
   * 按屏幕而不是视口：横屏 Android Chrome 扣掉工具栏 / 状态栏 / 导航栏后视口高度常只剩
   * 630-700 px；屏幕尺寸不随工具栏、旋转、全屏变化。手机屏幕短边都在 600 以下，iPad 都在 744 以上。
   * 只决定运行时性能档；触控布局仍由 index.html 等处“视口短边 700 px”的媒体查询决定，与它无关。
   */
  private static readonly TABLET_MIN_SCREEN_SHORT_SIDE = 600;
  /** 平板的固定模拟步长（Hz）：所有画质档一致，不随 targetFPS 降到 30 */
  private static readonly TABLET_TARGET_FPS = 60;
  /** 平板在 auto 画质下的像素比上限（手机 auto 为 performance 档的 1.2） */
  private static readonly TABLET_AUTO_MAX_PIXEL_RATIO = 1.5;
  /**
   * 自适应分辨率在设备上限以下的像素比档位（从高到低，最低 1.0）：平板 1.5 → 1.25 → 1.0，
   * 手机 1.2 → 1.0（高于设备上限的档位不用）。见 getPixelRatioSteps / GameLoop.evaluateAdaptiveResolution
   */
  private static readonly ADAPTIVE_PIXEL_RATIO_STEPS: readonly number[] = [1.25, 1];

  public static isMobile: boolean = this.detectMobile();
  /** 仅明确的 Android/HarmonyOS UA 开启专属优化；Apple 与未知平台保持原路径。 */
  public static readonly isAndroid: boolean =
    typeof navigator !== 'undefined' &&
    !/iPhone|iPad|iPod|Macintosh/i.test(navigator.userAgent) &&
    !/Mac|iPhone|iPad|iPod/i.test(navigator.platform) &&
    /Android|HarmonyOS/i.test(navigator.userAgent);
  /**
   * 平板级设备（运行时性能档：60 Hz 模拟、auto 画质像素比上限 1.5）：触控设备且设备屏幕短边
   * ≥ 600 CSS px；与 isMobile 一样只在启动时判定一次。没有布局代码读它。
   */
  public static isTablet: boolean = this.detectTablet();
  private static qualityPreset: QualityPreset = 'auto';
  private static runtimeQualityOverride?: ResolvedQualityPreset;
  /** 自适应分辨率当前比设备上限低几档（0 = 不降）；切换画质预设时归零 */
  private static adaptivePixelRatioLevel = 0;

  /**
   * 同时在场的敌机上限（玩法规则，与画质无关）：以前随画质档 4-14 架浮动，
   * 导致高画质 / 运行中自动降档会改变难度。桌面与移动端各用一个固定值
   * （移动端触屏操控更难，少一架）。波次总量见 LevelConfig.enemiesPerWave。
   */
  private static readonly MAX_CONCURRENT_ENEMIES = { desktop: 6, mobile: 5 } as const;

  private static readonly QUALITY_PRESETS: Record<ResolvedQualityPreset, DeviceQualityParams> = {
    performance: {
      mobile: {
        maxPixelRatio: 1.2,
        particleCount: 12,
        projectilePoolSize: 80,
        targetFPS: 30,
        shadowEnabled: false,
        antialiasEnabled: false,
      },
      desktop: {
        maxPixelRatio: 1.5,
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
        particleCount: 20,
        projectilePoolSize: 100,
        targetFPS: 30,
        shadowEnabled: false,
        antialiasEnabled: false,
      },
      desktop: {
        maxPixelRatio: 2,
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
        particleCount: 30,
        projectilePoolSize: 130,
        targetFPS: 45,
        shadowEnabled: false,
        antialiasEnabled: true,
      },
      desktop: {
        maxPixelRatio: 2,
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
    this.adaptivePixelRatioLevel = 0;
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
    if (this.isTabletDevice()) {
      return this.TABLET_TARGET_FPS;
    }
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

  /**
   * 平板级：触控设备（isMobile，且确有触控输入：'ontouchstart' 或 maxTouchPoints > 0——
   * 只因窗口窄被判成 isMobile 的桌面不算）且设备屏幕短边 ≥ 600 CSS px。
   * 触控输入不依赖 UA：Chrome“桌面版网站”模式下 Android 平板报的是 Linux 桌面 UA，仍算平板级。
   */
  private static detectTablet(): boolean {
    const hasTouch =
      'ontouchstart' in window ||
      (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0);
    if (!this.isMobile || !hasTouch || typeof screen === 'undefined') {
      return false;
    }
    const shortSide = Math.min(screen.width, screen.height);
    return Number.isFinite(shortSide) && shortSide >= this.TABLET_MIN_SCREEN_SHORT_SIDE;
  }

  /** isTablet 只在触控设备上生效：isMobile 被改成 false 时一律按桌面取值 */
  private static isTabletDevice(): boolean {
    return this.isMobile && this.isTablet;
  }

  // 渲染设置
  public static getPixelRatio(): number {
    return Math.min(window.devicePixelRatio, this.getMaxPixelRatio());
  }

  /**
   * 像素比上限的档位（从高到低）：第一项是当前画质下的设备上限，其后是自适应分辨率可降到的档位。
   * 平板 auto 画质为 [1.5, 1.25, 1]，手机 auto 画质为 [1.2, 1]
   */
  public static getPixelRatioSteps(): readonly number[] {
    const deviceCap = this.getDevicePixelRatioCap();
    return [deviceCap, ...this.ADAPTIVE_PIXEL_RATIO_STEPS.filter((step) => step < deviceCap)];
  }

  /** 当前画质下的设备像素比上限（自适应分辨率之前） */
  private static getDevicePixelRatioCap(): number {
    const maxPixelRatio = this.getQualityProfile().maxPixelRatio;
    if (this.isTabletDevice() && this.qualityPreset === 'auto') {
      return Math.max(maxPixelRatio, this.TABLET_AUTO_MAX_PIXEL_RATIO);
    }
    return maxPixelRatio;
  }

  /** 像素比上限：设备上限，自适应分辨率生效时再按当前档位往下取（每个模拟步都会读，不分配数组） */
  private static getMaxPixelRatio(): number {
    const deviceCap = this.getDevicePixelRatioCap();
    if (this.adaptivePixelRatioLevel === 0 || !this.isAdaptiveResolutionActive()) {
      return deviceCap;
    }
    let ratio = deviceCap;
    let level = 0;
    for (const step of this.ADAPTIVE_PIXEL_RATIO_STEPS) {
      if (level >= this.adaptivePixelRatioLevel) {
        break;
      }
      if (step < deviceCap) {
        ratio = step;
        level++;
      }
    }
    return ratio;
  }

  /**
   * 自适应分辨率是否生效：触控设备、画质预设为 auto、且当前已是 performance 档（画质档无处可降）。
   * 显式选择的画质预设从不自动改像素比；桌面不受影响
   */
  public static isAdaptiveResolutionActive(): boolean {
    return (
      this.isMobile &&
      this.qualityPreset === 'auto' &&
      this.getEffectiveQualityPreset() === 'performance'
    );
  }

  /** 自适应分辨率当前比设备上限低几档（0 = 不降） */
  public static getAdaptivePixelRatioLevel(): number {
    return this.adaptivePixelRatioLevel;
  }

  /**
   * 自适应分辨率移动一档：direction = -1 降一档（更低像素比），+1 升一档。
   * 只在 isAdaptiveResolutionActive() 时生效；不低于最后一档（1.0）、不高于设备上限。
   * 返回档位是否改变（像素比由 GameScene.applyQualitySettings 经 GameCoordinator 重新应用）
   */
  public static stepAdaptivePixelRatio(direction: -1 | 1): boolean {
    if (!this.isAdaptiveResolutionActive()) {
      return false;
    }
    const lowestLevel = this.getPixelRatioSteps().length - 1;
    const current = Math.min(this.adaptivePixelRatioLevel, lowestLevel);
    const next = Math.max(0, Math.min(lowestLevel, current - direction));
    if (next === this.adaptivePixelRatioLevel) {
      return false;
    }
    this.adaptivePixelRatioLevel = next;
    return true;
  }

  public static getShadowEnabled(): boolean {
    return this.getQualityProfile().shadowEnabled;
  }

  public static getAntialiasEnabled(): boolean {
    return this.getQualityProfile().antialiasEnabled;
  }

  // 游戏参数
  public static getMaxEnemies(): number {
    return this.isMobile ? this.MAX_CONCURRENT_ENEMIES.mobile : this.MAX_CONCURRENT_ENEMIES.desktop;
  }

  public static getParticleCount(): number {
    return this.getQualityProfile().particleCount;
  }

  public static getProjectilePoolSize(): number {
    return this.getQualityProfile().projectilePoolSize;
  }

  // 性能目标（同时是固定模拟步长，见 GameLoop.applyQualityProfile）
  public static getTargetFPS(): number {
    if (this.isTabletDevice()) {
      return this.TABLET_TARGET_FPS;
    }
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
    // 触控辅助飞行（InputState.flightAssist，见 PlayerController.applyAssistedAttitude）
    ASSIST_MAX_BANK: Math.PI / 4,              // 满偏航时的目标坡度（弧度，45°）
    ASSIST_PITCH_LIMIT: (75 * Math.PI) / 180,  // 机头相对地平线的俯仰上限（弧度，75°）
    ASSIST_ROLL_RESPONSE: 5,                   // 坡度逼近目标的响应（1/秒，越大越快）
    ASSIST_ROLL_MAX_RATE: 2.6,                 // 坡度变化的最大角速度（弧度/秒）
  },

  // 子弹参数
  PROJECTILE: {
    SPEED: 100,            // 速度
    MAX_DISTANCE: 500,     // 最大飞行距离
    POOL_SIZE: 200,        // 对象池大小
  },

  // 机炮辅助瞄准（GunLeadSolver 解算；子弹与机炮十字共用同一个辅助方向）。触屏设备用 FULL_ANGLE /
  // OUTER_ANGLE；键盘（非触屏）用更小的 KEYBOARD_FULL_ANGLE / KEYBOARD_OUTER_ANGLE，其余参数两边共用
  GUN_ASSIST: {
    MAX_RANGE: 480,                          // 目标超过这个距离不辅助（米，略小于子弹射程）
    FULL_ANGLE: (2.5 * Math.PI) / 180,       // 瞄准点离机头轴线不超过它：辅助方向正对瞄准点；也是偏移上限
    OUTER_ANGLE: (5 * Math.PI) / 180,        // 从 FULL_ANGLE 到它：偏移平滑减到零；再往外不辅助
    KEYBOARD_FULL_ANGLE: (1.25 * Math.PI) / 180,  // 键盘的 FULL_ANGLE（触屏的一半）
    KEYBOARD_OUTER_ANGLE: (2.5 * Math.PI) / 180,  // 键盘的 OUTER_ANGLE（触屏的一半）
    EASE_TIME: 0.1,                          // 目标出现 / 消失 / 更换时，十字滑到新位置约 95% 所需时间（秒）
    SWITCH_MARGIN: (0.75 * Math.PI) / 180,   // 换辅助目标：新目标离机头轴线必须近出这么多（防来回跳）
    REFERENCE_RANGE: 600,                    // 准星参考距离（米）：捕获环中心与无辅助时的十字都在机头前方这么远处
    CROSS_MIN_RANGE: 100,                    // 辅助生效时十字按瞄准点的距离画（追尾视角才落在目标上），最近按它算
  },

  // 相机参数
  CAMERA: {
    FOV: 75,
    NEAR: 0.1,
    FAR: 5000,
    OFFSET: { x: 0, y: 5, z: 15 },
    SMOOTH_FACTOR: 0.1,
  },

  // 世界参数
  WORLD: {
    FOG_NEAR: 100,
    FOG_FAR: 1000,
    SKYBOX_SIZE: 1000,
    /** 战场水平半径（米），战场跨度为 2 倍该值（面积为旧版 4 倍） */
    BATTLEFIELD_HALF_EXTENT: 1500,
    /** 软边界起始半径：超过后产生渐强回推力，防止飞出战场 */
    SOFT_BOUNDARY_RADIUS: 1350,
    /** 软顶界高度：超过后柔和下压 */
    SOFT_CEILING: 540,
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

  // 导弹参数（只用于玩家的锁定导弹；Boss / 单位导弹各有自己的参数，不读这里）
  MISSILE: {
    SPEED: 200,            // 巡航速度（米/秒）：离架后加速到它
    LAUNCH_SPEED_BOOST: 20, // 离架初速 = 发射瞬间的载机速度 + 它
    ACCELERATION: 200,     // 离架后的加速度（米/秒²）
    MIN_OVERTAKE_SPEED: 80, // 巡航速度至少比发射瞬间的载机快这么多
    DAMAGE: 80,            // 导弹伤害（CombatSystem 命中结算读取，再乘伤害倍率）
    TURN_SPEED: 5.0,       // 转向速度（弧度/秒）：巡航时转弯半径 40 米，与旧版（80 米/秒、2.0）相同
    MAX_LIFETIME: 12,      // 最大寿命（秒）：巡航 12 秒约 2400 米，与最大飞行距离一致
    MAX_LOCK_DISTANCE: 1200, // 导引头最大锁定距离
    MAX_FLIGHT_DISTANCE: 2400, // 最大飞行距离（是锁定距离的2倍）
    LOCK_RING_RATIO: 0.13, // 捕获环半径 / 视口短边（再乘锁定范围升级倍率）
    LOCK_KEEP_RATIO: 1.6,  // 保持环半径 / 捕获环半径
    LOCK_GRACE_TIME: 0.5,  // 目标离开保持环后的宽限时间（秒）
    LOCK_DECAY_RATE: 1.0,  // 目标在捕获环外时锁定进度的衰减速度（每秒）
    LOCK_REARM_TIME: 0.35, // 两次发射之间的最短间隔（秒）
    STARTING_MISSILES: 3,  // 初始导弹数量
    MAX_MISSILES: 5,       // 最大导弹数量
    MAX_RESPAWN_MISSILES: 5, // 导弹补给上限
  },
};
