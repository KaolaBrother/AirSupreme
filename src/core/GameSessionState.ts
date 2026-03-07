import { GameStatus } from '@/core/GameState';
import { type QualityPreset } from '@/config';
import {
  type AudioSettings,
  type GameMode,
  type PresentationSettings,
  type SessionSettingsSnapshot,
} from '@/core/SessionSettings';

/**
 * 会话会话状态
 */
export class GameSessionState {
  private status: GameStatus = GameStatus.MENU;
  private mode: GameMode = 'normal';
  private level: number = 1;
  private wave: number = 0;
  private inBossBattle: boolean = false;
  private paused: boolean = false;
  private difficulty: number = 3;
  private qualityPreset: QualityPreset = 'auto';
  private tutorialEnabled: boolean = true;
  private audioSettings: AudioSettings = {
    sfxVolume: 0.7,
    musicVolume: 0.7,
  };

  public getStatus(): GameStatus {
    return this.status;
  }

  public setStatus(status: GameStatus): void {
    this.status = status;
  }

  public setPlaying(): void {
    this.status = GameStatus.PLAYING;
    this.paused = false;
  }

  public setGameOver(): void {
    this.status = GameStatus.GAME_OVER;
  }

  public isPlaying(): boolean {
    return this.status === GameStatus.PLAYING;
  }

  public getMode(): GameMode {
    return this.mode;
  }

  public setMode(mode: GameMode): void {
    this.mode = mode;
  }

  public isBossMode(): boolean {
    return this.mode === 'boss';
  }

  public getLevel(): number {
    return this.level;
  }

  public setLevel(level: number): void {
    this.level = Math.max(1, Math.round(level));
  }

  public getWave(): number {
    return this.wave;
  }

  public setWave(wave: number): void {
    this.wave = Math.max(0, Math.round(wave));
  }

  public isInBossBattle(): boolean {
    return this.inBossBattle;
  }

  public setInBossBattle(inBossBattle: boolean): void {
    this.inBossBattle = inBossBattle;
  }

  public isPaused(): boolean {
    return this.paused;
  }

  public setPaused(paused: boolean): void {
    this.paused = paused;
  }

  public pause(): void {
    this.paused = true;
  }

  public resume(): void {
    this.paused = false;
  }

  public getDifficulty(): number {
    return this.difficulty;
  }

  public setDifficulty(difficulty: number): void {
    this.difficulty = Math.max(1, Math.min(5, Math.round(difficulty)));
  }

  public getQualityPreset(): QualityPreset {
    return this.qualityPreset;
  }

  public setQualityPreset(qualityPreset: QualityPreset): void {
    this.qualityPreset = qualityPreset;
  }

  public isTutorialEnabled(): boolean {
    return this.tutorialEnabled;
  }

  public setTutorialEnabled(enabled: boolean): void {
    this.tutorialEnabled = enabled;
  }

  public getAudioSettings(): AudioSettings {
    return { ...this.audioSettings };
  }

  public getPresentationSettings(): PresentationSettings {
    return {
      qualityPreset: this.qualityPreset,
      tutorialEnabled: this.tutorialEnabled,
    };
  }

  public getSfxVolume(): number {
    return this.audioSettings.sfxVolume;
  }

  public getMusicVolume(): number {
    return this.audioSettings.musicVolume;
  }

  public setAudioSettings(sfxVolume: number, musicVolume: number): void {
    this.audioSettings = {
      sfxVolume: Math.max(0, Math.min(1, sfxVolume)),
      musicVolume: Math.max(0, Math.min(1, musicVolume)),
    };
  }

  public applySettings(settings: Partial<SessionSettingsSnapshot>): void {
    if (settings.difficulty !== undefined) {
      this.setDifficulty(settings.difficulty);
    }
    if (settings.qualityPreset !== undefined) {
      this.setQualityPreset(settings.qualityPreset);
    }
    if (settings.audioSettings) {
      this.setAudioSettings(
        settings.audioSettings.sfxVolume,
        settings.audioSettings.musicVolume
      );
    }
    if (settings.tutorialEnabled !== undefined) {
      this.setTutorialEnabled(settings.tutorialEnabled);
    }
    if (settings.mode !== undefined) {
      this.setMode(settings.mode);
    }
    if (settings.level !== undefined) {
      this.setLevel(settings.level);
    }
  }

  public getSettingsSnapshot(): SessionSettingsSnapshot {
    return {
      difficulty: this.difficulty,
      qualityPreset: this.qualityPreset,
      audioSettings: this.getAudioSettings(),
      tutorialEnabled: this.tutorialEnabled,
      mode: this.mode,
      level: this.level,
    };
  }
}
