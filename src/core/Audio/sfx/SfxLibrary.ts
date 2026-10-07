/**
 * 新增音效库：特殊武器、敌方单位、环境、界面与叙事音效。
 * 每个函数在 target.t 处调度一组分层声部并返回结束时间；电平以 target.level（音效音量）缩放。
 * 响度按离线测量配平：武器 / 爆炸最响，警报居中，界面音最轻。
 */
import {
  beginSustained,
  commitSustained,
  fm,
  noise,
  tone,
  type SfxTarget,
  type SustainedSfx,
} from './SfxKit';

export type UnitDomain = 'ground' | 'sea' | 'air';
export type ImpactSurface = 'lava' | 'ice' | 'rock' | 'cloud';

function maxEnd(...ends: number[]): number {
  return Math.max(...ends);
}

const crackleCache = new WeakMap<BaseAudioContext, AudioBuffer>();

/** 电弧噼啪：稀疏的随机尖脉冲叠在低噪声上（每个上下文生成一次，0.5 秒循环） */
function getCrackleBuffer(ctx: BaseAudioContext, random: () => number): AudioBuffer {
  const cached = crackleCache.get(ctx);
  if (cached) {
    return cached;
  }
  const sampleRate = ctx.sampleRate > 0 ? ctx.sampleRate : 44100;
  const buffer = ctx.createBuffer(1, Math.max(1, Math.floor(sampleRate * 0.5)), sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = random() < 0.02 ? (random() * 2 - 1) * 0.9 : (random() * 2 - 1) * 0.08;
  }
  crackleCache.set(ctx, buffer);
  return buffer;
}

// ==================== 特殊武器 ====================

/** 火箭齐射：六枚火箭错落点火（点火闷响 + “嘶”的尾焰 + 电机噼啪），尾部低沉轰鸣 */
export function renderRocketSalvo(s: SfxTarget): number {
  let end = s.t;
  for (let i = 0; i < 6; i++) {
    const at = i * 0.05 + s.random() * 0.012;
    const pitch = 0.9 + s.random() * 0.2;
    const pan = i % 2 === 0 ? -0.3 : 0.3;
    end = maxEnd(
      end,
      tone(s, { at, freq: 150 * pitch, freqEnd: 52, attack: 0.003, decay: 0.16, peak: 0.24 }),
      noise(s, {
        at,
        filter: { type: 'bandpass', freq: 3400 * pitch, freqEnd: 900, q: 1.1 },
        attack: 0.006,
        decay: 0.32,
        peak: 0.2,
        pan,
      }),
      tone(s, {
        at,
        type: 'sawtooth',
        freq: 640 * pitch,
        freqEnd: 240,
        attack: 0.002,
        decay: 0.07,
        peak: 0.05,
        filter: { type: 'lowpass', freq: 2400 },
      })
    );
  }
  return maxEnd(
    end,
    noise(s, {
      at: 0.05,
      color: 'brown',
      filter: { type: 'lowpass', freq: 520, freqEnd: 180 },
      attack: 0.05,
      decay: 0.7,
      peak: 0.18,
    })
  );
}

/** 激光点火：上扫的锯齿 + 高频嘶声，随后进入持续嗡鸣（返回控制柄，playLaserStop 结束） */
export function startLaserBeam(s: SfxTarget): SustainedSfx {
  tone(s, {
    type: 'sawtooth',
    freq: 180,
    freqEnd: 1400,
    glide: 0.18,
    attack: 0.01,
    decay: 0.26,
    peak: 0.12,
    filter: { type: 'bandpass', freq: 900, freqEnd: 2600, q: 2 },
  });
  noise(s, {
    filter: { type: 'highpass', freq: 2500, freqEnd: 6500 },
    attack: 0.02,
    decay: 0.22,
    peak: 0.08,
  });
  const ctx = s.ctx;
  const start = s.t + 0.06;
  const beam = beginSustained({ ...s, t: start }, 0.12, 1);
  const hum = ctx.createGain();
  hum.gain.value = 0.08;
  const body = ctx.createBiquadFilter();
  body.type = 'bandpass';
  body.frequency.value = 1150;
  body.Q.value = 2.4;
  const oscA = ctx.createOscillator();
  const oscB = ctx.createOscillator();
  oscA.type = 'sawtooth';
  oscB.type = 'sawtooth';
  oscA.frequency.setValueAtTime(220, start);
  oscB.frequency.setValueAtTime(222.6, start);
  oscA.connect(body);
  oscB.connect(body);
  body.connect(hum);
  hum.connect(beam.bus);
  // 振幅抖动（光束的“颤动”）
  const wobble = ctx.createOscillator();
  wobble.frequency.value = 31;
  const wobbleDepth = ctx.createGain();
  wobbleDepth.gain.value = 0.03;
  wobble.connect(wobbleDepth);
  wobbleDepth.connect(hum.gain);
  // 低频支撑
  const sub = ctx.createOscillator();
  sub.frequency.setValueAtTime(110, start);
  const subGain = ctx.createGain();
  subGain.gain.value = 0.07;
  sub.connect(subGain);
  subGain.connect(beam.bus);
  // 电弧噼啪
  const crackle = ctx.createBufferSource();
  crackle.buffer = getCrackleBuffer(ctx, s.random);
  crackle.loop = true;
  const crackleFilter = ctx.createBiquadFilter();
  crackleFilter.type = 'highpass';
  crackleFilter.frequency.value = 3800;
  const crackleGain = ctx.createGain();
  crackleGain.gain.value = 0.09;
  crackle.connect(crackleFilter);
  crackleFilter.connect(crackleGain);
  crackleGain.connect(beam.bus);
  beam.sources.push(oscA, oscB, wobble, sub, crackle);
  beam.nodes.push(
    hum,
    body,
    oscA,
    oscB,
    wobble,
    wobbleDepth,
    sub,
    subGain,
    crackle,
    crackleFilter,
    crackleGain
  );
  return commitSustained(beam, start, (now, fade) => {
    // 关断时音高下坠
    oscA.frequency.setTargetAtTime(90, now, fade / 3);
    oscB.frequency.setTargetAtTime(92, now, fade / 3);
    sub.frequency.setTargetAtTime(55, now, fade / 3);
  });
}

