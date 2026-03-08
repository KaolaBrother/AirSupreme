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
  LOW_HEALTH = 'LOW_HEALTH',
  BOSS_EXPLOSION = 'BOSS_EXPLOSION',
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
    [SoundType.BOSS_EXPLOSION]: {
      minIntervalMs: 900,
      maxConcurrent: 1,
      duckAmount: 0.45,
      duckDurationMs: 700,
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
    [SoundType.LOW_HEALTH]: {
      minIntervalMs: 1200,
      maxConcurrent: 1,
      duckAmount: 0.06,
      duckDurationMs: 220,
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
  public playShoot(profile: 'player' | 'enemy' | 'friendly' | 'boss' = 'player'): void {
    const sound = this.beginSound(SoundType.SHOOT, 100);
    if (!sound) return;
    const { now, context, sfxGain } = sound;
    const isBoss = profile === 'boss';
    const clickPitchBase =
      isBoss ? 0.84 : profile === 'enemy' ? 1.08 : profile === 'friendly' ? 1.02 : 0.96;
    const bodyPitchBase =
      isBoss ? 0.68 : profile === 'enemy' ? 0.88 : profile === 'friendly' ? 0.98 : 0.94;
    const shotGainBase =
      isBoss ? 1.02 : profile === 'enemy' ? 0.82 : profile === 'friendly' ? 0.72 : 0.95;
    const clickPitch = clickPitchBase + Math.random() * 0.08;
    const bodyPitch = bodyPitchBase + Math.random() * 0.1;
    const shotGain = shotGainBase + Math.random() * 0.08;

    try {
      // 机炮：高频瞬态 click + 轻低频 body
      const clickOsc = context.createOscillator();
      const clickGain = context.createGain();
      clickOsc.type = 'square';
      clickOsc.frequency.setValueAtTime(1480 * clickPitch, now);
      clickOsc.frequency.exponentialRampToValueAtTime(
        (isBoss ? 360 : 520) * clickPitch,
        now + (isBoss ? 0.07 : 0.05)
      );
      clickGain.gain.setValueAtTime(0, now);
      clickGain.gain.linearRampToValueAtTime(
        (isBoss ? 0.16 : profile === 'enemy' ? 0.12 : 0.14) * this.sfxVolume * shotGain,
        now + 0.002
      );
      clickGain.gain.exponentialRampToValueAtTime(0.01, now + (isBoss ? 0.075 : 0.055));
      clickOsc.connect(clickGain);
      clickGain.connect(sfxGain);
      clickOsc.start(now);
      clickOsc.stop(now + (isBoss ? 0.075 : 0.055));

      const bodyOsc = context.createOscillator();
      const bodyGain = context.createGain();
      bodyOsc.type = isBoss ? 'sawtooth' : 'triangle';
      bodyOsc.frequency.setValueAtTime((isBoss ? 240 : 340) * bodyPitch, now);
      bodyOsc.frequency.exponentialRampToValueAtTime(
        (isBoss ? 92 : 150) * bodyPitch,
        now + (isBoss ? 0.11 : 0.075)
      );
      bodyGain.gain.setValueAtTime(0, now);
      bodyGain.gain.linearRampToValueAtTime(
        (isBoss ? 0.15 : profile === 'friendly' ? 0.08 : 0.1) * this.sfxVolume * shotGain,
        now + 0.004
      );
      bodyGain.gain.exponentialRampToValueAtTime(0.01, now + (isBoss ? 0.12 : 0.085));
      bodyOsc.connect(bodyGain);
      bodyGain.connect(sfxGain);
      bodyOsc.start(now);
      bodyOsc.stop(now + (isBoss ? 0.12 : 0.085));

      this.playFilteredNoise(
        isBoss ? 0.075 : 0.055,
        0.003,
        (isBoss ? 0.1 : 0.08) * this.sfxVolume * shotGain,
        isBoss ? 'bandpass' : 'highpass',
        isBoss ? 1700 : profile === 'enemy' ? 2800 : 2400,
        isBoss ? 1.1 : profile === 'enemy' ? 1.9 : 1.5
      );
      this.playFilteredNoise(
        isBoss ? 0.04 : 0.028,
        0.002,
        (isBoss ? 0.05 : profile === 'friendly' ? 0.03 : 0.04) * this.sfxVolume,
        isBoss ? 'lowpass' : 'bandpass',
        isBoss ? 980 : profile === 'enemy' ? 3600 : 4200,
        isBoss ? 0.9 : profile === 'enemy' ? 1.6 : 2.2
      );
    } catch {
      // Ignore
    }
  }

  /**
   * 播放爆炸音效
   */
  public playExplosion(
    profile: 'enemy' | 'player' | 'friendly' = 'enemy',
    scale: number = 1
  ): void {
    const sound = this.beginSound(SoundType.EXPLOSION, 500);
    if (!sound) return;
    const { now, context, sfxGain } = sound;
    const isPlayer = profile === 'player';
    const isFriendly = profile === 'friendly';
    const blastScale = Math.max(0.7, Math.min(2.4, scale));
    const isHeavy = blastScale >= 1.45;

    try {
      // 通用爆炸：中低频主体 + 高频破裂，不强调导弹特征
      const bodyOsc = context.createOscillator();
      const bodyGain = context.createGain();
      bodyOsc.type = isPlayer || isHeavy ? 'sawtooth' : 'sine';
      bodyOsc.frequency.setValueAtTime(
        (isPlayer ? 150 : isFriendly ? 145 : isHeavy ? 126 : 135) - blastScale * 8,
        now
      );
      bodyOsc.frequency.exponentialRampToValueAtTime(
        Math.max(20, (isPlayer ? 34 : isFriendly ? 38 : isHeavy ? 24 : 30) - blastScale * 3),
        now + (isPlayer ? 0.56 : isHeavy ? 0.62 : 0.5)
      );
      bodyGain.gain.setValueAtTime(0, now);
      bodyGain.gain.linearRampToValueAtTime(
        (isPlayer ? 0.46 : isFriendly ? 0.32 : isHeavy ? 0.48 : 0.4)
          * this.sfxVolume
          * Math.min(1.22, 0.88 + blastScale * 0.16),
        now + 0.018
      );
      bodyGain.gain.exponentialRampToValueAtTime(0.01, now + (isPlayer ? 0.56 : isHeavy ? 0.62 : 0.5));
      bodyOsc.connect(bodyGain);
      bodyGain.connect(sfxGain);
      bodyOsc.start(now);
      bodyOsc.stop(now + (isPlayer ? 0.56 : isHeavy ? 0.62 : 0.5));

      const crackOsc = context.createOscillator();
      const crackGain = context.createGain();
      crackOsc.type = isFriendly ? 'triangle' : 'square';
      crackOsc.frequency.setValueAtTime(
        (isPlayer ? 760 : isFriendly ? 940 : isHeavy ? 680 : 880) + blastScale * 20,
        now + 0.004
      );
      crackOsc.frequency.exponentialRampToValueAtTime(
        isPlayer ? 180 : isFriendly ? 260 : isHeavy ? 150 : 220,
        now + (isPlayer ? 0.2 : isHeavy ? 0.24 : 0.16)
      );
      crackGain.gain.setValueAtTime(0, now);
      crackGain.gain.linearRampToValueAtTime(
        (isPlayer ? 0.2 : isFriendly ? 0.13 : isHeavy ? 0.16 : 0.18)
          * this.sfxVolume
          * Math.min(1.18, 0.92 + blastScale * 0.12),
        now + 0.008
      );
      crackGain.gain.exponentialRampToValueAtTime(0.01, now + (isPlayer ? 0.22 : isHeavy ? 0.26 : 0.18));
      crackOsc.connect(crackGain);
      crackGain.connect(sfxGain);
      crackOsc.start(now + 0.004);
      crackOsc.stop(now + (isPlayer ? 0.22 : isHeavy ? 0.26 : 0.18));

      const tailOsc = context.createOscillator();
      const tailGain = context.createGain();
      tailOsc.type = 'triangle';
      tailOsc.frequency.setValueAtTime(
        (isPlayer ? 165 : isFriendly ? 210 : isHeavy ? 150 : 180) - blastScale * 6,
        now + 0.02
      );
      tailOsc.frequency.exponentialRampToValueAtTime(
        isPlayer ? 44 : isFriendly ? 62 : isHeavy ? 40 : 52,
        now + (isPlayer ? 0.48 : isHeavy ? 0.56 : 0.42)
      );
      tailGain.gain.setValueAtTime(0, now + 0.02);
      tailGain.gain.linearRampToValueAtTime(
        (isPlayer ? 0.14 : isFriendly ? 0.09 : isHeavy ? 0.13 : 0.12)
          * this.sfxVolume
          * Math.min(1.14, 0.94 + blastScale * 0.08),
        now + 0.05
      );
      tailGain.gain.exponentialRampToValueAtTime(0.01, now + (isPlayer ? 0.48 : isHeavy ? 0.56 : 0.42));
      tailOsc.connect(tailGain);
      tailGain.connect(sfxGain);
      tailOsc.start(now + 0.02);
      tailOsc.stop(now + (isPlayer ? 0.48 : isHeavy ? 0.56 : 0.42));

      this.playFilteredNoise(
        isPlayer ? 0.26 : 0.22,
        0.016,
        (isPlayer ? 0.18 : isFriendly ? 0.12 : isHeavy ? 0.22 : 0.16)
          * this.sfxVolume
          * Math.min(1.2, 0.92 + blastScale * 0.1),
        'bandpass',
        isPlayer ? 620 : isFriendly ? 760 : isHeavy ? 560 : 690,
        isPlayer ? 0.98 : isHeavy ? 0.9 : 1.05
      );
      this.playFilteredNoise(
        isPlayer ? 0.38 : isHeavy ? 0.44 : 0.34,
        0.02,
        (isPlayer ? 0.25 : isFriendly ? 0.16 : isHeavy ? 0.28 : 0.22)
          * this.sfxVolume
          * Math.min(1.18, 0.94 + blastScale * 0.08),
        'highpass',
        isPlayer ? 1450 : isFriendly ? 2100 : isHeavy ? 1200 : 1700,
        isFriendly ? 0.94 : isHeavy ? 0.76 : 0.82
      );

      if (isHeavy) {
        const subOsc = context.createOscillator();
        const subGain = context.createGain();
        subOsc.type = 'sine';
        subOsc.frequency.setValueAtTime(48, now + 0.01);
        subOsc.frequency.exponentialRampToValueAtTime(18, now + 0.68);
        subGain.gain.setValueAtTime(0, now + 0.01);
        subGain.gain.linearRampToValueAtTime(0.14 * this.sfxVolume, now + 0.045);
        subGain.gain.exponentialRampToValueAtTime(0.01, now + 0.68);
        subOsc.connect(subGain);
        subGain.connect(sfxGain);
        subOsc.start(now + 0.01);
        subOsc.stop(now + 0.68);
      }
    } catch {
      // Ignore
    }
  }

  /**
   * 播放击中音效
   */
  public playHit(intensity: number = 1, profile: 'player' | 'enemy' | 'boss' = 'player'): void {
    const sound = this.beginSound(SoundType.HIT, 100);
    if (!sound) return;
    const { now, context, sfxGain } = sound;
    const hitIntensity = Math.max(0.7, Math.min(2.2, intensity));
    const isBoss = profile === 'boss';
    const isEnemy = profile === 'enemy';

    try {
      const bodyOsc = context.createOscillator();
      const bodyGain = context.createGain();
      bodyOsc.type = isBoss ? 'sawtooth' : 'triangle';
      bodyOsc.frequency.setValueAtTime((isBoss ? 250 : isEnemy ? 380 : 420) - hitIntensity * 40, now);
      bodyOsc.frequency.exponentialRampToValueAtTime((isBoss ? 72 : 120) - hitIntensity * 10, now + (isBoss ? 0.16 : 0.11));
      bodyGain.gain.setValueAtTime(0, now);
      bodyGain.gain.linearRampToValueAtTime(
        (isBoss ? 0.16 : isEnemy ? 0.11 : 0.13) * this.sfxVolume * hitIntensity,
        now + 0.004
      );
      bodyGain.gain.exponentialRampToValueAtTime(0.01, now + (isBoss ? 0.16 : 0.11));
      bodyOsc.connect(bodyGain);
      bodyGain.connect(sfxGain);
      bodyOsc.start(now);
      bodyOsc.stop(now + (isBoss ? 0.16 : 0.11));

      const sparkOsc = context.createOscillator();
      const sparkGain = context.createGain();
      sparkOsc.type = isBoss ? 'triangle' : 'square';
      sparkOsc.frequency.setValueAtTime((isBoss ? 980 : 1600) + hitIntensity * 120, now);
      sparkOsc.frequency.exponentialRampToValueAtTime((isBoss ? 280 : 520) + hitIntensity * 40, now + (isBoss ? 0.07 : 0.05));
      sparkGain.gain.setValueAtTime(0, now);
      sparkGain.gain.linearRampToValueAtTime(
        (isBoss ? 0.06 : isEnemy ? 0.07 : 0.08) * this.sfxVolume * hitIntensity,
        now + 0.002
      );
      sparkGain.gain.exponentialRampToValueAtTime(0.01, now + (isBoss ? 0.08 : 0.06));
      sparkOsc.connect(sparkGain);
      sparkGain.connect(sfxGain);
      sparkOsc.start(now);
      sparkOsc.stop(now + (isBoss ? 0.08 : 0.06));

      this.playFilteredNoise(
        isBoss ? 0.1 : 0.07,
        0.003,
        (isBoss ? 0.11 : isEnemy ? 0.07 : 0.08) * this.sfxVolume * hitIntensity,
        isBoss ? 'bandpass' : 'highpass',
        (isBoss ? 1400 : 2200) + hitIntensity * 180,
        isBoss ? 0.95 + hitIntensity * 0.12 : 1.1 + hitIntensity * 0.15
      );
    } catch {
      // Ignore
    }
  }

  public playHeavyWeaponImpact(
    profile: 'boss-cannon' | 'laser' | 'flak-hit' | 'boss-armor' = 'boss-cannon',
    intensity: number = 1
  ): void {
    const sound = this.beginSound(SoundType.HIT, 220);
    if (!sound) return;
    const { now, context, sfxGain } = sound;
    const hitIntensity = Math.max(0.85, Math.min(2.8, intensity));
    const isLaser = profile === 'laser';
    const isFlak = profile === 'flak-hit';
    const isArmor = profile === 'boss-armor';
    const isCannon = profile === 'boss-cannon';
    const profileGain = isLaser ? 0.92 : isFlak ? 0.98 : isArmor ? 0.9 : 0.96;

    try {
      const impactOsc = context.createOscillator();
      const impactGain = context.createGain();
      impactOsc.type = isLaser ? 'triangle' : isArmor ? 'square' : 'sawtooth';
      impactOsc.frequency.setValueAtTime(
        isLaser ? 420 : isFlak ? 210 : isArmor ? 190 : isCannon ? 150 : 160,
        now
      );
      impactOsc.frequency.exponentialRampToValueAtTime(
        isLaser ? 120 : isFlak ? 54 : isArmor ? 70 : isCannon ? 42 : 46,
        now + (isLaser ? 0.18 : 0.24)
      );
      impactGain.gain.setValueAtTime(0, now);
      impactGain.gain.linearRampToValueAtTime(
        (isLaser ? 0.18 : isArmor ? 0.24 : 0.3) * this.sfxVolume * hitIntensity * profileGain,
        now + 0.006
      );
      impactGain.gain.exponentialRampToValueAtTime(0.01, now + (isLaser ? 0.18 : 0.24));
      impactOsc.connect(impactGain);
      impactGain.connect(sfxGain);
      impactOsc.start(now);
      impactOsc.stop(now + (isLaser ? 0.18 : 0.24));

      const crackOsc = context.createOscillator();
      const crackGain = context.createGain();
      crackOsc.type = isLaser ? 'sine' : 'triangle';
      crackOsc.frequency.setValueAtTime(
        isLaser ? 1480 : isFlak ? 820 : isArmor ? 980 : isCannon ? 620 : 700,
        now + 0.01
      );
      crackOsc.frequency.exponentialRampToValueAtTime(
        isLaser ? 420 : isFlak ? 190 : isArmor ? 240 : isCannon ? 135 : 150,
        now + (isLaser ? 0.14 : 0.22)
      );
      crackGain.gain.setValueAtTime(0, now + 0.008);
      crackGain.gain.linearRampToValueAtTime(
        (isLaser ? 0.08 : isArmor ? 0.12 : 0.15) * this.sfxVolume * hitIntensity * profileGain,
        now + 0.02
      );
      crackGain.gain.exponentialRampToValueAtTime(0.01, now + (isLaser ? 0.15 : 0.24));
      crackOsc.connect(crackGain);
      crackGain.connect(sfxGain);
      crackOsc.start(now + 0.01);
      crackOsc.stop(now + (isLaser ? 0.15 : 0.24));

      if (!isLaser) {
        const subOsc = context.createOscillator();
        const subGain = context.createGain();
        subOsc.type = 'sine';
        subOsc.frequency.setValueAtTime(isFlak ? 82 : isCannon ? 58 : 64, now + 0.014);
        subOsc.frequency.exponentialRampToValueAtTime(isFlak ? 28 : isCannon ? 20 : 22, now + 0.32);
        subGain.gain.setValueAtTime(0, now + 0.014);
        subGain.gain.linearRampToValueAtTime(
          (isArmor ? 0.09 : isCannon ? 0.14 : 0.12)
            * this.sfxVolume
            * Math.min(2.1, hitIntensity)
            * profileGain,
          now + 0.03
        );
        subGain.gain.exponentialRampToValueAtTime(0.01, now + 0.34);
        subOsc.connect(subGain);
        subGain.connect(sfxGain);
        subOsc.start(now + 0.014);
        subOsc.stop(now + 0.34);
      }

      if (isArmor || isCannon) {
        const metallicOsc = context.createOscillator();
        const metallicGain = context.createGain();
        metallicOsc.type = 'triangle';
        metallicOsc.frequency.setValueAtTime(isArmor ? 1280 : 960, now + 0.006);
        metallicOsc.frequency.exponentialRampToValueAtTime(isArmor ? 420 : 320, now + 0.11);
        metallicGain.gain.setValueAtTime(0, now + 0.004);
        metallicGain.gain.linearRampToValueAtTime(
          (isArmor ? 0.08 : 0.06) * this.sfxVolume * Math.min(2, hitIntensity) * profileGain,
          now + 0.014
        );
        metallicGain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
        metallicOsc.connect(metallicGain);
        metallicGain.connect(sfxGain);
        metallicOsc.start(now + 0.006);
        metallicOsc.stop(now + 0.12);
      }

      this.playFilteredNoise(
        isLaser ? 0.12 : 0.2,
        0.004,
        (isLaser ? 0.08 : isArmor ? 0.12 : 0.16)
          * this.sfxVolume
          * Math.min(2, hitIntensity)
          * profileGain,
        isLaser ? 'bandpass' : 'highpass',
        isLaser ? 2200 : isArmor ? 1700 : isCannon ? 1220 : 1350,
        isLaser ? 1.15 : isArmor ? 1.05 : isCannon ? 0.9 : 0.95
      );
      this.playFilteredNoise(
        isLaser ? 0.16 : 0.24,
        0.014,
        (isLaser ? 0.06 : isArmor ? 0.11 : 0.14)
          * this.sfxVolume
          * Math.min(2, hitIntensity)
          * profileGain,
        'bandpass',
        isLaser ? 980 : isArmor ? 920 : 760,
        isLaser ? 1.5 : 1.1
      );
    } catch {
      // Ignore
    }
  }

  public playWaterImpact(intensity: number = 1): void {
    const sound = this.beginSound(SoundType.HIT, 90);
    if (!sound) return;
    const { now, context, sfxGain } = sound;
    const splashIntensity = Math.max(0.7, Math.min(1.8, intensity));

    try {
      const bodyOsc = context.createOscillator();
      const bodyGain = context.createGain();
      bodyOsc.type = 'sine';
      bodyOsc.frequency.setValueAtTime(240, now);
      bodyOsc.frequency.exponentialRampToValueAtTime(90, now + 0.12);
      bodyGain.gain.setValueAtTime(0, now);
      bodyGain.gain.linearRampToValueAtTime(0.08 * this.sfxVolume * splashIntensity, now + 0.01);
      bodyGain.gain.exponentialRampToValueAtTime(0.01, now + 0.13);
      bodyOsc.connect(bodyGain);
      bodyGain.connect(sfxGain);
      bodyOsc.start(now);
      bodyOsc.stop(now + 0.13);

      this.playFilteredNoise(
        0.11,
        0.01,
        0.09 * this.sfxVolume * splashIntensity,
        'bandpass',
        1400,
        1.2
      );
    } catch {
      // Ignore
    }
  }

  public playGroundImpact(
    surface: 'ground' | 'desert' | 'snow' | 'city',
    intensity: number = 1
  ): void {
    switch (surface) {
      case 'desert':
        this.playFilteredNoise(
          0.1,
          0.008,
          0.08 * this.sfxVolume * Math.min(1.8, intensity),
          'bandpass',
          900,
          0.9
        );
        this.playHit(Math.max(0.72, intensity * 0.9));
        return;
      case 'snow':
        this.playFilteredNoise(
          0.08,
          0.006,
          0.05 * this.sfxVolume * Math.min(1.6, intensity),
          'bandpass',
          1200,
          1.4
        );
        return;
      case 'city':
        this.playHit(Math.max(0.85, intensity * 1.05));
        this.playFilteredNoise(
          0.06,
          0.003,
          0.06 * this.sfxVolume * Math.min(1.8, intensity),
          'highpass',
          2600,
          1.2
        );
        return;
      default:
        this.playHit(Math.max(0.8, intensity));
    }
  }

  public playLowHealthWarning(): void {
    const sound = this.beginSound(SoundType.LOW_HEALTH, 450);
    if (!sound) return;
    const { now, context, sfxGain } = sound;

    try {
      const alarmOsc = context.createOscillator();
      const alarmGain = context.createGain();
      alarmOsc.type = 'square';
      alarmOsc.frequency.setValueAtTime(720, now);
      alarmOsc.frequency.exponentialRampToValueAtTime(540, now + 0.18);
      alarmGain.gain.setValueAtTime(0, now);
      alarmGain.gain.linearRampToValueAtTime(0.07 * this.sfxVolume, now + 0.01);
      alarmGain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      alarmOsc.connect(alarmGain);
      alarmGain.connect(sfxGain);
      alarmOsc.start(now);
      alarmOsc.stop(now + 0.2);

      const pulseOsc = context.createOscillator();
      const pulseGain = context.createGain();
      pulseOsc.type = 'triangle';
      pulseOsc.frequency.setValueAtTime(240, now + 0.03);
      pulseOsc.frequency.exponentialRampToValueAtTime(160, now + 0.26);
      pulseGain.gain.setValueAtTime(0, now + 0.03);
      pulseGain.gain.linearRampToValueAtTime(0.05 * this.sfxVolume, now + 0.05);
      pulseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.28);
      pulseOsc.connect(pulseGain);
      pulseGain.connect(sfxGain);
      pulseOsc.start(now + 0.03);
      pulseOsc.stop(now + 0.28);
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

  public playMissileLockConfirm(): void {
    const sound = this.beginSound(SoundType.MISSILE_LOCK, 150);
    if (!sound) return;
    const { now, context, sfxGain } = sound;

    try {
      const confirmOsc = context.createOscillator();
      const confirmGain = context.createGain();
      confirmOsc.type = 'triangle';
      confirmOsc.frequency.setValueAtTime(980, now);
      confirmOsc.frequency.exponentialRampToValueAtTime(1460, now + 0.08);
      confirmGain.gain.setValueAtTime(0, now);
      confirmGain.gain.linearRampToValueAtTime(0.11 * this.sfxVolume, now + 0.01);
      confirmGain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
      confirmOsc.connect(confirmGain);
      confirmGain.connect(sfxGain);
      confirmOsc.start(now);
      confirmOsc.stop(now + 0.12);

      const accentOsc = context.createOscillator();
      const accentGain = context.createGain();
      accentOsc.type = 'sine';
      accentOsc.frequency.setValueAtTime(1480, now + 0.02);
      accentOsc.frequency.exponentialRampToValueAtTime(1920, now + 0.11);
      accentGain.gain.setValueAtTime(0, now + 0.02);
      accentGain.gain.linearRampToValueAtTime(0.07 * this.sfxVolume, now + 0.035);
      accentGain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
      accentOsc.connect(accentGain);
      accentGain.connect(sfxGain);
      accentOsc.start(now + 0.02);
      accentOsc.stop(now + 0.12);
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
      // 导弹发射：点火脉冲 + 推进嘶声 + 尾焰亮边
      const ignitionOsc = context.createOscillator();
      const ignitionGain = context.createGain();
      ignitionOsc.type = 'square';
      ignitionOsc.frequency.setValueAtTime(210, now);
      ignitionOsc.frequency.exponentialRampToValueAtTime(95, now + 0.12);
      ignitionGain.gain.setValueAtTime(0, now);
      ignitionGain.gain.linearRampToValueAtTime(0.24 * this.sfxVolume, now + 0.008);
      ignitionGain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
      ignitionOsc.connect(ignitionGain);
      ignitionGain.connect(sfxGain);
      ignitionOsc.start(now);
      ignitionOsc.stop(now + 0.12);

      const sustainOsc = context.createOscillator();
      const sustainGain = context.createGain();
      sustainOsc.type = 'sawtooth';
      sustainOsc.frequency.setValueAtTime(300, now + 0.012);
      sustainOsc.frequency.exponentialRampToValueAtTime(120, now + 0.34);
      sustainGain.gain.setValueAtTime(0, now + 0.01);
      sustainGain.gain.linearRampToValueAtTime(0.26 * this.sfxVolume, now + 0.028);
      sustainGain.gain.exponentialRampToValueAtTime(0.01, now + 0.34);
      sustainOsc.connect(sustainGain);
      sustainGain.connect(sfxGain);
      sustainOsc.start(now + 0.01);
      sustainOsc.stop(now + 0.34);

      const tailOsc = context.createOscillator();
      const tailGain = context.createGain();
      tailOsc.type = 'triangle';
      tailOsc.frequency.setValueAtTime(980, now + 0.018);
      tailOsc.frequency.exponentialRampToValueAtTime(380, now + 0.2);
      tailGain.gain.setValueAtTime(0, now + 0.015);
      tailGain.gain.linearRampToValueAtTime(0.08 * this.sfxVolume, now + 0.03);
      tailGain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
      tailOsc.connect(tailGain);
      tailGain.connect(sfxGain);
      tailOsc.start(now + 0.015);
      tailOsc.stop(now + 0.22);

      this.playFilteredNoise(0.2, 0.009, 0.16 * this.sfxVolume, 'bandpass', 980, 1.05);
      this.playFilteredNoise(0.14, 0.007, 0.1 * this.sfxVolume, 'highpass', 2400, 1.3);
    } catch {
      // Ignore
    }
  }

  /**
   * 播放导弹爆炸音效
   */
  public playMissileExplosion(profile: 'player' | 'boss' = 'player'): void {
    const sound = this.beginSound(SoundType.MISSILE_EXPLOSION, 600);
    if (!sound) return;
    const { now, context, sfxGain } = sound;
    const isBoss = profile === 'boss';

    try {
      // 导弹爆炸：更厚的低频冲击 + 更明确的金属破裂层
      const boomOsc = context.createOscillator();
      const boomGain = context.createGain();
      boomOsc.type = 'sawtooth';
      boomOsc.frequency.setValueAtTime(isBoss ? 76 : 88, now);
      boomOsc.frequency.exponentialRampToValueAtTime(isBoss ? 18 : 24, now + (isBoss ? 0.68 : 0.58));
      boomGain.gain.setValueAtTime(0, now);
      boomGain.gain.linearRampToValueAtTime((isBoss ? 0.6 : 0.54) * this.sfxVolume, now + 0.016);
      boomGain.gain.exponentialRampToValueAtTime(0.01, now + (isBoss ? 0.68 : 0.58));
      boomOsc.connect(boomGain);
      boomGain.connect(sfxGain);
      boomOsc.start(now);
      boomOsc.stop(now + (isBoss ? 0.68 : 0.58));

      const subOsc = context.createOscillator();
      const subGain = context.createGain();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(isBoss ? 52 : 62, now);
      subOsc.frequency.exponentialRampToValueAtTime(isBoss ? 18 : 24, now + (isBoss ? 0.6 : 0.5));
      subGain.gain.setValueAtTime(0, now);
      subGain.gain.linearRampToValueAtTime((isBoss ? 0.26 : 0.2) * this.sfxVolume, now + 0.022);
      subGain.gain.exponentialRampToValueAtTime(0.01, now + (isBoss ? 0.6 : 0.5));
      subOsc.connect(subGain);
      subGain.connect(sfxGain);
      subOsc.start(now);
      subOsc.stop(now + (isBoss ? 0.6 : 0.5));

      const crackOsc = context.createOscillator();
      const crackGain = context.createGain();
      crackOsc.type = isBoss ? 'square' : 'triangle';
      crackOsc.frequency.setValueAtTime(isBoss ? 620 : 760, now + 0.008);
      crackOsc.frequency.exponentialRampToValueAtTime(isBoss ? 120 : 170, now + (isBoss ? 0.24 : 0.2));
      crackGain.gain.setValueAtTime(0, now);
      crackGain.gain.linearRampToValueAtTime((isBoss ? 0.2 : 0.18) * this.sfxVolume, now + 0.012);
      crackGain.gain.exponentialRampToValueAtTime(0.01, now + (isBoss ? 0.26 : 0.22));
      crackOsc.connect(crackGain);
      crackGain.connect(sfxGain);
      crackOsc.start(now + 0.01);
      crackOsc.stop(now + (isBoss ? 0.26 : 0.22));

      const airburstOsc = context.createOscillator();
      const airburstGain = context.createGain();
      airburstOsc.type = isBoss ? 'sawtooth' : 'triangle';
      airburstOsc.frequency.setValueAtTime(isBoss ? 320 : 420, now + 0.02);
      airburstOsc.frequency.exponentialRampToValueAtTime(isBoss ? 90 : 140, now + (isBoss ? 0.38 : 0.3));
      airburstGain.gain.setValueAtTime(0, now + 0.02);
      airburstGain.gain.linearRampToValueAtTime((isBoss ? 0.14 : 0.1) * this.sfxVolume, now + 0.045);
      airburstGain.gain.exponentialRampToValueAtTime(0.01, now + (isBoss ? 0.42 : 0.32));
      airburstOsc.connect(airburstGain);
      airburstGain.connect(sfxGain);
      airburstOsc.start(now + 0.02);
      airburstOsc.stop(now + (isBoss ? 0.42 : 0.32));

      this.playFilteredNoise(
        isBoss ? 0.36 : 0.3,
        0.018,
        (isBoss ? 0.3 : 0.24) * this.sfxVolume,
        'bandpass',
        isBoss ? 540 : 680,
        isBoss ? 1.05 : 1.2
      );
      this.playFilteredNoise(
        isBoss ? 0.5 : 0.42,
        0.024,
        (isBoss ? 0.36 : 0.3) * this.sfxVolume,
        'highpass',
        isBoss ? 1250 : 1650,
        isBoss ? 0.78 : 0.9
      );
    } catch {
      // Ignore
    }
  }

  public playBossExplosion(scale: number = 1): void {
    const sound = this.beginSound(SoundType.BOSS_EXPLOSION, 1200);
    if (!sound) return;
    const { now, context, sfxGain } = sound;
    const bossScale = Math.max(1, Math.min(5, scale));

    try {
      const shockOsc = context.createOscillator();
      const shockGain = context.createGain();
      shockOsc.type = 'sawtooth';
      shockOsc.frequency.setValueAtTime(72, now);
      shockOsc.frequency.exponentialRampToValueAtTime(18, now + 0.82);
      shockGain.gain.setValueAtTime(0, now);
      shockGain.gain.linearRampToValueAtTime(0.62 * this.sfxVolume, now + 0.025);
      shockGain.gain.exponentialRampToValueAtTime(0.01, now + 0.82);
      shockOsc.connect(shockGain);
      shockGain.connect(sfxGain);
      shockOsc.start(now);
      shockOsc.stop(now + 0.82);

      const subOsc = context.createOscillator();
      const subGain = context.createGain();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(42, now);
      subOsc.frequency.exponentialRampToValueAtTime(16, now + 0.96);
      subGain.gain.setValueAtTime(0, now);
      subGain.gain.linearRampToValueAtTime(0.24 * this.sfxVolume, now + 0.04);
      subGain.gain.exponentialRampToValueAtTime(0.01, now + 0.96);
      subOsc.connect(subGain);
      subGain.connect(sfxGain);
      subOsc.start(now);
      subOsc.stop(now + 0.96);

      const crackOsc = context.createOscillator();
      const crackGain = context.createGain();
      crackOsc.type = 'triangle';
      crackOsc.frequency.setValueAtTime(520, now + 0.03);
      crackOsc.frequency.exponentialRampToValueAtTime(110, now + 0.42);
      crackGain.gain.setValueAtTime(0, now + 0.02);
      crackGain.gain.linearRampToValueAtTime(0.18 * this.sfxVolume, now + 0.05);
      crackGain.gain.exponentialRampToValueAtTime(0.01, now + 0.42);
      crackOsc.connect(crackGain);
      crackGain.connect(sfxGain);
      crackOsc.start(now + 0.03);
      crackOsc.stop(now + 0.42);

      this.playFilteredNoise(
        0.42 + bossScale * 0.04,
        0.02,
        0.24 * this.sfxVolume,
        'bandpass',
        720,
        0.95
      );
      this.playFilteredNoise(
        0.56 + bossScale * 0.05,
        0.03,
        0.18 * this.sfxVolume,
        'highpass',
        2200,
        0.9
      );

      const aftershockOsc = context.createOscillator();
      const aftershockGain = context.createGain();
      aftershockOsc.type = 'sine';
      aftershockOsc.frequency.setValueAtTime(86, now + 0.2);
      aftershockOsc.frequency.exponentialRampToValueAtTime(26, now + 1.12);
      aftershockGain.gain.setValueAtTime(0, now + 0.18);
      aftershockGain.gain.linearRampToValueAtTime(
        (0.08 + Math.min(0.08, bossScale * 0.02)) * this.sfxVolume,
        now + 0.32
      );
      aftershockGain.gain.exponentialRampToValueAtTime(0.01, now + 1.12);
      aftershockOsc.connect(aftershockGain);
      aftershockGain.connect(sfxGain);
      aftershockOsc.start(now + 0.2);
      aftershockOsc.stop(now + 1.12);
    } catch {
      // Ignore
    }
  }

  public playFlakCannonFire(): void {
    const sound = this.beginSound(SoundType.FLAK_FIRE, 180);
    if (!sound) return;
    const { now, context, sfxGain } = sound;

    try {
      // 重炮发射：厚重炮口冲击 + 金属门闩感
      const bodyOsc = context.createOscillator();
      const bodyGain = context.createGain();
      bodyOsc.type = 'square';
      bodyOsc.frequency.setValueAtTime(185, now);
      bodyOsc.frequency.exponentialRampToValueAtTime(72, now + 0.18);
      bodyGain.gain.setValueAtTime(0.4 * this.sfxVolume, now);
      bodyGain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      bodyOsc.connect(bodyGain);
      bodyGain.connect(sfxGain);
      bodyOsc.start(now);
      bodyOsc.stop(now + 0.2);

      const lowPunchOsc = context.createOscillator();
      const lowPunchGain = context.createGain();
      lowPunchOsc.type = 'sine';
      lowPunchOsc.frequency.setValueAtTime(110, now);
      lowPunchOsc.frequency.exponentialRampToValueAtTime(44, now + 0.22);
      lowPunchGain.gain.setValueAtTime(0, now);
      lowPunchGain.gain.linearRampToValueAtTime(0.2 * this.sfxVolume, now + 0.012);
      lowPunchGain.gain.exponentialRampToValueAtTime(0.01, now + 0.24);
      lowPunchOsc.connect(lowPunchGain);
      lowPunchGain.connect(sfxGain);
      lowPunchOsc.start(now);
      lowPunchOsc.stop(now + 0.24);

      // 瞬态脆响（防空炮特征）
      const crackOsc = context.createOscillator();
      const crackGain = context.createGain();
      crackOsc.type = 'triangle';
      crackOsc.frequency.setValueAtTime(860, now + 0.002);
      crackOsc.frequency.exponentialRampToValueAtTime(240, now + 0.07);
      crackGain.gain.setValueAtTime(0, now);
      crackGain.gain.linearRampToValueAtTime(0.24 * this.sfxVolume, now + 0.004);
      crackGain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
      crackOsc.connect(crackGain);
      crackGain.connect(sfxGain);
      crackOsc.start(now + 0.002);
      crackOsc.stop(now + 0.08);

      // 高频炮口气浪（短促带通噪声）
      this.playFilteredNoise(0.12, 0.005, 0.2 * this.sfxVolume, 'bandpass', 1650, 1.7);
      this.playFilteredNoise(0.08, 0.004, 0.1 * this.sfxVolume, 'highpass', 2800, 1.5);
    } catch {
      // Ignore
    }
  }

  public playFlakCannonExplosion(): void {
    const sound = this.beginSound(SoundType.FLAK_EXPLOSION, 600);
    if (!sound) return;
    const { now, context, sfxGain } = sound;

    try {
      // 重炮空爆：更偏空气冲击和破片，不与导弹爆炸混淆
      const boomOsc = context.createOscillator();
      const boomGain = context.createGain();
      boomOsc.type = 'sawtooth';
      boomOsc.frequency.setValueAtTime(130, now);
      boomOsc.frequency.exponentialRampToValueAtTime(34, now + 0.52);
      boomGain.gain.setValueAtTime(0, now);
      boomGain.gain.linearRampToValueAtTime(0.42 * this.sfxVolume, now + 0.02);
      boomGain.gain.exponentialRampToValueAtTime(0.01, now + 0.52);
      boomOsc.connect(boomGain);
      boomGain.connect(sfxGain);
      boomOsc.start(now);
      boomOsc.stop(now + 0.52);

      const airWaveOsc = context.createOscillator();
      const airWaveGain = context.createGain();
      airWaveOsc.type = 'triangle';
      airWaveOsc.frequency.setValueAtTime(280, now + 0.012);
      airWaveOsc.frequency.exponentialRampToValueAtTime(80, now + 0.26);
      airWaveGain.gain.setValueAtTime(0, now);
      airWaveGain.gain.linearRampToValueAtTime(0.16 * this.sfxVolume, now + 0.02);
      airWaveGain.gain.exponentialRampToValueAtTime(0.01, now + 0.28);
      airWaveOsc.connect(airWaveGain);
      airWaveGain.connect(sfxGain);
      airWaveOsc.start(now + 0.01);
      airWaveOsc.stop(now + 0.28);

      // 金属破片感
      const shrapnelOsc = context.createOscillator();
      const shrapnelGain = context.createGain();
      shrapnelOsc.type = 'triangle';
      shrapnelOsc.frequency.setValueAtTime(640, now + 0.012);
      shrapnelOsc.frequency.exponentialRampToValueAtTime(210, now + 0.22);
      shrapnelGain.gain.setValueAtTime(0, now);
      shrapnelGain.gain.linearRampToValueAtTime(0.26 * this.sfxVolume, now + 0.018);
      shrapnelGain.gain.exponentialRampToValueAtTime(0.01, now + 0.24);
      shrapnelOsc.connect(shrapnelGain);
      shrapnelGain.connect(sfxGain);
      shrapnelOsc.start(now + 0.012);
      shrapnelOsc.stop(now + 0.24);

      // 空爆破片 hiss（高通）+ 中频气浪（带通）
      this.playFilteredNoise(0.24, 0.01, 0.24 * this.sfxVolume, 'highpass', 1550, 1);
      this.playFilteredNoise(0.32, 0.018, 0.2 * this.sfxVolume, 'bandpass', 860, 1.25);
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
  public playMissileLaunch(profile: 'player' | 'boss' = 'player'): void {
    const sound = this.beginSound(SoundType.MISSILE_FIRE, 200);
    if (!sound) return;
    const { now, context, sfxGain } = sound;
    const isBoss = profile === 'boss';

    try {
      const chirpOsc = context.createOscillator();
      const chirpGain = context.createGain();
      chirpOsc.type = isBoss ? 'square' : 'triangle';
      chirpOsc.frequency.setValueAtTime(isBoss ? 760 : 1180, now);
      chirpOsc.frequency.exponentialRampToValueAtTime(isBoss ? 420 : 760, now + (isBoss ? 0.05 : 0.035));
      chirpGain.gain.setValueAtTime(0, now);
      chirpGain.gain.linearRampToValueAtTime((isBoss ? 0.05 : 0.06) * this.sfxVolume, now + 0.005);
      chirpGain.gain.exponentialRampToValueAtTime(0.01, now + (isBoss ? 0.055 : 0.04));
      chirpOsc.connect(chirpGain);
      chirpGain.connect(sfxGain);
      chirpOsc.start(now);
      chirpOsc.stop(now + (isBoss ? 0.055 : 0.04));

      const transientOsc = context.createOscillator();
      const transientGain = context.createGain();
      transientOsc.type = 'square';
      transientOsc.frequency.setValueAtTime(isBoss ? 240 : 320, now + 0.004);
      transientOsc.frequency.exponentialRampToValueAtTime(isBoss ? 110 : 180, now + (isBoss ? 0.11 : 0.08));
      transientGain.gain.setValueAtTime(0, now);
      transientGain.gain.linearRampToValueAtTime((isBoss ? 0.2 : 0.14) * this.sfxVolume, now + 0.008);
      transientGain.gain.exponentialRampToValueAtTime(0.01, now + (isBoss ? 0.13 : 0.1));
      transientOsc.connect(transientGain);
      transientGain.connect(sfxGain);
      transientOsc.start(now + 0.004);
      transientOsc.stop(now + (isBoss ? 0.13 : 0.1));

      const tailOsc = context.createOscillator();
      const tailGain = context.createGain();
      tailOsc.type = 'sawtooth';
      tailOsc.frequency.setValueAtTime(isBoss ? 260 : 420, now + 0.01);
      tailOsc.frequency.exponentialRampToValueAtTime(isBoss ? 340 : 620, now + (isBoss ? 0.12 : 0.09));
      tailGain.gain.setValueAtTime(0, now + 0.01);
      tailGain.gain.linearRampToValueAtTime((isBoss ? 0.18 : 0.12) * this.sfxVolume, now + 0.02);
      tailGain.gain.exponentialRampToValueAtTime(0.01, now + (isBoss ? 0.22 : 0.16));
      tailOsc.connect(tailGain);
      tailGain.connect(sfxGain);
      tailOsc.start(now + 0.01);
      tailOsc.stop(now + (isBoss ? 0.22 : 0.16));

      this.playFilteredNoise(
        isBoss ? 0.12 : 0.09,
        0.006,
        (isBoss ? 0.11 : 0.08) * this.sfxVolume,
        isBoss ? 'bandpass' : 'highpass',
        isBoss ? 1200 : 2100,
        isBoss ? 1 : 1.2
      );
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
