import * as THREE from 'three';
import { EnemyType, ENEMY_CONFIGS } from '@/features/enemy/EnemyTypes';
import { BossType, BOSS_CONFIGS, BOSS_MISSILE_CONFIG } from '@/features/boss/BossTypes';

interface AircraftMeshFactoryModule {
  createPlayerMesh: () => THREE.Group;
  createEnemyMesh: (config: (typeof ENEMY_CONFIGS)[EnemyType]) => THREE.Group;
}

interface AircraftInfo {
  id: string;
  name: string;
  type: 'player' | 'enemy' | 'boss' | 'missile';
  createMesh: () => THREE.Group | Promise<THREE.Group>;
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
  private resizeHandler!: () => void;
  private meshLoadSequence: number = 0;
  private aircraftMeshFactoryPromise: Promise<AircraftMeshFactoryModule> | null = null;

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

    this.resizeHandler = () => this.resizeRenderer();
    window.addEventListener('resize', this.resizeHandler);
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
        <div class="page-indicator" id="page-indicator">1 / 9</div>
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
    // 玩家飞机 - 使用工厂函数
    this.aircrafts.push({
      id: 'player',
      name: '玩家飞机',
      type: 'player',
      createMesh: async () => {
        const { createPlayerMesh } = await this.loadAircraftMeshFactory();
        return createPlayerMesh();
      },
    });

    // 敌机 - 使用工厂函数
    const enemyTypes = Object.values(EnemyType);
    for (const type of enemyTypes) {
      const config = ENEMY_CONFIGS[type];
      this.aircrafts.push({
        id: type,
        name: config.name,
        type: 'enemy',
        createMesh: async () => {
          const { createEnemyMesh } = await this.loadAircraftMeshFactory();
          return createEnemyMesh(config);
        },
      });
    }

    // Boss
    const bossTypes = Object.values(BossType);
    for (const type of bossTypes) {
      const config = BOSS_CONFIGS[type];
      if (type === BossType.DESERT_FORTRESS) {
        this.aircrafts.push({
          id: type,
          name: config.name,
          type: 'boss',
          createMesh: async () => {
            const module = await import('@/features/boss/DesertFortressAI');
            return module.createDesertFortressMesh(config);
          },
        });
      } else if (type === BossType.OCTOPUS_WARSHIP) {
        this.aircrafts.push({
          id: type,
          name: config.name,
          type: 'boss',
          createMesh: async () => {
            const module = await import('@/features/boss/OctopusWarshipAI');
            return module.createOctopusWarshipMesh(config);
          },
        });
      } else if (type === BossType.MISSILE_DESTROYER) {
        this.aircrafts.push({
          id: type,
          name: config.name,
          type: 'boss',
          createMesh: async () => {
            const module = await import('@/features/boss/MissileDestroyerAI');
            return module.createMissileDestroyerMesh(config);
          },
        });
      } else if (type === BossType.SKY_CARRIER) {
        this.aircrafts.push({
          id: type,
          name: config.name,
          type: 'boss',
          createMesh: async () => {
            const module = await import('@/features/boss/SkyCarrierAI');
            return module.createSkyCarrierMesh(config);
          },
        });
      } else {
        this.aircrafts.push({
          id: type,
          name: config.name,
          type: 'boss',
          createMesh: async () => {
            const module = await import('@/features/boss/BossAI');
            return module.createBossMesh(config);
          },
        });
      }
    }

