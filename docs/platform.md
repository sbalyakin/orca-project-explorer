# Orca plugin platform: what the host gives and takes

Facts about Orca's plugin system that the code does not show. Verified on Orca 1.4.261 (Host API 1.10, `pluginApi: 1`) unless dated otherwise.

## Limits that shaped the design

- No API for the left project list (row, `+`, `...` menu) and no modal windows. `sidebarCards` is reserved. A plugin draws only inside its own panel.
- The menu is a `div` inside the HTML panel. `contextmenu` from the iframe reaches the panel code (2026-11-17, checked on the live panel). A menu cannot leave the panel frame.
- A component panel (`ui: components`) does not fit: its `Tree` has no right-click.
- A plugin cannot open a browser tab (no method).
- No network from a plugin: requests outside the plugin's own files fail, so remote favicons cannot be used. Files ship with the plugin (limits: 2000 files, 50 MiB).
- The model catalog Orca shows is internal (`agentSession.modelCatalog`). The plugin asks the agents' own CLIs instead (see `launching.md`).

## Panel and worker

- Manifest: `orca-plugin.json`. Panel `project-tree` is `ui: html` with entry `src/panel/index.html`, which loads `main.ts` as a module; Orca transpiles `.ts`, there is no build step. The worker (`main`) is `trusted-worker`.
- With a `.ts` entry Orca serves a bare page (`<div id="root">` plus the module), so the panel stays white until every module has loaded. `index.html` sets `--panel-bg` and the page background for the first paint (2026-11-17). It needs no `<!doctype html>`: Orca's shell (`buildPluginGuestShellHtml`) puts one before it, and the panel runs in standards mode (`document.compatMode` is `CSS1Compat`, checked 2026-11-17).
- Orca mounts a panel only while its tab is shown (`right-sidebar-panel-content.tsx`): every tab switch is a fresh document, module load and `tree.load` (checked 2026-11-17, Orca 1.4.261).
- Orca stops an idle worker after 5 minutes (`PLUGIN_WORKER_IDLE_REAP_MS`). A cold `tree.load` measured 1.2-1.9 s while it waited for looks, 0.8 s since it does not (worker start alone; checked 2026-11-17); a warm one about 20 ms; modules load in about 90 ms. So the panel draws the last tree from `orca.storage` key `tree:v1` first (shown at about 105 ms, checked 2026-11-17). Panel `orca.storage` is served by Orca's main process, not the worker.
- `orca.storage` limits: 256 KiB per value, 5 MiB total (`plugin-host-api-storage-schemas.ts`). Uploaded project images came at up to 216 KB each (tree 503 KB), so the panel shrinks them to 48 px on a canvas (`thumbs.ts`) before drawing and caching; the cached tree is 40 KB (2026-11-17).
- Timing the panel: `console.warn` from the frame shows in `orca plugin logs`; `orca plugin restart local.project-tree` gives a cold worker; switching to another plugin's panel with `orca plugin open <key>` and back remounts ours.
- The panel imports only `orca`, `orca/*` and relative files. Worker bare imports resolve as Node, but there is no `node_modules`; `orca/worker` is types only.
- Panel and worker talk through `declare module 'orca'` interfaces (`PluginRequests`, `PluginPanelEvents`) in `src/protocol.ts`. Worker side: `orca.panels.handle` and `orca.panels.post`. Panel side: `orca.plugin.request` and `orca.plugin.on`.
- Worker answers must be plain JSON. A key set to `undefined` fails with `answered with a non-JSON value`: leave the key out. Handler literals need `as const` (`{ opened: true as const }`) to satisfy the declared type.
- Module names carry one dot at most. A file named `agent-icons.generated.ts` made the panel blank: `module './icons.ts' does not provide an export named 'icon'`. Orca does not append `.ts` to an import whose name already looks like it has an extension.
- The left sidebar's colours (`--worktree-sidebar*`, `renderer/src/assets/main.css`) are not among the 22 tokens plugins get (`PANEL_DESIGN_TOKEN_ALLOWLIST`), and no host method reads the theme. `src/panel/index.html` estimates them: light `--panel-bg` is `--orca-muted` 62% over `--orca-background`, which gives exactly `#f0eee6` in the Claude light theme the user runs (checked 2026-11-17 by sampling a screenshot); `--panel-accent` is `--orca-accent`, equal to `--worktree-sidebar-accent` there. In other themes it is only an estimate. Dark: not matched, `--orca-background` (not verified). Orca's own defaults, if ever needed: light `#f5f5f5`/`#eaeaea`, dark `#2a2a2a`/`#353535`.
- Group folder icons use `#737373`, Orca's `DEFAULT_REPO_BADGE_COLOR` (`repo-badge-color.ts`), the colour of a default project icon in the left list (user request 2026-11-17).
- Theme: `--orca-*` CSS variables and a `light` or `dark` class on `<html>`; `orca.on('theme')` fires after both changed. Without a font-family the panel renders in a serif font.
- Font: the user picks the interface font in Orca settings (`appFontFamily`, default `Geist`); Orca sets it as `--app-font-family` on its own `<html>`. `--font-sans` is not among the frame tokens, so `var(--orca-font-sans)` is empty, and no host method or event carries the font (checked 2026-11-17 in `src/shared/plugins`). Without a stack the panel falls back to `system-ui`.
- How the panel gets the font (2026-11-17): the worker's `font.get` (`src/appfont.ts`) runs `/usr/bin/sqlite3 -readonly` on `~/Library/Application Support/orca/profiles/local-default/profile-state.db`, table `profile_state_documents`, `domain = 'settings'`, `json_extract(payload, '$.appFontFamily')`, and builds the stack as Orca's `buildAppFontFamily` does. The panel sets `--app-font` at start and on each look (no font-change event). Fragile: private DB, profile name `local-default`; on any failure it gives Orca's default stack. The old `orca-data.json` next to it is a stale export (it said `SF Pro` while the live value was `SF Mono`).
- Geist is embedded (`build.py` -> `src/panel/font-data.ts`, data URI; CSP allows `font-src data:` only) because it is not a system font: without it the default setting would render as the fallback. Orca's body also sets `letter-spacing: 0.01em` and `-webkit-font-smoothing: antialiased`; the panel copies both. Not checked on the live panel.