/** 激光关断：下坠的余音 + 轻微“叮” */
export function renderLaserStop(s: SfxTarget): number {
  return maxEnd(
    tone(s, {
      type: 'sawtooth',
      freq: 900,
      freqEnd: 120,
      attack: 0.004,
      decay: 0.26,
      peak: 0.06,
      filter: { type: 'lowpass', freq: 2200, freqEnd: 300 },
    }),
    tone(s, { freq: 2400, attack: 0.002, decay: 0.12, peak: 0.025, at: 0.02 })
  );
}

/** 激光过热：蒸汽泄压嘶声 + 两声下行警示 + 金属冷却“叮” */
export function renderLaserOverheat(s: SfxTarget): number {
  return maxEnd(
    noise(s, {
      filter: { type: 'highpass', freq: 2600, freqEnd: 1400, q: 0.7 },
      attack: 0.02,
      hold: 0.25,
      decay: 0.8,
      peak: 0.12,
    }),
    tone(s, {
      type: 'square',
      freq: 1250,
      freqEnd: 980,
      attack: 0.004,
      hold: 0.08,
      decay: 0.05,
      peak: 0.045,
      filter: { type: 'lowpass', freq: 3000 },
    }),
    tone(s, {
      at: 0.17,
      type: 'square',
      freq: 1000,
      freqEnd: 760,
      attack: 0.004,
      hold: 0.1,
      decay: 0.08,
      peak: 0.045,
      filter: { type: 'lowpass', freq: 3000 },
    }),
    fm(s, { at: 0.45, freq: 1760, ratio: 2.76, index: 1.2, decay: 0.6, peak: 0.03 })
  );
}

/** 电磁炮蓄力：逐渐升高的电容啸叫，震音越来越快；蓄满后带颤动保持，直到发射或取消 */
export function startRailgunCharge(s: SfxTarget, chargeSeconds = 1.2): SustainedSfx {
  const ctx = s.ctx;
  const start = s.t;
  const top = start + Math.max(0.3, chargeSeconds);
  const charge = beginSustained(s, 0.05, 1);
  const whine = ctx.createOscillator();
  whine.type = 'sine';
  whine.frequency.setValueAtTime(160, start);
  whine.frequency.exponentialRampToValueAtTime(2600, top);
  const whineGain = ctx.createGain();
  whineGain.gain.setValueAtTime(0.03, start);
  whineGain.gain.linearRampToValueAtTime(0.07, top);
  whine.connect(whineGain);
  whineGain.connect(charge.bus);
  const buzz = ctx.createOscillator();
  buzz.type = 'square';
  buzz.frequency.setValueAtTime(80, start);
  buzz.frequency.exponentialRampToValueAtTime(1300, top);
  const buzzFilter = ctx.createBiquadFilter();
  buzzFilter.type = 'lowpass';
  buzzFilter.frequency.setValueAtTime(600, start);
  buzzFilter.frequency.exponentialRampToValueAtTime(4200, top);
  const buzzGain = ctx.createGain();
  buzzGain.gain.setValueAtTime(0.02, start);
  buzzGain.gain.linearRampToValueAtTime(0.04, top);
  buzz.connect(buzzFilter);
  buzzFilter.connect(buzzGain);
  buzzGain.connect(charge.bus);
  // 震音速度从 6Hz 加快到 28Hz
  const flutter = ctx.createOscillator();
  flutter.frequency.setValueAtTime(6, start);
  flutter.frequency.linearRampToValueAtTime(28, top);
  const flutterDepth = ctx.createGain();
  flutterDepth.gain.value = 0.025;
  flutter.connect(flutterDepth);
  flutterDepth.connect(whineGain.gain);
  // 蓄满后的音高颤动
  const shimmer = ctx.createOscillator();
  shimmer.frequency.value = 9;
  const shimmerDepth = ctx.createGain();
  shimmerDepth.gain.setValueAtTime(0, start);
  shimmerDepth.gain.setValueAtTime(0, top);
  shimmerDepth.gain.linearRampToValueAtTime(40, top + 0.15);
  shimmer.connect(shimmerDepth);
  shimmerDepth.connect(whine.frequency);
  charge.sources.push(whine, buzz, flutter, shimmer);
  charge.nodes.push(
    whine,
    whineGain,
    buzz,
    buzzFilter,
    buzzGain,
    flutter,
    flutterDepth,
    shimmer,
    shimmerDepth
  );
  // 上扬的空气声
  noise(s, {
    filter: { type: 'bandpass', freq: 400, freqEnd: 5200, q: 1.4, sweep: chargeSeconds },
    attack: Math.max(0.2, chargeSeconds * 0.9),
    decay: 0.25,
    peak: 0.05,
  });
  return commitSustained(charge, start);
}

