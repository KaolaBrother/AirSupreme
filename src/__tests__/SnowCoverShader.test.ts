import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  injectSnowAndWind,
  injectSnowCover,
  injectWindSway,
  type ShaderUniform,
  type SnowWorldYRange,
} from '@/features/terrain/worldscape/shadermods';

/**
 * 雪覆盖着色器补丁（worldscape/shadermods：injectSnowCover / injectSnowAndWind）。
 *
 * 规则：表面积不积雪只取决于它在世界空间的朝向与世界高度，绝不取决于相机的朝向。
 * 两个补丁、实例化与非实例化网格都一样。
 * 背景（ad72c47）：三关雪地在近乎垂直俯冲时变绿——补丁在 normal_fragment_maps 之后用了 normal.y，
 * 而 three 在那里的 normal 处于视图空间，俯冲 / 横滚 / 倒飞时平地法线的视图空间 y 趋近 0。
 *
 * jsdom 没有 WebGL，因此本测试：
 * 1. 把补丁作用到 three 自带的标准材质着色器源码（ShaderLib.standard）上，检查注入位置、声明、
 *    uniform 绑定与程序缓存键；
 * 2. 用一个很小的 GLSL 子集解释器在 CPU 上执行补丁真正注入的代码块，以及 three 自己的
 *    defaultnormal_vertex 法线块和 common 里的函数（如 inverseTransformDirection），
 *    在多种相机姿态下比较结果。解释器只支持这些代码块用到的语法；
 *    遇到未建模的标识符、函数或语法会直接报错，而不是猜。
 */

/* ------------------------------------------------------------------------------------------ */
/* GLSL 子集解释器                                                                             */
/* ------------------------------------------------------------------------------------------ */

/** 方阵，列主序（与 three 的 Matrix3 / Matrix4.elements 以及上传给 GLSL 的顺序一致） */
class GlslMat {
  constructor(
    readonly size: number,
    readonly e: readonly number[]
  ) {}

  static from(matrix: THREE.Matrix3 | THREE.Matrix4): GlslMat {
    return new GlslMat(matrix instanceof THREE.Matrix4 ? 4 : 3, Array.from(matrix.elements));
  }

  column(index: number): number[] {
    if (!Number.isInteger(index) || index < 0 || index >= this.size) {
      throw new Error(`矩阵列下标越界：${index}`);
    }
    return this.e.slice(index * this.size, (index + 1) * this.size);
  }
}

type GlslValue = number | number[] | GlslMat;
type GlslEnv = Map<string, GlslValue>;

interface Token {
  kind: 'num' | 'id' | 'op';
  text: string;
}

const TOKEN_RE =
  /\s*(?:(\d+\.\d*(?:[eE][-+]?\d+)?|\.\d+(?:[eE][-+]?\d+)?|\d+(?:[eE][-+]?\d+)?)|([A-Za-z_]\w*)|(\+=|-=|\*=|\/=|[-+*/=(),.;[\]{}]))/;

function tokenize(source: string): Token[] {
  const re = new RegExp(TOKEN_RE.source, 'y');
  const tokens: Token[] = [];
  let index = 0;
  while (source.slice(index).trim() !== '') {
    re.lastIndex = index;
    const match = re.exec(source);
    if (!match) {
      throw new Error(`GLSL 子集无法识别：“${source.slice(index, index + 40).trim()}”`);
    }
    if (match[1] !== undefined) tokens.push({ kind: 'num', text: match[1] });
    else if (match[2] !== undefined) tokens.push({ kind: 'id', text: match[2] });
    else tokens.push({ kind: 'op', text: match[3] });
    index = re.lastIndex;
  }
  return tokens;
}

/** 去注释并处理 #ifdef / #ifndef / #else / #endif；其它预处理指令一律报错 */
function preprocess(source: string, defines: ReadonlySet<string>): string {
  const text = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const kept: string[] = [];
  const stack: { outer: boolean; taken: boolean }[] = [];
  let active = true;
  for (const line of text.split('\n')) {
    const directive = /^\s*#\s*(\w+)\s*(\w*)/.exec(line);
    if (!directive) {
      if (active) kept.push(line);
      continue;
    }
    const [, name, arg] = directive;
    if (name === 'ifdef' || name === 'ifndef') {
      const taken = defines.has(arg) === (name === 'ifdef');
      stack.push({ outer: active, taken });
      active = active && taken;
    } else if (name === 'else' || name === 'endif') {
      const top = stack[stack.length - 1];
      if (top === undefined) throw new Error(`多余的 #${name}`);
      if (name === 'else') {
        active = top.outer && !top.taken;
      } else {
        stack.pop();
        active = top.outer;
      }
    } else {
      throw new Error(`GLSL 子集不支持预处理指令 #${name}`);
    }
  }
  if (stack.length > 0) throw new Error('缺少 #endif');
  return kept.join('\n');
}

function shapeOf(value: GlslValue): string {
  if (typeof value === 'number') return 'float';
  if (Array.isArray(value)) return `vec${value.length}`;
  return `mat${value.size}`;
}

function asNumber(value: GlslValue | undefined, what: string): number {
  if (typeof value !== 'number') throw new Error(`${what} 需要标量，得到 ${describeValue(value)}`);
  return value;
}

function asVector(value: GlslValue | undefined, what: string): number[] {
  if (!Array.isArray(value)) throw new Error(`${what} 需要向量，得到 ${describeValue(value)}`);
  return value;
}

function asMatrix(value: GlslValue | undefined, what: string): GlslMat {
  if (!(value instanceof GlslMat))
    throw new Error(`${what} 需要矩阵，得到 ${describeValue(value)}`);
  return value;
}

