# The data the tree is built from

What `workspace.list`, `project.list`, `orca project list` and agent events give, and the quirks in them. Moved out of `platform.md` on 2026-11-19; dates are original. The methods themselves and their capabilities: `host-api.md`.

## Host data

- `project.list` plus `workspace.list({ includeStatus: true })` are the only data sources; no CLI for the tree.
- `project.list` drops the icon and colour. They come from `orca project list --json` (`repoIcon`, `badgeColor`), matched by `sourceRepoIds` (the host `projectId` is a repo uuid; the CLI row id is `repo:<uuid>` or `git:...`). Code: `src/appearance.ts` (checked 2026-11-17).
  - The command takes about 1 s (more with favicon fetches), so `createLooksCache` never waits: every `tree.load` answers from memory and refreshes behind.
  - A worker just started answers `looksPending: true` with no looks; the panel keeps the icons it shows (`keepLooks`) and does not cache that tree.
  - When a refresh brings different looks the worker posts `tree.changed` and the panel reloads, so a new project's icon shows within a second (2026-11-17).
- `repoIcon` types: `lucide` (one of 20 names from Orca's `repo-icon.tsx`, shapes in the generated `src/panel/lucide-data.ts`), `emoji`, `image` with `source` `upload` or `file` (data URI, works), `favicon` or `github` (https URL). The panel blocks them (`blocked img-src ... plugin frames have no network`), but the worker has network: `inlineRemoteIcons` fetches them and sends data URIs (checked 2026-11-17). If the fetch fails the row shows the default `Box` in the badge colour. No icon: Orca draws `Folder`, the panel draws `Box` instead (chosen by the user 2026-11-17: a folder looks like a group row). An unknown lucide name still gives `Folder`, as in Orca.
- `workspace.list` ids match `workspace.readContext.workspaceId`: `identity:wt2:local:<uuid>` for worktrees, `<uuid>::<path>` for folders. Host `projectId` is the repository uuid (the CLI reports a shared `git:...` identity instead).
- A project's main checkout is the workspace whose `path` equals the project path. Linked worktrees nest under it. A project with worktrees besides the main checkout is drawn as a folding row (`isProjectFolder`, `types.ts`): it keeps the main checkout's `workspaceId` for menus and the project picker, but shows no status or text and opens nothing; its first child is the main checkout again (`primary`, key `ws:<id>:primary`, home icon, label = project name, branch as text). Any code that looks a workspace up by id or opens one must test `isOpenable(node)` (`types.ts`), which skips the folding row; without it the lookup finds the folding row before the primary.
- Event ids from `workspace.changed` equal the ids in `workspace.list`.

## Agent status

- `workspace.list` `status.state` is `working | permission | done | active | inactive`. Orca's sidebar also has `monitoring` (a yellow `Activity` glyph: the main agent finished its turn, a timer or background task still runs); the plugin API folds it into `working` (checked 2026-11-18, `orca agent list` does too).
- Only `agent.status.changed` leaks the difference: combined `state: working` while `mainAgent.state` is `done` (checked live 2026-11-18, agent waiting on a timer). `panel/monitoring.ts` keeps one entry per `paneKey` and marks a `working` workspace `monitoring` when every pane it has heard from only waits.
  - The map lives in the panel, so after a panel reload a waiting agent shows the spinner until its next event.
  - `prunePanes` drops a pane only for a workspace seen in the previous tree and gone from this one, so an event that beats `tree.load` is kept.
  - Known and accepted (2026-11-18): a workspace that appears and vanishes between two loads leaves one pane entry until the panel closes; it never shows, since `applyMonitoring` reads only workspaces in the tree.
- Glyphs and colours copy Orca: working = spinning ring (`AgentWorkingSpinner`), monitoring = `Activity`, permission = `MessageCircleQuestion`; yellow-500 is `--agent-working` and orange-600/500 is `--agent-question`, both hardcoded in `style.ts` because plugins do not get them.
- A workspace's board status (`workspaceStatus`: `todo`, `in-progress`, `in-review`, `completed`) exists only in the CLI, not in the plugin API. The user chose to show agent status only (2026-11-18).
