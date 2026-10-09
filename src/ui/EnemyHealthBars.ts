import { Quaternion, Vector3 } from 'three';
import type { Camera, Object3D } from 'three';
import { Faction } from '@/core/Faction';
import { BOSS_CONFIGS, BossType, getBossForLevel } from '@/features/boss/BossTypes';
import { getCampaignChapter } from '@/features/campaign/CampaignData';
import { ENEMY_CONFIGS, EnemyType } from '@/features/enemy/EnemyTypes';
import { getLocale, onLocaleChange, tr, type Locale, type LocalizedText } from '@/i18n';
import { OffscreenChevron } from '@/ui/OffscreenChevron';
import { HUD_COLORS } from '@/ui/theme/hudTokens';

const CAMERA_POSITION_THRESHOLD_SQ = 0.01;
const PLAYER_POSITION_THRESHOLD_SQ = 0.01;
const TARGET_POSITION_THRESHOLD_SQ = 0.01;
const CAMERA_ROTATION_THRESHOLD = 0.0025;
const HEALTH_PERCENT_THRESHOLD = 0.001;

/** 兜底标签（按界面语言取值） */
const FALLBACK_ENEMY_LABEL: LocalizedText = { en: 'Hostile', zh: '敌方目标' };
const FALLBACK_FRIENDLY_LABEL: LocalizedText = { en: 'Friendly', zh: '友军' };
/** 友军敌机型号：“友军” + 型号名 */
const FRIENDLY_TYPE_LABEL: LocalizedText = { en: 'Allied {type}', zh: '友军{type}' };

/**
 * Boss 部件网格名前缀 → 标签（第三关的眼睛、第 6-10 关带独立血量的子目标）。
 * 用语与 CampaignData 的 Boss 简报 / 弱点提示一致。
 */
const BOSS_PART_LABELS: ReadonlyArray<readonly [prefix: string, label: LocalizedText]> = [
  ['boss_eye', { en: 'Tentacle Eye', zh: '触手之眼' }],
  ['colossus_vent', { en: 'Heat Vent', zh: '散热口' }],
  ['leviathan_sail', { en: 'Conning Tower', zh: '指挥塔' }],
  ['leviathan_ballast_tank', { en: 'Ballast Tank', zh: '压载舱' }],
  ['leviathan_missile_bay', { en: 'Missile Bay', zh: '导弹舱' }],
  ['zeppelin_gas_cell', { en: 'Gas Cell', zh: '气囊' }],
  ['zeppelin_hangar', { en: 'Drone Hangar', zh: '无人机舱' }],
  ['phantom_phase_emitter', { en: 'Phase Emitter', zh: '相位发射器' }],
  ['oracle_pylon', { en: 'Shield Pylon', zh: '护盾塔' }],
];

/**
 * Boss 根节点名（BOSS_<类型>）→ 名称：取战役简报里的 Boss 名（与 Boss 登场简报卡片一致），
 * 不在战役里的类型退回 BossTypes 配置名（去掉 “Boss” 后缀）。
 */
function buildBossLabels(): ReadonlyMap<string, string> {
  const labels = new Map<string, string>();
  for (let level = 1; ; level++) {
    const type = getBossForLevel(level);
    if (!type) break;
    const name = tr(getCampaignChapter(level).boss.name);
    if (name) labels.set(`BOSS_${type}`, name);
  }
  for (const type of Object.values(BossType)) {
    const key = `BOSS_${type}`;
    if (!labels.has(key)) {
      labels.set(
        key,
        tr(BOSS_CONFIGS[type].name).replace(/\s*Boss$/i, '') || tr(FALLBACK_ENEMY_LABEL)
      );
    }
  }
  return labels;
}

/** Boss 名表按语言缓存：切换语言后下一次查询重建 */
let bossLabels: ReadonlyMap<string, string> | null = null;
let bossLabelsLocale: Locale | null = null;

function isEnemyType(name: string): name is EnemyType {
  return Object.prototype.hasOwnProperty.call(ENEMY_CONFIGS, name);
}

function isLocalizedText(value: unknown): value is LocalizedText {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as LocalizedText).en === 'string' &&
    typeof (value as LocalizedText).zh === 'string'
  );
}

/**
 * 友军 AI 战机的飞行员呼号（运行时写在 mesh.userData.displayName，双语对象或字符串）。
 * 每帧调用：只挑字段，不分配。
 */
