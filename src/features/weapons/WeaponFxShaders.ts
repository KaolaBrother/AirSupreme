import * as THREE from 'three';

/**
 * 特殊武器专用的着色器材质与几何体工厂（光束、冲击环、EMP 球壳、弹体）。
 * 全部为程序化生成，不依赖贴图 / DOM；透明材质统一 renderOrder 0、depthTest 开、depthWrite 关。
 */

const BEAM_VERTEX_SHADER = /* glsl */ `
uniform vec3 uStart;
uniform vec3 uEnd;
uniform float uWidth;
uniform float uEndWidth;
varying float vAlong;
varying float vSide;
varying float vLength;
void main() {
  float along = position.x;
  float side = position.y;
  vec3 world = mix(uStart, uEnd, along);
  vec4 mv = modelViewMatrix * vec4(world, 1.0);
  vec3 axis = (modelViewMatrix * vec4(uEnd - uStart, 0.0)).xyz;
  vec3 sideDir = cross(axis, mv.xyz);
  float sideLength = length(sideDir);
  sideDir = sideLength > 1e-6 ? sideDir / sideLength : vec3(1.0, 0.0, 0.0);
  float width = uWidth * mix(1.0, uEndWidth, along);
  width = max(width, -mv.z * 0.0018);
  mv.xyz += sideDir * side * width;
  vAlong = along;
  vSide = side;
  vLength = length(uEnd - uStart);
  gl_Position = projectionMatrix * mv;
}
`;

