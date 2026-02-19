import * as THREE from 'three';
import { EnemyAI } from './EnemyAI';
import { EnemyConfig } from './EnemyTypes';

export class FriendlyAI {
  private enemy: EnemyAI;
  public isFriendly: boolean = true;

  constructor(mesh: THREE.Group, config: EnemyConfig, scene: THREE.Scene) {
    this.enemy = new EnemyAI(mesh, config, scene);

    mesh.userData.isFriendly = true;

    this.enemy.onFire = (
      _position: THREE.Vector3,
      _direction: THREE.Vector3,
      _damage: number
    ) => {};
  }

  public update(
    deltaTime: number,
    enemyMeshes: THREE.Object3D[],
    playerPosition: THREE.Vector3
  ): void {
    const nearestEnemy = this.findNearestEnemy(enemyMeshes);

    if (nearestEnemy) {
      const targetWorldPos = new THREE.Vector3();
      nearestEnemy.getWorldPosition(targetWorldPos);
      this.enemy.update(deltaTime, targetWorldPos, undefined, targetWorldPos);
    } else {
      this.enemy.update(deltaTime, playerPosition, undefined, null);
    }
  }

  private findNearestEnemy(enemyMeshes: THREE.Object3D[]): THREE.Object3D | null {
    let nearest: THREE.Object3D | null = null;
    let minDistance = Infinity;

    const myWorldPos = new THREE.Vector3();
    this.enemy.getMesh().getWorldPosition(myWorldPos);

    for (const enemyMesh of enemyMeshes) {
      if (enemyMesh === this.enemy.getMesh()) continue;

      const targetWorldPos = new THREE.Vector3();
      enemyMesh.getWorldPosition(targetWorldPos);
      const distance = myWorldPos.distanceTo(targetWorldPos);

      if (distance < minDistance) {
        minDistance = distance;
        nearest = enemyMesh;
      }
    }

    return nearest;
  }

  public getMesh(): THREE.Group {
    return this.enemy.getMesh();
  }

  public isAlive(): boolean {
    return this.enemy.isAlive();
  }

  public getHealth(): { current: number; max: number } {
    return this.enemy.getHealth();
  }

  public takeDamage(damage: number): void {
    this.enemy.takeDamage(damage);
  }

  public dispose(): void {
    const mesh = this.enemy.getMesh();
    this.enemy['trail'].dispose();

    if (mesh.parent) {
      mesh.parent.remove(mesh);
    }

    mesh.visible = false;
    while (mesh.children.length > 0) {
      const child = mesh.children[0];
      mesh.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else if (child.material instanceof THREE.Material) {
          child.material.dispose();
        }
      }
    }
  }
}
