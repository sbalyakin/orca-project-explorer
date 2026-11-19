# Panel theme, colours and font

How the panel gets Orca's look when the plugin API gives it almost nothing. Moved out of `platform.md` on 2026-11-19; facts keep their original dates, and those dated 2026-11-17 were checked on Orca 1.4.261.

## Theme tokens

- Orca gives frames `--orca-*` CSS variables and a `light` or `dark` class on `<html>`. `orca.on('theme')` fires after both changed. Without a `font-family` the panel renders in a serif font.
- The left sidebar's colours (`--worktree-sidebar*`, `renderer/src/assets/main.css`) are not among the 22 tokens plugins get (`PANEL_DESIGN_TOKEN_ALLOWLIST`), and no host method reads the theme. The worker's `theme.get` (`src/apptheme.ts`) reads them from the database, see the next section.
- `--unread`, `--agent-working` and `--agent-question` are not passed either, so `style.ts` hardcodes them (see `Colours copied from Orca`).

## Sidebar colours: `theme.get` (checked 2026-11-17)

Source: `sqlite3 -readonly` on Orca's `profile-state.db`. Fragile like the font used to be: a private DB and a folder layout.

- Keys read: `leftSidebarAppearanceMode`, `leftSidebarTintColor`, `leftSidebarTintOpacity`, `pluginAppThemeLight`, `pluginAppThemeDark`.
- A slot `plugin:<publisher.id>/<theme id>` is found through `plugins/plugins.lock.json` (`contentHash` is the version folder; the folder can hold older versions with other colours) and that plugin's `orca-plugin.json` (`contributes.themes[].path`).
- The theme file's `tokens` hold `--worktree-sidebar`, `--worktree-sidebar-accent`, and for the open workspace's card `--worktree-sidebar-active` and `--worktree-sidebar-active-border`. A theme without them, the built-ins and `tinted` give none; the panel then derives them from the text colour as `main.css` does. Checked on `jiangwanyutao.claude-theme`: border `#D97757`.
- Empty slot: Orca's built-ins (light `#f5f5f5`/`#eaeaea`, dark `#2a2a2a`/`#353535`).
- Mode `tinted`: `color-mix(tint N%, var(--orca-background))` as `left-sidebar-appearance.ts` does; the accent is the text colour at 9% over it.
- `match-terminal`, a bad slot or an unknown plugin or theme gives `null`, and the panel shows the estimate in `index.html`: light `--orca-muted` 62% over `--orca-background` (exactly `#f0eee6` in Claude light), dark `--orca-background`.
- A read that fails now (sqlite timeout, moved database, theme folder missing while the lock file already names a new version, broken JSON) rejects instead. The panel's `catch` then keeps the colours on screen and in `sidebar:v1`. Keep it that way: `null` must mean "no such theme" only.
- The panel sets `--panel-bg` and `--panel-accent` inline for the base it is in, caches the answer under `sidebar:v1`, and reads again on each look and on `theme`.
- Dark with the Claude theme: panel and sidebar both measured `rgb(32 32 30)` on the live panel, open row `rgb(46 46 43)`. Not checked live: light theme, `tinted`, a built-in theme.

## Colours copied from Orca

- Unread dot: blue as in Orca's sidebar (`bg-unread`: `--color-blue-500` light, `--color-blue-400` dark, `renderer/src/assets/main.css`), hardcoded as Tailwind's oklch values. Red was dropped: Orca keeps red for failures (comment in `WorktreeCardSlot.tsx`). Checked 2026-11-17.
- Row hover: `worktree-sidebar-accent/55`, dark `foreground/[0.035]` (`worktree-card-compact-agents.tsx`, 2026-11-17).
- Group folder icons: `#737373`, Orca's `DEFAULT_REPO_BADGE_COLOR` (`repo-badge-color.ts`), the colour of a default project icon in the left list (user request 2026-11-17).
- Agent status glyphs and colours are in `host-data.md`, `Agent status`.

## Font

The panel uses `var(--orca-font-sans)` (2026-11-18). `--orca-font-mono` exists too.

- Orca gives frames the variable since 1.4.262 (PR [stablyai/orca#43282](https://github.com/stablyai/orca/pull/43282), merge `f7ddbb6`) and updates it in place with the `theme` event. Checked in the installed app's `plugin-panel-design-tokens.js`; not yet seen in our live panel.
- On 1.4.261 the variable is empty and the stylesheet falls back to `'Geist'`, then system fonts. `engines.orca` is `>=1.4.259`.
- Orca's own Geist is not in frames, so the panel ships it: `build.py` -> `src/panel/font-data.ts` as a data URI (CSP allows `font-src data:` only). Without it the default setting would render as the fallback. Orca's body also sets `letter-spacing: 0.01em` and `-webkit-font-smoothing: antialiased`; the panel copies both (not checked on the live panel).

### A font a plugin contributes

- Orca names it `<family> (<pluginKey>)` (`plugin-font-contribution.ts`), and the name is missing in frames. Checked 2026-11-18: with `gongxliang.claude-paper` the stack began with `"IBM Plex Mono (gongxliang.claude-paper)"` and the panel drew Geist.
- So the worker's `font.face` (`src/pluginfont.ts`) finds the plugin folder through `plugins.lock.json` and reads the upright faces from `contributes.fonts`, one per reply (a face is about 50 KB, a reply 67 KB, passed on the bridge, checked 2026-11-18). The panel declares them with `@font-face` data URIs (`src/panel/fontload.ts`, on start, on each look and on `theme`).
- Checked 2026-11-18 by `orca plugin shot`: the panel drew IBM Plex Mono. With the system font `SF Pro` chosen it drew that and kept no plugin font.
- A face over 150 KB is skipped, the others still draw.

### The cache

- The last answer is kept in `orca.storage` and drawn before the cached tree. A panel may send the host at most 64 KiB per message (`PANEL_MESSAGE_MAX_BYTES`), and one face is about 67 KB as base64: a single `orca.storage.set` failed with `Error: message too large` (checked 2026-11-18).
- So the cache is written in 40 000-character pieces (`pluginfont:v1:<n>`) and its description (`pluginfont:v1`) last. The cut and the join live in `src/fontcache.ts` (tested).
- Loading starts at once beside the storage reads: without a cache the font came at about 300 ms, with it at about 100 ms, the same moment as the first frame (log times from the panel, 2026-11-18, IBM Plex Mono). The user saw no flash on reopening (2026-11-18).
- Accepted: with a cache hit the files are not read again, so a plugin that updates a font under the same name shows the old one until the font is switched.
- Not checked: a cold worker with no cache, a font with a different weight set.

### Dropped

The earlier workaround, a worker `font.get` reading `appFontFamily` from `profile-state.db` through `sqlite3` (`src/appfont.ts`), was removed 2026-11-18. The sidebar colours still use that DB trick (`theme.get`).
