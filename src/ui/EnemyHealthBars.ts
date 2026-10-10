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

/**
 * 目标框：地面 / 海上 / 空中单位在远处只有几个像素高，屏幕上小于约 22px 时在它周围画一个
 * 威胁色的角框并标出距离，一公里外也找得到；靠近到看得清（> 28px，留出滞回）后收起。
 * 当前目标（敌机清空后拖住波次的单位）始终带框，并换成加粗、脉冲的样式。
 */
const BRACKET_SHOW_BELOW_PX = 22;
const BRACKET_HIDE_ABOVE_PX = 28;
const BRACKET_MIN_SIZE_PX = 26;
const BRACKET_OBJECTIVE_MIN_SIZE_PX = 34;
const BRACKET_MAX_SIZE_PX = 96;
const BRACKET_PADDING_PX = 14;
/** 单位可见轮廓约为命中半径的一半（命中半径按放大后的整车 / 整舰设定，偏大） */
const UNIT_VISIBLE_SIZE_RATIO = 0.5;
/** 相机投影矩阵不可用时的回退：垂直视场 60° 的 1 / tan(fov / 2) */
const FALLBACK_PROJECTION_SCALE = 1.732;
/** 目标框距离取整（米）：减少逐帧改写文字 */
const BRACKET_DISTANCE_STEP = 10;

const TARGET_MARKER_STYLE_ID = 'enemy-target-marker-style';
const OBJECTIVE_CLASS = 'is-objective';

/** 八段线性渐变拼出四个角；--ehb-arm / --ehb-w 为角的臂长与线宽 */
const BRACKET_CORNER_LAYERS = ['left top', 'right top', 'left bottom', 'right bottom']
  .map(
    (corner) =>
      `linear-gradient(var(--ehb-c), var(--ehb-c)) ${corner} / var(--ehb-arm) var(--ehb-w) no-repeat, ` +
      `linear-gradient(var(--ehb-c), var(--ehb-c)) ${corner} / var(--ehb-w) var(--ehb-arm) no-repeat`
  )
  .join(', ');

const TARGET_MARKER_CSS = `
.enemy-target-bracket {
  --ehb-c: var(--hud-threat, ${HUD_COLORS.threat});
  --ehb-arm: 7px;
  --ehb-w: 2px;
  position: absolute;
  display: none;
  pointer-events: none;
  transform: translate(-50%, -50%);
}

.enemy-target-bracket-frame {
  position: absolute;
  inset: 0;
  opacity: 0.88;
  background: ${BRACKET_CORNER_LAYERS};
  filter: drop-shadow(0 0 2px rgba(0, 0, 0, 0.9));
}

.enemy-target-bracket-distance {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-top: 2px;
  color: var(--ehb-c);
  font-size: 11px;
  font-weight: bold;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.95), 0 0 3px rgba(0, 0, 0, 0.8);
}

/* 当前目标：角框加粗加长、四边中点加刻线，并脉冲 */
.enemy-target-bracket.${OBJECTIVE_CLASS} {
  --ehb-arm: 11px;
  --ehb-w: 3px;
}

.enemy-target-bracket.${OBJECTIVE_CLASS} .enemy-target-bracket-frame {
  opacity: 1;
  animation: enemy-target-objective-pulse 0.9s ease-in-out infinite;
}

.enemy-target-bracket.${OBJECTIVE_CLASS} .enemy-target-bracket-frame::after {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(var(--ehb-c), var(--ehb-c)) center top / 2px 6px no-repeat,
    linear-gradient(var(--ehb-c), var(--ehb-c)) center bottom / 2px 6px no-repeat,
    linear-gradient(var(--ehb-c), var(--ehb-c)) left center / 6px 2px no-repeat,
    linear-gradient(var(--ehb-c), var(--ehb-c)) right center / 6px 2px no-repeat;
}

.enemy-target-bracket.${OBJECTIVE_CLASS} .enemy-target-bracket-distance {
  font-size: 12px;
}

/* 当前目标在屏幕外：箭头换成威胁色并闪烁（OffscreenChevron 的内联 animation: none 用 !important 盖过） */
.enemy-arrow-indicator.${OBJECTIVE_CLASS} {
  animation: enemy-target-objective-blink 0.9s ease-in-out infinite !important;
}

.enemy-arrow-indicator.${OBJECTIVE_CLASS} svg,
.enemy-arrow-indicator.${OBJECTIVE_CLASS} path {
  fill: var(--hud-threat, ${HUD_COLORS.threat});
}

.enemy-arrow-indicator.${OBJECTIVE_CLASS} .offscreen-chevron-distance {
  color: var(--hud-threat, ${HUD_COLORS.threat}) !important;
}

@keyframes enemy-target-objective-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.55; transform: scale(1.16); }
}

@keyframes enemy-target-objective-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

@media (prefers-reduced-motion: reduce) {
  .enemy-target-bracket.${OBJECTIVE_CLASS} .enemy-target-bracket-frame,
  .enemy-arrow-indicator.${OBJECTIVE_CLASS} {
    animation: none !important;
  }
}
`;