function describeValue(value: GlslValue | undefined): string {
  return value === undefined ? '（无）' : shapeOf(value);
}

/** 逐分量运算；标量参数广播到向量 */
function componentwise(args: readonly GlslValue[], fn: (...xs: number[]) => number): GlslValue {
  const widths = args.map((arg) => {
    if (arg instanceof GlslMat) throw new Error('矩阵不能逐分量运算');
    return typeof arg === 'number' ? 1 : arg.length;
  });
  const width = Math.max(...widths);
  if (widths.some((w) => w !== 1 && w !== width)) {
    throw new Error(`分量数不一致：${widths.join(' / ')}`);
  }
  const component = (arg: GlslValue, i: number): number =>
    typeof arg === 'number' ? arg : asVector(arg, '分量')[i];
  if (args.every((arg) => typeof arg === 'number')) {
    return fn(...args.map((arg) => component(arg, 0)));
  }
  return Array.from({ length: width }, (_, i) => fn(...args.map((arg) => component(arg, i))));
}

function normalize(v: readonly number[]): number[] {
  const length = Math.hypot(...v);
  return v.map((x) => x / length);
}

function matTimesVec(m: GlslMat, v: readonly number[]): number[] {
  if (v.length !== m.size) throw new Error(`mat${m.size} × vec${v.length}`);
  return Array.from({ length: m.size }, (_, row) =>
    v.reduce((sum, x, col) => sum + m.e[col * m.size + row] * x, 0)
  );
}

/** GLSL 的“行向量 × 矩阵”：结果第 j 分量 = dot(v, 第 j 列) */
function vecTimesMat(v: readonly number[], m: GlslMat): number[] {
  if (v.length !== m.size) throw new Error(`vec${v.length} × mat${m.size}`);
  return Array.from({ length: m.size }, (_, col) =>
    v.reduce((sum, x, row) => sum + x * m.e[col * m.size + row], 0)
  );
}

function multiply(a: GlslValue, b: GlslValue): GlslValue {
  if (a instanceof GlslMat && b instanceof GlslMat) {
    if (a.size !== b.size) throw new Error(`mat${a.size} × mat${b.size}`);
    const columns = Array.from({ length: b.size }, (_, c) => matTimesVec(a, b.column(c)));
    return new GlslMat(a.size, columns.flat());
  }
  if (a instanceof GlslMat) return matTimesVec(a, asVector(b, 'mat × ?'));
  if (b instanceof GlslMat) return vecTimesMat(asVector(a, '? × mat'), b);
  return componentwise([a, b], (x, y) => x * y);
}

function binary(op: string, a: GlslValue, b: GlslValue): GlslValue {
  switch (op) {
    case '*':
      return multiply(a, b);
    case '/':
      return componentwise([a, b], (x, y) => x / y);
    case '+':
      return componentwise([a, b], (x, y) => x + y);
    case '-':
      return componentwise([a, b], (x, y) => x - y);
    default:
      throw new Error(`不支持的运算符 ${op}`);
  }
}

const SWIZZLE_INDEX: Readonly<Record<string, number>> = {
  x: 0,
  y: 1,
  z: 2,
  w: 3,
  r: 0,
  g: 1,
  b: 2,
  a: 3,
};

function swizzleIndices(vector: readonly number[], swizzle: string): number[] {
  return swizzle.split('').map((c) => {
    const index = Object.prototype.hasOwnProperty.call(SWIZZLE_INDEX, c) ? SWIZZLE_INDEX[c] : -1;
    if (index < 0 || index >= vector.length) {
      throw new Error(`无效分量 .${swizzle}（vec${vector.length}）`);
    }
    return index;
  });
}

function readSwizzle(value: GlslValue, swizzle: string): GlslValue {
  const vector = asVector(value, `.${swizzle}`);
  const picked = swizzleIndices(vector, swizzle).map((i) => vector[i]);
  return picked.length === 1 ? picked[0] : picked;
}

function writeSwizzle(target: GlslValue, swizzle: string, value: GlslValue): number[] {
  const vector = [...asVector(target, `.${swizzle} =`)];
  const indices = swizzleIndices(vector, swizzle);
  const parts = typeof value === 'number' ? [value] : asVector(value, `.${swizzle} =`);
  if (parts.length !== indices.length) throw new Error(`.${swizzle} 赋值分量数不符`);
  indices.forEach((i, k) => {
    vector[i] = parts[k];
  });
  return vector;
}

function readIndex(value: GlslValue, index: GlslValue): GlslValue {
  const i = asNumber(index, '下标');
  if (value instanceof GlslMat) return value.column(i);
  const vector = asVector(value, '下标');
  if (!Number.isInteger(i) || i < 0 || i >= vector.length) throw new Error(`下标越界：${i}`);
  return vector[i];
}

const TYPES = new Set(['float', 'vec2', 'vec3', 'vec4', 'mat3', 'mat4']);
const ASSIGN_OPS = new Set(['=', '+=', '-=', '*=', '/=']);

function construct(type: string, args: readonly GlslValue[]): GlslValue {
  if (type.startsWith('vec')) {
    const size = Number(type.slice(3));
    const flat = args.flatMap((arg) => {
      if (arg instanceof GlslMat) throw new Error(`${type}(mat) 不在子集内`);
      return typeof arg === 'number' ? [arg] : arg;
    });
    if (flat.length === 1) return new Array<number>(size).fill(flat[0]);
    if (flat.length !== size) throw new Error(`${type}(…) 收到 ${flat.length} 个分量`);
    return flat;
  }
  // mat3( mat4 )：取左上 3×3
  if (type === 'mat3' && args.length === 1) {
    const m = asMatrix(args[0], 'mat3(…)');
    if (m.size === 3) return m;
    return new GlslMat(
      3,
      [0, 1, 2].flatMap((c) => m.column(c).slice(0, 3))
    );
  }
  throw new Error(`${type}(…) 不在子集内`);
}