/** 蓄力取消：啸叫掉落 + 放电“咔哒” */
export function renderRailgunChargeCancel(s: SfxTarget): number {
  return maxEnd(
    tone(s, { freq: 1600, freqEnd: 140, attack: 0.004, decay: 0.36, peak: 0.07 }),
    tone(s, {
      type: 'square',
      freq: 700,
      freqEnd: 90,
      attack: 0.003,
      decay: 0.2,
      peak: 0.025,
      filter: { type: 'lowpass', freq: 1800 },
    }),
    noise(s, {
      at: 0.02,
      filter: { type: 'bandpass', freq: 2400, q: 2 },
      attack: 0.001,
      decay: 0.03,
      peak: 0.06,
    })
  );
}

/** 电磁炮发射：瞬态爆裂 + 高频扫落 + 金属余振 + 次低音冲击 + “电子”扫频 */
export function renderRailgunFire(s: SfxTarget): number {
  return maxEnd(
    noise(s, { filter: { type: 'highpass', freq: 1500 }, attack: 0.001, decay: 0.05, peak: 0.36 }),
    noise(s, {
      filter: { type: 'bandpass', freq: 6000, freqEnd: 800, q: 1.2, sweep: 0.25 },
      attack: 0.002,
      decay: 0.3,
      peak: 0.22,
    }),
    tone(s, { freq: 1130, attack: 0.002, decay: 0.7, peak: 0.04 }),
    tone(s, { freq: 1741, attack: 0.002, decay: 0.55, peak: 0.03 }),
    tone(s, { freq: 2913, attack: 0.002, decay: 0.4, peak: 0.022 }),
    tone(s, { freq: 72, freqEnd: 32, attack: 0.004, decay: 0.55, peak: 0.4 }),
    tone(s, {
      type: 'sawtooth',
      freq: 3200,
      freqEnd: 180,
      attack: 0.001,
      decay: 0.09,
      peak: 0.08,
      filter: { type: 'lowpass', freq: 6000 },
    }),
    noise(s, {
      at: 0.04,
      color: 'brown',
      filter: { type: 'lowpass', freq: 700, freqEnd: 200 },
      attack: 0.02,
      decay: 0.8,
      peak: 0.18,
    })
  );
}

/** 蜂群导弹：十余枚微型导弹连珠发射（高频“啾”+ 嘶声），整体上扬的呼啸 */
export function renderSwarmLaunch(s: SfxTarget): number {
  let end = s.t;
  let at = 0;
  for (let i = 0; i < 11; i++) {
    const pitch = 0.9 + s.random() * 0.25;
    const pan = (s.random() - 0.5) * 0.9;
    end = maxEnd(
      end,
      tone(s, {
        at,
        type: 'triangle',
        freq: 1900 * pitch,
        freqEnd: 820 * pitch,
        attack: 0.002,
        decay: 0.06,
        peak: 0.05,
        pan,
      }),
      noise(s, {
        at,
        filter: { type: 'highpass', freq: 3000 * pitch },
        attack: 0.003,
        decay: 0.09,
        peak: 0.08,
        pan,
      }),
      tone(s, { at, freq: 210 * pitch, freqEnd: 90, attack: 0.002, decay: 0.06, peak: 0.08 })
    );
    at += 0.026 + s.random() * 0.02;
  }
  return maxEnd(
    end,
    noise(s, {
      color: 'pink',
      filter: { type: 'bandpass', freq: 700, freqEnd: 2600, q: 0.9 },
      attack: 0.25,
      decay: 0.45,
      peak: 0.12,
    })
  );
}

/** 电磁脉冲：短促充能 → 深沉“嗡——”的冲击 + 电弧噼啪 + 下坠的环形扫频 + 气浪 */
export function renderEmpPulse(s: SfxTarget): number {
  return maxEnd(
    tone(s, { freq: 300, freqEnd: 1800, attack: 0.09, decay: 0.03, peak: 0.05, curve: 'lin' }),
    tone(s, { at: 0.1, freq: 110, freqEnd: 32, attack: 0.006, decay: 0.95, peak: 0.42 }),
    tone(s, {
      at: 0.1,
      type: 'triangle',
      freq: 220,
      freqEnd: 60,
      attack: 0.006,
      decay: 0.7,
      peak: 0.12,
    }),
    noise(s, {
      at: 0.1,
      filter: { type: 'bandpass', freq: 3000, q: 0.8 },
      tremolo: { rate: 60, depth: 0.95, shape: 'square' },
      attack: 0.004,
      decay: 0.6,
      peak: 0.12,
    }),
    tone(s, {
      at: 0.1,
      type: 'square',
      freq: 2400,
      freqEnd: 60,
      attack: 0.004,
      decay: 0.75,
      peak: 0.04,
      filter: { type: 'lowpass', freq: 3500, freqEnd: 300 },
    }),
    noise(s, {
      at: 0.1,
      color: 'pink',
      filter: { type: 'lowpass', freq: 3200, freqEnd: 300 },
      attack: 0.01,
      decay: 1.0,
      peak: 0.2,
    })
  );
}