    this.aircrafts.push({
      id: 'boss_missile',
      name: 'Boss 导弹',
      type: 'missile',
      createMesh: () => this.createBossMissileMesh(),
    });
  }

  private loadAircraftMeshFactory(): Promise<AircraftMeshFactoryModule> {
    if (!this.aircraftMeshFactoryPromise) {
      this.aircraftMeshFactoryPromise = import('@/features/aircraft/AircraftMeshFactory');
    }

    return this.aircraftMeshFactoryPromise;
  }

  private createBossMissileMesh(): THREE.Group {
    const group = new THREE.Group();
    const scale = BOSS_MISSILE_CONFIG.SCALE;

    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x8b0000,
      metalness: 0.7,
      roughness: 0.3,
    });

    const noseMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      metalness: 0.9,
      roughness: 0.2,
    });

    const finMaterial = new THREE.MeshStandardMaterial({
      color: 0x2a2a2a,
      metalness: 0.8,
      roughness: 0.3,
    });

    const bodyLength = 2.0 * scale;
    const bodyRadius = 0.35 * scale;

    const bodyGeometry = new THREE.CylinderGeometry(bodyRadius * 0.8, bodyRadius, bodyLength, 12);
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.rotation.x = Math.PI / 2;
    body.position.z = bodyLength * 0.1;
    group.add(body);

    const noseGeometry = new THREE.ConeGeometry(bodyRadius * 0.8, bodyLength * 0.6, 12);
    const nose = new THREE.Mesh(noseGeometry, noseMaterial);
    nose.rotation.x = Math.PI / 2;
    nose.position.z = bodyLength * 0.7;
    group.add(nose);

    const finCount = 4;
    const finLength = bodyLength * 0.4;
    const finHeight = bodyRadius * 1.0;

    for (let i = 0; i < finCount; i++) {
      const angle = (i / finCount) * Math.PI * 2;

      const finGeometry = new THREE.BoxGeometry(0.1 * scale, finHeight, finLength);
      const fin = new THREE.Mesh(finGeometry, finMaterial);

      fin.position.x = Math.cos(angle) * (bodyRadius + finHeight * 0.5);
      fin.position.y = Math.sin(angle) * (bodyRadius + finHeight * 0.5);
      fin.position.z = -bodyLength * 0.3;

      fin.rotation.z = angle;

      group.add(fin);
    }

    const ringGeometry = new THREE.TorusGeometry(bodyRadius * 1.1, 0.05 * scale, 8, 16);
    const ringMaterial = new THREE.MeshStandardMaterial({
      color: 0xffaa00,
      emissive: 0xff6600,
      emissiveIntensity: 0.5,
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.position.z = -bodyLength * 0.1;
    group.add(ring);

    const thrustGeometry = new THREE.ConeGeometry(bodyRadius * 0.6, bodyLength * 0.8, 8);
    const thrustMaterial = new THREE.MeshBasicMaterial({
      color: 0xff4400,
      transparent: true,
      opacity: 0.9,
    });
    const thrust = new THREE.Mesh(thrustGeometry, thrustMaterial);
    thrust.rotation.x = Math.PI / 2;
    thrust.position.z = -bodyLength * 0.7;
    group.add(thrust);

    const innerThrustGeometry = new THREE.ConeGeometry(bodyRadius * 0.3, bodyLength * 0.5, 8);
    const innerThrustMaterial = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 1,
    });
    const innerThrust = new THREE.Mesh(innerThrustGeometry, innerThrustMaterial);
    innerThrust.rotation.x = Math.PI / 2;
    innerThrust.position.z = -bodyLength * 0.5;
    group.add(innerThrust);

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

  private async showAircraft(index: number): Promise<void> {
    this.disposeCurrentMesh();
    const loadSequence = ++this.meshLoadSequence;

    this.currentIndex = index;
    const aircraft = this.aircrafts[index];
    this.nameDisplay.textContent = `加载中: ${aircraft.name}`;
    const indicator = document.getElementById('page-indicator');
    if (indicator) {
      indicator.textContent = `${index + 1} / ${this.aircrafts.length}`;
    }

    const mesh = await aircraft.createMesh();
    if (loadSequence !== this.meshLoadSequence || this.container.style.display === 'none') {
      mesh.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          if (Array.isArray(object.material)) {
            object.material.forEach((material) => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
      return;
    }

    this.currentMesh = mesh;

    let scale: number;
    if (aircraft.type === 'boss') {
      scale = 0.3;
    } else if (aircraft.type === 'missile') {
      scale = 0.15;
    } else {
      scale = 0.8;
    }
    this.currentMesh.scale.set(scale, scale, scale);

    this.scene.add(this.currentMesh);

    this.nameDisplay.textContent = aircraft.name;
  }

  private disposeCurrentMesh(): void {
    if (!this.currentMesh) {
      return;
    }

    this.scene.remove(this.currentMesh);
    this.currentMesh.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        if (Array.isArray(object.material)) {
          object.material.forEach((material) => material.dispose());
        } else {
          object.material.dispose();
        }
      }
    });
    this.currentMesh = null;
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
    void this.showAircraft(0);
    requestAnimationFrame(() => {
      this.resizeRenderer();
      this.animate();
    });
  }

  public hide(): void {
    this.container.style.display = 'none';
    this.meshLoadSequence++;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    this.disposeCurrentMesh();
    this.onBack?.();
  }

  public dispose(): void {
    this.meshLoadSequence++;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    window.removeEventListener('resize', this.resizeHandler);
    this.disposeCurrentMesh();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.container.remove();
  }
}
