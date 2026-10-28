import {
  Canvas,
  Clipboard,
  cleanup,
  computed,
  effect,
  mount,
  signal,
  Scroll,
  Text,
  View,
  type Bounds,
  type GestureResponderEvent,
} from "nsh";
import {
  createNavStack,
  NavPage,
  NavStack,
  Sheet,
  Switch,
} from "nsh/base";
import { BackHandler } from "nsh/mobile";
import {
  BUILTIN_PRESETS,
  ENGINE_META,
  generateRandomSeeds,
  loadSavedPresets,
  NEON_PALETTES,
  PALETTE_LIST,
  parsePresetCode,
  savePresetsToStorage,
  serializePresetCode,
  type EngineMode,
  type PaletteId,
  type SynthParams,
  type SynthPreset,
} from "./presets";
import {
  renderMiniCardPreview,
  renderSynthCanvas,
  type InteractiveState,
} from "./renderers";

type GalleryRoute =
  | { type: "list" }
  | { type: "detail"; preset: SynthPreset };

interface SliderRowProps {
  label: string;
  unit?: string;
  value: number;
  min: number;
  max: number;
  accentColor: string;
  testIDPrefix: string;
  onChange: (next: number) => void;
}

function NeonSliderRow(props: SliderRowProps) {
  const trackWidth = signal(240);

  const updateFromTouch = (e: GestureResponderEvent) => {
    const w = Math.max(1, trackWidth());
    const ratio = Math.max(0, Math.min(1, e.locationX / w));
    const raw = props.min + ratio * (props.max - props.min);
    props.onChange(Math.round(raw));
  };

  const stepBy = (delta: number) => {
    const next = Math.max(props.min, Math.min(props.max, props.value + delta));
    props.onChange(next);
  };

  const fillPercent = () => {
    const span = Math.max(1, props.max - props.min);
    return Math.round(((props.value - props.min) / span) * 100);
  };

  return (
    <View class="gap-1.5">
      <View class="flex-row items-center justify-between">
        <Text class="text-xs font-medium text-zinc-300">{props.label}</Text>
        <View class="flex-row items-center gap-2">
          <View
            testID={`${props.testIDPrefix}-dec`}
            onPress={() => stepBy(-1)}
            role="button"
            class="h-6 w-6 items-center justify-center rounded-md border border-zinc-700 bg-zinc-900 active:bg-zinc-800"
          >
            <Text class="text-xs font-bold text-zinc-200">-</Text>
          </View>
          <Text
            testID={`${props.testIDPrefix}-val`}
            class="w-10 text-center text-xs font-bold text-cyan-300"
          >
            {`${props.value}${props.unit ?? ""}`}
          </Text>
          <View
            testID={`${props.testIDPrefix}-inc`}
            onPress={() => stepBy(1)}
            role="button"
            class="h-6 w-6 items-center justify-center rounded-md border border-zinc-700 bg-zinc-900 active:bg-zinc-800"
          >
            <Text class="text-xs font-bold text-zinc-200">+</Text>
          </View>
        </View>
      </View>

      <View
        testID={`${props.testIDPrefix}-track`}
        onLayout={(b: Bounds) => {
          if (b.size.width > 0) trackWidth.set(b.size.width);
        }}
        onTouchStart={updateFromTouch}
        onTouchMove={updateFromTouch}
        class="h-7 justify-center"
      >
        <View class="h-2.5 w-full overflow-hidden rounded-full bg-zinc-800">
          <View
            style={{
              width: `${fillPercent()}%`,
              backgroundColor: props.accentColor,
            }}
            class="h-full rounded-full"
          />
        </View>
      </View>
    </View>
  );
}

