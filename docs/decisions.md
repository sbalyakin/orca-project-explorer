# Decisions, rejected options, open items

## Decisions

- Own plugin, not a fork of `woodfishhhh/better-project-tree`. Same tree behaviour (folder grouping, filter, refresh, collapse and expand, status dots), own right-click menu. The left sidebar toggle button and the toolbar refresh button were dropped at the user's request (2026-11-17); the tree reloads on events and when the panel is looked at. The user removed better-project-tree from Orca (2026-11-17).
- The menu lives in the right-sidebar HTML panel because the platform has no hook in the left list (see `platform.md`).
- Folder layout: the first folder under `~` is the root (`~/Space`), then every folder down to the project; a project outside `~` hangs off its parent folder. Folders first, then projects, via `Intl.Collator`. Attention precedence: permission > unread > working.
- Launch through the `orca` CLI so model, effort, prompt and surface fit in one call.
- Menu fidelity to Orca beats extra features: the flyout has no refresh button and no workspace subtitle, because Orca's has neither. Background refresh keeps lists fresh. One exception, when the flyout covers the menu: no hover-open and a back arrow (see `menu.md`, 2026-11-17).
- Row states (UX audit, 2026-11-17): hover, the open workspace (`current`, filled) and the keyboard cursor (`selected`, outline only while the tree has keyboard focus) must look different; before, all three used `--panel-accent`. Keyboard mode is a `keyboard` class on `body`, not `:focus-visible`, because the menu hands focus back to the tree by code from a text field, and by Chromium's heuristics that focus counts as visible even for a mouse user (not checked live). The dot and `…` share one slot, so hover moves nothing.
- Errors under the tree stay until dismissed or the next action (were 5 s); a failed reload is cleared by the next good one.

## Rejected

- Hook or settings hack to choose model and effort: unnecessary, `orca agent launch` takes them.
- Remote favicons (Google): no network inside a plugin.
- Fast toggle: no CLI flag.

## Not verified


- Dark theme of the panel (`plugin shot --theme` needs a hidden window).
- Launching Claude, Codex, OpenCode and Cursor from the menu on the live panel (Pi is verified).
- Which surface Orca treats as default for each agent; the plugin draws chat as primary.