function fixedArity(fn: (...xs: number[]) => number): (args: readonly GlslValue[]) => GlslValue {
  return (args) => {
    if (args.length !== fn.length)
      throw new Error(`参数个数应为 ${fn.length}，得到 ${args.length}`);
    return componentwise(args, fn);
  };
}

/** 规格上的 smoothstep（GLSL 定义） */
function smoothstepSpec(edge0: number, edge1: number, x: number): number {
  const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
  return t * t * (3 - 2 * t);
}

const BUILTINS = new Map<string, (args: readonly GlslValue[]) => GlslValue>([
  ['smoothstep', fixedArity(smoothstepSpec)],
  ['mix', fixedArity((x: number, y: number, t: number) => x * (1 - t) + y * t)],
  ['clamp', fixedArity((x: number, lo: number, hi: number) => Math.min(Math.max(x, lo), hi))],
  ['pow', fixedArity((x: number, y: number) => Math.pow(x, y))],
  ['sin', fixedArity((x: number) => Math.sin(x))],
  ['cos', fixedArity((x: number) => Math.cos(x))],
  [
    'dot',
    ([a, b]) => {
      const u = asVector(a, 'dot');
      const v = asVector(b, 'dot');
      if (u.length !== v.length) throw new Error('dot 分量数不一致');
      return u.reduce((sum, x, i) => sum + x * v[i], 0);
    },
  ],
  ['normalize', ([a]) => normalize(asVector(a, 'normalize'))],
]);

/**
 * three 的 common 块里定义的函数（例如 inverseTransformDirection）：取 three 自己的源码，
 * 只接受“单条 return 语句”的函数体。
 */
function threeCommonFunction(name: string): { params: string[]; body: string } | null {
  const source = THREE.ShaderChunk.common
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
  const match = new RegExp(
    `\\b(?:float|vec[234]|mat[34])\\s+${name}\\s*\\(([^)]*)\\)\\s*\\{([^{}]*)\\}`
  ).exec(source);
  if (!match) return null;
  const body = /^\s*return\s+([\s\S]+?);\s*$/.exec(match[2]);
  if (!body) throw new Error(`three 的 ${name}() 不是单条 return 语句，超出本测试的 GLSL 子集`);
  const params = match[1].split(',').map((param) => param.trim().split(/\s+/).pop() ?? '');
  return { params, body: body[1] };
}

class GlslRunner {
  private pos = 0;

  private constructor(
    private readonly tokens: readonly Token[],
    private readonly env: GlslEnv
  ) {}

  /** 依次执行代码块里的语句（花括号、声明、赋值），结果写回 env */
  static run(source: string, env: GlslEnv, defines: ReadonlySet<string> = new Set()): void {
    const runner = new GlslRunner(tokenize(preprocess(source, defines)), env);
    while (!runner.done()) runner.statement();
  }

  /** 求单个表达式 */
  static evaluate(source: string, env: GlslEnv): GlslValue {
    const runner = new GlslRunner(tokenize(preprocess(source, new Set())), env);
    const value = runner.expression();
    if (!runner.done()) throw new Error(`表达式后有多余内容：${source}`);
    return value;
  }

  private done(): boolean {
    return this.pos >= this.tokens.length;
  }

  private current(): Token | undefined {
    return this.pos < this.tokens.length ? this.tokens[this.pos] : undefined;
  }

  private accept(text: string): boolean {
    const token = this.current();
    if (token === undefined || token.kind !== 'op' || token.text !== text) return false;
    this.pos += 1;
    return true;
  }

  private expect(text: string): void {
    if (!this.accept(text)) {
      throw new Error(`期望“${text}”，得到“${this.current()?.text ?? '结尾'}”`);
    }
  }

  private take(kind: Token['kind']): Token {
    const token = this.current();
    if (token === undefined || token.kind !== kind) {
      throw new Error(`期望 ${kind}，得到“${token?.text ?? '结尾'}”`);
    }
    this.pos += 1;
    return token;
  }

  private lookup(name: string): GlslValue {
    const value = this.env.get(name);
    if (value === undefined) throw new Error(`代码块读取了本测试未建模的标识符 ${name}`);
    return value;
  }

  private statement(): void {
    if (this.accept('{') || this.accept('}')) return;
    const head = this.take('id');
    if (TYPES.has(head.text)) {
      const name = this.take('id').text;
      if (this.env.has(name))
        throw new Error(`代码块重新声明了 ${name}（会遮蔽同名输入 / varying）`);
      this.expect('=');
      const value = this.expression();
      this.expect(';');
      if (shapeOf(value) !== head.text) {
        throw new Error(`${head.text} ${name} 被赋值为 ${shapeOf(value)}`);
      }
      this.env.set(name, value);
      return;
    }
    const swizzle = this.accept('.') ? this.take('id').text : null;
    const op = this.take('op').text;
    if (!ASSIGN_OPS.has(op)) throw new Error(`期望赋值运算符，得到 ${op}`);
    const rhs = this.expression();
    this.expect(';');
    const current = this.lookup(head.text);
    const target = swizzle === null ? current : readSwizzle(current, swizzle);
    const value = op === '=' ? rhs : binary(op.charAt(0), target, rhs);
    if (shapeOf(value) !== shapeOf(target)) {
      throw new Error(`把 ${shapeOf(value)} 赋给 ${shapeOf(target)}（${head.text}）`);
    }
    this.env.set(head.text, swizzle === null ? value : writeSwizzle(current, swizzle, value));
  }

