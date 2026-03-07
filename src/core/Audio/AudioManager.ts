import { musicDuckingBridge } from '@/core/Audio/MusicSystem';
import { getLogger } from '@/core/utils/Logger';

const log = getLogger('AudioManager');

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
type WebkitAudioWindow = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

export type AudioBus = 'master' | 'sfx' | 'music';

export enum SoundType {
  ENGINE = 'ENGINE',
  SHOOT = 'SHOOT',
  EXPLOSION = 'EXPLOSION',
  HIT = 'HIT',
  POWERUP = 'POWERUP',
  LEVEL_UP = 'LEVEL_UP',
  WAVE_START = 'WAVE_START',
  GAME_OVER = 'GAME_OVER',
  BALLOON_POP = 'BALLOON_POP', // 气球打破音效
  MISSILE_LOCK = 'MISSILE_LOCK', // 导弹锁定音效
  MISSILE_FIRE = 'MISSILE_FIRE', // 导弹发射音效
  MISSILE_EXPLOSION = 'MISSILE_EXPLOSION', // 导弹爆炸音效
  FLAK_FIRE = 'FLAK_FIRE',
  FLAK_EXPLOSION = 'FLAK_EXPLOSION',
  TELEPORT = 'TELEPORT',
  LASER_WARNING = 'LASER_WARNING',
  LASER_SWEEP = 'LASER_SWEEP',
  TENTACLE_HIT = 'TENTACLE_HIT',
  TENTACLE_DESTROY = 'TENTACLE_DESTROY',
}

interface SoundPolicy {
  minIntervalMs: number;
  maxConcurrent: number;
  duckAmount?: number;
  duckDurationMs?: number;
}

/**
 * 音效管理器
 * 使用 Web Audio API 生成音效（无需外部音频文件）
 */
export class AudioManager {
  protected context: AudioContext | null = null;
  protected masterGain: GainNode | null = null;
  protected sfxGain: GainNode | null = null;
  protected musicGain: GainNode | null = null;
  private engineOscillator: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private isEnginePlaying: boolean = false;
  private isDisposed: boolean = false;
  private activeSoundCounts: Map<SoundType, number> = new Map();
  private lastSoundPlayTimes: Map<SoundType, number> = new Map();
  private soundReleaseTimeouts: Set<number> = new Set();

  // 音量设置
  private masterVolumeValue: number = 0.5;
  private sfxVolume: number = 0.7;
  private musicVolumeValue: number = 0.7;
  private readonly soundPolicies: Partial<Record<SoundType, SoundPolicy>> = {
    [SoundType.SHOOT]: { minIntervalMs: 35, maxConcurrent: 5 },
    [SoundType.HIT]: { minIntervalMs: 25, maxConcurrent: 6, duckAmount: 0.08, duckDurationMs: 120 },
    [SoundType.EXPLOSION]: {
      minIntervalMs: 90,
      maxConcurrent: 3,
      duckAmount: 0.28,
      duckDurationMs: 260,
    },
    [SoundType.MISSILE_FIRE]: {
      minIntervalMs: 80,
      maxConcurrent: 3,
      duckAmount: 0.16,
      duckDurationMs: 180,
    },
    [SoundType.MISSILE_EXPLOSION]: {
      minIntervalMs: 120,
      maxConcurrent: 2,
      duckAmount: 0.34,
      duckDurationMs: 320,
    },
    [SoundType.FLAK_FIRE]: {
      minIntervalMs: 120,
      maxConcurrent: 2,
      duckAmount: 0.16,
      duckDurationMs: 180,
    },
    [SoundType.FLAK_EXPLOSION]: {
      minIntervalMs: 140,
      maxConcurrent: 2,
      duckAmount: 0.3,
      duckDurationMs: 320,
    },
    [SoundType.TELEPORT]: {
      minIntervalMs: 250,
      maxConcurrent: 1,
      duckAmount: 0.22,
      duckDurationMs: 300,
    },
    [SoundType.LASER_WARNING]: {
      minIntervalMs: 500,
      maxConcurrent: 1,
      duckAmount: 0.14,
      duckDurationMs: 500,
    },
    [SoundType.LASER_SWEEP]: {
      minIntervalMs: 1000,
      maxConcurrent: 1,
      duckAmount: 0.35,
      duckDurationMs: 900,
    },
    [SoundType.TENTACLE_HIT]: {
      minIntervalMs: 80,
      maxConcurrent: 3,
      duckAmount: 0.12,
      duckDurationMs: 180,
    },
    [SoundType.TENTACLE_DESTROY]: {
      minIntervalMs: 150,
      maxConcurrent: 2,
      duckAmount: 0.22,
      duckDurationMs: 260,
    },
  };

