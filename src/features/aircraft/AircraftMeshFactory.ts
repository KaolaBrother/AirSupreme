/**
 * 飞机模型工厂 - 统一的飞机 mesh 创建函数
 *
 * 方向约定：
 * - 前进方向 = -Z
 * - 上方向 = +Y
 * - 右方向 = +X
 */

import * as THREE from 'three';
import { EnemyType, ENEMY_CONFIGS } from '@/features/enemy/EnemyTypes';

type EnemyConfig = (typeof ENEMY_CONFIGS)[EnemyType];

// 缓存：按敌机类型存储几何体和材质
interface CachedGeometry {
  body: THREE.ConeGeometry;
  wing: THREE.BoxGeometry;
  cockpit: THREE.SphereGeometry;
  tail: THREE.BoxGeometry;
  vStab: THREE.BoxGeometry;
  engine: THREE.ConeGeometry;
}

interface CachedMaterials {
  body: THREE.MeshStandardMaterial;
  wing: THREE.MeshStandardMaterial;
  cockpit: THREE.MeshStandardMaterial;
  engine: THREE.MeshBasicMaterial;
}

const geometryCache: Map<EnemyType, CachedGeometry> = new Map();
const materialsCache: Map<EnemyType, CachedMaterials> = new Map();

function getOrCreateGeometry(
  type: EnemyType,
  bodySize: number,
  bodyLength: number,
  wingSpan: number
): CachedGeometry {
  const cached = geometryCache.get(type);
  if (cached) return cached;

  const geometry: CachedGeometry = {
    body: new THREE.ConeGeometry(bodySize * 0.4, bodyLength, 8),
    wing: new THREE.BoxGeometry(wingSpan, 0.15, 1.2),
    cockpit: new THREE.SphereGeometry(bodySize * 0.35, 8, 8),
    tail: new THREE.BoxGeometry(wingSpan * 0.4, 0.12, 0.8),
    vStab: new THREE.BoxGeometry(0.15, bodySize * 0.6, 0.8),
    engine: new THREE.ConeGeometry(bodySize * 0.15, 0.6, 8),
  };

  geometryCache.set(type, geometry);
  return geometry;
}

function getOrCreateMaterials(
  type: EnemyType,
  bodyColor: number,
  wingColor: number,
  accentColor: number
): CachedMaterials {
  const cached = materialsCache.get(type);
  if (cached) return cached;

  const materials: CachedMaterials = {
    body: new THREE.MeshStandardMaterial({
      color: bodyColor,
      metalness: 0.7,
      roughness: 0.3,
    }),
    wing: new THREE.MeshStandardMaterial({
      color: wingColor,
      metalness: 0.6,
      roughness: 0.4,
    }),
    cockpit: new THREE.MeshStandardMaterial({
      color: accentColor,
      metalness: 0.9,
      roughness: 0.1,
      emissive: accentColor,
      emissiveIntensity: 0.3,
    }),
    engine: new THREE.MeshBasicMaterial({
      color: 0xff6600,
      transparent: true,
      opacity: 0.8,
    }),
  };

  materialsCache.set(type, materials);
  return materials;
}

/**
 * 创建玩家飞机模型 - F-15/F-22 风格战斗机
 * 更精致的设计：双垂尾、进气口、武器挂点
 */
