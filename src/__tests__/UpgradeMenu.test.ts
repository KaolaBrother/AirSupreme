import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UpgradeMenu } from '@/ui/UpgradeMenu';
import { PlayerUpgrades, UpgradeType } from '@/features/upgrade/UpgradeSystem';

describe('UpgradeMenu', () => {
  let upgrades: PlayerUpgrades;
  let onResume: ReturnType<typeof vi.fn>;
  let onUpgrade: ReturnType<typeof vi.fn>;
  let menu: UpgradeMenu;

  beforeEach(() => {
    document.body.innerHTML = '';
    upgrades = new PlayerUpgrades();
    onResume = vi.fn();
    onUpgrade = vi.fn((type: UpgradeType) => {
      upgrades.upgrade(type);
    });
    menu = new UpgradeMenu(upgrades, onUpgrade, onResume);
  });

  afterEach(() => {
    menu.dispose();
    document.body.innerHTML = '';
  });

  it('shows menu and updates points display from upgrades state', () => {
    upgrades.addScore(800);
    menu.show();

    const points = document.querySelector('.upgrade-points');
    expect(points?.textContent).toBe('⭐ 可用升级点: 2');
    expect(points?.classList.contains('has-points')).toBe(true);
    expect(menu.isVisible()).toBe(true);

    upgrades.upgrade(UpgradeType.MAX_HEALTH);
    menu.updateDisplay();
    expect(points?.textContent).toBe('⭐ 可用升级点: 1');
  });

  it('updates upgrade button state and points after upgrade click', () => {
    menu.show();
    const buttonId = `btn-${UpgradeType.MAX_HEALTH}`;

    const lockedButton = document.getElementById(buttonId) as HTMLButtonElement | null;
    expect(lockedButton).not.toBeNull();
    expect(lockedButton?.classList.contains('locked')).toBe(true);

    upgrades.addScore(400);
    menu.updateDisplay();

    const availableButton = document.getElementById(buttonId) as HTMLButtonElement;
    expect(availableButton.classList.contains('available')).toBe(true);
    availableButton.click();

    expect(onUpgrade).toHaveBeenCalledWith(UpgradeType.MAX_HEALTH);
    expect(upgrades.getLevel(UpgradeType.MAX_HEALTH)).toBe(1);
    expect(upgrades.getAvailablePoints()).toBe(0);
    expect(document.querySelector('.upgrade-points')?.textContent).toBe('⭐ 可用升级点: 0');

    const updatedButton = document.getElementById(buttonId) as HTMLButtonElement;
    expect(updatedButton.classList.contains('locked')).toBe(true);
  });

  it('shows current, next and gain values for each upgrade card', () => {
    menu.show();

    const speedCard = document.getElementById(`upgrade-card-${UpgradeType.SPEED}`);
    expect(speedCard).not.toBeNull();

    const statValues = speedCard?.querySelectorAll('.stat-value');
    expect(statValues?.[0]?.textContent).toBe('45');
    expect(statValues?.[1]?.textContent).toBe('53');
    expect(statValues?.[2]?.textContent).toBe('+8');
  });

  it('shows missile lock radius upgrade card with multiplier values', () => {
    menu.show();

    const radiusCard = document.getElementById(
      `upgrade-card-${UpgradeType.MISSILE_LOCK_RADIUS}`
    );
    expect(radiusCard).not.toBeNull();

    const statValues = radiusCard?.querySelectorAll('.stat-value');
    expect(statValues?.[0]?.textContent).toBe('1x');
    expect(statValues?.[1]?.textContent).toBe('1.2x');
    expect(statValues?.[2]?.textContent).toBe('+0.2x');
  });

  it('triggers resume callback and toggles visibility with show/hide', () => {
    menu.show();
    const resumeButton = document.querySelector('.resume-btn') as HTMLButtonElement;
    expect(resumeButton).not.toBeNull();

    resumeButton.click();
    expect(onResume).toHaveBeenCalledTimes(1);

    menu.hide();
    expect(menu.isVisible()).toBe(false);

    const container = document.getElementById('upgrade-menu') as HTMLDivElement;
    expect(container.style.display).toBe('none');
  });
});