  constructor() {
    // 延迟初始化，等待用户交互
  }

  /**
   * 初始化音频上下文
   */
  private initContext(): void {
    if (this.isDisposed) return;
    if (this.context && this.context.state !== 'closed') return;

    try {
      const AudioContextCtor =
        window.AudioContext || (window as WebkitAudioWindow).webkitAudioContext;
      if (!AudioContextCtor) {
        log.warn('Web Audio API not supported');
        return;
      }

      this.context = new AudioContextCtor();
      this.masterGain = this.context.createGain();
      this.sfxGain = this.context.createGain();
      this.musicGain = this.context.createGain();

      this.masterGain.gain.value = this.masterVolumeValue;
      this.sfxGain.gain.value = this.sfxVolume;
      this.musicGain.gain.value = this.musicVolumeValue;

      this.sfxGain.connect(this.masterGain);
      this.musicGain.connect(this.masterGain);
      this.masterGain.connect(this.context.destination);
    } catch {
      log.warn('Web Audio API not supported');
    }
  }

  private canPlay(): this is AudioManager & {
    context: AudioContext;
    masterGain: GainNode;
    sfxGain: GainNode;
    musicGain: GainNode;
  } {
    return (
      !this.isDisposed &&
      this.context !== null &&
      !!this.masterGain &&
      !!this.sfxGain &&
      !!this.musicGain &&
      this.context.state === 'running'
    );
  }

  private getBus(bus: AudioBus): GainNode | null {
    if (bus === 'master') return this.masterGain;
    if (bus === 'sfx') return this.sfxGain;
    return this.musicGain;
  }

  private beginSound(
    soundType: SoundType,
    durationMs: number
  ): { now: number; context: AudioContext; sfxGain: GainNode } | null {
    this.initContext();
    if (!this.canPlay()) return null;

    const policy = this.soundPolicies[soundType];
    const nowMs = performance.now();
    const lastPlayTime = this.lastSoundPlayTimes.get(soundType) ?? -Infinity;
    const activeCount = this.activeSoundCounts.get(soundType) ?? 0;

    if (policy) {
      if (nowMs - lastPlayTime < policy.minIntervalMs || activeCount >= policy.maxConcurrent) {
        return null;
      }
    }

    this.lastSoundPlayTimes.set(soundType, nowMs);
    this.activeSoundCounts.set(soundType, activeCount + 1);

    const timeoutId = window.setTimeout(() => {
      this.soundReleaseTimeouts.delete(timeoutId);
      const currentCount = this.activeSoundCounts.get(soundType) ?? 0;
      if (currentCount <= 1) {
        this.activeSoundCounts.delete(soundType);
      } else {
        this.activeSoundCounts.set(soundType, currentCount - 1);
      }
    }, Math.max(60, durationMs) + 40);
    this.soundReleaseTimeouts.add(timeoutId);

    if (policy?.duckAmount && policy.duckDurationMs) {
      musicDuckingBridge.request(policy.duckAmount, policy.duckDurationMs);
    }

    return {
      now: this.context.currentTime,
      context: this.context,
      sfxGain: this.sfxGain,
    };
  }

  public setVolumeByBus(bus: AudioBus, volume: number): void {
    const normalized = clamp01(volume);
    if (bus === 'master') {
      this.masterVolumeValue = normalized;
    }
    if (bus === 'sfx') {
      this.sfxVolume = normalized;
    }
    if (bus === 'music') {
      this.musicVolumeValue = normalized;
    }

    const target = this.getBus(bus);
    if (target) {
      target.gain.value = normalized;
    }
  }

  /**
   * 恢复音频上下文（需要用户交互）
   */
  public resume(): void {
    if (this.isDisposed) return;
    this.initContext();
    if (this.context?.state === 'suspended') {
      this.context.resume().catch(() => {
        log.warn('AudioContext resume blocked by autoplay policy');
      });
    }
  }

  public get isClosed(): boolean {
    return this.isDisposed || !this.context || this.context.state === 'closed';
  }

