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
    // 发现玩家，根据敌人类型选择策略
    if (distance < this.config.detectionRange) {
      if (this.config.type === EnemyType.SNIPER) {
        this.transition(AIState.CIRCLE);
      } else if (this.config.type === EnemyType.HEAVY) {
        this.transition(AIState.ATTACK);
      } else {
        this.transition(AIState.PURSUIT);
      }
      return;
    }

    // 偶尔随机性：低概率切换状态，增加多样性
    // 但不能太频繁，至少巡逻5秒后才考虑切换
    if (this.stateTime > 5.0 && Math.random() < 0.002) {
      const randomChoice = Math.random();
      if (randomChoice < 0.4) {
        this.transition(AIState.CIRCLE);
      } else {
        this.transition(AIState.RETREAT);
      }
    }
  }

  private updatePursuitState(distance: number, currentHealth: number, maxHealth: number): void {
    // 进入攻击范围，切换到攻击
    if (distance < this.config.attackRange) {
      if (this.config.type === EnemyType.ACE && Math.random() < 0.3) {
        this.transition(AIState.DIVE);
      } else {
        this.transition(AIState.ATTACK);
      }
      return;
    }

    // 距离太远，返回巡逻
    if (distance > this.config.detectionRange * 1.5) {
      this.transition(AIState.PATROL);
      return;
    }

    // 血量低时考虑闪避
    if (currentHealth < maxHealth * 0.3) {
      if (Math.random() < this.config.evasionChance * 0.5) {
        this.transition(AIState.EVADE);
        return;
      }
    }

    // 狙击手保持距离，低概率撤退
    if (this.config.type === EnemyType.SNIPER && distance < this.config.attackRange * 0.6) {
      if (Math.random() < 0.01) {
        this.transition(AIState.RETREAT);
      }
    }

    // 低概率随机行为（避免太聚集）
    if (this.stateTime > 4.0 && Math.random() < 0.003) {
      const randomChoice = Math.random();
      if (randomChoice < 0.4) {
        this.transition(AIState.CIRCLE);
      } else {
        this.transition(AIState.RETREAT);
      }
    }
  }

  private updateAttackState(distance: number, currentHealth: number, maxHealth: number): void {
    // 距离太远，切换到追击
    if (distance > this.config.attackRange * 1.3) {
      this.transition(AIState.PURSUIT);
      return;
    }

    // 血量低时高概率闪避
    if (currentHealth < maxHealth * 0.4) {
      if (Math.random() < this.config.evasionChance * 0.8) {
        this.transition(AIState.EVADE);
        return;
      }
    }

    // 攻击一段时间后，低概率变换战术（避免太频繁）
    // 至少攻击6秒后才考虑切换
    if (this.stateTime > 6.0 && Math.random() < 0.005) {
      const randomChoice = Math.random();
      if (this.config.type === EnemyType.ACE) {
        // 王牌飞行员更多样化战术
        if (randomChoice < 0.35) {
          this.transition(AIState.CIRCLE);
        } else if (randomChoice < 0.6) {
          this.transition(AIState.DIVE);
        } else {
          this.transition(AIState.PURSUIT);
        }
      } else {
        // 其他敌人也有随机行为
        if (randomChoice < 0.3) {
          this.transition(AIState.CIRCLE);
        } else if (randomChoice < 0.6) {
          this.transition(AIState.RETREAT);
        } else {
          this.transition(AIState.PURSUIT);
        }
      }
    }
  }

  private updateEvadeState(): void {
    // 闪避持续2-3秒后重新评估
    if (this.stateTime > 2.5) {
      if (Math.random() < 0.5) {
        this.transition(AIState.RETREAT);
      } else {
        this.transition(AIState.PURSUIT);
      }
    }
  }

  private updateCircleState(distance: number): void {
    // 距离太远，停止环绕
    if (distance > this.config.attackRange * 1.2) {
      this.transition(AIState.PURSUIT);
      return;
    }

    // 环绕一段时间后，低概率切换到攻击
    if (this.stateTime > 7.0 && Math.random() < 0.01) {
      this.transition(AIState.ATTACK);
    }
  }

  private updateDiveState(_distance: number): void {
    // 俯冲2-3秒后退出
    if (this.stateTime > 2.5) {
      if (Math.random() < 0.7) {
        this.transition(AIState.EVADE);
      } else {
        this.transition(AIState.PURSUIT);
      }
    }
  }

  private updateRetreatState(distance: number): void {
    // 撤退到合适距离后，根据情况决定下一步
    if (distance > this.config.attackRange * 0.9) {
      if (Math.random() < 0.6) {
        this.transition(AIState.CIRCLE);
      } else {
        this.transition(AIState.PURSUIT);
      }
    }
  }

  /**
   * 状态转换
   */
  private transition(newState: AIState): void {
    this.currentState = newState;
    this.stateTime = 0;
    // 重置目标角度，避免切换时突然转向
    // targetYaw 和 targetPitch 会在 EnemyAI 中自然更新
  }

  /**
   * 强制转换到闪避状态
   */
  public startEvade(): void {
    this.transition(AIState.EVADE);
  }
}
