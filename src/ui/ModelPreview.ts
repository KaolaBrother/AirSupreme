import * as THREE from 'three';
import { EnemyType, ENEMY_CONFIGS } from '@/features/enemy/EnemyTypes';
import { BossType, BOSS_CONFIGS } from '@/features/boss/BossTypes';
import { createBossMesh } from '@/features/boss/BossAI';

interface AircraftInfo {
  id: string;
  name: string;
  type: 'player' | 'enemy' | 'boss';
  createMesh: () => THREE.Group;
}

export class ModelPreview {
  private container: HTMLDivElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private currentMesh: THREE.Group | null = null;
  private currentIndex: number = 0;
  private aircrafts: AircraftInfo[] = [];
  private animationId: number = 0;
  private autoRotate: boolean = true;
  private nameDisplay: HTMLDivElement;
  private onBack?: () => void;

  constructor() {
    this.container = this.createContainer();
    this.container.style.display = 'none';
    document.body.appendChild(this.container);

    this.nameDisplay = this.createNameDisplay();

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);

    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    this.camera.position.set(0, 2, 8);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;

    this.setupLighting();
    this.setupAircrafts();
    this.setupControls();

    window.addEventListener('resize', () => this.resizeRenderer());
  }

  private createContainer(): HTMLDivElement {
    const container = document.createElement('div');
    container.id = 'model-preview';
    container.innerHTML = `
      <style>
        #model-preview {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          z-index: 1001;
          font-family: 'Arial', sans-serif;
          color: white;
        }

        .preview-header {
          font-size: 36px;
          font-weight: bold;
          margin-bottom: 20px;
          text-shadow: 0 0 15px rgba(100, 200, 255, 0.8);
        }

        .preview-canvas-container {
          position: relative;
          width: 80%;
          max-width: 600px;
          height: 400px;
          border-radius: 15px;
          overflow: hidden;
          border: 2px solid rgba(255, 255, 255, 0.2);
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
        }

        .aircraft-name {
          position: absolute;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 24px;
          font-weight: bold;
          text-shadow: 0 2px 10px rgba(0, 0, 0, 0.8);
          background: rgba(0, 0, 0, 0.5);
          padding: 10px 30px;
          border-radius: 25px;
        }

        .nav-controls {
          display: flex;
          align-items: center;
          gap: 20px;
          margin-top: 30px;
        }

        .nav-btn {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          border: 2px solid rgba(255, 255, 255, 0.5);
          background: rgba(255, 255, 255, 0.1);
          color: white;
          font-size: 28px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .nav-btn:hover {
          background: rgba(255, 255, 255, 0.3);
          transform: scale(1.1);
        }

        .page-indicator {
          font-size: 18px;
          min-width: 100px;
          text-align: center;
        }

        .back-btn {
          margin-top: 30px;
          padding: 15px 40px;
          font-size: 20px;
          font-weight: bold;
          border: none;
          border-radius: 30px;
          background: linear-gradient(135deg, #4CAF50, #45a049);
          color: white;
          cursor: pointer;
          transition: all 0.3s;
          box-shadow: 0 5px 15px rgba(76, 175, 80, 0.4);
        }

        .back-btn:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 25px rgba(76, 175, 80, 0.6);
        }

        .touch-hint {
          margin-top: 15px;
          font-size: 14px;
          opacity: 0.7;
        }

        .rotate-toggle {
          margin-top: 15px;
          padding: 10px 25px;
          font-size: 16px;
          border: 1px solid rgba(255, 255, 255, 0.3);
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.1);
          color: white;
          cursor: pointer;
          transition: all 0.2s;
        }

        .rotate-toggle:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      </style>

      <div class="preview-header">✈️ 飞机模型预览</div>
      <div class="preview-canvas-container" id="canvas-container"></div>
      <div class="nav-controls">
        <button class="nav-btn" id="prev-btn">◀</button>
        <div class="page-indicator" id="page-indicator">1 / 7</div>
        <button class="nav-btn" id="next-btn">▶</button>
      </div>
      <button class="rotate-toggle" id="rotate-toggle">🔄 自动旋转: 开</button>
      <div class="touch-hint">💡 滑动屏幕切换模型 / 拖拽旋转</div>
      <button class="back-btn" id="back-btn">← 返回主菜单</button>
    `;

    return container;
  }

  private createNameDisplay(): HTMLDivElement {
    const display = document.createElement('div');
    display.className = 'aircraft-name';
    display.id = 'aircraft-name';
    return display;
  }

  private setupLighting(): void {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    this.scene.add(directionalLight);

    const backLight = new THREE.DirectionalLight(0x6688ff, 0.5);
    backLight.position.set(-5, 5, -5);
    this.scene.add(backLight);
  }

  private setupAircrafts(): void {
    // 玩家飞机
    this.aircrafts.push({
      id: 'player',
      name: '玩家飞机',
      type: 'player',
      createMesh: () => this.createPlayerMesh(),
    });

    // 敌机
    const enemyTypes = Object.values(EnemyType);
    for (const type of enemyTypes) {
      const config = ENEMY_CONFIGS[type];
      this.aircrafts.push({
        id: type,
        name: config.name,
        type: 'enemy',
        createMesh: () => this.createEnemyMesh(config),
      });
    }

    // Boss
    const bossTypes = Object.values(BossType);
    for (const type of bossTypes) {
      const config = BOSS_CONFIGS[type];
      this.aircrafts.push({
        id: type,
        name: config.name,
        type: 'boss',
        createMesh: () => createBossMesh(config),
      });
    }
  }

  private createPlayerMesh(): THREE.Group {
    const group = new THREE.Group();

    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x4488ff,
      metalness: 0.7,
      roughness: 0.2,
    });

    const bodyGeometry = new THREE.ConeGeometry(0.5, 3.5, 12);
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.rotation.x = Math.PI / 2;
    group.add(body);

    const cockpitMaterial = new THREE.MeshStandardMaterial({
      color: 0x111133,
      metalness: 0.9,
      roughness: 0.1,
    });
    const cockpitGeometry = new THREE.SphereGeometry(0.3, 12, 12);
    const cockpit = new THREE.Mesh(cockpitGeometry, cockpitMaterial);
    cockpit.position.set(0, 0.3, -0.5);
    cockpit.scale.set(1, 0.6, 1.5);
    group.add(cockpit);

    const wingMaterial = new THREE.MeshStandardMaterial({
      color: 0x3366dd,
      metalness: 0.6,
      roughness: 0.3,
    });

    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.lineTo(2, 0.8);
    wingShape.lineTo(0.3, 1);
    wingShape.lineTo(0, 0);

    const wingGeometry = new THREE.ExtrudeGeometry(wingShape, { depth: 0.05, bevelEnabled: false });

    const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
    leftWing.rotation.x = Math.PI / 2;
    leftWing.rotation.z = Math.PI;
    leftWing.position.set(-0.3, 0, 0.3);
    group.add(leftWing);

    const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
    rightWing.rotation.x = Math.PI / 2;
    rightWing.position.set(0.3, 0, 0.3);
    group.add(rightWing);

    const tailGeometry = new THREE.BoxGeometry(0.05, 0.8, 0.6);
    const tail = new THREE.Mesh(tailGeometry, wingMaterial);
    tail.position.set(0, 0.5, 1.5);
    group.add(tail);

    return group;
  }

  private createEnemyMesh(config: (typeof ENEMY_CONFIGS)[EnemyType]): THREE.Group {
    const group = new THREE.Group();

    let bodyColor = config.color;
    let wingColor = config.color;
    let accentColor = config.color;
    let bodySize = 1.6;
    let bodyLength = 6;
    let wingSpan = 3;
    const tailSize = 0.8;
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
    }

    group.scale.set(scaleMultiplier, scaleMultiplier, scaleMultiplier);

    const bodyGeometry = new THREE.ConeGeometry(bodySize * 0.4, bodyLength, 8);
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: bodyColor,
      metalness: 0.7,
      roughness: 0.3,
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.rotation.x = Math.PI / 2;
    group.add(body);

    const wingGeometry = new THREE.BoxGeometry(wingSpan, 0.15, 1.2);
    const wingMaterial = new THREE.MeshStandardMaterial({
      color: wingColor,
      metalness: 0.6,
      roughness: 0.4,
    });
    const wings = new THREE.Mesh(wingGeometry, wingMaterial);
    wings.position.set(0, 0, bodyLength * 0.2);
    group.add(wings);

    const cockpitGeometry = new THREE.SphereGeometry(bodySize * 0.35, 8, 8);
    const cockpitMaterial = new THREE.MeshStandardMaterial({
      color: accentColor,
      metalness: 0.9,
      roughness: 0.1,
      emissive: accentColor,
      emissiveIntensity: 0.3,
    });
    const cockpit = new THREE.Mesh(cockpitGeometry, cockpitMaterial);
    cockpit.position.set(0, bodySize * 0.25, -bodyLength * 0.2);
    group.add(cockpit);

    const tailGeometry = new THREE.BoxGeometry(tailSize, 0.12, 1);
    const tail = new THREE.Mesh(tailGeometry, wingMaterial);
    tail.position.set(0, 0, bodyLength * 0.45);
    group.add(tail);

    const vStabGeometry = new THREE.BoxGeometry(0.15, 1.2, 0.8);
    const vStab = new THREE.Mesh(vStabGeometry, wingMaterial);
    vStab.position.set(0, 0.6, bodyLength * 0.4);
    group.add(vStab);

    return group;
  }

  private setupControls(): void {
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const backBtn = document.getElementById('back-btn');
    const rotateToggle = document.getElementById('rotate-toggle');
    const canvasContainer = document.getElementById('canvas-container');

    prevBtn?.addEventListener('click', () => this.showPrevious());
    nextBtn?.addEventListener('click', () => this.showNext());
    backBtn?.addEventListener('click', () => this.hide());
    rotateToggle?.addEventListener('click', () => {
      this.autoRotate = !this.autoRotate;
      if (rotateToggle) {
        rotateToggle.textContent = `🔄 自动旋转: ${this.autoRotate ? '开' : '关'}`;
      }
    });

    let touchStartX = 0;
    canvasContainer?.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
    });

    canvasContainer?.addEventListener('touchend', (e) => {
      const touchEndX = e.changedTouches[0].clientX;
      const diff = touchStartX - touchEndX;
      if (Math.abs(diff) > 50) {
        if (diff > 0) {
          this.showNext();
        } else {
          this.showPrevious();
        }
      }
    });

    let isDragging = false;
    let previousMouseX = 0;

    canvasContainer?.addEventListener('mousedown', (e) => {
      isDragging = true;
      previousMouseX = e.clientX;
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
    });

    document.addEventListener('mousemove', (e) => {
      if (isDragging && this.currentMesh) {
        const deltaX = e.clientX - previousMouseX;
        this.currentMesh.rotation.y += deltaX * 0.01;
        previousMouseX = e.clientX;
      }
    });

    if (canvasContainer) {
      canvasContainer.appendChild(this.renderer.domElement);
      canvasContainer.appendChild(this.nameDisplay);
    }
  }

  private resizeRenderer(): void {
    const canvasContainer = document.getElementById('canvas-container');
    if (canvasContainer) {
      const width = canvasContainer.clientWidth;
      const height = canvasContainer.clientHeight;
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    }
  }

  private showAircraft(index: number): void {
    if (this.currentMesh) {
      this.scene.remove(this.currentMesh);
    }

    this.currentIndex = index;
    const aircraft = this.aircrafts[index];
    this.currentMesh = aircraft.createMesh();

    // 根据飞机类型调整缩放
    const scale = aircraft.type === 'boss' ? 0.3 : 0.8;
    this.currentMesh.scale.set(scale, scale, scale);

    this.scene.add(this.currentMesh);

    // 更新显示
    this.nameDisplay.textContent = aircraft.name;
    const indicator = document.getElementById('page-indicator');
    if (indicator) {
      indicator.textContent = `${index + 1} / ${this.aircrafts.length}`;
    }
  }

  private showNext(): void {
    const nextIndex = (this.currentIndex + 1) % this.aircrafts.length;
    this.showAircraft(nextIndex);
  }

  private showPrevious(): void {
    const prevIndex = (this.currentIndex - 1 + this.aircrafts.length) % this.aircrafts.length;
    this.showAircraft(prevIndex);
  }

  private animate = (): void => {
    this.animationId = requestAnimationFrame(this.animate);

    if (this.currentMesh && this.autoRotate) {
      this.currentMesh.rotation.y += 0.01;
    }

    this.renderer.render(this.scene, this.camera);
  };

  public setOnBack(callback: () => void): void {
    this.onBack = callback;
  }

  public show(): void {
    this.container.style.display = 'flex';
    this.showAircraft(0);
    requestAnimationFrame(() => {
      this.resizeRenderer();
      this.animate();
    });
  }

  public hide(): void {
    this.container.style.display = 'none';
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    this.onBack?.();
  }

  public dispose(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    this.renderer.dispose();
    this.container.remove();
  }
}
