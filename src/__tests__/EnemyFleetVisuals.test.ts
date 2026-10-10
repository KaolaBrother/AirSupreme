import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { EventBus, GameEventType } from '@/core/EventBus';
import { Faction } from '@/core/Faction';
import { GameSessionState } from '@/core/GameSessionState';
import { CombatSystem } from '@/core/systems/CombatSystem';
import { EnemySystem } from '@/core/systems/EnemySystem';
import { ContrailController } from '@/core/vfx/ContrailController';
import {
  createEnemyMesh,
  createFriendlyMesh,
  createPlayerMesh,
} from '@/features/aircraft/AircraftMeshFactory';
import { ParticleSystem } from '@/features/effects/ParticleSystem';
import { ParticleTrailRenderer } from '@/features/effects/ParticleTrailRenderer';
import { ENEMY_CONFIGS, EnemyType } from '@/features/enemy/EnemyTypes';
import { FriendlyAI, WINGMAN_CONFIG } from '@/features/enemy/FriendlyAI';
import { DT, SPEC } from './enemyFleetRig';

/**
 * 舰队外观（规格 §1），在 jsdom 里能验证的部分：三方阵营的涂装规则（敌机身上没有金色 / 黄色、
 * 没有座舱玻璃、没有红绿航行灯，换成机头的红色传感器“眼”）、网格名、真实大小与命中半径、
 * 僚机自己的机体、阵营尾迹颜色，以及战斗代码确实按 userData.hitRadius 判定命中。
 * “轮廓一眼能分清”这类观感判断不在这里。
 */

const ALL_TYPES = Object.values(EnemyType);

/** 规格 §1 的机体缩放表（命中半径 = 2.5 × 缩放） */
const SPEC_SCALE: Record<EnemyType, number> = {
  [EnemyType.SCOUT]: 1.5,
  [EnemyType.FIGHTER]: 2.0,
  [EnemyType.HEAVY]: 3.0,
  [EnemyType.SNIPER]: 2.1,
  [EnemyType.ACE]: 2.2,
  [EnemyType.JAMMER]: 2.2,
  [EnemyType.STRIKER]: 2.4,
  [EnemyType.WRAITH]: 2.0,
};

const ENEMY_TRAIL = 0xff5a3c;
const WINGMAN_TRAIL = 0x7fd4ff;

function enemyMesh(type: EnemyType): THREE.Group {
  return createEnemyMesh({ ...ENEMY_CONFIGS[type] });
}

function wingmanMesh(type: EnemyType = WINGMAN_CONFIG.type): THREE.Group {
  return createFriendlyMesh({ ...WINGMAN_CONFIG, type });
}

// ---------------------------------------------------------------------------------------------
// 读材质
// ---------------------------------------------------------------------------------------------

interface Paint {
  mesh: THREE.Mesh;
  material: THREE.Material;
  /** 这块材质显示出来的颜色：漫反射色，以及（有强度的）自发光色 */
  colors: THREE.Color[];
  /** 受光照的材质（机体面板）还是自发光 / 不受光的（灯、光晕、火焰） */
  lit: boolean;
  /** 半透明 */
  seeThrough: boolean;
}

function paintsOf(root: THREE.Object3D): Paint[] {
  const paints: Paint[] = [];
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh && !(node instanceof THREE.Sprite) && !(node instanceof THREE.Line)) return;
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of list) {
      if (!material) continue;
      const colors: THREE.Color[] = [];
      const withColor = material as THREE.Material & { color?: THREE.Color };
      if (withColor.color instanceof THREE.Color) colors.push(withColor.color);
      const glowing = material as THREE.Material & {
        emissive?: THREE.Color;
        emissiveIntensity?: number;
      };
      if (
        glowing.emissive instanceof THREE.Color &&
        (glowing.emissiveIntensity ?? 1) > 0 &&
        glowing.emissive.getHex() !== 0
      ) {
        colors.push(glowing.emissive);
      }
      paints.push({
        mesh,
        material,
        colors,
        lit:
          material instanceof THREE.MeshStandardMaterial ||
          material instanceof THREE.MeshPhongMaterial ||
          material instanceof THREE.MeshLambertMaterial,
        seeThrough: material.transparent && material.opacity < 1,
      });
    }
  });
  return paints;
}

