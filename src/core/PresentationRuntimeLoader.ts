import type { BossMissileIndicator } from '@/ui/BossMissileIndicator';
import type { EnemyHealthBars } from '@/ui/EnemyHealthBars';
import type { HUD } from '@/ui/HUD';
import type { LockOnIndicator } from '@/ui/LockOnIndicator';
import type { PresentationController } from '@/core/PresentationController';
import type { StartMenu } from '@/ui/StartMenu';

type StartMenuModule = typeof import('@/ui/StartMenu');

export interface PresentationRuntime {
  hud: HUD;
  startMenu: StartMenu | null;
  enemyHealthBars: EnemyHealthBars;
  bossIndicator: BossMissileIndicator;
  lockOnIndicator: LockOnIndicator;
  presentationController: PresentationController;
}

export async function warmPresentationRuntimeChunks(): Promise<void> {
  await Promise.all([
    import('@/ui/HUD'),
    import('@/ui/EnemyHealthBars'),
    import('@/ui/LockOnIndicator'),
    import('@/ui/BossMissileIndicator'),
    import('@/core/PresentationController'),
  ]);
}

export async function createPresentationRuntime(
  showStartMenu: boolean
): Promise<PresentationRuntime> {
  const startMenuPromise: Promise<StartMenuModule | null> = showStartMenu
    ? import('@/ui/StartMenu')
    : Promise.resolve(null);
  const [
    { HUD },
    { EnemyHealthBars },
    { LockOnIndicator },
    { BossMissileIndicator },
    { PresentationController },
    startMenuModule,
  ] = await Promise.all([
    import('@/ui/HUD'),
    import('@/ui/EnemyHealthBars'),
    import('@/ui/LockOnIndicator'),
    import('@/ui/BossMissileIndicator'),
    import('@/core/PresentationController'),
    startMenuPromise,
  ]);

  const hud = new HUD();
  const enemyHealthBars = new EnemyHealthBars();
  const lockOnIndicator = new LockOnIndicator();
  const bossIndicator = new BossMissileIndicator();
  const startMenu = startMenuModule ? new startMenuModule.StartMenu() : null;
  const presentationController = new PresentationController({
    hud,
    startMenu,
    enemyHealthBars,
    bossIndicator,
    lockOnIndicator,
  });

  return {
    hud,
    startMenu,
    enemyHealthBars,
    bossIndicator,
    lockOnIndicator,
    presentationController,
  };
}
