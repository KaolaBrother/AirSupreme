/**
 * worldscape/shadermods — 叠加在标准材质上的 onBeforeCompile 小补丁。
 * 从 worldshowcase (src/world/shadermods.js) 移植。
 * 每个变体必须设置显式的 customProgramCacheKey，否则 three.js 可能在
 * 打了不同补丁的材质之间共享同一个已编译程序。
 */
import * as THREE from 'three';

export interface ShaderUniform {
  value: number;
}

export interface SnowWorldYRange {
  /** 雪开始出现的世界 Y */
  start: number;
  /** 雪完全覆盖的世界 Y */
  end: number;
}

const DEFAULT_SNOW_RANGE: SnowWorldYRange = { start: 1, end: 9 };

/**
 * 随 uSnowCover 上升把朝上的表面染白（雪天落定、再融化）。
 * 普通网格与实例化网格皆可用。
 */
export function injectSnowCover(
  material: THREE.Material,
  snowUniform: ShaderUniform,
  cacheKey: string,
  range: SnowWorldYRange = DEFAULT_SNOW_RANGE
): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSnowCover = snowUniform;

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vSnowWorldY;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          #ifdef USE_INSTANCING
            vec4 sw = modelMatrix * instanceMatrix * vec4( transformed, 1.0 );
          #else
            vec4 sw = modelMatrix * vec4( transformed, 1.0 );
          #endif
          vSnowWorldY = sw.y;
        }`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform float uSnowCover;\nvarying float vSnowWorldY;'
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        {
          float snowFacing = smoothstep( 0.45, 0.85, normal.y );
          float snowHeight = smoothstep( ${range.start.toFixed(2)}, ${range.end.toFixed(2)}, vSnowWorldY );
          diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.93, 0.95, 0.975 ),
            uSnowCover * snowFacing * snowHeight );
        }`
      );
  };
  material.customProgramCacheKey = () => `snowcover:${cacheKey}:${range.start}:${range.end}`;
}

/**
 * 让几何体在风中弯曲。amplitude 缩放摆幅；heightRef 是弯曲渐入的
 * 局部高度（草叶或树冠高度）。
 */
export function injectWindSway(
  material: THREE.Material,
  timeUniform: ShaderUniform,
  windUniform: ShaderUniform,
  amplitude: number,
  heightRef: number,
  cacheKey: string
): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = timeUniform;
    shader.uniforms.uWindStrength = windUniform;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uWindTime;
        uniform float uWindStrength;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          #ifdef USE_INSTANCING
            vec2 windSeed = vec2( instanceMatrix[3][0], instanceMatrix[3][2] );
          #else
            vec2 windSeed = vec2( 0.0 );
          #endif
          float bend = pow( clamp( position.y / ${heightRef.toFixed(2)}, 0.0, 1.0 ), 1.5 )
            * uWindStrength * ${amplitude.toFixed(3)};
          float gust = sin( uWindTime * 1.7 + windSeed.x * 0.15 + windSeed.y * 0.12 )
            + 0.5 * sin( uWindTime * 3.1 + windSeed.x * 0.41 );
          transformed.x += gust * bend;
          transformed.z += 0.6 * cos( uWindTime * 1.3 + windSeed.y * 0.23 ) * bend;
        }`
      );
  };
  material.customProgramCacheKey = () => `windsway:${cacheKey}:${amplitude}:${heightRef}`;
}

/** 两个补丁叠加在同一材质上（雪天里摇曳的树冠） */
export function injectSnowAndWind(
  material: THREE.Material,
  snowUniform: ShaderUniform,
  timeUniform: ShaderUniform,
  windUniform: ShaderUniform,
  amplitude: number,
  heightRef: number,
  cacheKey: string,
  range: SnowWorldYRange = DEFAULT_SNOW_RANGE
): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSnowCover = snowUniform;
    shader.uniforms.uWindTime = timeUniform;
    shader.uniforms.uWindStrength = windUniform;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        varying float vSnowWorldY;
        uniform float uWindTime;
        uniform float uWindStrength;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          #ifdef USE_INSTANCING
            vec2 windSeed = vec2( instanceMatrix[3][0], instanceMatrix[3][2] );
          #else
            vec2 windSeed = vec2( 0.0 );
          #endif
          float bend = pow( clamp( position.y / ${heightRef.toFixed(2)}, 0.0, 1.0 ), 1.5 )
            * uWindStrength * ${amplitude.toFixed(3)};
          float gust = sin( uWindTime * 1.7 + windSeed.x * 0.15 + windSeed.y * 0.12 )
            + 0.5 * sin( uWindTime * 3.1 + windSeed.x * 0.41 );
          transformed.x += gust * bend;
          transformed.z += 0.6 * cos( uWindTime * 1.3 + windSeed.y * 0.23 ) * bend;
          #ifdef USE_INSTANCING
            vec4 sw = modelMatrix * instanceMatrix * vec4( transformed, 1.0 );
          #else
            vec4 sw = modelMatrix * vec4( transformed, 1.0 );
          #endif
          vSnowWorldY = sw.y;
        }`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform float uSnowCover;\nvarying float vSnowWorldY;'
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        {
          float snowFacing = smoothstep( 0.35, 0.8, normal.y );
          float snowHeight = smoothstep( ${range.start.toFixed(2)}, ${range.end.toFixed(2)}, vSnowWorldY );
          diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.91, 0.94, 0.965 ),
            uSnowCover * snowFacing * snowHeight * 0.85 );
        }`
      );
  };
  material.customProgramCacheKey = () =>
    `snowwind:${cacheKey}:${amplitude}:${heightRef}:${range.start}:${range.end}`;
}
