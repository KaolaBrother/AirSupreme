import {
  LANGUAGE_ENDONYMS,
  TEST_SCORE_OPTIONS,
  type CameraModeSetting,
  type GameMode,
  type StartFlowSettings,
} from '@/core/SessionSettings';
import { type QualityPreset } from '@/config';
import { TOTAL_LEVELS } from '@/features/campaign/CampaignData';
import { SUPPORTED_LOCALES, tr, type Locale, type LocalizedText } from '@/i18n';
import { el, icon } from './dom';
import { MENU_ICONS } from './menuIcons';
import {
  CAMERA_LABELS,
  MODE_LABELS,
  QUALITY_LABELS,
  QUALITY_PRESETS,
  SWITCH_OFF,
  SWITCH_ON,
  chapterCaption,
  difficultyText,
  hasAdvancedOverrides,
  levelText,
  testScoreText,
} from './menuLabels';
import { MenuSheet, type SheetOpener } from './MenuSheet';
import {
  createMeter,
  createSegmented,
  createStepper,
  createSwitch,
  type MeterHandle,
  type SegmentedHandle,
  type StepperHandle,
  type SwitchHandle,
} from './settingsControls';

/**
 * 设置面板：十二项设置分成 游戏 / 音频 / 显示 三组，加一组默认收起的“高级”（起始关卡、
 * 游戏模式、测试分数）。每一项改动立即通过 host.update 写回并持久化——取值范围、步进与
 * 存储字段都和原来的单列面板相同，只是换了控件。
 *
 * 行与数值的 id 沿用 `#<key>-row` / `#<key>-value`（与界面语言无关）。
 */

export interface SettingsSheetHost {
  getSettings(): StartFlowSettings;
  /** 合并进当前设置并保存；语言变化由宿主负责 setLocale */
  update(patch: Partial<StartFlowSettings>): void;
}

type VolumeKey = 'sfxVolume' | 'musicVolume' | 'voiceVolume';

const DECREASE: LocalizedText = { en: 'Decrease {name}', zh: '降低{name}' };
const INCREASE: LocalizedText = { en: 'Increase {name}', zh: '提高{name}' };

export interface SettingsSheetOptions {
  reducedMotion: boolean;
  onOpenChange?: (open: boolean) => void;
}

export class SettingsSheet {
  public readonly sheet: MenuSheet;

  private advancedOpen = false;
  private syncers: Array<(settings: StartFlowSettings) => void> = [];

  constructor(
    private readonly host: SettingsSheetHost,
    options: SettingsSheetOptions
  ) {
    this.sheet = new MenuSheet({
      id: 'settings-sheet',
      variant: 'panel',
      reducedMotion: options.reducedMotion,
      onOpenChange: options.onOpenChange,
    });
    this.sheet.body.classList.add('settings-panel');
    this.render();
  }

  public open(opener: SheetOpener): void {
    // 高级选项每次打开都先收起
    this.setAdvancedOpen(false);
    this.sync();
    this.sheet.open(opener);
  }

  /** 按当前设置刷新所有控件的显示（不重建 DOM） */
  public sync(): void {
    const settings = this.host.getSettings();
    for (const syncer of this.syncers) {
      syncer(settings);
    }
  }

  /**
   * 按当前语言重建面板内容（标签、选项名、说明都重新取文案），
   * 保留展开状态、滚动位置，并把键盘焦点放回原来那个控件。
   */
  public render(): void {
    const body = this.sheet.body;
    const active = document.activeElement;
    const focusKey =
      active instanceof HTMLElement && body.contains(active)
        ? (active.dataset.focusKey ?? null)
        : null;
    const scrollTop = body.scrollTop;

    this.sheet.setHeading(
      tr({ en: 'Configuration', zh: '系统配置' }),
      tr({ en: 'Settings', zh: '设置' }),
      tr({ en: 'Close settings', zh: '关闭设置' })
    );

    this.syncers = [];
    body.replaceChildren(
      this.createGroup('game', tr({ en: 'Game', zh: '游戏' }), [
        this.createDifficultyRow(),
        this.createLivesRow(),
        this.createCameraRow(),
        this.createTutorialRow(),
      ]),
      this.createGroup('audio', tr({ en: 'Audio', zh: '音频' }), [
        this.createVolumeRow('sfx', 'sfxVolume', tr({ en: 'SFX volume', zh: '音效音量' })),
        this.createVolumeRow('music', 'musicVolume', tr({ en: 'Music volume', zh: '音乐音量' })),
        this.createVolumeRow(
          'voice',
          'voiceVolume',
          tr({ en: 'Voice volume', zh: '语音音量' }),
          tr({ en: '0% shows subtitles only', zh: '0% 时只显示字幕' })
        ),
      ]),
      this.createGroup('display', tr({ en: 'Display', zh: '显示' }), [
        this.createQualityRow(),
        this.createLanguageRow(),
      ]),
      this.createAdvancedGroup()
    );

    this.sync();
    body.scrollTop = scrollTop;
    if (focusKey) {
      body.querySelector<HTMLElement>(`[data-focus-key="${focusKey}"]`)?.focus({
        preventScroll: true,
      });
    }
  }

