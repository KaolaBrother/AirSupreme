import * as THREE from 'three';
import type { ScreenEffectsValues } from './ScreenEffectsState';

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const fragmentShader = /* glsl */ `
uniform float uDamage;
uniform float uLowHealth;
uniform float uHeartbeat;
uniform float uFlash;
uniform float uSpeed;
uniform float uEmp;
uniform vec2 uAspect;
varying vec2 vUv;

void main() {
  vec2 centered = (vUv - 0.5) * uAspect;
  float vig = smoothstep(0.42, 1.05, length(centered) * 1.2);
  vec3 color = vec3(0.0);
  float alpha = 0.0;

  // 受击红边
  float damage = vig * uDamage * 0.75;
  color += vec3(0.78, 0.05, 0.03) * damage;
  alpha += damage;
  // 低血量：心跳暗角 + 红边
  float dark = vig * uLowHealth * (0.2 + 0.32 * uHeartbeat);
  alpha += dark;
  float pulse = vig * uLowHealth * uHeartbeat * 0.35;
  color += vec3(0.5, 0.0, 0.0) * pulse;
  alpha += pulse;
  // 加速暗角
  alpha += vig * uSpeed * 0.14;
  // EMP 青闪 / 白闪
  float emp = uEmp * (0.25 + 0.6 * vig) * 0.7;
  color += vec3(0.35, 0.85, 1.0) * emp;
  alpha += emp;
  float flash = clamp(uFlash, 0.0, 1.0) * 0.8;
  color += vec3(1.0, 0.97, 0.92) * flash;
  alpha += flash;

  alpha = clamp(alpha, 0.0, 0.95);
  // 预乘输出：dst = color + dst * (1 - alpha)
  gl_FragColor = vec4(min(color, vec3(1.0)), alpha);
}
`;

/**
 * 无后处理路径（性能档）下的轻量屏幕效果叠加层：
 * 单个全屏三角形，仅在有效果时绘制（无渲染目标、无场景采样）。
 */
export class ScreenOverlay {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly material: THREE.ShaderMaterial;
  private readonly mesh: THREE.Mesh;

  constructor() {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([-1, 3, 0, -1, -1, 0, 3, -1, 0], 3)
    );
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 2, 0, 0, 2, 0], 2));
    this.material = new THREE.ShaderMaterial({
      name: 'VfxScreenOverlay',
      uniforms: {
        uDamage: { value: 0 },
        uLowHealth: { value: 0 },
        uHeartbeat: { value: 0 },
        uFlash: { value: 0 },
        uSpeed: { value: 0 },
        uEmp: { value: 0 },
        uAspect: { value: new THREE.Vector2(1, 1) },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
    });
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
  }

  render(renderer: THREE.WebGLRenderer, effects: ScreenEffectsValues, aspect: number): void {
    const uniforms = this.material.uniforms;
    uniforms.uDamage.value = effects.damagePulse;
    uniforms.uLowHealth.value = effects.lowHealth;
    uniforms.uHeartbeat.value = effects.heartbeat;
    uniforms.uFlash.value = effects.flash;
    uniforms.uSpeed.value = effects.speed;
    uniforms.uEmp.value = effects.empFlash;
    (uniforms.uAspect.value as THREE.Vector2).set(Math.max(1, aspect), Math.max(1, 1 / aspect));
    const oldAutoClear = renderer.autoClear;
    renderer.autoClear = false;
    try {
      renderer.render(this.scene, this.camera);
    } finally {
      renderer.autoClear = oldAutoClear;
    }
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.scene.remove(this.mesh);
  }
}
