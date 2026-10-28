import { expect, open, test } from "nsh/test";

test("switches synth engine modes and opens bottom tuner sheet on Android", async () => {
  const app = await open("./App.tsx", { platform: "android" });

  expect(app.texts()).toContain("SYNTHWAVE // 3D");
  expect(app.texts()).toContain("3D 赛博线框隧道 · 夜之城青紫");

  // Switch to Matrix Digital Rain mode
  await app.press("id:mode-btn-matrix");
  expect(app.texts()).toContain("MATRIX // RAIN");

  // Switch to Retro CRT Oscilloscope mode
  await app.press("id:mode-btn-oscilloscope");
  expect(app.texts()).toContain("CRT // LISSAJOUS");

  // Toggle live animation playback on and off
  await app.press("id:toggle-play-btn");
  expect(app.texts()).toContain("暂停动态");
  await app.press("id:toggle-play-btn");
  expect(app.texts()).toContain("动态播放");

  // Open bottom Sheet parameter tuner and adjust Speed & Palette
  await app.press("id:open-tuner-btn");
  expect(app.texts()).toContain("赛博合成调音台");

  await app.press("id:slider-speed-inc");
  expect(app.texts()).toContain("SPD:7 · DEN:7 · GLW:8");

  await app.press("id:palette-btn-amber");
  expect(app.texts()).toContain("复古 CRT 李萨如示波器 · 复古琥珀管");

  // Save preset from Sheet and verify in Vault tab
  await app.press("id:sheet-save-preset-btn");
  await app.press("收藏夹");
  expect(app.texts()).toContain("我保存的预设 (1)");
  expect(app.texts()).toContain("复古琥珀管 · 示波器 #1");
});

test("browses preset gallery NavStack and imports preset from clipboard", async () => {
  const sharedClipboard = JSON.stringify({
    nsh_synth: 1,
    title: "赛博矩阵极客分享",
    params: {
      mode: "matrix",
      palette: "arasaka",
      speed: 9,
      density: 8,
      glow: 9,
      glitch: 5,
      scanlines: true,
    },
  });

  const app = await open("./App.tsx", {
    platform: "android",
    clipboard: sharedClipboard,
  });

  // Switch to Tab 1 (Preset Gallery)
  await app.press("预设坊");
  expect(app.texts()).toContain("赛博预设与灵感坊");
  expect(app.texts()).toContain("1984 落日超速公路");

  // Push detail page onto NavStack
  await app.press("id:inspect-preset-outrun-overdrive");
  expect(app.texts()).toContain("PRESET INSPECTOR");
  expect(app.texts()).toContain("应用到合成器");

  // Apply preset and return to Synth tab
  await app.press("id:detail-apply-btn");
  expect(app.texts()).toContain("3D 赛博线框隧道 · 落日合成波");

  // Go to Tab 2 (Vault) and import from clipboard
  await app.press("收藏夹");
  await app.press("id:import-code-btn");
  expect(app.texts()).toContain("赛博矩阵极客分享");
});