  public dispose(): void {
    this.syncers = [];
    this.sheet.dispose();
  }

  // ───────────────────────────── 结构 ─────────────────────────────

  private createGroup(key: string, title: string, rows: HTMLElement[]): HTMLElement {
    const group = el('section', 'st-group');
    group.dataset.group = key;
    const heading = el('h3', 'st-group-title', title);
    heading.id = `settings-group-${key}`;
    group.setAttribute('aria-labelledby', heading.id);
    group.append(heading, ...rows);
    return group;
  }

  /**
   * 一行设置：左边标签（可带一行说明），右边控件。
   * wide：控件较宽（分段 / 音量条），窄屏时换到标签下方占满一行。
   */
  private createRow(
    key: string,
    label: string,
    control: HTMLElement,
    options: { caption?: string; captionId?: string; wide?: boolean } = {}
  ): HTMLDivElement {
    const row = el('div', 'st-row setting-row');
    row.id = `${key}-row`;
    row.dataset.navRow = '';
    if (options.wide) {
      row.dataset.wide = '';
    }
    const text = el('div', 'st-row-text');
    const labelEl = el('span', 'st-label setting-label', label);
    labelEl.id = `${key}-label`;
    text.append(labelEl);
    if (options.caption !== undefined) {
      const caption = el('span', 'st-caption setting-caption', options.caption);
      if (options.captionId) {
        caption.id = options.captionId;
      }
      text.append(caption);
    }
    const slot = el('div', 'st-row-control');
    slot.append(control);
    // 空白文本节点不参与排版，只让 textContent / 读屏里标签与数值分成两个词
    row.append(text, ' ', slot);
    return row;
  }

  private stepperLabels(name: string): { decreaseLabel: string; increaseLabel: string } {
    return {
      decreaseLabel: tr(DECREASE, { name }),
      increaseLabel: tr(INCREASE, { name }),
    };
  }

  // ───────────────────────────── 游戏 ─────────────────────────────

  private createDifficultyRow(): HTMLElement {
    const label = tr({ en: 'Difficulty', zh: '难度' });
    const stepper: StepperHandle = createStepper({
      key: 'difficulty',
      ...this.stepperLabels(label),
      pips: 5,
      onStep: (direction) => {
        const current = this.host.getSettings().difficulty;
        this.host.update({ difficulty: Math.min(5, Math.max(1, current + direction)) });
      },
    });
    this.syncers.push((settings) =>
      stepper.set(difficultyText(settings.difficulty), {
        atMin: settings.difficulty <= 1,
        atMax: settings.difficulty >= 5,
        pipsOn: settings.difficulty,
      })
    );
    return this.createRow('difficulty', label, stepper.root);
  }

  private createLivesRow(): HTMLElement {
    const label = tr({ en: 'Lives', zh: '生命数' });
    const stepper = createStepper({
      key: 'lives',
      ...this.stepperLabels(label),
      pips: 9,
      onStep: (direction) => {
        const current = this.host.getSettings().playerLives;
        this.host.update({ playerLives: Math.min(9, Math.max(1, current + direction)) });
      },
    });
    this.syncers.push((settings) =>
      stepper.set(`${settings.playerLives}`, {
        atMin: settings.playerLives <= 1,
        atMax: settings.playerLives >= 9,
        pipsOn: settings.playerLives,
      })
    );
    return this.createRow('lives', label, stepper.root);
  }

