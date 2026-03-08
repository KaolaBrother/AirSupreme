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

interface CachedMaterials {
  body: THREE.MeshStandardMaterial;
  wing: THREE.MeshStandardMaterial;
  cockpit: THREE.MeshStandardMaterial;
  engine: THREE.MeshBasicMaterial;
  accent: THREE.MeshStandardMaterial;
  detail: THREE.MeshStandardMaterial;
  light: THREE.MeshBasicMaterial;
}

const materialsCache: Map<EnemyType, CachedMaterials> = new Map();
const detailGeometries = {
  panel: new THREE.BoxGeometry(0.12, 0.04, 1),
  blade: new THREE.BoxGeometry(0.18, 0.04, 0.8),
  light: new THREE.SphereGeometry(0.08, 8, 8),
  sensor: new THREE.SphereGeometry(0.12, 8, 8),
  pod: new THREE.BoxGeometry(0.24, 0.18, 0.9),
  rail: new THREE.BoxGeometry(0.08, 0.08, 1.3),
  fin: new THREE.BoxGeometry(0.08, 0.45, 0.5),
  strip: new THREE.BoxGeometry(0.08, 0.03, 0.9),
  intakeLip: new THREE.BoxGeometry(0.06, 0.08, 0.68),
  hardpoint: new THREE.BoxGeometry(0.12, 0.1, 0.46),
  node: new THREE.BoxGeometry(0.18, 0.12, 0.28),
  strake: new THREE.BoxGeometry(0.06, 0.16, 1.2),
  conduit: new THREE.BoxGeometry(0.08, 0.08, 1.35),
  vane: new THREE.BoxGeometry(0.04, 0.18, 0.4),
  actuator: new THREE.BoxGeometry(0.16, 0.12, 0.36),
  keel: new THREE.BoxGeometry(0.12, 0.2, 0.8),
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

function addMeshPart(
  group: THREE.Group,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: [number, number, number],
  options?: {
    rotation?: [number, number, number];
    scale?: [number, number, number];
    castShadow?: boolean;
    name?: string;
  }
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(position[0], position[1], position[2]);

  if (options?.rotation) {
    mesh.rotation.set(options.rotation[0], options.rotation[1], options.rotation[2]);
  }

  if (options?.scale) {
    mesh.scale.set(options.scale[0], options.scale[1], options.scale[2]);
  }

  mesh.castShadow = options?.castShadow ?? true;

  if (options?.name) {
    mesh.name = options.name;
  }

  group.add(mesh);
  return mesh;
}

/**
 * 创建玩家飞机模型 - F-15/F-22 风格战斗机
 * 更精致的设计：双垂尾、进气口、武器挂点
 */
export function createPlayerMesh(): THREE.Group {
  const group = new THREE.Group();

  const bodyMaterial = createAircraftMaterial(0xe8e8e8, 0.82, 0.22, 0.04);
  const wingMaterial = createAircraftMaterial(0xa0a0a0, 0.72, 0.32, 0.03);
  const heroPanelMaterial = createAircraftMaterial(0xcfd8e3, 0.88, 0.18, 0.05);
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
  const sensorMaterial = createAircraftMaterial(0x5f7488, 0.9, 0.18, 0.1);
  const weaponMaterial = createAircraftMaterial(0x5f6875, 0.92, 0.22, 0.03);
  const energyPanelMaterial = createAircraftMaterial(0x5e85a8, 0.86, 0.2, 0.12);
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

  const noseSensorCollar = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.2), heroPanelMaterial);
  noseSensorCollar.position.set(0, 0.02, -2.02);
  noseSensorCollar.castShadow = true;
  group.add(noseSensorCollar);

  const leftSensorCheek = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.46), sensorMaterial);
  leftSensorCheek.position.set(-0.22, 0.05, -1.78);
  leftSensorCheek.rotation.y = -0.12;
  leftSensorCheek.castShadow = true;
  group.add(leftSensorCheek);

  const rightSensorCheek = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.46), sensorMaterial);
  rightSensorCheek.position.set(0.22, 0.05, -1.78);
  rightSensorCheek.rotation.y = 0.12;
  rightSensorCheek.castShadow = true;
  group.add(rightSensorCheek);

  const leftNoseChine = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.92), heroPanelMaterial);
  leftNoseChine.position.set(-0.24, -0.02, -1.42);
  leftNoseChine.rotation.y = -0.2;
  leftNoseChine.castShadow = true;
  group.add(leftNoseChine);

  const rightNoseChine = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.92), heroPanelMaterial);
  rightNoseChine.position.set(0.24, -0.02, -1.42);
  rightNoseChine.rotation.y = 0.2;
  rightNoseChine.castShadow = true;
  group.add(rightNoseChine);

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

  const leftWingRootFairing = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.14, 1.1), heroPanelMaterial);
  leftWingRootFairing.position.set(-0.68, 0.08, -0.5);
  leftWingRootFairing.rotation.y = 0.18;
  leftWingRootFairing.castShadow = true;
  group.add(leftWingRootFairing);

  const rightWingRootFairing = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.14, 1.1), heroPanelMaterial);
  rightWingRootFairing.position.set(0.68, 0.08, -0.5);
  rightWingRootFairing.rotation.y = -0.18;
  rightWingRootFairing.castShadow = true;
  group.add(rightWingRootFairing);

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

  const leftVentralStrake = new THREE.Mesh(detailGeometries.strake, detailMaterial);
  leftVentralStrake.scale.set(0.6, 0.8, 0.9);
  leftVentralStrake.position.set(-0.3, -0.24, 0.12);
  leftVentralStrake.rotation.y = -0.16;
  leftVentralStrake.castShadow = true;
  group.add(leftVentralStrake);

  const rightVentralStrake = new THREE.Mesh(detailGeometries.strake, detailMaterial);
  rightVentralStrake.scale.set(0.6, 0.8, 0.9);
  rightVentralStrake.position.set(0.3, -0.24, 0.12);
  rightVentralStrake.rotation.y = 0.16;
  rightVentralStrake.castShadow = true;
  group.add(rightVentralStrake);

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

  const leftIntakeLip = new THREE.Mesh(detailGeometries.intakeLip, heroPanelMaterial);
  leftIntakeLip.position.set(-0.43, -0.02, -0.3);
  leftIntakeLip.castShadow = true;
  group.add(leftIntakeLip);

  const leftIntakeVaneFront = new THREE.Mesh(detailGeometries.vane, weaponMaterial);
  leftIntakeVaneFront.position.set(-0.6, -0.08, -0.58);
  leftIntakeVaneFront.rotation.y = 0.05;
  leftIntakeVaneFront.castShadow = true;
  group.add(leftIntakeVaneFront);

  const leftIntakeVaneRear = new THREE.Mesh(detailGeometries.vane, weaponMaterial);
  leftIntakeVaneRear.position.set(-0.6, -0.09, -0.05);
  leftIntakeVaneRear.rotation.y = -0.05;
  leftIntakeVaneRear.castShadow = true;
  group.add(leftIntakeVaneRear);

  // 进气口内部（深色）
  const leftIntakeInner = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.25), intakeInnerMaterial);
  leftIntakeInner.position.set(-0.68, -0.15, -0.3);
  leftIntakeInner.rotation.y = -Math.PI / 2;
  group.add(leftIntakeInner);

  const rightIntake = new THREE.Mesh(intakeGeometry, engineMaterial);
  rightIntake.position.set(0.55, -0.15, -0.3);
  rightIntake.castShadow = true;
  group.add(rightIntake);

  const rightIntakeLip = new THREE.Mesh(detailGeometries.intakeLip, heroPanelMaterial);
  rightIntakeLip.position.set(0.43, -0.02, -0.3);
  rightIntakeLip.castShadow = true;
  group.add(rightIntakeLip);

  const rightIntakeVaneFront = new THREE.Mesh(detailGeometries.vane, weaponMaterial);
  rightIntakeVaneFront.position.set(0.6, -0.08, -0.58);
  rightIntakeVaneFront.rotation.y = -0.05;
  rightIntakeVaneFront.castShadow = true;
  group.add(rightIntakeVaneFront);

  const rightIntakeVaneRear = new THREE.Mesh(detailGeometries.vane, weaponMaterial);
  rightIntakeVaneRear.position.set(0.6, -0.09, -0.05);
  rightIntakeVaneRear.rotation.y = 0.05;
  rightIntakeVaneRear.castShadow = true;
  group.add(rightIntakeVaneRear);

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

  const leftNozzleRing = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.04, 8, 14), accentMaterial);
  leftNozzleRing.rotation.x = Math.PI / 2;
  leftNozzleRing.position.set(-0.3, -0.05, 2.07);
  leftNozzleRing.castShadow = true;
  group.add(leftNozzleRing);

  const leftNozzleShroud = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.24), heroPanelMaterial);
  leftNozzleShroud.position.set(-0.3, -0.04, 1.82);
  leftNozzleShroud.castShadow = true;
  group.add(leftNozzleShroud);

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

  const rightNozzleRing = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.04, 8, 14), accentMaterial);
  rightNozzleRing.rotation.x = Math.PI / 2;
  rightNozzleRing.position.set(0.3, -0.05, 2.07);
  rightNozzleRing.castShadow = true;
  group.add(rightNozzleRing);

  const rightNozzleShroud = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.24), heroPanelMaterial);
  rightNozzleShroud.position.set(0.3, -0.04, 1.82);
  rightNozzleShroud.castShadow = true;
  group.add(rightNozzleShroud);

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

  const leftInnerPylon = new THREE.Mesh(detailGeometries.hardpoint, accentMaterial);
  leftInnerPylon.position.set(-0.82, -0.06, 0.15);
  leftInnerPylon.rotation.y = 0.08;
  leftInnerPylon.castShadow = true;
  group.add(leftInnerPylon);

  const leftWeaponPod = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.13, 0.62), weaponMaterial);
  leftWeaponPod.position.set(-1.05, -0.16, 0.58);
  leftWeaponPod.rotation.y = 0.06;
  leftWeaponPod.castShadow = true;
  group.add(leftWeaponPod);

  // 右翼下挂点
  const rightPylon = new THREE.Mesh(pylonGeometry, accentMaterial);
  rightPylon.position.set(1.2, -0.1, 0.5);
  rightPylon.rotation.y = -0.15;
  group.add(rightPylon);

  const rightInnerPylon = new THREE.Mesh(detailGeometries.hardpoint, accentMaterial);
  rightInnerPylon.position.set(0.82, -0.06, 0.15);
  rightInnerPylon.rotation.y = -0.08;
  rightInnerPylon.castShadow = true;
  group.add(rightInnerPylon);

  const rightWeaponPod = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.13, 0.62), weaponMaterial);
  rightWeaponPod.position.set(1.05, -0.16, 0.58);
  rightWeaponPod.rotation.y = -0.06;
  rightWeaponPod.castShadow = true;
  group.add(rightWeaponPod);

  // === 细节装饰 ===
  // 机背脊线
  const spineGeometry = new THREE.BoxGeometry(0.08, 0.1, 2.5);
  const spine = new THREE.Mesh(spineGeometry, accentMaterial);
  spine.position.set(0, 0.45, -0.2);
  group.add(spine);

  const spineNodeFront = new THREE.Mesh(detailGeometries.node, heroPanelMaterial);
  spineNodeFront.position.set(0, 0.34, -0.92);
  spineNodeFront.castShadow = true;
  group.add(spineNodeFront);

  const spineNodeRear = new THREE.Mesh(detailGeometries.node, heroPanelMaterial);
  spineNodeRear.position.set(0, 0.27, 0.88);
  spineNodeRear.castShadow = true;
  group.add(spineNodeRear);

  const dorsalStripe = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 1.7), detailMaterial);
  dorsalStripe.position.set(0, 0.19, -0.1);
  dorsalStripe.castShadow = true;
  group.add(dorsalStripe);

  const spineBrake = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.52), heroPanelMaterial);
  spineBrake.position.set(0, 0.32, 0.28);
  spineBrake.castShadow = true;
  group.add(spineBrake);

  const centerlineModule = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 0.68), detailMaterial);
  centerlineModule.position.set(0, -0.16, 0.42);
  centerlineModule.castShadow = true;
  group.add(centerlineModule);

  const leftOuterRail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.52), accentMaterial);
  leftOuterRail.position.set(-1.78, -0.06, -0.12);
  leftOuterRail.rotation.y = -0.22;
  leftOuterRail.castShadow = true;
  group.add(leftOuterRail);

  const rightOuterRail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.52), accentMaterial);
  rightOuterRail.position.set(1.78, -0.06, -0.12);
  rightOuterRail.rotation.y = 0.22;
  rightOuterRail.castShadow = true;
  group.add(rightOuterRail);

  const powerConduit = new THREE.Mesh(detailGeometries.conduit, energyPanelMaterial);
  powerConduit.scale.set(0.7, 0.45, 0.9);
  powerConduit.position.set(0, 0.2, 1.35);
  powerConduit.castShadow = true;
  group.add(powerConduit);

  const leftEngineActuator = new THREE.Mesh(detailGeometries.actuator, weaponMaterial);
  leftEngineActuator.position.set(-0.52, -0.04, 1.7);
  leftEngineActuator.rotation.y = 0.12;
  leftEngineActuator.castShadow = true;
  group.add(leftEngineActuator);

  const rightEngineActuator = new THREE.Mesh(detailGeometries.actuator, weaponMaterial);
  rightEngineActuator.position.set(0.52, -0.04, 1.7);
  rightEngineActuator.rotation.y = -0.12;
  rightEngineActuator.castShadow = true;
  group.add(rightEngineActuator);

  const leftNavLight = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), navRedMaterial);
  leftNavLight.position.set(-2.18, 0.03, -0.48);
  group.add(leftNavLight);

  const leftWingTipNode = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.28), heroPanelMaterial);
  leftWingTipNode.position.set(-2.02, 0.01, -0.44);
  leftWingTipNode.rotation.y = -0.18;
  leftWingTipNode.castShadow = true;
  group.add(leftWingTipNode);

  const rightNavLight = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), navGreenMaterial);
  rightNavLight.position.set(2.18, 0.03, -0.48);
  group.add(rightNavLight);

  const rightWingTipNode = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.28), heroPanelMaterial);
  rightWingTipNode.position.set(2.02, 0.01, -0.44);
  rightWingTipNode.rotation.y = 0.18;
  rightWingTipNode.castShadow = true;
  group.add(rightWingTipNode);

  const leftRootArmor = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 0.95), weaponMaterial);
  leftRootArmor.position.set(-0.42, 0.16, -0.62);
  leftRootArmor.rotation.y = 0.18;
  leftRootArmor.castShadow = true;
  group.add(leftRootArmor);

  const rightRootArmor = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 0.95), weaponMaterial);
  rightRootArmor.position.set(0.42, 0.16, -0.62);
  rightRootArmor.rotation.y = -0.18;
  rightRootArmor.castShadow = true;
  group.add(rightRootArmor);

  const tailEnergyBand = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.82), energyPanelMaterial);
  tailEnergyBand.position.set(0, 0.14, 1.62);
  tailEnergyBand.castShadow = true;
  group.add(tailEnergyBand);

  const dorsalAntenna = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.26), playerLightMaterial);
  dorsalAntenna.position.set(0, 0.56, 0.18);
  group.add(dorsalAntenna);

  const dorsalCoolingFairing = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.1, 0.54), heroPanelMaterial);
  dorsalCoolingFairing.position.set(0, 0.3, 0.72);
  dorsalCoolingFairing.castShadow = true;
  group.add(dorsalCoolingFairing);

  const leftShoulderSensor = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.34), sensorMaterial);
  leftShoulderSensor.position.set(-0.32, 0.18, -0.94);
  leftShoulderSensor.rotation.y = 0.18;
  leftShoulderSensor.castShadow = true;
  group.add(leftShoulderSensor);

  const rightShoulderSensor = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.34), sensorMaterial);
  rightShoulderSensor.position.set(0.32, 0.18, -0.94);
  rightShoulderSensor.rotation.y = -0.18;
  rightShoulderSensor.castShadow = true;
  group.add(rightShoulderSensor);

  const ventralBayLeft = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.88), heroPanelMaterial);
  ventralBayLeft.position.set(-0.18, -0.26, 0.06);
  ventralBayLeft.rotation.y = 0.06;
  ventralBayLeft.castShadow = true;
  group.add(ventralBayLeft);

  const ventralBayRight = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.88), heroPanelMaterial);
  ventralBayRight.position.set(0.18, -0.26, 0.06);
  ventralBayRight.rotation.y = -0.06;
  ventralBayRight.castShadow = true;
  group.add(ventralBayRight);

  const leftIntakeConduit = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.72), energyPanelMaterial);
  leftIntakeConduit.position.set(-0.52, 0.08, -0.26);
  leftIntakeConduit.rotation.y = 0.1;
  leftIntakeConduit.castShadow = true;
  group.add(leftIntakeConduit);

  const rightIntakeConduit = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.72), energyPanelMaterial);
  rightIntakeConduit.position.set(0.52, 0.08, -0.26);
  rightIntakeConduit.rotation.y = -0.1;
  rightIntakeConduit.castShadow = true;
  group.add(rightIntakeConduit);

  const tailBeacon = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), playerLightMaterial);
  tailBeacon.position.set(0, 0.18, 2.08);
  group.add(tailBeacon);

  const leftTailBoomBrace = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.42), accentMaterial);
  leftTailBoomBrace.position.set(-0.34, 0.08, 1.44);
  leftTailBoomBrace.rotation.y = 0.08;
  leftTailBoomBrace.castShadow = true;
  group.add(leftTailBoomBrace);

  const rightTailBoomBrace = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.42), accentMaterial);
  rightTailBoomBrace.position.set(0.34, 0.08, 1.44);
  rightTailBoomBrace.rotation.y = -0.08;
  rightTailBoomBrace.castShadow = true;
  group.add(rightTailBoomBrace);

  const centerlineSensorBand = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.72), energyPanelMaterial);
  centerlineSensorBand.position.set(0, -0.1, -1.02);
  centerlineSensorBand.castShadow = true;
  group.add(centerlineSensorBand);

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

  let bodyColor: number;
  let wingColor: number;
  let accentColor: number;
  let bodySize = 1.6;
  let bodyLength = 6;
  let wingSpan = 3;
  let scaleMultiplier = 1;

  switch (config.type) {
    case EnemyType.SCOUT:
      bodyColor = 0x4a5584;
      wingColor = 0x6b7b8e;
      accentColor = 0x3d5a87;
      bodySize = 1.35;
      bodyLength = 5.6;
      wingSpan = 2.6;
      scaleMultiplier = 1.0;
      break;
    case EnemyType.FIGHTER:
      bodyColor = 0xcc3300;
      wingColor = 0xe63900;
      accentColor = 0x8b2500;
      bodySize = 1.9;
      bodyLength = 7.4;
      wingSpan = 3.8;
      scaleMultiplier = 1.12;
      break;
    case EnemyType.HEAVY:
      bodyColor = 0x2c2c2c;
      wingColor = 0x3a3a3a;
      accentColor = 0x1a1a1a;
      bodySize = 2.45;
      bodyLength = 9.2;
      wingSpan = 5.1;
      scaleMultiplier = 1.42;
      break;
    case EnemyType.SNIPER:
      bodyColor = 0x4a235a;
      wingColor = 0x6b4c7a;
      accentColor = 0x7c3aed;
      bodySize = 1.55;
      bodyLength = 8.4;
      wingSpan = 2.95;
      scaleMultiplier = 1.07;
      break;
    case EnemyType.ACE:
      bodyColor = 0x8b0000;
      wingColor = 0xffd700;
      accentColor = 0xff4500;
      bodySize = 2.0;
      bodyLength = 7.8;
      wingSpan = 3.8;
      scaleMultiplier = 1.2;
      break;
    default:
      bodyColor = config.color;
      wingColor = config.color;
      accentColor = config.color;
  }

  group.scale.set(scaleMultiplier, scaleMultiplier, scaleMultiplier);
  const materials = getOrCreateMaterials(config.type, bodyColor, wingColor, accentColor);
  const weaponMaterial = createAircraftMaterial(accentColor, 0.9, 0.2, 0.08);
  const energyMaterial = createAircraftMaterial(accentColor, 0.86, 0.16, 0.14);
  const structureMaterial = createAircraftMaterial(wingColor, 0.68, 0.34, 0.03);
  if (config.type === EnemyType.SCOUT) {
    addMeshPart(group, new THREE.ConeGeometry(bodySize * 0.42, bodyLength, 7), materials.body, [0, 0, 0], {
      rotation: [Math.PI / 2, 0, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(wingSpan, 0.08, 0.7), materials.wing, [0, 0.04, -bodyLength * 0.08], {
      rotation: [0, 0, 0.08],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.18, 0.12, bodyLength * 0.42), materials.detail, [0, 0.16, bodyLength * 0.1]);
    addMeshPart(group, new THREE.BoxGeometry(0.12, 0.12, bodyLength * 0.68), structureMaterial, [-bodySize * 0.34, 0.02, -bodyLength * 0.08], {
      rotation: [0, -0.06, 0.06],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.12, 0.12, bodyLength * 0.68), structureMaterial, [bodySize * 0.34, 0.02, -bodyLength * 0.08], {
      rotation: [0, 0.06, -0.06],
    });
    addMeshPart(group, new THREE.BoxGeometry(wingSpan * 0.44, 0.06, 0.34), materials.wing, [0, 0.02, -bodyLength * 0.44]);
    addMeshPart(group, new THREE.BoxGeometry(0.16, 0.38, 0.24), materials.detail, [-bodySize * 0.36, bodySize * 0.2, -bodyLength * 0.38], {
      rotation: [0.02, 0, 0.14],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.16, 0.38, 0.24), materials.detail, [bodySize * 0.36, bodySize * 0.2, -bodyLength * 0.38], {
      rotation: [0.02, 0, -0.14],
    });
    addMeshPart(group, new THREE.SphereGeometry(bodySize * 0.2, 8, 8), materials.light, [0, bodySize * 0.08, bodyLength * 0.44], {
      scale: [0.9, 0.6, 1.2],
      castShadow: false,
    });
    addMeshPart(group, new THREE.TorusGeometry(bodySize * 0.2, bodySize * 0.03, 8, 12), energyMaterial, [0, bodySize * 0.08, bodyLength * 0.43], {
      rotation: [Math.PI / 2, 0, 0],
      castShadow: false,
    });
    addMeshPart(group, new THREE.ConeGeometry(bodySize * 0.14, 0.7, 8), materials.engine, [0, 0, -bodyLength * 0.56], {
      rotation: [-Math.PI / 2, 0, 0],
      name: 'engineGlow',
      castShadow: false,
    });
  } else if (config.type === EnemyType.FIGHTER) {
    addMeshPart(group, new THREE.ConeGeometry(bodySize * 0.44, bodyLength * 0.7, 8), materials.body, [0, 0, bodyLength * 0.08], {
      rotation: [Math.PI / 2, 0, 0],
    });
    addMeshPart(group, new THREE.CylinderGeometry(bodySize * 0.34, bodySize * 0.46, bodyLength * 0.48, 10), materials.body, [0, 0, -bodyLength * 0.26], {
      rotation: [Math.PI / 2, 0, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(wingSpan * 0.7, 0.1, 1.1), materials.wing, [0, 0.02, -bodyLength * 0.05], {
      rotation: [0, 0, 0.08],
    });
    addMeshPart(group, new THREE.BoxGeometry(wingSpan * 0.34, 0.08, 0.58), materials.wing, [-wingSpan * 0.3, 0.04, bodyLength * 0.1], {
      rotation: [0, 0, 0.38],
    });
    addMeshPart(group, new THREE.BoxGeometry(wingSpan * 0.34, 0.08, 0.58), materials.wing, [wingSpan * 0.3, 0.04, bodyLength * 0.1], {
      rotation: [0, 0, -0.38],
    });
    addMeshPart(group, new THREE.SphereGeometry(bodySize * 0.28, 8, 8), materials.cockpit, [0, bodySize * 0.22, bodyLength * 0.22], {
      scale: [0.9, 0.55, 1.25],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.2, 0.36, 0.54), materials.detail, [-bodySize * 0.34, bodySize * 0.28, -bodyLength * 0.34], {
      rotation: [0, 0, 0.24],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.2, 0.36, 0.54), materials.detail, [bodySize * 0.34, bodySize * 0.28, -bodyLength * 0.34], {
      rotation: [0, 0, -0.24],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.18, 0.14, 0.92), structureMaterial, [-bodySize * 0.46, -0.04, bodyLength * 0.06], {
      rotation: [0, 0.08, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.18, 0.14, 0.92), structureMaterial, [bodySize * 0.46, -0.04, bodyLength * 0.06], {
      rotation: [0, -0.08, 0],
    });
    addMeshPart(group, new THREE.ConeGeometry(bodySize * 0.12, 0.6, 8), materials.engine, [-bodySize * 0.18, -0.02, -bodyLength * 0.58], {
      rotation: [-Math.PI / 2, 0, 0],
      name: 'engineGlow',
      castShadow: false,
    });
    addMeshPart(group, new THREE.ConeGeometry(bodySize * 0.12, 0.6, 8), materials.engine, [bodySize * 0.18, -0.02, -bodyLength * 0.58], {
      rotation: [-Math.PI / 2, 0, 0],
      castShadow: false,
    });
    addMeshPart(group, new THREE.SphereGeometry(bodySize * 0.12, 8, 8), materials.light, [0, bodySize * 0.1, bodyLength * 0.45], {
      scale: [0.9, 0.7, 1.2],
      castShadow: false,
    });
  } else if (config.type === EnemyType.HEAVY) {
    addMeshPart(group, new THREE.BoxGeometry(bodySize * 0.9, bodySize * 0.55, bodyLength * 0.92), materials.body, [0, 0, -bodyLength * 0.04]);
    addMeshPart(group, new THREE.BoxGeometry(bodySize * 0.64, bodySize * 0.3, bodyLength * 0.34), materials.detail, [0, bodySize * 0.24, bodyLength * 0.12]);
    addMeshPart(group, new THREE.BoxGeometry(wingSpan, 0.16, 1.6), materials.wing, [0, 0.02, -bodyLength * 0.08]);
    addMeshPart(group, new THREE.BoxGeometry(bodySize * 0.38, bodySize * 0.32, bodyLength * 0.54), materials.accent, [-bodySize * 0.56, -0.02, -bodyLength * 0.08]);
    addMeshPart(group, new THREE.BoxGeometry(bodySize * 0.38, bodySize * 0.32, bodyLength * 0.54), materials.accent, [bodySize * 0.56, -0.02, -bodyLength * 0.08]);
    addMeshPart(group, new THREE.BoxGeometry(bodySize * 0.3, bodySize * 0.22, bodyLength * 0.42), weaponMaterial, [-bodySize * 0.62, 0.08, -bodyLength * 0.1]);
    addMeshPart(group, new THREE.BoxGeometry(bodySize * 0.3, bodySize * 0.22, bodyLength * 0.42), weaponMaterial, [bodySize * 0.62, 0.08, -bodyLength * 0.1]);
    addMeshPart(group, new THREE.BoxGeometry(bodySize * 0.42, bodySize * 0.22, bodyLength * 0.24), materials.accent, [0, -bodySize * 0.24, bodyLength * 0.18]);
    addMeshPart(group, new THREE.BoxGeometry(bodySize * 0.28, bodySize * 0.24, bodyLength * 0.16), energyMaterial, [0, bodySize * 0.08, bodyLength * 0.28], {
      castShadow: false,
    });
    addMeshPart(group, new THREE.BoxGeometry(bodySize * 0.2, bodySize * 0.58, 0.38), materials.detail, [-bodySize * 0.28, bodySize * 0.28, -bodyLength * 0.34], {
      rotation: [0.04, 0, 0.08],
    });
    addMeshPart(group, new THREE.BoxGeometry(bodySize * 0.2, bodySize * 0.58, 0.38), materials.detail, [bodySize * 0.28, bodySize * 0.28, -bodyLength * 0.34], {
      rotation: [0.04, 0, -0.08],
    });
    addMeshPart(group, new THREE.CylinderGeometry(bodySize * 0.18, bodySize * 0.22, 0.86, 8), materials.engine, [-bodySize * 0.22, 0, -bodyLength * 0.58], {
      rotation: [-Math.PI / 2, 0, 0],
      name: 'engineGlow',
      castShadow: false,
    });
    addMeshPart(group, new THREE.CylinderGeometry(bodySize * 0.18, bodySize * 0.22, 0.86, 8), materials.engine, [bodySize * 0.22, 0, -bodyLength * 0.58], {
      rotation: [-Math.PI / 2, 0, 0],
      castShadow: false,
    });
    addMeshPart(group, new THREE.BoxGeometry(wingSpan * 0.34, 0.1, 0.8), materials.wing, [0, 0.04, -bodyLength * 0.5]);
  } else if (config.type === EnemyType.SNIPER) {
    addMeshPart(group, new THREE.CylinderGeometry(bodySize * 0.18, bodySize * 0.28, bodyLength * 0.86, 8), materials.body, [0, 0, -bodyLength * 0.04], {
      rotation: [Math.PI / 2, 0, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(wingSpan * 0.52, 0.08, 0.72), materials.wing, [0, 0.02, -bodyLength * 0.1]);
    addMeshPart(group, new THREE.BoxGeometry(0.1, 0.1, bodyLength * 0.6), materials.accent, [0, bodySize * 0.18, bodyLength * 0.18]);
    addMeshPart(group, new THREE.BoxGeometry(0.08, 0.08, bodyLength * 0.44), structureMaterial, [-bodySize * 0.4, 0.06, bodyLength * 0.08], {
      rotation: [0, -0.08, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.08, 0.08, bodyLength * 0.44), structureMaterial, [bodySize * 0.4, 0.06, bodyLength * 0.08], {
      rotation: [0, 0.08, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.12, 0.12, bodyLength * 0.42), materials.accent, [0, 0.02, bodyLength * 0.38]);
    addMeshPart(group, new THREE.SphereGeometry(bodySize * 0.18, 8, 8), energyMaterial, [0, 0.02, bodyLength * 0.52], {
      scale: [0.9, 0.7, 1.3],
      castShadow: false,
    });
    addMeshPart(group, new THREE.BoxGeometry(0.16, 0.46, 0.36), materials.detail, [0, bodySize * 0.34, -bodyLength * 0.24]);
    addMeshPart(group, new THREE.BoxGeometry(0.12, 0.18, 0.72), materials.detail, [-bodySize * 0.22, -bodySize * 0.14, bodyLength * 0.14], {
      rotation: [0, -0.2, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.12, 0.18, 0.72), materials.detail, [bodySize * 0.22, -bodySize * 0.14, bodyLength * 0.14], {
      rotation: [0, 0.2, 0],
    });
    addMeshPart(group, new THREE.ConeGeometry(bodySize * 0.1, 0.7, 8), materials.engine, [0, 0, -bodyLength * 0.56], {
      rotation: [-Math.PI / 2, 0, 0],
      name: 'engineGlow',
      castShadow: false,
    });
    addMeshPart(group, new THREE.SphereGeometry(bodySize * 0.1, 8, 8), materials.light, [0, bodySize * 0.12, -bodyLength * 0.46], {
      castShadow: false,
    });
  } else {
    addMeshPart(group, new THREE.ConeGeometry(bodySize * 0.5, bodyLength * 0.76, 8), materials.body, [0, 0, bodyLength * 0.02], {
      rotation: [Math.PI / 2, 0, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(wingSpan * 0.84, 0.12, 1.7), materials.wing, [0, 0.04, -bodyLength * 0.02], {
      rotation: [0, 0, 0.04],
    });
    addMeshPart(group, new THREE.BoxGeometry(wingSpan * 0.42, 0.08, 0.56), materials.wing, [-wingSpan * 0.28, 0.06, bodyLength * 0.12], {
      rotation: [0, 0, 0.3],
    });
    addMeshPart(group, new THREE.BoxGeometry(wingSpan * 0.42, 0.08, 0.56), materials.wing, [wingSpan * 0.28, 0.06, bodyLength * 0.12], {
      rotation: [0, 0, -0.3],
    });
    addMeshPart(group, new THREE.SphereGeometry(bodySize * 0.24, 8, 8), materials.cockpit, [0, bodySize * 0.2, bodyLength * 0.2], {
      scale: [0.9, 0.55, 1.1],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.24, 0.14, bodyLength * 0.34), energyMaterial, [0, bodySize * 0.18, bodyLength * 0.06], {
      castShadow: false,
    });
    addMeshPart(group, new THREE.BoxGeometry(0.18, 0.38, 0.42), materials.accent, [-bodySize * 0.22, bodySize * 0.28, -bodyLength * 0.24], {
      rotation: [0, 0, 0.18],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.18, 0.38, 0.42), materials.accent, [bodySize * 0.22, bodySize * 0.28, -bodyLength * 0.24], {
      rotation: [0, 0, -0.18],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.18, 0.12, 0.8), materials.accent, [-bodySize * 0.48, 0.08, -bodyLength * 0.06], {
      rotation: [0, 0.18, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.18, 0.12, 0.8), materials.accent, [bodySize * 0.48, 0.08, -bodyLength * 0.06], {
      rotation: [0, -0.18, 0],
    });
    addMeshPart(group, new THREE.ConeGeometry(bodySize * 0.12, 0.68, 8), materials.engine, [0, 0, -bodyLength * 0.58], {
      rotation: [-Math.PI / 2, 0, 0],
      name: 'engineGlow',
      castShadow: false,
    });
    addMeshPart(group, new THREE.TorusGeometry(bodySize * 0.18, bodySize * 0.03, 8, 12), energyMaterial, [0, bodySize * 0.06, -bodyLength * 0.46], {
      rotation: [Math.PI / 2, 0, 0],
      castShadow: false,
    });
    addMeshPart(group, new THREE.SphereGeometry(bodySize * 0.12, 8, 8), materials.light, [-bodySize * 0.42, bodySize * 0.16, -bodyLength * 0.02], {
      castShadow: false,
    });
    addMeshPart(group, new THREE.SphereGeometry(bodySize * 0.12, 8, 8), materials.light, [bodySize * 0.42, bodySize * 0.16, -bodyLength * 0.02], {
      castShadow: false,
    });
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
