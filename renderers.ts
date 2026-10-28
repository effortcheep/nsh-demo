import type { CanvasRenderingContext2D, CanvasSize } from "nsh";
import { NEON_PALETTES, type SynthParams } from "./presets";

export interface InteractiveState {
  /** Normalized -1..1 offset from center controlled by touch drag */
  focusX: number;
  focusY: number;
  /** Raw touch point in canvas coordinates when finger is down */
  touchX: number;
  touchY: number;
  touchActive: boolean;
  /** 0..1 decaying shockwave triggered on tap/pulse */
  pulse: number;
}

const MATRIX_GLYPHS = [
  "0", "1", "7", "9", "A", "F", "X", "Z",
  "λ", "Ω", "Δ", "Σ", "Ψ", "Φ", "⊕", "⊗",
  "ｱ", "ｲ", "ｳ", "ｴ", "ｵ", "ｶ", "ｷ", "ｸ",
  "ｹ", "ｺ", "ｻ", "ｼ", "ｽ", "ｾ", "ｿ", "ﾀ",
];

export function renderSynthCanvas(
  cx: CanvasRenderingContext2D,
  size: CanvasSize,
  params: SynthParams,
  time: number,
  interaction: InteractiveState,
): void {
  const w = size.width;
  const h = size.height;
  if (w <= 0 || h <= 0) return;

  const pal = NEON_PALETTES[params.palette] ?? NEON_PALETTES.cyberpunk;

  // Base background gradient
  const bgGrad = cx.createLinearGradient(0, 0, 0, h);
  bgGrad.addColorStop(0, pal.bgStart);
  bgGrad.addColorStop(0.55, pal.bgEnd);
  bgGrad.addColorStop(1, pal.bgStart);
  cx.fillStyle = bgGrad;
  cx.fillRect(0, 0, w, h);

  if (params.mode === "tunnel") {
    drawSynthwaveTunnel(cx, w, h, params, pal, time, interaction);
  } else if (params.mode === "matrix") {
    drawMatrixRain(cx, w, h, params, pal, time, interaction);
  } else {
    drawOscilloscope(cx, w, h, params, pal, time, interaction);
  }

  // Optional CRT scanline & glitch slices overlay
  if (params.scanlines) {
    drawScanlines(cx, w, h, pal.primary);
  }
  if (params.glitch > 0) {
    drawGlitchArtifacts(cx, w, h, params.glitch, pal, time);
  }
}

