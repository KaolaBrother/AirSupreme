/**
 * 游戏配置加载器
 * 从 JSON 文件加载配置，支持热重载和默认值 fallback
 */

export interface PlayerConfig {
  pitchSpeed: number;
  yawSpeed: number;
  rollSpeed: number;
  baseSpeed: number;
  maxSpeed: number;
  baseHealth: number;
  baseDamage: number;
  baseFireRate: number;
}

export interface ProjectileConfig {
  speed: number;
  maxDistance: number;
  poolSize: number;
}

export interface CameraConfig {
  fov: number;
  near: number;
  far: number;
  offsetX: number;
  offsetY: number;
  offsetZ: number;
  smoothFactor: number;
}

export interface WorldConfig {
  fogNear: number;
  fogFar: number;
  skyboxSize: number;
}

export interface PowerUpConfig {
  spawnChance: number;
  collectRadius: number;
}

export interface LevelConfig {
  startDelay: number;
  waveDelay: number;
  spawnInterval: number;
}

export interface MissileConfig {
  speed: number;
  damage: number;
  turnSpeed: number;
  maxLifetime: number;
  lockTime: number;
  lockBoxSize: number;
  maxLockDistance: number;
  maxFlightDistance: number;
  startingMissiles: number;
  maxMissiles: number;
  respawnTime: number;
  maxRespawnMissiles: number;
}

export interface BossMissileConfig {
  scale: number;
  speedMultiplier: number;
  health: number;
  maxRange: number;
  damage: number;
}

export interface FlakCannonConfig {
  speed: number;
  scale: number;
  maxRange: number;
  aoeRadius: number;
  damage: number;
  explosionHeightVariance: number;
}

export interface LaserSweepConfig {
  warningDuration: number;
  sweepDuration: number;
  interval: number;
  damage: number;
  rotationSpeed: number;
  color: number;
  planeThickness: number;
  range: number;
}

export interface EyeConfig {
  health: number;
  damage: number;
  fireInterval: number;
  bulletSpeed: number;
  bulletLength: number;
  bulletRadius: number;
  count: number;
}

export interface TeleportConfig {
  chanceOnHit: number;
  cooldown: number;
  duration: number;
  boundsX: number;
  boundsYMin: number;
  boundsYMax: number;
  boundsZ: number;
}

export interface FighterLaunchConfig {
  interval: number;
  count: number;
  spawnHeight: number;
}

export interface EnemyStateProbabilities {
  CHASE: number;
  FIXED_DIRECTION: number;
  CIRCLE: number;
}

export interface EnemyTypeConfig {
  name: string;
  health: number;
  speed: number;
  damage: number;
  detectionRange: number;
  attackRange: number;
  attackCooldown: number;
  evasionChance: number;
  accuracy: number;
  fireSpreadAngle: number;
  turnSpeed: number;
  maxRollAngle: number;
  wanderRadius: number;
  stateProbabilities: EnemyStateProbabilities;
  stateDurationRange: [number, number];
  circleRadius: number;
  circleHeight: number;
  scoreValue: number;
  color: number;
  scale: number;
}

export interface BossTypeConfig {
  name: string;
  health: number;
  speed: number;
  damage: number;
  scale: number;
  circleRadius: number;
  turnSpeed: number;
  cannonFireInterval: number;
  missileFireInterval: number;
  missileDamage: number;
  maxRange: number;
  scoreValue: number;
}

export interface UpgradeConfig {
  pointsPerScore: number;
  costs: number[];
  missileCosts: number[];
  maxHealthPerLevel: number;
  damagePerLevel: number;
  fireRateReductionPerLevel: number;
  speedPerLevel: number;
  missileLockReductionPerLevel: number;
  missileReloadReductionPerLevel: number;
}

export interface PlatformConfig {
  maxPixelRatio: number;
  maxEnemies: number;
  particleCount: number;
  projectilePoolSize: number;
  targetFPS: number;
  shadowEnabled: boolean;
  antialiasEnabled: boolean;
}

export interface PerformanceConfig {
  mobile: PlatformConfig;
  desktop: PlatformConfig;
}