  /** 视角：第三人称（默认）/ 第一人称，对局中按 V 或触屏的 VIEW 键切换 */
  private createCameraRow(): HTMLElement {
    const modes: readonly CameraModeSetting[] = ['third-person', 'first-person'];
    const segmented: SegmentedHandle<CameraModeSetting> = createSegmented({
      key: 'camera',
      labelledBy: 'camera-label',
      options: modes.map((mode) => ({ value: mode, label: tr(CAMERA_LABELS[mode]) })),
      onSelect: (cameraMode) => this.host.update({ cameraMode }),
    });
    this.syncers.push((settings) => segmented.set(settings.cameraMode));
    return this.createRow('camera', tr({ en: 'Camera', zh: '视角' }), segmented.root, {
      caption: tr({ en: 'Switch in flight with V or VIEW', zh: '对局中按 V 或“视角”键切换' }),
      wide: true,
    });
  }

  private createTutorialRow(): HTMLElement {
    const toggle: SwitchHandle = createSwitch({
      key: 'tutorial',
      labelledBy: 'tutorial-label',
      onToggle: (tutorialEnabled) => this.host.update({ tutorialEnabled }),
    });
    this.syncers.push((settings) =>
      toggle.set(settings.tutorialEnabled, tr(settings.tutorialEnabled ? SWITCH_ON : SWITCH_OFF))
    );
    return this.createRow('tutorial', tr({ en: 'Tutorial', zh: '教程' }), toggle.root, {
      caption: tr({ en: 'In-flight guidance for new pilots', zh: '为新飞行员提供飞行中的提示' }),
    });
  }

  // ───────────────────────────── 音频 ─────────────────────────────

  private createVolumeRow(
    key: string,
    field: VolumeKey,
    label: string,
    caption?: string
  ): HTMLElement {
    const meter: MeterHandle = createMeter({
      key,
      label,
      ...this.stepperLabels(label),
      onChange: (value) => this.host.update({ [field]: value }),
    });
    this.syncers.push((settings) => meter.set(settings[field]));
    return this.createRow(key, label, meter.root, { caption, wide: true });
  }

  // ───────────────────────────── 显示 ─────────────────────────────

  private createQualityRow(): HTMLElement {
    const segmented: SegmentedHandle<QualityPreset> = createSegmented({
      key: 'quality',
      labelledBy: 'quality-label',
      options: QUALITY_PRESETS.map((preset) => ({
        value: preset,
        label: tr(QUALITY_LABELS[preset]),
      })),
      onSelect: (qualityPreset) => this.host.update({ qualityPreset }),
    });
    this.syncers.push((settings) => segmented.set(settings.qualityPreset));
    return this.createRow('quality', tr({ en: 'Graphics', zh: '画质' }), segmented.root, {
      caption: tr({ en: 'Auto picks a preset for this device', zh: '“自动”按设备选择档位' }),
      wide: true,
    });
  }

  /** 界面语言：选项名用各语言自称；切换后整个菜单按新语言重建 */
  private createLanguageRow(): HTMLElement {
    const segmented: SegmentedHandle<Locale> = createSegmented({
      key: 'language',
      labelledBy: 'language-label',
      options: SUPPORTED_LOCALES.map((locale) => ({
        value: locale,
        label: LANGUAGE_ENDONYMS[locale],
      })),
      onSelect: (language) => this.host.update({ language }),
    });
    this.syncers.push((settings) => segmented.set(settings.language));
    return this.createRow('language', tr({ en: 'Language', zh: '语言' }), segmented.root, {
      wide: true,
    });
  }

  // ───────────────────────────── 高级 ─────────────────────────────

  private setAdvancedOpen(open: boolean): void {
    this.advancedOpen = open;
    const group = this.sheet.body.querySelector<HTMLElement>('.st-advanced');
    if (!group) {
      return;
    }
    group.classList.toggle('is-open', open);
    group
      .querySelector('.st-advanced-toggle')
      ?.setAttribute('aria-expanded', open ? 'true' : 'false');
    const content = group.querySelector<HTMLElement>('.st-advanced-content');
    if (content) {
      // 收起时整块不可聚焦、读屏也跳过
      content.inert = !open;
    }
  }