const BEAM_CORE_FRAGMENT_SHADER = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uCoreColor;
uniform float uIntensity;
uniform float uTime;
uniform float uPulse;
uniform float uFadeTail;
varying float vAlong;
varying float vSide;
varying float vLength;
void main() {
  float d = abs(vSide);
  float core = exp(-d * d * 26.0);
  float glow = exp(-d * d * 4.5);
  float dist = vAlong * vLength;
  float wave = 0.5 + 0.5 * sin(dist * 0.42 - uTime * 46.0);
  float bands = 1.0 - uPulse * wave * 0.6;
  float shimmer = 0.92 + 0.08 * sin(uTime * 113.0 + dist * 0.07);
  float startFade = smoothstep(0.0, 2.0, dist);
  float tail = mix(1.0, 1.0 - smoothstep(0.45, 1.0, vAlong), uFadeTail);
  vec3 color = uColor * glow * bands + uCoreColor * core * (0.85 + 0.15 * wave);
  gl_FragColor = vec4(color * uIntensity * shimmer * startFade * tail, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

const BEAM_SHEATH_FRAGMENT_SHADER = /* glsl */ `
uniform vec3 uColor;
uniform float uIntensity;
uniform float uFadeTail;
varying float vAlong;
varying float vSide;
varying float vLength;
void main() {
  float d = abs(vSide);
  float dist = vAlong * vLength;
  float startFade = smoothstep(0.0, 3.0, dist);
  float tail = mix(1.0, 1.0 - smoothstep(0.4, 1.0, vAlong), uFadeTail);
  float alpha = exp(-d * d * 3.2) * (1.0 - d) * uIntensity * startFade * tail;
  if (alpha < 0.003) discard;
  gl_FragColor = vec4(uColor, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export interface BeamMaterialOptions {
  color: THREE.ColorRepresentation;
  coreColor: THREE.ColorRepresentation;
  width: number;
  pulse: number;
}

export interface BeamUniforms {
  uStart: THREE.IUniform<THREE.Vector3>;
  uEnd: THREE.IUniform<THREE.Vector3>;
  uWidth: THREE.IUniform<number>;
  uEndWidth: THREE.IUniform<number>;
  uColor: THREE.IUniform<THREE.Color>;
  uCoreColor: THREE.IUniform<THREE.Color>;
  uIntensity: THREE.IUniform<number>;
  uTime: THREE.IUniform<number>;
  uPulse: THREE.IUniform<number>;
  uFadeTail: THREE.IUniform<number>;
}

/**
 * 光束：加色白热核心 + 普通混合的彩色外鞘（亮天空背景下依然能看出颜色），
 * 顶点着色器把面片绕光束轴朝向相机。
 */
export class BeamVisual {
  public readonly core: THREE.Mesh;
  public readonly sheath: THREE.Mesh;
  public readonly coreUniforms: BeamUniforms;
  public readonly sheathUniforms: BeamUniforms;
  private readonly coreMaterial: THREE.ShaderMaterial;
  private readonly sheathMaterial: THREE.ShaderMaterial;

  constructor(geometry: THREE.BufferGeometry, options: BeamMaterialOptions, sheathColor: number) {
    this.coreUniforms = createBeamUniforms(
      options.color,
      options.coreColor,
      options.width,
      options.pulse
    );
    this.sheathUniforms = createBeamUniforms(sheathColor, sheathColor, options.width * 2.4, 0);
    // 两层共享端点向量，更新一次即可
    this.sheathUniforms.uStart = this.coreUniforms.uStart;
    this.sheathUniforms.uEnd = this.coreUniforms.uEnd;

    this.coreMaterial = new THREE.ShaderMaterial({
      uniforms: this.coreUniforms as unknown as Record<string, THREE.IUniform>,
      vertexShader: BEAM_VERTEX_SHADER,
      fragmentShader: BEAM_CORE_FRAGMENT_SHADER,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    this.sheathMaterial = new THREE.ShaderMaterial({
      uniforms: this.sheathUniforms as unknown as Record<string, THREE.IUniform>,
      vertexShader: BEAM_VERTEX_SHADER,
      fragmentShader: BEAM_SHEATH_FRAGMENT_SHADER,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide,
    });

    this.sheath = new THREE.Mesh(geometry, this.sheathMaterial);
    this.core = new THREE.Mesh(geometry, this.coreMaterial);
    for (const mesh of [this.sheath, this.core]) {
      mesh.frustumCulled = false;
      mesh.renderOrder = 0;
      mesh.visible = false;
      mesh.matrixAutoUpdate = false;
    }
  }

  public setEndpoints(start: THREE.Vector3, end: THREE.Vector3): void {
    this.coreUniforms.uStart.value.copy(start);
    this.coreUniforms.uEnd.value.copy(end);
  }

  public setVisible(visible: boolean): void {
    this.core.visible = visible;
    this.sheath.visible = visible;
  }

  public isVisible(): boolean {
    return this.core.visible;
  }

  public dispose(): void {
    this.core.removeFromParent();
    this.sheath.removeFromParent();
    this.coreMaterial.dispose();
    this.sheathMaterial.dispose();
  }
}

function createBeamUniforms(
  color: THREE.ColorRepresentation,
  coreColor: THREE.ColorRepresentation,
  width: number,
  pulse: number
): BeamUniforms {
  return {
    uStart: { value: new THREE.Vector3() },
    uEnd: { value: new THREE.Vector3(0, 0, -1) },
    uWidth: { value: width },
    uEndWidth: { value: 1 },
    uColor: { value: new THREE.Color(color) },
    uCoreColor: { value: new THREE.Color(coreColor) },
    uIntensity: { value: 1 },
    uTime: { value: 0 },
    uPulse: { value: pulse },
    uFadeTail: { value: 0 },
  };
}

/** 光束条带：position.x = 沿轴 0..1，position.y = 侧向 -1..1 */
export function createBeamGeometry(segments: number): THREE.BufferGeometry {
  const count = Math.max(1, Math.floor(segments));
  const positions = new Float32Array((count + 1) * 2 * 3);
  const indices: number[] = [];
  for (let i = 0; i <= count; i++) {
    const along = i / count;
    positions.set([along, -1, 0, along, 1, 0], i * 6);
    if (i < count) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  return geometry;
}

const RING_VERTEX_SHADER = /* glsl */ `
varying vec2 vLocal;
void main() {
  vLocal = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const RING_FRAGMENT_SHADER = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uThickness;
varying vec2 vLocal;
void main() {
  float r = length(vLocal);
  float inner = 1.0 - uThickness;
  float band = smoothstep(inner, 0.965, r) * (1.0 - smoothstep(0.965, 1.0, r));
  float alpha = pow(band, 1.4) * uOpacity;
  if (alpha < 0.003) discard;
  gl_FragColor = vec4(uColor * alpha, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/** 扩散冲击环（加色、法线可任意朝向） */
export interface ShockRing {
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
  life: number;
  maxLife: number;
  fromRadius: number;
  toRadius: number;
  baseOpacity: number;
  active: boolean;
}

export function createShockRing(geometry: THREE.BufferGeometry): ShockRing {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(1, 1, 1) },
      uOpacity: { value: 0 },
      uThickness: { value: 0.2 },
    },
    vertexShader: RING_VERTEX_SHADER,
    fragmentShader: RING_FRAGMENT_SHADER,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.visible = false;
  mesh.renderOrder = 0;
  mesh.frustumCulled = false;
  return {
    mesh,
    material,
    life: 0,
    maxLife: 1,
    fromRadius: 0,
    toRadius: 1,
    baseOpacity: 1,
    active: false,
  };
}

const SHELL_VERTEX_SHADER = /* glsl */ `
varying vec3 vNormalView;
varying vec3 vViewPosition;
varying vec3 vLocal;
void main() {
  vLocal = position;
  vNormalView = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vViewPosition = mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`;

const SHELL_FRAGMENT_SHADER = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uTime;
varying vec3 vNormalView;
varying vec3 vViewPosition;
varying vec3 vLocal;
void main() {
  float facing = abs(dot(normalize(vNormalView), normalize(-vViewPosition)));
  float rim = pow(1.0 - facing, 2.2);
  float arcs = sin(vLocal.y * 23.0 + uTime * 26.0 + sin(vLocal.x * 11.0 - uTime * 9.0) * 2.4);
  float crackle = smoothstep(0.82, 1.0, arcs) * 1.6;
  float bands = 0.55 + 0.45 * sin(vLocal.y * 9.0 - uTime * 14.0);
  float alpha = (rim * (1.1 + crackle) + 0.04 + crackle * 0.12) * bands * uOpacity;
  if (alpha < 0.003) discard;
  gl_FragColor = vec4(uColor * alpha, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/** EMP 球壳（菲涅尔边缘 + 电弧条纹，摄像机在球内也能看到） */
export function createShellMaterial(color: THREE.ColorRepresentation): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: 0 },
      uTime: { value: 0 },
    },
    vertexShader: SHELL_VERTEX_SHADER,
    fragmentShader: SHELL_FRAGMENT_SHADER,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

/**
 * 车削弹体（+Z 朝前，原点在弹体中部），带顶点色分段涂装。
 * profile: [半径, 轴向位置, 颜色]，从尾到头。
 */
export function createProjectileBodyGeometry(
  profile: ReadonlyArray<readonly [number, number, number]>,
  radialSegments: number
): THREE.BufferGeometry {
  const points = profile.map(([radius, z]) => new THREE.Vector2(radius, z));
  const geometry = new THREE.LatheGeometry(points, radialSegments);
  const position = geometry.getAttribute('position');
  const colors = new Float32Array(position.count * 3);
  const color = new THREE.Color();
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i);
    // 取不超过该轴向位置的最后一个剖面点颜色
    let hex = profile[0][2];
    for (const [, z, c] of profile) {
      if (y >= z - 1e-4) hex = c;
    }
    color.setHex(hex);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.rotateX(Math.PI / 2);
  return geometry;
}

/** 尾焰锥：尖端朝 -Z，底面锚定在原点（喷口） */
export function createFlameGeometry(radius: number, length: number): THREE.BufferGeometry {
  const geometry = new THREE.ConeGeometry(radius, length, 10, 1, true);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, 0, -length / 2);
  return geometry;
}
