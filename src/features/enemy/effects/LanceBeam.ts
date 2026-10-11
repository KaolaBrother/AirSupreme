import * as THREE from 'three';
import { ENEMY_WEAPON_SPECS } from '../EnemyWeapons';

/** 光束越过瞄准点后再延伸这么远（米）：玩家能看出这条线穿过自己并继续向前 */
const BEAM_OVERSHOOT = 150;
/** 光束半径（米）：一条细红线——跟踪时更细，冻结后略粗、更实 */
const CORE_RADIUS_TRACKING = 0.06;
const CORE_RADIUS_FROZEN = 0.14;
const HALO_RADIUS_TRACKING = 0.22;
const HALO_RADIUS_FROZEN = 0.45;
/** 蓄力光球半径（米）：随蓄力进度长大 */
const GLOW_RADIUS_MIN = 1.2;
const GLOW_RADIUS_MAX = 4.2;

const BEAM_COLOR = 0xff2a1a;
const HALO_COLOR = 0xff2a1a;
const FROZEN_CORE_COLOR = 0xff5a46;

const BEAM_AXIS = new THREE.Vector3(0, 1, 0);
const tmpDirection = new THREE.Vector3();

/**
 * 狙击机的瞄准光束 + 蓄力光球（每架狙击机一份，首次蓄力时才创建）。
 *
 * 光束是场景级对象（不挂在机体下）：从机体出发穿过瞄准点；冻结后略粗、更实，
 * 表示“长枪弹将沿这条线飞”。一条 1 像素的线保证远处也看得见；线芯用普通混合（在明亮的
 * 地表上仍然是红的，加色混合会被洗成黄白），外面一层很淡的加色光晕给近处一点体积感。
 */
export class LanceBeam {
  private readonly scene: THREE.Scene;
  private readonly root = new THREE.Group();
  private readonly core: THREE.Mesh;
  private readonly halo: THREE.Mesh;
  private readonly line: THREE.Line;
  private readonly glow: THREE.Mesh;
  private readonly beamGeometry: THREE.CylinderGeometry;
  private readonly lineGeometry: THREE.BufferGeometry;
  private readonly glowGeometry: THREE.IcosahedronGeometry;
  private readonly coreMaterial: THREE.MeshBasicMaterial;
  private readonly haloMaterial: THREE.MeshBasicMaterial;
  private readonly lineMaterial: THREE.LineBasicMaterial;
  private readonly glowMaterial: THREE.MeshBasicMaterial;
  private disposed = false;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // 单位圆柱：底面在原点、沿 +Y 伸展 1 米；长度与半径由缩放给出
    this.beamGeometry = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true);
    this.beamGeometry.translate(0, 0.5, 0);
    this.lineGeometry = new THREE.BufferGeometry();
    this.lineGeometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([0, 0, 0, 0, 1, 0], 3)
    );
    this.glowGeometry = new THREE.IcosahedronGeometry(1, 1);

    const solid = { transparent: true, depthWrite: false } as const;
    const additive = { ...solid, blending: THREE.AdditiveBlending } as const;
    this.coreMaterial = new THREE.MeshBasicMaterial({
      ...solid,
      color: BEAM_COLOR,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });
    this.haloMaterial = new THREE.MeshBasicMaterial({
      ...additive,
      color: HALO_COLOR,
      opacity: 0.08,
      side: THREE.DoubleSide,
    });
    this.lineMaterial = new THREE.LineBasicMaterial({
      ...solid,
      color: BEAM_COLOR,
      opacity: 0.8,
    });
    this.glowMaterial = new THREE.MeshBasicMaterial({
      ...additive,
      color: HALO_COLOR,
      opacity: 0.5,
    });

    this.core = new THREE.Mesh(this.beamGeometry, this.coreMaterial);
    this.halo = new THREE.Mesh(this.beamGeometry, this.haloMaterial);
    this.line = new THREE.Line(this.lineGeometry, this.lineMaterial);
    this.glow = new THREE.Mesh(this.glowGeometry, this.glowMaterial);
    // 细长物体的包围球随缩放变化很大：不做视锥剔除，避免贴近相机时被误剔
    this.core.frustumCulled = false;
    this.halo.frustumCulled = false;
    this.line.frustumCulled = false;

    this.root.name = 'lanceBeam';
    this.root.add(this.core, this.halo, this.line, this.glow);
    this.root.visible = false;
    this.scene.add(this.root);
  }

  /**
   * 显示 / 更新光束。
   * @param origin 机体位置（世界坐标）
   * @param aimPoint 瞄准点（世界坐标）
   * @param progress 蓄力进度 0..1
   * @param frozen 光束已冻结
   */
  public show(
    origin: THREE.Vector3,
    aimPoint: THREE.Vector3,
    progress: number,
    frozen: boolean
  ): void {
    if (this.disposed) return;
    tmpDirection.subVectors(aimPoint, origin);
    const distance = tmpDirection.length();
    if (!(distance > 1e-3) || !Number.isFinite(distance)) {
      this.root.visible = false;
      return;
    }
    tmpDirection.multiplyScalar(1 / distance);
    const length = Math.min(ENEMY_WEAPON_SPECS.lance.maxDistance, distance + BEAM_OVERSHOOT);
    const charge = progress > 1 ? 1 : progress > 0 ? progress : 0;

    this.root.position.copy(origin);
    this.root.quaternion.setFromUnitVectors(BEAM_AXIS, tmpDirection);

    const coreRadius = frozen ? CORE_RADIUS_FROZEN : CORE_RADIUS_TRACKING;
    const haloRadius = frozen ? HALO_RADIUS_FROZEN : HALO_RADIUS_TRACKING;
    this.core.scale.set(coreRadius, length, coreRadius);
    this.halo.scale.set(haloRadius, length, haloRadius);
    this.line.scale.set(1, length, 1);

    this.coreMaterial.color.setHex(frozen ? FROZEN_CORE_COLOR : BEAM_COLOR);
    this.coreMaterial.opacity = frozen ? 1 : 0.55 + 0.25 * charge;
    this.haloMaterial.opacity = frozen ? 0.2 : 0.05 + 0.05 * charge;
    this.lineMaterial.color.setHex(frozen ? FROZEN_CORE_COLOR : BEAM_COLOR);
    this.lineMaterial.opacity = frozen ? 1 : 0.6 + 0.3 * charge;

    const glowRadius = GLOW_RADIUS_MIN + (GLOW_RADIUS_MAX - GLOW_RADIUS_MIN) * charge;
    this.glow.scale.setScalar(glowRadius);
    this.glowMaterial.opacity = frozen ? 0.85 : 0.3 + 0.35 * charge;

    this.root.visible = true;
  }

  public hide(): void {
    this.root.visible = false;
  }

  public isVisible(): boolean {
    return this.root.visible;
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.visible = false;
    this.scene.remove(this.root);
    this.beamGeometry.dispose();
    this.lineGeometry.dispose();
    this.glowGeometry.dispose();
    this.coreMaterial.dispose();
    this.haloMaterial.dispose();
    this.lineMaterial.dispose();
    this.glowMaterial.dispose();
  }
}
