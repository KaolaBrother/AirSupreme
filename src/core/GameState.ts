/**
 * 游戏状态枚举
 */
export enum GameStatus {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  GAME_OVER = 'GAME_OVER',
}

/**
 * 游戏状态管理
 */
export class GameState {
  private status: GameStatus = GameStatus.MENU;
  private score: number = 0;
  private enemiesDestroyed: number = 0;

  /**
   * 设置状态
   */
  public setStatus(status: GameStatus): void {
    this.status = status;
  }

  /**
   * 获取状态
   */
  public getStatus(): GameStatus {
    return this.status;
  }

  /**
   * 增加分数
   */
  public addScore(points: number): void {
    this.score += points;
  }

  /**
   * 获取分数
   */
  public getScore(): number {
    return this.score;
  }

  /**
   * 增加击杀数
   */
  public incrementEnemiesDestroyed(): void {
    this.enemiesDestroyed++;
  }

  /**
   * 获取击杀数
   */
  public getEnemiesDestroyed(): number {
    return this.enemiesDestroyed;
  }

  /**
   * 开始游戏
   */
  public start(): void {
    this.status = GameStatus.PLAYING;
  }

  /**
   * 检查游戏是否正在进行
   */
  public isPlaying(): boolean {
    return this.status === GameStatus.PLAYING;
  }

  /**
   * 重置游戏状态
   */
  public reset(): void {
    this.score = 0;
    this.enemiesDestroyed = 0;
    this.status = GameStatus.MENU;
  }
}
