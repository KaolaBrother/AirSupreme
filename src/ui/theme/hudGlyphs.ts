/**
 * 航电 HUD 线条图标（24×24 viewBox，currentColor 着色）。
 *
 * 只包含受信任的静态 SVG 字符串；剧情 / 台词等运行时文本一律走 textContent，绝不拼进这里。
 */

const SVG_OPEN =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">';
const SVG_CLOSE = '</svg>';

function glyph(body: string): string {
  return `${SVG_OPEN}${body}${SVG_CLOSE}`;
}

/** 无线电说话人头像（键为 CampaignSpeakerId；未知说话人回退到 hq 天线） */
export const SPEAKER_GLYPHS: Readonly<Record<string, string>> = {
  // 天穹指挥部：天线塔 + 电波
  hq: glyph(
    '<path d="M12 10.5V21M8.5 21h7M12 10.5 9.2 21M12 10.5l2.8 10.5"/>' +
      '<circle cx="12" cy="8.2" r="1.7"/>' +
      '<path d="M8.4 5.4a5 5 0 0 0 0 5.6M15.6 5.4a5 5 0 0 1 0 5.6M5.8 3.3a8.4 8.4 0 0 0 0 9.8M18.2 3.3a8.4 8.4 0 0 1 0 9.8"/>'
  ),
  // 僚机渡鸦：俯视战机剪影
  wingman: glyph(
    '<path fill="currentColor" stroke="none" d="M12 2.6l1.5 6 6.8 4.2v1.9l-6.8-1.8-.5 4.8 2.3 1.8v1.4L12 20l-3.3.9v-1.4l2.3-1.8-.5-4.8-6.8 1.8v-1.9l6.8-4.2z"/>'
  ),
  // 僚机雨燕：俯视的雨燕（向下弯的镰刀形细长翼 + 深叉尾），实心剪影，与渡鸦的战机剪影一眼可分
  wingman2: glyph(
    '<path fill="currentColor" stroke="none" d="M12 6.2c.7 0 1.1.7 1.1 1.7v.9c3.1-1.9 6.7-1.2 9.3 3.7-2.9-1.9-5.9-2.2-8.6-.7l-.6 3.1 1.9 5.3L12 17.6l-3.1 2.6 1.9-5.3-.6-3.1c-2.7-1.5-5.7-1.2-8.6.7 2.6-4.9 6.2-5.6 9.3-3.7v-.9c0-1 .4-1.7 1.1-1.7z"/>'
  ),
  // 陈曦博士：六边形芯片 + 节点
  scientist: glyph(
    '<path d="M12 2.8l7.8 4.5v9.4L12 21.2l-7.8-4.5V7.3z"/>' +
      '<circle cx="12" cy="12" r="2.4"/>' +
      '<path d="M12 9.6V5.8M14.1 13.2l3.3 1.9M9.9 13.2l-3.3 1.9"/>'
  ),
  // 灯塔预警机：侧视机身 + 背负的雷达罩（两根支架）
  awacs: glyph(
    '<ellipse cx="13" cy="6.6" rx="6" ry="1.7"/><path d="M11.2 8.3l.5 3M14.8 8.3l-.5 3"/>' +
      '<path d="M2.8 14.3c.6-1.6 2.2-2.9 4.4-2.9h11l2.5-3.2h1.1l-.9 4.4c-.2 1.1-1.1 1.8-2.2 1.8H4c-.6 0-1-.1-1.2-.1z"/>' +
      '<path d="M9.6 14.4l3.6 4.1h1.9l-1.6-4.1"/>'
  ),
  // 壁垒号护卫舰：侧视舰体 + 上层建筑 + 十字桅杆 + 舰炮
  frigate: glyph(
    '<path d="M2.4 14.6h19.2l-2.2 4.4H5.2z"/><path d="M8.4 14.6v-3.4h6.8v3.4"/>' +
      '<path d="M11.8 11.2V5M9.8 7.2h4"/><path d="M15.2 12.8h2.4M17.6 12.8l2.6-1.2"/>'
  ),
  // 神谕：竖瞳之眼
  oracle: glyph(
    '<path d="M2.4 12s3.7-6.3 9.6-6.3 9.6 6.3 9.6 6.3-3.7 6.3-9.6 6.3S2.4 12 2.4 12z"/>' +
      '<path d="M12 8.2c1.2 1.1 1.2 6.5 0 7.6-1.2-1.1-1.2-6.5 0-7.6z" fill="currentColor"/>'
  ),
  // 玩家猎鹰：双层鹰翼折线
  player: glyph(
    '<path d="M3 8.5l9 6 9-6"/><path d="M6.4 12.9l5.6 3.8 5.6-3.8"/><path d="M12 4.6v4"/>'
  ),
  // 海岸702 客机：俯视宽体客机轮廓（平直宽翼 + 双发吊舱）
  airliner: glyph(
    '<path d="M12 2.6c.8 0 1.3.9 1.3 2v4.8l7.9 4v1.6l-7.9-2.2v4.7l2.3 1.7v1.3L12 19.6l-3.6.9v-1.3l2.3-1.7v-4.7l-7.9 2.2v-1.6l7.9-4V4.6c0-1.1.5-2 1.3-2z"/>' +
      '<path d="M7.2 12.4v1.8M16.8 12.4v1.8"/>'
  ),
  // 北星号货轮：侧视船体 + 甲板集装箱 + 船尾驾驶楼与烟囱
  freighter: glyph(
    '<path d="M2.4 14.6h19.2l-1.8 4.2H4.4z"/>' +
      '<path d="M4.6 14.6v-2.8h3.6v2.8M8.2 14.6v-2.8h3.6v2.8M6.4 11.8V9.4h3.6v2.4"/>' +
      '<path d="M14.6 14.6V8.2h4v6.4M16.6 8.2V5.8"/>'
  ),
};

export function getSpeakerGlyph(speakerId: string): string {
  return SPEAKER_GLYPHS[speakerId] ?? SPEAKER_GLYPHS.hq;
}

/** 存档（软盘） */
export const GLYPH_SAVE = glyph(
  '<path d="M5 4h11.2L19 6.8V20H5z"/><path d="M8.2 4v4.6h6.6V4M8.2 20v-5.6h7.6V20"/>'
);

/** 视角（取景框） */
export const GLYPH_CAMERA = glyph(
  '<path d="M4 8.5V5h3.5M16.5 5H20v3.5M20 15.5V19h-3.5M7.5 19H4v-3.5"/><circle cx="12" cy="12" r="2.6"/>'
);

/** 告警三角 */
export const GLYPH_WARNING = glyph(
  '<path d="M12 3.6 21.4 20H2.6z"/><path d="M12 9.8v4.6M12 17.1v.2"/>'
);

/** 来袭导弹 */
export const GLYPH_MISSILE = glyph(
  '<path d="M19.5 4.5 9 15l-2.6.6.6-2.6L17.5 2.5z" fill="currentColor" stroke="none"/>' +
    '<path d="M6.4 15.6 3.5 20.5M9 17.3 6.6 21M4.6 12.8 2.6 15"/>'
);

/** 锁定（挂架未解锁） */
export const GLYPH_LOCK = glyph(
  '<rect x="6" y="11" width="12" height="9" rx="1.5"/><path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3"/>'
);

/** 地点图钉 */
export const GLYPH_PIN = glyph(
  '<path d="M12 21s-6-5.6-6-10.4a6 6 0 0 1 12 0C18 15.4 12 21 12 21z"/><circle cx="12" cy="10.6" r="2.2"/>'
);