  private expression(): GlslValue {
    let value = this.term();
    for (;;) {
      if (this.accept('+')) value = binary('+', value, this.term());
      else if (this.accept('-')) value = binary('-', value, this.term());
      else return value;
    }
  }

  private term(): GlslValue {
    let value = this.unary();
    for (;;) {
      if (this.accept('*')) value = binary('*', value, this.unary());
      else if (this.accept('/')) value = binary('/', value, this.unary());
      else return value;
    }
  }

  private unary(): GlslValue {
    if (this.accept('-')) return componentwise([this.unary()], (x) => -x);
    if (this.accept('+')) return this.unary();
    return this.postfix();
  }

  private postfix(): GlslValue {
    let value = this.primary();
    for (;;) {
      if (this.accept('.')) {
        value = readSwizzle(value, this.take('id').text);
      } else if (this.accept('[')) {
        const index = this.expression();
        this.expect(']');
        value = readIndex(value, index);
      } else {
        return value;
      }
    }
  }

  private primary(): GlslValue {
    if (this.accept('(')) {
      const value = this.expression();
      this.expect(')');
      return value;
    }
    const token = this.current();
    if (token !== undefined && token.kind === 'num') {
      this.pos += 1;
      return Number(token.text);
    }
    const name = this.take('id').text;
    if (!this.accept('(')) return this.lookup(name);
    const args: GlslValue[] = [];
    if (!this.accept(')')) {
      do {
        args.push(this.expression());
      } while (this.accept(','));
      this.expect(')');
    }
    return this.call(name, args);
  }

  private call(name: string, args: GlslValue[]): GlslValue {
    if (TYPES.has(name)) return construct(name, args);
    const builtin = BUILTINS.get(name);
    if (builtin) return builtin(args);
    const fn = threeCommonFunction(name);
    if (!fn) throw new Error(`代码块调用了本测试未建模的函数 ${name}()`);
    if (fn.params.length !== args.length) throw new Error(`${name}() 参数个数不符`);
    const local: GlslEnv = new Map(
      fn.params.map((param, i): [string, GlslValue] => [param, args[i]])
    );
    return GlslRunner.evaluate(fn.body, local);
  }
}

/* ------------------------------------------------------------------------------------------ */
/* three 侧的夹具                                                                              */
/* ------------------------------------------------------------------------------------------ */

const DEG = Math.PI / 180;
const NO_RENDERER = {} as unknown as THREE.WebGLRenderer;

/** 三关（高山）的雪线：WORLDSCAPE_WATER_Y (-48) + 2 … + 12 */
const LEVEL3_RANGE: SnowWorldYRange = { start: -46, end: -36 };
const UP = new THREE.Vector3(0, 1, 0);
const IDENTITY = new THREE.Matrix4();
/** 底色：三关雪下露出的绿色植被顶点色 */
const GREEN: readonly number[] = [0.18, 0.42, 0.16, 1];

interface PatchedShader {
  uniforms: Record<string, THREE.IUniform>;
  vertexShader: string;
  fragmentShader: string;
}

/** 模拟 WebGLRenderer 为 MeshStandardMaterial 编译程序：three 自己的标准材质源码 → onBeforeCompile */
function compileStandard(material: THREE.Material): PatchedShader {
  const lib = THREE.ShaderLib.standard;
  const shader: PatchedShader = {
    uniforms: THREE.UniformsUtils.clone(lib.uniforms),
    vertexShader: lib.vertexShader,
    fragmentShader: lib.fragmentShader,
  };
  // 补丁只读写 uniforms / vertexShader / fragmentShader，其余 WebGLProgramParameters 字段与之无关
  material.onBeforeCompile(
    shader as unknown as THREE.WebGLProgramParametersWithUniforms,
    NO_RENDERER
  );
  return shader;
}

interface TestUniforms {
  snow: ShaderUniform;
  time: ShaderUniform;
  wind: ShaderUniform;
}

function makeUniforms(): TestUniforms {
  return { snow: { value: 1 }, time: { value: 0 }, wind: { value: 0 } };
}

interface PatchCase {
  name: string;
  /** 规格：世界空间朝上分量的 smoothstep 阈值 */
  facing: readonly [number, number];
  wind: boolean;
  apply(material: THREE.Material, uniforms: TestUniforms, range?: SnowWorldYRange): void;
}

const PATCHES: readonly PatchCase[] = [
  {
    name: 'injectSnowCover',
    facing: [0.45, 0.85],
    wind: false,
    apply: (material, u, range) => injectSnowCover(material, u.snow, 'test', range),
  },
  {
    name: 'injectSnowAndWind',
    facing: [0.35, 0.8],
    wind: true,
    apply: (material, u, range) =>
      injectSnowAndWind(material, u.snow, u.time, u.wind, 0.18, 6.0, 'test', range),
  },
];

function patchedShader(
  patch: PatchCase,
  range?: SnowWorldYRange
): { uniforms: TestUniforms; shader: PatchedShader } {
  const uniforms = makeUniforms();
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true });
  patch.apply(material, uniforms, range);
  return { uniforms, shader: compileStandard(material) };
}

function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

function mainBody(code: string): string {
  const at = code.indexOf('void main()');
  if (at < 0) throw new Error('着色器里没有 main()');
  return code.slice(at);
}

function beforeMain(code: string): string {
  return code.slice(0, code.indexOf('void main()'));
}

/** marker 之后、下一条 #include 之前被注入的代码 */
function injectedAfter(code: string, marker: string): string {
  const at = code.indexOf(marker);
  if (at < 0) throw new Error(`着色器里没有 ${marker}`);
  const start = at + marker.length;
  const next = code.indexOf('#include <', start);
  return code.slice(start, next < 0 ? undefined : next);
}

