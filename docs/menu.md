# The right-click menu

It copies Orca's new-tab menu (search, icon row, agent rows with a chevron segment, setup flyout). Checked against a screenshot of Orca 1.4.261 on 2026-11-17 (installed now: 1.4.263). Rows are in `tree.md`, the gear window in `display-options.md`.

## Orca sources to compare with

Under `~/Space/Development/_external/orca/src/renderer/src/components` (a checkout at `v1.4.261`, behind the installed app; see `platform.md`, `Machine environment`):

- `tab-bar/create-menu/TabBarCreateRow.tsx` and `TabBarCreateRowIcons.tsx`: the search field, icon row, separators.
- `agent/AgentLaunchPickerMenuRow.tsx` and `AgentLaunchSetupSubmenu.tsx`: the agent row and its chevron segment (hover opens, click opens, `Right` opens, `Left` and `Escape` close).
- `agent/AgentLaunchSetupPanel.tsx` and `AgentLaunchSetupFooter.tsx`: the flyout (search, list, levels, prompt, buttons).
- `ui/menu-item.ts`, `ui/menu-surface.ts`, `ui/command.tsx`, `ui/button.tsx`, `ui/toggle.tsx`: the Tailwind classes behind every size, radius and state.
- Agent icons: `agent/icons/AgentIcon.tsx`, `agent-icon-glyphs.tsx`, `agent-favicon-assets.ts`, `status-bar/accounts/provider-icons.tsx`.

## Where the code and the screen disagree

- The source gives the model rows and the search field `h-9`; the screenshot shows about 30 px rows and a 40 px field. The plugin follows the screenshot. If Orca is updated, re-measure before trusting either.
- The composer box below the levels has no top border on screen although the source has one; the plugin follows the screen.

## Highlights in dark themes

The agent row (the split variant, `ui/menu-item.ts:81`), the model row (`ui/command.tsx`), the effort toggle and `Button` hover all use `--accent`, so the plugin uses `--orca-accent` too. In some dark themes (the user's, 2026-11-17) that is nearly the menu's colour, and Orca's own menu looks the same. A stronger white overlay was tried and reverted at the user's request: match Orca, not the contrast. Only `white/14` rows (`ROW_FOCUS`, the icon buttons) are a different Orca variant.

## Not reproducible with the plugin API

Browser and new-file icons, the gear, `Agent settings...`, row shortcut hints (`Cmd+Alt+T`), `No chat on this host`, and `/` and `@` in the prompt (the real one is Orca's chat composer). The panel's tooltips copy `ui/tooltip.tsx` (inverted bubble, arrow, 600 ms delay; `src/panel/tooltip.ts`, opt in with `data-tip`). They have no shortcut chips, since the panel has no shortcuts (checked live 2026-11-17: the bubble opens under the fold button, since there is no room above; not compared pixel by pixel). `pointerenter` fires inside the panel iframe (checked 2026-11-17).

## Flyout placement

A plugin cannot draw outside its frame. `placeFlyout` in `src/panel/menu.ts` puts the flyout right of the menu, else left, else over it at the panel edge (Orca does the same in a narrow window). It tracks its own height as the list loads.

Menu 288 px + flyout 416 px do not fit side by side in the usual sidebar, so "over it" is the common case (checked live 2026-11-17 at about 630 px). Then (`flyoutCovers`) two things differ from Orca on purpose (user request 2026-11-17): hovering the chevron does not open the flyout, since it would hide the menu under the pointer; and the flyout's search field starts with a back arrow instead of the magnifier, the only way back for a mouse (a click outside closes everything).

## Icons

`build.py` reads Orca's icon components and bundled PNG favicons and writes `src/panel/agent-icon-data.ts` (11 SVG glyphs, 33 PNG data URIs). It also writes `src/panel/lucide-data.ts`.

- `lucide-data.ts` holds every Lucide icon the panel draws (chrome icons and Orca's 20 project icons), taken from the `lucide-react` version in Orca's `pnpm-lock.yaml` (0.577.0, checked 2026-11-17) via `npm pack`. An icon that version lacks stops the script.
- A new chrome icon needs its Lucide name in `PANEL_LUCIDE` (`build.py`) and `PANEL_ICONS` (`src/panel/icons.ts`).
- Rerun it after updating the Orca checkout; set `ORCA_SRC` for another path.
- An agent with no icon gets a letter in a box, as in Orca. `currentColor` glyphs (Pi, OpenCode, Codex) follow the theme.

## The `+` menu (2026-11-18)

The header `+` opens a two-item menu (`showAddMenu`, `main.ts`): `Create new workspace` (Orca's own window, which picks the project itself) and `Create new tab`. The second replaces it with the workspace menu plus a project field above the agent search (`buildMainMenu({ project })`, list in `project-picker.ts`).

- The field's project is the open workspace's, else the selected row's, else none. With none, the terminal, open and agent items are off until one is picked.
- The target is the project's main checkout (`projectsOf` in `rows.ts`); linked worktrees are not listed (user decision). The list is a flyout like the model list, so it follows `placeFlyout` and has the same back arrow when it covers the menu.
- Checked live 2026-11-18: both menus open, the filter narrows the list, picking a project enables the items. No tab was launched during the check.

## The gear

The Display options window is in `display-options.md`.
