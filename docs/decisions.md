# Decisions, rejected options, open items

## Decisions

- Own plugin, not a fork of `woodfishhhh/better-project-tree`. Same tree behaviour (folder grouping, filter, refresh, collapse and expand, status dots), own right-click menu. The left sidebar toggle button and the toolbar refresh button were dropped at the user's request (2026-11-17); the tree reloads on events and when the panel is looked at. The user removed better-project-tree from Orca (2026-11-17).
- The menu lives in the right-sidebar HTML panel because the platform has no hook in the left list (see `platform.md`).
- Folder layout: the first folder under `~` is the root (`~/Space`), then every folder down to the project; a project outside `~` hangs off its parent folder. Folders first, then projects, via `Intl.Collator`. Attention precedence: permission > unread > working.
- Launch through the `orca` CLI so model, effort, prompt and surface fit in one call.
- Menu fidelity to Orca beats extra features: the flyout has no refresh button and no workspace subtitle, because Orca's has neither. Background refresh keeps lists fresh.

## Rejected

- Hook or settings hack to choose model and effort: unnecessary, `orca agent launch` takes them.
- Remote favicons (Google): no network inside a plugin.
- Fast toggle: no CLI flag.

## Not verified


- Dark theme of the panel (`plugin shot --theme` needs a hidden window).
- Launching Claude, Codex, OpenCode and Cursor from the menu on the live panel (Pi is verified).
- Which surface Orca treats as default for each agent; the plugin draws chat as primary.
