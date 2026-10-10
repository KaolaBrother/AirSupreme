import { describe, it } from 'vitest';
import { EnemyType } from '@/features/enemy/EnemyTypes';
import { DEG, DT, FleetRig, angleBetween, pointAround } from './enemyFleetRig';

describe('probe', () => {
  it('ace launch off the nose', () => {
    const rig = new FleetRig({ level: 3, capacity: 3, seed: 31 });
    const jet = rig.addJet(EnemyType.ACE, pointAround(rig.player, 400, 120 * DEG));
    rig.pilot = (r) => r.turnPlayer(0.1 * DT);
    rig.missiles.flightSeconds = 3;
    const lines: string[] = [];
    let next = 0;
    rig.run(42, () => {
      if (rig.time < 36.5) return;
      if (rig.time >= next) {
        next = rig.time + 0.25;
        const toPlayer = rig.player.position.clone().sub(jet.getMesh().position);
        lines.push(
          `${rig.time.toFixed(2)} ${jet.getDoctrinePhase()} lock ${jet.isMissileLocking()} tok ${jet.hasAttackToken()} grant ${jet.getMissileGrant()} ` +
            `d ${toPlayer.length().toFixed(0)} nose ${(angleBetween(jet.velocity, toPlayer) / DEG).toFixed(0)} ` +
            `dy ${toPlayer.y.toFixed(0)} thr ${(jet.velocity.length() / 70).toFixed(2)} launches ${rig.launchLog.length}`
        );
      }
    });
    console.log(lines.join('\n'));
    rig.dispose();
  });
});