/** 干扰弹：一串“砰砰”抛射声 + 镁热燃烧的嘶嘶声 */
export function renderFlareDeploy(s: SfxTarget): number {
  let end = s.t;
  for (let i = 0; i < 6; i++) {
    const at = i * 0.036 + s.random() * 0.01;
    const pan = i % 2 === 0 ? -0.4 : 0.4;
    end = maxEnd(
      end,
      noise(s, {
        at,
        filter: { type: 'bandpass', freq: 1800 + s.random() * 400, q: 1.2 },
        attack: 0.001,
        decay: 0.05,
        peak: 0.16,
        pan,
      }),
      tone(s, { at, freq: 320, freqEnd: 110, attack: 0.002, decay: 0.08, peak: 0.1, pan })
    );
  }
  return maxEnd(
    end,
    noise(s, {
      at: 0.05,
      filter: { type: 'highpass', freq: 5200 },
      tremolo: { rate: 23, depth: 0.5 },
      attack: 0.06,
      decay: 1.0,
      peak: 0.05,
    })
  );
}

// ==================== 敌方 / 中立单位 ====================

/** 地空导弹锁定告警：急促的双音交替（与机载导弹锁定音区分） */
export function renderSamLockWarning(s: SfxTarget): number {
  let end = s.t;
  for (let i = 0; i < 3; i++) {
    const at = i * 0.18;
    end = maxEnd(
      end,
      tone(s, {
        at,
        type: 'square',
        freq: 1450,
        attack: 0.003,
        hold: 0.06,
        decay: 0.02,
        peak: 0.05,
        filter: { type: 'lowpass', freq: 3200 },
      }),
      tone(s, {
        at: at + 0.09,
        type: 'square',
        freq: 1050,
        attack: 0.003,
        hold: 0.06,
        decay: 0.02,
        peak: 0.05,
        filter: { type: 'lowpass', freq: 3200 },
      })
    );
  }
  return end;
}

/** 地空导弹发射：沉闷的点火 + 先升后降的推进器呼啸 */
export function renderSamLaunch(s: SfxTarget): number {
  return maxEnd(
    tone(s, { freq: 95, freqEnd: 40, attack: 0.005, decay: 0.5, peak: 0.26 }),
    noise(s, {
      filter: { type: 'bandpass', freq: 600, freqEnd: 1800, q: 1, sweep: 0.5 },
      attack: 0.08,
      hold: 0.3,
      decay: 0.8,
      peak: 0.17,
    }),
    noise(s, {
      at: 0.05,
      filter: { type: 'highpass', freq: 3000 },
      tremolo: { rate: 35, depth: 0.6 },
      attack: 0.03,
      decay: 1.0,
      peak: 0.05,
    })
  );
}

/** 轰炸机投弹：挂架脱钩的“咔嗒” + 下落的哨声 */
export function renderBombDrop(s: SfxTarget): number {
  return maxEnd(
    tone(s, {
      type: 'square',
      freq: 220,
      attack: 0.002,
      decay: 0.05,
      peak: 0.07,
      filter: { type: 'lowpass', freq: 1400 },
    }),
    noise(s, { filter: { type: 'highpass', freq: 2000 }, attack: 0.001, decay: 0.02, peak: 0.08 }),
    tone(s, {
      at: 0.05,
      freq: 1500,
      freqEnd: 420,
      glideCurve: 'lin',
      attack: 0.15,
      hold: 0.5,
      decay: 0.5,
      peak: 0.05,
      vibrato: { rate: 7, depth: 12 },
    })
  );
}

/** 坦克主炮：深沉炮响 + 炮口爆裂 + 中频炮身共振 + 尘土轰鸣 */
export function renderTankCannon(s: SfxTarget): number {
  return maxEnd(
    tone(s, { freq: 105, freqEnd: 42, attack: 0.003, decay: 0.45, peak: 0.36 }),
    noise(s, { filter: { type: 'highpass', freq: 1500 }, attack: 0.001, decay: 0.06, peak: 0.22 }),
    tone(s, {
      type: 'sawtooth',
      freq: 170,
      freqEnd: 70,
      attack: 0.002,
      decay: 0.22,
      peak: 0.12,
      filter: { type: 'lowpass', freq: 700 },
    }),
    noise(s, {
      at: 0.02,
      color: 'brown',
      filter: { type: 'lowpass', freq: 420, freqEnd: 160 },
      attack: 0.02,
      decay: 0.8,
      peak: 0.16,
    })
  );
}

