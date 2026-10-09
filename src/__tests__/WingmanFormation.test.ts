import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventBus, GameEventType } from '@/core/EventBus';
import { EnemySystem } from '@/core/systems/EnemySystem';
import {
  FriendlyAI,
  getFormationSlotOffset,
  type FormationSlotOffset,
} from '@/features/enemy/FriendlyAI';
import { ENEMY_CONFIGS, EnemyType } from '@/features/enemy/EnemyTypes';

/**
 * 僚机编队（EnemySystem + FriendlyAI，终验修复 F1）：
 * - EnemySystem 给每架入场友机分配最小的空闲编队位（setFormationSlot / getFormationSlot），
 *   阵亡友机空出的位置留给下一架；
 * - 空闲（没有敌人）的友机落在玩家两侧、按编队位左右交替，带转弯的整段飞行中都不进入
 *   追尾镜头与座机之间的视线走廊；
 * - 有敌人（或 Boss 本体 / 部件等额外目标）时照常追击、开火。
 * 不钉编队位的具体偏移（38 / 40 / 6 米），只钉“在旁边、左右交替、走廊之外”。
 */

const DT = 1 / 30;
const PLAYER_SPEED = 45;
/** 追尾镜头视线走廊（玩家水平航向坐标系）：镜头在座机后 15 米，走廊取座机后 30 米到前 5 米、横向 ±15 米 */
const CORRIDOR = { back: 30, front: 5, halfWidth: 15 } as const;

/** 确定性的伪随机（mulberry32），替代 Math.random */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface PlayerTrack {
  position: THREE.Vector3;
  heading: number;
}

/** 玩家坐标系：along 沿机头向前为正，lateral 向右为正（机头 -Z 时右侧是 +X） */
function relative(player: PlayerTrack, point: THREE.Vector3): { along: number; lateral: number } {
  const forwardX = -Math.sin(player.heading);
  const forwardZ = -Math.cos(player.heading);
  const dx = point.x - player.position.x;
  const dz = point.z - player.position.z;
  return { along: dx * forwardX + dz * forwardZ, lateral: dx * -forwardZ + dz * forwardX };
}

function insideCorridor(offset: { along: number; lateral: number }): boolean {
  return (
    offset.along > -CORRIDOR.back &&
    offset.along < CORRIDOR.front &&
    Math.abs(offset.lateral) < CORRIDOR.halfWidth
  );
}