function ensureTargetMarkerStyle(): void {
  if (typeof document === 'undefined' || document.getElementById(TARGET_MARKER_STYLE_ID)) {
    return;
  }
  const style = document.createElement('style');
  style.id = TARGET_MARKER_STYLE_ID;
  style.textContent = TARGET_MARKER_CSS;
  document.head.appendChild(style);
}

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
 * 网格自带的显示名（mesh.userData.displayName，双语对象或字符串）：友军 AI 战机的飞行员呼号，
 * 以及地面 / 海上 / 空中单位的型号名（UnitMeshFactory 写入 UNIT_CONFIGS[type].name）。
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
 * ENEMY_CONFIGS 型号名（友军加“友军”前缀）；地面 / 海上 / 空中单位（UNIT_*）→ 网格自带的
 * 型号名（如“主战坦克”），没有时退回按阵营的通用名。
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
    const unitName = readDisplayName(mesh);
    if (unitName) return unitName;
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
 * 血条种类：Boss 本体（大条 + 名称）、Boss 部件（紧凑小条，名称只标在离准星最近的一个上，
 * 八只触手之眼 / 六个气囊不再叠出一排同名标签）、其余目标（普通血条 + 名称）。
 */
type BarKind = 'boss' | 'part' | 'unit';

interface BarMetrics {
  width: number;
  height: number;
  /** 血条底边离目标投影点的像素距离 */
  liftPx: number;
}

const BAR_METRICS: Readonly<Record<BarKind, BarMetrics>> = {
  boss: { width: 120, height: 10, liftPx: 15 },
  part: { width: 44, height: 5, liftPx: 8 },
  unit: { width: 60, height: 6, liftPx: 15 },
};

/** 部件名称换焦点的滞回：新部件离准星的距离需小于当前焦点的 80% 才切换，避免来回跳 */
const PART_FOCUS_SWITCH_RATIO_SQ = 0.8 * 0.8;

function getBarKind(name: string): BarKind {
  if (name.includes('BOSS')) return 'boss';
  for (const [prefix] of BOSS_PART_LABELS) {
    if (name.startsWith(prefix)) return 'part';
  }
  return 'unit';
}

/** 血条快照：objective 为 true 时按“当前目标”样式标记（见 BRACKET_* 常量上的说明） */
interface HealthBarInput {
  mesh: Object3D;
  currentHealth: number;
  maxHealth: number;
  objective?: boolean;
}

/** 目标框：外层定位、内层角框（当前目标时脉冲）、下方的距离 */
interface TargetBracket {
  root: HTMLDivElement;
  distance: HTMLSpanElement;
}

/**
 * 单位目标的估算半径（米）：只有地面 / 海上 / 空中单位（userData.unitType）带命中半径，
 * 其余目标返回 0（不按大小画目标框）。
 */
function readUnitRadius(mesh: Object3D): number {
  if (mesh.userData.unitType === undefined) return 0;
  const radius: unknown = mesh.userData.hitRadius;
  return typeof radius === 'number' && Number.isFinite(radius) && radius > 0 ? radius : 0;
}

interface HealthBarEntry {
  bar: HTMLDivElement;
  background: HTMLDivElement;
  targetName: HTMLSpanElement;
  chevron: OffscreenChevron | null;
  /** 目标框（第一次需要时创建） */
  bracket: TargetBracket | null;
  bracketShown: boolean;
  /** 单位目标的命中半径（米）；0 表示不按大小画目标框 */
  unitRadius: number;
  /** 当前目标样式 */
  objective: boolean;
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
  kind: BarKind;
}

/**
 * 敌人血条管理器
 * 为每个敌人显示血条
 */
