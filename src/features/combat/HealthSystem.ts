/**
 * 生命值系统
 */
export class HealthSystem {
  private maxHealth: number;
  private currentHealth: number;
  private isDead: boolean = false;

  // 回调函数
  public onDamage?: (amount: number, remaining: number) => void;
  public onDeath?: () => void;

  constructor(maxHealth: number = 100) {
    this.maxHealth = maxHealth;
    this.currentHealth = maxHealth;
  }

  /**
   * 受到伤害
   */
  public takeDamage(amount: number): void {
    if (this.isDead) return;

    this.currentHealth = Math.max(0, this.currentHealth - amount);

    // 触发伤害回调
    if (this.onDamage) {
      this.onDamage(amount, this.currentHealth);
    }

    // 检查死亡
    if (this.currentHealth <= 0) {
      this.isDead = true;
      if (this.onDeath) {
        this.onDeath();
      }
    }
  }

  /**
   * 治疗
   */
  public heal(amount: number): void {
    if (this.isDead) return;
    this.currentHealth = Math.min(this.maxHealth, this.currentHealth + amount);
  }

  /**
   * 补满到最大生命值
   */
  public healToMax(): void {
    if (this.isDead) return;
    this.currentHealth = this.maxHealth;
  }

  /**
   * 获取生命值百分比
   */
  public getHealthPercent(): number {
    return this.currentHealth / this.maxHealth;
  }

  /**
   * 获取当前生命值
   */
  public getCurrentHealth(): number {
    return this.currentHealth;
  }

  /**
   * 获取最大生命值
   */
  public getMaxHealth(): number {
    return this.maxHealth;
  }

  /**
   * 检查是否死亡
   */
  public isEntityDead(): boolean {
    return this.isDead;
  }

  /**
   * 重置生命值
   */
  public reset(): void {
    this.currentHealth = this.maxHealth;
    this.isDead = false;
  }
}
