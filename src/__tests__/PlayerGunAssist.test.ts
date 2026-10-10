import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventBus, GameEventType } from '@/core/EventBus';
import { PlayerSystem } from '@/core/systems/PlayerSystem';
import { GunLeadSolver } from '@/features/combat/GunLeadSolver';
import { PlayerStats } from '@/features/upgrade/UpgradeSystem';

/**
 * 机炮与触屏辅助（C3，PlayerSystem 一侧）：子弹沿交给它的辅助方向离膛；散布随辅助强度收窄
 * （全角 3° → 1.2°）。只看 PLAYER_FIRED 事件里的发射位置与方向。
 *
 * 散布是 Math.random 抽出来的：把它固定在 0.5（没有散布）看方向，固定在两端看散布的宽度。
 */

// 飞控换成只报位姿的替身：机体停在测试摆好的位置和姿态上
vi.mock('@/features/player/PlayerController', () => ({
  PlayerController: class {
    private readonly aircraft: THREE.Group;

    constructor(aircraft: THREE.Group) {
      this.aircraft = aircraft;
    }

    getPosition(): THREE.Vector3 {
      return this.aircraft.position.clone();
    }

    getQuaternion(): THREE.Quaternion {
      return this.aircraft.quaternion.clone();
    }

    getSpeed(): number {
      return 0;
    }

    update(): void {}

    dispose(): void {}
  },
}));

const UNASSISTED_HALF_SPREAD = 1.5;
const ASSISTED_HALF_SPREAD = 0.6;
/** Math.random 的两端与正中 */
const RANDOM_LOW = 0;
const RANDOM_HIGH = 1 - 1e-12;
const RANDOM_CENTRE = 0.5;

const toDeg = THREE.MathUtils.radToDeg;
const rad = THREE.MathUtils.degToRad;

interface Shot {
  position: THREE.Vector3;
  direction: THREE.Vector3;
}

interface Gun {
  system: PlayerSystem;
  stats: PlayerStats;
  mesh: THREE.Group;
  nose: THREE.Vector3;
  /** 冷却转好后开一枪（Math.random 固定为 random） */
  shoot: (random?: number) => Shot;
}

function angleBetween(a: THREE.Vector3, b: THREE.Vector3): number {
  return Math.atan2(a.clone().cross(b).length(), a.dot(b));
}

function levelAttitude(): THREE.Quaternion {
  return new THREE.Quaternion();
}

function bankedAttitude(): THREE.Quaternion {
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(rad(8), rad(-40), rad(30), 'YXZ'));
}

/** 机头方向在水平面内向右偏 degrees 度（平飞时用） */
function yawedRight(direction: THREE.Vector3, degrees: number): THREE.Vector3 {
  return direction.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -rad(degrees));
}

