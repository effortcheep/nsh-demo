import { Storage } from "nsh";

export type EngineMode = "tunnel" | "matrix" | "oscilloscope";

export type PaletteId =
  | "cyberpunk"
  | "matrix"
  | "outrun"
  | "arasaka"
  | "holo"
  | "amber";

export interface NeonPalette {
  id: PaletteId;
  name: string;
  subtitle: string;
  bgStart: string;
  bgEnd: string;
  primary: string;
  secondary: string;
  accent: string;
  grid: string;
  glow: string;
}

export interface SynthParams {
  mode: EngineMode;
  palette: PaletteId;
  /** 1..10: animation speed & frequency multiplier */
  speed: number;
  /** 1..10: ring count / rain columns / harmonic complexity */
  density: number;
  /** 1..10: stroke thickness & neon bloom intensity */
  glow: number;
  /** 0..10: glitch slices / wave distortion / phase modulation */
  glitch: number;
  /** CRT scanline overlay enabled */
  scanlines: boolean;
}

export interface SynthPreset {
  id: string;
  title: string;
  author: string;
  tag: string;
  description: string;
  params: SynthParams;
  createdAt?: string;
}

export const ENGINE_META: Record<
  EngineMode,
  { title: string; shortTitle: string; badge: string; hint: string }
> = {
  tunnel: {
    title: "3D 赛博线框隧道",
    shortTitle: "3D 隧道",
    badge: "SYNTHWAVE // 3D",
    hint: "单指拖拽改变 3D 隧道消失点与飞行倾角，点击触发超空间脉冲",
  },
  matrix: {
    title: "黑客帝国故障矩阵",
    shortTitle: "数字雨",
    badge: "MATRIX // RAIN",
    hint: "手指按住滑动产生电磁引力场，排斥并高亮周围的下落字符流",
  },
  oscilloscope: {
    title: "复古 CRT 李萨如示波器",
    shortTitle: "示波器",
    badge: "CRT // LISSAJOUS",
    hint: "在屏幕上横向/纵向滑动，像合成器触摸板一样实时调制 X/Y 谐波频率比",
  },
};

export const NEON_PALETTES: Record<PaletteId, NeonPalette> = {
  cyberpunk: {
    id: "cyberpunk",
    name: "夜之城青紫",
    subtitle: "Cyber Cyan & Magenta",
    bgStart: "#050510",
    bgEnd: "#0d0620",
    primary: "#00f0ff",
    secondary: "#ff007f",
    accent: "#fcee09",
    grid: "rgba(0, 240, 255, 0.28)",
    glow: "#00f0ff",
  },
  matrix: {
    id: "matrix",
    name: "矩阵荧光绿",
    subtitle: "Phosphor Terminal",
    bgStart: "#020b05",
    bgEnd: "#041a0b",
    primary: "#00ff66",
    secondary: "#00b84c",
    accent: "#d4ffea",
    grid: "rgba(0, 255, 102, 0.24)",
    glow: "#00ff66",
  },
  outrun: {
    id: "outrun",
    name: "落日合成波",
    subtitle: "Outrun 1984 Sunset",
    bgStart: "#0c041c",
    bgEnd: "#290936",
    primary: "#ff2a85",
    secondary: "#ff9900",
    accent: "#00e5ff",
    grid: "rgba(255, 42, 133, 0.30)",
    glow: "#ff2a85",
  },
  arasaka: {
    id: "arasaka",
    name: "荒坂赤金",
    subtitle: "Tactical Crimson",
    bgStart: "#0b0305",
    bgEnd: "#1f050a",
    primary: "#ff1e42",
    secondary: "#ffb800",
    accent: "#ffffff",
    grid: "rgba(255, 30, 66, 0.26)",
    glow: "#ff1e42",
  },
  holo: {
    id: "holo",
    name: "深海全息蓝",
    subtitle: "Deep Holo Cobalt",
    bgStart: "#020817",
    bgEnd: "#071936",
    primary: "#38bdf8",
    secondary: "#818cf8",
    accent: "#2dd4bf",
    grid: "rgba(56, 189, 248, 0.25)",
    glow: "#38bdf8",
  },
  amber: {
    id: "amber",
    name: "复古琥珀管",
    subtitle: "Vintage CRT Amber",
    bgStart: "#0e0802",
    bgEnd: "#1f1204",
    primary: "#ffb000",
    secondary: "#ff6a00",
    accent: "#ffe8a3",
    grid: "rgba(255, 176, 0, 0.25)",
    glow: "#ffb000",
  },
};

