/**
 * 冰体着色：在 MeshStandardMaterial 上注入
 * - 崖壁半透明感：水线附近更亮的次表面蓝光 + 菲涅尔青色边缘光；
 * - 压缩冰层的水平条纹；
 * - 顶面积雪的风蚀雪垄（sastrugi）明暗。
 * 支持普通网格与实例化网格（浮冰）。
 */
import * as THREE from 'three';
import { GLSL_NOISE } from './envKit';

export interface IceMaterialOptions {
  waterY: number;
  /** 次表面辉光色（冰川蓝） */
  glow?: THREE.ColorRepresentation;
  /** 掠射角边缘光色（极光青） */
  rim?: THREE.ColorRepresentation;
  flatShading?: boolean;
  cacheKey: string;
}

export function createIceMaterial(options: IceMaterialOptions): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.32,
    metalness: 0.02,
    flatShading: options.flatShading ?? true,
  });
  const glow = new THREE.Color(options.glow ?? 0x1f7fb8);
  const rim = new THREE.Color(options.rim ?? 0x7ff0e0);
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uIceGlow = { value: glow };
    shader.uniforms.uIceRim = { value: rim };
    shader.uniforms.uIceWaterY = { value: options.waterY };
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vIceWorld;
        varying vec3 vIceNormal;`
      )
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        {
          vec4 iceWorld = vec4(transformed, 1.0);
          vec3 iceNormal = objectNormal;
          #ifdef USE_INSTANCING
            iceWorld = instanceMatrix * iceWorld;
            iceNormal = mat3(instanceMatrix) * iceNormal;
          #endif
          vIceWorld = (modelMatrix * iceWorld).xyz;
          vIceNormal = normalize(mat3(modelMatrix) * iceNormal);
        }`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform vec3 uIceGlow;
        uniform vec3 uIceRim;
        uniform float uIceWaterY;
        varying vec3 vIceWorld;
        varying vec3 vIceNormal;
        ${GLSL_NOISE}`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          vec3 iceN = normalize(vIceNormal);
          float wall = 1.0 - smoothstep(0.5, 0.8, iceN.y);
          float bands = 0.5 + 0.5 * sin(vIceWorld.y * 0.85 + envNoise(vIceWorld.xz * 0.04) * 6.0);
          diffuseColor.rgb *= mix(1.0, 0.8 + 0.2 * bands, wall);
          float top = smoothstep(0.82, 0.95, iceN.y);
          float sastrugi = envNoise(vec2(vIceWorld.x * 0.012, vIceWorld.z * 0.07));
          diffuseColor.rgb *= mix(1.0, 0.84 + 0.16 * sastrugi, top);
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.86, 0.93, 1.05), top * (1.0 - sastrugi) * 0.5);
        }`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          vec3 iceN = normalize(vIceNormal);
          vec3 iceV = normalize(cameraPosition - vIceWorld);
          float wall = 1.0 - smoothstep(0.5, 0.8, iceN.y);
          float fresnel = pow(1.0 - abs(dot(iceN, iceV)), 3.0);
          float waterline = 1.0 - smoothstep(uIceWaterY, uIceWaterY + 22.0, vIceWorld.y);
          float bands = 0.5 + 0.5 * sin(vIceWorld.y * 0.85 + envNoise(vIceWorld.xz * 0.04) * 6.0);
          totalEmissiveRadiance += uIceGlow * wall * (0.12 + 0.3 * waterline + 0.08 * bands);
          totalEmissiveRadiance += uIceRim * fresnel * (0.18 + 0.4 * wall);
        }`
      );
  };
  material.customProgramCacheKey = () => `arctic-ice:${options.cacheKey}`;
  return material;
}
