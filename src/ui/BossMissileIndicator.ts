import { Quaternion, Vector3 } from 'three';
import type { Camera } from 'three';
import {
  CHEVRON_EDGE_PADDING,
  CHEVRON_EXIT_NONE,
  ChevronAvoidance,
  type ChevronAvoidExit,
} from '@/ui/ChevronAvoidance';
import { OffscreenChevron, measureChevronFootprint } from '@/ui/OffscreenChevron';
import { HUD_COLORS } from '@/ui/theme/hudTokens';

interface MissileIndicatorEntry {
  chevron: OffscreenChevron;
  /** 这枚箭头上一次避让走的出口（滞回用） */
  exit: ChevronAvoidExit;
}

export class BossMissileIndicator {
  private container: HTMLDivElement;
  private initialized: boolean = false;
  private indicators: Map<string, MissileIndicatorEntry> = new Map();
  /** 雷达盘 / 触控控件 / HUD 面板都叠在这一层之上：箭头按 ChevronAvoidance 的规则避开它们 */
  private readonly avoidance = new ChevronAvoidance();
  /** 上一次 update 是否有屏幕外的导弹（没有的时候不量避让区） */
  private hadOffscreenMissile: boolean = false;
  private readonly styleValueCache = new WeakMap<HTMLElement, Map<string, string>>();
  private readonly fromCamera = new Vector3();
  private readonly cameraLocal = new Vector3();
  private readonly invertedCameraQuaternion = new Quaternion();

  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'boss-missile-indicators';
    this.container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 46;
    `;
  }

  public init(): void {
    if (this.initialized) {
      return;
    }

    document.body.appendChild(this.container);
    this.avoidance.attach();
    this.initialized = true;
  }

  public update(
    missiles: Array<{
      id: string;
      worldPos: Vector3;
      distance: number;
      inView: boolean;
    }>,
    camera: Camera
  ): void {
    this.init();

    const activeIds = new Set(missiles.map((m) => m.id));

    for (const [id, indicator] of this.indicators) {
      if (!activeIds.has(id)) {
        indicator.chevron.dispose();
        this.indicators.delete(id);
      }
    }

    // 避让区只在有箭头要摆的时候才量；隔了一段没量之后，第一枚箭头出现时立即重量
    let hasOffscreenMissile = false;
    for (const missile of missiles) {
      if (!missile.inView) {
        hasOffscreenMissile = true;
        break;
      }
    }
    if (hasOffscreenMissile) {
      if (!this.hadOffscreenMissile) {
        this.avoidance.invalidate();
      }
      this.avoidance.refresh();
    }
    this.hadOffscreenMissile = hasOffscreenMissile;

    for (const missile of missiles) {
      if (missile.inView) {
        this.hideIndicator(missile.id);
      } else {
        this.showOrUpdateIndicator(missile, camera);
      }
    }
  }

  private showOrUpdateIndicator(
    missile: {
      id: string;
      worldPos: Vector3;
      distance: number;
    },
    camera: Camera
  ): void {
    let indicator = this.indicators.get(missile.id);

    if (!indicator) {
      indicator = { chevron: this.createIndicator(), exit: CHEVRON_EXIT_NONE };
      this.container.appendChild(indicator.chevron.element);
      this.indicators.set(missile.id, indicator);
    }

    const { arrowX, arrowY, rotation } = this.calculateIndicatorPosition(missile.worldPos, camera);

    // 整枚箭头（含距离标签）移出遮挡它的控件 / 面板，并留在屏幕内
    const avoidance = this.avoidance;
    measureChevronFootprint(rotation, missile.distance, avoidance.footprint, 'missile');
    avoidance.resolve(arrowX * window.innerWidth, arrowY * window.innerHeight, indicator.exit);
    if (!Number.isFinite(avoidance.x) || !Number.isFinite(avoidance.y)) {
      // 位置算不出来（坐标非有限）：这一帧不显示
      this.hideIndicator(missile.id);
      return;
    }
    indicator.exit = avoidance.exit;

    const element = indicator.chevron.element;
    this.setStyleValue(element, 'left', `${Math.round(avoidance.x)}px`);
    this.setStyleValue(element, 'top', `${Math.round(avoidance.y)}px`);
    this.setStyleValue(element, 'display', 'flex');
    this.setStyleValue(element, 'opacity', '1');
    this.setStyleValue(element, 'visibility', 'visible');
    indicator.chevron.update({
      rotationDeg: rotation,
      distance: missile.distance,
      kind: 'missile',
    });
  }

  private setStyleValue(element: HTMLElement, property: string, value: string): void {
    let cache = this.styleValueCache.get(element);
    if (!cache) {
      cache = new Map<string, string>();
      this.styleValueCache.set(element, cache);
    }

    if (cache.get(property) === value) {
      return;
    }

    const style = element.style as CSSStyleDeclaration & Record<string, string>;
    style[property] = value;
    cache.set(property, value);
  }

  private createIndicator(): OffscreenChevron {
    const chevron = new OffscreenChevron({ color: HUD_COLORS.threat });
    chevron.element.classList.add('boss-missile-indicator');
    chevron.element.style.display = 'none';
    chevron.element.style.opacity = '0';
    chevron.element.style.visibility = 'hidden';
    return chevron;
  }

  private calculateIndicatorPosition(
    worldPos: Vector3,
    camera: Camera
  ): { arrowX: number; arrowY: number; rotation: number } {
    const centerX = 0.5;
    const centerY = 0.5;
    const edgePadding = CHEVRON_EDGE_PADDING;

    // 使用相机位置计算方向向量
    this.fromCamera.copy(worldPos).sub(camera.position);
    this.invertedCameraQuaternion.copy(camera.quaternion).invert();
    this.cameraLocal.copy(this.fromCamera).applyQuaternion(this.invertedCameraQuaternion);

    const isOnRight = this.cameraLocal.x > 0;
    const isAbove = this.cameraLocal.y > 0;
    const isBehind = this.cameraLocal.z < 0;

    const absZ = Math.max(Math.abs(this.cameraLocal.z), 0.001);
    const angleH = Math.atan2(this.cameraLocal.x, absZ);
    const angleV = Math.atan2(this.cameraLocal.y, absZ);

    const maxAngleH = Math.PI / 4;
    const maxAngleV = Math.PI / 5;

    let arrowX: number;
    let arrowY: number;

    // 屏幕Y轴向下为正（Y=0是顶部，Y=1是底部）
    if (isBehind) {
      if (Math.abs(this.cameraLocal.y) > Math.abs(this.cameraLocal.x)) {
        arrowY = isAbove ? edgePadding : 1 - edgePadding;
        const hRatio = Math.min(1, Math.abs(angleH) / maxAngleH);
        arrowX = centerX + (isOnRight ? hRatio : -hRatio) * (0.5 - edgePadding);
      } else {
        arrowX = isOnRight ? 1 - edgePadding : edgePadding;
        const vRatio = Math.min(1, Math.abs(angleV) / maxAngleV);
        arrowY = centerY + (isAbove ? -vRatio : vRatio) * (0.5 - edgePadding);
      }
    } else {
      const normalizedH = Math.max(-1, Math.min(1, angleH / maxAngleH));
      const normalizedV = Math.max(-1, Math.min(1, angleV / maxAngleV));

      arrowX = centerX + normalizedH * (0.5 - edgePadding);
      arrowY = centerY - normalizedV * (0.5 - edgePadding);

      if (Math.abs(normalizedH) >= 1 || Math.abs(normalizedV) >= 1) {
        const slope = Math.abs(angleV) / (Math.abs(angleH) + 0.001);
        if (slope > 1) {
          arrowY = isAbove ? edgePadding : 1 - edgePadding;
          const hPos = centerX + (isOnRight ? 1 : -1) * (1 / slope) * (0.5 - edgePadding);
          arrowX = Math.max(edgePadding, Math.min(1 - edgePadding, hPos));
        } else {
          arrowX = isOnRight ? 1 - edgePadding : edgePadding;
          const vPos = centerY + (isAbove ? -1 : 1) * slope * (0.5 - edgePadding);
          arrowY = Math.max(edgePadding, Math.min(1 - edgePadding, vPos));
        }
      }
    }

    // SVG 箭头默认指向上方（0度）
    // atan2(x, y) 给出正确的旋转角度
    const rotation = Math.atan2(this.cameraLocal.x, this.cameraLocal.y) * (180 / Math.PI);

    return { arrowX, arrowY, rotation };
  }

  private hideIndicator(id: string): void {
    const indicator = this.indicators.get(id);
    if (indicator) {
      const element = indicator.chevron.element;
      this.setStyleValue(element, 'display', 'none');
      this.setStyleValue(element, 'opacity', '0');
      this.setStyleValue(element, 'visibility', 'hidden');
      this.setStyleValue(element, 'left', '50%');
      this.setStyleValue(element, 'top', '50%');
      indicator.exit = CHEVRON_EXIT_NONE;
    }
  }

  public clear(): void {
    for (const indicator of this.indicators.values()) {
      indicator.chevron.dispose();
    }
    this.indicators.clear();
    this.hadOffscreenMissile = false;
  }

  public dispose(): void {
    this.avoidance.detach();
    this.clear();
    if (this.container.parentElement) {
      this.container.remove();
    }
    this.initialized = false;
  }
}