function drawSynthwaveTunnel(
  cx: CanvasRenderingContext2D,
  w: number,
  h: number,
  params: SynthParams,
  pal: (typeof NEON_PALETTES)["cyberpunk"],
  time: number,
  inter: InteractiveState,
): void {
  const vpX = w * (0.5 + inter.focusX * 0.28);
  const vpY = h * (0.42 + inter.focusY * 0.22);
  const maxDim = Math.max(w, h);
  const t = time * (0.35 + params.speed * 0.16);

  // 1. Retro Synthwave Sun with horizontal scan cuts
  const sunRadius = Math.min(w, h) * (0.22 + inter.pulse * 0.05);
  const sunGrad = cx.createLinearGradient(
    vpX,
    vpY - sunRadius,
    vpX,
    vpY + sunRadius * 0.6,
  );
  sunGrad.addColorStop(0, pal.accent);
  sunGrad.addColorStop(0.5, pal.primary);
  sunGrad.addColorStop(1, pal.secondary);

  cx.save();
  cx.shadowColor = pal.glow;
  cx.shadowBlur = params.glow * 3;
  cx.fillStyle = sunGrad;
  cx.beginPath();
  cx.arc(vpX, vpY - sunRadius * 0.18, sunRadius, 0, Math.PI * 2);
  cx.fill();
  cx.restore();

  // Horizontal slices cut across lower half of the sun
  cx.fillStyle = pal.bgEnd;
  for (let i = 0; i < 6; i++) {
    const sliceY = vpY - sunRadius * 0.12 + i * (sunRadius * 0.15);
    const sliceH = 2 + i * 2.2;
    cx.fillRect(vpX - sunRadius - 4, sliceY, sunRadius * 2 + 8, sliceH);
  }

  // 2. Horizon glow bar
  cx.save();
  cx.strokeStyle = pal.primary;
  cx.shadowColor = pal.glow;
  cx.shadowBlur = params.glow * 2.5;
  cx.lineWidth = 2;
  cx.beginPath();
  cx.moveTo(0, vpY);
  cx.lineTo(w, vpY);
  cx.stroke();
  cx.restore();

  // 3. Perspective Floor & Ceiling Grid
  const rayCount = 6 + params.density * 2;
  cx.save();
  cx.strokeStyle = pal.grid;
  cx.lineWidth = 1 + params.glow * 0.12;

  for (let i = -rayCount; i <= rayCount; i++) {
    const ratio = i / rayCount;
    const bottomX = vpX + ratio * w * 1.65;
    const topX = vpX + ratio * w * 1.45;
    // Floor ray
    cx.beginPath();
    cx.moveTo(vpX, vpY);
    cx.lineTo(bottomX, h);
    cx.stroke();
    // Ceiling ray
    cx.beginPath();
    cx.moveTo(vpX, vpY);
    cx.lineTo(topX, 0);
    cx.stroke();
  }

  // Moving horizontal depth lines (exponential spacing)
  const depthLines = 6 + params.density;
  const phase = t % 1;
  for (let i = 0; i < depthLines; i++) {
    const norm = (i + phase) / depthLines;
    const curve = norm * norm * norm;
    const floorY = vpY + curve * (h - vpY);
    const ceilY = vpY - curve * vpY;

    cx.globalAlpha = Math.min(1, norm * 1.2);
    cx.strokeStyle = i % 2 === 0 ? pal.primary : pal.secondary;
    cx.beginPath();
    cx.moveTo(0, floorY);
    cx.lineTo(w, floorY);
    cx.moveTo(0, ceilY);
    cx.lineTo(w, ceilY);
    cx.stroke();
  }
  cx.restore();

  // 4. 3D Wireframe Tunnel Rings flying toward viewer
  const ringCount = 4 + Math.floor(params.density * 0.8);
  const sides = 6;
  cx.save();
  cx.shadowColor = pal.glow;
  cx.shadowBlur = params.glow * 1.8;

  for (let r = 0; r < ringCount; r++) {
    const zProgress = ((r / ringCount) + (t * 0.45)) % 1;
    const depthScale = Math.pow(zProgress, 2.3);
    const radius = 14 + depthScale * maxDim * 0.72;
    const twist =
      time * 0.35 * (r % 2 === 0 ? 1 : -1) +
      inter.focusX * 0.9 +
      zProgress * 0.8;

    cx.globalAlpha = Math.min(1, zProgress * 1.35);
    cx.strokeStyle = r % 2 === 0 ? pal.primary : pal.secondary;
    cx.lineWidth = 1 + depthScale * (1 + params.glow * 0.3);

    cx.beginPath();
    for (let s = 0; s <= sides; s++) {
      const angle = (s / sides) * Math.PI * 2 + twist;
      const px = vpX + Math.cos(angle) * radius;
      const py = vpY + Math.sin(angle) * radius * 0.82;
      if (s === 0) cx.moveTo(px, py);
      else cx.lineTo(px, py);
    }
    cx.closePath();
    cx.stroke();
  }
  cx.restore();

  // 5. Tap Shockwave Pulse Ring
  if (inter.pulse > 0.02) {
    cx.save();
    const pRadius = (1 - inter.pulse) * maxDim * 0.65;
    cx.strokeStyle = pal.accent;
    cx.globalAlpha = inter.pulse;
    cx.lineWidth = 2 + inter.pulse * 4;
    cx.beginPath();
    cx.arc(vpX, vpY, pRadius, 0, Math.PI * 2);
    cx.stroke();
    cx.restore();
  }
}

