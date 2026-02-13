import { EnemyConfig, EnemyType } from './EnemyTypes';

/**
 * AI 状态枚举
 */
export enum AIState {
  PATROL = 'PATROL',
  PURSUIT = 'PURSUIT',
  ATTACK = 'ATTACK',
  EVADE = 'EVADE',
  CIRCLE = 'CIRCLE',      // 环绕
  DIVE = 'DIVE',          // 俯冲攻击
  RETREAT = 'RETREAT',    // 撤退
}

/**
 * 敌人状态机 - 增强版
 */
export class EnemyFSM {
  private currentState: AIState;
  private stateTime: number = 0;
  private config: EnemyConfig;

  constructor(config: EnemyConfig) {
    this.config = config;
    this.currentState = AIState.PATROL;
  }

  /**
   * 获取当前状态
   */
  public getState(): AIState {
    return this.currentState;
  }

  /**
   * 获取状态持续时间
   */
  public getStateTime(): number {
    return this.stateTime;
  }

  /**
   * 获取配置
   */
  public getConfig(): EnemyConfig {
    return this.config;
  }

  /**
   * 更新状态机
   */
  public update(
    deltaTime: number,
    distance: number,
    currentHealth: number,
    maxHealth: number
  ): void {
    this.stateTime += deltaTime;

    // 根据敌人类型和情况决定状态转换
    switch (this.currentState) {
      case AIState.PATROL:
        this.updatePatrolState(distance);
        break;
      case AIState.PURSUIT:
        this.updatePursuitState(distance, currentHealth, maxHealth);
        break;
      case AIState.ATTACK:
        this.updateAttackState(distance, currentHealth, maxHealth);
        break;
      case AIState.EVADE:
        this.updateEvadeState();
        break;
      case AIState.CIRCLE:
        this.updateCircleState(distance);
        break;
      case AIState.DIVE:
        this.updateDiveState(distance);
        break;
      case AIState.RETREAT:
        this.updateRetreatState(distance);
        break;
    }
  }

  private updatePatrolState(distance: number): void {
    if (distance < this.config.detectionRange) {
      // 根据敌人类型选择不同的进入策略
      if (this.config.type === EnemyType.SNIPER) {
        this.transition(AIState.CIRCLE);
      } else if (this.config.type === EnemyType.HEAVY) {
        this.transition(AIState.ATTACK);
      } else {
        this.transition(AIState.PURSUIT);
      }
    }

    // 偶尔随机切换到环绕或撤退状态，增加多样性
    if (this.stateTime > 5.0 && Math.random() < 0.005) {
      const randomChoice = Math.random();
      if (randomChoice < 0.5) {
        this.transition(AIState.CIRCLE);
      } else {
        this.transition(AIState.RETREAT);
      }
    }
  }

  private updatePursuitState(distance: number, currentHealth: number, maxHealth: number): void {
    // 血量低时考虑撤退或闪避
    if (currentHealth < maxHealth * 0.3) {
      if (Math.random() < this.config.evasionChance) {
        this.transition(AIState.EVADE);
        return;
      }
    }

    if (distance < this.config.attackRange) {
      // 王牌飞行员使用高级战术
      if (this.config.type === EnemyType.ACE && Math.random() < 0.3) {
        this.transition(AIState.DIVE);
      } else {
        this.transition(AIState.ATTACK);
      }
    } else if (distance > this.config.detectionRange * 1.5) {
      this.transition(AIState.PATROL);
    } else if (this.config.type === EnemyType.SNIPER && distance < this.config.attackRange * 0.5) {
      // 狙击手保持距离
      this.transition(AIState.RETREAT);
    }

    // 添加随机行为：有时脱离追击去巡逻或环绕
    // 这会让敌人不那么聚集
    if (this.stateTime > 3.0 && Math.random() < 0.008) {
      const randomChoice = Math.random();
      if (randomChoice < 0.3) {
        this.transition(AIState.PATROL);
      } else if (randomChoice < 0.6) {
        this.transition(AIState.CIRCLE);
      } else {
        this.transition(AIState.RETREAT);
      }
    }
  }

  private updateAttackState(distance: number, currentHealth: number, maxHealth: number): void {
    // 血量低时闪避
    if (currentHealth < maxHealth * 0.4 && Math.random() < this.config.evasionChance) {
      this.transition(AIState.EVADE);
      return;
    }

    if (distance > this.config.attackRange * 1.3) {
      this.transition(AIState.PURSUIT);
    } else if (this.stateTime > 4.0) {
      // 攻击太久，变换战术 - 更频繁的切换
      const randomChoice = Math.random();
      if (this.config.type === EnemyType.ACE) {
        // 王牌飞行员更多样化战术
        if (randomChoice < 0.4) {
          this.transition(AIState.CIRCLE);
        } else if (randomChoice < 0.7) {
          this.transition(AIState.DIVE);
        } else {
          this.transition(AIState.PURSUIT);
        }
      } else {
        // 其他敌人也有随机行为
        if (randomChoice < 0.4) {
          this.transition(AIState.CIRCLE);
        } else if (randomChoice < 0.7) {
          this.transition(AIState.RETREAT);
        } else {
          this.transition(AIState.PURSUIT);
        }
      }
    }
  }

  private updateEvadeState(): void {
    // 闪避2秒后重新评估
    if (this.stateTime > 2.0) {
      if (Math.random() < 0.6) {
        this.transition(AIState.RETREAT);
      } else {
        this.transition(AIState.PURSUIT);
      }
    }
  }

  private updateCircleState(distance: number): void {
    if (distance > this.config.attackRange) {
      this.transition(AIState.PURSUIT);
    } else if (this.stateTime > 8.0) {
      // 环绕太久，直接攻击
      this.transition(AIState.ATTACK);
    }
  }

  private updateDiveState(distance: number): void {
    // 俯冲攻击后退出
    if (this.stateTime > 2.0 || distance < 10) {
      this.transition(AIState.EVADE);
    }
  }

  private updateRetreatState(distance: number): void {
    if (distance > this.config.attackRange * 0.8) {
      this.transition(AIState.CIRCLE);
    }
  }

  /**
   * 状态转换
   */
  private transition(newState: AIState): void {
    this.currentState = newState;
    this.stateTime = 0;
  }

  /**
   * 强制转换到闪避状态
   */
  public startEvade(): void {
    this.transition(AIState.EVADE);
  }
}