function readDisplayName(mesh: Object3D): string | null {
  const value: unknown = mesh.userData.displayName;
  if (isLocalizedText(value)) {
    return tr(value) || null;
  }
  return typeof value === 'string' && value ? value : null;
}

/**
 * 解析血条标签：Boss 本体 → 战役名；Boss 部件 → 部件名；敌机（含 Boss 召唤的敌机）→
 * ENEMY_CONFIGS 型号名（友军加“友军”前缀）；地面 / 海上 / 空中单位（UNIT_*）→ 按阵营的通用名。
 */
function resolveTargetLabel(mesh: Object3D, isFriendly: boolean): string {
  const name = mesh.name || '';
  if (name.startsWith('BOSS_')) {
    const locale = getLocale();
    if (!bossLabels || bossLabelsLocale !== locale) {
      bossLabels = buildBossLabels();
      bossLabelsLocale = locale;
    }
    return bossLabels.get(name) ?? tr(FALLBACK_ENEMY_LABEL);
  }
  for (const [prefix, label] of BOSS_PART_LABELS) {
    if (name.startsWith(prefix)) return tr(label);
  }
  if (isEnemyType(name)) {
    const typeName = tr(ENEMY_CONFIGS[name].name);
    return isFriendly ? tr(FRIENDLY_TYPE_LABEL, { type: typeName }) : typeName;
  }
  if (name.startsWith('UNIT_') || mesh.userData.unitType !== undefined) {
    const faction: unknown = mesh.userData.faction;
    if (isFriendly || faction === Faction.FRIENDLY) {
      return tr({ en: 'Friendly unit', zh: '友军单位' });
    }
    if (faction === Faction.CIVILIAN) return tr({ en: 'Civilian', zh: '民用目标' });
    return tr({ en: 'Hostile unit', zh: '敌方单位' });
  }
  return tr(isFriendly ? FALLBACK_FRIENDLY_LABEL : FALLBACK_ENEMY_LABEL);
}

function isFiniteVector(v: Vector3): boolean {
  return Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
}

/**
 * 敌人血条管理器
 * 为每个敌人显示血条
 */
