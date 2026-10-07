import * as THREE from 'three';

/**
 * 共享程序化贴图集合（Canvas 一次性烘焙，全局复用）。
 * 在无 Canvas 2D 环境（如 jsdom 测试）下各项为 null，
 * 所有消费方都必须容忍 map 为 null。
 */
export interface VfxTextures {
  /** 径向柔光 */
  glow: THREE.Texture | null;
  /** 火焰渐变（白热核心 + 碎边） */
  fire: THREE.Texture | null;
  /** 噪点烟团 */
  smoke: THREE.Texture | null;
  /** 火花拉丝 */
  spark: THREE.Texture | null;
  /** 细环（冲击波/传送门） */
  ring: THREE.Texture | null;
  /** 漩涡（传送门） */
  swirl: THREE.Texture | null;
  /** 曳光弹尾迹线性渐隐 */
  tail: THREE.Texture | null;
}

let vfxTextures: VfxTextures | null = null;

function createVfxCanvas(
  size: number
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  return { canvas, ctx };
}

function toVfxTexture(canvas: HTMLCanvasElement): THREE.Texture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createGlowTexture(): THREE.Texture | null {
  const target = createVfxCanvas(64);
  if (!target) return null;
  const { canvas, ctx } = target;
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.22, 'rgba(255,255,255,0.88)');
  gradient.addColorStop(0.52, 'rgba(255,255,255,0.34)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  return toVfxTexture(canvas);
}

function createFireTexture(): THREE.Texture | null {
  const target = createVfxCanvas(128);
  if (!target) return null;
  const { canvas, ctx } = target;
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.28, 'rgba(255,243,214,0.92)');
  gradient.addColorStop(0.55, 'rgba(255,255,255,0.42)');
  gradient.addColorStop(0.85, 'rgba(255,255,255,0.1)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  // 碎边火舌：在边缘叠加若干柔光团，让轮廓不规则
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 2 + Math.random() * 0.6;
    const dist = 26 + Math.random() * 22;
    const x = 64 + Math.cos(angle) * dist;
    const y = 64 + Math.sin(angle) * dist;
    const radius = 8 + Math.random() * 14;
    const blob = ctx.createRadialGradient(x, y, 0, x, y, radius);
    blob.addColorStop(0, 'rgba(255,238,200,0.5)');
    blob.addColorStop(1, 'rgba(255,238,200,0)');
    ctx.fillStyle = blob;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  return toVfxTexture(canvas);
}

function createSmokeTexture(): THREE.Texture | null {
  const target = createVfxCanvas(128);
  if (!target) return null;
  const { canvas, ctx } = target;
  const base = ctx.createRadialGradient(64, 64, 0, 64, 64, 62);
  base.addColorStop(0, 'rgba(190,190,195,0.85)');
  base.addColorStop(0.55, 'rgba(170,170,176,0.55)');
  base.addColorStop(1, 'rgba(150,150,156,0)');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 128, 128);
  // 噪点棉团：明暗斑块制造体积感
  for (let i = 0; i < 16; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * 38;
    const x = 64 + Math.cos(angle) * dist;
    const y = 64 + Math.sin(angle) * dist;
    const radius = 9 + Math.random() * 17;
    const light = Math.random() > 0.5;
    const blob = ctx.createRadialGradient(x, y, 0, x, y, radius);
    blob.addColorStop(0, light ? 'rgba(225,225,230,0.28)' : 'rgba(60,60,66,0.24)');
    blob.addColorStop(1, light ? 'rgba(225,225,230,0)' : 'rgba(60,60,66,0)');
    ctx.fillStyle = blob;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  // 用径向 alpha 蒙版收圆轮廓
  ctx.globalCompositeOperation = 'destination-in';
  const mask = ctx.createRadialGradient(64, 64, 0, 64, 64, 62);
  mask.addColorStop(0, 'rgba(0,0,0,1)');
  mask.addColorStop(0.62, 'rgba(0,0,0,0.85)');
  mask.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = mask;
  ctx.fillRect(0, 0, 128, 128);
  return toVfxTexture(canvas);
}