describe('wingman formation', () => {
  let scene: THREE.Scene;
  let enemySystem: EnemySystem;
  let randomSpy: { mockRestore(): void } | null = null;

  beforeEach(() => {
    EventBus.clear();
    scene = new THREE.Scene();
    enemySystem = new EnemySystem(scene);
    randomSpy = vi.spyOn(Math, 'random').mockImplementation(seeded(20261009));
  });

  afterEach(() => {
    enemySystem.clearFriendlies();
    enemySystem.dispose();
    EventBus.clear();
    // 只还原本文件的 Math.random（全局 setup 里的尾迹替身不能被 restoreAllMocks 清掉）
    randomSpy?.mockRestore();
    randomSpy = null;
  });

  function spawnFriendly(position: THREE.Vector3): FriendlyAI {
    const mesh = new THREE.Group();
    mesh.position.copy(position);
    scene.add(mesh);
    const friendly = new FriendlyAI(mesh, ENEMY_CONFIGS[EnemyType.FIGHTER], scene);
    enemySystem.spawnFriendly(friendly);
    return friendly;
  }

  /** 玩家按给定偏航角速度（rad/s）飞 seconds 秒；每步之后回调 */
  function flyPlayer(
    player: PlayerTrack,
    seconds: number,
    yawRate: number,
    onStep?: (time: number) => void,
    targets?: THREE.Object3D[]
  ): void {
    const steps = Math.round(seconds / DT);
    for (let i = 0; i < steps; i++) {
      player.heading += yawRate * DT;
      player.position.x += -Math.sin(player.heading) * PLAYER_SPEED * DT;
      player.position.z += -Math.cos(player.heading) * PLAYER_SPEED * DT;
      enemySystem.updateWithPlayer(DT, player.position, targets);
      onStep?.((i + 1) * DT);
    }
  }

  describe('formation slots (EnemySystem)', () => {
    it('gives each new friendly the lowest free slot', () => {
      const a = spawnFriendly(new THREE.Vector3(-30, 100, 0));
      const b = spawnFriendly(new THREE.Vector3(30, 100, 0));
      const c = spawnFriendly(new THREE.Vector3(0, 100, 30));
      expect([a, b, c].map((friendly) => friendly.getFormationSlot())).toEqual([0, 1, 2]);
    });

    it('hands a fallen friendly’s slot to the next one', () => {
      const a = spawnFriendly(new THREE.Vector3(-30, 100, 0));
      const b = spawnFriendly(new THREE.Vector3(30, 100, 0));
      spawnFriendly(new THREE.Vector3(0, 100, 30));

      a.takeDamage(1e6);
      expect(a.isAlive()).toBe(false);
      const replacement = spawnFriendly(new THREE.Vector3(0, 100, -30));
      expect(replacement.getFormationSlot()).toBe(0);
      expect(b.getFormationSlot()).toBe(1);

      // 阵亡友机被移出编队后，空位仍按“最小空闲”分配
      b.takeDamage(1e6);
      enemySystem.updateWithPlayer(DT, new THREE.Vector3(0, 100, 0));
      expect(enemySystem.getFriendlyAIs()).not.toContain(b);
      expect(spawnFriendly(new THREE.Vector3(10, 100, 10)).getFormationSlot()).toBe(1);
      expect(spawnFriendly(new THREE.Vector3(20, 100, 10)).getFormationSlot()).toBe(3);
    });
  });

  describe('idle formation flight', () => {
    interface FormationFlight {
      player: PlayerTrack;
      friendlies: FriendlyAI[];
      /** 整队之后进入视线走廊的记录（应为空） */
      corridorHits: string[];
      /** 再飞一段：seconds 秒、偏航角速度 yawRate（rad/s） */
      leg(seconds: number, yawRate: number): void;
    }

    /** 三架友机入场，玩家直飞 12 秒让编队成形；之后每一步都检查视线走廊 */
    function formationFlight(): FormationFlight {
      const player: PlayerTrack = { position: new THREE.Vector3(0, 120, 0), heading: 0 };
      // 入场位置故意分散（含一架就在座机正后方的走廊里）
      const friendlies = [
        spawnFriendly(new THREE.Vector3(0, 115, 20)),
        spawnFriendly(new THREE.Vector3(-45, 130, -10)),
        spawnFriendly(new THREE.Vector3(35, 100, 40)),
      ];
      const corridorHits: string[] = [];
      let clock = 0;
      let settled = false;
      const check = (stepTime: number): void => {
        if (!settled) return;
        friendlies.forEach((friendly, index) => {
          const offset = relative(player, friendly.getMesh().position);
          if (insideCorridor(offset)) {
            const along = offset.along.toFixed(1);
            const lateral = offset.lateral.toFixed(1);
            const time = (clock + stepTime).toFixed(2);
            corridorHits.push(`slot ${index} at t=${time} s: along ${along}, lateral ${lateral}`);
          }
        });
      };
      const leg = (seconds: number, yawRate: number): void => {
        flyPlayer(player, seconds, yawRate, check);
        clock += seconds;
      };
      leg(12, 0);
      settled = true;
      return { player, friendlies, corridorHits, leg };
    }

    function expectBesideOnAlternatingSides(player: PlayerTrack, friendlies: FriendlyAI[]): void {
      const offsets = friendlies.map((friendly) => relative(player, friendly.getMesh().position));
      for (const [index, offset] of offsets.entries()) {
        const where = `slot ${index}: along ${offset.along.toFixed(1)}, lateral ${offset.lateral.toFixed(1)}`;
        expect(Math.abs(offset.lateral), `${where} — off to the side`).toBeGreaterThanOrEqual(
          CORRIDOR.halfWidth
        );
        expect(Math.abs(offset.along), `${where} — beside, not far ahead / behind`).toBeLessThan(
          60
        );
        expect(Math.hypot(offset.along, offset.lateral), `${where} — with the player`).toBeLessThan(
          120
        );
      }
      const sides = offsets.map((offset) => Math.sign(offset.lateral));
      expect(sides[0], 'slots 0 and 1 on opposite sides').toBe(-sides[1]);
      expect(sides[2], 'slot 2 on the same side as slot 0').toBe(sides[0]);
    }

    it('settles beside the player, slots alternating left / right', () => {
      const flight = formationFlight();
      expectBesideOnAlternatingSides(flight.player, flight.friendlies);
    });

    it('stays out of the chase-camera corridor through turns, and is back beside after them', () => {
      const flight = formationFlight();
      flight.leg(4, Math.PI / 8); // 右转 90°
      flight.leg(8, 0);
      flight.leg(3, -Math.PI / 4); // 左转 135°
      flight.leg(8, 0);
      flight.leg(2, Math.PI / 8); // S 形
      flight.leg(2, -Math.PI / 8);
      flight.leg(10, 0);

      expect(flight.corridorHits, 'never inside the camera corridor').toEqual([]);
      expectBesideOnAlternatingSides(flight.player, flight.friendlies);
    });

    it('does not fire while idle in formation', () => {
      const fired = vi.fn();
      EventBus.on(GameEventType.FRIENDLY_FIRED, fired);
      const flight = formationFlight();
      flight.leg(8, Math.PI / 8);
      expect(fired).not.toHaveBeenCalled();
    });
  });

  describe('engaging', () => {
    it('chases and fires at a target when one exists (e.g. a boss part)', () => {
      const fired: Array<{ position: THREE.Vector3; direction: THREE.Vector3 }> = [];
      EventBus.on(GameEventType.FRIENDLY_FIRED, (event) => {
        fired.push({
          position: event.payload.position.clone(),
          direction: event.payload.direction.clone(),
        });
      });
      const player: PlayerTrack = { position: new THREE.Vector3(0, 120, 0), heading: 0 };
      const friendly = spawnFriendly(new THREE.Vector3(40, 125, 0));
      const target = new THREE.Object3D();
      target.position.set(400, 140, -500);
      scene.add(target);
      target.updateMatrixWorld();
      const startDistance = friendly.getMesh().position.distanceTo(target.position);

      let closest = startDistance;
      flyPlayer(
        player,
        20,
        0,
        () => {
          closest = Math.min(closest, friendly.getMesh().position.distanceTo(target.position));
        },
        [target]
      );

      expect(closest, 'closes on the target').toBeLessThan(startDistance * 0.5);
      expect(fired.length, 'opens fire').toBeGreaterThan(0);
      const shot = fired[0];
      const toTarget = target.position.clone().sub(shot.position).normalize();
      expect(
        shot.direction.clone().normalize().dot(toTarget),
        'fires toward the target'
      ).toBeGreaterThan(0.5);
    });

    it('engages a live enemy jet instead of holding formation', () => {
      const fired = vi.fn();
      EventBus.on(GameEventType.FRIENDLY_FIRED, fired);
      const player: PlayerTrack = { position: new THREE.Vector3(0, 120, 0), heading: 0 };
      const friendly = spawnFriendly(new THREE.Vector3(-40, 125, 0));
      enemySystem.spawnEnemyAt(EnemyType.HEAVY, new THREE.Vector3(-150, 130, -350));
      const enemy = enemySystem.getEnemies()[0];
      expect(enemy?.isAlive()).toBe(true);

      let closest = Infinity;
      flyPlayer(player, 20, 0, () => {
        if (enemy.isAlive()) {
          closest = Math.min(
            closest,
            friendly.getMesh().position.distanceTo(enemy.getMesh().position)
          );
        }
      });

      expect(closest, 'closes on the enemy').toBeLessThan(150);
      expect(fired).toHaveBeenCalled();
    });
  });

  describe('spawn pose (EnemySystem.getFriendlySpawnPose, wave 2)', () => {
    const HEADINGS = [0, 0.7, Math.PI / 2, 2.5, -1.2, Math.PI];

    function forwardOf(heading: number, pitch = 0): THREE.Vector3 {
      return new THREE.Vector3(
        -Math.sin(heading) * Math.cos(pitch),
        Math.sin(pitch),
        -Math.cos(heading) * Math.cos(pitch)
      );
    }

    function pose(
      player: THREE.Vector3,
      forward: THREE.Vector3
    ): { position: THREE.Vector3; heading: THREE.Vector3 } {
      const position = new THREE.Vector3();
      const heading = new THREE.Vector3();
      enemySystem.getFriendlySpawnPose(player, forward, position, heading);
      return { position, heading };
    }

    it.each(HEADINGS)(
      'heading %s rad: well out to the side, alternating with the slots, outside the corridor',
      (heading) => {
        const player: PlayerTrack = { position: new THREE.Vector3(120, 140, -60), heading };
        const sides: number[] = [];
        for (let slot = 0; slot < 4; slot++) {
          const spawned = pose(player.position, forwardOf(heading));
          const offset = relative(player, spawned.position);
          expect(Math.abs(offset.lateral), `slot ${slot}`).toBeGreaterThanOrEqual(35);
          expect(insideCorridor(offset), `slot ${slot}`).toBe(false);
          expect(spawned.position.distanceTo(player.position), `slot ${slot}`).toBeLessThan(150);
          sides.push(Math.sign(offset.lateral));
          // 下一架用下一个编队位
          const friendly = spawnFriendly(spawned.position);
          expect(friendly.getFormationSlot()).toBe(slot);
        }
        expect(sides[1]).toBe(-sides[0]);
        expect(sides[2]).toBe(sides[0]);
        expect(sides[3]).toBe(sides[1]);
      }
    );

    it.each(HEADINGS)("heading %s rad: faces the player's horizontal heading", (heading) => {
      const spawned = pose(new THREE.Vector3(0, 100, 0), forwardOf(heading));
      expect(spawned.heading.y).toBe(0);
      expect(spawned.heading.length()).toBeCloseTo(1, 6);
      expect(spawned.heading.dot(forwardOf(heading))).toBeGreaterThan(0.999);
    });

    it('uses the horizontal heading of a climbing or diving player', () => {
      for (const pitch of [0.6, -0.9]) {
        const spawned = pose(new THREE.Vector3(0, 300, 0), forwardOf(1.1, pitch));
        expect(spawned.heading.y).toBe(0);
        expect(spawned.heading.dot(forwardOf(1.1))).toBeGreaterThan(0.999);
      }
    });

    it('stays finite for a vertical or degenerate player forward', () => {
      for (const forward of [new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0)]) {
        const spawned = pose(new THREE.Vector3(10, 200, 10), forward);
        for (const value of [...spawned.position.toArray(), ...spawned.heading.toArray()]) {
          expect(Number.isFinite(value)).toBe(true);
        }
        expect(spawned.heading.length()).toBeCloseTo(1, 6);
      }
    });

    it('a friendly placed at its spawn pose settles on that side without crossing the corridor', () => {
      const player: PlayerTrack = { position: new THREE.Vector3(0, 120, 0), heading: 0 };
      const friendlies: FriendlyAI[] = [];
      const spawnSides: number[] = [];
      for (let i = 0; i < 2; i++) {
        const spawned = pose(player.position, forwardOf(player.heading));
        spawnSides.push(Math.sign(relative(player, spawned.position).lateral));
        friendlies.push(spawnFriendly(spawned.position));
      }
      const hits: string[] = [];
      flyPlayer(player, 10, 0, (time) => {
        friendlies.forEach((friendly, index) => {
          const offset = relative(player, friendly.getMesh().position);
          if (insideCorridor(offset)) hits.push(`#${index} at ${time.toFixed(2)} s`);
        });
      });
      expect(hits).toEqual([]);
      friendlies.forEach((friendly, index) => {
        const offset = relative(player, friendly.getMesh().position);
        expect(Math.sign(offset.lateral), `friendly ${index}`).toBe(spawnSides[index]);
      });
    });
  });

  describe('getFormationSlotOffset: one source for the slot layout (polish batch P)', () => {
    function offset(slot: number): FormationSlotOffset {
      return getFormationSlotOffset(slot, { side: 0, along: 0, lateral: 0, up: 0 });
    }

    it('writes into and returns the object it is given', () => {
      const out: FormationSlotOffset = { side: 0, along: 0, lateral: 0, up: 0 };
      expect(getFormationSlotOffset(3, out)).toBe(out);
    });

    it('alternates sides, keeps well out to the side and moves each rank further out', () => {
      for (let slot = 0; slot < 6; slot++) {
        const slotOffset = offset(slot);
        expect(slotOffset.side, `slot ${slot}`).toBe(slot % 2 === 0 ? -1 : 1);
        expect(Math.sign(slotOffset.lateral), `slot ${slot}`).toBe(slotOffset.side);
        expect(Math.abs(slotOffset.lateral), `slot ${slot}`).toBeGreaterThanOrEqual(35);
        if (slot >= 2) {
          expect(Math.abs(slotOffset.lateral), `slot ${slot} vs ${slot - 2}`).toBeGreaterThan(
            Math.abs(offset(slot - 2).lateral)
          );
        }
      }
    });

    it.each([-1, 1.5, Number.NaN])('treats slot %s as slot 0', (slot) => {
      expect(offset(slot)).toEqual(offset(0));
    });

    it("EnemySystem's spawn pose uses the same slot layout", () => {
      const player = new THREE.Vector3(30, 140, -10);
      const forward = new THREE.Vector3(-Math.sin(0.9), 0, -Math.cos(0.9));
      const track: PlayerTrack = { position: player, heading: 0.9 };
      for (let slot = 0; slot < 6; slot++) {
        const position = new THREE.Vector3();
        enemySystem.getFriendlySpawnPose(player, forward, position, new THREE.Vector3());
        const expected = offset(slot);
        const spawned = relative(track, position);
        expect(spawned.lateral, `slot ${slot}`).toBeCloseTo(expected.lateral, 6);
        expect(position.y - player.y, `slot ${slot}`).toBeCloseTo(expected.up, 6);
        expect(spawned.along, `slot ${slot}: at or behind the slot`).toBeLessThanOrEqual(
          expected.along + 1e-6
        );
        expect(spawnFriendly(position).getFormationSlot()).toBe(slot);
      }
    });

    it('an idle friendly settles on its getFormationSlotOffset slot', () => {
      const player: PlayerTrack = { position: new THREE.Vector3(0, 120, 0), heading: 0 };
      const friendlies = [0, 1, 2].map(() => {
        const position = new THREE.Vector3();
        enemySystem.getFriendlySpawnPose(
          player.position,
          new THREE.Vector3(0, 0, -1),
          position,
          new THREE.Vector3()
        );
        return spawnFriendly(position);
      });
      flyPlayer(player, 25, 0);
      friendlies.forEach((friendly, slot) => {
        const expected = offset(slot);
        const settled = relative(player, friendly.getMesh().position);
        expect(Math.abs(settled.lateral - expected.lateral), `slot ${slot} lateral`).toBeLessThan(
          6
        );
        expect(Math.abs(settled.along - expected.along), `slot ${slot} along`).toBeLessThan(8);
        const height = friendly.getMesh().position.y - player.position.y;
        expect(Math.abs(height - expected.up), `slot ${slot} height`).toBeLessThan(6);
      });
    });
  });
});
