#!/usr/bin/env node
// Renders 1600x1000 showcase slides and cover.png from raw panel shots using headless Chromium.
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const RAW_DIR = join(ROOT, '.orca', 'raw-shots')
const OUT_DIR = join(ROOT, 'images')

function findChromium() {
  const cache = join(homedir(), 'Library', 'Caches', 'ms-playwright')
  if (existsSync(cache)) {
    const dirs = readdirSync(cache).filter((d) => d.startsWith('chromium_headless_shell-')).sort().reverse()
    for (const dir of dirs) {
      const sub = join(cache, dir)
      for (const arch of readdirSync(sub)) {
        const bin = join(sub, arch, 'chrome-headless-shell')
        if (existsSync(bin)) return bin
      }
    }
  }
  throw new Error('chrome-headless-shell not found in ~/Library/Caches/ms-playwright')
}

function dataUri(path) {
  const ext = path.endsWith('.jpg') || path.endsWith('.jpeg') ? 'jpeg' : 'png'
  return `data:image/${ext};base64,${readFileSync(path).toString('base64')}`
}

const SLIDES = [
  {
    num: 1,
    title: 'All workspaces\nat a glance',
    bullets: [
      'Live agent status dots: working, unread, and waiting on permission',
      'Git branch names and relative activity time on every row',
      'Nested worktrees under each project with instant filtering'
    ]
  },
  {
    num: 2,
    title: 'Folders, favorites,\nand agent replies',
    bullets: [
      'Pin active projects and worktrees to Favorites at the top',
      'Group repositories by folder hierarchy with optional tree guides',
      'Preview the latest agent message or chat title inline'
    ]
  },
  {
    num: 3,
    title: 'Minimal view,\ntailored to your flow',
    bullets: [
      'Tune folder markers, tree guides, density, and details in Display options',
      'Sort by name, recent activity, status, or drag-and-drop manual order',
      'Right-click any row to open a terminal or launch an agent'
    ]
  }
]

const DARK_BG = `
  radial-gradient(circle at 82% 22%, rgba(226, 152, 102, 0.24) 0%, transparent 50%),
  radial-gradient(circle at 18% 82%, rgba(168, 142, 202, 0.20) 0%, transparent 52%),
  linear-gradient(135deg, #241f29 0%, #2f2833 52%, #28212b 100%)
`

function slideHtml({ theme, title, bullets, iconSrc, panelSrc }) {
  const dark = theme === 'dark'
  const bg = dark
    ? DARK_BG
    : 'radial-gradient(circle at 82% 22%, #f5e6d8 0%, #f3eef8 48%, #faf8f6 100%)'
  const fg = dark ? '#faf6f2' : '#18141f'
  const muted = dark ? '#d3c8c2' : '#433c52'
  const brand = dark ? '#a69894' : '#655c78'
  const accent = dark ? '#e59a54' : '#c2590a'
  const cardBorder = dark ? 'rgba(255,244,234,0.14)' : 'rgba(24,20,31,0.12)'
  const shadow = dark
    ? '18px 32px 80px rgba(0,0,0,0.68), 0 0 0 1px rgba(255,255,255,0.05)'
    : '18px 32px 72px rgba(32,20,48,0.16), 0 0 0 1px rgba(24,20,31,0.06)'

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 1600px; height: 1000px; overflow: hidden; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", system-ui, sans-serif;
    background: ${bg};
    color: ${fg};
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 84px 104px;
    gap: 72px;
  }
  .copy { flex: 1; max-width: 710px; }
  .brand {
    display: flex; align-items: center; gap: 16px;
    margin-bottom: 36px;
    font-size: 24px; font-weight: 500; color: ${brand};
  }
  .brand img { width: 46px; height: 46px; border-radius: 11px; box-shadow: 0 6px 18px rgba(0,0,0,0.28); }
  h1 {
    font-size: 74px; line-height: 1.06; font-weight: 700; letter-spacing: -0.03em;
    white-space: pre-line; margin-bottom: 44px;
  }
  ul { list-style: none; display: flex; flex-direction: column; gap: 26px; }
  li {
    display: flex; align-items: flex-start; gap: 18px;
    font-size: 28px; line-height: 1.38; color: ${muted};
  }
  li::before {
    content: ""; flex: 0 0 12px; width: 12px; height: 12px; margin-top: 13px;
    border-radius: 3px; background: ${accent};
  }
  .shot-wrap {
    flex: 0 0 auto;
    display: flex; align-items: center; justify-content: center;
    perspective: 1400px;
  }
  .shot {
    width: 520px;
    max-height: 830px;
    object-fit: cover;
    object-position: top;
    border-radius: 18px;
    border: 1px solid ${cardBorder};
    box-shadow: ${shadow};
    transform: rotateY(-7deg) rotateX(2.5deg) rotateZ(0.5deg);
    transform-style: preserve-3d;
    display: block;
  }