  /**
   * 播放引擎声（持续音效）
   */
  public startEngine(): void {
    this.initContext();
    if (!this.canPlay() || this.isEnginePlaying) return;

    try {
      const context = this.context;
      const sfxGain = this.sfxGain;
      if (!context || !sfxGain) return;

      // 创建引擎声
      this.engineOscillator = context.createOscillator();
      this.engineGain = context.createGain();

      // 低频引擎声
      this.engineOscillator.type = 'sawtooth';
      this.engineOscillator.frequency.value = 80;

      // 音量包络
      this.engineGain.gain.value = 0.05 * this.sfxVolume;

      // 添加滤波器让声音更自然
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 500;

      // 连接节点
      this.engineOscillator.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(sfxGain);

      this.engineOscillator.start();
      this.isEnginePlaying = true;
    } catch {
      log.warn('Failed to start engine sound');
    }
  }

  /**
   * 更新引擎声频率（根据速度）
   */
  public updateEngine(speed: number): void {
    if (!this.canPlay()) return;
    if (!this.engineOscillator || !this.engineGain) return;

    // 根据速度调整频率
    const baseFreq = 60;
    const maxFreq = 150;
    const normalizedSpeed = Math.min(speed / 100, 1);
    const freq = baseFreq + (maxFreq - baseFreq) * normalizedSpeed;

    this.engineOscillator.frequency.setValueAtTime(freq, this.context?.currentTime || 0);

    // 调整音量
    const volume = 0.03 + normalizedSpeed * 0.04;
    this.engineGain.gain.setValueAtTime(volume * this.sfxVolume, this.context?.currentTime || 0);
  }

  /**
   * 停止引擎声
   */
  public stopEngine(): void {
    if (this.engineOscillator) {
      this.engineOscillator.stop();
      this.engineOscillator = null;
    }
    this.engineGain = null;
    this.isEnginePlaying = false;
  }

  /**
   * 播放射击音效
   */
  public playShoot(): void {
    const sound = this.beginSound(SoundType.SHOOT, 100);
    if (!sound) return;
    const { now, context, sfxGain } = sound;

    try {
      // 创建射击声
      const osc = context.createOscillator();
      const gain = context.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.1);

      gain.gain.setValueAtTime(0.2 * this.sfxVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

      osc.connect(gain);
      gain.connect(sfxGain);

      osc.start(now);
      osc.stop(now + 0.1);

      // 添加噪声层
      this.playNoise(0.05, 0.1, 0.1 * this.sfxVolume);
    } catch {
      // Ignore
    }
  }

  /**
   * 播放爆炸音效
   */
  public playExplosion(): void {
    const sound = this.beginSound(SoundType.EXPLOSION, 500);
    if (!sound) return;
    const { now, context, sfxGain } = sound;

    try {
      // 低频爆炸声
      const osc = context.createOscillator();
      const gain = context.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(20, now + 0.5);

      gain.gain.setValueAtTime(0.5 * this.sfxVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

      osc.connect(gain);
      gain.connect(sfxGain);

      osc.start(now);
      osc.stop(now + 0.5);

      // 添加噪声
      this.playNoise(0.3, 0.5, 0.3 * this.sfxVolume);
    } catch {
      // Ignore
    }
  }

  /**
   * 播放击中音效
   */
  public playHit(): void {
    const sound = this.beginSound(SoundType.HIT, 100);
    if (!sound) return;
    const { now, context, sfxGain } = sound;

    try {
      const osc = context.createOscillator();
      const gain = context.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);

      gain.gain.setValueAtTime(0.15 * this.sfxVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

      osc.connect(gain);
      gain.connect(sfxGain);

      osc.start(now);
      osc.stop(now + 0.1);
    } catch {
      // Ignore
    }
  }

  /**
   * 播放道具拾取音效
   */
  public playPowerUp(): void {
    const sound = this.beginSound(SoundType.POWERUP, 400);
    if (!sound) return;
    const { now, context, sfxGain } = sound;

    try {
      // 上升音阶
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6

      notes.forEach((freq, i) => {
        const osc = context.createOscillator();
        const gain = context.createGain();

        osc.type = 'sine';
        osc.frequency.value = freq;

        const startTime = now + i * 0.08;
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.15 * this.sfxVolume, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.15);

        osc.connect(gain);
        gain.connect(sfxGain);

        osc.start(startTime);
        osc.stop(startTime + 0.15);
      });
    } catch {
      // Ignore
    }
  }