export interface GameConfigData {
  version: string;
  player: PlayerConfig;
  projectile: ProjectileConfig;
  camera: CameraConfig;
  world: WorldConfig;
  powerup: PowerUpConfig;
  level: LevelConfig;
  missile: MissileConfig;
  bossMissile: BossMissileConfig;
  flakCannon: FlakCannonConfig;
  laserSweep: LaserSweepConfig;
  eye: EyeConfig;
  teleport: TeleportConfig;
  fighterLaunch: FighterLaunchConfig;
  enemies: Record<string, EnemyTypeConfig>;
  bosses: Record<string, BossTypeConfig>;
  upgrade: UpgradeConfig;
  performance: PerformanceConfig;
}

const DEFAULT_CONFIG: GameConfigData = {
  version: '1.0.0',
  player: {
    pitchSpeed: 2.0,
    yawSpeed: 1.5,
    rollSpeed: 3.0,
    baseSpeed: 45,
    maxSpeed: 45,
    baseHealth: 200,
    baseDamage: 12.5,
    baseFireRate: 0.3,
  },
  projectile: {
    speed: 100,
    maxDistance: 500,
    poolSize: 200,
  },
  camera: {
    fov: 75,
    near: 0.1,
    far: 2000,
    offsetX: 0,
    offsetY: 5,
    offsetZ: 15,
    smoothFactor: 0.1,
  },
  world: {
    fogNear: 100,
    fogFar: 1000,
    skyboxSize: 1000,
  },
  powerup: {
    spawnChance: 0.4,
    collectRadius: 5,
  },
  level: {
    startDelay: 2,
    waveDelay: 5,
    spawnInterval: 3,
  },
  missile: {
    speed: 80,
    damage: 50,
    turnSpeed: 2.0,
    maxLifetime: 10,
    lockTime: 3.0,
    lockBoxSize: 0.15,
    maxLockDistance: 600,
    maxFlightDistance: 2400,
    startingMissiles: 2,
    maxMissiles: 10,
    respawnTime: 7.5,
    maxRespawnMissiles: 10,
  },
  bossMissile: {
    scale: 4,
    speedMultiplier: 0.5,
    health: 20,
    maxRange: 5000,
    damage: 90,
  },
  flakCannon: {
    speed: 50,
    scale: 3,
    maxRange: 1500,
    aoeRadius: 50,
    damage: 15,
    explosionHeightVariance: 20,
  },
  laserSweep: {
    warningDuration: 3.0,
    sweepDuration: 6.0,
    interval: 5.0,
    damage: 100,
    rotationSpeed: Math.PI / 3,
    color: 0x00aaff,
    planeThickness: 15,
    range: 800,
  },
  eye: {
    health: 300,
    damage: 20,
    fireInterval: 1.5,
    bulletSpeed: 80,
    bulletLength: 8,
    bulletRadius: 0.3,
    count: 8,
  },
  teleport: {
    chanceOnHit: 0.05,
    cooldown: 10.0,
    duration: 0.5,
    boundsX: 400,
    boundsYMin: 100,
    boundsYMax: 250,
    boundsZ: 400,
  },
  fighterLaunch: {
    interval: 60.0,
    count: 2,
    spawnHeight: 10,
  },
  enemies: {},
  bosses: {},
  upgrade: {
    pointsPerScore: 400,
    costs: [1, 2, 3, 4, 5],
    missileCosts: [3, 4, 5, 6, 7],
    maxHealthPerLevel: 40,
    damagePerLevel: 3.5,
    fireRateReductionPerLevel: 0.04,
    speedPerLevel: 8,
    missileLockReductionPerLevel: 0.2,
    missileReloadReductionPerLevel: 1.0,
  },
  performance: {
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
};

class ConfigLoader {
  private config: GameConfigData = DEFAULT_CONFIG;
  private loaded = false;
  private configPath = '/config/game-config.json';

  async load(): Promise<GameConfigData> {
    if (this.loaded) {
      return this.config;
    }

    try {
      const response = await fetch(this.configPath);
      if (!response.ok) {
        console.warn(`[ConfigLoader] Failed to load config: ${response.status}, using defaults`);
        this.loaded = true;
        return this.config;
      }

      const data = (await response.json()) as GameConfigData;
      this.config = this.mergeWithDefaults(data);
      this.loaded = true;
      console.log(`[ConfigLoader] Loaded config version ${this.config.version}`);
      return this.config;
    } catch (error) {
      console.warn('[ConfigLoader] Error loading config, using defaults:', error);
      this.loaded = true;
      return this.config;
    }
  }

  private mergeWithDefaults(data: Partial<GameConfigData>): GameConfigData {
    return {
      ...DEFAULT_CONFIG,
      ...data,
      player: { ...DEFAULT_CONFIG.player, ...data.player },
      projectile: { ...DEFAULT_CONFIG.projectile, ...data.projectile },
      camera: { ...DEFAULT_CONFIG.camera, ...data.camera },
      world: { ...DEFAULT_CONFIG.world, ...data.world },
      powerup: { ...DEFAULT_CONFIG.powerup, ...data.powerup },
      level: { ...DEFAULT_CONFIG.level, ...data.level },
      missile: { ...DEFAULT_CONFIG.missile, ...data.missile },
      bossMissile: { ...DEFAULT_CONFIG.bossMissile, ...data.bossMissile },
      flakCannon: { ...DEFAULT_CONFIG.flakCannon, ...data.flakCannon },
      laserSweep: { ...DEFAULT_CONFIG.laserSweep, ...data.laserSweep },
      eye: { ...DEFAULT_CONFIG.eye, ...data.eye },
      teleport: { ...DEFAULT_CONFIG.teleport, ...data.teleport },
      fighterLaunch: { ...DEFAULT_CONFIG.fighterLaunch, ...data.fighterLaunch },
      enemies: { ...DEFAULT_CONFIG.enemies, ...data.enemies },
      bosses: { ...DEFAULT_CONFIG.bosses, ...data.bosses },
      upgrade: { ...DEFAULT_CONFIG.upgrade, ...data.upgrade },
      performance: {
        mobile: { ...DEFAULT_CONFIG.performance.mobile, ...data.performance?.mobile },
        desktop: { ...DEFAULT_CONFIG.performance.desktop, ...data.performance?.desktop },
      },
    };
  }

  getConfig(): GameConfigData {
    return this.config;
  }

  getPlayer(): PlayerConfig {
    return this.config.player;
  }

  getProjectile(): ProjectileConfig {
    return this.config.projectile;
  }

  getCamera(): CameraConfig {
    return this.config.camera;
  }

  getWorld(): WorldConfig {
    return this.config.world;
  }

  getPowerUp(): PowerUpConfig {
    return this.config.powerup;
  }

  getLevel(): LevelConfig {
    return this.config.level;
  }

  getMissile(): MissileConfig {
    return this.config.missile;
  }

  getBossMissile(): BossMissileConfig {
    return this.config.bossMissile;
  }

  getFlakCannon(): FlakCannonConfig {
    return this.config.flakCannon;
  }

  getLaserSweep(): LaserSweepConfig {
    return this.config.laserSweep;
  }

  getEye(): EyeConfig {
    return this.config.eye;
  }

  getTeleport(): TeleportConfig {
    return this.config.teleport;
  }

  getFighterLaunch(): FighterLaunchConfig {
    return this.config.fighterLaunch;
  }

  getEnemy(type: string): EnemyTypeConfig | undefined {
    return this.config.enemies[type];
  }

  getAllEnemies(): Record<string, EnemyTypeConfig> {
    return this.config.enemies;
  }

  getBoss(type: string): BossTypeConfig | undefined {
    return this.config.bosses[type];
  }

  getAllBosses(): Record<string, BossTypeConfig> {
    return this.config.bosses;
  }

  getUpgrade(): UpgradeConfig {
    return this.config.upgrade;
  }

  getPerformance(isMobile: boolean): PlatformConfig {
    return isMobile ? this.config.performance.mobile : this.config.performance.desktop;
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  reset(): void {
    this.config = DEFAULT_CONFIG;
    this.loaded = false;
  }
}

export const configLoader = new ConfigLoader();
