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

- Manifest: `orca-plugin.json`. Panel `project-tree` is `ui: html` with a `.ts` entry; Orca transpiles it, there is no build step. The worker (`main`) is `trusted-worker`.
- The panel imports only `orca`, `orca/*` and relative files. Worker bare imports resolve as Node, but there is no `node_modules`; `orca/worker` is types only.
- Panel and worker talk through `declare module 'orca'` interfaces (`PluginRequests`, `PluginPanelEvents`) in `src/protocol.ts`. Worker side: `orca.panels.handle` and `orca.panels.post`. Panel side: `orca.plugin.request` and `orca.plugin.on`.
- Worker answers must be plain JSON. A key set to `undefined` fails with `answered with a non-JSON value`: leave the key out. Handler literals need `as const` (`{ opened: true as const }`) to satisfy the declared type.
- Module names carry one dot at most. A file named `agent-icons.generated.ts` made the panel blank: `module './icons.ts' does not provide an export named 'icon'`. Orca does not append `.ts` to an import whose name already looks like it has an extension.
- The left sidebar's colours (`--worktree-sidebar*`, `renderer/src/assets/main.css`) are not among the 22 tokens plugins get (`PANEL_DESIGN_TOKEN_ALLOWLIST`), and no host method reads the theme. `src/panel/style.ts` estimates them: light `--panel-bg` is `--orca-muted` 62% over `--orca-background`, which gives exactly `#f0eee6` in the Claude light theme the user runs (checked 2026-11-17 by sampling a screenshot); `--panel-accent` is `--orca-accent`, equal to `--worktree-sidebar-accent` there. In other themes it is only an estimate. Dark: not matched, `--orca-background` (not verified). Orca's own defaults, if ever needed: light `#f5f5f5`/`#eaeaea`, dark `#2a2a2a`/`#353535`.
- Theme: `--orca-*` CSS variables and a `light` or `dark` class on `<html>`; `orca.on('theme')` fires after both changed. Use `var(--orca-font-sans, system-ui)`; without the fallback the panel renders in a serif font.

## Capabilities in use

`workspace:read`, `workspace:write`, `terminal:send`, `agent:read`, `storage:own`, `settings:own`. `agent:launch` is not requested: launching goes through the CLI (see `launching.md`). `engines.orca` is `>=1.4.259`.

## Host data

- `project.list` plus `workspace.list({ includeStatus: true })` are the only data sources; no CLI for the tree.
- `project.list` drops the icon and colour. They come from `orca project list --json` (`repoIcon`, `badgeColor`), matched by `sourceRepoIds` (the host `projectId` is a repo uuid; the CLI row id is `repo:<uuid>` or `git:...`). Code: `src/appearance.ts` (checked 2026-11-17). The command takes about 1 s, so `createLooksCache` waits for it only on the first load; later loads answer from memory and refresh behind, or the status dot would lag by that second on every `agent.status.changed`. A new project's icon shows one load late (2026-11-17).
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
- The Orca source checkout is `~/Space/Development/_external/orca`. Its `package.json` version lags the installed app; compare against the app, not the file.
