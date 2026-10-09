import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WINGMEN, WingmanRoster, type WingmanProfile } from '@/core/campaign/Wingmen';
import { CAMPAIGN_CHAPTERS, CAMPAIGN_SPEAKERS } from '@/features/campaign/CampaignData';
import { ENEMY_CONFIGS, EnemyType } from '@/features/enemy/EnemyTypes';
import { setLocale } from '@/i18n';
import { EnemyHealthBars } from '@/ui/EnemyHealthBars';
import { LOCALES, resetLocale, textIn } from './i18nTestUtils';

/**
 * 具名僚机（src/core/campaign/Wingmen.ts）：先入场的友军喷气机依次是「渡鸦」Raven 与
 * 「雨燕」Swift（第 3 章起随队），其余友机是普通友军；僚机呼号写在 mesh.userData.displayName，
 * 友军血条显示呼号（按界面语言）；被击落的僚机本关不再出现，reset() 后全部归队。
 */

function profile(id: WingmanProfile['id']): WingmanProfile {
  const found = WINGMEN.find((entry) => entry.id === id);
  expect(found, `expected the ${id} wingman`).toBeTruthy();
  return found as WingmanProfile;
}

const RAVEN = profile('raven');
const SWIFT = profile('swift');

describe('named wingmen (WINGMEN)', () => {
  it('flies Raven first and Swift second', () => {
    expect(WINGMEN.map((entry) => entry.id)).toEqual(['raven', 'swift']);
    expect(RAVEN.callsign).toEqual({ en: 'Raven', zh: '渡鸦' });
    expect(SWIFT.callsign).toEqual({ en: 'Swift', zh: '雨燕' });
  });

  it('has Raven from the first level and Swift from level 3', () => {
    expect(RAVEN.joinsAtLevel).toBe(1);
    expect(SWIFT.joinsAtLevel).toBe(3);
  });

  it('uses the cast callsigns (Raven = wingman, Swift = wingman2)', () => {
    expect(RAVEN.callsign).toEqual(CAMPAIGN_SPEAKERS.wingman.callsign);
    expect(SWIFT.callsign).toEqual(CAMPAIGN_SPEAKERS.wingman2.callsign);
  });

  it('keeps Swift off the chapter radio until she joins the flight', () => {
    for (const chapter of CAMPAIGN_CHAPTERS) {
      const swiftLines = chapter.radio.filter((line) => line.speaker === 'wingman2');
      if (chapter.level < SWIFT.joinsAtLevel) {
        expect(swiftLines, `chapter ${chapter.level}`).toEqual([]);
      }
    }
    const voiced = CAMPAIGN_CHAPTERS.filter((chapter) =>
      chapter.radio.some((line) => line.speaker === 'wingman2')
    ).map((chapter) => chapter.level);
    expect(voiced.length).toBeGreaterThan(0);
    expect(Math.min(...voiced)).toBe(SWIFT.joinsAtLevel);
  });
});