## Capabilities in use

`workspace:read`, `workspace:write`, `terminal:send`, `agent:read`, `storage:own`, `settings:own`. `agent:launch` is not requested: launching goes through the CLI (see `launching.md`). `engines.orca` is `>=1.4.259`.

## Host data

- `project.list` plus `workspace.list({ includeStatus: true })` are the only data sources; no CLI for the tree.
- `project.list` drops the icon and colour. They come from `orca project list --json` (`repoIcon`, `badgeColor`), matched by `sourceRepoIds` (the host `projectId` is a repo uuid; the CLI row id is `repo:<uuid>` or `git:...`). Code: `src/appearance.ts` (checked 2026-11-17). The command takes about 1 s (more with favicon fetches), so `createLooksCache` never waits: every `tree.load` answers from memory and refreshes behind. A worker just started answers `looksPending: true` with no looks; the panel keeps the icons it shows (`keepLooks`) and does not cache that tree. When a refresh brings different looks the worker posts `tree.changed` and the panel reloads, so a new project's icon shows within a second (2026-11-17).
- `repoIcon` types: `lucide` (one of 20 names from Orca's `repo-icon.tsx`, shapes in the generated `src/panel/lucide-data.ts`), `emoji`, `image` with `source` `upload` or `file` (data URI, works), `favicon` or `github` (https URL). The panel blocks them (`blocked img-src ... plugin frames have no network`), but the worker has network: `inlineRemoteIcons` fetches them and sends data URIs (checked 2026-11-17). If the fetch fails the row shows the default `Box` in the badge colour. No icon: Orca draws `Folder`, the panel draws `Box` instead (chosen by the user 2026-11-17: a folder looks like a group row). An unknown lucide name still gives `Folder`, as in Orca.
- `workspace.list` ids match `workspace.readContext.workspaceId`: `identity:wt2:local:<uuid>` for worktrees, `<uuid>::<path>` for folders. Host `projectId` is the repository uuid (the CLI reports a shared `git:...` identity instead).
- A project's main checkout is the workspace whose `path` equals the project path. Linked worktrees nest under it.
- Event ids from `workspace.changed` equal the ids in `workspace.list`.

## Dev loop

- `orca plugin dev reload . --approve <fingerprint>` asks for approval on every reload. The fingerprint is in `error.data.approvalFingerprint` and changes with the capability set.
- `orca plugin shot` takes the plugin key (`local.project-tree`), not a path, and ignores `--act` for HTML panels. `--theme` needs a hidden window; `--height` and `--in-place` are editor-only.
- `orca plugin dev request . <name> --data '<json>' --json` calls a worker handler directly. Use it to test the worker without the UI.
- `orca plugin logs local.project-tree` shows `[frame]` and worker errors. A blank panel is a module load failure until the log says otherwise.
- Live right-click and hover checks need computer use: pass `target: { scope: "app", pid, target_id }` and the `coordinate_token` from the latest screenshot. `pid` and `target_id` change when Orca restarts.
- A test run leaves tabs behind (`orca agent launch` opens real ones). Close them with `orca terminal close --terminal <handle> --tab`.

## Machine environment

- A GUI-started Orca has a thin `PATH` and does not read `~/.zshenv`. `src/catalog/run.ts` also searches `~/.local/bin`, `~/.opencode/bin`, `/opt/homebrew/bin` and the like. OpenCode's wrapper `opencode-jb` goes before `opencode`.
- The Orca source checkout is `~/Space/Development/_external/orca`. It is detached at tag `v1.4.261`, the installed app's version (checked 2026-11-17). On `main` its `package.json` version lagged the app, so check out the app's tag (`git fetch --tags`) rather than trusting the file.
- Plugins get only 5 events (`PLUGIN_EVENT_NAMES`, same on 1.4.261): no event for project add, rename, icon or colour. Orca's own `repos:changed` goes to its window only (checked 2026-11-17).