function drawMatrixRain(
  cx: CanvasRenderingContext2D,
  w: number,
  h: number,
  params: SynthParams,
  pal: (typeof NEON_PALETTES)["cyberpunk"],
  time: number,
  inter: InteractiveState,
): void {
  const cols = 10 + params.density * 2;
  const colW = w / cols;
  const cellH = Math.max(16, Math.min(26, colW * 0.95));
  const rows = Math.ceil(h / cellH) + 2;
  const speedFactor = 1.5 + params.speed * 0.75;

  const repulseX = inter.touchActive ? inter.touchX : w * (0.5 + inter.focusX * 0.35);
  const repulseY = inter.touchActive ? inter.touchY : h * (0.5 + inter.focusY * 0.35);
  const repulseRadius = Math.min(w, h) * (inter.touchActive ? 0.32 : 0.22 + inter.pulse * 0.25);

  cx.save();
  cx.font = `700 ${Math.round(cellH * 0.78)}px monospace`;
  cx.textAlign = "center";
  cx.textBaseline = "middle";

  for (let c = 0; c < cols; c++) {
    const colSeed = (c * 37 + 19) % 101;
    const colSpeed = speedFactor * (0.65 + (colSeed % 7) * 0.14);
    const tailLen = 6 + (colSeed % 8) + Math.floor(params.density * 0.6);
    const headRow = (time * colSpeed * 3.2 + colSeed * 1.7) % (rows + tailLen);

    for (let r = 0; r < rows; r++) {
      const distFromHead = headRow - r;
      if (distFromHead < 0 || distFromHead > tailLen) continue;

      const fade = 1 - distFromHead / tailLen;
      let x = (c + 0.5) * colW;
      let y = (r + 0.5) * cellH;

      // Electromagnetic touch repulsion & highlight
      const dx = x - repulseX;
      const dy = y - repulseY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      let nearField = 0;
      if (dist < repulseRadius && dist > 1) {
        nearField = 1 - dist / repulseRadius;
        const push = nearField * nearField * 28;
        x += (dx / dist) * push;
        y += (dy / dist) * push;
      }

      const glyphIdx =
        Math.abs(Math.floor(c * 13 + r * 7 + time * (distFromHead < 1.2 ? 12 : 2))) %
        MATRIX_GLYPHS.length;
      const glyph = MATRIX_GLYPHS[glyphIdx];

      if (distFromHead < 1.1) {
        cx.fillStyle = pal.accent;
        cx.globalAlpha = 0.95;
      } else if (nearField > 0.25) {
        cx.fillStyle = pal.secondary;
        cx.globalAlpha = Math.min(1, fade + nearField * 0.5);
      } else {
        cx.fillStyle = pal.primary;
        cx.globalAlpha = fade * 0.85;
      }

      cx.fillText(glyph, x, y);
    }
  }
  cx.restore();

  // Draw electromagnetic touch vortex ring
  if (inter.touchActive || inter.pulse > 0.05) {
    cx.save();
    cx.strokeStyle = pal.accent;
    cx.globalAlpha = inter.touchActive ? 0.65 : inter.pulse * 0.8;
    cx.lineWidth = 2;
    cx.setLineDash([6, 6]);
    cx.beginPath();
    cx.arc(repulseX, repulseY, repulseRadius * 0.65, time * 2, time * 2 + Math.PI * 1.85);
    cx.stroke();
    cx.restore();
  }
}

