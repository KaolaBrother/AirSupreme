import * as THREE from 'three';

const MAX_HITS = 4;
const RIPPLE_LIFETIME = 0.9;

const vertexShader = /* glsl */ `
varying vec3 vNormalLocal;
varying vec3 vNormalView;
varying vec3 vViewPosition;

void main() {
  vNormalLocal = normalize(position);
  vNormalView = normalize(normalMatrix * normal);
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vViewPosition = mvPosition.xyz;
  gl_Position = projectionMatrix * mvPosition;
}
`;

const fragmentShader = /* glsl */ `
uniform vec3 uColor;
uniform float uTime;
uniform float uFade;
uniform float uHexScale;
uniform vec4 uHits[${MAX_HITS}];

varying vec3 vNormalLocal;
varying vec3 vNormalView;
varying vec3 vViewPosition;

float hexDistance(vec2 p) {
  p = abs(p);
  return max(dot(p, vec2(0.5, 0.8660254)), p.x);
}

// 六边形网格：返回 0（格心）..1（格边）的描边强度
float hexEdge(vec2 uv) {
  vec2 r = vec2(1.0, 1.7320508);
  vec2 h = r * 0.5;
  vec2 a = mod(uv, r) - h;
  vec2 b = mod(uv - h, r) - h;
  vec2 gv = dot(a, a) < dot(b, b) ? a : b;
  return smoothstep(0.38, 0.49, hexDistance(gv));
}

// 三平面投影的六边形网格，避免球面极点拉伸
float hexPattern(vec3 n) {
  vec3 w = pow(abs(n), vec3(4.0));
  w /= (w.x + w.y + w.z + 1e-5);
  return hexEdge(n.yz * uHexScale) * w.x + hexEdge(n.zx * uHexScale) * w.y + hexEdge(n.xy * uHexScale) * w.z;
}

void main() {
  vec3 n = normalize(vNormalLocal);
  vec3 viewDir = normalize(-vViewPosition);
  float fresnel = pow(1.0 - abs(dot(normalize(vNormalView), viewDir)), 2.4);
  float lines = hexPattern(n);

  float ripple = 0.0;
  float flash = 0.0;
  for (int i = 0; i < ${MAX_HITS}; i++) {
    vec4 hit = uHits[i];
    float age = uTime - hit.w;
    if (hit.w < 0.0 || age < 0.0 || age > ${RIPPLE_LIFETIME.toFixed(2)}) continue;
    float angle = acos(clamp(dot(n, hit.xyz), -1.0, 1.0));
    float radius = age * 3.4;
    float life = 1.0 - age / ${RIPPLE_LIFETIME.toFixed(2)};
    float ring = exp(-pow((angle - radius) / 0.24, 2.0));
    ripple += ring * life * life;
    flash += exp(-angle * angle / 0.09) * pow(max(0.0, 1.0 - age / 0.32), 2.0);
  }

  float idle = (0.012 + 0.13 * fresnel) * lines + fresnel * 0.035;
  float energy = lines * ripple * 2.2 + ripple * 0.3 + flash * (0.8 + lines * 1.2);
  float intensity = (idle + energy) * uFade;
  if (intensity < 0.003) discard;

  vec3 rgb = mix(uColor, vec3(1.0), clamp(flash * 0.65 + ripple * 0.25, 0.0, 1.0));
  rgb *= intensity * (1.0 + flash * 1.6);
  gl_FragColor = vec4(rgb, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/**
 * 六边形能量护盾涟漪：命中方向闪光 + 扩散环点亮六边形格。
 * 网格挂在护盾组（世界轴对齐）下，命中方向使用护盾局部/世界方向均可。
 */
export class ShieldRipple {
  readonly mesh: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  private readonly hits: THREE.Vector4[] = [];
  private nextHit = 0;
  private time = 0;

  constructor(radius: number, color: THREE.ColorRepresentation) {
    for (let i = 0; i < MAX_HITS; i++) {
      this.hits.push(new THREE.Vector4(0, 0, 1, -1));
    }
    const material = new THREE.ShaderMaterial({
      name: 'VfxShieldRipple',
      uniforms: {
        uColor: { value: new THREE.Color(color) },
        uTime: { value: 0 },
        uFade: { value: 1 },
        uHexScale: { value: 7.5 },
        uHits: { value: this.hits },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 32), material);
    this.mesh.name = 'player-shield-ripple';
    this.mesh.renderOrder = 0;
  }

  /** 记录一次命中（方向为护盾中心指向命中点） */
  notifyHit(direction: THREE.Vector3): void {
    const lengthSq = direction.lengthSq();
    if (!Number.isFinite(lengthSq) || lengthSq < 1e-8) return;
    const slot = this.hits[this.nextHit];
    const inv = 1 / Math.sqrt(lengthSq);
    slot.set(direction.x * inv, direction.y * inv, direction.z * inv, this.time);
    this.nextHit = (this.nextHit + 1) % MAX_HITS;
  }

  /** 是否仍有涟漪在播放 */
  isRippling(): boolean {
    for (const hit of this.hits) {
      if (hit.w >= 0 && this.time - hit.w <= RIPPLE_LIFETIME) return true;
    }
    return false;
  }

  setFade(fade: number): void {
    this.mesh.material.uniforms.uFade.value = THREE.MathUtils.clamp(fade, 0, 1);
  }

  update(deltaTime: number): void {
    if (!Number.isFinite(deltaTime) || deltaTime <= 0) return;
    this.time += Math.min(deltaTime, 0.1);
    this.mesh.material.uniforms.uTime.value = this.time;
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