export function createPlayerMesh(): THREE.Group {
  const group = new THREE.Group();

  // 材料定义
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0x4488ff,
    metalness: 0.8,
    roughness: 0.2,
  });

  const wingMaterial = new THREE.MeshStandardMaterial({
    color: 0x3366dd,
    metalness: 0.7,
    roughness: 0.3,
  });

  const cockpitMaterial = new THREE.MeshStandardMaterial({
    color: 0x111133,
    metalness: 0.95,
    roughness: 0.1,
    transparent: true,
    opacity: 0.85,
  });

  const accentMaterial = new THREE.MeshStandardMaterial({
    color: 0x2266cc,
    metalness: 0.9,
    roughness: 0.2,
  });

  const engineMaterial = new THREE.MeshStandardMaterial({
    color: 0x333344,
    metalness: 0.8,
    roughness: 0.3,
  });

  // === 机身 - 流线型 fuselage ===
  // 使用多个部分组成机身
  const fuselageLength = 4.0;

  // === 机头锥体 ===
  // ConeGeometry 默认尖端朝向 +Y
  // rotation.x = -PI/2 使尖端朝向 -Z（前方）
  const noseGeometry = new THREE.ConeGeometry(0.4, 1.2, 12);
  const nose = new THREE.Mesh(noseGeometry, bodyMaterial);
  nose.rotation.x = -Math.PI / 2;
  nose.position.set(0, 0, -fuselageLength / 2 - 0.1);
  nose.castShadow = true;
  group.add(nose);

  // === 中机身（座舱区域）===
  // CylinderGeometry 默认轴向 +Y
  // rotation.x = -PI/2 使轴向 -Z/+Z
  const midBodyGeometry = new THREE.CylinderGeometry(0.5, 0.5, 1.5, 12);
  const midBody = new THREE.Mesh(midBodyGeometry, bodyMaterial);
  midBody.rotation.x = -Math.PI / 2;
  midBody.position.set(0, 0, -fuselageLength / 2 + 0.7);
  midBody.castShadow = true;
  group.add(midBody);

  // === 后机身（发动机区域）===
  const rearBodyGeometry = new THREE.CylinderGeometry(0.55, 0.45, 1.8, 12);
  const rearBody = new THREE.Mesh(rearBodyGeometry, bodyMaterial);
  rearBody.rotation.x = -Math.PI / 2;
  rearBody.position.set(0, -0.05, 0.8);
  rearBody.castShadow = true;
  group.add(rearBody);

  // === 座舱盖 ===
  const cockpitGeometry = new THREE.SphereGeometry(0.35, 12, 12);
  const cockpit = new THREE.Mesh(cockpitGeometry, cockpitMaterial);
  cockpit.scale.set(0.8, 0.5, 1.3);
  cockpit.position.set(0, 0.4, -0.8);
  cockpit.castShadow = true;
  group.add(cockpit);

  // === 主翼 ===
  // ExtrudeGeometry 在 XY 平面创建，rotation.x = PI/2 后 Y→-Z
  // 所以 Y 值大 = Z 负（前方），Y 值小 = Z 正（后方）
  // 形状：前缘在前（Y 大），后缘在后（Y 小）
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0); // 根部后缘（Y=0 → Z=0 后方）
  wingShape.lineTo(0, 1.0); // 根部前缘（Y=1 → Z=-1 前方）
  wingShape.lineTo(2.2, 0.6); // 翼尖前缘
  wingShape.lineTo(1.8, 0); // 翼尖后缘
  wingShape.lineTo(0, 0);

  const wingGeometry = new THREE.ExtrudeGeometry(wingShape, {
    depth: 0.06,
    bevelEnabled: false,
  });

  // 左翼
  const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
  leftWing.rotation.x = Math.PI / 2;
  leftWing.rotation.z = Math.PI; // 镜像翻转
  leftWing.position.set(-0.4, 0, 0);
  leftWing.castShadow = true;
  group.add(leftWing);

  // 右翼
  const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
  rightWing.rotation.x = Math.PI / 2;
  rightWing.position.set(0.4, 0, 0);
  rightWing.castShadow = true;
  group.add(rightWing);

  // === 前缘延伸 (LERX - Leading Edge Root Extension) ===
  const lerxGeometry = new THREE.BoxGeometry(0.3, 0.08, 1.2);

  const leftLerx = new THREE.Mesh(lerxGeometry, accentMaterial);
  leftLerx.position.set(-0.5, 0.1, -1.2);
  leftLerx.rotation.y = 0.3;
  leftLerx.castShadow = true;
  group.add(leftLerx);

  const rightLerx = new THREE.Mesh(lerxGeometry, accentMaterial);
  rightLerx.position.set(0.5, 0.1, -1.2);
  rightLerx.rotation.y = -0.3;
  rightLerx.castShadow = true;
  group.add(rightLerx);

  // === 双垂尾 ===
  // Y 大 = 前方，Y 小 = 后方
  const vTailShape = new THREE.Shape();
  vTailShape.moveTo(0, 0); // 后缘底部
  vTailShape.lineTo(0.5, 0); // 后缘顶部
  vTailShape.lineTo(0.8, 0.8); // 前缘顶部（Y 大 → 前方）
  vTailShape.lineTo(0, 0.6); // 前缘底部
  vTailShape.lineTo(0, 0);

  const vTailGeometry = new THREE.ExtrudeGeometry(vTailShape, {
    depth: 0.04,
    bevelEnabled: false,
  });

  // 左垂尾（外倾 15 度）
  const leftVTail = new THREE.Mesh(vTailGeometry, wingMaterial);
  leftVTail.rotation.x = Math.PI / 2;
  leftVTail.rotation.z = Math.PI;
  leftVTail.position.set(-0.6, 0.3, 1.5);
  leftVTail.rotation.y = -0.26; // 外倾 15 度
  leftVTail.castShadow = true;
  group.add(leftVTail);

  // 右垂尾（外倾 15 度）
  const rightVTail = new THREE.Mesh(vTailGeometry, wingMaterial);
  rightVTail.rotation.x = Math.PI / 2;
  rightVTail.position.set(0.6, 0.3, 1.5);
  rightVTail.rotation.y = 0.26; // 外倾 15 度
  rightVTail.castShadow = true;
  group.add(rightVTail);

  // === 水平尾翼 ===
  // Y 大 = 前方，Y 小 = 后方
  const hTailShape = new THREE.Shape();
  hTailShape.moveTo(0, 0); // 后缘根部
  hTailShape.lineTo(0, 0.5); // 前缘根部（Y 大 → 前方）
  hTailShape.lineTo(0.9, 0.4); // 前缘翼尖
  hTailShape.lineTo(0.7, 0); // 后缘翼尖
  hTailShape.lineTo(0, 0);

  const hTailGeometry = new THREE.ExtrudeGeometry(hTailShape, {
    depth: 0.04,
    bevelEnabled: false,
  });

  // 左水平尾翼
  const leftHTail = new THREE.Mesh(hTailGeometry, wingMaterial);
  leftHTail.rotation.x = Math.PI / 2;
  leftHTail.rotation.z = Math.PI;
  leftHTail.position.set(-0.35, 0, 1.3);
  leftHTail.castShadow = true;
  group.add(leftHTail);

  // 右水平尾翼
  const rightHTail = new THREE.Mesh(hTailGeometry, wingMaterial);
  rightHTail.rotation.x = Math.PI / 2;
  rightHTail.position.set(0.35, 0, 1.3);
  rightHTail.castShadow = true;
  group.add(rightHTail);

  // === 进气口 (Intakes) - 两侧矩形进气 ===
  const intakeGeometry = new THREE.BoxGeometry(0.25, 0.3, 0.8);
  const intakeInnerMaterial = new THREE.MeshStandardMaterial({
    color: 0x111111,
    metalness: 0.5,
    roughness: 0.8,
  });

  const leftIntake = new THREE.Mesh(intakeGeometry, engineMaterial);
  leftIntake.position.set(-0.55, -0.15, -0.3);
  leftIntake.castShadow = true;
  group.add(leftIntake);

  // 进气口内部（深色）
  const leftIntakeInner = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.25), intakeInnerMaterial);
  leftIntakeInner.position.set(-0.68, -0.15, -0.3);
  leftIntakeInner.rotation.y = -Math.PI / 2;
  group.add(leftIntakeInner);

  const rightIntake = new THREE.Mesh(intakeGeometry, engineMaterial);
  rightIntake.position.set(0.55, -0.15, -0.3);
  rightIntake.castShadow = true;
  group.add(rightIntake);

  const rightIntakeInner = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.25), intakeInnerMaterial);
  rightIntakeInner.position.set(0.68, -0.15, -0.3);
  rightIntakeInner.rotation.y = Math.PI / 2;
  group.add(rightIntakeInner);

  // === 发动机喷口 ===
  // CylinderGeometry 默认轴向 +Y
  // rotation.x = -PI/2 使轴向 -Z/+Z
  const nozzleGeometry = new THREE.CylinderGeometry(0.18, 0.22, 0.4, 12);
  const glowMaterial = new THREE.MeshBasicMaterial({
    color: 0xff4400,
    transparent: true,
    opacity: 0.9,
  });

  // 左喷口
  const leftNozzle = new THREE.Mesh(nozzleGeometry, engineMaterial);
  leftNozzle.rotation.x = -Math.PI / 2;
  leftNozzle.position.set(-0.3, -0.05, 2.0);
  leftNozzle.castShadow = true;
  group.add(leftNozzle);

  // 火焰：ConeGeometry 尖端朝向 +Y，+PI/2 使尖端朝向 +Z（后方）
  const leftGlow = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 8), glowMaterial);
  leftGlow.rotation.x = Math.PI / 2;
  leftGlow.position.set(-0.3, -0.05, 2.15);
  leftGlow.name = 'engineGlow';
  group.add(leftGlow);

  // 右喷口
  const rightNozzle = new THREE.Mesh(nozzleGeometry, engineMaterial);
  rightNozzle.rotation.x = -Math.PI / 2;
  rightNozzle.position.set(0.3, -0.05, 2.0);
  rightNozzle.castShadow = true;
  group.add(rightNozzle);

  const rightGlow = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 8), glowMaterial);
  rightGlow.rotation.x = Math.PI / 2;
  rightGlow.position.set(0.3, -0.05, 2.15);
  rightGlow.name = 'engineGlow2';
  group.add(rightGlow);

  // === 武器挂点 (Weapon Hardpoints) ===
  const pylonGeometry = new THREE.BoxGeometry(0.08, 0.15, 0.4);

  // 左翼下挂点
  const leftPylon = new THREE.Mesh(pylonGeometry, accentMaterial);
  leftPylon.position.set(-1.2, -0.1, 0.5);
  leftPylon.rotation.y = 0.15;
  group.add(leftPylon);

  // 右翼下挂点
  const rightPylon = new THREE.Mesh(pylonGeometry, accentMaterial);
  rightPylon.position.set(1.2, -0.1, 0.5);
  rightPylon.rotation.y = -0.15;
  group.add(rightPylon);

  // === 细节装饰 ===
  // 机背脊线
  const spineGeometry = new THREE.BoxGeometry(0.08, 0.1, 2.5);
  const spine = new THREE.Mesh(spineGeometry, accentMaterial);
  spine.position.set(0, 0.45, -0.2);
  group.add(spine);

  // 设置阴影
  group.traverse((child) => {
    if (child instanceof THREE.Mesh && !child.name.includes('Glow')) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  return group;
}

/**
 * 创建敌机模型 - 统一版本
 *
 * 关键修复：移除 rotation.z = PI/2（这会导致机身侧向）
 */
export function createEnemyMesh(config: EnemyConfig): THREE.Group {
  const group = new THREE.Group();

  // 根据敌人类型定义配色和尺寸
  let bodyColor: number, wingColor: number, accentColor: number;
  let bodySize = 1.6,
    bodyLength = 6,
    wingSpan = 3;
  let scaleMultiplier = 1;

  switch (config.type) {
    case EnemyType.SCOUT:
      bodyColor = 0x4a5584;
      wingColor = 0x6b7b8e;
      accentColor = 0x3d5a87;
      bodySize = 1.2;
      bodyLength = 5;
      wingSpan = 2.2;
      scaleMultiplier = 0.85;
      break;
    case EnemyType.FIGHTER:
      bodyColor = 0xcc3300;
      wingColor = 0xe63900;
      accentColor = 0x8b2500;
      bodySize = 1.8;
      bodyLength = 7;
      wingSpan = 3.5;
      scaleMultiplier = 1.1;
      break;
    case EnemyType.HEAVY:
      bodyColor = 0x2c2c2c;
      wingColor = 0x3a3a3a;
      accentColor = 0x1a1a1a;
      bodySize = 2.2;
      bodyLength = 8;
      wingSpan = 4.2;
      scaleMultiplier = 1.3;
      break;
    case EnemyType.SNIPER:
      bodyColor = 0x4a235a;
      wingColor = 0x6b4c7a;
      accentColor = 0x7c3aed;
      bodySize = 1.6;
      bodyLength = 7.5;
      wingSpan = 2.8;
      scaleMultiplier = 0.95;
      break;
    case EnemyType.ACE:
      bodyColor = 0x8b0000;
      wingColor = 0xffd700;
      accentColor = 0xff4500;
      bodySize = 1.9;
      bodyLength = 7;
      wingSpan = 3.3;
      scaleMultiplier = 1.15;
      break;
    default:
      bodyColor = config.color;
      wingColor = config.color;
      accentColor = config.color;
  }

  group.scale.set(scaleMultiplier, scaleMultiplier, scaleMultiplier);

  // 使用缓存的几何体和材质
  const geometry = getOrCreateGeometry(config.type, bodySize, bodyLength, wingSpan);
  const materials = getOrCreateMaterials(config.type, bodyColor, wingColor, accentColor);

  // === 机身 - 锥形，机头细机尾粗 ===
  const body = new THREE.Mesh(geometry.body, materials.body);
  body.rotation.x = Math.PI / 2;
  body.castShadow = true;
  group.add(body);

  // === 主翼 - 在机身后部（视觉上在后方，所以用负 Z）
  const wings = new THREE.Mesh(geometry.wing, materials.wing);
  wings.position.set(0, 0, -bodyLength * 0.2);
  wings.castShadow = true;
  group.add(wings);

  // === 驾驶舱 - 在机身前部（视觉上在前方，所以用正 Z）
  const cockpit = new THREE.Mesh(geometry.cockpit, materials.cockpit);
  cockpit.position.set(0, bodySize * 0.25, bodyLength * 0.2);
  cockpit.castShadow = true;
  group.add(cockpit);

  // === 水平尾翼 - 在机尾（视觉上在最后方，用最负的 Z）
  const tail = new THREE.Mesh(geometry.tail, materials.wing);
  tail.position.set(0, 0, -bodyLength * 0.45);
  tail.castShadow = true;
  group.add(tail);

  // === 垂直尾翼 - 在机尾上方
  const vStab = new THREE.Mesh(geometry.vStab, materials.wing);
  vStab.position.set(0, bodySize * 0.3, -bodyLength * 0.4);
  vStab.castShadow = true;
  group.add(vStab);

  // === 引擎喷口 - 发光，在机尾最后方
  const engine = new THREE.Mesh(geometry.engine, materials.engine);
  engine.rotation.x = -Math.PI / 2;
  engine.position.set(0, 0, -bodyLength * 0.5 - 0.3);
  engine.name = 'engineGlow';
  group.add(engine);

  group.name = config.type;
  return group;
}

/**
 * 创建友军飞机模型 - 与敌机相同但标记为友军
 */
export function createFriendlyMesh(config: EnemyConfig): THREE.Group {
  return createEnemyMesh(config);
}
