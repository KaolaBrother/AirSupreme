/**
 * 音效类型
 */
export enum SoundType {
  ENGINE = 'ENGINE',
  SHOOT = 'SHOOT',
  EXPLOSION = 'EXPLOSION',
  HIT = 'HIT',
  POWERUP = 'POWERUP',
  LEVEL_UP = 'LEVEL_UP',
  WAVE_START = 'WAVE_START',
  GAME_OVER = 'GAME_OVER',
  BALLOON_POP = 'BALLOON_POP',      // 气球打破音效
  MISSILE_LOCK = 'MISSILE_LOCK',    // 导弹锁定音效
  MISSILE_FIRE = 'MISSILE_FIRE',      // 导弹发射音效
  MISSILE_EXPLOSION = 'MISSILE_EXPLOSION', // 导弹爆炸音效
}

/**
 * 音效管理器
 * 使用 Web Audio API 生成音效（无需外部音频文件）
 */
export class AudioManager {
  private context: AudioContext | null = null;
  private masterVolume: GainNode | null = null;
  private engineOscillator: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private isEnginePlaying: boolean = false;

  // 音量设置
  private masterVolumeValue: number = 0.5;
  private sfxVolume: number = 0.7;

  constructor() {
    // 延迟初始化，等待用户交互
  }

  /**
   * 初始化音频上下文
   */
  private initContext(): void {
    if (this.context) return;

    try {
      this.context = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterVolume = this.context.createGain();
      this.masterVolume.gain.value = this.masterVolumeValue;
      this.masterVolume.connect(this.context.destination);
    } catch (e) {
      console.warn('Web Audio API not supported');
    }
  }

  /**
   * 恢复音频上下文（需要用户交互）
   */
  public resume(): void {
    this.initContext();
    if (this.context?.state === 'suspended') {
      this.context.resume();
    }
  }

  /**
   * 播放引擎声（持续音效）
   */
  public startEngine(): void {
    this.initContext();
    if (!this.context || !this.masterVolume || this.isEnginePlaying) return;

    try {
      // 创建引擎声
      this.engineOscillator = this.context.createOscillator();
      this.engineGain = this.context.createGain();

      // 低频引擎声
      this.engineOscillator.type = 'sawtooth';
      this.engineOscillator.frequency.value = 80;

      // 音量包络
      this.engineGain.gain.value = 0.05 * this.sfxVolume;

      // 添加滤波器让声音更自然
      const filter = this.context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 500;

      // 连接节点
      this.engineOscillator.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(this.masterVolume);

      this.engineOscillator.start();
      this.isEnginePlaying = true;
    } catch (e) {
      console.warn('Failed to start engine sound');
    }
  }

  /**
   * 更新引擎声频率（根据速度）
   */
  public updateEngine(speed: number): void {
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
    this.isEnginePlaying = false;
  }

  /**
   * 播放射击音效
   */
  public playShoot(): void {
    this.initContext();
    if (!this.context || !this.masterVolume) return;

    try {
      const now = this.context.currentTime;

      // 创建射击声
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.1);

      gain.gain.setValueAtTime(0.2 * this.sfxVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

      osc.connect(gain);
      gain.connect(this.masterVolume);

      osc.start(now);
      osc.stop(now + 0.1);

      // 添加噪声层
      this.playNoise(0.05, 0.1, 0.1 * this.sfxVolume);
    } catch (e) {
      // Ignore
    }
  }

