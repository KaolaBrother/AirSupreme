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
  private engineLayerOscillator: OscillatorNode | null = null;
  private engineSubOscillator: OscillatorNode | null = null;
  private engineTextureOscillator: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineSubGain: GainNode | null = null;
  private engineLayerGain: GainNode | null = null;
  private engineTextureGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineBandpassFilter: BiquadFilterNode | null = null;
  private engineHighpassFilter: BiquadFilterNode | null = null;
  private engineSpeedBlend: number = 0;
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

      // 创建引擎声（低频主体 + 中频机械层 + 高频气流纹理）
      this.engineOscillator = context.createOscillator();
      this.engineSubOscillator = context.createOscillator();
      this.engineLayerOscillator = context.createOscillator();
      this.engineTextureOscillator = context.createOscillator();
      this.engineGain = context.createGain();
      this.engineSubGain = context.createGain();
      this.engineLayerGain = context.createGain();
      this.engineTextureGain = context.createGain();
      this.engineFilter = context.createBiquadFilter();
      this.engineBandpassFilter = context.createBiquadFilter();
      this.engineHighpassFilter = context.createBiquadFilter();
      this.engineSpeedBlend = 0;

      // 低频主体
      this.engineOscillator.type = 'sawtooth';
      this.engineOscillator.frequency.value = 68;
      // 次低频层
      this.engineSubOscillator.type = 'sine';
      this.engineSubOscillator.frequency.value = 36;
      // 中频谐波层
      this.engineLayerOscillator.type = 'triangle';
      this.engineLayerOscillator.frequency.value = 112;
      // 高频气流层
      this.engineTextureOscillator.type = 'sawtooth';
      this.engineTextureOscillator.frequency.value = 240;

      // 音量包络
      this.engineGain.gain.value = 0.024 * this.sfxVolume;
      this.engineSubGain.gain.value = 0.34;
      this.engineLayerGain.gain.value = 0.18;
      this.engineTextureGain.gain.value = 0.045;

      // 分频塑形，让速度变化更自然
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 520;
      this.engineFilter.Q.value = 0.68;
      this.engineBandpassFilter.type = 'bandpass';
      this.engineBandpassFilter.frequency.value = 760;
      this.engineBandpassFilter.Q.value = 1.0;
      this.engineHighpassFilter.type = 'highpass';
      this.engineHighpassFilter.frequency.value = 1400;
      this.engineHighpassFilter.Q.value = 0.8;

      // 连接节点
      this.engineOscillator.connect(this.engineFilter);
      this.engineSubOscillator.connect(this.engineSubGain);
      this.engineSubGain.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineLayerOscillator.connect(this.engineBandpassFilter);
      this.engineBandpassFilter.connect(this.engineLayerGain);
      this.engineLayerGain.connect(this.engineGain);
      this.engineTextureOscillator.connect(this.engineHighpassFilter);
      this.engineHighpassFilter.connect(this.engineTextureGain);
      this.engineTextureGain.connect(this.engineGain);
      this.engineGain.connect(sfxGain);

      this.engineOscillator.start();
      this.engineSubOscillator.start();
      this.engineLayerOscillator.start();
      this.engineTextureOscillator.start();
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
    if (
      !this.engineOscillator ||
      !this.engineSubOscillator ||
      !this.engineLayerOscillator ||
      !this.engineTextureOscillator ||
      !this.engineGain ||
      !this.engineSubGain ||
      !this.engineLayerGain ||
      !this.engineTextureGain ||
      !this.engineFilter ||
      !this.engineBandpassFilter ||
      !this.engineHighpassFilter
    ) {
      return;
    }

    // 使用平滑速度避免抖动；低速更浑厚，高速更明亮
    const normalizedSpeed = clamp01(speed / 100);
    this.engineSpeedBlend += (normalizedSpeed - this.engineSpeedBlend) * 0.14;
    const speedBlend = this.engineSpeedBlend;
    const throttleCurve = Math.pow(speedBlend, 1.25);
    const coreFreq = 58 + throttleCurve * 96;
    const subFreq = coreFreq * 0.52;
    const layerFreq = 96 + throttleCurve * 170;
    const textureFreq = 220 + throttleCurve * 420;
    const engineMasterGain = 0.02 + throttleCurve * 0.054;
    const subGain = 0.24 + (1 - throttleCurve) * 0.12;
    const layerGain = 0.12 + throttleCurve * 0.2;
    const textureGain = 0.02 + Math.pow(throttleCurve, 1.7) * 0.11;
    const lowpassFreq = 430 + throttleCurve * 1650;
    const bandpassFreq = 620 + throttleCurve * 1350;
    const highpassFreq = 1200 + throttleCurve * 2100;
    const currentTime = this.context?.currentTime || 0;

    this.engineOscillator.frequency.cancelScheduledValues(currentTime);
    this.engineSubOscillator.frequency.cancelScheduledValues(currentTime);
    this.engineLayerOscillator.frequency.cancelScheduledValues(currentTime);
    this.engineTextureOscillator.frequency.cancelScheduledValues(currentTime);
    this.engineGain.gain.cancelScheduledValues(currentTime);
    this.engineSubGain.gain.cancelScheduledValues(currentTime);
    this.engineLayerGain.gain.cancelScheduledValues(currentTime);
    this.engineTextureGain.gain.cancelScheduledValues(currentTime);
    this.engineFilter.frequency.cancelScheduledValues(currentTime);
    this.engineFilter.Q.cancelScheduledValues(currentTime);
    this.engineBandpassFilter.frequency.cancelScheduledValues(currentTime);
    this.engineBandpassFilter.Q.cancelScheduledValues(currentTime);
    this.engineHighpassFilter.frequency.cancelScheduledValues(currentTime);
    this.engineHighpassFilter.Q.cancelScheduledValues(currentTime);

    this.engineOscillator.frequency.setTargetAtTime(coreFreq, currentTime, 0.1);
    this.engineSubOscillator.frequency.setTargetAtTime(subFreq, currentTime, 0.1);
    this.engineLayerOscillator.frequency.setTargetAtTime(layerFreq, currentTime, 0.11);
    this.engineTextureOscillator.frequency.setTargetAtTime(textureFreq, currentTime, 0.12);
    this.engineGain.gain.setTargetAtTime(engineMasterGain * this.sfxVolume, currentTime, 0.1);
    this.engineSubGain.gain.setTargetAtTime(subGain, currentTime, 0.14);
    this.engineLayerGain.gain.setTargetAtTime(layerGain, currentTime, 0.12);
    this.engineTextureGain.gain.setTargetAtTime(textureGain, currentTime, 0.14);
    this.engineFilter.frequency.setTargetAtTime(lowpassFreq, currentTime, 0.14);
    this.engineFilter.Q.setTargetAtTime(0.65 + throttleCurve * 0.9, currentTime, 0.15);
    this.engineBandpassFilter.frequency.setTargetAtTime(bandpassFreq, currentTime, 0.13);
    this.engineBandpassFilter.Q.setTargetAtTime(0.92 + throttleCurve * 0.55, currentTime, 0.15);
    this.engineHighpassFilter.frequency.setTargetAtTime(highpassFreq, currentTime, 0.16);
    this.engineHighpassFilter.Q.setTargetAtTime(0.7 + throttleCurve * 0.35, currentTime, 0.16);
  }

  /**
   * 停止引擎声
   */
  public stopEngine(): void {
    const stopNode = (osc: OscillatorNode | null): void => {
      if (!osc) return;
      try {
        osc.stop();
      } catch {
        // Ignore
      }
      try {
        osc.disconnect();
      } catch {
        // Ignore
      }
    };

    stopNode(this.engineOscillator);
    stopNode(this.engineSubOscillator);
    stopNode(this.engineLayerOscillator);
    stopNode(this.engineTextureOscillator);

    try {
      this.engineSubGain?.disconnect();
      this.engineLayerGain?.disconnect();
      this.engineTextureGain?.disconnect();
      this.engineFilter?.disconnect();
      this.engineBandpassFilter?.disconnect();
      this.engineHighpassFilter?.disconnect();
      this.engineGain?.disconnect();
    } catch {
      // Ignore
    }

    this.engineOscillator = null;
    this.engineSubOscillator = null;
    this.engineLayerOscillator = null;
    this.engineTextureOscillator = null;
    this.engineSubGain = null;
    this.engineLayerGain = null;
    this.engineTextureGain = null;
    this.engineFilter = null;
    this.engineBandpassFilter = null;
    this.engineHighpassFilter = null;
    this.engineGain = null;
    this.engineSpeedBlend = 0;
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
      const bodyOsc = context.createOscillator();
      const bodyGain = context.createGain();
      bodyOsc.type = 'sine';
      bodyOsc.frequency.setValueAtTime(150, now);
      bodyOsc.frequency.exponentialRampToValueAtTime(24, now + 0.52);
      bodyGain.gain.setValueAtTime(0, now);
      bodyGain.gain.linearRampToValueAtTime(0.44 * this.sfxVolume, now + 0.015);
      bodyGain.gain.exponentialRampToValueAtTime(0.01, now + 0.52);
      bodyOsc.connect(bodyGain);
      bodyGain.connect(sfxGain);
      bodyOsc.start(now);
      bodyOsc.stop(now + 0.52);

      const crackOsc = context.createOscillator();
      const crackGain = context.createGain();
      crackOsc.type = 'triangle';
      crackOsc.frequency.setValueAtTime(960, now);
      crackOsc.frequency.exponentialRampToValueAtTime(180, now + 0.14);
      crackGain.gain.setValueAtTime(0, now);
      crackGain.gain.linearRampToValueAtTime(0.2 * this.sfxVolume, now + 0.006);
      crackGain.gain.exponentialRampToValueAtTime(0.01, now + 0.16);
      crackOsc.connect(crackGain);
      crackGain.connect(sfxGain);
      crackOsc.start(now);
      crackOsc.stop(now + 0.16);

      this.playFilteredNoise(0.24, 0.015, 0.18 * this.sfxVolume, 'bandpass', 760, 1.1);
      this.playFilteredNoise(0.32, 0.018, 0.24 * this.sfxVolume, 'highpass', 1600, 0.8);
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
      const bodyOsc = context.createOscillator();
      const bodyGain = context.createGain();
      bodyOsc.type = 'triangle';
      bodyOsc.frequency.setValueAtTime(420, now);
      bodyOsc.frequency.exponentialRampToValueAtTime(120, now + 0.11);
      bodyGain.gain.setValueAtTime(0, now);
      bodyGain.gain.linearRampToValueAtTime(0.15 * this.sfxVolume, now + 0.004);
      bodyGain.gain.exponentialRampToValueAtTime(0.01, now + 0.11);
      bodyOsc.connect(bodyGain);
      bodyGain.connect(sfxGain);
      bodyOsc.start(now);
      bodyOsc.stop(now + 0.11);

      const sparkOsc = context.createOscillator();
      const sparkGain = context.createGain();
      sparkOsc.type = 'square';
      sparkOsc.frequency.setValueAtTime(1600, now);
      sparkOsc.frequency.exponentialRampToValueAtTime(520, now + 0.05);
      sparkGain.gain.setValueAtTime(0, now);
      sparkGain.gain.linearRampToValueAtTime(0.09 * this.sfxVolume, now + 0.002);
      sparkGain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);
      sparkOsc.connect(sparkGain);
      sparkGain.connect(sfxGain);
      sparkOsc.start(now);
      sparkOsc.stop(now + 0.06);

      this.playFilteredNoise(0.07, 0.003, 0.08 * this.sfxVolume, 'highpass', 2200, 1.1);
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
      const confirmOsc = context.createOscillator();
      const confirmGain = context.createGain();
      confirmOsc.type = 'sine';
      confirmOsc.frequency.setValueAtTime(1240, now);
      confirmOsc.frequency.exponentialRampToValueAtTime(1820, now + 0.09);
      confirmGain.gain.setValueAtTime(0, now);
      confirmGain.gain.linearRampToValueAtTime(0.2 * this.sfxVolume, now + 0.008);
      confirmGain.gain.exponentialRampToValueAtTime(0.01, now + 0.13);
      confirmOsc.connect(confirmGain);
      confirmGain.connect(sfxGain);
      confirmOsc.start(now);
      confirmOsc.stop(now + 0.13);

      const harmonicOsc = context.createOscillator();
      const harmonicGain = context.createGain();
      harmonicOsc.type = 'triangle';
      harmonicOsc.frequency.setValueAtTime(620, now + 0.025);
      harmonicOsc.frequency.exponentialRampToValueAtTime(930, now + 0.12);
      harmonicGain.gain.setValueAtTime(0, now + 0.02);
      harmonicGain.gain.linearRampToValueAtTime(0.1 * this.sfxVolume, now + 0.03);
      harmonicGain.gain.exponentialRampToValueAtTime(0.01, now + 0.14);
      harmonicOsc.connect(harmonicGain);
      harmonicGain.connect(sfxGain);
      harmonicOsc.start(now + 0.02);
      harmonicOsc.stop(now + 0.14);
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
      const ignitionOsc = context.createOscillator();
      const ignitionGain = context.createGain();
      ignitionOsc.type = 'square';
      ignitionOsc.frequency.setValueAtTime(240, now);
      ignitionOsc.frequency.exponentialRampToValueAtTime(110, now + 0.12);
      ignitionGain.gain.setValueAtTime(0, now);
      ignitionGain.gain.linearRampToValueAtTime(0.22 * this.sfxVolume, now + 0.01);
      ignitionGain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
      ignitionOsc.connect(ignitionGain);
      ignitionGain.connect(sfxGain);
      ignitionOsc.start(now);
      ignitionOsc.stop(now + 0.12);

      const sustainOsc = context.createOscillator();
      const sustainGain = context.createGain();
      sustainOsc.type = 'sawtooth';
      sustainOsc.frequency.setValueAtTime(360, now + 0.015);
      sustainOsc.frequency.exponentialRampToValueAtTime(140, now + 0.32);
      sustainGain.gain.setValueAtTime(0, now + 0.01);
      sustainGain.gain.linearRampToValueAtTime(0.22 * this.sfxVolume, now + 0.03);
      sustainGain.gain.exponentialRampToValueAtTime(0.01, now + 0.32);
      sustainOsc.connect(sustainGain);
      sustainGain.connect(sfxGain);
      sustainOsc.start(now + 0.01);
      sustainOsc.stop(now + 0.32);

      this.playFilteredNoise(0.16, 0.01, 0.14 * this.sfxVolume, 'bandpass', 900, 0.9);
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
      const boomOsc = context.createOscillator();
      const boomGain = context.createGain();
      boomOsc.type = 'sawtooth';
      boomOsc.frequency.setValueAtTime(95, now);
      boomOsc.frequency.exponentialRampToValueAtTime(28, now + 0.56);
      boomGain.gain.setValueAtTime(0, now);
      boomGain.gain.linearRampToValueAtTime(0.52 * this.sfxVolume, now + 0.018);
      boomGain.gain.exponentialRampToValueAtTime(0.01, now + 0.56);
      boomOsc.connect(boomGain);
      boomGain.connect(sfxGain);
      boomOsc.start(now);
      boomOsc.stop(now + 0.56);

      const crackOsc = context.createOscillator();
      const crackGain = context.createGain();
      crackOsc.type = 'triangle';
      crackOsc.frequency.setValueAtTime(620, now + 0.01);
      crackOsc.frequency.exponentialRampToValueAtTime(160, now + 0.18);
      crackGain.gain.setValueAtTime(0, now);
      crackGain.gain.linearRampToValueAtTime(0.18 * this.sfxVolume, now + 0.014);
      crackGain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      crackOsc.connect(crackGain);
      crackGain.connect(sfxGain);
      crackOsc.start(now + 0.01);
      crackOsc.stop(now + 0.2);

      this.playFilteredNoise(0.28, 0.02, 0.22 * this.sfxVolume, 'bandpass', 720, 1.1);
      this.playFilteredNoise(0.4, 0.025, 0.28 * this.sfxVolume, 'highpass', 1500, 0.85);
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
      const transientOsc = context.createOscillator();
      const transientGain = context.createGain();
      transientOsc.type = 'square';
      transientOsc.frequency.setValueAtTime(320, now);
      transientOsc.frequency.exponentialRampToValueAtTime(180, now + 0.08);
      transientGain.gain.setValueAtTime(0, now);
      transientGain.gain.linearRampToValueAtTime(0.14 * this.sfxVolume, now + 0.006);
      transientGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      transientOsc.connect(transientGain);
      transientGain.connect(sfxGain);
      transientOsc.start(now);
      transientOsc.stop(now + 0.1);

      const tailOsc = context.createOscillator();
      const tailGain = context.createGain();
      tailOsc.type = 'sawtooth';
      tailOsc.frequency.setValueAtTime(420, now + 0.01);
      tailOsc.frequency.exponentialRampToValueAtTime(620, now + 0.09);
      tailGain.gain.setValueAtTime(0, now + 0.01);
      tailGain.gain.linearRampToValueAtTime(0.12 * this.sfxVolume, now + 0.02);
      tailGain.gain.exponentialRampToValueAtTime(0.01, now + 0.16);
      tailOsc.connect(tailGain);
      tailGain.connect(sfxGain);
      tailOsc.start(now + 0.01);
      tailOsc.stop(now + 0.16);
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
      this.engineSubGain = null;
      this.engineLayerGain = null;
      this.engineTextureGain = null;
      this.engineFilter = null;
      this.engineBandpassFilter = null;
      this.engineHighpassFilter = null;
    }
  }
}