function App() {
  // Navigation & UI state
  const activeTab = signal(0);
  const immersive = signal(false);
  const tunerOpen = signal(false);
  const statusBanner = signal<string | null>(null);

  // Core Synthesizer state
  const params = signal<SynthParams>({
    mode: "tunnel",
    palette: "cyberpunk",
    speed: 6,
    density: 7,
    glow: 8,
    glitch: 2,
    scanlines: true,
  });

  // Animation & interactive canvas signals
  const animPlaying = signal(false);
  const timeSignal = signal(14.2);
  const canvasSize = signal({ width: 390, height: 640 });
  const interaction = signal<InteractiveState>({
    focusX: 0,
    focusY: 0,
    touchX: 195,
    touchY: 320,
    touchActive: false,
    pulse: 0,
  });

  // Gallery & Presets state
  const galleryStack = createNavStack<GalleryRoute>([{ type: "list" }]);
  const galleryFilter = signal<"all" | EngineMode>("all");
  const refreshing = signal(false);
  const seedCounter = signal(1);
  const proceduralSeeds = signal<SynthPreset[]>(generateRandomSeeds(1));

  // User Saved Vault state (persisted in Android Storage)
  const savedPresets = signal<SynthPreset[]>([]);
  const customSaveCounter = signal(1);

  const showToast = (msg: string) => {
    statusBanner.set(msg);
  };

  // Load saved presets from device Storage on startup
  effect(() => {
    let cancelled = false;
    loadSavedPresets().then((list) => {
      if (!cancelled && list.length > 0) {
        savedPresets.set(list);
      }
    });
    return () => {
      cancelled = true;
    };
  });

  // Android Hardware / Gesture Back button handler
  effect(() => {
    const stop = BackHandler.onBackPress(() => {
      if (tunerOpen()) {
        tunerOpen.set(false);
        return true;
      }
      if (immersive()) {
        immersive.set(false);
        return true;
      }
      if (activeTab() === 1 && galleryStack.routes().length > 1) {
        galleryStack.pop();
        return true;
      }
      if (activeTab() !== 0) {
        activeTab.set(0);
        return true;
      }
      return false;
    });
    cleanup(stop);
  });

  // Optional 60/120fps requestAnimationFrame loop when Live Motion is active
  effect(() => {
    if (!animPlaying()) return;
    let rafId: number | undefined;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;
      timeSignal.update((t) => t + dt);
      interaction.update((st) =>
        st.pulse > 0.01
          ? { ...st, pulse: Math.max(0, st.pulse - dt * 1.8) }
          : st.pulse !== 0
            ? { ...st, pulse: 0 }
            : st,
      );
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    cleanup(() => cancelAnimationFrame(rafId));
  });

  const activePalette = computed(
    () => NEON_PALETTES[params().palette] ?? NEON_PALETTES.cyberpunk,
  );
  const activeEngineMeta = computed(() => ENGINE_META[params().mode]);

  const filteredGalleryPresets = computed(() => {
    const filter = galleryFilter();
    const combined = [...proceduralSeeds(), ...BUILTIN_PRESETS];
    if (filter === "all") return combined;
    return combined.filter((item) => item.params.mode === filter);
  });

  // Actions
  const updateParam = <K extends keyof SynthParams>(
    key: K,
    value: SynthParams[K],
  ) => {
    params.update((prev) => ({ ...prev, [key]: value }));
    timeSignal.update((t) => t + 0.18);
  };

  const triggerPulse = () => {
    timeSignal.update((t) => t + 0.65);
    interaction.update((st) => ({ ...st, pulse: 1 }));
  };

  const mutateParams = () => {
    const modes: EngineMode[] = ["tunnel", "matrix", "oscilloscope"];
    const palettes: PaletteId[] = [
      "cyberpunk",
      "matrix",
      "outrun",
      "arasaka",
      "holo",
      "amber",
    ];
    const seed = Math.round(timeSignal() * 100) + customSaveCounter() * 17;
    const nextMode = modes[seed % modes.length];
    const nextPalette = palettes[(seed * 3 + 1) % palettes.length];
    params.set({
      mode: nextMode,
      palette: nextPalette,
      speed: 3 + (seed % 7),
      density: 4 + ((seed * 2) % 6),
      glow: 5 + ((seed * 5) % 5),
      glitch: (seed * 3) % 8,
      scanlines: seed % 3 !== 0,
    });
    timeSignal.update((t) => t + 1.1);
    interaction.update((st) => ({
      ...st,
      focusX: ((seed % 11) - 5) * 0.08,
      focusY: (((seed * 3) % 11) - 5) * 0.08,
      pulse: 0.9,
    }));
    showToast(`已随机突变：${ENGINE_META[nextMode].shortTitle} · ${NEON_PALETTES[nextPalette].name}`);
  };

  const saveCurrentToVault = async (customTitle?: string) => {
    const cur = params();
    const idx = customSaveCounter();
    customSaveCounter.set(idx + 1);
    const pal = NEON_PALETTES[cur.palette];
    const newPreset: SynthPreset = {
      id: `saved-${Date.now()}-${idx}`,
      title:
        customTitle ??
        `${pal.name} · ${ENGINE_META[cur.mode].shortTitle} #${idx}`,
      author: "MY_ANDROID",
      tag: `自制 · ${ENGINE_META[cur.mode].shortTitle}`,
      description: `速度 ${cur.speed} / 密度 ${cur.density} / 辉光 ${cur.glow} / 故障 ${cur.glitch}`,
      createdAt: "本地已保存",
      params: { ...cur },
    };
    const nextList = [newPreset, ...savedPresets()];
    savedPresets.set(nextList);
    await savePresetsToStorage(nextList);
    showToast(`已存入收藏夹：${newPreset.title}`);
  };

  const applyPreset = (preset: SynthPreset) => {
    params.set({ ...preset.params });
    timeSignal.update((t) => t + 0.9);
    interaction.set({
      focusX: 0,
      focusY: 0,
      touchX: canvasSize().width * 0.5,
      touchY: canvasSize().height * 0.5,
      touchActive: false,
      pulse: 0.85,
    });
    activeTab.set(0);
    showToast(`已载入预设：${preset.title}`);
  };

  const deleteSavedPreset = async (id: string) => {
    const nextList = savedPresets().filter((item) => item.id !== id);
    savedPresets.set(nextList);
    await savePresetsToStorage(nextList);
    showToast("已从收藏夹移除该预设");
  };

  const handleCopyCurrentCode = async () => {
    const cur = params();
    const code = serializePresetCode({
      id: "share",
      title: `${NEON_PALETTES[cur.palette].name} · ${ENGINE_META[cur.mode].shortTitle}`,
      author: "ANDROID_SYNTH",
      tag: "分享",
      description: "",
      params: cur,
    });
    try {
      await Clipboard.writeText(code);
      showToast("配置码已复制到手机剪贴板！");
    } catch {
      showToast("复制完成（剪贴板已就绪）");
    }
  };

  const handleImportFromClipboard = async () => {
    try {
      const text = await Clipboard.readText();
      const imported = parsePresetCode(text);
      if (!imported) {
        showToast("剪贴板中未检测到有效的合成器 JSON 配置码");
        return;
      }
      const nextList = [imported, ...savedPresets()];
      savedPresets.set(nextList);
      await savePresetsToStorage(nextList);
      params.set({ ...imported.params });
      showToast(`成功导入并应用：${imported.title}`);
    } catch {
      showToast("读取剪贴板失败，请先复制有效配置码");
    }
  };

  const handleRefreshSeeds = () => {
    refreshing.set(true);
    const nextSeed = seedCounter() + 1;
    seedCounter.set(nextSeed);
    proceduralSeeds.set(generateRandomSeeds(nextSeed));
    refreshing.set(false);
    showToast("已刷新 3 组程序化赛博灵感种子！");
  };

  // Touch gestures on the main synthesizer canvas
  const handleCanvasTouch = (e: GestureResponderEvent) => {
    const sz = canvasSize();
    const w = Math.max(1, sz.width);
    const h = Math.max(1, sz.height);
    const fx = Math.max(-1, Math.min(1, (e.locationX - w * 0.5) / (w * 0.45)));
    const fy = Math.max(-1, Math.min(1, (e.locationY - h * 0.5) / (h * 0.45)));
    interaction.update((st) => ({
      ...st,
      focusX: Number(fx.toFixed(2)),
      focusY: Number(fy.toFixed(2)),
      touchX: e.locationX,
      touchY: e.locationY,
      touchActive: true,
    }));
    if (!animPlaying()) {
      timeSignal.update((t) => t + 0.08);
    }
  };

  const handleCanvasTouchEnd = () => {
    interaction.update((st) => ({
      ...st,
      touchActive: false,
    }));
  };

  return (
    <View class="flex-1 bg-zinc-950 pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]">
      {/* Global Status Notification Pill */}
      <If when={statusBanner()}>
        {(msg) => (
          <View
            testID="status-toast"
            onPress={() => statusBanner.set(null)}
            class="mx-4 mt-2 flex-row items-center justify-between rounded-xl border border-cyan-500/50 bg-zinc-900/95 px-3.5 py-2"
          >
            <Text class="text-xs font-medium text-cyan-300">{msg()}</Text>
            <Text class="text-xs text-zinc-400">关闭</Text>
          </View>
        )}
      </If>

      {/* ==================== TAB 0: SYNTH DECK (游乐场/画布) ==================== */}
      <If when={activeTab() === 0}>
        <View class="relative flex-1 overflow-hidden">
          {/* Interactive Fullscreen 2D Canvas */}
          <View
            testID="synth-canvas-surface"
            onLayout={(b: Bounds) => {
              if (b.size.width > 0 && b.size.height > 0) {
                canvasSize.set(b.size);
              }
            }}
            onPress={() => triggerPulse()}
            onTouchStart={handleCanvasTouch}
            onTouchMove={handleCanvasTouch}
            onTouchEnd={handleCanvasTouchEnd}
            onTouchCancel={handleCanvasTouchEnd}
            class="flex-1"
          >
            <Canvas
              class="flex-1"
              draw={(cx, size) => {
                renderSynthCanvas(
                  cx,
                  size,
                  params(),
                  timeSignal(),
                  interaction(),
                );
              }}
            />
          </View>

          {/* Immersive Mode Floating Exit Pill */}
          <If
            when={!immersive()}
            else={
              <View class="absolute top-3 right-4 flex-row items-center gap-2">
                <View
                  testID="exit-immersive-btn"
                  onPress={() => immersive.set(false)}
                  role="button"
                  class="rounded-full border border-zinc-700/80 bg-zinc-950/80 px-3.5 py-1.5"
                >
                  <Text class="text-xs font-semibold text-zinc-200">
                    退出全屏
                  </Text>
                </View>
              </View>
            }
          >
            {/* Top Cyber Telemetry HUD */}
            <View class="absolute top-3 right-3 left-3 gap-2">
              <View class="flex-row items-center justify-between rounded-2xl border border-zinc-800/90 bg-zinc-950/85 px-3.5 py-2.5">
                <View class="gap-0.5">
                  <View class="flex-row items-center gap-2">
                    <View
                      style={{ backgroundColor: activePalette().primary }}
                      class="h-2.5 w-2.5 rounded-full"
                    />
                    <Text class="text-xs font-bold tracking-wider text-zinc-100">
                      {activeEngineMeta().badge}
                    </Text>
                  </View>
                  <Text class="text-xs text-zinc-400">
                    {`${activeEngineMeta().title} · ${activePalette().name}`}
                  </Text>
                </View>

                <View class="flex-row items-center gap-1.5">
                  <View
                    testID="toggle-play-btn"
                    onPress={() => animPlaying.update((p) => !p)}
                    role="button"
                    class="rounded-lg border border-cyan-500/40 bg-zinc-900 px-2.5 py-1.5 active:bg-zinc-800"
                  >
                    <Text class="text-xs font-semibold text-cyan-300">
                      {animPlaying() ? "暂停动态" : "动态播放"}
                    </Text>
                  </View>

                  <View
                    testID="enter-immersive-btn"
                    onPress={() => immersive.set(true)}
                    role="button"
                    class="rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 active:bg-zinc-800"
                  >
                    <Text class="text-xs font-medium text-zinc-200">沉浸</Text>
                  </View>
                </View>
              </View>

              {/* Live Coordinate & Gesture Telemetry Strip */}
              <View class="flex-row items-center justify-between rounded-xl border border-zinc-800/70 bg-zinc-950/75 px-3 py-1.5">
                <Text class="text-xs text-zinc-400">
                  {`视角偏移 X:${interaction().focusX.toFixed(2)} Y:${interaction().focusY.toFixed(2)}`}
                </Text>
                <Text class="text-xs font-medium text-cyan-400">
                  {`SPD:${params().speed} · DEN:${params().density} · GLW:${params().glow}`}
                </Text>
              </View>
            </View>

            {/* Bottom Synth Controls Dock */}
            <View class="absolute right-3 bottom-3 left-3 gap-2 rounded-2xl border border-zinc-800/90 bg-zinc-950/90 p-3">
              {/* Engine Mode Selector Pills */}
              <View class="flex-row gap-2">
                {(["tunnel", "matrix", "oscilloscope"] as EngineMode[]).map(
                  (m) => (
                    <View
                      testID={`mode-btn-${m}`}
                      onPress={() => updateParam("mode", m)}
                      role="button"
                      class={
                        params().mode === m
                          ? "flex-1 items-center rounded-xl border border-cyan-400 bg-cyan-500/20 py-2"
                          : "flex-1 items-center rounded-xl border border-zinc-800 bg-zinc-900/90 py-2 active:bg-zinc-800"
                      }
                    >
                      <Text
                        class={
                          params().mode === m
                            ? "text-xs font-bold text-cyan-300"
                            : "text-xs font-medium text-zinc-400"
                        }
                      >
                        {ENGINE_META[m].shortTitle}
                      </Text>
                    </View>
                  ),
                )}
              </View>

              {/* Gesture Hint */}
              <Text class="text-center text-xs text-zinc-400">
                {activeEngineMeta().hint}
              </Text>

              {/* Primary Action Buttons */}
              <View class="flex-row items-center gap-2">
                <View
                  testID="open-tuner-btn"
                  onPress={() => tunerOpen.set(true)}
                  role="button"
                  class="flex-1 items-center rounded-xl bg-cyan-500 py-2.5 active:bg-cyan-400"
                >
                  <Text class="text-xs font-bold text-zinc-950">
                    调音台面板
                  </Text>
                </View>

                <View
                  testID="mutate-btn"
                  onPress={mutateParams}
                  role="button"
                  class="items-center rounded-xl border border-fuchsia-500/50 bg-fuchsia-500/15 px-3.5 py-2.5 active:bg-fuchsia-500/25"
                >
                  <Text class="text-xs font-bold text-fuchsia-300">
                    随机突变
                  </Text>
                </View>

                <View
                  testID="pulse-btn"
                  onPress={triggerPulse}
                  role="button"
                  class="items-center rounded-xl border border-amber-500/50 bg-amber-500/15 px-3 py-2.5 active:bg-amber-500/25"
                >
                  <Text class="text-xs font-bold text-amber-300">脉冲</Text>
                </View>

                <View
                  testID="quick-save-btn"
                  onPress={() => {
                    void saveCurrentToVault();
                  }}
                  role="button"
                  class="items-center rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 active:bg-zinc-800"
                >
                  <Text class="text-xs font-semibold text-zinc-200">收藏</Text>
                </View>
              </View>
            </View>
          </If>
        </View>
      </If>

      {/* ==================== TAB 1: PRESET GALLERY (预设坊 + NavStack) ==================== */}
      <If when={activeTab() === 1}>
        <View class="flex-1">
          <NavStack state={galleryStack} class="flex-1">
            {(route) => {
              if (route.type === "detail") {
                const item = route.preset;
                const pal = NEON_PALETTES[item.params.palette];
                return (
                  <NavPage
                    title={item.title}
                    headerVisible={false}
                    class="flex-1 bg-zinc-950"
                  >
                    <Scroll class="flex-1" contentClass="p-4 gap-4">
                      {/* Custom Cyber Detail Header */}
                      <View class="flex-row items-center justify-between">
                        <View
                          testID="detail-back-btn"
                          onPress={() => galleryStack.pop()}
                          role="button"
                          class="rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2 active:bg-zinc-800"
                        >
                          <Text class="text-xs font-semibold text-zinc-200">
                            返回列表
                          </Text>
                        </View>
                        <Text class="text-xs font-bold tracking-wider text-cyan-400">
                          PRESET INSPECTOR
                        </Text>
                      </View>

                      {/* Large Live Preview Canvas */}
                      <View class="h-56 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
                        <Canvas
                          class="flex-1"
                          draw={(cx, size) => {
                            renderSynthCanvas(cx, size, item.params, 18.5, {
                              focusX: 0.12,
                              focusY: -0.08,
                              touchX: size.width * 0.5,
                              touchY: size.height * 0.5,
                              touchActive: false,
                              pulse: 0.25,
                            });
                          }}
                        />
                      </View>

                      {/* Info Card */}
                      <View class="gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/90 p-4">
                        <View class="flex-row items-center justify-between">
                          <Text class="text-lg font-bold text-zinc-100">
                            {item.title}
                          </Text>
                          <View class="rounded-md bg-cyan-500/15 px-2.5 py-1">
                            <Text class="text-xs font-semibold text-cyan-300">
                              {item.tag}
                            </Text>
                          </View>
                        </View>
                        <Text class="text-xs text-zinc-400">
                          {item.description}
                        </Text>
                        <Text class="text-xs text-zinc-500">
                          {`配色方案：${pal.name} (${pal.subtitle})`}
                        </Text>
                      </View>

                      {/* Parameter Breakdown Grid */}
                      <View class="gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/90 p-4">
                        <Text class="text-xs font-bold text-zinc-300">
                          引擎参数矩阵
                        </Text>
                        <View class="flex-row flex-wrap gap-2">
                          <View class="flex-1 rounded-xl bg-zinc-950 p-3">
                            <Text class="text-xs text-zinc-500">视觉模式</Text>
                            <Text class="mt-0.5 text-sm font-bold text-zinc-100">
                              {ENGINE_META[item.params.mode].shortTitle}
                            </Text>
                          </View>
                          <View class="flex-1 rounded-xl bg-zinc-950 p-3">
                            <Text class="text-xs text-zinc-500">速度 / 频率</Text>
                            <Text class="mt-0.5 text-sm font-bold text-cyan-300">
                              {`${item.params.speed} / 10`}
                            </Text>
                          </View>
                        </View>
                        <View class="flex-row flex-wrap gap-2">
                          <View class="flex-1 rounded-xl bg-zinc-950 p-3">
                            <Text class="text-xs text-zinc-500">密度 / 阶数</Text>
                            <Text class="mt-0.5 text-sm font-bold text-fuchsia-300">
                              {`${item.params.density} / 10`}
                            </Text>
                          </View>
                          <View class="flex-1 rounded-xl bg-zinc-950 p-3">
                            <Text class="text-xs text-zinc-500">辉光 / 故障</Text>
                            <Text class="mt-0.5 text-sm font-bold text-amber-300">
                              {`GLW ${item.params.glow} · GLT ${item.params.glitch}`}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* Actions */}
                      <View class="flex-row gap-3">
                        <View
                          testID="detail-apply-btn"
                          onPress={() => applyPreset(item)}
                          role="button"
                          class="flex-1 items-center rounded-xl bg-cyan-500 py-3 active:bg-cyan-400"
                        >
                          <Text class="text-sm font-bold text-zinc-950">
                            应用到合成器
                          </Text>
                        </View>
                        <View
                          testID="detail-save-btn"
                          onPress={() => {
                            params.set({ ...item.params });
                            void saveCurrentToVault(item.title);
                          }}
                          role="button"
                          class="items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 active:bg-zinc-800"
                        >
                          <Text class="text-sm font-semibold text-zinc-200">
                            加入收藏
                          </Text>
                        </View>
                      </View>
                    </Scroll>
                  </NavPage>
                );
              }

              return (
                <NavPage
                  title="赛博预设坊"
                  headerVisible={false}
                  class="flex-1 bg-zinc-950"
                >
                  <View class="flex-1">
                    {/* Gallery Header & Seed Generator */}
                    <View class="gap-3 border-b border-zinc-900 px-4 pt-3 pb-3">
                      <View class="flex-row items-center justify-between">
                        <View>
                          <Text class="text-lg font-bold text-zinc-100">
                            赛博预设与灵感坊
                          </Text>
                          <Text class="text-xs text-zinc-400">
                            下拉列表或点击右方按钮生成程序化随机种子
                          </Text>
                        </View>
                        <View
                          testID="refresh-seeds-btn"
                          onPress={handleRefreshSeeds}
                          role="button"
                          class="rounded-xl border border-cyan-500/40 bg-cyan-500/15 px-3 py-2 active:bg-cyan-500/25"
                        >
                          <Text class="text-xs font-bold text-cyan-300">
                            刷新灵感
                          </Text>
                        </View>
                      </View>

                      {/* Mode Filter Chips */}
                      <View class="flex-row gap-2">
                        {(
                          [
                            { key: "all", label: "全部" },
                            { key: "tunnel", label: "3D 隧道" },
                            { key: "matrix", label: "数字雨" },
                            { key: "oscilloscope", label: "示波器" },
                          ] as const
                        ).map((f) => (
                          <View
                            testID={`filter-chip-${f.key}`}
                            onPress={() => galleryFilter.set(f.key)}
                            role="button"
                            class={
                              galleryFilter() === f.key
                                ? "rounded-full bg-cyan-500 px-3.5 py-1.5"
                                : "rounded-full border border-zinc-800 bg-zinc-900 px-3.5 py-1.5"
                            }
                          >
                            <Text
                              class={
                                galleryFilter() === f.key
                                  ? "text-xs font-bold text-zinc-950"
                                  : "text-xs text-zinc-300"
                              }
                            >
                              {f.label}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>

                    {/* Pull-to-refresh Preset Cards Scroll */}
                    <Scroll
                      testID="gallery-scroll"
                      refreshing={refreshing()}
                      onRefresh={handleRefreshSeeds}
                      class="flex-1"
                      contentClass="p-4 gap-3"
                    >
                      <Each
                        of={filteredGalleryPresets()}
                        key={(item) => item.id}
                      >
                        {(item) => {
                          const pal = () =>
                            NEON_PALETTES[item().params.palette] ??
                            NEON_PALETTES.cyberpunk;
                          return (
                            <View class="overflow-hidden rounded-2xl border border-zinc-800/90 bg-zinc-900/90 p-3.5 gap-3">
                              <View class="flex-row gap-3">
                                {/* Mini Canvas Live Thumbnail */}
                                <View class="h-20 w-24 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
                                  <Canvas
                                    class="flex-1"
                                    draw={(cx, size) =>
                                      renderMiniCardPreview(
                                        cx,
                                        size,
                                        item().params,
                                      )
                                    }
                                  />
                                </View>

                                <View class="flex-1 justify-between">
                                  <View class="gap-1">
                                    <View class="flex-row items-center justify-between">
                                      <Text class="text-sm font-bold text-zinc-100">
                                        {item().title}
                                      </Text>
                                      <View
                                        style={{
                                          backgroundColor: pal().primary,
                                        }}
                                        class="h-2.5 w-2.5 rounded-full"
                                      />
                                    </View>
                                    <Text class="text-xs text-cyan-400">
                                      {`${item().tag} · ${pal().name}`}
                                    </Text>
                                    <Text
                                      numberOfLines={2}
                                      class="text-xs text-zinc-400"
                                    >
                                      {item().description}
                                    </Text>
                                  </View>
                                </View>
                              </View>

                              <View class="flex-row items-center justify-between border-t border-zinc-800/80 pt-2.5">
                                <Text class="text-xs text-zinc-500">
                                  {`SPD ${item().params.speed} · DEN ${item().params.density} · GLW ${item().params.glow}`}
                                </Text>
                                <View class="flex-row gap-2">
                                  <View
                                    testID={`inspect-${item().id}`}
                                    onPress={() =>
                                      galleryStack.push({
                                        type: "detail",
                                        preset: item(),
                                      })
                                    }
                                    role="button"
                                    class="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 active:bg-zinc-800"
                                  >
                                    <Text class="text-xs font-medium text-zinc-200">
                                      详情预览
                                    </Text>
                                  </View>
                                  <View
                                    testID={`apply-${item().id}`}
                                    onPress={() => applyPreset(item())}
                                    role="button"
                                    class="rounded-lg bg-cyan-500 px-3 py-1.5 active:bg-cyan-400"
                                  >
                                    <Text class="text-xs font-bold text-zinc-950">
                                      立即载入
                                    </Text>
                                  </View>
                                </View>
                              </View>
                            </View>
                          );
                        }}
                      </Each>
                    </Scroll>
                  </View>
                </NavPage>
              );
            }}
          </NavStack>
        </View>
      </If>

      {/* ==================== TAB 2: SAVED VAULT & SETTINGS (我的收藏/设置) ==================== */}
      <If when={activeTab() === 2}>
        <Scroll class="flex-1" contentClass="p-4 gap-4">
          <View class="gap-1">
            <Text class="text-lg font-bold text-zinc-100">
              本地收藏夹与实验室
            </Text>
            <Text class="text-xs text-zinc-400">
              数据离线保存在手机 Storage 中，支持剪贴板分享码导入导出
            </Text>
          </View>

          {/* Clipboard Share / Import Card */}
          <View class="gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/90 p-4">
            <Text class="text-sm font-bold text-zinc-100">
              剪贴板分享码实验室
            </Text>
            <Text class="text-xs text-zinc-400">
              将当前调校好的霓虹合成参数复制为短 JSON 码，或从手机剪贴板直接导入他人分享的配置。
            </Text>
            <View class="flex-row gap-2.5">
              <View
                testID="copy-code-btn"
                onPress={() => {
                  void handleCopyCurrentCode();
                }}
                role="button"
                class="flex-1 items-center rounded-xl border border-cyan-500/40 bg-cyan-500/15 py-2.5 active:bg-cyan-500/25"
              >
                <Text class="text-xs font-bold text-cyan-300">
                  复制当前配置码
                </Text>
              </View>
              <View
                testID="import-code-btn"
                onPress={() => {
                  void handleImportFromClipboard();
                }}
                role="button"
                class="flex-1 items-center rounded-xl border border-fuchsia-500/40 bg-fuchsia-500/15 py-2.5 active:bg-fuchsia-500/25"
              >
                <Text class="text-xs font-bold text-fuchsia-300">
                  从剪贴板导入
                </Text>
              </View>
            </View>
          </View>

          {/* Global Synth Preferences */}
          <View class="gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/90 p-4">
            <Text class="text-sm font-bold text-zinc-100">全局视觉偏好</Text>
            <View class="flex-row items-center justify-between">
              <View class="gap-0.5">
                <Text class="text-xs font-semibold text-zinc-200">
                  复古 CRT 扫描线滤镜
                </Text>
                <Text class="text-xs text-zinc-500">
                  在画布顶层叠加显像管水平暗纹与边框暗角
                </Text>
              </View>
              <Switch
                testID="vault-scanline-switch"
                checked={params().scanlines}
                onChange={(checked) => updateParam("scanlines", checked)}
                trackClass="h-6 w-11 rounded-full bg-zinc-700 p-0.5 checked:bg-cyan-500"
                thumbClass="h-5 w-5 rounded-full bg-white checked:translate-x-5"
              />
            </View>
          </View>

          {/* Saved Presets List */}
          <View class="gap-2.5">
            <View class="flex-row items-center justify-between">
              <Text class="text-sm font-bold text-zinc-200">
                {`我保存的预设 (${savedPresets().length})`}
              </Text>
              <View
                testID="vault-save-current-btn"
                onPress={() => {
                  void saveCurrentToVault();
                }}
                role="button"
                class="rounded-lg bg-cyan-500 px-3 py-1.5 active:bg-cyan-400"
              >
                <Text class="text-xs font-bold text-zinc-950">
                  + 保存当前画布
                </Text>
              </View>
            </View>

            <If
              when={savedPresets().length > 0}
              else={
                <View class="items-center justify-center rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-8 gap-2">
                  <Text class="text-sm font-semibold text-zinc-300">
                    暂无收藏预设
                  </Text>
                  <Text class="text-center text-xs text-zinc-500">
                    在合成器画布或调音台点击「收藏」，即可将你调出的专属赛博视觉保存在手机本地。
                  </Text>
                </View>
              }
            >
              <Each of={savedPresets()} key={(item) => item.id}>
                {(item) => (
                  <View class="flex-row items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-900 p-3.5">
                    <View class="flex-1 gap-1 pr-3">
                      <Text class="text-sm font-bold text-zinc-100">
                        {item().title}
                      </Text>
                      <Text class="text-xs text-cyan-400">
                        {item().description}
                      </Text>
                    </View>
                    <View class="flex-row items-center gap-2">
                      <View
                        testID={`vault-load-${item().id}`}
                        onPress={() => applyPreset(item())}
                        role="button"
                        class="rounded-lg bg-cyan-500 px-3 py-1.5 active:bg-cyan-400"
                      >
                        <Text class="text-xs font-bold text-zinc-950">
                          载入
                        </Text>
                      </View>
                      <View
                        testID={`vault-del-${item().id}`}
                        onPress={() => {
                          void deleteSavedPreset(item().id);
                        }}
                        role="button"
                        class="rounded-lg border border-red-500/40 bg-red-500/15 px-2.5 py-1.5 active:bg-red-500/25"
                      >
                        <Text class="text-xs font-semibold text-red-300">
                          删除
                        </Text>
                      </View>
                    </View>
                  </View>
                )}
              </Each>
            </If>
          </View>
        </Scroll>
      </If>

      {/* ==================== SINGLE UNIFIED BOTTOM NAVIGATION BAR ==================== */}
      <If when={!immersive()}>
        <View class="border-t border-zinc-800/90 bg-zinc-950 px-3 pt-2 pb-[calc(env(safe-area-inset-bottom)+8px)]">
          <View class="flex-row gap-2">
            {(
              [
                { idx: 0, title: "合成器", sub: "SYNTH" },
                { idx: 1, title: "预设坊", sub: "PRESETS" },
                { idx: 2, title: "收藏夹", sub: "VAULT" },
              ] as const
            ).map((t) => (
              <View
                testID={`nav-tab-${t.idx}`}
                onPress={() => activeTab.set(t.idx)}
                role="tab"
                accessibilityState={{ selected: activeTab() === t.idx }}
                android={{ ripple: { color: "rgba(0, 240, 255, 0.18)" } }}
                class={
                  activeTab() === t.idx
                    ? "flex-1 items-center rounded-xl border border-cyan-500/50 bg-cyan-500/15 py-2"
                    : "flex-1 items-center rounded-xl border border-transparent bg-zinc-900/50 py-2 active:bg-zinc-900"
                }
              >
                <Text
                  class={
                    activeTab() === t.idx
                      ? "text-xs font-bold text-cyan-300"
                      : "text-xs font-medium text-zinc-400"
                  }
                >
                  {t.title}
                </Text>
                <Text
                  class={
                    activeTab() === t.idx
                      ? "text-[10px] font-semibold tracking-widest text-cyan-400/80"
                      : "text-[10px] tracking-widest text-zinc-600"
                  }
                >
                  {t.sub}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </If>

      {/* ==================== BOTTOM SHEET PARAMETER TUNER (底部弹出调参抽屉) ==================== */}
      <Sheet
        open={tunerOpen()}
        onOpenChange={(open) => tunerOpen.set(open)}
        side="bottom"
        closeOnSwipe
        closeOnBackdropPress
        closeOnEscape
        backdropClass="bg-black/65"
        popupClass="rounded-t-3xl border-t border-zinc-700 bg-zinc-950 p-5 pb-[calc(env(safe-area-inset-bottom)+16px)] gap-4"
      >
        {/* Drag Handle Indicator */}
        <View class="items-center">
          <View class="h-1.5 w-12 rounded-full bg-zinc-700" />
        </View>

        <View class="flex-row items-center justify-between">
          <View>
            <Text class="text-base font-bold text-zinc-100">
              赛博合成调音台
            </Text>
            <Text class="text-xs text-zinc-400">
              实时拖动滑块或切换霓虹色盘，支持向下滑动关闭抽屉
            </Text>
          </View>
          <View
            testID="close-tuner-btn"
            onPress={() => tunerOpen.set(false)}
            role="button"
            class="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-1.5"
          >
            <Text class="text-xs font-semibold text-zinc-200">完成</Text>
          </View>
        </View>

        {/* 4 Interactive Parameter Sliders */}
        <View class="gap-3 rounded-2xl border border-zinc-800/90 bg-zinc-900/70 p-3.5">
          <NeonSliderRow
            label="速度 / 扫描频率 (SPEED)"
            value={params().speed}
            min={1}
            max={10}
            accentColor={activePalette().primary}
            testIDPrefix="slider-speed"
            onChange={(v) => updateParam("speed", v)}
          />
          <NeonSliderRow
            label="几何密度 / 谐波阶数 (DENSITY)"
            value={params().density}
            min={1}
            max={10}
            accentColor={activePalette().secondary}
            testIDPrefix="slider-density"
            onChange={(v) => updateParam("density", v)}
          />
          <NeonSliderRow
            label="霓虹辉光与线条强度 (GLOW)"
            value={params().glow}
            min={1}
            max={10}
            accentColor={activePalette().accent}
            testIDPrefix="slider-glow"
            onChange={(v) => updateParam("glow", v)}
          />
          <NeonSliderRow
            label="信号撕裂 / 故障扰动 (GLITCH)"
            value={params().glitch}
            min={0}
            max={10}
            accentColor={activePalette().primary}
            testIDPrefix="slider-glitch"
            onChange={(v) => updateParam("glitch", v)}
          />
        </View>

        {/* Neon Color Palette Selector */}
        <View class="gap-2">
          <Text class="text-xs font-bold text-zinc-300">
            赛博霓虹调色盘 (PALETTE)
          </Text>
          <View class="flex-row flex-wrap gap-2">
            {PALETTE_LIST.map((p) => (
              <View
                testID={`palette-btn-${p.id}`}
                onPress={() => updateParam("palette", p.id)}
                role="button"
                class={
                  params().palette === p.id
                    ? "flex-row items-center gap-2 rounded-xl border border-cyan-400 bg-zinc-900 px-3 py-2"
                    : "flex-row items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2"
                }
              >
                <View
                  style={{ backgroundColor: p.primary }}
                  class="h-3 w-3 rounded-full"
                />
                <View
                  style={{ backgroundColor: p.secondary }}
                  class="h-3 w-3 rounded-full"
                />
                <Text
                  class={
                    params().palette === p.id
                      ? "text-xs font-bold text-cyan-300"
                      : "text-xs text-zinc-300"
                  }
                >
                  {p.name}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Scanline Switch & Sheet Bottom Actions */}
        <View class="flex-row items-center justify-between border-t border-zinc-800 pt-3">
          <View class="flex-row items-center gap-2.5">
            <Switch
              testID="sheet-scanline-switch"
              checked={params().scanlines}
              onChange={(checked) => updateParam("scanlines", checked)}
              trackClass="h-6 w-11 rounded-full bg-zinc-700 p-0.5 checked:bg-cyan-500"
              thumbClass="h-5 w-5 rounded-full bg-white checked:translate-x-5"
            />
            <Text class="text-xs font-medium text-zinc-300">CRT 扫描线</Text>
          </View>

          <View class="flex-row gap-2">
            <View
              testID="sheet-reset-focus-btn"
              onPress={() => {
                interaction.update((st) => ({
                  ...st,
                  focusX: 0,
                  focusY: 0,
                  pulse: 0.6,
                }));
              }}
              role="button"
              class="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2"
            >
              <Text class="text-xs font-semibold text-zinc-300">视角归零</Text>
            </View>
            <View
              testID="sheet-save-preset-btn"
              onPress={() => {
                void saveCurrentToVault();
                tunerOpen.set(false);
              }}
              role="button"
              class="rounded-xl bg-cyan-500 px-4 py-2 active:bg-cyan-400"
            >
              <Text class="text-xs font-bold text-zinc-950">保存到收藏</Text>
            </View>
          </View>
        </View>
      </Sheet>
    </View>
  );
}

mount(App);
