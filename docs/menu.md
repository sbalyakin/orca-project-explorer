# The right-click menu

It copies Orca's new-tab menu (search, icon row, agent rows with a chevron segment, setup flyout). Checked against a screenshot of Orca 1.4.261 on 2026-11-17.

## Orca sources to compare with

Under `~/Space/Development/_external/orca/src/renderer/src/components`:

- `tab-bar/create-menu/TabBarCreateRow.tsx` and `TabBarCreateRowIcons.tsx`: the search field, icon row, separators.
- `agent/AgentLaunchPickerMenuRow.tsx` and `AgentLaunchSetupSubmenu.tsx`: the agent row and its chevron segment (hover opens, click opens, `Right` opens, `Left` and `Escape` close).
- `agent/AgentLaunchSetupPanel.tsx` and `AgentLaunchSetupFooter.tsx`: the flyout (search, list, levels, prompt, buttons).
- `ui/menu-item.ts`, `ui/menu-surface.ts`, `ui/command.tsx`, `ui/button.tsx`, `ui/toggle.tsx`: the Tailwind classes behind every size, radius and state.
- Agent icons: `agent/icons/AgentIcon.tsx`, `agent-icon-glyphs.tsx`, `agent-favicon-assets.ts`, `status-bar/accounts/provider-icons.tsx`.

## Where the code and the screen disagree

- The source gives the model rows and the search field `h-9`; the screenshot shows about 30 px rows and a 40 px field. The plugin follows the screenshot. If Orca is updated, re-measure before trusting either.
- The composer box below the levels has no top border on screen although the source has one; the plugin follows the screen.

## Not reproducible with the plugin API

Browser and new-file icons, the gear, `Agent settings...`, row shortcut hints (`Cmd+Alt+T`), `No chat on this host`, and `/` and `@` in the prompt (the real one is Orca's chat composer). The panel's tooltips copy `ui/tooltip.tsx` (inverted bubble, arrow, 600 ms delay; `src/panel/tooltip.ts`, opt in with `data-tip`). They have no shortcut chips, since the panel has no shortcuts (2026-11-17, not compared pixel by pixel).

## Flyout placement

A plugin cannot draw outside its frame. `placeFlyout` in `src/panel/menu.ts` puts the flyout right of the menu, else left, else over it at the panel edge (Orca does the same in a narrow window). It tracks its own height as the list loads.

## Icons

`build.py` reads Orca's icon components and bundled PNG favicons and writes `src/panel/agent-icon-data.ts` (11 SVG glyphs, 33 PNG data URIs). It also writes `src/panel/lucide-data.ts`: every Lucide icon the panel draws (chrome icons and Orca's 20 project icons), taken from the `lucide-react` version in Orca's `pnpm-lock.yaml` (0.577.0, checked 2026-11-17) via `npm pack`; an icon that version lacks stops the script. A new chrome icon needs its Lucide name in `PANEL_LUCIDE` (`build.py`) and `PANEL_ICONS` (`src/panel/icons.ts`). Rerun it after updating the Orca checkout; set `ORCA_SRC` for another path. An agent with no icon gets a letter in a box, as in Orca. `currentColor` glyphs (Pi, OpenCode, Codex) follow the theme.