  /**
   * 播放爆炸音效
   */
  public playExplosion(): void {
    this.initContext();
    if (!this.context || !this.masterVolume) return;

    try {
      const now = this.context.currentTime;

      // 低频爆炸声
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(20, now + 0.5);

      gain.gain.setValueAtTime(0.5 * this.sfxVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

      osc.connect(gain);
      gain.connect(this.masterVolume);

      osc.start(now);
      osc.stop(now + 0.5);

      // 添加噪声
      this.playNoise(0.3, 0.5, 0.3 * this.sfxVolume);
    } catch (e) {
      // Ignore
    }
  }

  /**
   * 播放击中音效
   */
  public playHit(): void {
    this.initContext();
    if (!this.context || !this.masterVolume) return;

    try {
      const now = this.context.currentTime;

      const osc = this.context.createOscillator();
      const gain = this.context.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);

      gain.gain.setValueAtTime(0.15 * this.sfxVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

      osc.connect(gain);
      gain.connect(this.masterVolume);

      osc.start(now);
      osc.stop(now + 0.1);
    } catch (e) {
      // Ignore
    }
  }

  /**
   * 播放道具拾取音效
   */
  public playPowerUp(): void {
    this.initContext();
    if (!this.context || !this.masterVolume) return;

    try {
      const now = this.context.currentTime;

      // 上升音阶
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6

      notes.forEach((freq, i) => {
        const osc = this.context!.createOscillator();
        const gain = this.context!.createGain();

        osc.type = 'sine';
        osc.frequency.value = freq;

        const startTime = now + i * 0.08;
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.15 * this.sfxVolume, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.15);

        osc.connect(gain);
        gain.connect(this.masterVolume!);

        osc.start(startTime);
        osc.stop(startTime + 0.15);
      });
    } catch (e) {
      // Ignore
    }
  }

