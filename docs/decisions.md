# Decisions, rejected options, open items

## Decisions

- Own plugin, not a fork of `woodfishhhh/better-project-tree`. Same tree behaviour (folder grouping, filter, refresh, collapse and expand, status dots), own right-click menu. The left sidebar toggle button and the toolbar refresh button were dropped at the user's request (2026-11-17); the tree reloads on events and when the panel is looked at. The user removed better-project-tree from Orca (2026-11-17).
- The menu lives in the right-sidebar HTML panel because the platform has no hook in the left list (see `platform.md`).
- Folder layout: the first folder under `~` is the root (`~/Space`), then every folder down to the project; a project outside `~` hangs off its parent folder. Folders first, then projects, via `Intl.Collator`. Attention precedence: permission > unread > working.
- Launch through the `orca` CLI so model, effort, prompt and surface fit in one call.
- Menu fidelity to Orca beats extra features: the flyout has no refresh button and no workspace subtitle, because Orca's has neither. Background refresh keeps lists fresh. One exception, when the flyout covers the menu: no hover-open and a back arrow (see `menu.md`, 2026-11-17).
- Row states, the project-with-worktrees row, full row rebuilds and error lifetime are in `tree.md`.

## Rejected

- Hook or settings hack to choose model and effort: unnecessary, `orca agent launch` takes them.
- Remote favicons (Google): no network inside a plugin.
- Fast toggle: no CLI flag.

## Not verified


- Dark theme of the panel: checked live 2026-11-17 for the filter ring, `×`, the menu and the panel colour (see `platform.md`). Not checked there: row hover (the pointer did not reach the panel in that session), the unread dot's blue, the back arrow.
- Launching Claude, Codex, OpenCode and Cursor from the menu on the live panel (Pi is verified).
- Which surface Orca treats as default for each agent; the plugin draws chat as primary.

## Project menu (2026-11-17)

- Right-click or `…` on a project (a main checkout, `linked: false`) shows two items, New tab and New workspace. A folder row has no menu.
  - A linked worktree row shows New tab only (user request, 2026-11-17). New tab opens the workspace menu for it (checked live by the user, 2026-11-18).
  - New tab on a project replaces the project menu with the workspace menu of the main checkout (same point). New workspace shows that checkout (`workspace.open`) and then sends Orca's create-worktree shortcut (see `platform.md`).
- Orca's window starts on the shown project (checked by the user, 2026-11-17), so the `workspace.open` step is how the project is passed in; there is no API for it.
- Accepted: the worker sends the shortcut right after `workspace.open` without waiting for Orca to switch. A race (window on the previous project) was not seen; add a short wait or a poll of the active workspace only if it shows up, e.g. on a cold start. If the shortcut step fails, the switch to the project's workspace stays; the panel shows the error.