  private createAdvancedGroup(): HTMLElement {
    const group = el('section', 'st-group st-advanced');
    group.dataset.group = 'advanced';

    const toggle = el('button', 'st-advanced-toggle');
    toggle.type = 'button';
    toggle.id = 'advanced-toggle';
    toggle.dataset.focusKey = 'advanced:toggle';
    toggle.dataset.navRow = '';
    toggle.setAttribute('aria-controls', 'advanced-content');
    const titles = el('span', 'st-advanced-titles');
    titles.append(
      el('span', 'st-advanced-title', tr({ en: 'Advanced', zh: '高级' })),
      el(
        'span',
        'st-caption',
        tr({ en: 'Level select, boss mode and test score', zh: '选关、Boss 模式与测试分数' })
      )
    );
    const badge = el('span', 'st-badge', tr({ en: 'Modified', zh: '已修改' }));
    badge.id = 'advanced-badge';
    toggle.append(titles, badge, icon(MENU_ICONS.chevronDown, 'mi st-advanced-chevron'));
    toggle.addEventListener('click', () => this.setAdvancedOpen(!this.advancedOpen));
    this.syncers.push((settings) => {
      badge.hidden = !hasAdvancedOverrides(settings);
    });

    const content = el('div', 'st-advanced-content');
    content.id = 'advanced-content';
    const inner = el('div', 'st-advanced-inner');
    inner.append(this.createLevelRow(), this.createModeRow(), this.createTestScoreRow());
    content.append(inner);

    group.append(toggle, content);
    group.classList.toggle('is-open', this.advancedOpen);
    toggle.setAttribute('aria-expanded', this.advancedOpen ? 'true' : 'false');
    content.inert = !this.advancedOpen;
    return group;
  }

  /** 选关（1..TOTAL_LEVELS，标签下方显示章节标题） */
  private createLevelRow(): HTMLElement {
    const label = tr({ en: 'Start level', zh: '起始关卡' });
    const stepper = createStepper({
      key: 'level',
      ...this.stepperLabels(label),
      onStep: (direction) => {
        const current = this.host.getSettings().startLevel;
        this.host.update({
          startLevel: Math.min(TOTAL_LEVELS, Math.max(1, current + direction)),
        });
      },
    });
    const row = this.createRow('level', label, stepper.root, {
      caption: chapterCaption(this.host.getSettings().startLevel),
      captionId: 'level-chapter',
    });
    const caption = row.querySelector<HTMLElement>('#level-chapter');
    this.syncers.push((settings) => {
      stepper.set(levelText(settings.startLevel), {
        atMin: settings.startLevel <= 1,
        atMax: settings.startLevel >= TOTAL_LEVELS,
      });
      if (caption) {
        caption.textContent = chapterCaption(settings.startLevel);
      }
    });
    return row;
  }

  private createModeRow(): HTMLElement {
    const modes: readonly GameMode[] = ['normal', 'boss'];
    const segmented: SegmentedHandle<GameMode> = createSegmented({
      key: 'mode',
      labelledBy: 'mode-label',
      options: modes.map((mode) => ({ value: mode, label: tr(MODE_LABELS[mode]) })),
      onSelect: (gameMode) => this.host.update({ gameMode }),
    });
    this.syncers.push((settings) => segmented.set(settings.gameMode));
    return this.createRow('mode', tr({ en: 'Game mode', zh: '游戏模式' }), segmented.root, {
      caption: tr({
        en: 'Boss mode: boss fights only, no campaign save',
        zh: 'Boss 模式：只打 Boss 战，不写战役存档',
      }),
      wide: true,
    });
  }

  private createTestScoreRow(): HTMLElement {
    const label = tr({ en: 'Test score', zh: '测试分数' });
    const values: readonly number[] = TEST_SCORE_OPTIONS;
    const indexOf = (score: number): number => Math.max(0, values.indexOf(score));
    const stepper = createStepper({
      key: 'testscore',
      ...this.stepperLabels(label),
      onStep: (direction) => {
        const index = indexOf(this.host.getSettings().testScore);
        const next = Math.min(values.length - 1, Math.max(0, index + direction));
        this.host.update({ testScore: values[next] });
      },
    });
    this.syncers.push((settings) => {
      const index = indexOf(settings.testScore);
      stepper.set(testScoreText(settings.testScore), {
        atMin: index <= 0,
        atMax: index >= values.length - 1,
      });
    });
    return this.createRow('testscore', label, stepper.root, {
      caption: tr({
        en: 'Start a new game with bonus score to try upgrades',
        zh: '开新局时自带分数，用来试升级',
      }),
    });
  }
}
