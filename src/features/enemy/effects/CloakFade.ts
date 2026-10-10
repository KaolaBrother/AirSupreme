import * as THREE from 'three';

/** 现形预警的红色眼灯：世界半径（米）随强度从 MIN 长到 MAX */
const FLARE_RADIUS_MIN = 0.8;
const FLARE_RADIUS_MAX = 2.6;
const FLARE_COLOR = 0xff2a1a;
/** 隐形机机头那只红色“独眼”的网格名（AircraftMeshFactory 的 buildWraith）：眼灯就亮在它上面 */
const EYE_MESH_NAME = 'wraithEye';
/** 机体上找不到独眼时的眼灯位置（机体本地坐标，机头为 +Z）：机头前上方一点 */
const FLARE_FALLBACK_OFFSET = new THREE.Vector3(0, 0.12, 1.15);

type MaterialSlot = THREE.Material | THREE.Material[];

/** 带材质的可渲染对象（Mesh / Sprite / Line / Points） */
type Fadeable = THREE.Object3D & { material: MaterialSlot };

interface FadeEntry {
  object: Fadeable;
  /** 原来的（跨机体共享的）材质：完全可见时换回去 */
  original: MaterialSlot;
  /** 本机专用的克隆：淡出 / 隐形 / 淡入期间使用 */
  clones: THREE.Material[];
  /** 克隆时各材质的不透明度（淡出系数乘在它上面） */
  baseOpacity: number[];
}

function isFadeable(object: THREE.Object3D): object is Fadeable {
  const candidate = object as Partial<Fadeable>;
  return (
    candidate.material !== undefined &&
    candidate.material !== null &&
    ((object as THREE.Mesh).isMesh === true ||
      (object as THREE.Sprite).isSprite === true ||
      (object as THREE.Line).isLine === true ||
      (object as THREE.Points).isPoints === true)
  );
}

/**
 * 隐形机的淡出 / 淡入与现形眼灯（每架隐形机一份，首次隐形时才创建）。
 *
 * 敌机的材质是跨机体共享的（按机型缓存的机身材质，以及模块级的信号灯 / 尾焰 / 饰条 / 目镜），
 * 不能直接改不透明度——那会把别的敌机一起淡掉。淡出时给机体下每一个可渲染对象的材质各克隆
 * 一份本机专用的，设成透明、不写深度，按系数缩放不透明度；完全可见时把共享材质原样换回去
 * （信号灯闪烁等由共享材质驱动的动画随之恢复）。不用 mesh.visible 隐藏机体：碰撞、存活判定
 * 都读它。
 *
 * 克隆在第一次需要时建立一次并复用到机体销毁；dispose 换回原材质并只释放自己的克隆
 * （共享的原材质从不释放）。
 */
export class CloakFade {
  private readonly root: THREE.Object3D;
  private entries: FadeEntry[] | null = null;
  private usingClones = false;
  private readonly flare: THREE.Mesh;
  private readonly flareGeometry: THREE.IcosahedronGeometry;
  private readonly flareMaterial: THREE.MeshBasicMaterial;
  private disposed = false;

  constructor(root: THREE.Object3D) {
    this.root = root;
    this.flareGeometry = new THREE.IcosahedronGeometry(1, 1);
    // 普通混合而不是叠加：叠加在明亮的天空 / 海面上会被冲成黄白色，读不出“红色”
    this.flareMaterial = new THREE.MeshBasicMaterial({
      color: FLARE_COLOR,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.flare = new THREE.Mesh(this.flareGeometry, this.flareMaterial);
    this.flare.name = 'cloakFlare';
    this.flare.position.copy(FLARE_FALLBACK_OFFSET);
    const eye = root.getObjectByName(EYE_MESH_NAME);
    if (eye) {
      // 独眼的位置换算到机体本地坐标（getWorldPosition 会顺带刷新沿途的世界矩阵）
      const position = root.worldToLocal(eye.getWorldPosition(new THREE.Vector3()));
      if (
        Number.isFinite(position.x) &&
        Number.isFinite(position.y) &&
        Number.isFinite(position.z)
      ) {
        this.flare.position.copy(position);
      }
    }
    this.flare.visible = false;
    // 眼灯自己管理几何与材质（dispose 时从机体上摘下），不参与机体的淡出克隆
    this.root.add(this.flare);
  }

  /**
   * @param opacity 机体不透明度系数：1 = 完全可见（用回共享材质），隐形时约 0.15
   * @param flare 眼灯强度 0..1
   */
  public apply(opacity: number, flare: number): void {
    if (this.disposed) return;
    const factor = Number.isFinite(opacity) ? Math.min(1, Math.max(0, opacity)) : 1;
    if (factor >= 1) {
      this.restoreOriginals();
    } else {
      const entries = this.ensureEntries();
      if (!this.usingClones) {
        this.usingClones = true;
        for (let i = 0; i < entries.length; i++) {
          const entry = entries[i];
          entry.object.material = Array.isArray(entry.original) ? entry.clones : entry.clones[0];
        }
      }
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        for (let j = 0; j < entry.clones.length; j++) {
          entry.clones[j].opacity = entry.baseOpacity[j] * factor;
        }
      }
    }

    const glow = Number.isFinite(flare) ? Math.min(1, Math.max(0, flare)) : 0;
    if (glow > 0.01) {
      // 眼灯挂在机体下：除以机体缩放，得到固定的世界尺寸
      const rootScale = Math.abs(this.root.scale.x) > 1e-6 ? Math.abs(this.root.scale.x) : 1;
      const radius = FLARE_RADIUS_MIN + (FLARE_RADIUS_MAX - FLARE_RADIUS_MIN) * glow;
      this.flare.scale.setScalar(radius / rootScale);
      this.flareMaterial.opacity = 0.3 + 0.6 * glow;
      this.flare.visible = true;
    } else {
      this.flare.visible = false;
    }
  }

  /** 是否正在使用克隆材质（淡出 / 隐形 / 淡入中） */
  public isFading(): boolean {
    return this.usingClones;
  }

  private restoreOriginals(): void {
    if (!this.usingClones || !this.entries) return;
    this.usingClones = false;
    for (let i = 0; i < this.entries.length; i++) {
      const entry = this.entries[i];
      entry.object.material = entry.original;
    }
  }

  private ensureEntries(): FadeEntry[] {
    if (this.entries) return this.entries;
    const entries: FadeEntry[] = [];
    this.root.traverse((object) => {
      if (object === this.flare || !isFadeable(object)) return;
      const original = object.material;
      const sources = Array.isArray(original) ? original : [original];
      const clones: THREE.Material[] = [];
      const baseOpacity: number[] = [];
      for (const source of sources) {
        const clone = source.clone();
        clone.transparent = true;
        clone.depthWrite = false;
        clones.push(clone);
        baseOpacity.push(Number.isFinite(source.opacity) ? source.opacity : 1);
      }
      entries.push({ object, original, clones, baseOpacity });
    });
    this.entries = entries;
    return entries;
  }

  public dispose(): void {
    if (this.disposed) return;
    this.restoreOriginals();
    this.disposed = true;
    if (this.entries) {
      for (const entry of this.entries) {
        for (const clone of entry.clones) clone.dispose();
      }
      this.entries = null;
    }
    this.root.remove(this.flare);
    this.flareGeometry.dispose();
    this.flareMaterial.dispose();
  }
}