function drawOscilloscope(
  cx: CanvasRenderingContext2D,
  w: number,
  h: number,
  params: SynthParams,
  pal: (typeof NEON_PALETTES)["cyberpunk"],
  time: number,
  inter: InteractiveState,
): void {
  const cxMid = w * 0.5;
  const cyMid = h * 0.46;
  const scopeRadius = Math.min(w, h) * 0.36;

  // 1. CRT Precision Graticule Grid
  cx.save();
  cx.strokeStyle = pal.grid;
  cx.lineWidth = 1;
  const gridStep = Math.max(28, Math.round(Math.min(w, h) / 10));

  for (let x = cxMid % gridStep; x < w; x += gridStep) {
    cx.beginPath();
    cx.moveTo(x, 0);
    cx.lineTo(x, h);
    cx.stroke();
  }
  for (let y = cyMid % gridStep; y < h; y += gridStep) {
    cx.beginPath();
    cx.moveTo(0, y);
    cx.lineTo(w, y);
    cx.stroke();
  }

  // Crosshair & Outer Scope Ring
  cx.strokeStyle = pal.secondary;
  cx.globalAlpha = 0.45;
  cx.beginPath();
  cx.arc(cxMid, cyMid, scopeRadius * 1.08, 0, Math.PI * 2);
  cx.moveTo(cxMid - scopeRadius * 1.15, cyMid);
  cx.lineTo(cxMid + scopeRadius * 1.15, cyMid);
  cx.moveTo(cxMid, cyMid - scopeRadius * 1.15);
  cx.lineTo(cxMid, cyMid + scopeRadius * 1.15);
  cx.stroke();
  cx.restore();

  // 2. Dual-Harmonic Lissajous Curve modulated by touch focusX/focusY
  const freqX = Math.round(2 + (params.density % 5) + inter.focusX * 2);
  const freqY = Math.round(3 + ((params.density + 2) % 5) + inter.focusY * 2);
  const phase = time * (0.6 + params.speed * 0.25) + inter.focusX * Math.PI;
  const subHarmonic = 0.16 + params.glitch * 0.03 + inter.pulse * 0.2;
  const samples = 180 + params.density * 18;

  cx.save();
  cx.strokeStyle = pal.primary;
  cx.shadowColor = pal.glow;
  cx.shadowBlur = params.glow * 2.5;
  cx.lineWidth = 1.6 + params.glow * 0.28;
  cx.lineJoin = "round";
  cx.lineCap = "round";

  cx.beginPath();
  let headX = cxMid;
  let headY = cyMid;
  for (let i = 0; i <= samples; i++) {
    const u = (i / samples) * Math.PI * 2;
    const mod = 1 + Math.sin(u * 6 + time * 3) * subHarmonic;
    const px =
      cxMid +
      Math.sin(u * freqX + phase) * scopeRadius * 0.88 * mod;
    const py =
      cyMid +
      Math.sin(u * freqY + time * 0.45) * scopeRadius * 0.88 * mod;
    if (i === 0) cx.moveTo(px, py);
    else cx.lineTo(px, py);
    if (i === samples) {
      headX = px;
      headY = py;
    }
  }
  cx.stroke();

  // Secondary harmonic echo curve
  cx.strokeStyle = pal.secondary;
  cx.globalAlpha = 0.55;
  cx.lineWidth = 1.2;
  cx.beginPath();
  for (let i = 0; i <= samples; i += 2) {
    const u = (i / samples) * Math.PI * 2;
    const px =
      cxMid +
      Math.cos(u * freqX + phase * 0.8) * scopeRadius * 0.62;
    const py =
      cyMid +
      Math.sin(u * (freqY + 1) - time * 0.6) * scopeRadius * 0.62;
    if (i === 0) cx.moveTo(px, py);
    else cx.lineTo(px, py);
  }
  cx.stroke();

  // Glowing Electron Beam Head
  cx.fillStyle = pal.accent;
  cx.globalAlpha = 1;
  cx.beginPath();
  cx.arc(headX, headY, 4 + params.glow * 0.35, 0, Math.PI * 2);
  cx.fill();

  // 3. Lower Time-Domain Carrier Wave Strip
  const stripY = h * 0.82;
  const stripAmp = h * 0.055;
  cx.strokeStyle = pal.accent;
  cx.globalAlpha = 0.8;
  cx.lineWidth = 1.5;
  cx.beginPath();
  const waveSteps = 72;
  for (let i = 0; i <= waveSteps; i++) {
    const ratio = i / waveSteps;
    const wx = w * 0.08 + ratio * w * 0.84;
    const envelope = Math.sin(ratio * Math.PI);
    const wy =
      stripY +
      Math.sin(ratio * (10 + params.density * 2) - time * (3 + params.speed)) *
        stripAmp *
        envelope;
    if (i === 0) cx.moveTo(wx, wy);
    else cx.lineTo(wx, wy);
  }
  cx.stroke();
  cx.restore();
}