/** 直升机掠过：旋翼“哒哒”（节奏随多普勒放慢）+ 发动机嗡鸣，由远及近再远去 */
export function renderHelicopterPass(s: SfxTarget, intensity: number): number {
  const level = Math.max(0.15, Math.min(1.4, intensity));
  const shape = { attack: 0.75, hold: 0.25, decay: 0.95 };
  return maxEnd(
    noise(s, {
      ...shape,
      color: 'pink',
      filter: { type: 'lowpass', freq: 1400, freqEnd: 600, q: 0.8 },
      tremolo: { rate: 19, rateEnd: 15, depth: 0.9, shape: 'triangle' },
      peak: 0.26 * level,
    }),
    tone(s, {
      ...shape,
      type: 'sawtooth',
      freq: 74,
      freqEnd: 66,
      filter: { type: 'lowpass', freq: 380, freqEnd: 260 },
      tremolo: { rate: 19, rateEnd: 15, depth: 0.5, shape: 'triangle' },
      peak: 0.1 * level,
    }),
    noise(s, {
      ...shape,
      filter: { type: 'bandpass', freq: 2600, freqEnd: 1700, q: 1.5 },
      peak: 0.025 * level,
    })
  );
}

/** 舰船汽笛：D2 与 A2 两支低沉锯齿 + 微弱颤动，长鸣后远处回声 */
export function renderShipHorn(s: SfxTarget): number {
  const body = { attack: 0.18, hold: 1.3, decay: 0.7 };
  const filter = { type: 'lowpass' as const, freq: 520, q: 1 };
  let end = s.t;
  const voices: Array<[number, number]> = [
    [73.42, 0.16],
    [110, 0.11],
    [146.83, 0.05],
  ];
  for (const [freq, peak] of voices) {
    end = maxEnd(
      end,
      tone(s, { ...body, type: 'sawtooth', freq, filter, vibrato: { rate: 4, depth: 0.6 }, peak }),
      tone(s, {
        at: 0.5,
        ...body,
        hold: 0.9,
        type: 'sawtooth',
        freq,
        filter: { type: 'lowpass', freq: 320 },
        peak: peak * 0.25,
        pan: 0.5,
      })
    );
  }
  return maxEnd(
    end,
    noise(s, {
      ...body,
      color: 'brown',
      filter: { type: 'lowpass', freq: 300 },
      peak: 0.05,
    })
  );
}

/** 声呐：纯净的长衰减“乒——”与远处回波 */
export function renderSonarPing(s: SfxTarget): number {
  return maxEnd(
    tone(s, { freq: 1480, freqEnd: 1445, attack: 0.004, decay: 1.6, peak: 0.12 }),
    tone(s, { freq: 2960, attack: 0.004, decay: 0.5, peak: 0.015 }),
    tone(s, {
      at: 0.42,
      freq: 1478,
      freqEnd: 1450,
      attack: 0.01,
      decay: 1.4,
      peak: 0.045,
      filter: { type: 'lowpass', freq: 1800 },
      pan: 0.4,
    }),
    noise(s, {
      color: 'brown',
      filter: { type: 'lowpass', freq: 900 },
      attack: 0.2,
      decay: 0.8,
      peak: 0.02,
    })
  );
}

/** 单位被摧毁：地面（重型破碎 + 金属哐当）/ 海面（爆炸 + 水花与咕噜声）/ 空中（爆裂 + 坠落哨音） */
export function renderUnitDestroyed(s: SfxTarget, domain: UnitDomain): number {
  if (domain === 'sea') {
    return maxEnd(
      tone(s, { freq: 85, freqEnd: 34, attack: 0.004, decay: 0.6, peak: 0.32 }),
      noise(s, {
        filter: { type: 'lowpass', freq: 1100, freqEnd: 300 },
        attack: 0.004,
        decay: 0.4,
        peak: 0.24,
      }),
      noise(s, {
        at: 0.06,
        filter: { type: 'bandpass', freq: 1600, freqEnd: 900, q: 0.9 },
        attack: 0.03,
        decay: 0.6,
        peak: 0.14,
      }),
      noise(s, {
        at: 0.1,
        filter: { type: 'highpass', freq: 4500 },
        attack: 0.02,
        decay: 0.9,
        peak: 0.05,
      }),
      noise(s, {
        at: 0.2,
        color: 'brown',
        filter: { type: 'lowpass', freq: 500 },
        tremolo: { rate: 9, depth: 0.8 },
        attack: 0.05,
        decay: 1.0,
        peak: 0.12,
      })
    );
  }
  if (domain === 'air') {
    return maxEnd(
      tone(s, { freq: 130, freqEnd: 45, attack: 0.004, decay: 0.45, peak: 0.3 }),
      noise(s, {
        filter: { type: 'bandpass', freq: 900, q: 0.8 },
        attack: 0.003,
        decay: 0.35,
        peak: 0.24,
      }),
      noise(s, {
        at: 0.03,
        filter: { type: 'highpass', freq: 2500 },
        tremolo: { rate: 45, depth: 0.8, shape: 'square' },
        attack: 0.005,
        decay: 0.5,
        peak: 0.08,
      }),
      tone(s, {
        at: 0.1,
        freq: 950,
        freqEnd: 300,
        glideCurve: 'lin',
        attack: 0.05,
        hold: 0.2,
        decay: 0.55,
        peak: 0.035,
      })
    );
  }
  return maxEnd(
    tone(s, { freq: 95, freqEnd: 32, attack: 0.004, decay: 0.6, peak: 0.38 }),
    noise(s, {
      filter: { type: 'lowpass', freq: 1400, freqEnd: 300 },
      attack: 0.004,
      decay: 0.5,
      peak: 0.28,
    }),
    fm(s, { at: 0.04, freq: 310, ratio: 2.7, index: 2, decay: 0.3, peak: 0.06 }),
    noise(s, {
      at: 0.08,
      filter: { type: 'bandpass', freq: 2200, q: 1.1 },
      tremolo: { rate: 30, depth: 0.85, shape: 'square' },
      attack: 0.01,
      decay: 0.25,
      peak: 0.08,
    })
  );
}