function snowBlock(patch: PatchCase, range?: SnowWorldYRange): string {
  return injectedAfter(
    patchedShader(patch, range).shader.fragmentShader,
    '#include <normal_fragment_maps>'
  );
}

function heightBlock(patch: PatchCase): string {
  return injectedAfter(patchedShader(patch).shader.vertexShader, '#include <begin_vertex>');
}

interface CameraCase {
  name: string;
  camera: THREE.PerspectiveCamera;
}

/** 飞机式相机：航向（绕 Y）→ 俯仰（绕 X）→ 滚转（绕 Z），即 three 的 'YXZ' 欧拉顺序 */
function aircraftCamera(
  name: string,
  position: [number, number, number],
  headingDeg: number,
  pitchDeg: number,
  rollDeg: number
): CameraCase {
  const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.5, 8000);
  camera.position.set(...position);
  camera.rotation.set(pitchDeg * DEG, headingDeg * DEG, rollDeg * DEG, 'YXZ');
  camera.updateMatrixWorld(true);
  return { name, camera };
}

const CAMERAS: readonly CameraCase[] = [
  aircraftCamera('level flight', [0, 140, 0], 0, 0, 0),
  aircraftCamera('straight-down dive', [60, 420, -80], 0, -90, 0),
  aircraftCamera('45° dive, 30° roll', [-200, 260, 90], 35, -45, 30),
  aircraftCamera('knife edge (90° bank)', [10, 90, 300], -60, 0, 90),
  aircraftCamera('inverted', [0, 180, -40], 120, 0, 180),
  aircraftCamera('80° dive, banked 135°', [500, 600, 500], -150, -80, -135),
  aircraftCamera('climbing, nose 70° up', [0, 60, 0], 20, 70, 0),
];
const LEVEL = CAMERAS[0].camera;
const DIVE = CAMERAS[1].camera;

/**
 * three 交给片元着色器的视图空间法线：在 CPU 上执行 three 自己的 defaultnormal_vertex 块
 * （实例矩阵 → normalMatrix），再 normalize（normal_vertex / normal_fragment_begin 的平滑路径）。
 * normalMatrix 与 WebGLRenderer 一致：getNormalMatrix(camera.matrixWorldInverse · object.matrixWorld)。
 * 地形 / 植被用 flatShading：由 vViewPosition 的屏幕导数求面法线，对正面而言是同一个视图空间面法线。
 */
function threeViewNormal(
  objectNormal: THREE.Vector3,
  camera: THREE.Camera,
  modelMatrix: THREE.Matrix4,
  instanceMatrix?: THREE.Matrix4
): number[] {
  const modelView = new THREE.Matrix4().multiplyMatrices(camera.matrixWorldInverse, modelMatrix);
  const env: GlslEnv = new Map<string, GlslValue>([
    ['objectNormal', [objectNormal.x, objectNormal.y, objectNormal.z]],
    ['normalMatrix', GlslMat.from(new THREE.Matrix3().getNormalMatrix(modelView))],
  ]);
  const defines = new Set<string>();
  if (instanceMatrix) {
    env.set('instanceMatrix', GlslMat.from(instanceMatrix));
    defines.add('USE_INSTANCING');
  }
  GlslRunner.run(THREE.ShaderChunk.defaultnormal_vertex, env, defines);
  return normalize(asVector(env.get('transformedNormal'), 'transformedNormal'));
}

/** 规格侧：表面在世界空间的朝上分量 */
function worldUp(
  objectNormal: THREE.Vector3,
  modelMatrix: THREE.Matrix4,
  instanceMatrix?: THREE.Matrix4
): number {
  const world = instanceMatrix ? modelMatrix.clone().multiply(instanceMatrix) : modelMatrix;
  return objectNormal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(world)).normalize()
    .y;
}

interface ShadeInput {
  camera: THREE.Camera;
  objectNormal: THREE.Vector3;
  modelMatrix?: THREE.Matrix4;
  instanceMatrix?: THREE.Matrix4;
  worldY: number;
  cover: number;
}

/** 执行补丁注入到 normal_fragment_maps 之后的代码块；输入只有片元阶段在那一刻真实可用的值 */
function shadeSnow(
  block: string,
  input: ShadeInput
): { color: number[]; inputs: GlslEnv; env: GlslEnv } {
  const model = input.modelMatrix ?? IDENTITY;
  const inputs: GlslEnv = new Map<string, GlslValue>([
    ['normal', threeViewNormal(input.objectNormal, input.camera, model, input.instanceMatrix)],
    ['viewMatrix', GlslMat.from(input.camera.matrixWorldInverse)],
    ['vSnowWorldY', input.worldY],
    ['uSnowCover', input.cover],
    ['diffuseColor', [...GREEN]],
  ]);
  const env: GlslEnv = new Map(inputs);
  GlslRunner.run(block, env, new Set(input.instanceMatrix ? ['USE_INSTANCING'] : []));
  return { color: asVector(env.get('diffuseColor'), 'diffuseColor').slice(0, 3), inputs, env };
}

/** 平地、雪线以上、uSnowCover = 1、平飞相机：完全积雪时的颜色（各通道都应明显变白） */
function fullSnow(block: string): number[] {
  const { color } = shadeSnow(block, { camera: LEVEL, objectNormal: UP, worldY: 10_000, cover: 1 });
  color.forEach((c, i) => {
    expect(c - GREEN[i], `channel ${i} whitened by full snow`).toBeGreaterThan(0.3);
  });
  return color;
}

