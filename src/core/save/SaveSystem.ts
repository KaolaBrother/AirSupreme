import { SPECIAL_WEAPON_IDS, type SpecialWeaponId } from '@/core/CombatContracts';
import {
  DEFAULT_START_FLOW_SETTINGS,
  getLocalStorage,
  normalizeCameraModeSetting,
  type CameraModeSetting,
} from '@/core/SessionSettings';
import { TOTAL_LEVELS, getCampaignChapter } from '@/features/campaign/CampaignData';

/**
 * 战役存档：中途自动存档（检查点）+ 战役进度记录。
 *
 * 只在调用时访问 localStorage（模块导入期不碰 window / document）；
 * 任何读写失败（无 DOM、隐私模式、配额已满、JSON 损坏）都不会抛出。
 */

export const CAMPAIGN_SAVE_KEY = 'air-supreme:campaign-save';
export const CAMPAIGN_PROGRESS_KEY = 'air-supreme:campaign-progress';
export const CAMPAIGN_SAVE_VERSION = 1;

/** 检查点类型：入关、波次之间、Boss 战之前 */
export type CheckpointKind = 'level-start' | 'wave' | 'boss';

/** 与 WeaponSystem.exportState() 的 WeaponSaveState 结构兼容 */
export interface CampaignWeaponState {
  unlocked: SpecialWeaponId[];
  selected: SpecialWeaponId | null;
  ammo: Partial<Record<SpecialWeaponId, number>>;
}

export interface CampaignRunStats {
  kills: number;
  civiliansLost: number;
  deaths: number;
  playTimeSeconds: number;
}

export interface CampaignSaveData {
  version: typeof CAMPAIGN_SAVE_VERSION;
  /** 存档时间（Date.now() 毫秒） */
  savedAt: number;
  checkpoint: CheckpointKind;
  /** 关卡号 1..TOTAL_LEVELS */
  level: number;
  /** 下一个要进行的波次（从 0 开始） */
  wave: number;
  difficulty: number;
  score: number;
  lives: number;
  missiles: number;
  /** PlayerUpgrades.export() 的原样数据 */
  upgrades: Record<string, unknown>;
  weapons: CampaignWeaponState;
  flares: number;
  cameraMode: CameraModeSetting;
  stats: CampaignRunStats;
}

export type CampaignCheckpointInput = Omit<CampaignSaveData, 'version' | 'savedAt'>;

export interface CampaignProgress {
  /** 是否至少通关过一次完整战役 */
  completed: boolean;
  /** 通关时的最高分 */
  bestScore: number;
  /** 到达过的最高关卡（第 1 关总是可选，最小为 1） */
  highestLevel: number;
}

const CHECKPOINT_KINDS: readonly CheckpointKind[] = ['level-start', 'wave', 'boss'];

/** 合理性上限：只用来拒绝离谱值，实际容量由各系统在恢复时自行钳制 */
const MAX_SAVED_WAVE_INDEX = 16;
const MAX_SAVED_LIVES = 99;
const MAX_SAVED_COUNT = 99;
const MAX_SAVED_AMMO = 9999;

const DEFAULT_PROGRESS: CampaignProgress = {
  completed: false,
  bestScore: 0,
  highestLevel: 1,
};

type PlainRecord = Record<string, unknown>;

function isPlainRecord(value: unknown): value is PlainRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, Math.round(value)));
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, value));
}

function clampLevel(value: unknown, fallback: number): number {
  return clampInt(value, 1, TOTAL_LEVELS, fallback);
}

function isSpecialWeaponId(value: unknown): value is SpecialWeaponId {
  return typeof value === 'string' && (SPECIAL_WEAPON_IDS as readonly string[]).includes(value);
}

function normalizeCheckpointKind(value: unknown): CheckpointKind {
  return CHECKPOINT_KINDS.find((kind) => kind === value) ?? 'level-start';
}