// ==================== 环境与 Boss ====================

/** 雷击：撕裂空气的爆裂 + 电弧噼啪 + 滚滚雷声 */
export function renderLightningStrike(s: SfxTarget): number {
  return maxEnd(
    noise(s, { filter: { type: 'highpass', freq: 1800 }, attack: 0.001, decay: 0.09, peak: 0.36 }),
    noise(s, {
      filter: { type: 'bandpass', freq: 3000, q: 0.9 },
      tremolo: { rate: 70, depth: 0.9, shape: 'square' },
      attack: 0.002,
      decay: 0.25,
      peak: 0.15,
    }),
    noise(s, {
      at: 0.05,
      color: 'brown',
      filter: { type: 'lowpass', freq: 320, freqEnd: 120 },
      attack: 0.1,
      hold: 0.3,
      decay: 2.0,
      peak: 0.34,
    }),
    tone(s, { at: 0.03, freq: 70, freqEnd: 35, attack: 0.01, decay: 1.4, peak: 0.2 })
  );
}

/** 熔岩喷发：低沉隆隆 + 冲击 + 滋滋蒸汽 + 冒泡 */
export function renderLavaEruption(s: SfxTarget): number {
  let end = maxEnd(
    noise(s, {
      color: 'brown',
      filter: { type: 'lowpass', freq: 220 },
      attack: 0.15,
      hold: 0.4,
      decay: 1.2,
      peak: 0.34,
    }),
    tone(s, { freq: 62, freqEnd: 30, attack: 0.01, decay: 1.0, peak: 0.3 }),
    noise(s, {
      filter: { type: 'highpass', freq: 4000 },
      attack: 0.2,
      decay: 1.3,
      peak: 0.06,
    })
  );
  for (let i = 0; i < 5; i++) {
    const at = 0.1 + s.random() * 0.8;
    const base = 140 + s.random() * 60;
    end = maxEnd(
      end,
      tone(s, { at, freq: base, freqEnd: base * 2.2, attack: 0.004, decay: 0.05, peak: 0.06 })
    );
  }
  return end;
}

/** 能量护盾受击：金属感 FM“铮” + 短促能量噪声 + 护盾嗡鸣 */
export function renderShieldHit(s: SfxTarget): number {
  return maxEnd(
    fm(s, {
      freq: 520,
      ratio: 1.41,
      index: 3,
      indexEnd: 0.3,
      attack: 0.002,
      decay: 0.35,
      peak: 0.1,
    }),
    noise(s, {
      filter: { type: 'bandpass', freq: 2500, q: 1.5 },
      attack: 0.002,
      decay: 0.08,
      peak: 0.1,
    }),
    tone(s, {
      freq: 180,
      attack: 0.005,
      decay: 0.3,
      peak: 0.04,
      tremolo: { rate: 25, depth: 0.7 },
    })
  );
}

/** Boss 换阶段警报：锯齿汽笛交替 520/740Hz 三轮，伴随低频脉冲 */
export function renderBossPhaseAlarm(s: SfxTarget): number {
  let end = s.t;
  for (let i = 0; i < 3; i++) {
    const at = i * 0.36;
    end = maxEnd(
      end,
      tone(s, {
        at,
        type: 'sawtooth',
        freq: 520,
        freqEnd: 560,
        attack: 0.01,
        hold: 0.14,
        decay: 0.03,
        peak: 0.07,
        filter: { type: 'bandpass', freq: 1400, q: 2 },
      }),
      tone(s, {
        at: at + 0.18,
        type: 'sawtooth',
        freq: 740,
        freqEnd: 700,
        attack: 0.01,
        hold: 0.14,
        decay: 0.03,
        peak: 0.07,
        filter: { type: 'bandpass', freq: 1400, q: 2 },
      }),
      tone(s, { at, freq: 110, attack: 0.01, hold: 0.1, decay: 0.2, peak: 0.1 })
    );
  }
  return end;
}