function createSparkTexture(): THREE.Texture | null {
  const target = createVfxCanvas(64);
  if (!target) return null;
  const { canvas, ctx } = target;
  // 水平拉丝主体
  const streak = ctx.createLinearGradient(0, 32, 64, 32);
  streak.addColorStop(0, 'rgba(255,255,255,0)');
  streak.addColorStop(0.5, 'rgba(255,255,255,1)');
  streak.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = streak;
  ctx.save();
  ctx.translate(32, 32);
  ctx.scale(1, 0.14);
  ctx.translate(-32, -32);
  ctx.beginPath();
  ctx.arc(32, 32, 31, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // 中心热点
  const core = ctx.createRadialGradient(32, 32, 0, 32, 32, 9);
  core.addColorStop(0, 'rgba(255,255,255,1)');
  core.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = core;
  ctx.fillRect(20, 20, 24, 24);
  return toVfxTexture(canvas);
}

function createRingTexture(): THREE.Texture | null {
  const target = createVfxCanvas(128);
  if (!target) return null;
  const { canvas, ctx } = target;
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0.56, 'rgba(255,255,255,0)');
  gradient.addColorStop(0.72, 'rgba(255,255,255,0.9)');
  gradient.addColorStop(0.84, 'rgba(255,255,255,0.32)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  return toVfxTexture(canvas);
}

function createSwirlTexture(): THREE.Texture | null {
  const target = createVfxCanvas(256);
  if (!target) return null;
  const { canvas, ctx } = target;
  ctx.globalCompositeOperation = 'lighter';
  const armCount = 4;
  for (let arm = 0; arm < armCount; arm++) {
    const armOffset = (arm / armCount) * Math.PI * 2;
    for (let t = 0; t < 1; t += 0.02) {
      const angle = armOffset + t * 4.6;
      const radius = 18 + t * 102;
      const x = 128 + Math.cos(angle) * radius;
      const y = 128 + Math.sin(angle) * radius;
      const blobRadius = 6 + t * 13;
      const alpha = 0.32 * (1 - t * 0.55);
      const blob = ctx.createRadialGradient(x, y, 0, x, y, blobRadius);
      blob.addColorStop(0, `rgba(255,255,255,${alpha.toFixed(3)})`);
      blob.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = blob;
      ctx.fillRect(x - blobRadius, y - blobRadius, blobRadius * 2, blobRadius * 2);
    }
  }
  // 中心亮核
  const core = ctx.createRadialGradient(128, 128, 0, 128, 128, 42);
  core.addColorStop(0, 'rgba(255,255,255,0.95)');
  core.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = core;
  ctx.fillRect(86, 86, 84, 84);
  return toVfxTexture(canvas);
}

function createTailTexture(): THREE.Texture | null {
  const target = createVfxCanvas(64);
  if (!target) return null;
  const { canvas, ctx } = target;
  // 纵向渐隐（v=1 端贴近弹头，最亮）
  const fade = ctx.createLinearGradient(0, 64, 0, 0);
  fade.addColorStop(0, 'rgba(255,255,255,0.95)');
  fade.addColorStop(0.45, 'rgba(255,255,255,0.42)');
  fade.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, 64, 64);
  // 横向柔边
  ctx.globalCompositeOperation = 'destination-in';
  const edge = ctx.createLinearGradient(0, 0, 64, 0);
  edge.addColorStop(0, 'rgba(0,0,0,0)');
  edge.addColorStop(0.3, 'rgba(0,0,0,1)');
  edge.addColorStop(0.7, 'rgba(0,0,0,1)');
  edge.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, 64, 64);
  return toVfxTexture(canvas);
}

/**
 * 获取共享 VFX 贴图（懒构建一次）
 */
export function getVfxTextures(): VfxTextures {
  if (!vfxTextures) {
    vfxTextures = {
      glow: createGlowTexture(),
      fire: createFireTexture(),
      smoke: createSmokeTexture(),
      spark: createSparkTexture(),
      ring: createRingTexture(),
      swirl: createSwirlTexture(),
      tail: createTailTexture(),
    };
  }
  return vfxTextures;
}