function normalizeWeapons(value: unknown): CampaignWeaponState {
  const source = isPlainRecord(value) ? value : {};

  const unlocked: SpecialWeaponId[] = [];
  if (Array.isArray(source.unlocked)) {
    for (const id of source.unlocked as unknown[]) {
      if (isSpecialWeaponId(id) && !unlocked.includes(id)) {
        unlocked.push(id);
      }
    }
  }

  const selected =
    isSpecialWeaponId(source.selected) && unlocked.includes(source.selected)
      ? source.selected
      : null;

  // 无限弹药（Infinity）序列化后变成 null，这里直接丢弃，由武器系统按满弹恢复
  const ammo: Partial<Record<SpecialWeaponId, number>> = {};
  if (isPlainRecord(source.ammo)) {
    for (const id of SPECIAL_WEAPON_IDS) {
      const count = source.ammo[id];
      if (typeof count === 'number' && Number.isFinite(count)) {
        ammo[id] = Math.max(0, Math.min(MAX_SAVED_AMMO, count));
      }
    }
  }

  return { unlocked, selected, ammo };
}

function normalizeStats(value: unknown): CampaignRunStats {
  const source = isPlainRecord(value) ? value : {};
  return {
    kills: clampInt(source.kills, 0, Number.MAX_SAFE_INTEGER, 0),
    civiliansLost: clampInt(source.civiliansLost, 0, Number.MAX_SAFE_INTEGER, 0),
    deaths: clampInt(source.deaths, 0, Number.MAX_SAFE_INTEGER, 0),
    playTimeSeconds: clampNumber(source.playTimeSeconds, 0, Number.MAX_SAFE_INTEGER, 0),
  };
}

/**
 * 规范化检查点主体（不含 version / savedAt）。
 * 关卡号是检查点的身份：缺失或非数字视为损坏，返回 null。
 */
function normalizeCheckpointBody(source: PlainRecord): CampaignCheckpointInput | null {
  if (typeof source.level !== 'number' || !Number.isFinite(source.level)) {
    return null;
  }

  return {
    checkpoint: normalizeCheckpointKind(source.checkpoint),
    level: clampLevel(source.level, 1),
    wave: clampInt(source.wave, 0, MAX_SAVED_WAVE_INDEX, 0),
    difficulty: clampInt(source.difficulty, 1, 5, DEFAULT_START_FLOW_SETTINGS.difficulty),
    score: clampInt(source.score, 0, Number.MAX_SAFE_INTEGER, 0),
    lives: clampInt(source.lives, 1, MAX_SAVED_LIVES, DEFAULT_START_FLOW_SETTINGS.playerLives),
    missiles: clampInt(source.missiles, 0, MAX_SAVED_COUNT, 0),
    upgrades: isPlainRecord(source.upgrades) ? { ...source.upgrades } : {},
    weapons: normalizeWeapons(source.weapons),
    flares: clampInt(source.flares, 0, MAX_SAVED_COUNT, 0),
    cameraMode: normalizeCameraModeSetting(source.cameraMode),
    stats: normalizeStats(source.stats),
  };
}

function removeKey(storage: Storage, key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    // 删除失败时忽略：下次读取仍会走校验并返回 null
  }
}

/**
 * 读取一条 JSON 记录：键不存在或读取失败返回 null；
 * JSON 损坏或顶层不是对象（数组 / 字符串 / null 等外来数据）时删除该键并返回 null。
 */
function readRecord(storage: Storage, key: string): PlainRecord | null {
  let raw: string | null;
  try {
    raw = storage.getItem(key);
  } catch {
    return null;
  }
  if (raw === null) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    removeKey(storage, key);
    return null;
  }

  if (!isPlainRecord(parsed)) {
    removeKey(storage, key);
    return null;
  }
  return parsed;
}

function writeJson(storage: Storage, key: string, value: unknown): boolean {
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    // 配额或隐私模式写入失败时静默忽略
    return false;
  }
}

/** 写入检查点；存储不可用或写入失败时返回 false（不抛出） */
export function saveCampaignCheckpoint(data: CampaignCheckpointInput): boolean {
  try {
    const storage = getLocalStorage();
    if (!storage || !isPlainRecord(data)) {
      return false;
    }

    const body = normalizeCheckpointBody(data as unknown as PlainRecord);
    if (!body) {
      return false;
    }

    const record: CampaignSaveData = {
      version: CAMPAIGN_SAVE_VERSION,
      savedAt: Date.now(),
      ...body,
    };
    return writeJson(storage, CAMPAIGN_SAVE_KEY, record);
  } catch {
    return false;
  }
}

/**
 * 读取检查点并校验 / 规范化。
 * JSON 损坏、不是对象、版本不符或缺少关卡号时删除该键并返回 null；越界字段被钳制，缺失字段取默认值。
 */
