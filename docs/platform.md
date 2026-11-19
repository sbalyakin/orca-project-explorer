# Orca plugin platform: what the host gives and takes

Facts about Orca's plugin system that the code does not show. The installed Orca is 1.4.263 (checked 2026-11-19). Facts dated 2026-11-17 were checked on 1.4.261 (Host API 1.10, `pluginApi: 1`); a dated fact is older than the app, so re-check it before you rely on it. Which methods the host offers and which need the CLI: `host-api.md`; the data the tree is built from: `host-data.md`.

## Limits that shaped the design

- No API for the left project list (row, `+`, `...` menu) and no modal windows. `sidebarCards` is reserved. A plugin draws only inside its own panel.
- Orca's own "Create worktree" window has no host method (only `workspace.create`, no UI; sources read 2026-11-17). The header `+` menu item "Create new workspace" opens it by sending the `workspace.create` shortcut with `orca computer hotkey --app com.stablyai.orca --key <chord>` (`src/newworktree.ts`). Fragile: needs the Accessibility permission.
  - The default is `Mod+N` (`window-shortcut-policy.js`). The chord comes from `~/.orca/keybindings.json`: `platforms.darwin` beats `keybindings`, values are string arrays, `[]` means unbound (format read from Orca's `parser.js`, 2026-11-17).
  - Checked 2026-11-17: from a shell with `CmdOrCtrl+N` the window opened with Orca in the background; on the live panel (by the user) `+` works with a rebound shortcut.
  - Punctuation: the CLI takes `CmdOrCtrl+,` and refuses `CmdOrCtrl+Comma` (`unsupported key`), so `KEYS` sends characters (checked 2026-11-17 for `,` only; the other characters in `KEYS` are not checked).
- The menu is a `div` inside the HTML panel. `contextmenu` from the iframe reaches the panel code (2026-11-17, checked on the live panel). A menu cannot leave the panel frame.
- A component panel (`ui: components`) does not fit: its `Tree` has no right-click.
- A plugin cannot open a browser tab (no method).
- No network from a plugin: requests outside the plugin's own files fail, so remote favicons cannot be used. Files ship with the plugin (limits: 2000 files, 50 MiB).
- The model catalog Orca shows is internal (`agentSession.modelCatalog`). The plugin asks the agents' own CLIs instead (see `launching.md`).

## Panel and worker

- Manifest: `orca-plugin.json`. `id` must be kebab-case (`a-z`, `0-9`, dashes; no dots — Orca adds the `local.` or author prefix itself; checked 2026-11-19). `orca plugin validate .` checks the manifest; `orca plugin test .` does not. Panel `project-tree` is `ui: html` with entry `src/panel/index.html`, which loads `main.ts` as a module; Orca transpiles `.ts`, there is no build step. The worker (`main`) is `trusted-worker`.
- With a `.ts` entry Orca serves a bare page (`<div id="root">` plus the module), so the panel stays white until every module has loaded. `index.html` sets `--panel-bg` and the page background for the first paint (2026-11-17). It needs no `<!doctype html>`: Orca's shell (`buildPluginGuestShellHtml`) puts one before it, and the panel runs in standards mode (`document.compatMode` is `CSS1Compat`, checked 2026-11-17).
- Orca mounts a panel only while its tab is shown (`right-sidebar-panel-content.tsx`): every tab switch is a fresh document, module load and `tree.load` (checked 2026-11-17, Orca 1.4.261).
- Orca stops an idle worker after 5 minutes (`PLUGIN_WORKER_IDLE_REAP_MS`). A cold `tree.load` measured 1.2-1.9 s while it waited for looks, 0.8 s since it does not (worker start alone; checked 2026-11-17); a warm one about 20 ms; modules load in about 90 ms. So the panel draws the last tree from `orca.storage` key `tree:v1` first (shown at about 105 ms, checked 2026-11-17). Panel `orca.storage` is served by Orca's main process, not the worker.
- `orca.storage` limits: 256 KiB per value, 5 MiB total (`plugin-host-api-storage-schemas.ts`). Uploaded project images came at up to 216 KB each (tree 503 KB), so the panel shrinks them to 48 px on a canvas (`thumbs.ts`) before drawing and caching; the cached tree is 40 KB (2026-11-17).
- Timing the panel: `console.warn` from the frame shows in `orca plugin logs`; `orca plugin restart local.project-explorer` gives a cold worker; switching to another plugin's panel with `orca plugin open <key>` and back remounts ours.
- The panel imports only `orca`, `orca/*` and relative files. Worker bare imports resolve as Node, but there is no `node_modules`; `orca/worker` is types only.
- Panel and worker talk through `declare module 'orca'` interfaces (`PluginRequests`, `PluginPanelEvents`) in `src/protocol.ts`. Worker side: `orca.panels.handle` and `orca.panels.post`. Panel side: `orca.plugin.request` and `orca.plugin.on`.
- Worker answers must be plain JSON. A key set to `undefined` fails with `answered with a non-JSON value`: leave the key out. Handler literals need `as const` (`{ opened: true as const }`) to satisfy the declared type.
- Module names carry one dot at most. A file named `agent-icons.generated.ts` made the panel blank: `module './icons.ts' does not provide an export named 'icon'`. Orca does not append `.ts` to an import whose name already looks like it has an extension.
- Colours, theme tokens and the font (`theme.get`, `font.face`, Geist) are in `theme-font.md`.

## Capabilities in use

`workspace:read`, `workspace:write`, `terminal:send`, `agent:read`, `storage:own`. `agent:launch` is not requested: launching goes through the CLI (see `launching.md`). `engines.orca` is `>=1.4.259`.

## Dev loop

- Orca reloads the plugin and restarts its worker when its files change; `orca plugin dev reload .` says so itself (checked 2026-11-19). So an edit needs no manual reload. Run it only to re-check approval or to force a reload.
- `orca plugin dev reload .` printed `already approved` and needed no `--approve` (checked 2026-11-19). On 2026-11-17 it asked for approval on every reload, so the fingerprint may still be needed after the capability set changes: it is in `error.data.approvalFingerprint`, and the call is `--approve <fingerprint>`. `plugin dev watch` streams logs and reloads until Ctrl-C.
- `orca plugin shot` takes the plugin key (`local.project-explorer`), not a path, and ignores `--act` for HTML panels. `--theme` needs a hidden window; `--height` and `--in-place` are editor-only.
- `orca plugin dev request . <name> --data '<json>' --json` calls a worker handler directly. Use it to test the worker without the UI.
- `orca plugin logs local.project-explorer` shows `[frame]` and worker errors. A blank panel is a module load failure until the log says otherwise.
- Live right-click and hover checks need computer use: pass `target: { scope: "app", pid, target_id }` and the `coordinate_token` from the latest screenshot. `pid` and `target_id` change when Orca restarts.
- A test run leaves tabs behind (`orca agent launch` opens real ones). Close them with `orca terminal close --terminal <handle> --tab`.

## Machine environment

- A GUI-started Orca has a thin `PATH` and does not read `~/.zshenv`. `src/catalog/run.ts` also searches `~/.local/bin`, `~/.opencode/bin`, `/opt/homebrew/bin` and the like. OpenCode's wrapper `opencode-jb` goes before `opencode`.
- Which Orca to read (2026-11-19): the installed app is the source of truth, `/Applications/Orca.app/Contents/Resources/app.asar.unpacked/out/` (compiled but readable JS; `defaults read /Applications/Orca.app/Contents/Info CFBundleShortVersionString` gives the version, 1.4.263). The checkout `~/Space/Development/_external/orca` is for `.tsx` components and `build.py` only: it is detached at `v1.4.261`, two versions behind, and the newest tag it has is `v1.4.261` (`git fetch --tags` failed: no remote access). Run `git -C ~/Space/Development/_external/orca describe --tags` and compare it with the app's version before you trust a comparison; on `main` its `package.json` version lagged the app.
- Plugins get only 5 events (`PLUGIN_EVENT_NAMES`, same on 1.4.261; not rechecked on 1.4.263): no event for project add, rename, icon or colour. Orca's own `repos:changed` goes to its window only (checked 2026-11-17).