  /**
   * 播放升级音效
   */
  public playLevelUp(): void {
    this.initContext();
    if (!this.context || !this.masterVolume) return;

    try {
      const now = this.context.currentTime;

      // 胜利音效
      const notes = [392, 523.25, 659.25, 783.99]; // G4, C5, E5, G5

      notes.forEach((freq, i) => {
        const osc = this.context!.createOscillator();
        const gain = this.context!.createGain();

        osc.type = 'triangle';
        osc.frequency.value = freq;

        const startTime = now + i * 0.1;
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.2 * this.sfxVolume, startTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);

        osc.connect(gain);
        gain.connect(this.masterVolume!);

        osc.start(startTime);
        osc.stop(startTime + 0.3);
      });
    } catch (e) {
      // Ignore
    }
  }

  /**
   * 播放波次开始音效
   */
  public playWaveStart(): void {
    this.initContext();
    if (!this.context || !this.masterVolume) return;

    try {
      const now = this.context.currentTime;

      // 警报音
      for (let i = 0; i < 3; i++) {
        const osc = this.context.createOscillator();
        const gain = this.context.createGain();

        osc.type = 'square';
        osc.frequency.value = 440;

        const startTime = now + i * 0.15;
        gain.gain.setValueAtTime(0.1 * this.sfxVolume, startTime);
        gain.gain.setValueAtTime(0, startTime + 0.1);

        osc.connect(gain);
        gain.connect(this.masterVolume);

        osc.start(startTime);
        osc.stop(startTime + 0.1);
      }
    } catch (e) {
      // Ignore
    }
  }

  /**
   * 播放游戏结束音效
   */
  public playGameOver(): void {
    this.initContext();
    if (!this.context || !this.masterVolume) return;

    try {
      const now = this.context.currentTime;

      // 下降音阶
      const notes = [392, 349.23, 329.63, 293.66]; // G4, F4, E4, D4

      notes.forEach((freq, i) => {
        const osc = this.context!.createOscillator();
        const gain = this.context!.createGain();

        osc.type = 'triangle';
        osc.frequency.value = freq;

        const startTime = now + i * 0.2;
        gain.gain.setValueAtTime(0.15 * this.sfxVolume, startTime);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.4);

        osc.connect(gain);
        gain.connect(this.masterVolume!);

        osc.start(startTime);
        osc.stop(startTime + 0.4);
      });
    } catch (e) {
      // Ignore
    }
  }

  /**
   * 播放白噪声
   */
  private playNoise(duration: number, attack: number, volume: number): void {
    if (!this.context || !this.masterVolume) return;

    try {
      const bufferSize = this.context.sampleRate * duration;
      const buffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
      const data = buffer.getChannelData(0);

      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const source = this.context.createBufferSource();
      source.buffer = buffer;

      const gain = this.context.createGain();
      const now = this.context.currentTime;

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(volume, now + attack);
      gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

      source.connect(gain);
      gain.connect(this.masterVolume);

      source.start(now);
    } catch (e) {
      // Ignore
    }
  }

  /**
   * 设置主音量
   */
  public setMasterVolume(volume: number): void {
    this.masterVolumeValue = Math.max(0, Math.min(1, volume));
    if (this.masterVolume) {
      this.masterVolume.gain.value = this.masterVolumeValue;
    }
  }

  /**
   * 播放气球打破音效
   */
  public playBalloonPop(): void {
    this.initContext();
    if (!this.context || !this.masterVolume) return;

    try {
      const now = this.context.currentTime;

      // 使用高音调的"波普"音效
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.1);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.3 * this.sfxVolume, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

      osc.connect(gain);
      gain.connect(this.masterVolume);

      osc.start(now);
      osc.stop(now + 0.15);

      // 添加高频"啵"声
      const popOsc = this.context.createOscillator();
      const popGain = this.context.createGain();
      popOsc.type = 'square';
      popOsc.frequency.setValueAtTime(1200, now + 0.05);
      popGain.gain.setValueAtTime(0, now + 0.05);
      popGain.gain.linearRampToValueAtTime(0.15 * this.sfxVolume, now + 0.05);
      popGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

      popOsc.connect(popGain);
      popGain.connect(this.masterVolume);

      popOsc.start(now + 0.05);
      popOsc.stop(now + 0.1);
    } catch (e) {
      // Ignore
    }
  }

  /**
   * 播放导弹锁定音效
   */
  public playMissileLock(): void {
    this.initContext();
    if (!this.context || !this.masterVolume) return;

    try {
      const now = this.context.currentTime;

      // 高频"滴"声表示锁定成功
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.exponentialRampToValueAtTime(1800, now + 0.1);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.25 * this.sfxVolume, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

      osc.connect(gain);
      gain.connect(this.masterVolume);

      osc.start(now);
      osc.stop(now + 0.15);
    } catch (e) {
      // Ignore
    }
  }

  /**
   * 播放导弹发射音效
   */
  public playMissileFire(): void {
    this.initContext();
    if (!this.context || !this.masterVolume) return;

    try {
      const now = this.context.currentTime;

      // 导弹发射"咻"声
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(150, now + 0.3);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.3 * this.sfxVolume, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

      osc.connect(gain);
      gain.connect(this.masterVolume);

      osc.start(now);
      osc.stop(now + 0.3);
    } catch (e) {
      // Ignore
    }
  }

  /**
   * 播放导弹爆炸音效
   */
  public playMissileExplosion(): void {
    this.initContext();
    if (!this.context || !this.masterVolume) return;

    try {
      const now = this.context.currentTime;

      // 导弹爆炸 - 更沉重的爆炸声
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(100, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.5);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.6 * this.sfxVolume, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

      osc.connect(gain);
      gain.connect(this.masterVolume);

      osc.start(now);
      osc.stop(now + 0.5);

      // 添加噪声层增强爆炸感
      this.playNoise(0.6, 0.1, 0.8 * this.sfxVolume);
    } catch (e) {
      // Ignore
    }
  }

  /**
   * 设置音效音量
   */
  public setSFXVolume(volume: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
  }

  /**
   * 播放导弹发射音效
   */
  public playMissileLaunch(): void {
    this.initContext();
    if (!this.context || !this.masterVolume) return;

    try {
      const now = this.context.currentTime;

      // 导弹发射"咻"声
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(600, now + 0.1);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.2 * this.sfxVolume, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

      osc.connect(gain);
      gain.connect(this.masterVolume);

      osc.start(now);
      osc.stop(now + 0.15);
    } catch (e) {
      // Ignore
    }
  }

  /**
   * 静音
   */
  public mute(): void {
    if (this.masterVolume) {
      this.masterVolume.gain.value = 0;
    }
  }

  /**
   * 取消静音
   */
  public unmute(): void {
    if (this.masterVolume) {
      this.masterVolume.gain.value = this.masterVolumeValue;
    }
  }
}
