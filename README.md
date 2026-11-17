# Project Tree

Orca plugin: projects and workspaces as a folder tree in the right sidebar, with a right-click menu
to start a terminal or an agent in any workspace.

- Click a row to open its workspace; click a folder or its arrow to fold it.
- Right-click a workspace, press the `…` button on its row, or use `Shift+F10` / the Menu key. The
  menu copies Orca's new-tab menu: a search field, icon buttons (Terminal, Open workspace) and the
  agents from the plugin's `agents` setting (Settings → Plugins).
- Pressing an agent row launches it with the model and effort you used last, in the surface Orca
  has set for that agent. The chevron (or hovering it, or `→`) opens its setup: search the agent's
  models, pick a reasoning level, add a prompt, then Launch terminal or Launch chat (`Enter` = chat,
  `Cmd+Enter` = terminal).
- Models come from the agents' own CLIs (`codex app-server`, `claude -p` stream-json, `pi
  --mode rpc`, `opencode models`, `cursor-agent --list-models`), cached in plugin storage for 6 h
  and refreshed in the background. Other agents launch without a list: type a model id.
- Agents start through `orca agent launch` (model, effort, prompt, chat or terminal in one call).
- Arrow keys, `Home`/`End`, `Enter` work in the tree; `Esc` or the `×` in the field clears the filter.
- Dots: blue = unread, amber = waiting for permission, pulsing = agent working. A folded folder shows
  the strongest one below it. The row's tooltip names the status in words.
- The open workspace is drawn as Orca draws its active card: a border and a wash from the theme. Launch progress and errors
  show in a strip under the tree that exists only while there is a message; `×` dismisses it, and an
  error also goes when you start something else.

Layout: the first folder under `~` is one root (`~/Space`), then every folder down to the project;
a project outside `~` hangs off its parent folder. Linked worktrees nest under their project.

## Develop

```sh
orca plugin dev load .        # first time: pass the --approve fingerprint it prints
orca plugin dev reload . --approve <fingerprint>
orca plugin open local.project-tree --panel project-tree
orca plugin shot local.project-tree --panel project-tree --width 360   # needs the window hidden for --theme
npx -p typescript tsc -p .    # type-check (Orca does not)
orca plugin test .
python3 build.py              # regenerate agent icons from an Orca checkout (ORCA_SRC)
```