export const PALETTE_LIST: NeonPalette[] = [
  NEON_PALETTES.cyberpunk,
  NEON_PALETTES.matrix,
  NEON_PALETTES.outrun,
  NEON_PALETTES.arasaka,
  NEON_PALETTES.holo,
  NEON_PALETTES.amber,
];

export const BUILTIN_PRESETS: SynthPreset[] = [
  {
    id: "preset-outrun-overdrive",
    title: "1984 落日超速公路",
    author: "NEON_CORE",
    tag: "精选 · 3D 隧道",
    description: "经典合成波红紫渐变地平线，高速穿越几何线框与扫描线落日。",
    params: {
      mode: "tunnel",
      palette: "outrun",
      speed: 6,
      density: 7,
      glow: 8,
      glitch: 2,
      scanlines: true,
    },
  },
  {
    id: "preset-zion-mainframe",
    title: "锡安主控室矩阵",
    author: "MORPHEUS",
    tag: "精选 · 数字雨",
    description: "高密度荧光绿字符瀑布，带周期性水平同步信号撕裂与高亮解码。",
    params: {
      mode: "matrix",
      palette: "matrix",
      speed: 5,
      density: 8,
      glow: 7,
      glitch: 4,
      scanlines: true,
    },
  },
  {
    id: "preset-analog-lissajous",
    title: "贝尔实验室 1978",
    author: "ANALOG_LAB",
    tag: "精选 · 示波器",
    description: "暖调琥珀色阴极射线管谐波曲线，展现精密的相位交织与余晖。",
    params: {
      mode: "oscilloscope",
      palette: "amber",
      speed: 4,
      density: 6,
      glow: 8,
      glitch: 1,
      scanlines: true,
    },
  },
  {
    id: "preset-nightcity-dive",
    title: "黑墙深渊潜行",
    author: "NETRUNNER",
    tag: "高能 · 3D 隧道",
    description: "青紫双色高对比线框虫洞，开启强故障扰动，适合大幅手势拖拽。",
    params: {
      mode: "tunnel",
      palette: "cyberpunk",
      speed: 8,
      density: 9,
      glow: 9,
      glitch: 7,
      scanlines: true,
    },
  },
  {
    id: "preset-arasaka-firewall",
    title: "荒坂神经防火墙",
    author: "KANG_TAO",
    tag: "高能 · 数字雨",
    description: "赤红警戒态数据洪流，手指触碰屏幕即可切开红色加密矩阵。",
    params: {
      mode: "matrix",
      palette: "arasaka",
      speed: 7,
      density: 7,
      glow: 8,
      glitch: 6,
      scanlines: true,
    },
  },
  {
    id: "preset-quantum-harmonic",
    title: "深海全息谐振器",
    author: "HOLO_SYNTH",
    tag: "沉浸 · 示波器",
    description: "多层高频李萨如包络波，冰蓝色低噪点平滑轨迹，极具科技感。",
    params: {
      mode: "oscilloscope",
      palette: "holo",
      speed: 5,
      density: 9,
      glow: 7,
      glitch: 2,
      scanlines: false,
    },
  },
];

const ADJECTIVES = ["全息", "量子", "霓虹", "超维", "暗物质", "神经", "脉冲", "零号"];
const NOUNS = ["矩阵", "地平线", "共振腔", "奇点", "信标", "回廊", "中枢", "折跃门"];