/** 从底色到完全积雪的比例（三个通道必须一致：雪是同一权重的 mix） */
function snowFraction(color: readonly number[], full: readonly number[]): number {
  const fractions = color.map((c, i) => (c - GREEN[i]) / (full[i] - GREEN[i]));
  expect(Math.max(...fractions) - Math.min(...fractions)).toBeLessThan(1e-9);
  return fractions[0];
}

/** 具有给定世界朝上分量的法线（方位角 azimuth 绕 Y） */
function normalWithUp(up: number, azimuthDeg: number): THREE.Vector3 {
  const horizontal = Math.sqrt(1 - up * up);
  return new THREE.Vector3(
    horizontal * Math.cos(azimuthDeg * DEG),
    up,
    horizontal * Math.sin(azimuthDeg * DEG)
  );
}

/** 三关的地形 / 植被组在水位 -48 */
const TERRAIN_MODEL = new THREE.Matrix4().makeTranslation(12, -48, -7);
/** 一棵松树实例：平移 + 偏航 40° + 前倾 15° + 缩放 1.3 */
const TILTED_PINE = new THREE.Matrix4().compose(
  new THREE.Vector3(30, 15, -22),
  new THREE.Quaternion().setFromEuler(new THREE.Euler(15 * DEG, 40 * DEG, 0, 'YXZ')),
  new THREE.Vector3(1.3, 1.3, 1.3)
);

interface SurfaceCase {
  name: string;
  objectNormal: THREE.Vector3;
  instanceMatrix?: THREE.Matrix4;
}

const SURFACES: readonly SurfaceCase[] = [
  { name: 'flat ground', objectNormal: UP },
  { name: '40° slope', objectNormal: normalWithUp(Math.cos(40 * DEG), 125) },
  { name: '50° slope', objectNormal: normalWithUp(Math.cos(50 * DEG), -30) },
  { name: 'cliff face', objectNormal: new THREE.Vector3(1, 0, 0) },
  { name: 'overhang underside', objectNormal: new THREE.Vector3(0, -1, 0) },
  { name: 'instanced pine, top face', objectNormal: UP, instanceMatrix: TILTED_PINE },
  {
    name: 'instanced pine, side face',
    objectNormal: new THREE.Vector3(0.6, 0.55, 0.2).normalize(),
    instanceMatrix: TILTED_PINE,
  },
];

/* ------------------------------------------------------------------------------------------ */
/* 用例                                                                                        */
/* ------------------------------------------------------------------------------------------ */

