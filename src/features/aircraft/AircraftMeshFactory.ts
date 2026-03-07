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
  accent: THREE.MeshStandardMaterial;
  detail: THREE.MeshStandardMaterial;
  light: THREE.MeshBasicMaterial;
}

const geometryCache: Map<EnemyType, CachedGeometry> = new Map();
const materialsCache: Map<EnemyType, CachedMaterials> = new Map();
const detailGeometries = {
  panel: new THREE.BoxGeometry(0.12, 0.04, 1),
  blade: new THREE.BoxGeometry(0.18, 0.04, 0.8),
  light: new THREE.SphereGeometry(0.08, 8, 8),
  sensor: new THREE.SphereGeometry(0.12, 8, 8),
  pod: new THREE.BoxGeometry(0.24, 0.18, 0.9),
  rail: new THREE.BoxGeometry(0.08, 0.08, 1.3),
  fin: new THREE.BoxGeometry(0.08, 0.45, 0.5),
};

function createAircraftMaterial(
  color: number,
  metalness: number,
  roughness: number,
  emissiveIntensity: number = 0
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    metalness,
    roughness,
    emissive: color,
    emissiveIntensity,
  });
}

function getEnemyMaterialTuning(type: EnemyType): {
  body: { metalness: number; roughness: number; emissiveIntensity: number };
  wing: { metalness: number; roughness: number; emissiveIntensity: number };
  cockpit: { metalness: number; roughness: number; emissiveIntensity: number };
  accent: { metalness: number; roughness: number; emissiveIntensity: number };
  detailColor: number;
  lightOpacity: number;
  engineOpacity: number;
} {
  switch (type) {
    case EnemyType.SCOUT:
      return {
        body: { metalness: 0.58, roughness: 0.42, emissiveIntensity: 0.04 },
        wing: { metalness: 0.52, roughness: 0.44, emissiveIntensity: 0.03 },
        cockpit: { metalness: 0.9, roughness: 0.14, emissiveIntensity: 0.28 },
        accent: { metalness: 0.72, roughness: 0.3, emissiveIntensity: 0.08 },
        detailColor: 0xaab8ca,
        lightOpacity: 0.82,
        engineOpacity: 0.68,
      };
    case EnemyType.FIGHTER:
      return {
        body: { metalness: 0.74, roughness: 0.28, emissiveIntensity: 0.06 },
        wing: { metalness: 0.66, roughness: 0.34, emissiveIntensity: 0.05 },
        cockpit: { metalness: 0.94, roughness: 0.1, emissiveIntensity: 0.34 },
        accent: { metalness: 0.84, roughness: 0.22, emissiveIntensity: 0.12 },
        detailColor: 0xd8c4b2,
        lightOpacity: 0.94,
        engineOpacity: 0.86,
      };
    case EnemyType.HEAVY:
      return {
        body: { metalness: 0.52, roughness: 0.52, emissiveIntensity: 0.03 },
        wing: { metalness: 0.48, roughness: 0.58, emissiveIntensity: 0.02 },
        cockpit: { metalness: 0.86, roughness: 0.18, emissiveIntensity: 0.22 },
        accent: { metalness: 0.56, roughness: 0.38, emissiveIntensity: 0.06 },
        detailColor: 0x8d949c,
        lightOpacity: 0.74,
        engineOpacity: 0.72,
      };
    case EnemyType.SNIPER:
      return {
        body: { metalness: 0.68, roughness: 0.32, emissiveIntensity: 0.05 },
        wing: { metalness: 0.6, roughness: 0.36, emissiveIntensity: 0.04 },
        cockpit: { metalness: 0.96, roughness: 0.08, emissiveIntensity: 0.42 },
        accent: { metalness: 0.86, roughness: 0.2, emissiveIntensity: 0.15 },
        detailColor: 0xc7b7e8,
        lightOpacity: 0.98,
        engineOpacity: 0.78,
      };
    case EnemyType.ACE:
      return {
        body: { metalness: 0.78, roughness: 0.24, emissiveIntensity: 0.07 },
        wing: { metalness: 0.7, roughness: 0.28, emissiveIntensity: 0.06 },
        cockpit: { metalness: 0.98, roughness: 0.08, emissiveIntensity: 0.4 },
        accent: { metalness: 0.92, roughness: 0.16, emissiveIntensity: 0.18 },
        detailColor: 0xf2d88a,
        lightOpacity: 1,
        engineOpacity: 0.9,
      };
    default:
      return {
        body: { metalness: 0.7, roughness: 0.3, emissiveIntensity: 0.05 },
        wing: { metalness: 0.62, roughness: 0.38, emissiveIntensity: 0.04 },
        cockpit: { metalness: 0.92, roughness: 0.12, emissiveIntensity: 0.32 },
        accent: { metalness: 0.82, roughness: 0.24, emissiveIntensity: 0.1 },
        detailColor: 0xcfd6df,
        lightOpacity: 0.95,
        engineOpacity: 0.8,
      };
  }
}

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
  const tuning = getEnemyMaterialTuning(type);

  const materials: CachedMaterials = {
    body: createAircraftMaterial(
      bodyColor,
      tuning.body.metalness,
      tuning.body.roughness,
      tuning.body.emissiveIntensity
    ),
    wing: createAircraftMaterial(
      wingColor,
      tuning.wing.metalness,
      tuning.wing.roughness,
      tuning.wing.emissiveIntensity
    ),
    cockpit: createAircraftMaterial(
      accentColor,
      tuning.cockpit.metalness,
      tuning.cockpit.roughness,
      tuning.cockpit.emissiveIntensity
    ),
    engine: new THREE.MeshBasicMaterial({
      color: 0xff6600,
      transparent: true,
      opacity: tuning.engineOpacity,
    }),
    accent: createAircraftMaterial(
      accentColor,
      tuning.accent.metalness,
      tuning.accent.roughness,
      tuning.accent.emissiveIntensity
    ),
    detail: createAircraftMaterial(tuning.detailColor, 0.45, 0.6, 0),
    light: new THREE.MeshBasicMaterial({
      color: accentColor,
      transparent: true,
      opacity: tuning.lightOpacity,
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

  const bodyMaterial = createAircraftMaterial(0xe8e8e8, 0.82, 0.22, 0.04);
  const wingMaterial = createAircraftMaterial(0xa0a0a0, 0.72, 0.32, 0.03);
  const cockpitMaterial = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a,
    metalness: 0.95,
    roughness: 0.1,
    transparent: true,
    opacity: 0.85,
    emissive: 0x4fc3ff,
    emissiveIntensity: 0.08,
  });
  const accentMaterial = createAircraftMaterial(0x707070, 0.9, 0.2, 0.06);
  const detailMaterial = createAircraftMaterial(0x45505c, 0.72, 0.4, 0.02);
  const playerLightMaterial = new THREE.MeshBasicMaterial({
    color: 0x58d5ff,
    transparent: true,
    opacity: 0.95,
  });
  const navRedMaterial = new THREE.MeshBasicMaterial({
    color: 0xff5544,
    transparent: true,
    opacity: 0.9,
  });
  const navGreenMaterial = new THREE.MeshBasicMaterial({
    color: 0x6dff8c,
    transparent: true,
    opacity: 0.9,
  });
  const engineMaterial = createAircraftMaterial(0x404040, 0.82, 0.28, 0.04);

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
  const midBodyGeometry = new THREE.CylinderGeometry(0.5, 0.55, 1.5, 12);
  const midBody = new THREE.Mesh(midBodyGeometry, bodyMaterial);
  midBody.rotation.x = -Math.PI / 2;
  midBody.position.set(0, 0, -fuselageLength / 2 + 0.7);
  midBody.castShadow = true;
  group.add(midBody);

  const rearBodyGeometry = new THREE.CylinderGeometry(0.45, 0.55, 1.8, 12);
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

  const canopyFrame = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 1.05), accentMaterial);
  canopyFrame.position.set(0, 0.44, -0.82);
  canopyFrame.castShadow = true;
  group.add(canopyFrame);

  const noseSensor = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 10), playerLightMaterial);
  noseSensor.scale.set(0.75, 0.45, 1.1);
  noseSensor.position.set(0, 0.03, -2.18);
  group.add(noseSensor);

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

  const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
  leftWing.rotation.x = Math.PI / 2;
  leftWing.scale.x = -1;
  leftWing.position.set(-0.4, 0, 0);
  leftWing.castShadow = true;
  group.add(leftWing);

  const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
  rightWing.rotation.x = Math.PI / 2;
  rightWing.position.set(0.4, 0, 0);
  rightWing.castShadow = true;
  group.add(rightWing);

  const leftWingPanel = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.04, 0.22), detailMaterial);
  leftWingPanel.position.set(-1.28, 0.06, -0.25);
  leftWingPanel.rotation.y = -0.22;
  leftWingPanel.castShadow = true;
  group.add(leftWingPanel);

  const rightWingPanel = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.04, 0.22), detailMaterial);
  rightWingPanel.position.set(1.28, 0.06, -0.25);
  rightWingPanel.rotation.y = 0.22;
  rightWingPanel.castShadow = true;
  group.add(rightWingPanel);

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

  const leftVTail = new THREE.Mesh(vTailGeometry, wingMaterial);
  leftVTail.scale.x = -1;
  leftVTail.rotation.y = Math.PI / 2;
  leftVTail.rotation.z = -0.26;
  leftVTail.position.set(-0.6, 0.3, 1.5);
  leftVTail.castShadow = true;
  group.add(leftVTail);

  const rightVTail = new THREE.Mesh(vTailGeometry, wingMaterial);
  rightVTail.rotation.y = -Math.PI / 2;
  rightVTail.rotation.z = 0.26;
  rightVTail.position.set(0.6, 0.3, 1.5);
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

  const leftHTail = new THREE.Mesh(hTailGeometry, wingMaterial);
  leftHTail.rotation.x = Math.PI / 2;
  leftHTail.scale.x = -1;
  leftHTail.position.set(-0.35, 0, 1.3);
  leftHTail.castShadow = true;
  group.add(leftHTail);

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

  const leftEngineCore = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), playerLightMaterial);
  leftEngineCore.position.set(-0.3, -0.05, 1.96);
  group.add(leftEngineCore);

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

  const rightEngineCore = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), playerLightMaterial);
  rightEngineCore.position.set(0.3, -0.05, 1.96);
  group.add(rightEngineCore);

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

  const dorsalStripe = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 1.7), detailMaterial);
  dorsalStripe.position.set(0, 0.19, -0.1);
  dorsalStripe.castShadow = true;
  group.add(dorsalStripe);

  const leftNavLight = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), navRedMaterial);
  leftNavLight.position.set(-2.18, 0.03, -0.48);
  group.add(leftNavLight);

  const rightNavLight = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), navGreenMaterial);
  rightNavLight.position.set(2.18, 0.03, -0.48);
  group.add(rightNavLight);

  // 设置阴影
  group.traverse((child) => {
    if (
      child instanceof THREE.Mesh
      && !child.name.includes('Glow')
      && !(child.material instanceof THREE.MeshBasicMaterial)
    ) {
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

  const spinePanel = new THREE.Mesh(detailGeometries.panel, materials.detail);
  spinePanel.scale.z = bodyLength * 0.18;
  spinePanel.position.set(0, bodySize * 0.18, bodyLength * 0.02);
  spinePanel.castShadow = true;
  group.add(spinePanel);

  const ventralPanel = new THREE.Mesh(detailGeometries.panel, materials.detail);
  ventralPanel.scale.set(0.8, 0.8, bodyLength * 0.14);
  ventralPanel.position.set(0, -bodySize * 0.1, -bodyLength * 0.05);
  ventralPanel.castShadow = true;
  group.add(ventralPanel);

  const leftWingBlade = new THREE.Mesh(detailGeometries.blade, materials.accent);
  leftWingBlade.position.set(-wingSpan * 0.24, 0.04, -bodyLength * 0.12);
  leftWingBlade.rotation.y = 0.16;
  leftWingBlade.castShadow = true;
  group.add(leftWingBlade);

  const rightWingBlade = new THREE.Mesh(detailGeometries.blade, materials.accent);
  rightWingBlade.position.set(wingSpan * 0.24, 0.04, -bodyLength * 0.12);
  rightWingBlade.rotation.y = -0.16;
  rightWingBlade.castShadow = true;
  group.add(rightWingBlade);

  const noseSensor = new THREE.Mesh(detailGeometries.sensor, materials.light);
  noseSensor.scale.set(0.8, 0.55, 1.2);
  noseSensor.position.set(0, bodySize * 0.08, bodyLength * 0.46);
  group.add(noseSensor);

  const dorsalLight = new THREE.Mesh(detailGeometries.light, materials.light);
  dorsalLight.position.set(0, bodySize * 0.32, bodyLength * 0.18);
  group.add(dorsalLight);

  const leftWingTipLight = new THREE.Mesh(detailGeometries.light, materials.light);
  leftWingTipLight.scale.setScalar(0.9);
  leftWingTipLight.position.set(-wingSpan * 0.48, 0.03, -bodyLength * 0.18);
  group.add(leftWingTipLight);

  const rightWingTipLight = new THREE.Mesh(detailGeometries.light, materials.light);
  rightWingTipLight.scale.setScalar(0.9);
  rightWingTipLight.position.set(wingSpan * 0.48, 0.03, -bodyLength * 0.18);
  group.add(rightWingTipLight);

  switch (config.type) {
    case EnemyType.SCOUT: {
      const scoutRail = new THREE.Mesh(detailGeometries.rail, materials.detail);
      scoutRail.scale.set(0.75, 0.55, 0.75);
      scoutRail.position.set(0, bodySize * 0.14, bodyLength * 0.18);
      scoutRail.castShadow = true;
      group.add(scoutRail);

      const scoutFin = new THREE.Mesh(detailGeometries.fin, materials.light);
      scoutFin.scale.set(0.8, 0.8, 0.65);
      scoutFin.position.set(0, bodySize * 0.32, -bodyLength * 0.08);
      group.add(scoutFin);
      break;
    }
    case EnemyType.FIGHTER: {
      const leftPylon = new THREE.Mesh(detailGeometries.pod, materials.accent);
      leftPylon.scale.set(0.82, 0.8, 0.72);
      leftPylon.position.set(-wingSpan * 0.26, -0.08, -bodyLength * 0.16);
      leftPylon.rotation.y = 0.08;
      leftPylon.castShadow = true;
      group.add(leftPylon);

      const rightPylon = new THREE.Mesh(detailGeometries.pod, materials.accent);
      rightPylon.scale.set(0.82, 0.8, 0.72);
      rightPylon.position.set(wingSpan * 0.26, -0.08, -bodyLength * 0.16);
      rightPylon.rotation.y = -0.08;
      rightPylon.castShadow = true;
      group.add(rightPylon);
      break;
    }
    case EnemyType.HEAVY: {
      const leftArmor = new THREE.Mesh(detailGeometries.pod, materials.detail);
      leftArmor.scale.set(1.15, 0.95, 1.05);
      leftArmor.position.set(-bodySize * 0.34, -0.02, -bodyLength * 0.04);
      leftArmor.castShadow = true;
      group.add(leftArmor);

      const rightArmor = new THREE.Mesh(detailGeometries.pod, materials.detail);
      rightArmor.scale.set(1.15, 0.95, 1.05);
      rightArmor.position.set(bodySize * 0.34, -0.02, -bodyLength * 0.04);
      rightArmor.castShadow = true;
      group.add(rightArmor);

      engine.scale.set(1.2, 1.2, 1.35);
      break;
    }
    case EnemyType.SNIPER: {
      const sniperRail = new THREE.Mesh(detailGeometries.rail, materials.accent);
      sniperRail.scale.set(0.55, 0.55, 1.5);
      sniperRail.position.set(0, bodySize * 0.18, bodyLength * 0.22);
      sniperRail.castShadow = true;
      group.add(sniperRail);

      const sniperSensor = new THREE.Mesh(detailGeometries.sensor, materials.light);
      sniperSensor.scale.set(0.55, 0.55, 0.9);
      sniperSensor.position.set(0, bodySize * 0.42, 0);
      group.add(sniperSensor);
      break;
    }
    case EnemyType.ACE: {
      const aceCrest = new THREE.Mesh(detailGeometries.rail, materials.accent);
      aceCrest.scale.set(0.9, 0.45, 1.08);
      aceCrest.position.set(0, bodySize * 0.28, -bodyLength * 0.04);
      aceCrest.castShadow = true;
      group.add(aceCrest);

      const aceRearLight = new THREE.Mesh(detailGeometries.light, materials.light);
      aceRearLight.scale.setScalar(1.15);
      aceRearLight.position.set(0, bodySize * 0.18, -bodyLength * 0.42);
      group.add(aceRearLight);
      break;
    }
  }

  group.name = config.type;
  return group;
}

/**
 * 创建友军飞机模型 - 与敌机相同但标记为友军
 */
export function createFriendlyMesh(config: EnemyConfig): THREE.Group {
  return createEnemyMesh(config);
}