describe('WingmanRoster', () => {
  let roster: WingmanRoster;

  beforeEach(() => {
    roster = new WingmanRoster();
  });

  it.each([1, 2])('level %i: the first friendly is Raven; Swift has not joined yet', (level) => {
    expect(roster.assign('jet-a', level)).toBe(RAVEN);
    expect(roster.assign('jet-b', level)).toBeNull();
    expect(roster.assign('jet-c', level)).toBeNull();
    expect(roster.isFlying('raven')).toBe(true);
    expect(roster.isFlying('swift')).toBe(false);
  });

  it.each([3, 6, 10])('level %i: Raven, then Swift, then ordinary friendlies', (level) => {
    expect(roster.assign('jet-a', level)).toBe(RAVEN);
    expect(roster.assign('jet-b', level)).toBe(SWIFT);
    expect(roster.assign('jet-c', level)).toBeNull();
    expect(roster.assign('jet-d', level)).toBeNull();
    expect(roster.isFlying('raven')).toBe(true);
    expect(roster.isFlying('swift')).toBe(true);
  });

  it('starts with nobody flying', () => {
    expect(roster.isFlying('raven')).toBe(false);
    expect(roster.isFlying('swift')).toBe(false);
  });

  it('reports a downed wingman once and keeps them out for the rest of the level', () => {
    roster.assign('jet-a', 3);
    roster.assign('jet-b', 3);

    expect(roster.release('jet-a')).toBe(RAVEN);
    expect(roster.isFlying('raven')).toBe(false);
    expect(roster.isFlying('swift')).toBe(true);
    expect(roster.release('jet-a')).toBeNull();

    // 渡鸦已被击落、雨燕还在空中：新友机是普通友军
    expect(roster.assign('jet-c', 3)).toBeNull();

    expect(roster.release('jet-b')).toBe(SWIFT);
    expect(roster.isFlying('swift')).toBe(false);
    expect(roster.assign('jet-d', 3)).toBeNull();
  });

  it('gives the next friendly the first wingman still available', () => {
    roster.assign('jet-a', 3);
    roster.release('jet-a');
    expect(roster.assign('jet-b', 3)).toBe(SWIFT);
  });

  it('does not free a wingman slot when an ordinary friendly goes down', () => {
    expect(roster.assign('jet-a', 1)).toBe(RAVEN);
    expect(roster.assign('jet-b', 1)).toBeNull();

    expect(roster.release('jet-b')).toBeNull();
    expect(roster.release('never-spawned')).toBeNull();
    expect(roster.isFlying('raven')).toBe(true);
    expect(roster.assign('jet-c', 1)).toBeNull();
  });

  it('returns every wingman to the flight after reset()', () => {
    roster.assign('jet-a', 3);
    roster.assign('jet-b', 3);
    roster.release('jet-a');

    roster.reset();
    expect(roster.isFlying('raven')).toBe(false);
    expect(roster.isFlying('swift')).toBe(false);
    expect(roster.release('jet-b')).toBeNull();

    expect(roster.assign('jet-c', 3)).toBe(RAVEN);
    expect(roster.assign('jet-d', 3)).toBe(SWIFT);
  });

  it('follows the level of each assignment (Swift only once the level reaches 3)', () => {
    expect(roster.assign('jet-a', 2)).toBe(RAVEN);
    expect(roster.assign('jet-b', 2)).toBeNull();
    roster.reset();
    expect(roster.assign('jet-c', 3)).toBe(RAVEN);
    expect(roster.assign('jet-d', 3)).toBe(SWIFT);
  });

  describe('countAvailable (the flight that launches at the start of a level)', () => {
    it.each([1, 2])('level %i: only Raven', (level) => {
      expect(roster.countAvailable(level)).toBe(1);
    });

    it.each([3, 4, 5, 6, 7, 8, 9, 10])('level %i: Raven and Swift', (level) => {
      expect(roster.countAvailable(level)).toBe(2);
    });

    it('launching all available wingmen flies Raven then Swift; reinforcements are ordinary', () => {
      const launched: Array<WingmanProfile | null> = [];
      const count = roster.countAvailable(3);
      for (let i = 0; i < count; i++) launched.push(roster.assign(`jet-${i}`, 3));
      expect(launched).toEqual([RAVEN, SWIFT]);
      expect(roster.countAvailable(3)).toBe(0);
      expect(roster.assign('reinforcement', 3)).toBeNull();
    });

    it('a downed wingman stays unavailable for the rest of the level; reset() brings both back', () => {
      roster.assign('jet-a', 4);
      roster.assign('jet-b', 4);
      roster.release('jet-a');
      expect(roster.countAvailable(4)).toBe(0);
      roster.release('jet-b');
      expect(roster.countAvailable(4)).toBe(0);

      roster.reset();
      expect(roster.countAvailable(4)).toBe(2);
      expect(roster.countAvailable(2)).toBe(1);
    });
  });
});