export function generateRandomSeeds(seedBatch: number): SynthPreset[] {
  const modes: EngineMode[] = ["tunnel", "matrix", "oscilloscope"];
  const palettes: PaletteId[] = [
    "cyberpunk",
    "matrix",
    "outrun",
    "arasaka",
    "holo",
    "amber",
  ];
  const results: SynthPreset[] = [];
  for (let i = 0; i < 3; i++) {
    const n = (seedBatch * 7 + i * 13) % 97;
    const mode = modes[(seedBatch + i) % modes.length];
    const palette = palettes[(seedBatch * 2 + i * 3) % palettes.length];
    const adj = ADJECTIVES[(n + i * 2) % ADJECTIVES.length];
    const noun = NOUNS[(n * 3 + i) % NOUNS.length];
    results.push({
      id: `seed-${seedBatch}-${i}`,
      title: `${adj}${noun} #${100 + ((seedBatch * 17 + i * 29) % 899)}`,
      author: "PROCEDURAL_AI",
      tag: `随机灵感 · ${ENGINE_META[mode].shortTitle}`,
      description: `下拉刷新生成的程序化种子（${NEON_PALETTES[palette].name}），点击即可载入合成器。`,
      params: {
        mode,
        palette,
        speed: 3 + ((n + i * 3) % 7),
        density: 4 + ((n * 2 + i) % 6),
        glow: 5 + ((n + i) % 5),
        glitch: (n + i * 4) % 8,
        scanlines: (n + i) % 2 === 0,
      },
    });
  }
  return results;
}

const STORAGE_KEY = "neon_synth_saved_presets_v1";

export async function loadSavedPresets(): Promise<SynthPreset[]> {
  try {
    const raw = await Storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export async function savePresetsToStorage(presets: SynthPreset[]): Promise<void> {
  try {
    await Storage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch {
    // Ignore storage quota errors in constrained environments
  }
}

export function serializePresetCode(preset: SynthPreset): string {
  return JSON.stringify({
    nsh_synth: 1,
    title: preset.title,
    params: preset.params,
  });
}

export function parsePresetCode(raw: string): SynthPreset | null {
  try {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const data = JSON.parse(trimmed);
    const p = data?.params ?? data;
    if (!p || typeof p !== "object") return null;
    const validModes: EngineMode[] = ["tunnel", "matrix", "oscilloscope"];
    const validPalettes: PaletteId[] = [
      "cyberpunk",
      "matrix",
      "outrun",
      "arasaka",
      "holo",
      "amber",
    ];
    const mode: EngineMode = validModes.includes(p.mode) ? p.mode : "tunnel";
    const palette: PaletteId = validPalettes.includes(p.palette)
      ? p.palette
      : "cyberpunk";
    const clamp = (v: unknown, min: number, max: number, fallback: number) => {
      const num = typeof v === "number" && !Number.isNaN(v) ? Math.round(v) : fallback;
      return Math.max(min, Math.min(max, num));
    };
    return {
      id: `imported-${Date.now()}`,
      title: typeof data.title === "string" && data.title.trim() ? data.title.trim() : `剪贴板导入 (${ENGINE_META[mode].shortTitle})`,
      author: "CLIPBOARD",
      tag: `导入 · ${ENGINE_META[mode].shortTitle}`,
      description: `从手机剪贴板导入的自定义配置（${NEON_PALETTES[palette].name}）。`,
      createdAt: "刚刚导入",
      params: {
        mode,
        palette,
        speed: clamp(p.speed, 1, 10, 6),
        density: clamp(p.density, 1, 10, 7),
        glow: clamp(p.glow, 1, 10, 7),
        glitch: clamp(p.glitch, 0, 10, 2),
        scanlines: typeof p.scanlines === "boolean" ? p.scanlines : true,
      },
    };
  } catch {
    return null;
  }
}