export class EnemyHealthBars {
  private container: HTMLDivElement;
  private initialized: boolean = false;
  private healthBars: Map<
    string,
    {
      bar: HTMLDivElement;
      background: HTMLDivElement;
      targetName: HTMLSpanElement;
      chevron: OffscreenChevron | null;
      screenPos: { x: number; y: number; z: number } | null; // 缓存屏幕位置
      lastBarWorldPosition: Vector3;
      lastHealthPercent: number;
      /** null：上一帧因坐标 / 距离非有限而隐藏，下一帧强制刷新 */
      wasInView: boolean | null;
      /** 换语言后名字还没重写（下一次更新即使什么都没动也重写） */
      labelDirty: boolean;
      /** 目标网格与阵营（换语言时立即重算名字，暂停中也生效） */
      mesh: Object3D;
      isFriendly: boolean;
      barWidth: number;
    }
  > = new Map();
  private unsubscribeLocale: (() => void) | null = null;
  /** 网格名 → 血条标签（敌方 / 友军分开缓存；缓存属于 labelLocale，换语言时清空） */
  private readonly enemyLabelCache = new Map<string, string>();
  private readonly friendlyLabelCache = new Map<string, string>();
  private labelLocale: Locale | null = null;
  private readonly textContentCache = new WeakMap<HTMLElement, string>();
  private readonly styleValueCache = new WeakMap<HTMLElement, Map<string, string>>();
  private readonly worldPosition = new Vector3();
  private readonly barWorldPosition = new Vector3();
  private readonly screenVector = new Vector3();
  private readonly cameraLocal = new Vector3();
  private readonly invertedCameraQuaternion = new Quaternion();
  private readonly lastCameraPosition = new Vector3();
  private readonly lastCameraQuaternion = new Quaternion();
  private readonly lastPlayerPosition = new Vector3();
  private cameraStateInitialized: boolean = false;

  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'enemy-health-bars';
    this.container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 35;
    `;
  }

  public init(): void {
    if (this.initialized) {
      return;
    }

    document.body.appendChild(this.container);
    // 切换语言立即重写现有血条的名字（暂停时游戏不调用 update，也要换）
    this.unsubscribeLocale ??= onLocaleChange(() => this.relabelAll());
    this.initialized = true;
  }

  /**
   * 更新敌人血条
   * @param enemies 敌人列表，包含位置、血量等信息
   * @param friendlies 友军列表，包含位置、血量等信息
   * @param camera 相机
   * @param playerPosition 玩家位置
   */
  public update(
    enemies: Array<{
      mesh: Object3D;
      currentHealth: number;
      maxHealth: number;
    }>,
    friendlies: Array<{
      mesh: Object3D;
      currentHealth: number;
      maxHealth: number;
    }>,
    camera: Camera,
    playerPosition: Vector3
  ): void {
    this.init();
    this.syncLabelLocale();

    const cameraMoved =
      !this.cameraStateInitialized ||
      this.lastCameraPosition.distanceToSquared(camera.position) > CAMERA_POSITION_THRESHOLD_SQ ||
      this.lastCameraQuaternion.angleTo(camera.quaternion) > CAMERA_ROTATION_THRESHOLD;
    const playerMoved =
      !this.cameraStateInitialized ||
      this.lastPlayerPosition.distanceToSquared(playerPosition) > PLAYER_POSITION_THRESHOLD_SQ;

    const enemyIds = new Set(enemies.map((e) => e.mesh.uuid));
    const friendlyIds = new Set(friendlies.map((f) => f.mesh.uuid));
    const activeIds = new Set([...enemyIds, ...friendlyIds]);

    // 移除不存在的血条
    for (const [id] of this.healthBars) {
      if (!activeIds.has(id)) {
        this.removeHealthBar(id);
      }
    }

    // 更新或创建敌人血条
    for (const enemy of enemies) {
      this.updateOrCreateHealthBar(enemy, camera, playerPosition, cameraMoved, playerMoved, false);
    }

    // 更新或创建友军血条
    for (const friendly of friendlies) {
      this.updateOrCreateHealthBar(
        friendly,
        camera,
        playerPosition,
        cameraMoved,
        playerMoved,
        true
      );
    }

    this.lastCameraPosition.copy(camera.position);
    this.lastCameraQuaternion.copy(camera.quaternion);
    // 非有限的玩家坐标不进缓存，否则之后的“玩家是否移动”判断会一直为 false
    if (isFiniteVector(playerPosition)) {
      this.lastPlayerPosition.copy(playerPosition);
    }
    this.cameraStateInitialized = true;
  }

  /** 界面语言变了：清空标签缓存，并让现有血条在本帧重写名字 */
  private syncLabelLocale(): void {
    const locale = getLocale();
    if (locale === this.labelLocale) {
      return;
    }
    this.labelLocale = locale;
    this.enemyLabelCache.clear();
    this.friendlyLabelCache.clear();
    for (const barData of this.healthBars.values()) {
      barData.lastHealthPercent = Number.NaN;
      barData.labelDirty = true;
    }
  }

  /** 语言切换：清空标签缓存并立即按新语言重写每个血条的名字 */
  private relabelAll(): void {
    this.syncLabelLocale();
    for (const barData of this.healthBars.values()) {
      this.writeTargetName(barData, this.getTargetName(barData.mesh, barData.isFriendly));
      barData.labelDirty = false;
    }
  }

  /** 写名字；文字变了时重新居中 */
  private writeTargetName(
    barData: { targetName: HTMLSpanElement; barWidth: number },
    name: string
  ): void {
    if (this.setTextContent(barData.targetName, name)) {
      const textWidth = barData.targetName.offsetWidth;
      const centeredLeft = (barData.barWidth - textWidth) / 2;
      this.setStyleValue(barData.targetName, 'left', `${centeredLeft}px`);
    }
  }

  /**
   * 获取目标的实际世界坐标
   */
  private getTargetWorldPosition(mesh: Object3D, target: Vector3): Vector3 {
    mesh.getWorldPosition(target);
    return target;
  }

  private setTextContent(element: HTMLElement, text: string): boolean {
    if (this.textContentCache.get(element) === text) {
      return false;
    }

    element.textContent = text;
    this.textContentCache.set(element, text);
    return true;
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

  /**
   * 更新或创建血条
   */
  private updateOrCreateHealthBar(
    enemy: {
      mesh: Object3D;
      currentHealth: number;
      maxHealth: number;
    },
    camera: Camera,
    playerPosition: Vector3,
    cameraMoved: boolean,
    playerMoved: boolean,
    isFriendly: boolean = false
  ): void {
    const id = enemy.mesh.uuid;
    let barData = this.healthBars.get(id);

    const name = enemy.mesh.name || '';
    const isBoss = name.includes('BOSS') || name.includes('boss_eye');
    const barWidth = isBoss ? 120 : 60;

    const worldPos = this.getTargetWorldPosition(enemy.mesh, this.worldPosition);
    this.barWorldPosition.copy(worldPos);
    this.barWorldPosition.y += this.getBarHeightOffset(enemy.mesh);

    // 目标坐标非有限（NaN / Infinity）：本帧隐藏血条与箭头，不创建、不缓存非有限值
    if (!isFiniteVector(this.barWorldPosition)) {
      if (barData) {
        this.setStyleValue(barData.bar, 'display', 'none');
        if (barData.chevron) {
          this.resetArrowIndicator(barData.chevron);
        }
        barData.wasInView = null;
      }
      return;
    }

    if (!barData) {
      const bar = this.createHealthBar();
      const background = this.createBackgroundBar(barWidth, isBoss);
      const targetName = this.createTargetName(isFriendly, isBoss);
      const chevron = isFriendly ? null : this.createArrowIndicator();

      bar.appendChild(background);
      bar.appendChild(targetName);
      this.container.appendChild(bar);
      if (chevron) {
        this.container.appendChild(chevron.element);
      }

      barData = {
        bar,
        background,
        targetName,
        chevron,
        screenPos: null,
        lastBarWorldPosition: this.barWorldPosition.clone(),
        lastHealthPercent: Number.NaN,
        wasInView: false,
        labelDirty: false,
        mesh: enemy.mesh,
        isFriendly,
        barWidth,
      };
      this.healthBars.set(id, barData);
    }
    barData.mesh = enemy.mesh;
    barData.isFriendly = isFriendly;

    const healthPercent = enemy.currentHealth / enemy.maxHealth;
    const targetMoved =
      barData.lastBarWorldPosition.distanceToSquared(this.barWorldPosition) >
      TARGET_POSITION_THRESHOLD_SQ;
    const needsHealthUpdate =
      Math.abs(barData.lastHealthPercent - healthPercent) > HEALTH_PERCENT_THRESHOLD;
    const shouldRecalculateScreen = !barData.screenPos || cameraMoved || targetMoved;

    let screenPos = barData.screenPos;
    if (!screenPos || shouldRecalculateScreen) {
      const projected = this.worldToScreen(this.barWorldPosition, camera);
      if (screenPos) {
        screenPos.x = projected.x;
        screenPos.y = projected.y;
        screenPos.z = projected.z;
      } else {
        screenPos = { ...projected };
        barData.screenPos = screenPos;
      }
    }

    const inView =
      screenPos.x >= 0 &&
      screenPos.x <= 1 &&
      screenPos.y >= 0 &&
      screenPos.y <= 1 &&
      screenPos.z < 1;
    const visibilityChanged = inView !== barData.wasInView;
    const needsPositionUpdate = inView && (visibilityChanged || cameraMoved || targetMoved);
    const needsArrowUpdate =
      !inView && (visibilityChanged || cameraMoved || targetMoved || playerMoved);

    if (
      !needsHealthUpdate &&
      !needsPositionUpdate &&
      !needsArrowUpdate &&
      !visibilityChanged &&
      !barData.labelDirty
    ) {
      return;
    }
    // 不在视野内的血条名字不可见：进入视野时（visibilityChanged）会按当前语言重写
    barData.labelDirty = false;

    const color = this.getHealthColor(healthPercent);
    let distanceHidden = false;

    if (inView) {
      const barWidth = isBoss ? 120 : 60;
      const barHeight = isBoss ? 10 : 6;

      this.setStyleValue(barData.bar, 'display', 'block');
      if (barData.chevron) {
        this.resetArrowIndicator(barData.chevron);
      }

      if (needsPositionUpdate) {
        const { x, y } = this.getBarPositionFromScreen(screenPos, barWidth, barHeight);
        this.setStyleValue(barData.bar, 'left', `${x}px`);
        this.setStyleValue(barData.bar, 'top', `${y}px`);
      }

      if (needsHealthUpdate || visibilityChanged) {
        this.setStyleValue(barData.background, 'background', color);
        this.setStyleValue(barData.background, 'width', `${barWidth * healthPercent}px`);
      }

      this.writeTargetName(barData, this.getTargetName(enemy.mesh, isFriendly));
    } else {
      this.setStyleValue(barData.bar, 'display', 'none');
      if (barData.chevron) {
        const distance = playerPosition.distanceTo(worldPos);
        if (!Number.isFinite(distance)) {
          // 距离非有限（玩家坐标异常）：本帧隐藏箭头而不是显示 "NaNm"，下一帧强制刷新
          this.resetArrowIndicator(barData.chevron);
          distanceHidden = true;
        } else {
          this.setStyleValue(barData.chevron.element, 'display', 'flex');
          this.setStyleValue(barData.chevron.element, 'opacity', '1');
          this.setStyleValue(barData.chevron.element, 'visibility', 'visible');
          if (needsArrowUpdate) {
            // 使用相机位置计算方向向量，而不是玩家位置
            // 因为箭头指示器是相对于相机视野的方向
            this.cameraLocal.copy(worldPos).sub(camera.position);
            this.invertedCameraQuaternion.copy(camera.quaternion).invert();
            this.cameraLocal.applyQuaternion(this.invertedCameraQuaternion);
            this.updateArrowIndicator(barData.chevron, this.cameraLocal, distance);
          }
        }
      }
    }

    barData.lastBarWorldPosition.copy(this.barWorldPosition);
    barData.lastHealthPercent = healthPercent;
    barData.wasInView = distanceHidden ? null : inView;
  }

  /**
   * 创建血条容器
   */
  private createHealthBar(): HTMLDivElement {
    const bar = document.createElement('div');
    bar.className = 'enemy-health-bar';
    bar.style.cssText = `
      position: absolute;
      display: none;
      pointer-events: none;
    `;
    return bar;
  }

  /**
   * 创建血条背景
   */
  private createBackgroundBar(width: number, isBoss: boolean = false): HTMLDivElement {
    const background = document.createElement('div');
    background.className = 'health-bar-background';
    const height = isBoss ? 10 : 6;
    background.style.cssText = `
      width: ${width}px;
      height: ${height}px;
      background: rgba(0, 0, 0, 0.6);
      border-radius: 3px;
      border: 2px solid rgba(255, 255, 255, 0.5);
      position: absolute;
      bottom: 0;
      left: 0;
      transition: width 0.2s, background 0.2s;
      box-shadow: 0 0 8px rgba(0, 0, 0, 0.8), inset 0 0 4px rgba(0, 0, 0, 0.5);
    `;
    return background;
  }

  /**
   * 创建目标名称标签
   */
  private createTargetName(isFriendly: boolean = false, isBoss: boolean = false): HTMLSpanElement {
    const name = document.createElement('span');
    name.className = 'enemy-name';
    const fontSize = isBoss ? 16 : 12;
    const color = isBoss ? '#ff4444' : isFriendly ? '#ffff00' : '#ffffff';
    name.style.cssText = `
      font-size: ${fontSize}px;
      font-weight: bold;
      white-space: nowrap;
      position: absolute;
      bottom: 100%;
      left: 0;
      margin-bottom: 4px;
      color: ${color};
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.9),
                   -1px -1px 2px rgba(0, 0, 0, 0.8);
    `;
    return name;
  }

  /**
   * 创建屏幕外指向箭头（琥珀色敌人威胁）
   */
  private createArrowIndicator(): OffscreenChevron {
    const chevron = new OffscreenChevron({ color: HUD_COLORS.weapon });
    chevron.element.classList.add('enemy-arrow-indicator');
    chevron.element.style.display = 'none';
    chevron.element.style.opacity = '0';
    chevron.element.style.visibility = 'hidden';
    return chevron;
  }

  /**
   * 更新箭头指示器位置和方向
   * 使用相机局部坐标系进行角度计算，正确处理敌人在相机后面或下方的情况
   */
  private updateArrowIndicator(
    chevron: OffscreenChevron,
    cameraLocal: Vector3,
    distance: number
  ): void {
    const centerX = 0.5;
    const centerY = 0.5;
    const edgePadding = 0.08;

    const isOnRight = cameraLocal.x > 0;
    const isAbove = cameraLocal.y > 0;
    const isBehind = cameraLocal.z < 0;

    // 计算水平角和垂直角（相对于相机前方向）
    // 使用 z 的绝对值来避免 z 为负时角度符号错误
    const absZ = Math.max(Math.abs(cameraLocal.z), 0.001);
    const angleH = Math.atan2(cameraLocal.x, absZ);
    const angleV = Math.atan2(cameraLocal.y, absZ);

    // 相机 FOV 相关的最大角度（假设水平 90°，垂直 60°）
    const maxAngleH = Math.PI / 4; // 45° 水平半角
    const maxAngleV = Math.PI / 5; // 36° 垂直半角

    let arrowX: number;
    let arrowY: number;

    // 计算箭头位置：将角度映射到屏幕边缘
    // 注意：屏幕 Y 轴向下为正（Y=0 是顶部，Y=1 是底部）
    if (isBehind) {
      // 敌人在后面：箭头放在对应方向的边缘
      if (Math.abs(cameraLocal.y) > Math.abs(cameraLocal.x)) {
        // 更偏上/下：isAbove=true → 敌人在相机上方 → 箭头放屏幕顶部(edgePadding)
        arrowY = isAbove ? edgePadding : 1 - edgePadding;
        const hRatio = Math.min(1, Math.abs(angleH) / maxAngleH);
        arrowX = centerX + (isOnRight ? hRatio : -hRatio) * (0.5 - edgePadding);
      } else {
        // 更偏左/右
        arrowX = isOnRight ? 1 - edgePadding : edgePadding;
        const vRatio = Math.min(1, Math.abs(angleV) / maxAngleV);
        // isAbove=true → 敌人在上方 → 箭头 Y 值应该更小（靠近顶部）
        arrowY = centerY + (isAbove ? -vRatio : vRatio) * (0.5 - edgePadding);
      }
    } else {
      // 敌人在前面但不在视野内：将角度映射到屏幕位置
      const normalizedH = Math.max(-1, Math.min(1, angleH / maxAngleH));
      const normalizedV = Math.max(-1, Math.min(1, angleV / maxAngleV));

      arrowX = centerX + normalizedH * (0.5 - edgePadding);
      // normalizedV > 0 表示敌人在上方 → arrowY 应该更小（靠近顶部）
      arrowY = centerY - normalizedV * (0.5 - edgePadding);

      // 如果超出视野，钳制到最近的边缘
      if (Math.abs(normalizedH) >= 1 || Math.abs(normalizedV) >= 1) {
        const slope = Math.abs(angleV) / (Math.abs(angleH) + 0.001);
        if (slope > 1) {
          // 上下边缘：isAbove=true → 敌人在上方 → 箭头放屏幕顶部
          arrowY = isAbove ? edgePadding : 1 - edgePadding;
          const hPos = centerX + (isOnRight ? 1 : -1) * (1 / slope) * (0.5 - edgePadding);
          arrowX = Math.max(edgePadding, Math.min(1 - edgePadding, hPos));
        } else {
          // 左右边缘
          arrowX = isOnRight ? 1 - edgePadding : edgePadding;
          const vPos = centerY + (isAbove ? -1 : 1) * slope * (0.5 - edgePadding);
          arrowY = Math.max(edgePadding, Math.min(1 - edgePadding, vPos));
        }
      }
    }

    // 箭头默认指向上方（CSS border-bottom 三角形尖端朝上）
    // atan2(x, y) 给出正确的旋转角度：
    // - 上方 (y>0): atan2(0, 1) = 0°
    // - 下方 (y<0): atan2(0, -1) = 180°
    // - 右方 (x>0): atan2(1, 0) = 90°
    // - 左方 (x<0): atan2(-1, 0) = -90°
    const rotationAngle = Math.atan2(cameraLocal.x, cameraLocal.y) * (180 / Math.PI);

    const arrow = chevron.element;
    this.setStyleValue(arrow, 'left', `${arrowX * 100}%`);
    this.setStyleValue(arrow, 'top', `${arrowY * 100}%`);
    chevron.update({
      rotationDeg: rotationAngle,
      distance,
      kind: 'enemy',
    });
  }

  private resetArrowIndicator(chevron: OffscreenChevron): void {
    const arrow = chevron.element;
    this.setStyleValue(arrow, 'display', 'none');
    this.setStyleValue(arrow, 'opacity', '0');
    this.setStyleValue(arrow, 'visibility', 'hidden');
    this.setStyleValue(arrow, 'left', '50%');
    this.setStyleValue(arrow, 'top', '50%');
  }

  /**
   * 世界坐标转屏幕坐标
   */
  private worldToScreen(position: Vector3, camera: Camera): { x: number; y: number; z: number } {
    this.screenVector.copy(position).project(camera);

    // NDC: x, y 范围是 -1 到 1
    // 屏幕: x 范围 0 到 width, y 范围 0 到 height (Y 向下为正)
    return {
      x: (this.screenVector.x + 1) / 2,
      y: 1 - (this.screenVector.y + 1) / 2, // 反转 Y 轴，因为屏幕 Y 向下为正
      z: this.screenVector.z,
    };
  }

  /**
   * 根据血量百分比获取颜色 - 优化版
   */
  private getHealthColor(percent: number): string {
    if (percent > 0.6) {
      // 高血量：绿色渐变
      return 'linear-gradient(90deg, #00ff66, #00ff33, #00cc00)';
    } else if (percent > 0.3) {
      // 中高血量：黄绿色渐变
      return 'linear-gradient(90deg, #ffcc00, #ffdd00, #88aa00)';
    } else if (percent > 0.15) {
      // 低血量：橙色渐变
      return 'linear-gradient(90deg, #ff9900, #ffcc00, #ffaa00)';
    } else {
      // 危低血量：红色渐变
      return 'linear-gradient(90deg, #ff3300, #cc0000, #ff0000)';
    }
  }

  /**
   * 获取目标名称（敌人和友军）；按网格名缓存，逐帧不重复解析
   */
  private getTargetName(mesh: Object3D, isFriendly: boolean): string {
    // 友军 AI 战机带飞行员呼号时直接显示呼号（僚机可能共用同一网格名，不能按名缓存）
    if (isFriendly) {
      const callsign = readDisplayName(mesh);
      if (callsign) {
        return callsign;
      }
    }
    const key = mesh.name;
    if (!key) {
      return resolveTargetLabel(mesh, isFriendly);
    }
    const cache = isFriendly ? this.friendlyLabelCache : this.enemyLabelCache;
    let label = cache.get(key);
    if (label === undefined) {
      label = resolveTargetLabel(mesh, isFriendly);
      cache.set(key, label);
    }
    return label;
  }

  private getBarHeightOffset(enemyMesh: Object3D): number {
    const name = enemyMesh.name || '';
    const isBoss = name.includes('BOSS');
    const isEye = name.includes('boss_eye');
    return isBoss ? 15 : isEye ? 5 : 2;
  }

  private getBarPositionFromScreen(
    screenPos: { x: number; y: number },
    barWidth: number,
    barHeight: number
  ): { x: number; y: number } {
    const offsetX = barWidth / 2;
    const offsetY = barHeight + 15;

    return {
      x: screenPos.x * window.innerWidth - offsetX,
      y: screenPos.y * window.innerHeight - offsetY,
    };
  }

  /**
   * 移除血条
   */
  private removeHealthBar(id: string): void {
    const barData = this.healthBars.get(id);
    if (barData) {
      if (barData.chevron) {
        this.resetArrowIndicator(barData.chevron);
        barData.chevron.dispose();
      }
      barData.bar.remove();
      this.healthBars.delete(id);
    }
  }

  /**
   * 清除所有血条
   */
  public clear(): void {
    for (const barData of this.healthBars.values()) {
      if (barData.chevron) {
        this.resetArrowIndicator(barData.chevron);
        barData.chevron.dispose();
      }
      barData.bar.remove();
    }
    this.healthBars.clear();
  }

  public dispose(): void {
    this.unsubscribeLocale?.();
    this.unsubscribeLocale = null;
    this.clear();
    if (this.container.parentElement) {
      this.container.remove();
    }
    this.initialized = false;
  }

  /**
   * 获取第一个敌人的屏幕位置（用于锁定系统）
   * @returns 第一个可见敌人的屏幕位置，如果没有敌人则返回 null
   */
  public getFirstEnemyScreenPos(): { x: number; y: number } | null {
    for (const barData of this.healthBars.values()) {
      if (barData.screenPos && barData.bar.style.display !== 'none') {
        return { x: barData.screenPos.x, y: barData.screenPos.y };
      }
    }
    return null;
  }
}
