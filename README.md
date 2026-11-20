# Project Explorer

An [Orca](https://orca.stably.ai) plugin that replaces flat workspace scrolling with a hierarchical project tree in the right sidebar. It groups your repositories and worktrees by folder or agent status, shows live activity at a glance, and lets you open terminals, workspaces, or configured agent sessions from any row.

## Why use it

Orca's built-in sidebar lists projects one by one. When you work across dozens of repositories and linked worktrees, finding a specific project or seeing which agent needs attention takes extra scrolling. Project Explorer puts your workspace hierarchy into a compact tree with filtering, sorting, and Orca's own launcher menu right on every row.

## Features

### Tree and navigation
- Groups projects under their directory hierarchy (starting from the top-level folder under `~`, such as `~/projects`; projects outside `~` hang off their parent folder).
- Nests linked worktrees under their parent project, with the main checkout as the first child.
- Supports pinning workspaces to a **Favorites** section above the main tree.
- Instant search filter with keyboard navigation (arrow keys, `Home`, `End`, `Enter`, and `Esc` or `×` to clear).
- Highlights the currently open workspace using Orca's active card styling, theme colors, and font.
- Caches the tree and agent text locally so the panel renders immediately on tab switch.

### Live agent status and activity
- Status dots on each row: blue for unread, amber for waiting on permission, and pulsing while an agent is working.
- Folded folders and projects inherit the highest-priority status dot from inside them; hovering any row shows the status in a tooltip.
- Optional relative activity time (`now`, `5m`, `3h`, `2d`) on the right side of each workspace row, updated automatically every 30 seconds.

### Right-click menu and agent launcher
- Open the menu by right-clicking a row, clicking its `…` button, or pressing `Shift+F10` / the Menu key.
- Mirrors Orca's new-tab menu: quick search, icon actions (Terminal, Open workspace), and your installed agents from Orca's Settings -> Agents.
- Click an agent to launch it immediately with the last model and reasoning effort you used.
- Open an agent's setup panel (via its chevron or `→`) to search models, pick a reasoning level, write a prompt, and launch either a chat (`Enter`) or a terminal (`Cmd+Enter`).
- Pulls model lists from each agent's CLI (`codex app-server`, `claude -p` stream-json, `pi --mode rpc`, `opencode models`, `cursor-agent --list-models`), caches them for 6 hours, and refreshes them in the background. For other agents, you can type any model id.
- Launches agents through `orca agent launch` in a single call. Progress and errors appear in a dismissible strip below the tree.

### Workspace actions and the `+` menu
- Rename workspaces, mark them read or unread, and delete linked worktrees or non-root folder workspaces directly from the tree.
- The header `+` button lets you trigger Orca's **Create new workspace** dialog or **Create new tab** with an inline project picker.

### Grouping, sorting, and display options
- **Sort by** (`ArrowUpDown` button): sort by `Name`, `Recent` (last activity), `Status` (attention priority), or `Manual` (drag-and-drop projects with separate saved orders for folder and flat views, plus a reset option).
- **Group by** (gear menu): `Folder` (directory tree), `None` (flat list), or `Status` (collapsible sections for Permission, Unread, Working, Monitoring, and Idle).
- **Details**: choose what appears after each workspace name (`None`, git `Branch`, latest agent `Title`, or latest agent `Message` as a single line).
- **Visual tuning**: configure folder markers (`None`, `Arrows`, `Icons`, `Both`), `Tree guides` (`none`, `subtle`, `visible`), row `Density` (`compact`, `normal`, `spacious`), and `Activity time` visibility.

## Install

Requires Orca `>=1.4.259`.

Install from GitHub:

```sh
orca plugin install https://github.com/sbalyakin/orca-project-explorer.git
```

Or load a local clone in development mode:

```sh
orca plugin dev load .
```

The first load prints an approval fingerprint; pass it back with `--approve <fingerprint>`.

## Develop

```sh
orca plugin dev reload . --approve <fingerprint>
orca plugin open local.project-explorer --panel project-explorer
orca plugin shot local.project-explorer --panel project-explorer --width 360   # needs the window hidden for --theme
scripts/check.sh              # type-check (tsc) + orca plugin test .
orca plugin validate .        # validate manifest and images
python3 build.py              # regenerate agent icons from an Orca checkout (ORCA_SRC)
```

## License

[MIT](LICENSE)