/** 地表命中（新地表）：熔岩 / 冰面 / 岩石 / 云层 */
export function renderSurfaceImpact(
  s: SfxTarget,
  surface: ImpactSurface,
  intensity: number
): number {
  const k = Math.max(0.6, Math.min(1.8, intensity));
  switch (surface) {
    case 'lava':
      return maxEnd(
        noise(s, {
          filter: { type: 'highpass', freq: 3500 },
          attack: 0.01,
          decay: 0.5,
          peak: 0.06 * k,
        }),
        tone(s, { freq: 140, freqEnd: 60, attack: 0.003, decay: 0.12, peak: 0.12 * k }),
        tone(s, { at: 0.05, freq: 180, freqEnd: 420, attack: 0.003, decay: 0.08, peak: 0.04 * k })
      );
    case 'ice':
      return maxEnd(
        noise(s, {
          filter: { type: 'highpass', freq: 2500 },
          attack: 0.001,
          decay: 0.03,
          peak: 0.14 * k,
        }),
        tone(s, { freq: 2150, attack: 0.001, decay: 0.25, peak: 0.03 * k }),
        tone(s, { freq: 3420, attack: 0.001, decay: 0.18, peak: 0.025 * k }),
        tone(s, { freq: 5230, attack: 0.001, decay: 0.12, peak: 0.02 * k }),
        tone(s, { freq: 200, freqEnd: 90, attack: 0.002, decay: 0.08, peak: 0.06 * k })
      );
    case 'rock':
      return maxEnd(
        tone(s, { freq: 160, freqEnd: 70, attack: 0.002, decay: 0.12, peak: 0.14 * k }),
        noise(s, {
          filter: { type: 'bandpass', freq: 1200, q: 0.9 },
          attack: 0.002,
          decay: 0.14,
          peak: 0.12 * k,
        }),
        noise(s, {
          at: 0.04,
          filter: { type: 'bandpass', freq: 3200, q: 1.5 },
          attack: 0.001,
          decay: 0.02,
          peak: 0.04 * k,
        }),
        noise(s, {
          at: 0.07,
          filter: { type: 'bandpass', freq: 2700, q: 1.5 },
          attack: 0.001,
          decay: 0.02,
          peak: 0.035 * k,
        })
      );
    case 'cloud':
    default:
      return maxEnd(
        noise(s, {
          color: 'pink',
          filter: { type: 'lowpass', freq: 700, freqEnd: 250 },
          attack: 0.03,
          decay: 0.35,
          peak: 0.1 * k,
        }),
        tone(s, { freq: 90, freqEnd: 60, attack: 0.01, decay: 0.2, peak: 0.05 * k })
      );
  }
}

// ==================== 界面与叙事 ====================

/** 视角切换：机械“咔”+ 短促气流 + 第二声“咔”与提示音 */
export function renderCameraSwitch(s: SfxTarget): number {
  return maxEnd(
    noise(s, { filter: { type: 'highpass', freq: 3000 }, attack: 0.001, decay: 0.012, peak: 0.07 }),
    noise(s, {
      filter: { type: 'bandpass', freq: 700, freqEnd: 2600, q: 1.2, sweep: 0.14 },
      attack: 0.03,
      decay: 0.14,
      peak: 0.05,
      curve: 'lin',
    }),
    noise(s, {
      at: 0.09,
      filter: { type: 'highpass', freq: 2600 },
      attack: 0.001,
      decay: 0.012,
      peak: 0.05,
    }),
    tone(s, { at: 0.09, freq: 880, freqEnd: 1320, attack: 0.003, decay: 0.06, peak: 0.025 })
  );
}

/** 自动存档：两声柔和的 FM 钟音 + 一抹高频微光 */
export function renderAutosave(s: SfxTarget): number {
  return maxEnd(
    fm(s, {
      freq: 1318.5,
      ratio: 2,
      index: 1.2,
      indexEnd: 0.2,
      attack: 0.003,
      decay: 0.6,
      peak: 0.06,
    }),
    fm(s, {
      at: 0.11,
      freq: 1975.5,
      ratio: 2,
      index: 1.1,
      indexEnd: 0.2,
      attack: 0.003,
      decay: 0.7,
      peak: 0.05,
    }),
    noise(s, {
      at: 0.05,
      filter: { type: 'highpass', freq: 7000 },
      attack: 0.05,
      decay: 0.4,
      peak: 0.012,
    })
  );
}

/** 无线电接通：静噪爆音 + 确认短音 */
export function renderRadioOpen(s: SfxTarget): number {
  return maxEnd(
    noise(s, {
      filter: { type: 'bandpass', freq: 2200, q: 1.6 },
      tremolo: { rate: 120, depth: 0.6, shape: 'square' },
      attack: 0.003,
      hold: 0.06,
      decay: 0.05,
      peak: 0.08,
    }),
    tone(s, { at: 0.1, freq: 1750, attack: 0.003, hold: 0.05, decay: 0.03, peak: 0.045 })
  );
}

/** 打字机逐字：极短的“嗒”，每次音高略有不同 */
export function renderTypewriterTick(s: SfxTarget): number {
  return maxEnd(
    noise(s, {
      filter: { type: 'highpass', freq: 3500 },
      attack: 0.001,
      decay: 0.012,
      peak: 0.045,
    }),
    tone(s, {
      type: 'triangle',
      freq: 2000 + s.random() * 600,
      attack: 0.001,
      decay: 0.018,
      peak: 0.018,
    })
  );
}