describe('wingman callsign on the friendly health bar', () => {
  let bars: EnemyHealthBars;
  let camera: THREE.PerspectiveCamera;
  const player = new THREE.Vector3(0, 0, 80);

  function friendlyJet(x: number): THREE.Object3D {
    const mesh = new THREE.Object3D();
    mesh.name = EnemyType.FIGHTER;
    mesh.position.set(x, 0, 0);
    return mesh;
  }

  function barLabels(): string[] {
    return Array.from(document.querySelectorAll('.enemy-health-bar .enemy-name')).map(
      (element) => element.textContent ?? ''
    );
  }

  beforeEach(() => {
    document.body.innerHTML = '';
    bars = new EnemyHealthBars();
    camera = new THREE.PerspectiveCamera(60, 1, 0.1, 2000);
    camera.position.set(0, 0, 100);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
  });

  afterEach(() => {
    bars.dispose();
    resetLocale();
    document.body.innerHTML = '';
  });

  it.each(LOCALES)('labels a wingman with the callsign, others with the type (%s)', (locale) => {
    setLocale(locale);
    const raven = friendlyJet(-10);
    raven.userData.displayName = RAVEN.callsign;
    const ordinary = friendlyJet(10);

    bars.update(
      [],
      [
        { mesh: raven, currentHealth: 100, maxHealth: 100 },
        { mesh: ordinary, currentHealth: 100, maxHealth: 100 },
      ],
      camera,
      player
    );

    const [ravenLabel, ordinaryLabel] = barLabels();
    expect(ravenLabel).toBe(textIn(RAVEN.callsign, locale));
    expect(ordinaryLabel).not.toBe(textIn(RAVEN.callsign, locale));
    expect(ordinaryLabel).toContain(textIn(ENEMY_CONFIGS[EnemyType.FIGHTER].name, locale));
  });

  it('re-labels the bars in the new language when they are next redrawn', () => {
    const swift = friendlyJet(-10);
    swift.userData.displayName = SWIFT.callsign;
    const ordinary = friendlyJet(10);
    const friendlies = [
      { mesh: swift, currentHealth: 80, maxHealth: 100 },
      { mesh: ordinary, currentHealth: 100, maxHealth: 100 },
    ];
    const fighter = ENEMY_CONFIGS[EnemyType.FIGHTER].name;
    // 运行中镜头每帧都在动（暂停时不更新血条）：挪一下镜头模拟恢复后的下一帧
    const nextFrame = (): void => {
      camera.position.x += 1;
      camera.updateMatrixWorld();
      bars.update([], friendlies, camera, player);
    };

    bars.update([], friendlies, camera, player);
    expect(barLabels()[0]).toBe('Swift');
    expect(barLabels()[1]).toContain(fighter.en);

    setLocale('zh-CN');
    nextFrame();
    expect(barLabels()[0]).toBe('雨燕');
    expect(barLabels()[1]).toContain(fighter.zh);
    expect(barLabels()[1]).not.toContain(fighter.en);

    setLocale('en');
    nextFrame();
    expect(barLabels()[0]).toBe('Swift');
    expect(barLabels()[1]).toContain(fighter.en);
  });

  it('re-labels the bars at once on a language switch, even while paused', () => {
    const raven = friendlyJet(-10);
    raven.userData.displayName = RAVEN.callsign;
    const ordinary = friendlyJet(10);
    const friendlies = [
      { mesh: raven, currentHealth: 100, maxHealth: 100 },
      { mesh: ordinary, currentHealth: 100, maxHealth: 100 },
    ];
    const fighter = ENEMY_CONFIGS[EnemyType.FIGHTER].name;
    bars.update([], friendlies, camera, player);
    expect(barLabels()[0]).toBe('Raven');

    // 暂停菜单里切换语言：游戏不再调用 update，名字也要立即换
    setLocale('zh-CN');
    expect(barLabels()[0]).toBe('渡鸦');
    expect(barLabels()[1]).toContain(fighter.zh);

    // 恢复后镜头没动的一帧也保持新语言
    bars.update([], friendlies, camera, player);
    expect(barLabels()[0]).toBe('渡鸦');
    expect(barLabels()[1]).toContain(fighter.zh);

    setLocale('en');
    expect(barLabels()[0]).toBe('Raven');
    expect(barLabels()[1]).toContain(fighter.en);
  });
});
