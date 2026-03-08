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

interface JetProportionProfile {
  intakeX: number;
  intakeY: number;
  intakeZ: number;
  intakeWidthScale: number;
  intakeDepthScale: number;
  intakeYaw: number;
  bellyY: number;
  bellyZ: number;
  bellyWidth: number;
  bellyHeight: number;
  bellyDepth: number;
  pylonX: number;
  pylonY: number;
  pylonZ: number;
  pylonWidth: number;
  pylonDepth: number;
  pylonYaw: number;
  tailRootX: number;
  tailRootY: number;
  tailRootZ: number;
  tailRootWidth: number;
  tailRootHeight: number;
  tailRootDepth: number;
  nozzleX: number;
  nozzleY: number;
  nozzleZ: number;
  twinEngine: boolean;
}

interface EnemyContourProfile {
  nose: {
    tipLength: number;
    tipWidth: number;
    tipOffsetY: number;
    tipOffsetZ: number;
    chineWidth: number;
    chineHeight: number;
    chineDepth: number;
    chineOffsetY: number;
    chineOffsetZ: number;
  };
  bellyFin: {
    offsetY: number;
    offsetX: number;
    offsetZ: number;
    width: number;
    height: number;
    depth: number;
    sideYaw: number;
    includeTwin: boolean;
  };
  wingRoot: {
    insetWidth: number;
    insetHeight: number;
    insetDepth: number;
    insetY: number;
    insetZ: number;
    insetYaw: number;
    bridgeWidth: number;
    bridgeHeight: number;
    bridgeDepth: number;
    bridgeY: number;
    bridgeZ: number;
  };
  pylon: {
    anchorWidth: number;
    anchorHeight: number;
    anchorDepth: number;
    anchorYaw: number;
    braceWidth: number;
    braceHeight: number;
    braceDepth: number;
    braceYaw: number;
  };
  tail: {
    fairingWidth: number;
    fairingHeight: number;
    fairingDepth: number;
    fairingY: number;
    fairingZOffset: number;
  };
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
  nozzlePetal: new THREE.BoxGeometry(0.06, 0.12, 0.16),
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
        body: { metalness: 0.78, roughness: 0.26, emissiveIntensity: 0.008 },
        wing: { metalness: 0.72, roughness: 0.32, emissiveIntensity: 0.003 },
        cockpit: { metalness: 0.96, roughness: 0.1, emissiveIntensity: 0.012 },
        accent: { metalness: 0.82, roughness: 0.24, emissiveIntensity: 0.005 },
        detailColor: 0xb4bcc6,
        lightOpacity: 0.16,
        engineOpacity: 0.26,
      };
    case EnemyType.FIGHTER:
      return {
        body: { metalness: 0.82, roughness: 0.24, emissiveIntensity: 0.009 },
        wing: { metalness: 0.76, roughness: 0.28, emissiveIntensity: 0.003 },
        cockpit: { metalness: 0.96, roughness: 0.1, emissiveIntensity: 0.012 },
        accent: { metalness: 0.86, roughness: 0.2, emissiveIntensity: 0.006 },
        detailColor: 0xc0c7d0,
        lightOpacity: 0.17,
        engineOpacity: 0.28,
      };
    case EnemyType.HEAVY:
      return {
        body: { metalness: 0.72, roughness: 0.32, emissiveIntensity: 0.006 },
        wing: { metalness: 0.68, roughness: 0.36, emissiveIntensity: 0.004 },
        cockpit: { metalness: 0.92, roughness: 0.14, emissiveIntensity: 0.01 },
        accent: { metalness: 0.78, roughness: 0.26, emissiveIntensity: 0.004 },
        detailColor: 0xa0a8b2,
        lightOpacity: 0.14,
        engineOpacity: 0.24,
      };
    case EnemyType.SNIPER:
      return {
        body: { metalness: 0.8, roughness: 0.24, emissiveIntensity: 0.008 },
        wing: { metalness: 0.74, roughness: 0.3, emissiveIntensity: 0.005 },
        cockpit: { metalness: 0.96, roughness: 0.08, emissiveIntensity: 0.012 },
        accent: { metalness: 0.84, roughness: 0.2, emissiveIntensity: 0.005 },
        detailColor: 0xb7c0c9,
        lightOpacity: 0.15,
        engineOpacity: 0.23,
      };
    case EnemyType.ACE:
      return {
        body: { metalness: 0.84, roughness: 0.22, emissiveIntensity: 0.01 },
        wing: { metalness: 0.8, roughness: 0.26, emissiveIntensity: 0.004 },
        cockpit: { metalness: 0.98, roughness: 0.08, emissiveIntensity: 0.012 },
        accent: { metalness: 0.9, roughness: 0.18, emissiveIntensity: 0.006 },
        detailColor: 0xb3b0ac,
        lightOpacity: 0.16,
        engineOpacity: 0.26,
      };
    default:
      return {
        body: { metalness: 0.7, roughness: 0.3, emissiveIntensity: 0.006 },
        wing: { metalness: 0.62, roughness: 0.38, emissiveIntensity: 0.003 },
        cockpit: { metalness: 0.92, roughness: 0.12, emissiveIntensity: 0.01 },
        accent: { metalness: 0.82, roughness: 0.24, emissiveIntensity: 0.005 },
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
    cockpit: new THREE.MeshStandardMaterial({
      color: 0x1f252c,
      metalness: tuning.cockpit.metalness,
      roughness: tuning.cockpit.roughness,
      transparent: true,
      opacity: 0.88,
      emissive: 0x486170,
      emissiveIntensity: tuning.cockpit.emissiveIntensity,
    }),
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
      color: 0x7fd7ff,
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

  const bodyMaterial = createAircraftMaterial(0xe8e8e8, 0.82, 0.24, 0.02);
  const wingMaterial = createAircraftMaterial(0xa0a0a0, 0.72, 0.32, 0.03);
  const heroPanelMaterial = createAircraftMaterial(0xcfd8e3, 0.88, 0.22, 0.02);
  const cockpitMaterial = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a,
    metalness: 0.95,
    roughness: 0.1,
    transparent: true,
    opacity: 0.85,
    emissive: 0x4fc3ff,
    emissiveIntensity: 0.03,
  });
  const accentMaterial = createAircraftMaterial(0x707070, 0.9, 0.22, 0.02);
  const detailMaterial = createAircraftMaterial(0x45505c, 0.72, 0.4, 0.01);
  const sensorMaterial = createAircraftMaterial(0x5f7488, 0.9, 0.18, 0.03);
  const weaponMaterial = createAircraftMaterial(0x5f6875, 0.92, 0.22, 0.01);
  const energyPanelMaterial = createAircraftMaterial(0x74889a, 0.82, 0.28, 0.02);
  const playerIntakeCavityMaterial = new THREE.MeshStandardMaterial({
    color: 0x161a20,
    metalness: 0.38,
    roughness: 0.74,
  });
  const playerLightMaterial = new THREE.MeshBasicMaterial({
    color: 0x58d5ff,
    transparent: true,
    opacity: 0.75,
  });
  const navRedMaterial = new THREE.MeshBasicMaterial({
    color: 0xff5544,
    transparent: true,
    opacity: 0.45,
  });
  const navGreenMaterial = new THREE.MeshBasicMaterial({
    color: 0x6dff8c,
    transparent: true,
    opacity: 0.45,
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

  const canopyShoulder = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.54), heroPanelMaterial);
  canopyShoulder.position.set(0, 0.34, -0.42);
  canopyShoulder.rotation.x = 0.04;
  canopyShoulder.castShadow = true;
  group.add(canopyShoulder);

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

  const leftWingRootBlend = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.72), detailMaterial);
  leftWingRootBlend.position.set(-0.44, 0.05, -0.12);
  leftWingRootBlend.rotation.set(0.02, 0.22, 0.06);
  leftWingRootBlend.castShadow = true;
  group.add(leftWingRootBlend);

  const rightWingRootBlend = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.72), detailMaterial);
  rightWingRootBlend.position.set(0.44, 0.05, -0.12);
  rightWingRootBlend.rotation.set(0.02, -0.22, -0.06);
  rightWingRootBlend.castShadow = true;
  group.add(rightWingRootBlend);

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

  const leftIntakeShoulder = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.48), detailMaterial);
  leftIntakeShoulder.position.set(-0.4, 0.03, -0.22);
  leftIntakeShoulder.rotation.y = 0.18;
  leftIntakeShoulder.castShadow = true;
  group.add(leftIntakeShoulder);

  const leftIntakeCavity = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.42), playerIntakeCavityMaterial);
  leftIntakeCavity.position.set(-0.62, -0.08, -0.28);
  leftIntakeCavity.rotation.y = 0.08;
  leftIntakeCavity.castShadow = true;
  group.add(leftIntakeCavity);

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

  const rightIntakeShoulder = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.48), detailMaterial);
  rightIntakeShoulder.position.set(0.4, 0.03, -0.22);
  rightIntakeShoulder.rotation.y = -0.18;
  rightIntakeShoulder.castShadow = true;
  group.add(rightIntakeShoulder);

  const rightIntakeCavity = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.42), playerIntakeCavityMaterial);
  rightIntakeCavity.position.set(0.62, -0.08, -0.28);
  rightIntakeCavity.rotation.y = -0.08;
  rightIntakeCavity.castShadow = true;
  group.add(rightIntakeCavity);

  const leftIntakeThroat = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.32), playerIntakeCavityMaterial);
  leftIntakeThroat.position.set(-0.66, -0.1, -0.04);
  leftIntakeThroat.rotation.y = 0.08;
  leftIntakeThroat.castShadow = true;
  group.add(leftIntakeThroat);

  const rightIntakeThroat = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.32), playerIntakeCavityMaterial);
  rightIntakeThroat.position.set(0.66, -0.1, -0.04);
  rightIntakeThroat.rotation.y = -0.08;
  rightIntakeThroat.castShadow = true;
  group.add(rightIntakeThroat);

  // === 发动机喷口 ===
  // CylinderGeometry 默认轴向 +Y
  // rotation.x = -PI/2 使轴向 -Z/+Z
  const nozzleGeometry = new THREE.CylinderGeometry(0.18, 0.22, 0.4, 12);
  const glowMaterial = new THREE.MeshBasicMaterial({
    color: 0xff4400,
    transparent: true,
    opacity: 0.6,
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

  const leftPylonBrace = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.34), detailMaterial);
  leftPylonBrace.position.set(-1.03, -0.03, 0.42);
  leftPylonBrace.rotation.set(0.08, 0.12, -0.12);
  leftPylonBrace.castShadow = true;
  group.add(leftPylonBrace);

  const leftOuterRailBrace = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.28), detailMaterial);
  leftOuterRailBrace.position.set(-1.34, -0.02, 0.48);
  leftOuterRailBrace.rotation.set(0.04, 0.16, -0.08);
  leftOuterRailBrace.castShadow = true;
  group.add(leftOuterRailBrace);

  const leftInnerPylon = new THREE.Mesh(detailGeometries.hardpoint, accentMaterial);
  leftInnerPylon.position.set(-0.82, -0.06, 0.15);
  leftInnerPylon.rotation.y = 0.08;
  leftInnerPylon.castShadow = true;
  group.add(leftInnerPylon);

  const leftInnerPylonBrace = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.12, 0.3),
    detailMaterial
  );
  leftInnerPylonBrace.position.set(-0.73, -0.01, 0.08);
  leftInnerPylonBrace.rotation.set(0.06, 0.08, -0.1);
  leftInnerPylonBrace.castShadow = true;
  group.add(leftInnerPylonBrace);

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

  const rightPylonBrace = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.34), detailMaterial);
  rightPylonBrace.position.set(1.03, -0.03, 0.42);
  rightPylonBrace.rotation.set(0.08, -0.12, 0.12);
  rightPylonBrace.castShadow = true;
  group.add(rightPylonBrace);

  const rightOuterRailBrace = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.28), detailMaterial);
  rightOuterRailBrace.position.set(1.34, -0.02, 0.48);
  rightOuterRailBrace.rotation.set(0.04, -0.16, 0.08);
  rightOuterRailBrace.castShadow = true;
  group.add(rightOuterRailBrace);

  const rightInnerPylon = new THREE.Mesh(detailGeometries.hardpoint, accentMaterial);
  rightInnerPylon.position.set(0.82, -0.06, 0.15);
  rightInnerPylon.rotation.y = -0.08;
  rightInnerPylon.castShadow = true;
  group.add(rightInnerPylon);

  const rightInnerPylonBrace = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.12, 0.3),
    detailMaterial
  );
  rightInnerPylonBrace.position.set(0.73, -0.01, 0.08);
  rightInnerPylonBrace.rotation.set(0.06, -0.08, 0.1);
  rightInnerPylonBrace.castShadow = true;
  group.add(rightInnerPylonBrace);

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

  const centerlineKeel = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.22, 0.94), accentMaterial);
  centerlineKeel.position.set(0, -0.28, 0.3);
  centerlineKeel.castShadow = true;
  group.add(centerlineKeel);

  const centerlineStoreAdapter = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.52), accentMaterial);
  centerlineStoreAdapter.position.set(0, -0.2, 0.16);
  centerlineStoreAdapter.castShadow = true;
  group.add(centerlineStoreAdapter);

  const centerlineStoreBrace = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.38), detailMaterial);
  centerlineStoreBrace.position.set(0, -0.14, 0.16);
  centerlineStoreBrace.rotation.x = 0.06;
  centerlineStoreBrace.castShadow = true;
  group.add(centerlineStoreBrace);

  const centerlineBellyPanel = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.78), heroPanelMaterial);
  centerlineBellyPanel.position.set(0, -0.24, -0.02);
  centerlineBellyPanel.rotation.x = 0.04;
  centerlineBellyPanel.castShadow = true;
  group.add(centerlineBellyPanel);

  const centerlineBellyRail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.62), weaponMaterial);
  centerlineBellyRail.position.set(0, -0.28, 0.06);
  centerlineBellyRail.castShadow = true;
  group.add(centerlineBellyRail);

  const leftFuselageStation = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.46), weaponMaterial);
  leftFuselageStation.position.set(-0.38, -0.22, 0.14);
  leftFuselageStation.rotation.y = 0.14;
  leftFuselageStation.castShadow = true;
  group.add(leftFuselageStation);

  const rightFuselageStation = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.46), weaponMaterial);
  rightFuselageStation.position.set(0.38, -0.22, 0.14);
  rightFuselageStation.rotation.y = -0.14;
  rightFuselageStation.castShadow = true;
  group.add(rightFuselageStation);

  const leftFuselageStationBrace = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.3), detailMaterial);
  leftFuselageStationBrace.position.set(-0.32, -0.16, 0.08);
  leftFuselageStationBrace.rotation.set(0.06, 0.12, -0.08);
  leftFuselageStationBrace.castShadow = true;
  group.add(leftFuselageStationBrace);

  const rightFuselageStationBrace = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.3), detailMaterial);
  rightFuselageStationBrace.position.set(0.32, -0.16, 0.08);
  rightFuselageStationBrace.rotation.set(0.06, -0.12, 0.08);
  rightFuselageStationBrace.castShadow = true;
  group.add(rightFuselageStationBrace);

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

  const leftTailRootFairing = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.6), heroPanelMaterial);
  leftTailRootFairing.position.set(-0.42, 0.18, 1.28);
  leftTailRootFairing.rotation.y = 0.12;
  leftTailRootFairing.castShadow = true;
  group.add(leftTailRootFairing);

  const leftTailplaneRoot = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 0.42), wingMaterial);
  leftTailplaneRoot.position.set(-0.34, 0.08, 1.1);
  leftTailplaneRoot.rotation.y = 0.22;
  leftTailplaneRoot.castShadow = true;
  group.add(leftTailplaneRoot);

  const rightTailRootFairing = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.6), heroPanelMaterial);
  rightTailRootFairing.position.set(0.42, 0.18, 1.28);
  rightTailRootFairing.rotation.y = -0.12;
  rightTailRootFairing.castShadow = true;
  group.add(rightTailRootFairing);

  const leftTailRootShoulder = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.44), detailMaterial);
  leftTailRootShoulder.position.set(-0.48, 0.12, 1.1);
  leftTailRootShoulder.rotation.y = 0.14;
  leftTailRootShoulder.castShadow = true;
  group.add(leftTailRootShoulder);

  const rightTailRootShoulder = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.44), detailMaterial);
  rightTailRootShoulder.position.set(0.48, 0.12, 1.1);
  rightTailRootShoulder.rotation.y = -0.14;
  rightTailRootShoulder.castShadow = true;
  group.add(rightTailRootShoulder);

  const rightTailplaneRoot = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 0.42), wingMaterial);
  rightTailplaneRoot.position.set(0.34, 0.08, 1.1);
  rightTailplaneRoot.rotation.y = -0.22;
  rightTailplaneRoot.castShadow = true;
  group.add(rightTailplaneRoot);

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

  const leftIntakeSpineBlend = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.52), heroPanelMaterial);
  leftIntakeSpineBlend.position.set(-0.44, 0.14, -0.5);
  leftIntakeSpineBlend.rotation.y = 0.18;
  leftIntakeSpineBlend.castShadow = true;
  group.add(leftIntakeSpineBlend);

  const rightIntakeConduit = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.72), energyPanelMaterial);
  rightIntakeConduit.position.set(0.52, 0.08, -0.26);
  rightIntakeConduit.rotation.y = -0.1;
  rightIntakeConduit.castShadow = true;
  group.add(rightIntakeConduit);

  const rightIntakeSpineBlend = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.52), heroPanelMaterial);
  rightIntakeSpineBlend.position.set(0.44, 0.14, -0.5);
  rightIntakeSpineBlend.rotation.y = -0.18;
  rightIntakeSpineBlend.castShadow = true;
  group.add(rightIntakeSpineBlend);

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

  const leftVentralRootGlove = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.1, 0.72), heroPanelMaterial);
  leftVentralRootGlove.position.set(-0.46, -0.2, -0.18);
  leftVentralRootGlove.rotation.y = 0.2;
  leftVentralRootGlove.castShadow = true;
  group.add(leftVentralRootGlove);

  const rightVentralRootGlove = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.1, 0.72), heroPanelMaterial);
  rightVentralRootGlove.position.set(0.46, -0.2, -0.18);
  rightVentralRootGlove.rotation.y = -0.2;
  rightVentralRootGlove.castShadow = true;
  group.add(rightVentralRootGlove);

  const leftOuterPylonCap = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.36), weaponMaterial);
  leftOuterPylonCap.position.set(-1.3, -0.14, 0.36);
  leftOuterPylonCap.rotation.y = 0.16;
  leftOuterPylonCap.castShadow = true;
  group.add(leftOuterPylonCap);

  const leftInnerPylonCap = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.3), weaponMaterial);
  leftInnerPylonCap.position.set(-0.84, -0.12, 0.1);
  leftInnerPylonCap.rotation.y = 0.1;
  leftInnerPylonCap.castShadow = true;
  group.add(leftInnerPylonCap);

  const rightOuterPylonCap = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.36), weaponMaterial);
  rightOuterPylonCap.position.set(1.3, -0.14, 0.36);
  rightOuterPylonCap.rotation.y = -0.16;
  rightOuterPylonCap.castShadow = true;
  group.add(rightOuterPylonCap);

  const rightInnerPylonCap = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.3), weaponMaterial);
  rightInnerPylonCap.position.set(0.84, -0.12, 0.1);
  rightInnerPylonCap.rotation.y = -0.1;
  rightInnerPylonCap.castShadow = true;
  group.add(rightInnerPylonCap);

  const leftTailBaseCollar = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.34), detailMaterial);
  leftTailBaseCollar.position.set(-0.54, 0.18, 1.52);
  leftTailBaseCollar.rotation.y = 0.16;
  leftTailBaseCollar.castShadow = true;
  group.add(leftTailBaseCollar);

  const rightTailBaseCollar = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.34), detailMaterial);
  rightTailBaseCollar.position.set(0.54, 0.18, 1.52);
  rightTailBaseCollar.rotation.y = -0.16;
  rightTailBaseCollar.castShadow = true;
  group.add(rightTailBaseCollar);

  const leftNozzlePetalTop = new THREE.Mesh(detailGeometries.nozzlePetal, weaponMaterial);
  leftNozzlePetalTop.position.set(-0.3, 0.02, 2.03);
  leftNozzlePetalTop.castShadow = true;
  group.add(leftNozzlePetalTop);

  const leftNozzlePetalBottom = new THREE.Mesh(detailGeometries.nozzlePetal, weaponMaterial);
  leftNozzlePetalBottom.position.set(-0.3, -0.12, 2.03);
  leftNozzlePetalBottom.castShadow = true;
  group.add(leftNozzlePetalBottom);

  const rightNozzlePetalTop = new THREE.Mesh(detailGeometries.nozzlePetal, weaponMaterial);
  rightNozzlePetalTop.position.set(0.3, 0.02, 2.03);
  rightNozzlePetalTop.castShadow = true;
  group.add(rightNozzlePetalTop);

  const rightNozzlePetalBottom = new THREE.Mesh(detailGeometries.nozzlePetal, weaponMaterial);
  rightNozzlePetalBottom.position.set(0.3, -0.12, 2.03);
  rightNozzlePetalBottom.castShadow = true;
  group.add(rightNozzlePetalBottom);

  const leftTailVent = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.28), energyPanelMaterial);
  leftTailVent.position.set(-0.24, 0.08, 1.74);
  leftTailVent.rotation.y = 0.08;
  leftTailVent.castShadow = true;
  group.add(leftTailVent);

  const rightTailVent = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.28), energyPanelMaterial);
  rightTailVent.position.set(0.24, 0.08, 1.74);
  rightTailVent.rotation.y = -0.08;
  rightTailVent.castShadow = true;
  group.add(rightTailVent);

  const centerlineSensorBand = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.72), energyPanelMaterial);
  centerlineSensorBand.position.set(0, -0.1, -1.02);
  centerlineSensorBand.castShadow = true;
  group.add(centerlineSensorBand);

  const centerlineBellyDoor = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.96), detailMaterial);
  centerlineBellyDoor.position.set(0, -0.22, -0.06);
  centerlineBellyDoor.rotation.x = 0.04;
  centerlineBellyDoor.castShadow = true;
  group.add(centerlineBellyDoor);

  const leftTailStatusFillet = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.42), heroPanelMaterial);
  leftTailStatusFillet.position.set(-0.42, 0.18, 1.62);
  leftTailStatusFillet.rotation.y = 0.12;
  leftTailStatusFillet.castShadow = true;
  group.add(leftTailStatusFillet);

  const rightTailStatusFillet = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.42), heroPanelMaterial);
  rightTailStatusFillet.position.set(0.42, 0.18, 1.62);
  rightTailStatusFillet.rotation.y = -0.12;
  rightTailStatusFillet.castShadow = true;
  group.add(rightTailStatusFillet);

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
      bodyColor = 0xc5ccd3;
      wingColor = 0x9ea8b3;
      accentColor = 0x566472;
      bodySize = 1.42;
      bodyLength = 6.2;
      wingSpan = 5.4;
      scaleMultiplier = 2.0;
      break;
    case EnemyType.FIGHTER:
      bodyColor = 0xc9d0d6;
      wingColor = 0xa8b2bc;
      accentColor = 0x56616d;
      bodySize = 1.86;
      bodyLength = 8.4;
      wingSpan = 7.4;
      scaleMultiplier = 2.0;
      break;
    case EnemyType.HEAVY:
      bodyColor = 0xb0b7bf;
      wingColor = 0x8f98a3;
      accentColor = 0x4b5560;
      bodySize = 2.52;
      bodyLength = 10.6;
      wingSpan = 10.8;
      scaleMultiplier = 2.0;
      break;
    case EnemyType.SNIPER:
      bodyColor = 0xc2cad2;
      wingColor = 0x9aa5af;
      accentColor = 0x4f5d6a;
      bodySize = 1.6;
      bodyLength = 10.4;
      wingSpan = 6.6;
      scaleMultiplier = 2.0;
      break;
    case EnemyType.ACE:
      bodyColor = 0xd0d4d8;
      wingColor = 0xa5adb6;
      accentColor = 0x7a5046;
      bodySize = 2.04;
      bodyLength = 8.8;
      wingSpan = 7.8;
      scaleMultiplier = 2.0;
      break;
    default:
      bodyColor = config.color;
      wingColor = config.color;
      accentColor = config.color;
  }

  const jetProfile: JetProportionProfile = (() => {
    switch (config.type) {
      case EnemyType.SCOUT:
        return {
          intakeX: bodySize * 0.25,
          intakeY: -0.03,
          intakeZ: bodyLength * 0.12,
          intakeWidthScale: 0.9,
          intakeDepthScale: 0.64,
          intakeYaw: 0.13,
          bellyY: -bodySize * 0.24,
          bellyZ: bodyLength * 0.08,
          bellyWidth: 0.12,
          bellyHeight: 0.1,
          bellyDepth: 0.38,
          pylonX: wingSpan * 0.28,
          pylonY: -0.09,
          pylonZ: -bodyLength * 0.04,
          pylonWidth: 0.15,
          pylonDepth: 0.34,
          pylonYaw: 0.07,
          tailRootX: bodySize * 0.16,
          tailRootY: 0.1,
          tailRootZ: -bodyLength * 0.46,
          tailRootWidth: 0.14,
          tailRootHeight: 0.12,
          tailRootDepth: 0.46,
          nozzleX: 0,
          nozzleY: -0.01,
          nozzleZ: -bodyLength * 0.61,
          twinEngine: false,
        };
      case EnemyType.FIGHTER:
        return {
          intakeX: bodySize * 0.4,
          intakeY: -0.02,
          intakeZ: bodyLength * 0.15,
          intakeWidthScale: 1.12,
          intakeDepthScale: 0.82,
          intakeYaw: 0.16,
          bellyY: -bodySize * 0.26,
          bellyZ: bodyLength * 0.12,
          bellyWidth: 0.14,
          bellyHeight: 0.12,
          bellyDepth: 0.52,
          pylonX: wingSpan * 0.29,
          pylonY: -0.09,
          pylonZ: 0.08,
          pylonWidth: 0.18,
          pylonDepth: 0.5,
          pylonYaw: 0.08,
          tailRootX: bodySize * 0.24,
          tailRootY: 0.12,
          tailRootZ: -bodyLength * 0.47,
          tailRootWidth: 0.18,
          tailRootHeight: 0.14,
          tailRootDepth: 0.56,
          nozzleX: bodySize * 0.18,
          nozzleY: -0.02,
          nozzleZ: -bodyLength * 0.62,
          twinEngine: true,
        };
      case EnemyType.HEAVY:
        return {
          intakeX: bodySize * 0.64,
          intakeY: 0,
          intakeZ: bodyLength * 0.1,
          intakeWidthScale: 1.34,
          intakeDepthScale: 1.02,
          intakeYaw: 0.14,
          bellyY: -bodySize * 0.32,
          bellyZ: 0,
          bellyWidth: 0.2,
          bellyHeight: 0.14,
          bellyDepth: 0.82,
          pylonX: wingSpan * 0.3,
          pylonY: -0.11,
          pylonZ: -bodyLength * 0.04,
          pylonWidth: 0.22,
          pylonDepth: 0.66,
          pylonYaw: 0.06,
          tailRootX: bodySize * 0.28,
          tailRootY: 0.14,
          tailRootZ: -bodyLength * 0.54,
          tailRootWidth: 0.24,
          tailRootHeight: 0.18,
          tailRootDepth: 0.72,
          nozzleX: bodySize * 0.22,
          nozzleY: 0,
          nozzleZ: -bodyLength * 0.62,
          twinEngine: true,
        };
      case EnemyType.SNIPER:
        return {
          intakeX: bodySize * 0.27,
          intakeY: -0.02,
          intakeZ: bodyLength * 0.16,
          intakeWidthScale: 0.94,
          intakeDepthScale: 0.7,
          intakeYaw: 0.15,
          bellyY: -bodySize * 0.2,
          bellyZ: bodyLength * 0.24,
          bellyWidth: 0.12,
          bellyHeight: 0.1,
          bellyDepth: 0.56,
          pylonX: wingSpan * 0.2,
          pylonY: -0.08,
          pylonZ: 0.26,
          pylonWidth: 0.12,
          pylonDepth: 0.5,
          pylonYaw: 0.05,
          tailRootX: bodySize * 0.16,
          tailRootY: 0.12,
          tailRootZ: -bodyLength * 0.46,
          tailRootWidth: 0.14,
          tailRootHeight: 0.12,
          tailRootDepth: 0.52,
          nozzleX: 0,
          nozzleY: 0,
          nozzleZ: -bodyLength * 0.58,
          twinEngine: false,
        };
      case EnemyType.ACE:
      default:
        return {
          intakeX: bodySize * 0.38,
          intakeY: -0.02,
          intakeZ: bodyLength * 0.14,
          intakeWidthScale: 1.06,
          intakeDepthScale: 0.8,
          intakeYaw: 0.15,
          bellyY: -bodySize * 0.23,
          bellyZ: bodyLength * 0.1,
          bellyWidth: 0.16,
          bellyHeight: 0.12,
          bellyDepth: 0.58,
          pylonX: wingSpan * 0.24,
          pylonY: -0.1,
          pylonZ: 0.04,
          pylonWidth: 0.16,
          pylonDepth: 0.46,
          pylonYaw: 0.07,
          tailRootX: bodySize * 0.22,
          tailRootY: 0.12,
          tailRootZ: -bodyLength * 0.44,
          tailRootWidth: 0.18,
          tailRootHeight: 0.14,
          tailRootDepth: 0.58,
          nozzleX: 0,
          nozzleY: 0,
          nozzleZ: -bodyLength * 0.62,
          twinEngine: false,
        };
    }
  })();

  const contourProfile: EnemyContourProfile = (() => {
    switch (config.type) {
      case EnemyType.SCOUT:
        return {
          nose: {
            tipLength: 0.22,
            tipWidth: bodySize * 0.18,
            tipOffsetY: 0,
            tipOffsetZ: bodyLength * 0.62,
            chineWidth: bodySize * 0.34,
            chineHeight: bodySize * 0.09,
            chineDepth: bodySize * 0.18,
            chineOffsetY: -0.01,
            chineOffsetZ: bodyLength * 0.48,
          },
          bellyFin: {
            offsetY: -bodySize * 0.28,
            offsetX: bodySize * 0.02,
            offsetZ: bodyLength * 0.12,
            width: bodySize * 0.22,
            height: bodySize * 0.16,
            depth: bodySize * 0.52,
            sideYaw: 0.1,
            includeTwin: false,
          },
          wingRoot: {
            insetWidth: bodySize * 0.18,
            insetHeight: 0.09,
            insetDepth: bodySize * 0.24,
            insetY: -0.02,
            insetZ: -bodyLength * 0.14,
            insetYaw: 0.14,
            bridgeWidth: bodySize * 0.2,
            bridgeHeight: 0.1,
            bridgeDepth: 0.58,
            bridgeY: 0.03,
            bridgeZ: -bodyLength * 0.06,
          },
          pylon: {
            anchorWidth: bodySize * 0.16,
            anchorHeight: 0.1,
            anchorDepth: 0.3,
            anchorYaw: 0.08,
            braceWidth: 0.08,
            braceHeight: bodySize * 0.08,
            braceDepth: bodySize * 0.4,
            braceYaw: 0.14,
          },
          tail: {
            fairingWidth: 0.14,
            fairingHeight: bodySize * 0.14,
            fairingDepth: bodySize * 0.34,
            fairingY: -0.02,
            fairingZOffset: -bodyLength * 0.62,
          },
        };
      case EnemyType.FIGHTER:
        return {
          nose: {
            tipLength: 0.28,
            tipWidth: bodySize * 0.2,
            tipOffsetY: 0,
            tipOffsetZ: bodyLength * 0.64,
            chineWidth: bodySize * 0.38,
            chineHeight: bodySize * 0.1,
            chineDepth: bodySize * 0.2,
            chineOffsetY: -0.01,
            chineOffsetZ: bodyLength * 0.5,
          },
          bellyFin: {
            offsetY: -bodySize * 0.3,
            offsetX: 0.02,
            offsetZ: bodyLength * 0.18,
            width: bodySize * 0.24,
            height: bodySize * 0.18,
            depth: bodySize * 0.56,
            sideYaw: 0.11,
            includeTwin: true,
          },
          wingRoot: {
            insetWidth: bodySize * 0.2,
            insetHeight: 0.1,
            insetDepth: bodySize * 0.28,
            insetY: 0,
            insetZ: -bodyLength * 0.12,
            insetYaw: 0.18,
            bridgeWidth: bodySize * 0.24,
            bridgeHeight: 0.11,
            bridgeDepth: 0.66,
            bridgeY: 0.04,
            bridgeZ: -bodyLength * 0.04,
          },
          pylon: {
            anchorWidth: bodySize * 0.2,
            anchorHeight: 0.11,
            anchorDepth: 0.34,
            anchorYaw: 0.1,
            braceWidth: 0.08,
            braceHeight: bodySize * 0.1,
            braceDepth: bodySize * 0.42,
            braceYaw: 0.16,
          },
          tail: {
            fairingWidth: 0.16,
            fairingHeight: bodySize * 0.18,
            fairingDepth: bodySize * 0.38,
            fairingY: -0.01,
            fairingZOffset: -bodyLength * 0.64,
          },
        };
      case EnemyType.HEAVY:
        return {
          nose: {
            tipLength: 0.34,
            tipWidth: bodySize * 0.22,
            tipOffsetY: 0.01,
            tipOffsetZ: bodyLength * 0.64,
            chineWidth: bodySize * 0.4,
            chineHeight: bodySize * 0.12,
            chineDepth: bodySize * 0.22,
            chineOffsetY: 0,
            chineOffsetZ: bodyLength * 0.52,
          },
          bellyFin: {
            offsetY: -bodySize * 0.3,
            offsetX: 0.03,
            offsetZ: bodyLength * 0.12,
            width: bodySize * 0.28,
            height: bodySize * 0.18,
            depth: bodySize * 0.62,
            sideYaw: 0.12,
            includeTwin: true,
          },
          wingRoot: {
            insetWidth: bodySize * 0.24,
            insetHeight: 0.12,
            insetDepth: bodySize * 0.34,
            insetY: 0.02,
            insetZ: -bodyLength * 0.1,
            insetYaw: 0.16,
            bridgeWidth: bodySize * 0.3,
            bridgeHeight: 0.12,
            bridgeDepth: 0.74,
            bridgeY: 0.05,
            bridgeZ: 0,
          },
          pylon: {
            anchorWidth: bodySize * 0.22,
            anchorHeight: 0.12,
            anchorDepth: 0.38,
            anchorYaw: 0.08,
            braceWidth: 0.1,
            braceHeight: bodySize * 0.1,
            braceDepth: bodySize * 0.46,
            braceYaw: 0.16,
          },
          tail: {
            fairingWidth: 0.18,
            fairingHeight: bodySize * 0.22,
            fairingDepth: bodySize * 0.4,
            fairingY: -0.01,
            fairingZOffset: -bodyLength * 0.64,
          },
        };
      case EnemyType.SNIPER:
        return {
          nose: {
            tipLength: 0.3,
            tipWidth: bodySize * 0.16,
            tipOffsetY: -0.02,
            tipOffsetZ: bodyLength * 0.62,
            chineWidth: bodySize * 0.34,
            chineHeight: bodySize * 0.1,
            chineDepth: bodySize * 0.2,
            chineOffsetY: -0.01,
            chineOffsetZ: bodyLength * 0.48,
          },
          bellyFin: {
            offsetY: -bodySize * 0.26,
            offsetX: 0.01,
            offsetZ: bodyLength * 0.2,
            width: bodySize * 0.2,
            height: bodySize * 0.14,
            depth: bodySize * 0.54,
            sideYaw: 0.09,
            includeTwin: false,
          },
          wingRoot: {
            insetWidth: bodySize * 0.18,
            insetHeight: 0.08,
            insetDepth: bodySize * 0.24,
            insetY: 0,
            insetZ: -bodyLength * 0.05,
            insetYaw: 0.12,
            bridgeWidth: bodySize * 0.2,
            bridgeHeight: 0.09,
            bridgeDepth: 0.6,
            bridgeY: 0.02,
            bridgeZ: -bodyLength * 0.02,
          },
          pylon: {
            anchorWidth: bodySize * 0.16,
            anchorHeight: 0.1,
            anchorDepth: 0.32,
            anchorYaw: 0.06,
            braceWidth: 0.08,
            braceHeight: bodySize * 0.08,
            braceDepth: bodySize * 0.38,
            braceYaw: 0.12,
          },
          tail: {
            fairingWidth: 0.14,
            fairingHeight: bodySize * 0.15,
            fairingDepth: bodySize * 0.34,
            fairingY: -0.02,
            fairingZOffset: -bodyLength * 0.6,
          },
        };
      case EnemyType.ACE:
      default:
        return {
          nose: {
            tipLength: 0.34,
            tipWidth: bodySize * 0.2,
            tipOffsetY: 0.01,
            tipOffsetZ: bodyLength * 0.62,
            chineWidth: bodySize * 0.38,
            chineHeight: bodySize * 0.11,
            chineDepth: bodySize * 0.22,
            chineOffsetY: 0,
            chineOffsetZ: bodyLength * 0.5,
          },
          bellyFin: {
            offsetY: -bodySize * 0.28,
            offsetX: 0.02,
            offsetZ: bodyLength * 0.18,
            width: bodySize * 0.22,
            height: bodySize * 0.16,
            depth: bodySize * 0.56,
            sideYaw: 0.1,
            includeTwin: true,
          },
          wingRoot: {
            insetWidth: bodySize * 0.22,
            insetHeight: 0.11,
            insetDepth: bodySize * 0.3,
            insetY: 0.01,
            insetZ: -bodyLength * 0.08,
            insetYaw: 0.14,
            bridgeWidth: bodySize * 0.26,
            bridgeHeight: 0.11,
            bridgeDepth: 0.68,
            bridgeY: 0.03,
            bridgeZ: -bodyLength * 0.04,
          },
          pylon: {
            anchorWidth: bodySize * 0.18,
            anchorHeight: 0.1,
            anchorDepth: 0.34,
            anchorYaw: 0.08,
            braceWidth: 0.09,
            braceHeight: bodySize * 0.09,
            braceDepth: bodySize * 0.42,
            braceYaw: 0.14,
          },
          tail: {
            fairingWidth: 0.16,
            fairingHeight: bodySize * 0.16,
            fairingDepth: bodySize * 0.36,
            fairingY: -0.01,
            fairingZOffset: -bodyLength * 0.62,
          },
        };
    }
  })();

  group.scale.set(scaleMultiplier, scaleMultiplier, scaleMultiplier);
  const materials = getOrCreateMaterials(config.type, bodyColor, wingColor, accentColor);
  const weaponMaterial = createAircraftMaterial(accentColor, 0.88, 0.24, 0.02);
  const energyMaterial = createAircraftMaterial(accentColor, 0.78, 0.24, 0.03);
  const structureMaterial = createAircraftMaterial(wingColor, 0.62, 0.4, 0.005);
  const intakeCavityMaterial = new THREE.MeshStandardMaterial({
    color: 0x161a20,
    metalness: 0.42,
    roughness: 0.72,
  });
  const addIntakeLipPair = (
    xOffset: number,
    yOffset: number,
    zOffset: number,
    widthScale: number,
    depthScale: number,
    yaw: number
  ): void => {
    addMeshPart(group, detailGeometries.intakeLip, materials.detail, [-xOffset, yOffset, zOffset], {
      rotation: [0, yaw, 0],
      scale: [widthScale, 1, depthScale],
    });
    addMeshPart(group, detailGeometries.intakeLip, materials.detail, [xOffset, yOffset, zOffset], {
      rotation: [0, -yaw, 0],
      scale: [widthScale, 1, depthScale],
    });
  };
  const addTailRootFairingPair = (
    xOffset: number,
    yOffset: number,
    zOffset: number,
    width: number,
    height: number,
    depth: number,
    yaw: number
  ): void => {
    addMeshPart(group, new THREE.BoxGeometry(width, height, depth), materials.detail, [-xOffset, yOffset, zOffset], {
      rotation: [0.02, yaw, 0.04],
    });
    addMeshPart(group, new THREE.BoxGeometry(width, height, depth), materials.detail, [xOffset, yOffset, zOffset], {
      rotation: [0.02, -yaw, -0.04],
    });
  };
  const addCenterKeel = (
    width: number,
    height: number,
    depth: number,
    yOffset: number,
    zOffset: number
  ): void => {
    addMeshPart(group, new THREE.BoxGeometry(width, height, depth), materials.detail, [0, yOffset, zOffset], {
      rotation: [0.04, 0, 0],
    });
  };
  const addCanopyTransition = (
    cockpitY: number,
    cockpitZ: number,
    frameWidth: number,
    frameDepth: number
  ): void => {
    addMeshPart(group, new THREE.BoxGeometry(frameWidth, 0.06, frameDepth), materials.accent, [0, cockpitY, cockpitZ], {
      rotation: [0.02, 0, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(frameWidth * 0.8, 0.05, frameDepth * 0.42), materials.detail, [0, cockpitY - 0.04, cockpitZ + frameDepth * 0.46], {
      rotation: [0.04, 0, 0],
    });
  };
  const addCenterlineStoreAdapter = (yOffset: number, zOffset: number, depth: number): void => {
    addMeshPart(group, new THREE.BoxGeometry(0.12, 0.08, depth), materials.accent, [0, yOffset, zOffset]);
    addMeshPart(group, new THREE.BoxGeometry(0.08, 0.12, depth * 0.72), materials.detail, [0, yOffset + 0.05, zOffset], {
      rotation: [0.06, 0, 0],
    });
  };
  const addTailplaneRootPair = (xOffset: number, yOffset: number, zOffset: number, width: number): void => {
    addMeshPart(group, new THREE.BoxGeometry(width, 0.08, 0.42), materials.wing, [-xOffset, yOffset, zOffset], {
      rotation: [0, 0.24, 0.04],
    });
    addMeshPart(group, new THREE.BoxGeometry(width, 0.08, 0.42), materials.wing, [xOffset, yOffset, zOffset], {
      rotation: [0, -0.24, -0.04],
    });
  };
  const addUndersideRailPair = (
    xOffset: number,
    yOffset: number,
    zOffset: number,
    depth: number,
    yaw: number
  ): void => {
    addMeshPart(group, new THREE.BoxGeometry(0.12, 0.08, depth), materials.accent, [-xOffset, yOffset, zOffset], {
      rotation: [0, yaw, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.12, 0.08, depth), materials.accent, [xOffset, yOffset, zOffset], {
      rotation: [0, -yaw, 0],
    });
  };
  const addWingRootChinePair = (
    xOffset: number,
    yOffset: number,
    zOffset: number,
    width: number,
    depth: number,
    yaw: number
  ): void => {
    addMeshPart(group, new THREE.BoxGeometry(width, 0.1, depth), structureMaterial, [-xOffset, yOffset, zOffset], {
      rotation: [0.04, yaw, 0.08],
    });
    addMeshPart(group, new THREE.BoxGeometry(width, 0.1, depth), structureMaterial, [xOffset, yOffset, zOffset], {
      rotation: [0.04, -yaw, -0.08],
    });
  };
  const addNozzlePetalPair = (
    xOffset: number,
    yOffset: number,
    zOffset: number
  ): void => {
    addMeshPart(group, detailGeometries.nozzlePetal, materials.detail, [-xOffset, yOffset + 0.08, zOffset], {
      castShadow: false,
    });
    addMeshPart(group, detailGeometries.nozzlePetal, materials.detail, [-xOffset, yOffset - 0.08, zOffset], {
      castShadow: false,
    });
    addMeshPart(group, detailGeometries.nozzlePetal, materials.detail, [xOffset, yOffset + 0.08, zOffset], {
      castShadow: false,
    });
    addMeshPart(group, detailGeometries.nozzlePetal, materials.detail, [xOffset, yOffset - 0.08, zOffset], {
      castShadow: false,
    });
  };
  const addWingRootBlendPair = (
    xOffset: number,
    yOffset: number,
    zOffset: number,
    width: number,
    depth: number,
    yaw: number
  ): void => {
    addMeshPart(group, new THREE.BoxGeometry(width, 0.08, depth), materials.detail, [-xOffset, yOffset, zOffset], {
      rotation: [0.02, yaw, 0.05],
    });
    addMeshPart(group, new THREE.BoxGeometry(width, 0.08, depth), materials.detail, [xOffset, yOffset, zOffset], {
      rotation: [0.02, -yaw, -0.05],
    });
  };
  const addOutboardRailPair = (
    xOffset: number,
    yOffset: number,
    zOffset: number,
    width: number,
    depth: number,
    yaw: number
  ): void => {
    addMeshPart(group, new THREE.BoxGeometry(width, 0.08, depth), materials.accent, [-xOffset, yOffset, zOffset], {
      rotation: [0.04, yaw, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(width, 0.08, depth), materials.accent, [xOffset, yOffset, zOffset], {
      rotation: [0.04, -yaw, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(width * 0.66, 0.12, depth * 0.72), materials.detail, [-xOffset, yOffset + 0.04, zOffset], {
      rotation: [0.08, yaw * 0.72, -0.06],
    });
    addMeshPart(group, new THREE.BoxGeometry(width * 0.66, 0.12, depth * 0.72), materials.detail, [xOffset, yOffset + 0.04, zOffset], {
      rotation: [0.08, -yaw * 0.72, 0.06],
    });
  };
  const addFuselageSectionBreaks = (): void => {
    addMeshPart(group, new THREE.BoxGeometry(bodySize * 0.7, 0.06, 0.16), materials.detail, [0, bodySize * 0.03, bodyLength * 0.38], {
      rotation: [0.02, 0, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(bodySize * 0.66, 0.06, 0.16), materials.detail, [0, 0, 0], {
      rotation: [0.02, 0, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(bodySize * 0.7, 0.06, 0.16), materials.detail, [0, -bodySize * 0.03, -bodyLength * 0.32], {
      rotation: [0.02, 0, 0],
    });
  };
  const addWingRootTransitionPair = (
    xOffset: number,
    yOffset: number,
    zOffset: number
  ): void => {
    addMeshPart(group, new THREE.BoxGeometry(0.12, 0.12, 0.4), structureMaterial, [-xOffset, yOffset, zOffset], {
      rotation: [0.02, 0.08, 0.06],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.12, 0.12, 0.4), structureMaterial, [xOffset, yOffset, zOffset], {
      rotation: [0.02, -0.08, -0.06],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.1, 0.09, 0.42), materials.accent, [-xOffset, yOffset + 0.05, zOffset], {
      rotation: [0.06, 0.1, -0.03],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.1, 0.09, 0.42), materials.accent, [xOffset, yOffset + 0.05, zOffset], {
      rotation: [0.06, -0.1, 0.03],
    });
  };
  const addPylonAnchorPair = (
    xOffset: number,
    yOffset: number,
    zOffset: number
  ): void => {
    addMeshPart(group, new THREE.BoxGeometry(0.16, 0.1, 0.3), materials.accent, [-xOffset, yOffset, zOffset], {
      rotation: [0.04, 0.08, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.16, 0.1, 0.3), materials.accent, [xOffset, yOffset, zOffset], {
      rotation: [0.04, -0.08, 0],
    });
  };
  const addTailRootSaddle = (): void => {
    addMeshPart(group, new THREE.BoxGeometry(0.16, 0.12, 0.34), materials.detail, [0, jetProfile.tailRootY + 0.02, jetProfile.tailRootZ], {
      rotation: [0.04, 0, 0.05],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.22, 0.09, 0.26), materials.accent, [0, jetProfile.tailRootY + 0.03, jetProfile.tailRootZ], {
      rotation: [0.04, 0, -0.06],
    });
  };
  const addNoseContour = (profile: EnemyContourProfile['nose']): void => {
    addMeshPart(group, new THREE.ConeGeometry(profile.tipWidth, profile.tipLength, 10), materials.detail, [0, profile.tipOffsetY, profile.tipOffsetZ], {
      rotation: [-Math.PI / 2, 0, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(profile.chineWidth, profile.chineHeight, profile.chineDepth), materials.accent, [profile.chineWidth * 0.18, profile.chineOffsetY, profile.chineOffsetZ], {
      rotation: [0.02, 0.05, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(profile.chineWidth, profile.chineHeight, profile.chineDepth), materials.accent, [-profile.chineWidth * 0.18, profile.chineOffsetY, profile.chineOffsetZ], {
      rotation: [0.02, -0.05, 0],
    });
  };
  const addBellyFin = (profile: EnemyContourProfile['bellyFin']): void => {
    addMeshPart(group, new THREE.BoxGeometry(profile.width, profile.height, profile.depth), materials.detail, [profile.offsetX, profile.offsetY, profile.offsetZ], {
      rotation: [0, profile.sideYaw, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(profile.width, profile.height, profile.depth), materials.detail, [-profile.offsetX, profile.offsetY, profile.offsetZ], {
      rotation: [0, -profile.sideYaw, 0],
    });
    if (profile.includeTwin) {
      addMeshPart(group, new THREE.BoxGeometry(profile.width * 0.72, profile.height * 0.76, profile.depth * 0.6), structureMaterial, [profile.offsetX * 1.04, profile.offsetY + profile.height * 0.08, profile.offsetZ + profile.depth * 0.24], {
        rotation: [0.06, profile.sideYaw * 0.45, 0],
      });
      addMeshPart(group, new THREE.BoxGeometry(profile.width * 0.72, profile.height * 0.76, profile.depth * 0.6), structureMaterial, [-profile.offsetX * 1.04, profile.offsetY + profile.height * 0.08, profile.offsetZ + profile.depth * 0.24], {
        rotation: [0.06, -profile.sideYaw * 0.45, 0],
      });
    }
  };
  const addWingRootTransitions = (profile: EnemyContourProfile['wingRoot']): void => {
    addMeshPart(group, new THREE.BoxGeometry(profile.insetWidth, profile.insetHeight, profile.insetDepth), materials.detail, [-profile.insetWidth * 0.5, profile.insetY, profile.insetZ], {
      rotation: [0.03, profile.insetYaw, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(profile.insetWidth, profile.insetHeight, profile.insetDepth), materials.detail, [profile.insetWidth * 0.5, profile.insetY, profile.insetZ], {
      rotation: [0.03, -profile.insetYaw, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(profile.bridgeWidth, profile.bridgeHeight, profile.bridgeDepth), materials.accent, [-profile.bridgeWidth * 0.5, profile.bridgeY, profile.bridgeZ], {
      rotation: [0.04, profile.insetYaw * 0.9, 0.04],
    });
    addMeshPart(group, new THREE.BoxGeometry(profile.bridgeWidth, profile.bridgeHeight, profile.bridgeDepth), materials.accent, [profile.bridgeWidth * 0.5, profile.bridgeY, profile.bridgeZ], {
      rotation: [0.04, -profile.insetYaw * 0.9, -0.04],
    });
  };
  const addPylonRig = (profile: EnemyContourProfile['pylon']): void => {
    addMeshPart(group, new THREE.BoxGeometry(profile.anchorWidth, profile.anchorHeight, profile.anchorDepth), materials.accent, [-wingSpan * 0.22, jetProfile.pylonY - 0.02, jetProfile.pylonZ], {
      rotation: [0.04, -profile.anchorYaw, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(profile.anchorWidth, profile.anchorHeight, profile.anchorDepth), materials.accent, [wingSpan * 0.22, jetProfile.pylonY - 0.02, jetProfile.pylonZ], {
      rotation: [0.04, profile.anchorYaw, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(profile.braceWidth, profile.braceHeight, profile.braceDepth), materials.detail, [-wingSpan * 0.28, jetProfile.pylonY + 0.08, jetProfile.pylonZ + 0.06], {
      rotation: [0, -profile.braceYaw, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(profile.braceWidth, profile.braceHeight, profile.braceDepth), materials.detail, [wingSpan * 0.28, jetProfile.pylonY + 0.08, jetProfile.pylonZ + 0.06], {
      rotation: [0, profile.braceYaw, 0],
    });
  };
  const addTailTransition = (profile: EnemyContourProfile['tail']): void => {
    addMeshPart(group, new THREE.BoxGeometry(profile.fairingWidth, profile.fairingHeight, profile.fairingDepth), materials.detail, [0, profile.fairingY, profile.fairingZOffset], {
      rotation: [0.04, 0, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(profile.fairingWidth * 0.88, profile.fairingHeight * 0.76, profile.fairingDepth * 0.66), materials.accent, [0, profile.fairingY + 0.03, profile.fairingZOffset - 0.02], {
      rotation: [0.05, 0, 0],
    });
  };
  const addIntakeShoulderFairingPair = (): void => {
    const shoulderWidth = Math.max(0.12, contourProfile.wingRoot.insetWidth * 0.92);
    const shoulderHeight = Math.max(0.08, contourProfile.wingRoot.insetHeight);
    const shoulderDepth = Math.max(0.42, bodySize * 0.28);
    addMeshPart(group, new THREE.BoxGeometry(shoulderWidth, shoulderHeight, shoulderDepth), materials.accent, [-jetProfile.intakeX * 0.82, jetProfile.intakeY + shoulderHeight * 0.9, jetProfile.intakeZ - shoulderDepth * 0.08], {
      rotation: [0.04, jetProfile.intakeYaw * 0.92, -0.04],
    });
    addMeshPart(group, new THREE.BoxGeometry(shoulderWidth, shoulderHeight, shoulderDepth), materials.accent, [jetProfile.intakeX * 0.82, jetProfile.intakeY + shoulderHeight * 0.9, jetProfile.intakeZ - shoulderDepth * 0.08], {
      rotation: [0.04, -jetProfile.intakeYaw * 0.92, 0.04],
    });
    addMeshPart(group, new THREE.BoxGeometry(shoulderWidth * 0.68, shoulderHeight * 0.88, shoulderDepth * 0.72), structureMaterial, [-jetProfile.intakeX * 0.98, jetProfile.intakeY + shoulderHeight * 0.18, jetProfile.intakeZ - shoulderDepth * 0.22], {
      rotation: [0.02, jetProfile.intakeYaw * 1.08, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(shoulderWidth * 0.68, shoulderHeight * 0.88, shoulderDepth * 0.72), structureMaterial, [jetProfile.intakeX * 0.98, jetProfile.intakeY + shoulderHeight * 0.18, jetProfile.intakeZ - shoulderDepth * 0.22], {
      rotation: [0.02, -jetProfile.intakeYaw * 1.08, 0],
    });
  };
  const addBellyPayloadFairing = (): void => {
    const bayWidth = Math.max(0.12, jetProfile.bellyWidth * 1.18);
    const bayHeight = Math.max(0.08, jetProfile.bellyHeight * 0.9);
    const bayDepth = Math.max(0.48, jetProfile.bellyDepth * 1.04);
    addMeshPart(group, new THREE.BoxGeometry(bayWidth, bayHeight, bayDepth), materials.accent, [0, jetProfile.bellyY + bayHeight * 0.18, jetProfile.bellyZ], {
      rotation: [0.04, 0, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(Math.max(0.08, bayWidth * 0.52), bayHeight * 1.36, bayDepth * 0.68), materials.detail, [-bayWidth * 0.68, jetProfile.bellyY + bayHeight * 0.36, jetProfile.bellyZ + bayDepth * 0.04], {
      rotation: [0.06, 0.08, -0.04],
    });
    addMeshPart(group, new THREE.BoxGeometry(Math.max(0.08, bayWidth * 0.52), bayHeight * 1.36, bayDepth * 0.68), materials.detail, [bayWidth * 0.68, jetProfile.bellyY + bayHeight * 0.36, jetProfile.bellyZ + bayDepth * 0.04], {
      rotation: [0.06, -0.08, 0.04],
    });
    addMeshPart(group, new THREE.BoxGeometry(Math.max(0.1, bayWidth * 0.8), bayHeight * 0.76, bayDepth * 0.54), weaponMaterial, [0, jetProfile.bellyY - bayHeight * 0.06, jetProfile.bellyZ + bayDepth * 0.14], {
      rotation: [0.02, 0, 0],
    });
  };
  const addPylonShoulderPair = (): void => {
    const collarWidth = Math.max(0.14, contourProfile.pylon.anchorWidth * 1.08);
    const collarHeight = Math.max(0.08, contourProfile.pylon.anchorHeight * 0.92);
    const collarDepth = Math.max(0.3, contourProfile.pylon.anchorDepth * 0.82);
    addMeshPart(group, new THREE.BoxGeometry(collarWidth, collarHeight, collarDepth), structureMaterial, [-wingSpan * 0.24, jetProfile.pylonY + 0.04, jetProfile.pylonZ - 0.02], {
      rotation: [0.06, -contourProfile.pylon.anchorYaw * 0.7, -0.04],
    });
    addMeshPart(group, new THREE.BoxGeometry(collarWidth, collarHeight, collarDepth), structureMaterial, [wingSpan * 0.24, jetProfile.pylonY + 0.04, jetProfile.pylonZ - 0.02], {
      rotation: [0.06, contourProfile.pylon.anchorYaw * 0.7, 0.04],
    });
  };
  const addTailTransitionBracePair = (): void => {
    const braceWidth = Math.max(0.12, contourProfile.tail.fairingWidth * 0.92);
    const braceHeight = Math.max(0.12, contourProfile.tail.fairingHeight * 0.88);
    const braceDepth = Math.max(0.42, contourProfile.tail.fairingDepth * 0.86);
    addMeshPart(group, new THREE.BoxGeometry(braceWidth, braceHeight, braceDepth), structureMaterial, [-jetProfile.tailRootX * 0.8, contourProfile.tail.fairingY + braceHeight * 0.72, contourProfile.tail.fairingZOffset + braceDepth * 0.08], {
      rotation: [0.05, 0.12, 0.04],
    });
    addMeshPart(group, new THREE.BoxGeometry(braceWidth, braceHeight, braceDepth), structureMaterial, [jetProfile.tailRootX * 0.8, contourProfile.tail.fairingY + braceHeight * 0.72, contourProfile.tail.fairingZOffset + braceDepth * 0.08], {
      rotation: [0.05, -0.12, -0.04],
    });
    addMeshPart(group, new THREE.BoxGeometry(Math.max(0.12, braceWidth * 0.86), Math.max(0.08, braceHeight * 0.72), Math.max(0.28, braceDepth * 0.58)), materials.accent, [0, contourProfile.tail.fairingY + braceHeight * 0.34, contourProfile.tail.fairingZOffset + 0.04], {
      rotation: [0.04, 0, 0],
    });
  };
  const applyUnifiedJetProportionLayer = (): void => {
    addIntakeLipPair(
      jetProfile.intakeX,
      jetProfile.intakeY,
      jetProfile.intakeZ,
      jetProfile.intakeWidthScale,
      jetProfile.intakeDepthScale,
      jetProfile.intakeYaw
    );
    addMeshPart(group, new THREE.BoxGeometry(jetProfile.bellyWidth, jetProfile.bellyHeight, jetProfile.bellyDepth), materials.detail, [0, jetProfile.bellyY, jetProfile.bellyZ], {
      rotation: [0.04, 0, 0],
    });
    addUndersideRailPair(
      jetProfile.pylonX,
      jetProfile.pylonY,
      jetProfile.pylonZ,
      jetProfile.pylonDepth,
      jetProfile.pylonYaw
    );
    addOutboardRailPair(
      jetProfile.pylonX,
      jetProfile.pylonY,
      jetProfile.pylonZ,
      jetProfile.pylonWidth,
      jetProfile.pylonDepth,
      jetProfile.pylonYaw
    );
    addTailRootFairingPair(
      jetProfile.tailRootX,
      jetProfile.tailRootY,
      jetProfile.tailRootZ,
      jetProfile.tailRootWidth,
      jetProfile.tailRootHeight,
      jetProfile.tailRootDepth,
      0.1
    );

    if (jetProfile.twinEngine) {
      addNozzlePetalPair(jetProfile.nozzleX, jetProfile.nozzleY, jetProfile.nozzleZ);
    } else {
      addMeshPart(group, detailGeometries.nozzlePetal, materials.detail, [0, jetProfile.nozzleY + 0.08, jetProfile.nozzleZ], {
        castShadow: false,
      });
      addMeshPart(group, detailGeometries.nozzlePetal, materials.detail, [0, jetProfile.nozzleY - 0.08, jetProfile.nozzleZ], {
        castShadow: false,
      });
    }
  };
  const applyEnemyContourRefinement = (): void => {
    addNoseContour(contourProfile.nose);
    addIntakeShoulderFairingPair();
    addBellyFin(contourProfile.bellyFin);
    addBellyPayloadFairing();
    addWingRootTransitions(contourProfile.wingRoot);
    addPylonRig(contourProfile.pylon);
    addPylonShoulderPair();
    addTailTransition(contourProfile.tail);
    addTailTransitionBracePair();
  };
  if (config.type === EnemyType.SCOUT) {
    addMeshPart(group, new THREE.CylinderGeometry(bodySize * 0.14, bodySize * 0.26, bodyLength * 0.34, 8), materials.body, [0, 0, bodyLength * 0.26], {
      rotation: [Math.PI / 2, 0, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(bodySize * 0.42, bodySize * 0.26, bodyLength * 0.38), materials.body, [0, 0, bodyLength * 0.02]);
    addMeshPart(group, new THREE.BoxGeometry(bodySize * 0.3, bodySize * 0.22, bodyLength * 0.34), materials.detail, [0, 0.01, -bodyLength * 0.28]);
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
    addMeshPart(group, new THREE.BoxGeometry(0.18, 0.08, 0.2), materials.detail, [0, bodySize * 0.08, bodyLength * 0.4]);
    addMeshPart(group, new THREE.BoxGeometry(bodySize * 0.54, 0.08, 0.82), structureMaterial, [-bodySize * 0.3, 0.05, bodyLength * 0.06], {
      rotation: [0, 0.18, 0.08],
    });
    addMeshPart(group, new THREE.BoxGeometry(bodySize * 0.54, 0.08, 0.82), structureMaterial, [bodySize * 0.3, 0.05, bodyLength * 0.06], {
      rotation: [0, -0.18, -0.08],
    });
    addMeshPart(group, new THREE.BoxGeometry(bodySize * 0.18, 0.08, 0.5), materials.wing, [-bodySize * 0.18, 0.04, bodyLength * 0.04], {
      rotation: [0, 0.22, 0.04],
    });
    addMeshPart(group, new THREE.BoxGeometry(bodySize * 0.18, 0.08, 0.5), materials.wing, [bodySize * 0.18, 0.04, bodyLength * 0.04], {
      rotation: [0, -0.22, -0.04],
    });
    addWingRootBlendPair(bodySize * 0.22, 0.04, -bodyLength * 0.06, bodySize * 0.22, 0.56, 0.18);
    addMeshPart(group, new THREE.BoxGeometry(0.22, 0.12, bodyLength * 0.34), materials.detail, [0, -bodySize * 0.16, bodyLength * 0.02]);
    addMeshPart(group, new THREE.BoxGeometry(0.16, 0.12, 0.42), materials.accent, [-bodySize * 0.28, -0.02, bodyLength * 0.28], {
      rotation: [0, 0.26, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.16, 0.12, 0.42), materials.accent, [bodySize * 0.28, -0.02, bodyLength * 0.28], {
      rotation: [0, -0.26, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.08, 0.12, 0.34), intakeCavityMaterial, [-bodySize * 0.26, -0.01, bodyLength * 0.18], {
      rotation: [0, 0.12, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.08, 0.12, 0.34), intakeCavityMaterial, [bodySize * 0.26, -0.01, bodyLength * 0.18], {
      rotation: [0, -0.12, 0],
    });
    addIntakeLipPair(bodySize * 0.26, 0.01, bodyLength * 0.2, 0.92, 0.62, 0.12);
    addMeshPart(group, new THREE.BoxGeometry(0.12, 0.08, 0.34), materials.accent, [-wingSpan * 0.22, -0.07, -bodyLength * 0.04], {
      rotation: [0, 0.06, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.12, 0.08, 0.34), materials.accent, [wingSpan * 0.22, -0.07, -bodyLength * 0.04], {
      rotation: [0, -0.06, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.08, 0.12, 0.42), materials.detail, [-wingSpan * 0.22, -0.02, -bodyLength * 0.04], {
      rotation: [0.06, 0.04, -0.08],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.08, 0.12, 0.42), materials.detail, [wingSpan * 0.22, -0.02, -bodyLength * 0.04], {
      rotation: [0.06, -0.04, 0.08],
    });
    addMeshPart(group, new THREE.BoxGeometry(bodySize * 0.18, 0.12, 0.54), materials.accent, [-bodySize * 0.42, -bodySize * 0.04, bodyLength * 0.14], {
      rotation: [0, 0.18, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(bodySize * 0.18, 0.12, 0.54), materials.accent, [bodySize * 0.42, -bodySize * 0.04, bodyLength * 0.14], {
      rotation: [0, -0.18, 0],
    });
    addMeshPart(group, new THREE.CylinderGeometry(bodySize * 0.15, bodySize * 0.18, 0.22, 10), materials.detail, [0, 0, -bodyLength * 0.6], {
      rotation: [-Math.PI / 2, 0, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.18, 0.08, 0.4), materials.accent, [-bodySize * 0.22, -bodySize * 0.1, bodyLength * 0.26], {
      rotation: [0.02, 0.18, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.18, 0.08, 0.4), materials.accent, [bodySize * 0.22, -bodySize * 0.1, bodyLength * 0.26], {
      rotation: [0.02, -0.18, 0],
    });
    addOutboardRailPair(wingSpan * 0.3, -0.08, -bodyLength * 0.04, 0.16, 0.36, 0.08);
    addMeshPart(group, new THREE.BoxGeometry(0.12, 0.18, 0.34), materials.detail, [0, -bodySize * 0.22, -bodyLength * 0.12]);
    addCenterKeel(0.1, 0.2, 0.42, -bodySize * 0.26, bodyLength * 0.06);
    addTailRootFairingPair(bodySize * 0.18, 0.09, -bodyLength * 0.44, 0.14, 0.12, 0.42, 0.12);
    addWingRootChinePair(bodySize * 0.24, 0.02, -bodyLength * 0.14, 0.16, 0.62, 0.2);
    addUndersideRailPair(bodySize * 0.26, -0.14, bodyLength * 0.04, 0.52, 0.18);
    addMeshPart(group, new THREE.BoxGeometry(0.14, 0.18, 0.34), materials.detail, [0, -bodySize * 0.28, bodyLength * 0.24], {
      rotation: [0.08, 0, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.12, 0.1, 0.42), intakeCavityMaterial, [-bodySize * 0.34, -0.06, bodyLength * 0.04], {
      rotation: [0.02, 0.18, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.12, 0.1, 0.42), intakeCavityMaterial, [bodySize * 0.34, -0.06, bodyLength * 0.04], {
      rotation: [0.02, -0.18, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.14, 0.12, 0.38), materials.detail, [-bodySize * 0.22, 0.08, -bodyLength * 0.5], {
      rotation: [0.02, 0.12, 0.04],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.14, 0.12, 0.38), materials.detail, [bodySize * 0.22, 0.08, -bodyLength * 0.5], {
      rotation: [0.02, -0.12, -0.04],
    });
    applyUnifiedJetProportionLayer();
    addMeshPart(group, new THREE.ConeGeometry(bodySize * 0.14, 0.7, 8), materials.engine, [0, 0, -bodyLength * 0.56], {
      rotation: [-Math.PI / 2, 0, 0],
      name: 'engineGlow',
      castShadow: false,
    });
  } else if (config.type === EnemyType.FIGHTER) {
    addMeshPart(group, new THREE.CylinderGeometry(bodySize * 0.16, bodySize * 0.3, bodyLength * 0.34, 8), materials.body, [0, 0, bodyLength * 0.32], {
      rotation: [Math.PI / 2, 0, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(bodySize * 0.56, bodySize * 0.3, bodyLength * 0.4), materials.body, [0, 0.01, bodyLength * 0.05]);
    addMeshPart(group, new THREE.BoxGeometry(bodySize * 0.48, bodySize * 0.26, bodyLength * 0.34), materials.detail, [0, 0, -bodyLength * 0.26]);
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
    addCanopyTransition(bodySize * 0.24, bodyLength * 0.18, 0.18, 0.64);
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
    addMeshPart(group, new THREE.BoxGeometry(bodySize * 0.62, 0.12, 1.12), structureMaterial, [-bodySize * 0.28, 0.03, -bodyLength * 0.06], {
      rotation: [0, 0.16, 0.06],
    });
    addMeshPart(group, new THREE.BoxGeometry(bodySize * 0.62, 0.12, 1.12), structureMaterial, [bodySize * 0.28, 0.03, -bodyLength * 0.06], {
      rotation: [0, -0.16, -0.06],
    });
    addMeshPart(group, new THREE.BoxGeometry(bodySize * 0.22, 0.1, 0.72), materials.wing, [-bodySize * 0.22, 0.04, 0.02], {
      rotation: [0, 0.24, 0.04],
    });
    addMeshPart(group, new THREE.BoxGeometry(bodySize * 0.22, 0.1, 0.72), materials.wing, [bodySize * 0.22, 0.04, 0.02], {
      rotation: [0, -0.24, -0.04],
    });
    addWingRootBlendPair(bodySize * 0.3, 0.05, -bodyLength * 0.04, bodySize * 0.26, 0.74, 0.18);
    addMeshPart(group, new THREE.BoxGeometry(0.18, 0.12, 0.72), materials.accent, [0, -bodySize * 0.16, 0.32]);
    addCenterlineStoreAdapter(-bodySize * 0.22, 0.18, 0.54);
    addMeshPart(group, new THREE.BoxGeometry(0.14, 0.16, 0.58), materials.accent, [-bodySize * 0.42, -0.02, bodyLength * 0.22], {
      rotation: [0, 0.24, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.14, 0.16, 0.58), materials.accent, [bodySize * 0.42, -0.02, bodyLength * 0.22], {
      rotation: [0, -0.24, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.12, 0.14, 0.46), intakeCavityMaterial, [-bodySize * 0.42, -0.01, bodyLength * 0.16], {
      rotation: [0, 0.16, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.12, 0.14, 0.46), intakeCavityMaterial, [bodySize * 0.42, -0.01, bodyLength * 0.16], {
      rotation: [0, -0.16, 0],
    });
    addIntakeLipPair(bodySize * 0.42, 0.02, bodyLength * 0.2, 1.18, 0.84, 0.16);
    addMeshPart(group, new THREE.BoxGeometry(0.14, 0.08, 0.42), materials.detail, [-wingSpan * 0.22, -0.08, 0.12], {
      rotation: [0, 0.06, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.14, 0.08, 0.42), materials.detail, [wingSpan * 0.22, -0.08, 0.12], {
      rotation: [0, -0.06, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.12, 0.08, 0.48), materials.accent, [-wingSpan * 0.14, -0.1, -bodyLength * 0.02], {
      rotation: [0, 0.04, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.18, 0.1, 0.62), materials.accent, [-wingSpan * 0.28, -0.1, 0.08], {
      rotation: [0, 0.08, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.12, 0.08, 0.48), materials.accent, [wingSpan * 0.14, -0.1, -bodyLength * 0.02], {
      rotation: [0, -0.04, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.18, 0.1, 0.62), materials.accent, [wingSpan * 0.28, -0.1, 0.08], {
      rotation: [0, -0.08, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.08, 0.14, 0.58), materials.detail, [-wingSpan * 0.28, -0.02, 0.08], {
      rotation: [0.08, 0.08, -0.08],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.08, 0.14, 0.58), materials.detail, [wingSpan * 0.28, -0.02, 0.08], {
      rotation: [0.08, -0.08, 0.08],
    });
    addMeshPart(group, new THREE.BoxGeometry(bodySize * 0.22, 0.14, 0.8), materials.accent, [-bodySize * 0.5, -0.02, bodyLength * 0.12], {
      rotation: [0, 0.2, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(bodySize * 0.22, 0.14, 0.8), materials.accent, [bodySize * 0.5, -0.02, bodyLength * 0.12], {
      rotation: [0, -0.2, 0],
    });
    addOutboardRailPair(wingSpan * 0.3, -0.08, 0.08, 0.18, 0.52, 0.08);
    addMeshPart(group, new THREE.BoxGeometry(0.22, 0.16, 0.52), materials.detail, [-bodySize * 0.24, 0.1, -bodyLength * 0.52], {
      rotation: [0.02, 0.1, 0.04],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.22, 0.16, 0.52), materials.detail, [bodySize * 0.24, 0.1, -bodyLength * 0.52], {
      rotation: [0.02, -0.1, -0.04],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.18, 0.22, 0.66), materials.detail, [0, -bodySize * 0.22, bodyLength * 0.08], {
      rotation: [0.04, 0, 0],
    });
    addCenterKeel(0.12, 0.22, 0.62, -bodySize * 0.28, 0.1);
    addTailRootFairingPair(bodySize * 0.24, 0.12, -bodyLength * 0.46, 0.18, 0.14, 0.56, 0.12);
    addTailplaneRootPair(bodySize * 0.26, 0.08, -bodyLength * 0.3, 0.24);
    addWingRootChinePair(bodySize * 0.3, 0.04, -bodyLength * 0.18, 0.2, 0.86, 0.2);
    addUndersideRailPair(bodySize * 0.44, -0.14, bodyLength * 0.12, 0.68, 0.2);
    addMeshPart(group, new THREE.BoxGeometry(0.16, 0.14, 0.46), materials.detail, [-bodySize * 0.34, -0.1, bodyLength * 0.06], {
      rotation: [0.06, 0.14, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.16, 0.14, 0.46), materials.detail, [bodySize * 0.34, -0.1, bodyLength * 0.06], {
      rotation: [0.06, -0.14, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.16, 0.14, 0.46), materials.detail, [-bodySize * 0.22, 0.12, -bodyLength * 0.48], {
      rotation: [0.02, 0.12, 0.04],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.16, 0.14, 0.46), materials.detail, [bodySize * 0.22, 0.12, -bodyLength * 0.48], {
      rotation: [0.02, -0.12, -0.04],
    });
    addMeshPart(group, new THREE.CylinderGeometry(bodySize * 0.14, bodySize * 0.18, 0.18, 10), materials.detail, [-bodySize * 0.18, -0.02, -bodyLength * 0.66], {
      rotation: [-Math.PI / 2, 0, 0],
    });
    addMeshPart(group, new THREE.CylinderGeometry(bodySize * 0.14, bodySize * 0.18, 0.18, 10), materials.detail, [bodySize * 0.18, -0.02, -bodyLength * 0.66], {
      rotation: [-Math.PI / 2, 0, 0],
    });
    applyUnifiedJetProportionLayer();
    addNozzlePetalPair(bodySize * 0.18, -0.02, -bodyLength * 0.62);
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
    addMeshPart(group, new THREE.BoxGeometry(bodySize * 0.74, 0.16, 1.58), structureMaterial, [-bodySize * 0.38, 0.06, -bodyLength * 0.1], {
      rotation: [0, 0.12, 0.05],
    });
    addMeshPart(group, new THREE.BoxGeometry(bodySize * 0.74, 0.16, 1.58), structureMaterial, [bodySize * 0.38, 0.06, -bodyLength * 0.1], {
      rotation: [0, -0.12, -0.05],
    });
    addMeshPart(group, new THREE.BoxGeometry(bodySize * 0.3, 0.14, 1.1), materials.wing, [-bodySize * 0.34, 0.06, 0.08], {
      rotation: [0, 0.18, 0.04],
    });
    addMeshPart(group, new THREE.BoxGeometry(bodySize * 0.3, 0.14, 1.1), materials.wing, [bodySize * 0.34, 0.06, 0.08], {
      rotation: [0, -0.18, -0.04],
    });
    addWingRootBlendPair(bodySize * 0.38, 0.06, -bodyLength * 0.06, bodySize * 0.34, 0.92, 0.15);
    addMeshPart(group, new THREE.BoxGeometry(0.28, 0.18, bodyLength * 0.42), weaponMaterial, [0, -bodySize * 0.2, 0.12]);
    addMeshPart(group, new THREE.BoxGeometry(0.22, 0.16, 0.74), materials.accent, [-bodySize * 0.68, -0.02, bodyLength * 0.18], {
      rotation: [0, 0.2, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.22, 0.16, 0.74), materials.accent, [bodySize * 0.68, -0.02, bodyLength * 0.18], {
      rotation: [0, -0.2, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.18, 0.18, 0.62), intakeCavityMaterial, [-bodySize * 0.66, 0, bodyLength * 0.1], {
      rotation: [0, 0.14, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.18, 0.18, 0.62), intakeCavityMaterial, [bodySize * 0.66, 0, bodyLength * 0.1], {
      rotation: [0, -0.14, 0],
    });
    addIntakeLipPair(bodySize * 0.66, 0.02, bodyLength * 0.14, 1.36, 1.04, 0.14);
    addMeshPart(group, new THREE.BoxGeometry(0.16, 0.12, 0.72), weaponMaterial, [-wingSpan * 0.26, -0.12, -bodyLength * 0.06], {
      rotation: [0, 0.04, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.16, 0.12, 0.72), weaponMaterial, [wingSpan * 0.26, -0.12, -bodyLength * 0.06], {
      rotation: [0, -0.04, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.1, 0.16, 0.76), materials.detail, [-wingSpan * 0.26, -0.04, -bodyLength * 0.06], {
      rotation: [0.08, 0.04, -0.06],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.1, 0.16, 0.76), materials.detail, [wingSpan * 0.26, -0.04, -bodyLength * 0.06], {
      rotation: [0.08, -0.04, 0.06],
    });
    addMeshPart(group, new THREE.BoxGeometry(bodySize * 0.28, 0.16, 1), materials.accent, [-bodySize * 0.66, 0.04, bodyLength * 0.02], {
      rotation: [0, 0.16, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(bodySize * 0.28, 0.16, 1), materials.accent, [bodySize * 0.66, 0.04, bodyLength * 0.02], {
      rotation: [0, -0.16, 0],
    });
    addOutboardRailPair(wingSpan * 0.3, -0.08, -bodyLength * 0.06, 0.22, 0.68, 0.06);
    addMeshPart(group, new THREE.BoxGeometry(bodySize * 0.24, 0.14, bodyLength * 0.36), materials.detail, [0, -bodySize * 0.28, -bodyLength * 0.12]);
    addMeshPart(group, new THREE.BoxGeometry(0.24, 0.26, bodyLength * 0.48), materials.detail, [0, -bodySize * 0.3, 0.02], {
      rotation: [0.04, 0, 0],
    });
    addWingRootChinePair(bodySize * 0.44, 0.08, -bodyLength * 0.2, 0.3, 1.18, 0.16);
    addUndersideRailPair(bodySize * 0.74, -0.16, bodyLength * 0.02, 0.96, 0.16);
    addMeshPart(group, new THREE.BoxGeometry(0.24, 0.2, 0.92), weaponMaterial, [-wingSpan * 0.18, -0.14, -bodyLength * 0.02], {
      rotation: [0.04, 0.06, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.24, 0.2, 0.92), weaponMaterial, [wingSpan * 0.18, -0.14, -bodyLength * 0.02], {
      rotation: [0.04, -0.06, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.18, 0.16, 0.62), intakeCavityMaterial, [-bodySize * 0.78, -0.08, -bodyLength * 0.02], {
      rotation: [0.02, 0.18, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.18, 0.16, 0.62), intakeCavityMaterial, [bodySize * 0.78, -0.08, -bodyLength * 0.02], {
      rotation: [0.02, -0.18, 0],
    });
    addCenterKeel(0.18, 0.28, 0.88, -bodySize * 0.34, 0.08);
    addTailRootFairingPair(bodySize * 0.28, 0.14, -bodyLength * 0.54, 0.24, 0.18, 0.72, 0.1);
    addMeshPart(group, new THREE.BoxGeometry(0.3, 0.18, 0.64), materials.detail, [-bodySize * 0.24, 0.12, -bodyLength * 0.5], {
      rotation: [0.02, 0.08, 0.04],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.3, 0.18, 0.64), materials.detail, [bodySize * 0.24, 0.12, -bodyLength * 0.5], {
      rotation: [0.02, -0.08, -0.04],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.22, 0.16, 0.72), materials.detail, [-bodySize * 0.28, 0.14, -bodyLength * 0.58], {
      rotation: [0.02, 0.1, 0.04],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.22, 0.16, 0.72), materials.detail, [bodySize * 0.28, 0.14, -bodyLength * 0.58], {
      rotation: [0.02, -0.1, -0.04],
    });
    addMeshPart(group, new THREE.CylinderGeometry(bodySize * 0.17, bodySize * 0.2, 0.28, 10), materials.detail, [-bodySize * 0.26, 0, -bodyLength * 0.66], {
      rotation: [-Math.PI / 2, 0, 0],
    });
    addMeshPart(group, new THREE.CylinderGeometry(bodySize * 0.17, bodySize * 0.2, 0.28, 10), materials.detail, [bodySize * 0.26, 0, -bodyLength * 0.66], {
      rotation: [-Math.PI / 2, 0, 0],
    });
    applyUnifiedJetProportionLayer();
    addNozzlePetalPair(bodySize * 0.22, 0, -bodyLength * 0.62);
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
    addMeshPart(group, new THREE.CylinderGeometry(bodySize * 0.1, bodySize * 0.18, bodyLength * 0.3, 8), materials.body, [0, 0, bodyLength * 0.38], {
      rotation: [Math.PI / 2, 0, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(bodySize * 0.3, bodySize * 0.22, bodyLength * 0.42), materials.body, [0, 0, bodyLength * 0.02]);
    addMeshPart(group, new THREE.BoxGeometry(bodySize * 0.24, bodySize * 0.18, bodyLength * 0.34), materials.detail, [0, -0.01, -bodyLength * 0.3]);
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
    addCanopyTransition(bodySize * 0.18, bodyLength * 0.46, 0.14, 0.54);
    addMeshPart(group, new THREE.BoxGeometry(0.16, 0.46, 0.36), materials.detail, [0, bodySize * 0.34, -bodyLength * 0.24]);
    addMeshPart(group, new THREE.BoxGeometry(0.12, 0.18, 0.72), materials.detail, [-bodySize * 0.22, -bodySize * 0.14, bodyLength * 0.14], {
      rotation: [0, -0.2, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.12, 0.18, 0.72), materials.detail, [bodySize * 0.22, -bodySize * 0.14, bodyLength * 0.14], {
      rotation: [0, 0.2, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(bodySize * 0.44, 0.08, 1.28), structureMaterial, [-bodySize * 0.24, 0.04, 0.28], {
      rotation: [0, 0.12, 0.04],
    });
    addMeshPart(group, new THREE.BoxGeometry(bodySize * 0.44, 0.08, 1.28), structureMaterial, [bodySize * 0.24, 0.04, 0.28], {
      rotation: [0, -0.12, -0.04],
    });
    addMeshPart(group, new THREE.BoxGeometry(bodySize * 0.16, 0.08, 0.78), materials.wing, [-bodySize * 0.18, 0.04, 0.18], {
      rotation: [0, 0.24, 0.04],
    });
    addMeshPart(group, new THREE.BoxGeometry(bodySize * 0.16, 0.08, 0.78), materials.wing, [bodySize * 0.18, 0.04, 0.18], {
      rotation: [0, -0.24, -0.04],
    });
    addWingRootBlendPair(bodySize * 0.18, 0.04, 0.14, bodySize * 0.16, 0.62, 0.2);
    addMeshPart(group, new THREE.BoxGeometry(0.1, 0.34, 0.54), materials.detail, [0, -bodySize * 0.22, 0.56], {
      rotation: [0.08, 0, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.12, 0.14, 0.5), materials.accent, [-bodySize * 0.3, -0.02, bodyLength * 0.22], {
      rotation: [0, 0.24, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.12, 0.14, 0.5), materials.accent, [bodySize * 0.3, -0.02, bodyLength * 0.22], {
      rotation: [0, -0.24, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.1, 0.12, 0.4), intakeCavityMaterial, [-bodySize * 0.28, -0.01, bodyLength * 0.16], {
      rotation: [0, 0.16, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.1, 0.12, 0.4), intakeCavityMaterial, [bodySize * 0.28, -0.01, bodyLength * 0.16], {
      rotation: [0, -0.16, 0],
    });
    addIntakeLipPair(bodySize * 0.28, 0.01, bodyLength * 0.19, 0.96, 0.72, 0.14);
    addMeshPart(group, new THREE.BoxGeometry(0.18, 0.14, 0.62), weaponMaterial, [0, -bodySize * 0.14, bodyLength * 0.28]);
    addCenterlineStoreAdapter(-bodySize * 0.2, bodyLength * 0.22, 0.48);
    addMeshPart(group, new THREE.BoxGeometry(0.08, 0.22, 0.64), materials.detail, [0, -bodySize * 0.24, -bodyLength * 0.02], {
      rotation: [0.04, 0, 0],
    });
    addWingRootChinePair(bodySize * 0.2, 0.03, bodyLength * 0.02, 0.14, 0.94, 0.2);
    addUndersideRailPair(bodySize * 0.24, -0.12, bodyLength * 0.22, 0.62, 0.18);
    addMeshPart(group, new THREE.BoxGeometry(0.1, 0.12, 0.68), materials.accent, [0, -bodySize * 0.14, bodyLength * 0.5], {
      rotation: [0.03, 0, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.12, 0.1, 0.38), intakeCavityMaterial, [-bodySize * 0.3, -0.06, bodyLength * 0.02], {
      rotation: [0.02, 0.18, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.12, 0.1, 0.38), intakeCavityMaterial, [bodySize * 0.3, -0.06, bodyLength * 0.02], {
      rotation: [0.02, -0.18, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.1, 0.08, 0.48), materials.accent, [-wingSpan * 0.2, -0.08, 0.26], {
      rotation: [0, 0.04, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.1, 0.08, 0.48), materials.accent, [wingSpan * 0.2, -0.08, 0.26], {
      rotation: [0, -0.04, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.08, 0.14, 0.54), materials.detail, [-wingSpan * 0.2, -0.02, 0.26], {
      rotation: [0.08, 0.04, -0.06],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.08, 0.14, 0.54), materials.detail, [wingSpan * 0.2, -0.02, 0.26], {
      rotation: [0.08, -0.04, 0.06],
    });
    addMeshPart(group, new THREE.BoxGeometry(bodySize * 0.14, 0.12, 0.72), materials.accent, [-bodySize * 0.36, -0.04, bodyLength * 0.22], {
      rotation: [0, 0.2, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(bodySize * 0.14, 0.12, 0.72), materials.accent, [bodySize * 0.36, -0.04, bodyLength * 0.22], {
      rotation: [0, -0.2, 0],
    });
    addOutboardRailPair(wingSpan * 0.22, -0.08, 0.26, 0.14, 0.42, 0.06);
    addMeshPart(group, new THREE.CylinderGeometry(bodySize * 0.11, bodySize * 0.14, 0.22, 10), materials.detail, [0, 0, -bodyLength * 0.64], {
      rotation: [-Math.PI / 2, 0, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.14, 0.18, 0.46), materials.detail, [0, -bodySize * 0.24, -bodyLength * 0.14], {
      rotation: [0.04, 0, 0],
    });
    addCenterKeel(0.1, 0.24, 0.68, -bodySize * 0.28, 0.22);
    addTailRootFairingPair(bodySize * 0.16, 0.12, -bodyLength * 0.46, 0.14, 0.14, 0.52, 0.08);
    addMeshPart(group, new THREE.BoxGeometry(0.16, 0.14, 0.5), materials.detail, [-bodySize * 0.18, 0.08, -bodyLength * 0.5], {
      rotation: [0.02, 0.08, 0.03],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.16, 0.14, 0.5), materials.detail, [bodySize * 0.18, 0.08, -bodyLength * 0.5], {
      rotation: [0.02, -0.08, -0.03],
    });
    applyUnifiedJetProportionLayer();
    addMeshPart(group, new THREE.BoxGeometry(0.1, 0.1, 0.5), materials.detail, [0, 0.14, -bodyLength * 0.5], {
      rotation: [0.02, 0, 0],
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
    const isAce = config.type === EnemyType.ACE;
    addMeshPart(group, new THREE.CylinderGeometry(bodySize * 0.18, bodySize * 0.34, bodyLength * 0.3, 8), materials.body, [0, 0, bodyLength * 0.32], {
      rotation: [Math.PI / 2, 0, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(bodySize * 0.58, bodySize * 0.32, bodyLength * 0.38), materials.body, [0, 0.02, bodyLength * 0.04]);
    addMeshPart(group, new THREE.BoxGeometry(bodySize * 0.5, bodySize * 0.26, bodyLength * 0.32), materials.detail, [0, 0, -bodyLength * 0.24]);
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
    addCanopyTransition(bodySize * 0.22, bodyLength * 0.18, 0.2, 0.62);
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
    addMeshPart(group, new THREE.BoxGeometry(bodySize * 0.58, 0.12, 1.04), structureMaterial, [-bodySize * 0.28, 0.06, -bodyLength * 0.08], {
      rotation: [0, 0.14, 0.08],
    });
    addMeshPart(group, new THREE.BoxGeometry(bodySize * 0.58, 0.12, 1.04), structureMaterial, [bodySize * 0.28, 0.06, -bodyLength * 0.08], {
      rotation: [0, -0.14, -0.08],
    });
    addMeshPart(group, new THREE.BoxGeometry(bodySize * 0.22, 0.1, 0.82), materials.wing, [-bodySize * 0.22, 0.05, 0], {
      rotation: [0, 0.22, 0.04],
    });
    addMeshPart(group, new THREE.BoxGeometry(bodySize * 0.22, 0.1, 0.82), materials.wing, [bodySize * 0.22, 0.05, 0], {
      rotation: [0, -0.22, -0.04],
    });
    addWingRootBlendPair(bodySize * 0.26, 0.05, -bodyLength * 0.02, bodySize * 0.24, 0.76, 0.18);
    addMeshPart(group, new THREE.BoxGeometry(0.14, 0.08, 0.44), materials.detail, [-wingSpan * 0.24, -0.08, 0.12], {
      rotation: [0, 0.08, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.14, 0.08, 0.44), materials.detail, [wingSpan * 0.24, -0.08, 0.12], {
      rotation: [0, -0.08, 0],
    });
    addMeshPart(group, new THREE.CylinderGeometry(bodySize * 0.14, bodySize * 0.18, 0.24, 10), materials.detail, [0, 0, -bodyLength * 0.66], {
      rotation: [-Math.PI / 2, 0, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.1, 0.08, 0.38), materials.accent, [-wingSpan * 0.26, -0.08, 0.04], {
      rotation: [0, 0.06, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.1, 0.08, 0.38), materials.accent, [wingSpan * 0.26, -0.08, 0.04], {
      rotation: [0, -0.06, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.08, 0.14, 0.46), materials.detail, [-wingSpan * 0.26, -0.02, 0.04], {
      rotation: [0.08, 0.06, -0.06],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.08, 0.14, 0.46), materials.detail, [wingSpan * 0.26, -0.02, 0.04], {
      rotation: [0.08, -0.06, 0.06],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.16, 0.12, 0.54), materials.detail, [0, -bodySize * 0.18, 0.18]);
    addCenterlineStoreAdapter(-bodySize * 0.22, 0.12, 0.56);
    addMeshPart(group, new THREE.BoxGeometry(0.14, 0.16, 0.56), materials.accent, [-bodySize * 0.42, -0.02, bodyLength * 0.18], {
      rotation: [0, 0.22, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.14, 0.16, 0.56), materials.accent, [bodySize * 0.42, -0.02, bodyLength * 0.18], {
      rotation: [0, -0.22, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.12, 0.14, 0.44), intakeCavityMaterial, [-bodySize * 0.4, -0.01, bodyLength * 0.12], {
      rotation: [0, 0.15, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.12, 0.14, 0.44), intakeCavityMaterial, [bodySize * 0.4, -0.01, bodyLength * 0.12], {
      rotation: [0, -0.15, 0],
    });
    addIntakeLipPair(bodySize * 0.4, 0.02, bodyLength * 0.16, 1.08, 0.8, 0.15);
    addMeshPart(group, new THREE.BoxGeometry(bodySize * 0.2, 0.14, 0.76), materials.accent, [-bodySize * 0.5, -0.02, bodyLength * 0.1], {
      rotation: [0, 0.18, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(bodySize * 0.2, 0.14, 0.76), materials.accent, [bodySize * 0.5, -0.02, bodyLength * 0.1], {
      rotation: [0, -0.18, 0],
    });
    addOutboardRailPair(wingSpan * 0.28, -0.08, 0.06, 0.16, 0.48, 0.06);
    addMeshPart(group, new THREE.BoxGeometry(0.2, 0.18, 0.6), materials.detail, [-bodySize * 0.2, 0.1, -bodyLength * 0.46], {
      rotation: [0.02, 0.08, 0.03],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.2, 0.18, 0.6), materials.detail, [bodySize * 0.2, 0.1, -bodyLength * 0.46], {
      rotation: [0.02, -0.08, -0.03],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.16, 0.22, 0.7), materials.detail, [0, -bodySize * 0.22, -bodyLength * 0.02], {
      rotation: [0.04, 0, 0],
    });
    addWingRootChinePair(bodySize * 0.28, 0.05, -bodyLength * 0.16, 0.2, 1.02, 0.2);
    addUndersideRailPair(bodySize * 0.42, -0.12, bodyLength * 0.1, 0.7, 0.2);
    addCenterKeel(0.12, 0.24, 0.72, -bodySize * 0.28, 0.12);
    addTailRootFairingPair(bodySize * 0.22, 0.12, -bodyLength * 0.42, 0.18, 0.16, 0.58, 0.1);
    addTailplaneRootPair(bodySize * 0.24, 0.1, -bodyLength * 0.28, 0.28);
    addMeshPart(group, new THREE.BoxGeometry(0.18, 0.14, 0.56), materials.detail, [-bodySize * 0.3, 0.12, -bodyLength * 0.44], {
      rotation: [0.03, 0.1, 0.03],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.18, 0.14, 0.56), materials.detail, [bodySize * 0.3, 0.12, -bodyLength * 0.44], {
      rotation: [0.03, -0.1, -0.03],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.12, 0.12, 0.46), intakeCavityMaterial, [-bodySize * 0.44, -0.08, 0.02], {
      rotation: [0.02, 0.18, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.12, 0.12, 0.46), intakeCavityMaterial, [bodySize * 0.44, -0.08, 0.02], {
      rotation: [0.02, -0.18, 0],
    });
    applyUnifiedJetProportionLayer();
    addMeshPart(group, new THREE.ConeGeometry(bodySize * 0.12, 0.68, 8), materials.engine, [0, 0, -bodyLength * 0.58], {
      rotation: [-Math.PI / 2, 0, 0],
      name: 'engineGlow',
      castShadow: false,
    });
    if (isAce) {
      addMeshPart(group, new THREE.BoxGeometry(0.24, 0.14, 0.76), weaponMaterial, [-wingSpan * 0.2, -0.12, -bodyLength * 0.02], {
        rotation: [0.03, 0.08, 0],
      });
      addMeshPart(group, new THREE.BoxGeometry(0.24, 0.14, 0.76), weaponMaterial, [wingSpan * 0.2, -0.12, -bodyLength * 0.02], {
        rotation: [0.03, -0.08, 0],
      });
      addMeshPart(group, new THREE.BoxGeometry(0.16, 0.14, 0.52), energyMaterial, [0, 0.12, -bodyLength * 0.08], {
        castShadow: false,
      });
      addMeshPart(group, new THREE.BoxGeometry(0.1, 0.16, 0.54), materials.detail, [0, 0.18, -bodyLength * 0.36], {
        rotation: [0.02, 0, 0],
      });
    }
    addMeshPart(group, new THREE.BoxGeometry(0.24, 0.08, 0.24), materials.detail, [0, bodySize * 0.04, -bodyLength * 0.46]);
    addMeshPart(group, new THREE.BoxGeometry(0.16, 0.08, 0.3), materials.accent, [-bodySize * 0.42, bodySize * 0.16, -bodyLength * 0.02], {
      rotation: [0, 0.1, 0],
    });
    addMeshPart(group, new THREE.BoxGeometry(0.16, 0.08, 0.3), materials.accent, [bodySize * 0.42, bodySize * 0.16, -bodyLength * 0.02], {
      rotation: [0, -0.1, 0],
    });
  }
  addFuselageSectionBreaks();
  addWingRootTransitionPair(jetProfile.pylonX, jetProfile.pylonY - 0.03, jetProfile.pylonZ + 0.04);
  addPylonAnchorPair(jetProfile.pylonX, jetProfile.pylonY - 0.06, jetProfile.pylonZ + 0.08);
  addTailRootSaddle();
  applyEnemyContourRefinement();

  group.name = config.type;
  return group;
}

/**
 * 创建友军飞机模型 - 与敌机相同但标记为友军
 */
export function createFriendlyMesh(config: EnemyConfig): THREE.Group {
  return createEnemyMesh(config);
}