/** 切换武器：两声机械咔嗒 + 低沉“咚”+ 伺服音 */
export function renderWeaponSwitch(s: SfxTarget): number {
  return maxEnd(
    noise(s, {
      filter: { type: 'bandpass', freq: 2800, q: 2 },
      attack: 0.001,
      decay: 0.015,
      peak: 0.08,
    }),
    tone(s, { freq: 230, freqEnd: 120, attack: 0.002, decay: 0.07, peak: 0.1 }),
    noise(s, {
      at: 0.045,
      filter: { type: 'bandpass', freq: 1800, q: 2 },
      attack: 0.001,
      decay: 0.02,
      peak: 0.07,
    }),
    tone(s, {
      at: 0.02,
      type: 'square',
      freq: 600,
      freqEnd: 900,
      attack: 0.005,
      decay: 0.08,
      peak: 0.02,
      filter: { type: 'lowpass', freq: 1500 },
    })
  );
}

/** 新武器解锁：上行的明亮拨弦琶音 + 高处钟声 + 低频能量涌起 */
export function renderWeaponUnlock(s: SfxTarget): number {
  const notes = [440, 554.37, 659.25, 880];
  let end = s.t;
  notes.forEach((freq, i) => {
    end = maxEnd(
      end,
      tone(s, {
        at: i * 0.07,
        type: 'sawtooth',
        freq,
        attack: 0.003,
        decay: 0.35,
        peak: 0.05,
        filter: { type: 'lowpass', freq: 4200, freqEnd: 900 },
        pan: (i - 1.5) * 0.2,
      })
    );
  });
  return maxEnd(
    end,
    fm(s, {
      at: 0.3,
      freq: 1760,
      ratio: 3.5,
      index: 1,
      indexEnd: 0.1,
      attack: 0.003,
      decay: 0.9,
      peak: 0.04,
    }),
    tone(s, { freq: 110, freqEnd: 220, attack: 0.3, decay: 0.6, peak: 0.07 }),
    noise(s, {
      at: 0.25,
      filter: { type: 'highpass', freq: 6000 },
      attack: 0.05,
      decay: 0.6,
      peak: 0.015,
    })
  );
}

/** 平民告警：柔和但清晰的下行双音（提醒“别误伤”，与威胁警报区分） */
export function renderCivilianWarning(s: SfxTarget): number {
  let end = s.t;
  for (let i = 0; i < 2; i++) {
    const at = i * 0.4;
    end = maxEnd(
      end,
      tone(s, {
        at,
        type: 'triangle',
        freq: 880,
        attack: 0.01,
        hold: 0.1,
        decay: 0.06,
        peak: 0.07,
        filter: { type: 'lowpass', freq: 2500 },
      }),
      tone(s, {
        at: at + 0.2,
        type: 'triangle',
        freq: 660,
        attack: 0.01,
        hold: 0.1,
        decay: 0.08,
        peak: 0.07,
        filter: { type: 'lowpass', freq: 2500 },
      })
    );
  }
  return end;
}

/** 章节卡片冲击：电影感重击（次低音 + 铜管般的低音堆叠 + 尘埃余响） */
export function renderChapterImpact(s: SfxTarget): number {
  let end = maxEnd(
    tone(s, { freq: 58, freqEnd: 30, attack: 0.006, decay: 2.2, peak: 0.42 }),
    noise(s, {
      color: 'pink',
      filter: { type: 'lowpass', freq: 2000, freqEnd: 200 },
      attack: 0.004,
      decay: 1.4,
      peak: 0.2,
    }),
    noise(s, {
      at: 0.05,
      filter: { type: 'highpass', freq: 6000 },
      attack: 0.05,
      decay: 2.0,
      peak: 0.02,
    })
  );
  const stack: Array<[number, number]> = [
    [55, 0.07],
    [82.41, 0.05],
    [110, 0.05],
    [110.6, 0.03],
  ];
  for (const [freq, peak] of stack) {
    end = maxEnd(
      end,
      tone(s, {
        type: 'sawtooth',
        freq,
        attack: 0.02,
        hold: 0.3,
        decay: 1.8,
        peak,
        filter: { type: 'lowpass', freq: 1200, freqEnd: 300, q: 1.5 },
      })
    );
  }
  return end;
}

/** 结算计分：短促明亮的“嘀”，音高随连续计数逐级升高 */
export function renderDebriefTally(s: SfxTarget, step: number): number {
  const freq = 1320 * Math.pow(2, (Math.max(0, step) % 12) / 24);
  return maxEnd(
    tone(s, {
      type: 'square',
      freq,
      freqEnd: freq * 1.06,
      attack: 0.002,
      decay: 0.04,
      peak: 0.035,
      filter: { type: 'lowpass', freq: 5000 },
    }),
    noise(s, { filter: { type: 'highpass', freq: 4000 }, attack: 0.001, decay: 0.006, peak: 0.02 })
  );
}
