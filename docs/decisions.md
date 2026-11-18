# Decisions, rejected options, open items

## Decisions

- Own plugin, not a fork of `woodfishhhh/better-project-tree`. Same tree behaviour (folder grouping, filter, refresh, collapse and expand, status dots), own right-click menu. The left sidebar toggle button and the toolbar refresh button were dropped at the user's request (2026-11-17); the tree reloads on events and when the panel is looked at. The user removed better-project-tree from Orca (2026-11-17).
- The menu lives in the right-sidebar HTML panel because the platform has no hook in the left list (see `platform.md`).
- Folder layout: the first folder under `~` is the root (`~/Space`), then every folder down to the project; a project outside `~` hangs off its parent folder. Folders first, then projects, via `Intl.Collator`. Attention precedence: permission > unread > working.
- Launch through the `orca` CLI so model, effort, prompt and surface fit in one call.
- Menu fidelity to Orca beats extra features: the flyout has no refresh button and no workspace subtitle, because Orca's has neither. Background refresh keeps lists fresh. One exception, when the flyout covers the menu: no hover-open and a back arrow (see `menu.md`, 2026-11-17).
- Row states (2026-11-17): hover and the open workspace (`current`) must look different. `current` copies Orca's active card (`main.css`, `data-worktree-card-active='primary'`): 1px border in the theme's `--worktree-sidebar-active-border`, wash `--worktree-sidebar-active`, `rounded-lg`, 4px side margin on every row (`GUTTER` in `view.ts` is 4 for that). The keyboard cursor outline was dropped at the user's request: a click already opens or folds, so a second marker meant nothing. `selected` stays as state for arrows and Enter, with no visible style, so arrow keys move unseen. The dot and `…` share one slot, so hover moves nothing.
- Every state change rebuilds all rows (`render` in `main.ts`). An in-place update of row marks (selection, menu target, open workspace) was built and dropped (2026-11-17): a full rebuild of 28 rows measured 0.7-1.7 ms against about 0 ms for the marks, and no flicker, lost tooltip or lost hover was found, so a second draw path was not worth it. Revisit only with a visible problem or a tree of hundreds of rows. If it comes back, `reveal` must pass `collapsed` to `setState` only when its size changed, or every workspace change rebuilds anyway.
- Projects with worktrees (2026-11-18, user request): a project that has worktrees besides its main checkout is a folding row with no arrow in any `Folders` mode; a click only folds. Its first child is the main checkout: home icon, project name, text per the `After project name` mode. A project without other worktrees stays one row that opens its workspace. New tab and New workspace stay on the project row; the primary child and linked worktrees get New tab only. The collapsed row shows the rolled-up status at the right; the open workspace's highlight stays on the real row. Cached tree key bumped to `tree:v2` for the new shape. Not checked on the live panel.
- Errors under the tree stay until dismissed or the next action (were 5 s); a failed reload is cleared by the next good one.

## Rejected

- Hook or settings hack to choose model and effort: unnecessary, `orca agent launch` takes them.
- Remote favicons (Google): no network inside a plugin.
- Fast toggle: no CLI flag.

## Not verified


- Dark theme of the panel: checked live 2026-11-17 for the filter ring, `×`, the menu and the panel colour (see `platform.md`). Not checked there: row hover (the pointer did not reach the panel in that session), the unread dot's blue, the back arrow.
- Launching Claude, Codex, OpenCode and Cursor from the menu on the live panel (Pi is verified).
- Which surface Orca treats as default for each agent; the plugin draws chat as primary.

## Project menu (2026-11-17)

- Right-click or `…` on a project (a main checkout, `linked: false`) shows two items, New tab and New workspace. A linked worktree row shows New tab only (user request, 2026-11-17); New tab opens the workspace menu for it (checked live by the user, 2026-11-18). A folder row has no menu. New tab replaces the project menu with the workspace menu of the main checkout (same point); New workspace shows that checkout (`workspace.open`) and then sends Orca's create-worktree shortcut (see `platform.md`).
- Orca's window starts on the shown project (checked by the user, 2026-11-17), so the `workspace.open` step is how the project is passed in; there is no API for it.
- Accepted: the worker sends the shortcut right after `workspace.open` without waiting for Orca to switch. A race (window on the previous project) was not seen; add a short wait or a poll of the active workspace only if it shows up, e.g. on a cold start. If the shortcut step fails, the switch to the project's workspace stays; the panel shows the error.