export class EnemyHealthBars {
  private container: HTMLDivElement;
  private initialized: boolean = false;
  private healthBars: Map<string, HealthBarEntry> = new Map();
  /** 当前显示名称的 Boss 部件（离准星最近）；null 表示没有部件在视野内 */
  private focusedPartId: string | null = null;
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

    ensureTargetMarkerStyle();
    document.body.appendChild(this.container);
    // 切换语言立即重写现有血条的名字（暂停时游戏不调用 update，也要换）
    this.unsubscribeLocale ??= onLocaleChange(() => this.relabelAll());
    this.initialized = true;
  }

  /**
   * 更新敌人血条
   * @param enemies 敌人列表，包含位置、血量等信息（敌方单位同样在内；objective 标出当前目标）
   * @param friendlies 友军列表，包含位置、血量等信息
   * @param camera 相机
   * @param playerPosition 玩家位置
   */
  public update(
    enemies: HealthBarInput[],
    friendlies: HealthBarInput[],
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

    this.updatePartFocus();

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

  /** 写名字（标签用样式居中在血条上方，不再逐次测量文字宽度） */
  private writeTargetName(barData: { targetName: HTMLSpanElement }, name: string): void {
    this.setTextContent(barData.targetName, name);
  }

  /**
   * Boss 部件名称只标一个：视野内离准星（屏幕中心）最近的部件显示名称，其余部件只留小血条。
   * 带滞回，两个部件距离相近时不来回跳。
   */
  private updatePartFocus(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    let bestId: string | null = null;
    let bestDistanceSq = Infinity;
    let currentDistanceSq = Infinity;
    for (const [id, barData] of this.healthBars) {
      const screenPos = barData.screenPos;
      if (barData.kind !== 'part' || barData.wasInView !== true || !screenPos) {
        continue;
      }
      const dx = (screenPos.x - 0.5) * width;
      const dy = (screenPos.y - 0.5) * height;
      const distanceSq = dx * dx + dy * dy;
      if (id === this.focusedPartId) {
        currentDistanceSq = distanceSq;
      }
      if (distanceSq < bestDistanceSq) {
        bestDistanceSq = distanceSq;
        bestId = id;
      }
    }
    if (
      bestId !== this.focusedPartId &&
      currentDistanceSq !== Infinity &&
      bestDistanceSq > currentDistanceSq * PART_FOCUS_SWITCH_RATIO_SQ
    ) {
      bestId = this.focusedPartId;
    }
    if (bestId === this.focusedPartId) {
      return;
    }
    const previous = this.focusedPartId === null ? null : this.healthBars.get(this.focusedPartId);
    if (previous) {
      this.setStyleValue(previous.targetName, 'display', 'none');
    }
    const next = bestId === null ? null : this.healthBars.get(bestId);
    if (next) {
      this.setStyleValue(next.targetName, 'display', 'block');
    }
    this.focusedPartId = bestId;
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
    enemy: HealthBarInput,
    camera: Camera,
    playerPosition: Vector3,
    cameraMoved: boolean,
    playerMoved: boolean,
    isFriendly: boolean = false
  ): void {
    const id = enemy.mesh.uuid;
    let barData = this.healthBars.get(id);

    const kind = getBarKind(enemy.mesh.name || '');
    const metrics = BAR_METRICS[kind];

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
        this.hideBracket(barData);
        barData.wasInView = null;
      }
      return;
    }

    if (!barData) {
      const bar = this.createHealthBar(kind);
      const background = this.createBackgroundBar(kind);
      const targetName = this.createTargetName(isFriendly, kind);
      // 部件不单独出屏幕外箭头：Boss 本体的箭头已经指向同一方向
      const chevron = isFriendly || kind === 'part' ? null : this.createArrowIndicator();

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
        bracket: null,
        bracketShown: false,
        unitRadius: isFriendly ? 0 : readUnitRadius(enemy.mesh),
        objective: false,
        screenPos: null,
        lastBarWorldPosition: this.barWorldPosition.clone(),
        lastHealthPercent: Number.NaN,
        wasInView: false,
        labelDirty: false,
        mesh: enemy.mesh,
        isFriendly,
        kind,
      };
      this.healthBars.set(id, barData);
    }
    barData.mesh = enemy.mesh;
    barData.isFriendly = isFriendly;

    // 当前目标：箭头与目标框换样式（类名只在状态变化时改）
    const objective = !isFriendly && enemy.objective === true;
    const objectiveChanged = objective !== barData.objective;
    if (objectiveChanged) {
      barData.objective = objective;
      barData.chevron?.element.classList.toggle(OBJECTIVE_CLASS, objective);
      barData.bracket?.root.classList.toggle(OBJECTIVE_CLASS, objective);
    }

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
      !objectiveChanged &&
      !barData.labelDirty
    ) {
      return;
    }
    // 不在视野内的血条名字不可见：进入视野时（visibilityChanged）会按当前语言重写
    barData.labelDirty = false;

    const color = this.getHealthColor(healthPercent);
    let distanceHidden = false;

    if (inView) {
      this.setStyleValue(barData.bar, 'display', 'block');
      if (barData.chevron) {
        this.resetArrowIndicator(barData.chevron);
      }

      if (needsPositionUpdate) {
        const { x, y } = this.getBarPositionFromScreen(screenPos, metrics);
        this.setStyleValue(barData.bar, 'left', `${x}px`);
        this.setStyleValue(barData.bar, 'top', `${y}px`);
      }

      if (needsHealthUpdate || visibilityChanged) {
        this.setStyleValue(barData.background, 'background', color);
        this.setStyleValue(
          barData.background,
          'width',
          `${metrics.width * Math.max(0, Math.min(1, healthPercent))}px`
        );
      }

      this.writeTargetName(barData, this.getTargetName(enemy.mesh, isFriendly));

      if (needsPositionUpdate || objectiveChanged) {
        this.updateBracket(barData, screenPos, worldPos, camera, playerPosition);
      }
    } else {
      this.setStyleValue(barData.bar, 'display', 'none');
      this.hideBracket(barData);
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
   * 创建血条容器（宽高即整条血槽，名称标签居中在上方）
   */
  private createHealthBar(kind: BarKind): HTMLDivElement {
    const { width, height } = BAR_METRICS[kind];
    const bar = document.createElement('div');
    bar.className = 'enemy-health-bar';
    bar.setAttribute('data-kind', kind);
    // 部件小条：深色血槽 + 细边框，满血 / 残血都看得出长度
    const track =
      kind === 'part'
        ? `
      box-sizing: border-box;
      background: rgba(4, 8, 14, 0.62);
      border: 1px solid rgba(255, 255, 255, 0.42);
      border-radius: 3px;
      box-shadow: 0 0 6px rgba(0, 0, 0, 0.7);
      overflow: visible;`
        : '';
    bar.style.cssText = `
      position: absolute;
      display: none;
      width: ${width}px;
      height: ${height}px;
      pointer-events: none;${track}
    `;
    return bar;
  }

  /**
   * 创建血条背景
   */
  private createBackgroundBar(kind: BarKind): HTMLDivElement {
    const { width, height } = BAR_METRICS[kind];
    const background = document.createElement('div');
    background.className = 'health-bar-background';
    // 部件小条：填充在血槽内，不再叠一层粗边框
    background.style.cssText =
      kind === 'part'
        ? `
      width: ${width}px;
      height: 100%;
      position: absolute;
      top: 0;
      left: 0;
      border-radius: 2px;
      transition: width 0.2s, background 0.2s;
    `
        : `
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
   * 创建目标名称标签：Boss 本体红色大字；部件琥珀色小字、默认隐藏（只标离准星最近的一个）
   */
  private createTargetName(isFriendly: boolean, kind: BarKind): HTMLSpanElement {
    const name = document.createElement('span');
    name.className = 'enemy-name';
    const fontSize = kind === 'boss' ? 16 : kind === 'part' ? 11 : 12;
    const color =
      kind === 'boss'
        ? '#ff4444'
        : kind === 'part'
          ? HUD_COLORS.weapon
          : isFriendly
            ? '#ffff00'
            : '#ffffff';
    name.style.cssText = `
      font-size: ${fontSize}px;
      font-weight: bold;
      white-space: nowrap;
      position: absolute;
      bottom: 100%;
      left: 50%;
      transform: translateX(-50%);
      margin-bottom: ${kind === 'part' ? 3 : 4}px;
      color: ${color};
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.9),
                   -1px -1px 2px rgba(0, 0, 0, 0.8);
      display: ${kind === 'part' ? 'none' : 'block'};
    `;
    return name;
  }

  /**
   * 目标框：单位目标在屏幕上太小（或它是当前目标）时，在投影点周围画角框并标出离玩家的距离。
   * 只在位置 / 目标状态变化时调用。
   */
  private updateBracket(
    barData: HealthBarEntry,
    screenPos: { x: number; y: number },
    worldPos: Vector3,
    camera: Camera,
    playerPosition: Vector3
  ): void {
    const objective = barData.objective;
    if (!objective && barData.unitRadius <= 0) {
      return;
    }
    const apparent = this.getApparentSizePx(barData.unitRadius, worldPos, camera);
    // 滞回：已显示的框要等目标明显变大才收起，避免在阈值附近闪烁
    const show =
      objective ||
      apparent < (barData.bracketShown ? BRACKET_HIDE_ABOVE_PX : BRACKET_SHOW_BELOW_PX);
    if (!show) {
      this.hideBracket(barData);
      return;
    }

    let bracket = barData.bracket;
    if (!bracket) {
      bracket = this.createBracket();
      bracket.root.classList.toggle(OBJECTIVE_CLASS, objective);
      this.container.appendChild(bracket.root);
      barData.bracket = bracket;
    }

    const minSize = objective ? BRACKET_OBJECTIVE_MIN_SIZE_PX : BRACKET_MIN_SIZE_PX;
    const wanted = Number.isFinite(apparent) ? apparent + BRACKET_PADDING_PX : minSize;
    // 取偶数像素：四个角对称，也少改几次样式
    const size = Math.round(Math.max(minSize, Math.min(BRACKET_MAX_SIZE_PX, wanted)) / 2) * 2;
    const root = bracket.root;
    this.setStyleValue(root, 'width', `${size}px`);
    this.setStyleValue(root, 'height', `${size}px`);
    this.setStyleValue(root, 'left', `${Math.round(screenPos.x * window.innerWidth)}px`);
    this.setStyleValue(root, 'top', `${Math.round(screenPos.y * window.innerHeight)}px`);

    const distance = playerPosition.distanceTo(worldPos);
    this.setTextContent(
      bracket.distance,
      Number.isFinite(distance)
        ? `${Math.round(distance / BRACKET_DISTANCE_STEP) * BRACKET_DISTANCE_STEP}m`
        : ''
    );
    this.setStyleValue(root, 'display', 'block');
    barData.bracketShown = true;
  }

  private hideBracket(barData: HealthBarEntry): void {
    if (!barData.bracketShown) {
      return;
    }
    barData.bracketShown = false;
    if (barData.bracket) {
      this.setStyleValue(barData.bracket.root, 'display', 'none');
    }
  }

  /**
   * 单位在屏幕上的大致像素高度：可见轮廓（命中半径的一半）按相机距离与投影矩阵换算。
   * 半径未知或距离 / 投影非有限时返回 Infinity（不按大小画框）。
   */
  private getApparentSizePx(unitRadius: number, worldPos: Vector3, camera: Camera): number {
    if (unitRadius <= 0) {
      return Infinity;
    }
    const distance = camera.position.distanceTo(worldPos);
    if (!Number.isFinite(distance) || distance <= 0) {
      return Infinity;
    }
    const projection = camera.projectionMatrix.elements[5];
    const scale =
      Number.isFinite(projection) && projection > 0 ? projection : FALLBACK_PROJECTION_SCALE;
    return (unitRadius * UNIT_VISIBLE_SIZE_RATIO * scale * window.innerHeight) / distance;
  }

  private createBracket(): TargetBracket {
    const root = document.createElement('div');
    root.className = 'enemy-target-bracket';
    const frame = document.createElement('div');
    frame.className = 'enemy-target-bracket-frame';
    const distance = document.createElement('span');
    distance.className = 'enemy-target-bracket-distance';
    root.appendChild(frame);
    root.appendChild(distance);
    return { root, distance };
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
    metrics: BarMetrics
  ): { x: number; y: number } {
    return {
      x: screenPos.x * window.innerWidth - metrics.width / 2,
      y: screenPos.y * window.innerHeight - (metrics.height + metrics.liftPx),
    };
  }

  /**
   * 移除血条
   */
  private removeHealthBar(id: string): void {
    const barData = this.healthBars.get(id);
    if (id === this.focusedPartId) {
      this.focusedPartId = null;
    }
    if (barData) {
      if (barData.chevron) {
        this.resetArrowIndicator(barData.chevron);
        barData.chevron.dispose();
      }
      barData.bracket?.root.remove();
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
      barData.bracket?.root.remove();
      barData.bar.remove();
    }
    this.healthBars.clear();
    this.focusedPartId = null;
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