</style>
</head>
<body>
  <div class="copy">
    <div class="brand"><img src="${iconSrc}" alt="" /><span>Project Explorer for Orca</span></div>
    <h1>${title}</h1>
    <ul>${bullets.map((b) => `<li>${b}</li>`).join('')}</ul>
  </div>
  <div class="shot-wrap">
    <img class="shot" src="${panelSrc}" alt="" />
  </div>
</body>
</html>`
}

function coverHtml({ iconSrc, lightSrc, darkSrc }) {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 1600px; height: 1000px; overflow: hidden; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", system-ui, sans-serif;
    background: ${DARK_BG};
    color: #f4faf8;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 84px 92px;
    position: relative;
  }
  .copy { width: 630px; z-index: 2; }
  .icon { width: 112px; height: 112px; border-radius: 26px; box-shadow: 0 18px 44px rgba(0,0,0,0.45); margin-bottom: 36px; display: block; }
  h1 { font-size: 86px; line-height: 1.02; font-weight: 700; letter-spacing: -0.03em; margin-bottom: 28px; }
  p { font-size: 32px; line-height: 1.4; color: rgba(226,245,240,0.82); font-weight: 400; }
  .panels { position: relative; width: 770px; height: 840px; perspective: 1500px; }
  .panel {
    position: absolute;
    width: 435px;
    max-height: 760px;
    object-fit: cover;
    object-position: top;
    border-radius: 18px;
    display: block;
  }
  .panel.light {
    left: 16px; top: 84px;
    transform: rotateY(-8deg) rotateX(3deg) rotateZ(-2.5deg);
    border: 1px solid rgba(255,255,255,0.35);
    box-shadow: 18px 30px 72px rgba(0,0,0,0.42);
  }
  .panel.dark {
    right: 6px; top: 22px;
    transform: rotateY(-6deg) rotateX(2.5deg) rotateZ(0.8deg);
    border: 1px solid rgba(226,245,240,0.16);
    box-shadow: 22px 36px 86px rgba(0,0,0,0.68);
  }
</style>
</head>
<body>
  <div class="copy">
    <img class="icon" src="${iconSrc}" alt="" />
    <h1>Project Explorer</h1>
    <p>Navigate projects and worktrees as a folder tree, track live agent status, and launch sessions from Orca's sidebar.</p>
  </div>
  <div class="panels">
    <img class="panel light" src="${lightSrc}" alt="" />
    <img class="panel dark" src="${darkSrc}" alt="" />
  </div>
</body>
</html>`
}

const chromium = findChromium()
const iconSrc = dataUri(join(OUT_DIR, 'icon.png'))
const tmpHtml = join(RAW_DIR, '_slide.html')

const tmpPng = join(RAW_DIR, '_slide.png')

function renderHtml(html, outPath) {
  writeFileSync(tmpHtml, html)
  execFileSync(chromium, [
    '--headless',
    '--disable-gpu',
    '--hide-scrollbars',
    '--window-size=1600,1000',
    `--screenshot=${tmpPng}`,
    `file://${tmpHtml}`
  ], { stdio: 'ignore' })
  execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '85', tmpPng, '--out', outPath], { stdio: 'ignore' })
  rmSync(tmpPng, { force: true })
  console.log(`Rendered ${outPath}`)
}

for (const theme of ['dark', 'light']) {
  for (const slide of SLIDES) {
    const raw = join(RAW_DIR, `panel-${theme}-${slide.num}.png`)
    const out = join(OUT_DIR, `screenshot-${theme}-${slide.num}.jpg`)
    renderHtml(slideHtml({ theme, title: slide.title, bullets: slide.bullets, iconSrc, panelSrc: dataUri(raw) }), out)
  }
}

renderHtml(
  coverHtml({
    iconSrc,
    lightSrc: dataUri(join(RAW_DIR, 'panel-light-2.png')),
    darkSrc: dataUri(join(RAW_DIR, 'panel-dark-2.png'))
  }),
  join(OUT_DIR, 'cover.jpg')
)

rmSync(tmpHtml, { force: true })
