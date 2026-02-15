export class HealthSystem {
  private maxHealth: number;
  private currentHealth: number;
  private isDead: boolean = false;

  public onDamage?: (amount: number, remaining: number) => void;
  public onDeath?: () => void;

  constructor(maxHealth: number = 100) {
    this.maxHealth = maxHealth;
    this.currentHealth = maxHealth;
  }

  public takeDamage(amount: number): void {
    if (this.isDead) return;

    this.currentHealth = Math.max(0, this.currentHealth - amount);

    if (this.onDamage) {
      this.onDamage(amount, this.currentHealth);
    }

    if (this.currentHealth <= 0) {
      this.isDead = true;
      if (this.onDeath) {
        this.onDeath();
      }
    }
  }

  public heal(amount: number): void {
    if (this.isDead) return;
    this.currentHealth = Math.min(this.maxHealth, this.currentHealth + amount);
  }

  public healToMax(): void {
    this.isDead = false;
    this.currentHealth = this.maxHealth;
  }

  public setMaxHealth(newMax: number, heal: boolean = false): void {
    this.maxHealth = newMax;
    if (heal) {
      this.currentHealth = this.maxHealth;
    } else {
      this.currentHealth = Math.min(this.currentHealth, this.maxHealth);
    }
  }

  public getHealthPercent(): number {
    return this.currentHealth / this.maxHealth;
  }

  public getCurrentHealth(): number {
    return this.currentHealth;
  }

  public getMaxHealth(): number {
    return this.maxHealth;
  }

  public isEntityDead(): boolean {
    return this.isDead;
  }

  public reset(): void {
    this.currentHealth = this.maxHealth;
    this.isDead = false;
  }
}