export function loadCampaignCheckpoint(): CampaignSaveData | null {
  try {
    const storage = getLocalStorage();
    if (!storage) {
      return null;
    }

    const parsed = readRecord(storage, CAMPAIGN_SAVE_KEY);
    if (!parsed) {
      return null;
    }

    if (parsed.version !== CAMPAIGN_SAVE_VERSION) {
      removeKey(storage, CAMPAIGN_SAVE_KEY);
      return null;
    }

    const body = normalizeCheckpointBody(parsed);
    if (!body) {
      removeKey(storage, CAMPAIGN_SAVE_KEY);
      return null;
    }

    return {
      version: CAMPAIGN_SAVE_VERSION,
      savedAt: clampNumber(parsed.savedAt, 0, Number.MAX_SAFE_INTEGER, 0),
      ...body,
    };
  } catch {
    return null;
  }
}

export function clearCampaignCheckpoint(): void {
  try {
    const storage = getLocalStorage();
    if (storage) {
      removeKey(storage, CAMPAIGN_SAVE_KEY);
    }
  } catch {
    // 存储不可用时无需清理
  }
}

/** 是否存在有效检查点（损坏的存档会在这里被清理） */
export function hasCampaignCheckpoint(): boolean {
  return loadCampaignCheckpoint() !== null;
}

/**
 * 检查点的简短描述，如“第6关 · 熔炉之心 · 第3波”；Boss 检查点显示“Boss 战”。
 * 波次以 1 开始计数（wave 字段是下一波的 0 基序号）。
 */
export function describeCheckpoint(data: CampaignSaveData): string {
  const level = clampLevel(data.level, 1);
  const title = getCampaignChapter(level).title;
  const stage =
    data.checkpoint === 'boss'
      ? 'Boss 战'
      : `第${clampInt(data.wave, 0, MAX_SAVED_WAVE_INDEX, 0) + 1}波`;
  return `第${level}关 · ${title} · ${stage}`;
}

function normalizeProgress(source: PlainRecord): CampaignProgress {
  return {
    completed: source.completed === true,
    bestScore: clampInt(source.bestScore, 0, Number.MAX_SAFE_INTEGER, 0),
    highestLevel: clampLevel(source.highestLevel, DEFAULT_PROGRESS.highestLevel),
  };
}

function writeProgress(progress: CampaignProgress): void {
  try {
    const storage = getLocalStorage();
    if (!storage) {
      return;
    }
    writeJson(storage, CAMPAIGN_PROGRESS_KEY, {
      version: CAMPAIGN_SAVE_VERSION,
      ...progress,
    });
  } catch {
    // 进度记录写入失败不影响游戏
  }
}

/**
 * 战役进度（与检查点独立）；不可用或损坏时返回默认值，损坏的记录会被删除。
 * 未写 version 的记录按当前版本读取，显式的其他版本视为外来数据。
 */
export function getCampaignProgress(): CampaignProgress {
  try {
    const storage = getLocalStorage();
    if (!storage) {
      return { ...DEFAULT_PROGRESS };
    }

    const parsed = readRecord(storage, CAMPAIGN_PROGRESS_KEY);
    if (!parsed) {
      return { ...DEFAULT_PROGRESS };
    }

    if (parsed.version !== undefined && parsed.version !== CAMPAIGN_SAVE_VERSION) {
      removeKey(storage, CAMPAIGN_PROGRESS_KEY);
      return { ...DEFAULT_PROGRESS };
    }

    return normalizeProgress(parsed);
  } catch {
    return { ...DEFAULT_PROGRESS };
  }
}

/** 通关：标记完成、刷新最高分、最高关卡记为最终关 */
export function markCampaignCompleted(finalScore: number): void {
  const previous = getCampaignProgress();
  writeProgress({
    completed: true,
    bestScore: Math.max(previous.bestScore, clampInt(finalScore, 0, Number.MAX_SAFE_INTEGER, 0)),
    highestLevel: TOTAL_LEVELS,
  });
}

/** 记录到达的关卡（只升不降；非法值忽略） */
export function recordLevelReached(level: number): void {
  if (typeof level !== 'number' || !Number.isFinite(level)) {
    return;
  }

  const previous = getCampaignProgress();
  const reached = clampLevel(level, previous.highestLevel);
  if (reached <= previous.highestLevel) {
    return;
  }

  writeProgress({ ...previous, highestLevel: reached });
}