function hsl(color: THREE.Color): { h: number; s: number; l: number } {
  const out = { h: 0, s: 0, l: 0 };
  color.getHSL(out, THREE.SRGBColorSpace);
  return { h: out.h * 360, s: out.s, l: out.l };
}

/** 金色 / 黄色：色相 35°–70°，有一定饱和度，不是近黑也不是近白 */
function isGoldOrYellow(color: THREE.Color): boolean {
  const { h, s, l } = hsl(color);
  return h >= 35 && h <= 70 && s >= 0.4 && l >= 0.12 && l <= 0.92;
}

function isGreen(color: THREE.Color): boolean {
  const { h, s, l } = hsl(color);
  return h >= 80 && h <= 170 && s >= 0.4 && l >= 0.15 && l <= 0.92;
}

function isRed(color: THREE.Color): boolean {
  const { h, s } = hsl(color);
  return (h <= 25 || h >= 340) && s >= 0.6;
}

function isViolet(color: THREE.Color): boolean {
  const { h, s } = hsl(color);
  return h >= 250 && h <= 295 && s >= 0.5;
}

function describePaint(paint: Paint): string {
  return `${paint.material.type} #${paint.colors.map((color) => color.getHexString()).join('/#')}${
    paint.mesh.name ? ` (${paint.mesh.name})` : ''
  }`;
}

function goldParts(root: THREE.Object3D): string[] {
  return paintsOf(root)
    .filter((paint) => paint.colors.some(isGoldOrYellow))
    .map(describePaint);
}

/** 座舱玻璃：受光照、半透明的面板 */
function glassParts(root: THREE.Object3D): string[] {
  return paintsOf(root)
    .filter((paint) => paint.lit && paint.seeThrough)
    .map(describePaint);
}

function greenParts(root: THREE.Object3D): string[] {
  return paintsOf(root)
    .filter((paint) => paint.colors.some(isGreen))
    .map(describePaint);
}

function boundsOf(root: THREE.Object3D): THREE.Box3 {
  root.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(root);
}

/**
 * 机头的红色传感器“眼”：一块自己发光（不受光照、不透明）的红色部件，位于机体中线上、
 * 机身前 40% 的位置。敌机机头朝 +Z。
 */
function sensorEyes(root: THREE.Object3D): THREE.Mesh[] {
  const whole = boundsOf(root);
  const size = whole.getSize(new THREE.Vector3());
  const eyes: THREE.Mesh[] = [];
  for (const paint of paintsOf(root)) {
    if (paint.lit || paint.seeThrough || !paint.colors.some(isRed)) continue;
    const centre = new THREE.Box3().setFromObject(paint.mesh).getCenter(new THREE.Vector3());
    const along = (centre.z - whole.min.z) / size.z;
    const across = Math.abs(centre.x) / (size.x / 2);
    if (along > 0.6 && across < 0.1) eyes.push(paint.mesh);
  }
  return eyes;
}

/** 最大的一块受光面板（按包围盒表面积）：机身 / 主翼 */
function biggestPanel(root: THREE.Object3D): { h: number; s: number; l: number } {
  root.updateMatrixWorld(true);
  let best: Paint | null = null;
  let bestArea = -1;
  for (const paint of paintsOf(root)) {
    if (!paint.lit || paint.seeThrough) continue;
    const size = new THREE.Box3().setFromObject(paint.mesh).getSize(new THREE.Vector3());
    const area = size.x * size.y + size.y * size.z + size.x * size.z;
    if (area > bestArea) {
      bestArea = area;
      best = paint;
    }
  }
  if (!best) throw new Error('no lit panel on this airframe');
  return hsl(best.colors[0]);
}

// ---------------------------------------------------------------------------------------------
// 涂装
// ---------------------------------------------------------------------------------------------