function drawScanlines(
  cx: CanvasRenderingContext2D,
  w: number,
  h: number,
  tint: string,
): void {
  cx.save();
  cx.fillStyle = "rgba(0, 0, 0, 0.26)";
  for (let y = 0; y < h; y += 5) {
    cx.fillRect(0, y, w, 2);
  }
  // Subtle CRT vignette corners
  cx.strokeStyle = tint;
  cx.globalAlpha = 0.18;
  cx.lineWidth = 2;
  cx.strokeRect(4, 4, w - 8, h - 8);
  cx.restore();
}

function drawGlitchArtifacts(
  cx: CanvasRenderingContext2D,
  w: number,
  h: number,
  glitch: number,
  pal: (typeof NEON_PALETTES)["cyberpunk"],
  time: number,
): void {
  const sliceCount = Math.ceil(glitch * 0.6);
  cx.save();
  for (let i = 0; i < sliceCount; i++) {
    const hash = Math.sin(time * 17.3 + i * 43.7) * 10000;
    const frac = hash - Math.floor(hash);
    if (frac > 0.45) continue;

    const y = ((frac * 997 + i * 131) % 100) * 0.01 * h;
    const barH = 2 + (i % 3) * 3;
    const barW = w * (0.2 + (frac * 0.6));
    const x = ((frac * 313) % 1) * (w - barW);

    cx.fillStyle = i % 2 === 0 ? pal.secondary : pal.accent;
    cx.globalAlpha = 0.18 + glitch * 0.025;
    cx.fillRect(x, y, barW, barH);
  }
  cx.restore();
}

/** Lightweight miniature preview renderer for Preset Cards */
export function renderMiniCardPreview(
  cx: CanvasRenderingContext2D,
  size: CanvasSize,
  params: SynthParams,
): void {
  const w = size.width;
  const h = size.height;
  if (w <= 0 || h <= 0) return;
  const pal = NEON_PALETTES[params.palette] ?? NEON_PALETTES.cyberpunk;

  const grad = cx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, pal.bgStart);
  grad.addColorStop(1, pal.bgEnd);
  cx.fillStyle = grad;
  cx.fillRect(0, 0, w, h);

  cx.save();
  cx.strokeStyle = pal.primary;
  cx.lineWidth = 1.8;

  if (params.mode === "tunnel") {
    const cxMid = w * 0.5;
    const cyMid = h * 0.5;
    cx.fillStyle = pal.secondary;
    cx.beginPath();
    cx.arc(cxMid, cyMid - 4, Math.min(w, h) * 0.22, 0, Math.PI * 2);
    cx.fill();

    for (let r = 1; r <= 3; r++) {
      const rad = r * Math.min(w, h) * 0.14;
      cx.strokeStyle = r % 2 === 0 ? pal.primary : pal.accent;
      cx.strokeRect(cxMid - rad, cyMid - rad * 0.7, rad * 2, rad * 1.4);
    }
  } else if (params.mode === "matrix") {
    const cols = 12;
    const step = w / cols;
    for (let i = 0; i < cols; i++) {
      const len = ((i * 7 + params.density) % 5) + 2;
      for (let j = 0; j < len; j++) {
        cx.fillStyle = j === len - 1 ? pal.accent : pal.primary;
        cx.globalAlpha = (j + 1) / len;
        cx.fillRect(i * step + 4, 6 + j * 10, step - 8, 6);
      }
    }
  } else {
    cx.beginPath();
    const steps = 64;
    for (let i = 0; i <= steps; i++) {
      const u = (i / steps) * Math.PI * 2;
      const x = w * 0.5 + Math.sin(u * 3 + 0.6) * (w * 0.34);
      const y = h * 0.5 + Math.sin(u * 2) * (h * 0.34);
      if (i === 0) cx.moveTo(x, y);
      else cx.lineTo(x, y);
    }
    cx.stroke();
  }
  cx.restore();
}