describe('snow cover shader patches (worldscape/shadermods)', () => {
  it('premise: three r160 hands the patch a view-space normal and provides inverseTransformDirection', () => {
    // 顶点法线经 normalMatrix（模型视图矩阵的逆转置）进入视图空间；平直着色由 vViewPosition 求导
    expect(THREE.ShaderChunk.defaultnormal_vertex).toContain(
      'transformedNormal = normalMatrix * transformedNormal;'
    );
    expect(THREE.ShaderChunk.normal_fragment_begin).toContain('dFdx( vViewPosition )');
    expect(threeCommonFunction('inverseTransformDirection')).not.toBeNull();
    // 平飞相机下视图空间与世界空间的“上”一致，俯冲时平地的视图空间法线正对相机
    expect(threeViewNormal(UP, LEVEL, IDENTITY)[1]).toBeCloseTo(1, 9);
    expect(threeViewNormal(UP, DIVE, IDENTITY)[1]).toBeCloseTo(0, 9);
    expect(threeViewNormal(UP, DIVE, IDENTITY)[2]).toBeCloseTo(1, 9);
  });

  it('control: the pre-fix term smoothstep(…, normal.y) changes with the camera, so these cameras expose the bug', () => {
    const facing = CAMERAS.map(({ camera }) =>
      asNumber(
        GlslRunner.evaluate(
          'smoothstep( 0.45, 0.85, normal.y )',
          new Map<string, GlslValue>([['normal', threeViewNormal(UP, camera, IDENTITY)]])
        ),
        'facing'
      )
    );
    expect(facing[0]).toBeCloseTo(1, 9); // 平飞：满雪
    expect(facing[1]).toBeCloseTo(0, 9); // 垂直俯冲：雪消失（owner 看到的绿地）
    expect(Math.min(...facing)).toBeCloseTo(0, 9);
  });

  for (const patch of PATCHES) {
    const [lo, hi] = patch.facing;

    describe(patch.name, () => {
      it("patches three's standard-material shader once: declarations before main(), world height after begin_vertex, snow after normal_fragment_maps and before lighting", () => {
        const { shader } = patchedShader(patch, LEVEL3_RANGE);
        const fragment = shader.fragmentShader;
        const vertex = shader.vertexShader;

        // 原有 #include 都还在且各一次（补丁是插入而不是替换掉 three 的代码）
        for (const marker of ['#include <common>', '#include <normal_fragment_maps>']) {
          expect(count(fragment, marker), marker).toBe(1);
        }
        for (const marker of ['#include <common>', '#include <begin_vertex>']) {
          expect(count(vertex, marker), marker).toBe(1);
        }

        // 声明：两个阶段各一次 varying，片元一次 uniform，都在 main() 之前
        expect(count(beforeMain(fragment), 'uniform float uSnowCover;')).toBe(1);
        expect(count(beforeMain(fragment), 'varying float vSnowWorldY;')).toBe(1);
        expect(count(beforeMain(vertex), 'varying float vSnowWorldY;')).toBe(1);

        // 片元：雪只混一次；在顶点色（color_fragment）与法线贴图之后、光照之前
        const fragMain = mainBody(fragment);
        expect(count(fragMain, 'uSnowCover')).toBe(1);
        const mapsAt = fragMain.indexOf('#include <normal_fragment_maps>');
        const snowAt = fragMain.indexOf('uSnowCover');
        expect(fragMain.indexOf('#include <color_fragment>')).toBeLessThan(mapsAt);
        expect(mapsAt).toBeLessThan(snowAt);
        expect(snowAt).toBeLessThan(fragMain.indexOf('#include <', mapsAt + 1));
        expect(snowAt).toBeLessThan(fragMain.indexOf('#include <lights_physical_fragment>'));

        // 朝向项经 viewMatrix 换回世界空间，而不是直接取视图空间的 normal.y
        const block = injectedAfter(fragment, '#include <normal_fragment_maps>');
        expect(block).toContain('viewMatrix');
        expect(block).not.toMatch(/\bnormal\s*\.\s*y\b/);

        // 顶点：世界高度在 begin_vertex（transformed 已声明）之后、project_vertex 之前写一次
        const vertMain = mainBody(vertex);
        expect(count(vertMain, 'vSnowWorldY')).toBe(1);
        const beginAt = vertMain.indexOf('#include <begin_vertex>');
        const heightAt = vertMain.indexOf('vSnowWorldY');
        expect(beginAt).toBeLessThan(heightAt);
        expect(heightAt).toBeLessThan(vertMain.indexOf('#include <', beginAt + 1));
        expect(heightAt).toBeLessThan(vertMain.indexOf('#include <project_vertex>'));
      });

      it("shares the caller's uniform objects with every compiled program, so runtime changes take effect", () => {
        const uniforms = makeUniforms();
        const material = new THREE.MeshStandardMaterial({ flatShading: true });
        patch.apply(material, uniforms, LEVEL3_RANGE);
        // three 会为不同对象（普通网格 / 实例化网格）各编译一次同一材质
        const programs = [compileStandard(material), compileStandard(material)];
        for (const shader of programs) {
          expect(shader.uniforms.uSnowCover).toBe(uniforms.snow);
          if (patch.wind) {
            expect(shader.uniforms.uWindTime).toBe(uniforms.time);
            expect(shader.uniforms.uWindStrength).toBe(uniforms.wind);
          }
          expect(shader.uniforms.diffuse, 'standard uniforms are kept').toBeDefined();
        }
        uniforms.snow.value = 0.37;
        for (const shader of programs) expect(shader.uniforms.uSnowCover.value).toBe(0.37);
      });

      it('gives every surface the same snow for every camera orientation (level, dive, bank, inverted, climb) — instanced and not', () => {
        const block = snowBlock(patch, LEVEL3_RANGE);
        const full = fullSnow(block);
        for (const surface of SURFACES) {
          const shade = (camera: THREE.Camera): number[] =>
            shadeSnow(block, {
              camera,
              objectNormal: surface.objectNormal,
              modelMatrix: TERRAIN_MODEL,
              instanceMatrix: surface.instanceMatrix,
              worldY: 10_000,
              cover: 1,
            }).color;
          const reference = shade(LEVEL);
          for (const { name, camera } of CAMERAS) {
            const color = shade(camera);
            color.forEach((c, i) => {
              expect(c, `${surface.name}, ${name}, channel ${i}`).toBeCloseTo(reference[i], 6);
            });
          }
          // 而且这份“与相机无关”的雪就是世界朝上分量给出的那一份
          const up = worldUp(surface.objectNormal, TERRAIN_MODEL, surface.instanceMatrix);
          expect(snowFraction(reference, full), surface.name).toBeCloseTo(
            smoothstepSpec(lo, hi, up),
            6
          );
        }
        // 垂直俯冲看平地：全白（修复前这里是 0，露出绿色底色）
        expect(
          snowFraction(
            shadeSnow(block, { camera: DIVE, objectNormal: UP, worldY: 10_000, cover: 1 }).color,
            full
          )
        ).toBeCloseTo(1, 6);
      });

      it(`follows the world-space slope with thresholds ${lo}–${hi}, whatever the camera`, () => {
        const block = snowBlock(patch, LEVEL3_RANGE);
        const full = fullSnow(block);
        const ups = [0, 0.2, lo, (lo + hi) / 2, 0.65, hi, 0.95, 1];
        for (const up of ups) {
          for (const { name, camera } of CAMERAS) {
            const { color } = shadeSnow(block, {
              camera,
              objectNormal: normalWithUp(up, 70),
              worldY: 10_000,
              cover: 1,
            });
            expect(snowFraction(color, full), `world up ${up}, ${name}`).toBeCloseTo(
              smoothstepSpec(lo, hi, up),
              6
            );
          }
        }
      });

      it('scales with world height across the snow range and with uSnowCover', () => {
        const ranges: readonly SnowWorldYRange[] = [LEVEL3_RANGE, { start: 2, end: 14 }];
        for (const range of ranges) {
          const block = snowBlock(patch, range);
          const full = fullSnow(block);
          const { start, end } = range;
          const heights = [
            start - 30,
            start,
            start + 0.3 * (end - start),
            (start + end) / 2,
            end,
            end + 400,
          ];
          for (const worldY of heights) {
            for (const camera of [LEVEL, DIVE]) {
              const { color } = shadeSnow(block, { camera, objectNormal: UP, worldY, cover: 1 });
              expect(snowFraction(color, full), `range ${start}–${end}, y ${worldY}`).toBeCloseTo(
                smoothstepSpec(start, end, worldY),
                6
              );
            }
          }
          for (const cover of [0, 0.25, 0.5, 1]) {
            const { color } = shadeSnow(block, {
              camera: DIVE,
              objectNormal: UP,
              worldY: end + 400,
              cover,
            });
            expect(snowFraction(color, full), `uSnowCover ${cover}`).toBeCloseTo(cover, 6);
          }
        }
      });

      it('changes only diffuseColor — the view-space normal used for lighting is left untouched', () => {
        const block = snowBlock(patch, LEVEL3_RANGE);
        for (const { name, camera } of CAMERAS) {
          const { inputs, env } = shadeSnow(block, {
            camera,
            objectNormal: SURFACES[1].objectNormal,
            worldY: -40,
            cover: 0.8,
          });
          for (const [key, value] of inputs) {
            if (key !== 'diffuseColor') expect(env.get(key), `${name}: ${key}`).toEqual(value);
          }
        }
      });

      it('computes vSnowWorldY as the world height of the vertex (instanceMatrix under USE_INSTANCING), the same for every camera', () => {
        const block = heightBlock(patch);
        const local = new THREE.Vector3(0.4, 2.5, -0.3);
        // 实例只做偏航 + 缩放 + 平移：风只推 x / z，不改变世界高度
        const yawedPine = new THREE.Matrix4().compose(
          new THREE.Vector3(30, 15, -22),
          new THREE.Quaternion().setFromAxisAngle(UP, 40 * DEG),
          new THREE.Vector3(1.3, 1.3, 1.3)
        );
        for (const instanced of [false, true]) {
          const world = instanced ? TERRAIN_MODEL.clone().multiply(yawedPine) : TERRAIN_MODEL;
          const expected = local.clone().applyMatrix4(world).y;
          for (const { name, camera } of CAMERAS) {
            const env: GlslEnv = new Map<string, GlslValue>([
              ['position', [local.x, local.y, local.z]],
              ['transformed', [local.x, local.y, local.z]],
              ['modelMatrix', GlslMat.from(TERRAIN_MODEL)],
              ['viewMatrix', GlslMat.from(camera.matrixWorldInverse)],
              [
                'modelViewMatrix',
                GlslMat.from(
                  new THREE.Matrix4().multiplyMatrices(camera.matrixWorldInverse, TERRAIN_MODEL)
                ),
              ],
              [
                'cameraPosition',
                new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld).toArray(),
              ],
              ['uWindTime', 3.7],
              ['uWindStrength', 0.8],
              ['vSnowWorldY', Number.NaN],
            ]);
            if (instanced) env.set('instanceMatrix', GlslMat.from(yawedPine));
            GlslRunner.run(block, env, new Set(instanced ? ['USE_INSTANCING'] : []));
            expect(
              asNumber(env.get('vSnowWorldY'), 'vSnowWorldY'),
              `${instanced ? 'instanced' : 'plain'} mesh, ${name}`
            ).toBeCloseTo(expected, 6);
          }
        }
      });
    });
  }

  it('gives every distinct generated program its own customProgramCacheKey, and equal parameters the same key', () => {
    const u = makeUniforms();
    const variants: ReadonlyArray<[string, (material: THREE.Material) => void]> = [
      ['snow terrain, default range', (m) => injectSnowCover(m, u.snow, 'worldscape-terrain')],
      [
        'snow terrain, level 3',
        (m) => injectSnowCover(m, u.snow, 'worldscape-terrain', LEVEL3_RANGE),
      ],
      [
        'snow terrain, other end',
        (m) => injectSnowCover(m, u.snow, 'worldscape-terrain', { start: -46, end: -30 }),
      ],
      ['snow rock, level 3', (m) => injectSnowCover(m, u.snow, 'rock', LEVEL3_RANGE)],
      [
        'snow+wind pine',
        (m) => injectSnowAndWind(m, u.snow, u.time, u.wind, 0.18, 6.0, 'pine', LEVEL3_RANGE),
      ],
      [
        'snow+wind pine, amplitude',
        (m) => injectSnowAndWind(m, u.snow, u.time, u.wind, 0.22, 6.0, 'pine', LEVEL3_RANGE),
      ],
      [
        'snow+wind pine, height',
        (m) => injectSnowAndWind(m, u.snow, u.time, u.wind, 0.18, 4.4, 'pine', LEVEL3_RANGE),
      ],
      [
        'snow+wind pine, default range',
        (m) => injectSnowAndWind(m, u.snow, u.time, u.wind, 0.18, 6.0, 'pine'),
      ],
      ['wind pine', (m) => injectWindSway(m, u.time, u.wind, 0.18, 6.0, 'pine')],
    ];
    const build = (apply: (material: THREE.Material) => void): { key: string; code: string } => {
      const material = new THREE.MeshStandardMaterial();
      apply(material);
      const shader = compileStandard(material);
      return {
        key: material.customProgramCacheKey(),
        code: `${shader.vertexShader}\n/* ---- */\n${shader.fragmentShader}`,
      };
    };
    const built = variants.map(([name, apply]) => ({ name, ...build(apply) }));
    // 网格确实生成了不同的程序（只有 terrain / rock 两个同参变体共用一份代码），下面的检查才有意义
    expect(new Set(built.map((b) => b.code)).size).toBeGreaterThanOrEqual(variants.length - 1);
    for (let i = 0; i < built.length; i++) {
      for (let j = i + 1; j < built.length; j++) {
        if (built[i].code !== built[j].code) {
          expect(built[i].key, `${built[i].name} vs ${built[j].name}`).not.toBe(built[j].key);
        }
      }
    }
    // 同样的参数：同一个键、同一份代码（three 可以共享程序）
    for (const [name, apply] of variants) {
      const a = build(apply);
      const b = build(apply);
      expect(a.key, name).toBe(b.key);
      expect(a.code, name).toBe(b.code);
    }
  });
});
