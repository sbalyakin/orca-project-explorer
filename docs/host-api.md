# What a plugin can ask Orca for

Read this before you answer "can the plugin do X?" or plan a menu item that changes a workspace or a project. Read from the installed Orca 1.4.263 on 2026-11-19; not run on the live panel except where it says so. Orca's own source is not needed for this.

## Host methods (`orca.host.call`)

| Method | Capability | Notes |
|---|---|---|
| `workspace.list`, `project.list` | `workspace:read` | The tree's two sources (see `host-data.md`). |
| `workspace.readContext` | `workspace:read` | Id, branch, name, terminal ids of the focused workspace. |
| `workspace.open` | `workspace:write` | Shows a workspace. |
| `workspace.rename` | `workspace:write` | Name only, at most 200 characters, one line. Used by `Edit Details…`. |
| `workspace.create` | `workspace:create` | No UI; `agent` param also needs `agent:launch`. |
| `project.setHidden` | `workspace:write` | Hide or show a project. |
| `terminal.list` | `workspace:read` | |
| `terminal.create`, `terminal.close` | `terminal:send` | `terminal.focus` is `workspace:write`. |
| `terminal.read` | `terminal:read` | |
| `agent.launch`, `agent.resume` | `agent:launch` | Not requested: launching goes through the CLI (`launching.md`). |
| `agent.listSessions` | `history:read` | |
| `agents.list` | `agent:read` | Leaves out native chats; `titles` use the CLI for that. |
| `editor.open` | `workspace:write` | Opens a file in Orca's own editor, not an outside app. |
| `commands.run` | `workspace:write` | Closed list, below. |
| `automation.list/create/update/delete` | `automation:read` / `write` | |
| `appearance.read/apply` | `appearance:write` | |
| `editor.readTypography` | none | |

Also in frames and the worker, not in the table above: `storage.*`, `settings.*`, `shell.openExternal` (only `http`, `https`, `mailto`, needs a user action), `files.*`, `notifications.*`, `statusBar.update`.

`commands.run` ids (`shared/plugins/contributions/plugin-command-actions.js`): `worktree.history.back/forward`, `sidebar.left.toggle`, `sidebar.right.toggle`, `sidebar.sleepingWorkspaces.toggle` (opens the sleeping list, does not sleep a workspace), `floatingWorkspace.maximize`, `tab.rename`, `workspace.rename`, `workspace.openBoard`, `view.tasks`, `sidebar.explorer.toggle`, `sidebar.search.toggle`, `sidebar.sourceControl.toggle`, `sidebar.checks.toggle`, `sidebar.ports.toggle`.

Rebuild the list (names, then capability and `since` beside each name):

```sh
cd /Applications/Orca.app/Contents/Resources/app.asar.unpacked/out/shared/plugins/workers
rg -o --no-filename "^    '[a-z]+\.[A-Za-z.]+'" plugin-host-api-*.js | sort -u
rg -n -A5 "^    '[a-z]+\.[A-Za-z.]+': " plugin-host-api-*.js | rg "'[a-z]+\.[A-Za-z.]+': |capability"
```

`workspace.readContext` lives in `main/chunks/plugin-host-api-*.js`, one level up, so the `workers/` commands do not list it.

## What has no host method, and what reaches it instead

Checked 2026-11-18 on the CLI help and the bundle; the CLI rows were not run on folder (`folder:`) workspaces or linked worktrees.

| Action in Orca's workspace menu | Plugin route |
|---|---|
| Edit Details (name) | `workspace.rename`. Comment and links: CLI only, `orca worktree set --comment`, `--issue`, `--pr`. `--display-name` also exists in the CLI (not tried). |
| Mark read / unread | CLI `orca worktree set --read` / `--unread` |
| Parent & Children | CLI `--parent-worktree <selector>` / `--no-parent` |
| Move to Status | CLI `--workspace-status <id>` (defaults `todo`, `in-progress`, `in-review`, `completed`) |
| Delete | CLI `orca worktree rm`; removes user data, only on an explicit request |
| Project Group (hide) | `project.setHidden`; CLI `orca repo hide` / `unhide`. Folder groups: no CLI |
| Sleep | None. `worktree.sleep` exists only in Orca's internal RPC |
| Pin | None. `isPinned` is app-internal |
| Mute Notifications | None. `muteNotifications` is UI-only |
| Copy path or branch | Not needed; the worker knows both |
| Open in → editor or Finder | Detour: `open -a <app> <path>` from the worker; it ignores the app list in Orca's settings (`openInApplications`, only readable from `profile-state.db`) |
| Open project settings | `app.settings` keybinding only: the worker can press it like the create-worktree shortcut, and it opens the general page, not the project's. Orca's `openSettingsTarget` is not exposed. Default binding on macOS is empty; this Mac has `Cmd+,` in `~/.orca/keybindings.json` |

Project properties:

- Name, icon (`repoIcon`) and colour (`badgeColor`): read-only through `orca project list --json`; no way to change them.
- CLI that does change a project: `orca repo set-base-ref --ref <ref>`, `orca repo set --external-worktree-visibility show|hide|inherit`, `orca repo set --browser-profile <id>|inherit`. `orca project setup-update --display-name` is a host setup name; not checked whether it changes what the tree shows.
