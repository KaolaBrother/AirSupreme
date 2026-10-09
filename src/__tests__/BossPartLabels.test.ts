import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BossType } from '@/features/boss/BossTypes';
import { EnemyType } from '@/features/enemy/EnemyTypes';
import { EnemyHealthBars } from '@/ui/EnemyHealthBars';
import { resetLocale } from './i18nTestUtils';

/**
 * Boss 部件血条（EnemyHealthBars，终验修复 F3）：部件用紧凑的小血条；名称最多只标一个——
 * 视野内离准星（屏幕中心）最近的那个部件；不会叠出一排同名标签。
 */

interface Target {
  mesh: THREE.Object3D;
  currentHealth: number;
  maxHealth: number;
}

function target(name: string, x: number, y: number, z = 0): Target {
  const mesh = new THREE.Object3D();
  mesh.name = name;
  mesh.position.set(x, y, z);
  mesh.updateMatrixWorld();
  return { mesh, currentHealth: 80, maxHealth: 100 };
}

interface BarView {
  bar: HTMLElement;
  name: string;
  /** 血量填充的宽度（像素）：所有目标同为 80% 血量，可直接比较血条长短 */
  fillWidth: number;
  shown: boolean;
  nameShown: boolean;
}

function bars(): BarView[] {
  return Array.from(document.querySelectorAll<HTMLElement>('.enemy-health-bar')).map((bar) => {
    const label = bar.querySelector<HTMLElement>('.enemy-name');
    const fill = bar.querySelector<HTMLElement>('.health-bar-background');
    const shown = bar.style.display !== 'none';
    return {
      bar,
      name: label?.textContent ?? '',
      fillWidth: Number.parseFloat(fill?.style.width ?? ''),
      shown,
      nameShown: shown && !!label && label.style.display !== 'none',
    };
  });
}

const PART_FAMILIES: ReadonlyArray<
  [family: string, boss: BossType, prefix: string, count: number]
> = [
  ['zeppelin gas cells', BossType.TEMPEST_ZEPPELIN, 'zeppelin_gas_cell_', 6],
  ['octopus eyes', BossType.OCTOPUS_WARSHIP, 'boss_eye_', 8],
];

describe('boss part labels', () => {
  let healthBars: EnemyHealthBars;
  let camera: THREE.PerspectiveCamera;
  const player = new THREE.Vector3(0, 0, 120);

  beforeEach(() => {
    document.body.innerHTML = '';
    healthBars = new EnemyHealthBars();
    camera = new THREE.PerspectiveCamera(60, 1, 0.1, 2000);
    camera.position.set(0, 0, 100);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
  });

  afterEach(() => {
    healthBars.dispose();
    resetLocale();
    document.body.innerHTML = '';
  });

  function aimAt(x: number): void {
    camera.position.set(x, 0, 100);
    camera.lookAt(x, 0, 0);
    camera.updateMatrixWorld();
  }

  /**
   * 部件沿 X 排开（间隔 12 米，整体右移 1.5 米避开正中心的对称，全部在 60° 视野内），
   * Boss 本体在上方，另加一架普通敌机
   */
  function scene(prefix: string, boss: BossType, count: number): Target[] {
    const parts: Target[] = [];
    for (let i = 0; i < count; i++) {
      parts.push(target(`${prefix}${i}`, (i - (count - 1) / 2) * 12 + 1.5, 0));
    }
    return [target(`BOSS_${boss}`, 0, 35), ...parts, target(EnemyType.FIGHTER, 0, -40)];
  }

  it.each(PART_FAMILIES)(
    '%s: compact bars, and exactly one part name — the part nearest the reticle',
    (_family, boss, prefix, count) => {
      const targets = scene(prefix, boss, count);
      healthBars.update(targets, [], camera, player);

      const views = bars();
      expect(views).toHaveLength(count + 2);
      const [bossBar, ...rest] = views;
      const partBars = rest.slice(0, count);
      const fighterBar = rest[count];
      expect(bossBar.nameShown, 'the boss keeps its name').toBe(true);

      for (const part of partBars) {
        expect(part.shown).toBe(true);
        expect(part.fillWidth, 'compact next to the boss bar').toBeLessThan(bossBar.fillWidth);
        expect(part.fillWidth, 'compact next to an ordinary bar').toBeLessThan(
          fighterBar.fillWidth
        );
      }

      const named = partBars.filter((part) => part.nameShown);
      expect(named, 'one part name, no stack of duplicates').toHaveLength(1);
      // 镜头正对 x = 0：离屏幕中心最近的是 |x| 最小的部件
      const xs = targets.slice(1, count + 1).map((entry) => Math.abs(entry.mesh.position.x));
      const nearest = xs.indexOf(Math.min(...xs));
      expect(partBars.indexOf(named[0])).toBe(nearest);
      expect(named[0].name.trim()).not.toBe('');

      const sameName = views.filter((view) => view.nameShown && view.name === named[0].name);
      expect(sameName).toHaveLength(1);
    }
  );

  it('moves the single part name to whichever part comes nearest the reticle', () => {
    const targets = scene('zeppelin_gas_cell_', BossType.TEMPEST_ZEPPELIN, 6);
    healthBars.update(targets, [], camera, player);

    aimAt(52);
    healthBars.update(targets, [], camera, player);
    let partBars = bars().slice(1, 7);
    let named = partBars.filter((part) => part.nameShown);
    expect(named).toHaveLength(1);
    expect(partBars.indexOf(named[0]), 'the part at x = 31.5').toBe(5);

    aimAt(-48);
    healthBars.update(targets, [], camera, player);
    partBars = bars().slice(1, 7);
    named = partBars.filter((part) => part.nameShown);
    expect(named).toHaveLength(1);
    expect(partBars.indexOf(named[0]), 'the part at x = -28.5').toBe(0);
  });

  it('hands the name to another part when the named part is destroyed', () => {
    const targets = scene('zeppelin_gas_cell_', BossType.TEMPEST_ZEPPELIN, 6);
    healthBars.update(targets, [], camera, player);
    const before = bars().slice(1, 7);
    const namedIndex = before.findIndex((part) => part.nameShown);
    expect(namedIndex).toBeGreaterThanOrEqual(0);

    const partName = before[namedIndex].name;

    const remaining = targets.filter((_entry, index) => index !== namedIndex + 1);
    healthBars.update(remaining, [], camera, player);
    const partBars = bars().filter((view) => view.name === partName);
    expect(partBars).toHaveLength(5);
    expect(partBars.filter((part) => part.nameShown)).toHaveLength(1);
  });
});