describe('player gun with aim assist', () => {
  let scene: THREE.Scene;
  let random: ReturnType<typeof vi.spyOn>;
  let shots: Shot[];

  beforeEach(() => {
    EventBus.clear();
    scene = new THREE.Scene();
    shots = [];
    random = vi.spyOn(Math, 'random').mockReturnValue(RANDOM_CENTRE);
    EventBus.on(GameEventType.PLAYER_FIRED, (event) => {
      shots.push({
        position: event.payload.position.clone(),
        direction: event.payload.direction.clone(),
      });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    EventBus.clear();
  });

  function createGun(
    attitude: THREE.Quaternion = levelAttitude(),
    position: THREE.Vector3 = new THREE.Vector3(120, 400, -60)
  ): Gun {
    const mesh = new THREE.Group();
    mesh.position.copy(position);
    mesh.quaternion.copy(attitude);
    const stats = new PlayerStats();
    const system = new PlayerSystem(scene, mesh, stats);
    system.init();
    const nose = new THREE.Vector3(0, 0, -1).applyQuaternion(attitude);
    const shoot = (value = RANDOM_CENTRE): Shot => {
      random.mockReturnValue(value);
      // 等冷却转好
      system.update(1);
      expect(system.canFire(), 'the gun should be ready to fire').toBe(true);
      const before = shots.length;
      system.fire();
      expect(shots.length, 'one shot per trigger pull').toBe(before + 1);
      return shots[shots.length - 1];
    };
    return { system, stats, mesh, nose, shoot };
  }

  /** 散布的半角（度）：两端的弹道与不带散布的弹道之间的夹角 */
  function halfSpread(gun: Gun): { low: number; high: number } {
    const centre = gun.shoot(RANDOM_CENTRE).direction;
    const low = gun.shoot(RANDOM_LOW).direction;
    const high = gun.shoot(RANDOM_HIGH).direction;
    return { low: toDeg(angleBetween(low, centre)), high: toDeg(angleBetween(high, centre)) };
  }

  describe('direction of the shot', () => {
    it.each([
      ['level', levelAttitude],
      ['banked', bankedAttitude],
    ])('leaves along the nose with no assist (%s)', (_name, attitude) => {
      const gun = createGun(attitude());

      const shot = gun.shoot();

      expect(angleBetween(shot.direction, gun.nose)).toBeLessThan(1e-9);
    });

    it.each([
      ['level', levelAttitude],
      ['banked', bankedAttitude],
    ])('leaves along the assisted direction it was given (%s)', (_name, attitude) => {
      const gun = createGun(attitude());
      const assisted = new THREE.Vector3(Math.tan(rad(2)), Math.tan(rad(-1.2)), -1)
        .normalize()
        .applyQuaternion(gun.mesh.quaternion);

      gun.system.setGunAimAssist(assisted.clone(), 1);
      const shot = gun.shoot();

      expect(toDeg(angleBetween(assisted, gun.nose))).toBeGreaterThan(2);
      expect(angleBetween(shot.direction, assisted)).toBeLessThan(1e-9);
    });

    it('leaves along it whatever the assist strength', () => {
      const gun = createGun();
      const assisted = yawedRight(gun.nose, 1.8);

      for (const weight of [0, 0.3, 1]) {
        gun.system.setGunAimAssist(assisted.clone(), weight);
        expect(angleBetween(gun.shoot().direction, assisted), `strength ${weight}`).toBeLessThan(
          1e-9
        );
      }
    });

    it('sends out a unit direction even if the assisted direction is not normalised', () => {
      const gun = createGun();
      const assisted = yawedRight(gun.nose, 2);

      gun.system.setGunAimAssist(assisted.clone().multiplyScalar(3), 1);
      const shot = gun.shoot();

      expect(shot.direction.length()).toBeCloseTo(1, 9);
      expect(angleBetween(shot.direction, assisted)).toBeLessThan(1e-9);
    });

    it('goes back to the nose when the assist is cleared', () => {
      const gun = createGun();
      gun.system.setGunAimAssist(yawedRight(gun.nose, 2), 1);
      expect(toDeg(angleBetween(gun.shoot().direction, gun.nose))).toBeGreaterThan(1.9);

      gun.system.setGunAimAssist(null);

      expect(angleBetween(gun.shoot().direction, gun.nose)).toBeLessThan(1e-9);
    });

    it.each([
      ['NaN', new THREE.Vector3(Number.NaN, 0, -1)],
      ['Infinity', new THREE.Vector3(0, Number.POSITIVE_INFINITY, -1)],
      ['a zero vector', new THREE.Vector3(0, 0, 0)],
    ])('falls back to the nose for a direction that is %s', (_name, direction) => {
      const gun = createGun(bankedAttitude());

      gun.system.setGunAimAssist(direction, 1);
      const shot = gun.shoot();

      expect(
        Number.isFinite(shot.direction.x + shot.direction.y + shot.direction.z),
        `direction ${shot.direction.x}, ${shot.direction.y}, ${shot.direction.z}`
      ).toBe(true);
      expect(angleBetween(shot.direction, gun.nose)).toBeLessThan(1e-9);
    });

    it('does not move the muzzle: the shot starts where an unassisted one does', () => {
      const gun = createGun(bankedAttitude());
      const plain = gun.shoot();

      gun.system.setGunAimAssist(yawedRight(gun.nose, 2.5), 1);
      const assisted = gun.shoot();

      expect(assisted.position.distanceTo(plain.position)).toBeLessThan(1e-9);
      // 炮口在机体前方，不在机体中心
      expect(plain.position.clone().sub(gun.mesh.position).dot(gun.nose)).toBeGreaterThan(0);
    });

    it('fires at the same rate with or without assist', () => {
      const plain = createGun();
      const assisted = createGun();
      assisted.system.setGunAimAssist(yawedRight(assisted.nose, 2), 1);

      for (const gun of [plain, assisted]) {
        gun.system.update(1);
        gun.system.fire();
        expect(gun.system.canFire()).toBe(false);
      }
      let plainReadyAfter = 0;
      let assistedReadyAfter = 0;
      for (let i = 1; i <= 120 && (!plainReadyAfter || !assistedReadyAfter); i += 1) {
        plain.system.update(1 / 60);
        assisted.system.update(1 / 60);
        if (!plainReadyAfter && plain.system.canFire()) plainReadyAfter = i;
        if (!assistedReadyAfter && assisted.system.canFire()) assistedReadyAfter = i;
      }
      expect(plainReadyAfter).toBeGreaterThan(0);
      expect(assistedReadyAfter).toBe(plainReadyAfter);
    });
  });

  describe('with the lead solver', () => {
    const DT = 1 / 60;

    /** 像协调器那样接线：炮口 = 机体前方的发射点，辅助方向与强度每步交给 PlayerSystem */
    function aimAt(gun: Gun, target: THREE.Object3D, steps = 90): GunLeadSolver {
      const muzzle = gun.shoot().position;
      const solver = new GunLeadSolver();
      for (let i = 0; i < steps; i += 1) {
        solver.update(DT, muzzle, gun.nose, [target], 1, true);
        gun.system.setGunAimAssist(solver.getAssistDirection(), solver.getAssistWeight());
      }
      return solver;
    }

    function targetOffNose(gun: Gun, degrees: number, range: number): THREE.Object3D {
      const muzzle = gun.shoot().position;
      const target = new THREE.Object3D();
      target.position
        .set(Math.sin(rad(degrees)), 0, -Math.cos(rad(degrees)))
        .multiplyScalar(range)
        .applyQuaternion(gun.mesh.quaternion)
        .add(muzzle);
      return target;
    }

    /** 子弹弹道（从 shot.position 沿 shot.direction 的射线）离 point 最近多少米 */
    function missDistance(shot: Shot, point: THREE.Vector3): number {
      const toPoint = point.clone().sub(shot.position);
      const along = Math.max(0, toPoint.dot(shot.direction));
      return toPoint.addScaledVector(shot.direction, -along).length();
    }

    it.each([
      ['level', levelAttitude],
      ['banked', bankedAttitude],
    ])('puts the bullet through a target 2° off the nose (%s)', (_name, attitude) => {
      const gun = createGun(attitude());
      const target = targetOffNose(gun, 2, 300);
      aimAt(gun, target);

      const shot = gun.shoot();

      expect(missDistance(shot, target.position)).toBeLessThan(0.01);
      // 不辅助的话差着十米
      expect(
        missDistance({ position: shot.position, direction: gun.nose }, target.position)
      ).toBeGreaterThan(9);
    });

    it('sends the bullet exactly where the gun cross is shown (render direction at alpha 1)', () => {
      const gun = createGun(bankedAttitude());
      const target = targetOffNose(gun, 3.6, 260);
      const solver = aimAt(gun, target);

      const shot = gun.shoot();

      const cross = solver.getRenderAssistDirection(gun.mesh.quaternion, 1);
      expect(cross, 'the cross should be shifted in the fade zone').not.toBeNull();
      expect(toDeg(angleBetween(cross as THREE.Vector3, gun.nose))).toBeGreaterThan(0.3);
      expect(angleBetween(shot.direction, cross as THREE.Vector3)).toBeLessThan(1e-9);
    });

    it('keeps cross and bullet together while the assist is still sliding in', () => {
      const gun = createGun();
      const target = targetOffNose(gun, 2, 300);
      const muzzle = gun.shoot().position;
      const solver = new GunLeadSolver();

      let compared = 0;
      for (let i = 0; i < 20; i += 1) {
        solver.update(DT, muzzle, gun.nose, [target], 1, true);
        gun.system.setGunAimAssist(solver.getAssistDirection(), solver.getAssistWeight());
        const shot = gun.shoot();
        const cross = solver.getRenderAssistDirection(gun.mesh.quaternion, 1) ?? gun.nose;
        expect(angleBetween(shot.direction, cross), `step ${i}`).toBeLessThan(1e-9);
        if (toDeg(angleBetween(cross, gun.nose)) > 0.05) compared += 1;
      }
      expect(compared).toBeGreaterThan(5);
    });

    it('tightens the spread to 1.2° on a target it is fully pulled onto', () => {
      const gun = createGun();
      aimAt(gun, targetOffNose(gun, 1.5, 300));

      const { low, high } = halfSpread(gun);

      expect(low).toBeCloseTo(ASSISTED_HALF_SPREAD, 3);
      expect(high).toBeCloseTo(ASSISTED_HALF_SPREAD, 3);
    });

    it('leaves the spread at 3° with nothing to assist on', () => {
      const gun = createGun();
      aimAt(gun, targetOffNose(gun, 20, 300));

      const { low, high } = halfSpread(gun);

      expect(low).toBeCloseTo(UNASSISTED_HALF_SPREAD, 6);
      expect(high).toBeCloseTo(UNASSISTED_HALF_SPREAD, 6);
    });

    it('gives a spread in between while the assist fades (3.75° off the nose)', () => {
      const gun = createGun();
      aimAt(gun, targetOffNose(gun, 3.75, 300));

      const { low } = halfSpread(gun);

      expect(low).toBeGreaterThan(ASSISTED_HALF_SPREAD + 0.05);
      expect(low).toBeLessThan(UNASSISTED_HALF_SPREAD - 0.05);
    });
  });

  describe('spread', () => {
    it('is 3° wide with no assist: up to 1.5° either side of the nose', () => {
      const gun = createGun();

      const { low, high } = halfSpread(gun);

      expect(low).toBeCloseTo(UNASSISTED_HALF_SPREAD, 6);
      expect(high).toBeCloseTo(UNASSISTED_HALF_SPREAD, 6);
    });

    it('is 1.2° wide at full assist: up to 0.6° either side of the assisted direction', () => {
      const gun = createGun();
      gun.system.setGunAimAssist(yawedRight(gun.nose, 2), 1);

      const { low, high } = halfSpread(gun);

      expect(low).toBeCloseTo(ASSISTED_HALF_SPREAD, 6);
      expect(high).toBeCloseTo(ASSISTED_HALF_SPREAD, 6);
    });

    it('is centred on the assisted direction, with shots on both sides of it', () => {
      const gun = createGun();
      const assisted = yawedRight(gun.nose, 2);
      gun.system.setGunAimAssist(assisted.clone(), 1);

      const low = gun.shoot(RANDOM_LOW).direction;
      const high = gun.shoot(RANDOM_HIGH).direction;

      const middle = low.clone().add(high).normalize();
      expect(angleBetween(middle, assisted)).toBeLessThan(1e-9);
      expect(toDeg(angleBetween(low, high))).toBeCloseTo(2 * ASSISTED_HALF_SPREAD, 6);
    });

    it('narrows steadily as the assist gets stronger', () => {
      const weights = [0, 0.25, 0.5, 0.75, 1];
      const widths = weights.map((weight) => {
        const gun = createGun();
        gun.system.setGunAimAssist(yawedRight(gun.nose, 2), weight);
        return halfSpread(gun).high;
      });

      expect(widths[0]).toBeCloseTo(UNASSISTED_HALF_SPREAD, 6);
      expect(widths[widths.length - 1]).toBeCloseTo(ASSISTED_HALF_SPREAD, 6);
      for (let i = 1; i < widths.length; i += 1) {
        expect(widths[i], `strength ${weights[i]}`).toBeLessThan(widths[i - 1]);
      }
    });

    it('keeps every shot inside the cone, and uses all of it', () => {
      for (const [weight, half] of [
        [0, UNASSISTED_HALF_SPREAD],
        [1, ASSISTED_HALF_SPREAD],
      ]) {
        const gun = createGun();
        const assisted = yawedRight(gun.nose, 1.5);
        gun.system.setGunAimAssist(assisted.clone(), weight);

        let widest = 0;
        let leftOfCentre = 0;
        let rightOfCentre = 0;
        for (let i = 0; i < 100; i += 1) {
          const direction = gun.shoot(i / 100).direction;
          const off = toDeg(angleBetween(direction, assisted));
          expect(off, `strength ${weight}, shot ${i}`).toBeLessThanOrEqual(half + 1e-6);
          widest = Math.max(widest, off);
          const side = assisted.clone().cross(direction).y;
          if (side > 1e-9) leftOfCentre += 1;
          if (side < -1e-9) rightOfCentre += 1;
        }
        expect(widest, `strength ${weight}`).toBeGreaterThan(half * 0.95);
        expect(leftOfCentre, `strength ${weight}`).toBeGreaterThan(30);
        expect(rightOfCentre, `strength ${weight}`).toBeGreaterThan(30);
      }
    });

    it.each([7, 1.0001])('treats a strength of %s as full assist', (weight) => {
      const gun = createGun();
      gun.system.setGunAimAssist(yawedRight(gun.nose, 2), weight);

      expect(halfSpread(gun).high).toBeCloseTo(ASSISTED_HALF_SPREAD, 6);
    });

    it.each([-3, -0.0001])('treats a strength of %s as no assist', (weight) => {
      const gun = createGun();
      gun.system.setGunAimAssist(yawedRight(gun.nose, 2), weight);

      expect(halfSpread(gun).high).toBeCloseTo(UNASSISTED_HALF_SPREAD, 6);
    });

    it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
      'never narrows or widens beyond the two limits for a strength of %s',
      (weight) => {
        const gun = createGun();
        gun.system.setGunAimAssist(yawedRight(gun.nose, 2), weight);

        const { low, high } = halfSpread(gun);

        for (const half of [low, high]) {
          expect(half).toBeGreaterThanOrEqual(ASSISTED_HALF_SPREAD - 1e-6);
          expect(half).toBeLessThanOrEqual(UNASSISTED_HALF_SPREAD + 1e-6);
        }
      }
    );

    it('is the unassisted 3° when a strength comes without a direction', () => {
      const gun = createGun();
      gun.system.setGunAimAssist(null, 1);

      expect(halfSpread(gun).high).toBeCloseTo(UNASSISTED_HALF_SPREAD, 6);
    });

    it('is the unassisted 3° when the direction cannot be used', () => {
      const gun = createGun();
      gun.system.setGunAimAssist(new THREE.Vector3(Number.NaN, 0, -1), 1);

      expect(halfSpread(gun).high).toBeCloseTo(UNASSISTED_HALF_SPREAD, 6);
    });

    it('returns to 3° once the assist is cleared', () => {
      const gun = createGun();
      gun.system.setGunAimAssist(yawedRight(gun.nose, 2), 1);
      expect(halfSpread(gun).high).toBeCloseTo(ASSISTED_HALF_SPREAD, 6);

      gun.system.setGunAimAssist(null);

      expect(halfSpread(gun).high).toBeCloseTo(UNASSISTED_HALF_SPREAD, 6);
    });

    it('still adds the rapid-fire power-up’s own spread on top, assisted or not', () => {
      const plain = createGun();
      const assisted = createGun();
      assisted.system.setGunAimAssist(yawedRight(assisted.nose, 2), 1);
      const plainBefore = halfSpread(plain).high;
      const assistedBefore = halfSpread(assisted).high;

      plain.stats.setRapidFire(3, 30);
      assisted.stats.setRapidFire(3, 30);
      const plainRapid = halfSpread(plain).high;
      const assistedRapid = halfSpread(assisted).high;

      expect(plainRapid).toBeGreaterThan(plainBefore + 1);
      expect(assistedRapid).toBeGreaterThan(assistedBefore + 1);
      // 辅助收窄的那一截还在
      expect(assistedRapid).toBeLessThan(plainRapid - 0.5);
    });
  });
});