describe('enemy livery: three factions read at a glance (spec §1)', () => {
  it('the detectors work: the wingman is gold-trimmed with a glass canopy and red-green lights', () => {
    const wingman = wingmanMesh();
    expect(goldParts(wingman).length, 'gold parts on the wingman').toBeGreaterThan(3);
    expect(glassParts(wingman).length, 'canopy glass on the wingman').toBeGreaterThan(0);
    expect(greenParts(wingman).length, 'green light on the wingman').toBeGreaterThan(0);
    expect(sensorEyes(wingman), 'no drone eye on the wingman').toEqual([]);
    const player = createPlayerMesh();
    expect(glassParts(player).length, 'canopy glass on the player').toBeGreaterThan(0);
    expect(greenParts(player).length, 'green light on the player').toBeGreaterThan(0);
  });

  it.each(ALL_TYPES)('%s carries no gold or yellow anywhere', (type) => {
    expect(goldParts(enemyMesh(type))).toEqual([]);
  });

  it.each(ALL_TYPES)('%s has no canopy glass', (type) => {
    expect(glassParts(enemyMesh(type))).toEqual([]);
  });

  it.each(ALL_TYPES)('%s has a self-lit red sensor eye on the nose instead', (type) => {
    expect(sensorEyes(enemyMesh(type)).length).toBeGreaterThan(0);
  });

  it.each(ALL_TYPES)('%s has no green navigation light', (type) => {
    expect(greenParts(enemyMesh(type))).toEqual([]);
  });

  it.each(ALL_TYPES)(
    '%s: the hull is dark gunmetal / charcoal, darker than the wingman and the player',
    (type) => {
      const hull = biggestPanel(enemyMesh(type));
      expect(hull.l, 'hull lightness').toBeLessThan(0.36);
      expect(hull.s, 'hull saturation (grey, not coloured)').toBeLessThan(0.25);
      expect(hull.l).toBeLessThan(biggestPanel(wingmanMesh()).l - 0.1);
      expect(hull.l).toBeLessThan(biggestPanel(createPlayerMesh()).l - 0.1);
    }
  );

  it.each(ALL_TYPES)(
    '%s: every strong colour on it is red; violet appears on the Jammer only',
    (type) => {
      const strong = paintsOf(enemyMesh(type)).flatMap((paint) =>
        paint.colors
          .filter((color) => {
            const { s, l } = hsl(color);
            // 近黑、近白（白热饰条）与灰色不算“有颜色”
            return s >= 0.5 && l >= 0.2 && l <= 0.9;
          })
          .map((color) => ({ paint, color }))
      );
      expect(strong.length, 'it has red accents / glow').toBeGreaterThan(0);
      const offenders = strong
        .filter(({ color }) => !isRed(color) && !(type === EnemyType.JAMMER && isViolet(color)))
        .map(({ paint }) => describePaint(paint));
      expect(offenders).toEqual([]);
      expect(
        strong.some(({ color }) => isRed(color)),
        'red accent present'
      ).toBe(true);
    }
  );

  it.each(ALL_TYPES)('%s: the engine glow is red, not orange', (type) => {
    const glows = paintsOf(enemyMesh(type)).filter((paint) => paint.mesh.name === 'engineGlow');
    for (const glow of glows) {
      const { h } = hsl(glow.colors[0]);
      expect(h <= 12 || h >= 345, `engine glow hue ${h.toFixed(0)}`).toBe(true);
    }
  });

  it('the wingman keeps its own livery: steel-blue hull, gold accent, canopy', () => {
    const wingman = wingmanMesh();
    const hull = biggestPanel(wingman);
    expect(hull.h, 'hull hue (blue)').toBeGreaterThan(195);
    expect(hull.h).toBeLessThan(235);
    expect(hull.s).toBeGreaterThan(0.2);
    expect(
      paintsOf(wingman).filter((paint) => paint.lit && paint.colors.some(isGoldOrYellow)).length
    ).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------------------------
// 网格名、大小、命中半径
// ---------------------------------------------------------------------------------------------

describe('mesh name, real size and hit radius (spec §1)', () => {
  it.each(ALL_TYPES)('%s: the mesh is named after its type', (type) => {
    expect(enemyMesh(type).name).toBe(type);
  });

  it.each(ALL_TYPES)(
    '%s: the root declares hitRadius = 2.5 x its scale, and the scale is uniform',
    (type) => {
      const mesh = enemyMesh(type);
      expect(mesh.scale.x).toBeCloseTo(mesh.scale.y, 9);
      expect(mesh.scale.x).toBeCloseTo(mesh.scale.z, 9);
      expect(mesh.userData.hitRadius).toBeCloseTo(SPEC.HIT_RADIUS_PER_SCALE * mesh.scale.x, 9);
    }
  );

  it.each(ALL_TYPES.map((type) => [type, SPEC_SCALE[type]] as const))(
    '%s: scale %s as the spec lists it',
    (type, scale) => {
      const mesh = enemyMesh(type);
      expect(mesh.scale.x).toBeCloseTo(scale, 9);
      expect(mesh.userData.hitRadius).toBeCloseTo(2.5 * scale, 9);
    }
  );

  it('size is real: Scout < Fighter < Heavy, by a wide margin', () => {
    const length = (type: EnemyType): number => {
      const size = boundsOf(enemyMesh(type)).getSize(new THREE.Vector3());
      return Math.max(size.x, size.z);
    };
    const scout = length(EnemyType.SCOUT);
    const fighter = length(EnemyType.FIGHTER);
    const heavy = length(EnemyType.HEAVY);
    expect(scout).toBeLessThan(fighter * 0.75);
    expect(heavy).toBeGreaterThan(fighter * 1.4);
    expect(enemyMesh(EnemyType.SCOUT).userData.hitRadius).toBeLessThan(5);
    expect(enemyMesh(EnemyType.HEAVY).userData.hitRadius).toBeGreaterThan(5);
  });

  it('the wingman mesh is named FIGHTER, scale 2.0, hit radius 5', () => {
    const wingman = wingmanMesh();
    expect(wingman.name).toBe('FIGHTER');
    expect(wingman.scale.x).toBeCloseTo(2.0, 9);
    expect(wingman.scale.y).toBeCloseTo(2.0, 9);
    expect(wingman.scale.z).toBeCloseTo(2.0, 9);
    expect(wingman.userData.hitRadius).toBeCloseTo(5, 9);
  });

  it.each(ALL_TYPES)(
    'a wingman built from a %s config is the same allied airframe, not that enemy airframe',
    (type) => {
      const reference = wingmanMesh(EnemyType.FIGHTER);
      const wingman = wingmanMesh(type);
      expect(wingman.name).toBe('FIGHTER');
      expect(wingman.userData.hitRadius).toBeCloseTo(5, 9);
      const count = (root: THREE.Object3D): number => {
        let total = 0;
        root.traverse(() => total++);
        return total;
      };
      expect(count(wingman)).toBe(count(reference));
      const size = boundsOf(wingman).getSize(new THREE.Vector3());
      expect(size.distanceTo(boundsOf(reference).getSize(new THREE.Vector3()))).toBeLessThan(1e-6);
      // 不是敌机机体：有座舱玻璃和金色识别，没有无人机的红眼
      expect(glassParts(wingman).length).toBeGreaterThan(0);
      expect(goldParts(wingman).length).toBeGreaterThan(3);
      expect(sensorEyes(wingman)).toEqual([]);
      const enemySize = boundsOf(enemyMesh(type)).getSize(new THREE.Vector3());
      expect(
        size.distanceTo(enemySize),
        'differs from the enemy airframe of that type'
      ).toBeGreaterThan(0.5);
    }
  );
});

// ---------------------------------------------------------------------------------------------
// 尾迹颜色
// ---------------------------------------------------------------------------------------------

describe('faction trail colours (spec §1)', () => {
  let scene: THREE.Scene;
  let controller: ContrailController | null = null;
  let canvasSpy: MockInstance | null = null;

  beforeEach(() => {
    EventBus.clear();
    scene = new THREE.Scene();
  });

  afterEach(() => {
    controller?.dispose();
    controller = null;
    EventBus.clear();
    // 只还原本文件自己的替身：全局测试设置里的尾迹渲染器替身不能被 restoreAllMocks 清掉
    canvasSpy?.mockRestore();
    canvasSpy = null;
  });

  /**
   * 让几架飞机各自在相距 600 米的航道上高速平飞一秒，返回每条航道上画出来的尾迹带颜色
   * （线性空间 RGB，去重）。读的是尾迹带网格里真正要画的顶点。
   */
  async function ribbonColours(
    aircraft: THREE.Object3D[],
    player?: THREE.Object3D
  ): Promise<THREE.Color[][]> {
    controller = new ContrailController();
    await controller.ensureLoaded(scene, 24);
    const lanes = player ? [player, ...aircraft] : aircraft;
    lanes.forEach((mesh, index) => {
      mesh.position.set(index * 600, 600, 0);
      scene.add(mesh);
    });
    if (player) controller.attachPlayer(player);
    controller.sync(aircraft, 0, true);
    for (let frame = 0; frame < 60; frame++) {
      for (const mesh of lanes) mesh.position.z += 90 * DT;
      controller.update(DT);
    }
    const ribbons = scene.children.find(
      (child): child is THREE.Mesh =>
        child instanceof THREE.Mesh && child.geometry.getAttribute('aColor') !== undefined
    );
    if (!ribbons) throw new Error('no contrail ribbon mesh in the scene');
    const positions = ribbons.geometry.getAttribute('position');
    const params = ribbons.geometry.getAttribute('aParams');
    const colours = ribbons.geometry.getAttribute('aColor');
    const perLane: THREE.Color[][] = lanes.map(() => []);
    for (let v = 0; v < positions.count; v++) {
      // aParams.y 是这个顶点的不透明度：只看真正画出来的
      if (params.getY(v) <= 0.01) continue;
      const lane = Math.round(positions.getX(v) / 600);
      if (lane < 0 || lane >= lanes.length) continue;
      const colour = new THREE.Color(colours.getX(v), colours.getY(v), colours.getZ(v));
      if (!perLane[lane].some((seen) => seen.equals(colour))) perLane[lane].push(colour);
    }
    return perLane;
  }

  function expectColour(actual: THREE.Color[], hex: number, label: string): void {
    expect(actual.length, `${label}: one ribbon colour drawn`).toBe(1);
    const expected = new THREE.Color(hex);
    expect(Math.abs(actual[0].r - expected.r), `${label}: red channel`).toBeLessThan(1e-4);
    expect(Math.abs(actual[0].g - expected.g), `${label}: green channel`).toBeLessThan(1e-4);
    expect(Math.abs(actual[0].b - expected.b), `${label}: blue channel`).toBeLessThan(1e-4);
  }

  it('contrail ribbons: enemy red-orange 0xff5a3c, wingman pale blue 0x7fd4ff, player white', async () => {
    const [player, enemy, wingman] = await ribbonColours(
      [enemyMesh(EnemyType.FIGHTER), wingmanMesh()],
      createPlayerMesh()
    );
    expectColour(enemy, ENEMY_TRAIL, 'enemy');
    expectColour(wingman, WINGMAN_TRAIL, 'wingman');
    expect(player.length, 'player ribbon drawn').toBe(1);
    expect(
      Math.min(player[0].r, player[0].g, player[0].b),
      'player ribbon is white'
    ).toBeGreaterThan(0.85);
  });

  it('every enemy type draws the enemy ribbon colour', async () => {
    const lanes = await ribbonColours(ALL_TYPES.map((type) => enemyMesh(type)));
    ALL_TYPES.forEach((type, index) => expectColour(lanes[index], ENEMY_TRAIL, type));
  });

  it('particle trails: a jet spawned by the enemy system gets the enemy colour, a wingman the allied one', () => {
    const made = vi.mocked(ParticleTrailRenderer);
    made.mockClear();
    const system = new EnemySystem(scene, new GameSessionState());
    system.init();
    try {
      ALL_TYPES.forEach((type, index) => {
        system.spawnEnemyAt(type, new THREE.Vector3(index * 80, 400, 300));
      });
      const jets = system.getEnemies();
      expect(jets.length).toBe(ALL_TYPES.length);
      for (const jet of jets) {
        const call = made.mock.calls.find((args) => args[1] === jet.getMesh());
        expect(call, `${jet.getConfig().type}: a particle trail was made for it`).toBeDefined();
        expect(call?.[2], `${jet.getConfig().type}: trail colour`).toBe(ENEMY_TRAIL);
      }
      const mesh = wingmanMesh();
      const wingman = new FriendlyAI(mesh, { ...WINGMAN_CONFIG }, scene);
      const call = made.mock.calls.find((args) => args[1] === mesh);
      expect(call?.[2], 'wingman trail colour').toBe(WINGMAN_TRAIL);
      wingman.dispose();
    } finally {
      system.dispose();
    }
  });

  it('the jets the enemy system spawns wear the factory mesh: type name and declared hit radius', () => {
    const system = new EnemySystem(scene, new GameSessionState());
    system.init();
    try {
      ALL_TYPES.forEach((type, index) => {
        system.spawnEnemyAt(type, new THREE.Vector3(index * 80, 400, 300));
      });
      for (const jet of system.getEnemies()) {
        const type = jet.getConfig().type;
        expect(jet.getMesh().name).toBe(type);
        expect(jet.getMesh().userData.hitRadius).toBeCloseTo(2.5 * SPEC_SCALE[type], 9);
        expect(goldParts(jet.getMesh())).toEqual([]);
      }
    } finally {
      system.dispose();
    }
  });

  it('the particle trail is drawn in the colour it is given', async () => {
    // 全局测试设置把尾迹渲染器换成了空壳；这里用真的，只给它一个假的 2D 画布
    const gradient = { addColorStop: vi.fn() };
    canvasSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      createRadialGradient: () => gradient,
      fillRect: vi.fn(),
      fillStyle: '',
    } as unknown as CanvasRenderingContext2D);
    const actual = await vi.importActual<typeof import('@/features/effects/ParticleTrailRenderer')>(
      '@/features/effects/ParticleTrailRenderer'
    );
    for (const colour of [ENEMY_TRAIL, WINGMAN_TRAIL]) {
      const local = new THREE.Scene();
      const owner = new THREE.Group();
      const trail = new actual.ParticleTrailRenderer(local, owner, colour);
      for (let frame = 0; frame < 60; frame++) {
        owner.position.z += 1;
        trail.addPoint(owner.position);
        trail.update(DT);
      }
      const sprites = local.children.filter(
        (child): child is THREE.Sprite => child instanceof THREE.Sprite
      );
      expect(sprites.length, 'trail particles in the scene').toBeGreaterThan(2);
      for (const sprite of sprites) expect(sprite.material.color.getHex()).toBe(colour);
      trail.dispose();
    }
  });
});

// ---------------------------------------------------------------------------------------------
// 战斗代码按声明的命中半径判定
// ---------------------------------------------------------------------------------------------

describe('combat honours the declared hit radius (spec §1)', () => {
  let scene: THREE.Scene;
  let particles: ParticleSystem;
  let combat: CombatSystem;
  let playerMesh: THREE.Group;

  beforeEach(() => {
    EventBus.clear();
    scene = new THREE.Scene();
    particles = new ParticleSystem(scene);
    playerMesh = new THREE.Group();
    playerMesh.position.set(0, -5000, 0);
    scene.add(playerMesh);
    combat = new CombatSystem(scene, particles, playerMesh);
    combat.init();
  });

  afterEach(() => {
    combat.dispose();
    particles.dispose();
    EventBus.clear();
  });

  /** 玩家机炮的一发子弹从目标旁边 lateral 米处飞过；返回它有没有打中 */
  function playerBulletHits(target: THREE.Object3D, lateral: number): boolean {
    target.position.set(0, 300, 0);
    scene.add(target);
    target.updateMatrixWorld(true);
    EventBus.emit(GameEventType.PLAYER_FIRED, {
      position: new THREE.Vector3(lateral, 300, -60),
      direction: new THREE.Vector3(0, 0, 1),
      damage: 10,
    });
    let hit = false;
    for (let step = 0; step < 90; step++) {
      combat.update(DT);
      combat.checkProjectileCollisions(
        [target],
        [],
        () => {
          hit = true;
        },
        () => undefined,
        () => undefined
      );
    }
    combat.getPlayerProjectilePool().clear();
    scene.remove(target);
    return hit;
  }

  it.each(ALL_TYPES)(
    '%s: a player round passing inside its hit radius hits, one passing outside misses',
    (type) => {
      const radius = 2.5 * SPEC_SCALE[type];
      expect(
        playerBulletHits(enemyMesh(type), radius * 0.85),
        `pass at ${(radius * 0.85).toFixed(2)} m`
      ).toBe(true);
      expect(
        playerBulletHits(enemyMesh(type), radius * 1.15),
        `pass at ${(radius * 1.15).toFixed(2)} m`
      ).toBe(false);
    }
  );

  it('the same pass hits a big jet and misses a small one', () => {
    // 4.5 米：侦察机（3.75）打不中，战斗机（5）打得中
    expect(playerBulletHits(enemyMesh(EnemyType.SCOUT), 4.5)).toBe(false);
    expect(playerBulletHits(enemyMesh(EnemyType.FIGHTER), 4.5)).toBe(true);
    // 6.5 米：战斗机打不中，重型机（7.5）打得中
    expect(playerBulletHits(enemyMesh(EnemyType.FIGHTER), 6.5)).toBe(false);
    expect(playerBulletHits(enemyMesh(EnemyType.HEAVY), 6.5)).toBe(true);
  });

  it('a target that declares no radius keeps the old 5 m', () => {
    expect(playerBulletHits(new THREE.Group(), 4.5)).toBe(true);
    expect(playerBulletHits(new THREE.Group(), 5.6)).toBe(false);
  });

  it('enemy fire against a wingman uses the wingman mesh radius of 5 m', () => {
    const passes = (lateral: number): boolean => {
      const wingman = wingmanMesh();
      wingman.position.set(0, 300, 0);
      scene.add(wingman);
      wingman.updateMatrixWorld(true);
      EventBus.emit(GameEventType.ENEMY_FIRED, {
        position: new THREE.Vector3(lateral, 300, -60),
        direction: new THREE.Vector3(0, 0, 1),
        damage: 10,
        faction: Faction.ENEMY,
      });
      let hit = false;
      for (let step = 0; step < 90; step++) {
        combat.update(DT);
        combat.checkProjectileCollisions(
          [],
          [wingman],
          () => undefined,
          () => undefined,
          () => {
            hit = true;
          }
        );
      }
      combat.getEnemyProjectilePool().clear();
      scene.remove(wingman);
      return hit;
    };
    expect(passes(4.3)).toBe(true);
    expect(passes(5.8)).toBe(false);
  });

  it.each([
    [EnemyType.SCOUT, 4.4, false],
    [EnemyType.SCOUT, 3.2, true],
    [EnemyType.FIGHTER, 4.4, true],
    [EnemyType.FIGHTER, 5.6, false],
    [EnemyType.HEAVY, 7.0, true],
    [EnemyType.HEAVY, 8.2, false],
  ] as const)(
    'a player missile %s: %s m from its centre -> detonates: %s',
    (type, distance, expected) => {
      const target = enemyMesh(type);
      target.position.set(0, 300, 0);
      scene.add(target);
      target.updateMatrixWorld(true);
      const launch = target.position.clone().add(new THREE.Vector3(distance, 0, 0));
      // 朝远离目标的方向发射：只看发射这一刻离目标的距离
      combat.getMissileSystem().fire(launch, new THREE.Vector3(1, 0, 0), target);
      let hit = false;
      combat.checkProjectileCollisions(
        [target],
        [],
        () => {
          hit = true;
        },
        () => undefined,
        () => undefined
      );
      expect(hit).toBe(expected);
      scene.remove(target);
    }
  );
});