  /**
   * 播放升级音效
   */
  public playLevelUp(): void {
    const sound = this.beginSound(SoundType.LEVEL_UP, 600);
    if (!sound) return;
    const { now, context, sfxGain } = sound;

    try {
      // 胜利音效
      const notes = [392, 523.25, 659.25, 783.99]; // G4, C5, E5, G5

      notes.forEach((freq, i) => {
        const osc = context.createOscillator();
        const gain = context.createGain();

        osc.type = 'triangle';
        osc.frequency.value = freq;

        const startTime = now + i * 0.1;
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.2 * this.sfxVolume, startTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);

        osc.connect(gain);
        gain.connect(sfxGain);

        osc.start(startTime);
        osc.stop(startTime + 0.3);
      });
    } catch {
      // Ignore
    }
  }

  /**
   * 播放波次开始音效
   */
  public playWaveStart(): void {
    const sound = this.beginSound(SoundType.WAVE_START, 400);
    if (!sound) return;
    const { now, context, sfxGain } = sound;

    try {
      // 警报音
      for (let i = 0; i < 3; i++) {
        const osc = context.createOscillator();
        const gain = context.createGain();

        osc.type = 'square';
        osc.frequency.value = 440;

        const startTime = now + i * 0.15;
        gain.gain.setValueAtTime(0.1 * this.sfxVolume, startTime);
        gain.gain.setValueAtTime(0, startTime + 0.1);

        osc.connect(gain);
        gain.connect(sfxGain);

        osc.start(startTime);
        osc.stop(startTime + 0.1);
      }
    } catch {
      // Ignore
    }
  }

  /**
   * 播放游戏结束音效
   */
  public playGameOver(): void {
    const sound = this.beginSound(SoundType.GAME_OVER, 1000);
    if (!sound) return;
    const { now, context, sfxGain } = sound;

    try {
      // 下降音阶
      const notes = [392, 349.23, 329.63, 293.66]; // G4, F4, E4, D4

      notes.forEach((freq, i) => {
        const osc = context.createOscillator();
        const gain = context.createGain();

        osc.type = 'triangle';
        osc.frequency.value = freq;

        const startTime = now + i * 0.2;
        gain.gain.setValueAtTime(0.15 * this.sfxVolume, startTime);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.4);

        osc.connect(gain);
        gain.connect(sfxGain);

        osc.start(startTime);
        osc.stop(startTime + 0.4);
      });
    } catch {
      // Ignore
    }
  }

  /**
   * 播放白噪声
   */
  private playNoise(duration: number, attack: number, volume: number): void {
    if (!this.canPlay()) return;

    try {
      const context = this.context;
      const sfxGain = this.sfxGain;
      if (!context || !sfxGain) return;

      const bufferSize = context.sampleRate * duration;
      const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
      const data = buffer.getChannelData(0);

      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const source = context.createBufferSource();
      source.buffer = buffer;

      const gain = context.createGain();
      const now = context.currentTime;

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(volume, now + attack);
      gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

      source.connect(gain);
      gain.connect(sfxGain);

      source.start(now);
    } catch {
      // Ignore
    }
  }

  private playFilteredNoise(
    duration: number,
    attack: number,
    volume: number,
    filterType: BiquadFilterType,
    frequency: number,
    q: number = 1.2
  ): void {
    if (!this.canPlay()) return;

    try {
      const context = this.context;
      const sfxGain = this.sfxGain;
      if (!context || !sfxGain) return;

      const bufferSize = context.sampleRate * duration;
      const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const source = context.createBufferSource();
      source.buffer = buffer;

      const filter = context.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.setValueAtTime(frequency, context.currentTime);
      filter.Q.setValueAtTime(q, context.currentTime);

      const gain = context.createGain();
      const now = context.currentTime;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(volume, now + attack);
      gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

      source.connect(filter);
      filter.connect(gain);
      gain.connect(sfxGain);
      source.start(now);
    } catch {
      // Ignore
    }
  }

  /**
   * 设置主音量
   */
  public setMasterVolume(volume: number): void {
    this.setVolumeByBus('master', volume);
  }

  public setMusicVolume(volume: number): void {
    this.setVolumeByBus('music', volume);
  }

  /**
   * 播放气球打破音效
   */
  public playBalloonPop(): void {
    const sound = this.beginSound(SoundType.BALLOON_POP, 150);
    if (!sound) return;
    const { now, context, sfxGain } = sound;

    try {
      // 使用高音调的"波普"音效
      const osc = context.createOscillator();
      const gain = context.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.1);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.3 * this.sfxVolume, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

      osc.connect(gain);
      gain.connect(sfxGain);

      osc.start(now);
      osc.stop(now + 0.15);

      // 添加高频"啵"声
      const popOsc = context.createOscillator();
      const popGain = context.createGain();
      popOsc.type = 'square';
      popOsc.frequency.setValueAtTime(1200, now + 0.05);
      popGain.gain.setValueAtTime(0, now + 0.05);
      popGain.gain.linearRampToValueAtTime(0.15 * this.sfxVolume, now + 0.05);
      popGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

      popOsc.connect(popGain);
      popGain.connect(sfxGain);

      popOsc.start(now + 0.05);
      popOsc.stop(now + 0.1);
    } catch {
      // Ignore
    }
  }

  /**
   * 播放导弹锁定音效
   */
  public playMissileLock(): void {
    const sound = this.beginSound(SoundType.MISSILE_LOCK, 150);
    if (!sound) return;
    const { now, context, sfxGain } = sound;

    try {
      // 高频"滴"声表示锁定成功
      const osc = context.createOscillator();
      const gain = context.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.exponentialRampToValueAtTime(1800, now + 0.1);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.25 * this.sfxVolume, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

      osc.connect(gain);
      gain.connect(sfxGain);

      osc.start(now);
      osc.stop(now + 0.15);
    } catch {
      // Ignore
    }
  }

  /**
   * 播放导弹发射音效
   */
  public playMissileFire(): void {
    const sound = this.beginSound(SoundType.MISSILE_FIRE, 300);
    if (!sound) return;
    const { now, context, sfxGain } = sound;

    try {
      // 导弹发射"咻"声
      const osc = context.createOscillator();
      const gain = context.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(150, now + 0.3);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.3 * this.sfxVolume, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

      osc.connect(gain);
      gain.connect(sfxGain);

      osc.start(now);
      osc.stop(now + 0.3);
    } catch {
      // Ignore
    }
  }

  /**
   * 播放导弹爆炸音效
   */
  public playMissileExplosion(): void {
    const sound = this.beginSound(SoundType.MISSILE_EXPLOSION, 600);
    if (!sound) return;
    const { now, context, sfxGain } = sound;

    try {
      // 导弹爆炸 - 更沉重的爆炸声
      const osc = context.createOscillator();
      const gain = context.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(100, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.5);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.6 * this.sfxVolume, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

      osc.connect(gain);
      gain.connect(sfxGain);

      osc.start(now);
      osc.stop(now + 0.5);

      // 添加噪声层增强爆炸感
      this.playNoise(0.6, 0.1, 0.8 * this.sfxVolume);
    } catch {
      // Ignore
    }
  }

  public playFlakCannonFire(): void {
    const sound = this.beginSound(SoundType.FLAK_FIRE, 180);
    if (!sound) return;
    const { now, context, sfxGain } = sound;

    try {
      // 炮口低频冲击（主体）
      const bodyOsc = context.createOscillator();
      const bodyGain = context.createGain();
      bodyOsc.type = 'square';
      bodyOsc.frequency.setValueAtTime(210, now);
      bodyOsc.frequency.exponentialRampToValueAtTime(85, now + 0.16);
      bodyGain.gain.setValueAtTime(0.34 * this.sfxVolume, now);
      bodyGain.gain.exponentialRampToValueAtTime(0.01, now + 0.16);
      bodyOsc.connect(bodyGain);
      bodyGain.connect(sfxGain);
      bodyOsc.start(now);
      bodyOsc.stop(now + 0.16);

      // 瞬态脆响（防空炮特征）
      const crackOsc = context.createOscillator();
      const crackGain = context.createGain();
      crackOsc.type = 'triangle';
      crackOsc.frequency.setValueAtTime(980, now);
      crackOsc.frequency.exponentialRampToValueAtTime(260, now + 0.055);
      crackGain.gain.setValueAtTime(0, now);
      crackGain.gain.linearRampToValueAtTime(0.22 * this.sfxVolume, now + 0.004);
      crackGain.gain.exponentialRampToValueAtTime(0.01, now + 0.065);
      crackOsc.connect(crackGain);
      crackGain.connect(sfxGain);
      crackOsc.start(now);
      crackOsc.stop(now + 0.07);

      // 高频炮口气浪（短促带通噪声）
      this.playFilteredNoise(0.1, 0.006, 0.18 * this.sfxVolume, 'bandpass', 1800, 1.8);
    } catch {
      // Ignore
    }
  }

  public playFlakCannonExplosion(): void {
    const sound = this.beginSound(SoundType.FLAK_EXPLOSION, 600);
    if (!sound) return;
    const { now, context, sfxGain } = sound;

    try {
      // 低频空爆体量
      const boomOsc = context.createOscillator();
      const boomGain = context.createGain();
      boomOsc.type = 'sawtooth';
      boomOsc.frequency.setValueAtTime(140, now);
      boomOsc.frequency.exponentialRampToValueAtTime(32, now + 0.5);
      boomGain.gain.setValueAtTime(0, now);
      boomGain.gain.linearRampToValueAtTime(0.46 * this.sfxVolume, now + 0.018);
      boomGain.gain.exponentialRampToValueAtTime(0.01, now + 0.52);
      boomOsc.connect(boomGain);
      boomGain.connect(sfxGain);
      boomOsc.start(now);
      boomOsc.stop(now + 0.52);

      // 金属破片感
      const shrapnelOsc = context.createOscillator();
      const shrapnelGain = context.createGain();
      shrapnelOsc.type = 'triangle';
      shrapnelOsc.frequency.setValueAtTime(520, now + 0.01);
      shrapnelOsc.frequency.exponentialRampToValueAtTime(180, now + 0.2);
      shrapnelGain.gain.setValueAtTime(0, now);
      shrapnelGain.gain.linearRampToValueAtTime(0.24 * this.sfxVolume, now + 0.02);
      shrapnelGain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
      shrapnelOsc.connect(shrapnelGain);
      shrapnelGain.connect(sfxGain);
      shrapnelOsc.start(now + 0.01);
      shrapnelOsc.stop(now + 0.22);

      // 空爆破片 hiss（高通）+ 中频气浪（带通）
      this.playFilteredNoise(0.22, 0.012, 0.22 * this.sfxVolume, 'highpass', 1400, 0.9);
      this.playFilteredNoise(0.3, 0.02, 0.18 * this.sfxVolume, 'bandpass', 780, 1.2);
    } catch {
      // Ignore
    }
  }

  public playTeleport(): void {
    const sound = this.beginSound(SoundType.TELEPORT, 500);
    if (!sound) return;
    const { now, context, sfxGain } = sound;

    try {
      const osc = context.createOscillator();
      const gain = context.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.3);
      osc.frequency.exponentialRampToValueAtTime(1500, now + 0.5);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.4 * this.sfxVolume, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

      osc.connect(gain);
      gain.connect(sfxGain);

      osc.start(now);
      osc.stop(now + 0.5);

      const osc2 = context.createOscillator();
      const gain2 = context.createGain();

      osc2.type = 'square';
      osc2.frequency.setValueAtTime(400, now);
      osc2.frequency.exponentialRampToValueAtTime(100, now + 0.4);

      gain2.gain.setValueAtTime(0, now);
      gain2.gain.linearRampToValueAtTime(0.15 * this.sfxVolume, now + 0.02);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

      osc2.connect(gain2);
      gain2.connect(sfxGain);

      osc2.start(now);
      osc2.stop(now + 0.4);

      this.playNoise(0.3, 0.05, 0.2 * this.sfxVolume);
    } catch {
      // Ignore
    }
  }

  public playLaserWarning(): void {
    const sound = this.beginSound(SoundType.LASER_WARNING, 2400);
    if (!sound) return;
    const { now, context, sfxGain } = sound;

    try {
      for (let i = 0; i < 3; i++) {
        const osc = context.createOscillator();
        const gain = context.createGain();
        const startTime = now + i * 0.8;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, startTime);
        osc.frequency.setValueAtTime(500, startTime + 0.1);
        osc.frequency.setValueAtTime(600, startTime + 0.2);

        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.3 * this.sfxVolume, startTime + 0.02);
        gain.gain.setValueAtTime(0.3 * this.sfxVolume, startTime + 0.3);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.4);

        osc.connect(gain);
        gain.connect(sfxGain);

        osc.start(startTime);
        osc.stop(startTime + 0.4);
      }
    } catch {
      // Ignore
    }
  }

  public playLaserSweep(): void {
    const sound = this.beginSound(SoundType.LASER_SWEEP, 6000);
    if (!sound) return;
    const { now, context, sfxGain } = sound;

    try {
      const osc = context.createOscillator();
      const gain = context.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.linearRampToValueAtTime(800, now + 0.1);
      osc.frequency.linearRampToValueAtTime(150, now + 6);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.25 * this.sfxVolume, now + 0.1);
      gain.gain.setValueAtTime(0.2 * this.sfxVolume, now + 3);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 6);

      osc.connect(gain);
      gain.connect(sfxGain);

      osc.start(now);
      osc.stop(now + 6);

      const osc2 = context.createOscillator();
      const gain2 = context.createGain();

      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1000, now);
      osc2.frequency.linearRampToValueAtTime(200, now + 6);

      gain2.gain.setValueAtTime(0, now);
      gain2.gain.linearRampToValueAtTime(0.15 * this.sfxVolume, now + 0.2);
      gain2.gain.setValueAtTime(0.1 * this.sfxVolume, now + 3);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 6);

      osc2.connect(gain2);
      gain2.connect(sfxGain);

      osc2.start(now);
      osc2.stop(now + 6);
    } catch {
      // Ignore
    }
  }

  public playTentacleHit(): void {
    const sound = this.beginSound(SoundType.TENTACLE_HIT, 160);
    if (!sound) return;
    const { now, context, sfxGain } = sound;

    try {
      const osc = context.createOscillator();
      const gain = context.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(50, now + 0.15);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.4 * this.sfxVolume, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

      osc.connect(gain);
      gain.connect(sfxGain);

      osc.start(now);
      osc.stop(now + 0.15);

      this.playNoise(0.1, 0.02, 0.3 * this.sfxVolume);
    } catch {
      // Ignore
    }
  }

  public playTentacleDestroy(): void {
    const sound = this.beginSound(SoundType.TENTACLE_DESTROY, 400);
    if (!sound) return;
    const { now, context, sfxGain } = sound;

    try {
      const osc = context.createOscillator();
      const gain = context.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(50, now + 0.4);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.5 * this.sfxVolume, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

      osc.connect(gain);
      gain.connect(sfxGain);

      osc.start(now);
      osc.stop(now + 0.4);

      this.playNoise(0.3, 0.05, 0.4 * this.sfxVolume);
    } catch {
      // Ignore
    }
  }

  /**
   * 设置音效音量
   */
  public setSFXVolume(volume: number): void {
    this.setVolumeByBus('sfx', volume);
  }

  public getVolume(): { master: number; sfx: number; music: number } {
    return {
      master: this.masterVolumeValue,
      sfx: this.sfxVolume,
      music: this.musicVolumeValue,
    };
  }

  /**
   * 播放导弹发射音效
   */
  public playMissileLaunch(): void {
    const sound = this.beginSound(SoundType.MISSILE_FIRE, 200);
    if (!sound) return;
    const { now, context, sfxGain } = sound;

    try {
      // 导弹发射"咻"声
      const osc = context.createOscillator();
      const gain = context.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(600, now + 0.1);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.2 * this.sfxVolume, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

      osc.connect(gain);
      gain.connect(sfxGain);

      osc.start(now);
      osc.stop(now + 0.15);
    } catch {
      // Ignore
    }
  }

  /**
   * 静音
   */
  public mute(): void {
    if (this.masterGain) {
      this.masterGain.gain.value = 0;
    }
  }

  /**
   * 取消静音
   */
  public unmute(): void {
    if (this.masterGain) {
      this.masterGain.gain.value = this.masterVolumeValue;
    }
  }

  public close(): void {
    this.dispose();
  }

  public dispose(): void {
    this.isDisposed = true;
    this.stopEngine();
    for (const timeoutId of this.soundReleaseTimeouts) {
      clearTimeout(timeoutId);
    }
    this.soundReleaseTimeouts.clear();
    this.activeSoundCounts.clear();
    this.lastSoundPlayTimes.clear();
    if (this.context?.state === 'running' || this.context?.state === 'suspended') {
      if (this.masterGain) {
        this.masterGain.disconnect();
      }
      if (this.sfxGain) {
        this.sfxGain.disconnect();
      }
      if (this.musicGain) {
        this.musicGain.disconnect();
      }
    }
    if (this.context) {
      void this.context.close().catch(() => {
        // Ignore
      });
      this.context = null;
      this.masterGain = null;
      this.sfxGain = null;
      this.musicGain = null;
      this.engineGain = null;
    }
  }
}
