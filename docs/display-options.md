# Display options

The gear window's settings and what each does. Rows and the checks for a changed tree are in `tree.md`. Moved here from `menu.md` on 2026-11-19; facts keep their dates. Nothing here is checked on the live panel unless it says so.

## Adding a setting

Add its key to `DisplayOptions`, a title to `SETTING_TITLES` (`display.ts`; the compiler asks for it), a `###` heading below whose text is the title in backticks (`docs.test.ts` fails without it), and make `parseDisplay` handle old stored values.

## The window

The header gear opens a popover titled `Display options` (`src/panel/options-menu.ts`), drawn after Orca's "Workspace options". Not compared pixel by pixel. The user checked the `Title` mode live on 2026-11-18 and it works.

- Every setting is Orca's segmented control: `SidebarGroupByToggle.tsx` (`ToggleGroup` outline, `sm`, `h-6`, `text-[10px]`, selected `bg-foreground/10 font-semibold`) in a `px-2 pt-0.5 pb-1` box under a `MENU_LABEL_CLASS` label (`ui/menu-item.ts`, `text-2xs` = 11px per `assets/main.css`). Full names are the tooltip and `aria-label`. The window stays open after a pick, as Orca's does.
- A submenu design (one row with a value and a flyout) was tried and replaced at the user's request, so `menu.ts` has no flyout extension for it.
- Storage: `orca.storage` key `display:v1` (`parseDisplay`, `display.ts`); an unknown value gives the setting's default. Titles come from `SETTING_TITLES`.

### `Group by`

2026-11-18, user request; first section, `GroupMode`, stored as `group`, default `Folder`. Not checked on the live panel.

- `None`: flat list by name. `Folder`: the worker's tree. `Status`: sections `Permission`, `Unread`, `Working`, `Monitoring`, `Idle` by the strongest `Attention` in each project, empty ones hidden, projects by name.
- The panel regroups the worker's tree in `groupTree` (`grouping.ts`); the worker is untouched. Worktrees stay under their project in every mode.
- A section is a `group` node with `section: true`, drawn `title count chevron` (chevron right folded, down open; no folder mark, no status dot). Its folded state is in `collapsed` under `status:<level>`. 10px of margin separates sections.
- The filter never matches a section by its title (`filterNodes`), only the projects below it.
- In `None` and `Status` the folders above a project go into its tooltip (`folder`, set by `groupTree`).
- In `None` the list starts at 24 px, not 8 (`rowLayout(depth, flat)`, 2026-11-19, user report): projects sit at depth 0 with no folder above, and the 8 px gutter squeezed the status mark to 8 px at `left: 0`. `Folder` mode still has this at depth 0 for a folded top-level folder; not changed, nobody reported it. Checked by node test only, not on the live panel.
- `Folders` and `Tree guides` show only for `Folder`; guides are also forced off in the other modes.
- Board status (`todo`, `in-review`) is not used (see `host-data.md`, `Agent status`).

### `After project name`

Segments `None`, `Branch` (default), `Title`, `Message`. Text for a workspace row only.

- `Title` and `Message` read the agents' words (checked 2026-11-18). The host's `agents.list` leaves out native chats, so `agents.text` (`src/titles.ts`) reads `orca agent list --json`, which has terminal agents and chats with `title`, `lastAssistantMessage` and `updatedAt`.
- Matching: its `worktreeId` is `<repo id>::<path>`; the path is matched to `workspace.list` rows (the panel's ids are `identity:...`) after `realPath` on both sides (`fs.realpath`, about 17 µs a call, measured 2026-11-18; symlinks such as `/tmp` -> `/private/tmp` are resolved; a folder that is gone keeps its path with trailing `/` removed by `normalizePath`). The symlink case has a node test with a real symlink; not checked on the live panel.
- Folder workspaces (2026-11-19, user report: `MMM1` showed no title): several can share one folder, e.g. `hacks` and `MMM1`. The CLI tells them apart only by a suffix: `worktreeId` is `<repo id>::<path>::workspace:<uuid>`, and the host id is the same string; both have `path` equal to the plain folder. So the key is the real path plus `::workspace:<uuid>` (`agentKey`, `workspaceSuffix` in `titles.ts`); matching by path alone gave `MMM1` nothing. Checked on the live `orca agent list` and `orca worktree list` 2026-11-19; the panel itself not re-checked.
- Which agent wins: the one that changed last. Terminal agents often have an empty reply and chats usually have one (CLI, 2026-11-18), so the title and the reply are each taken from the newest agent that has one.
- `Message` shows the reply as one line (`oneLine`: line breaks to spaces, `*` and backticks dropped, cut at 240 characters; the row's ellipsis does the rest). `oneLine` also drops real `*` characters (`2 * 3` shows as `2 3`); a known cosmetic limit.
- `Message` needs the CLI. Without it the worker falls back to `agents.list` per workspace, which has titles only, so the column is empty. Orca's plugin API has no "active tab" flag, so an idle shell tab gives nothing (not checked). Events `agent.status.changed` also set a title at once; the next `tree.load` replaces them.
- Rate and cache: the CLI is started at most once per `TITLES_MIN_MS` (3 s; the last request runs after the pause), and an answer that is not the latest read is dropped (`titleSeq`). The last answer is kept in `orca.storage` (`texts:v1`, `parseTexts`) and drawn before the first read finishes, since a cold read takes seconds. A workspace that is gone is dropped by the next tree load (`pruneTitles`), and the fresh answer replaces the cache.
- The names `loadTitles`, `titles`, `recordTitle`, `titleSeq` and `TITLES_MIN_MS` predate `Message` and cover both fields; renaming was left for later.

### `Folders`

2026-11-18, user request: what marks a group row. Segments `Arrows` (default), `Icons`, `Both`, `None` (`FolderMark`). It only touches group rows.

- A hidden chevron or icon leaves no cell (user request 2026-11-18), so the folder's name moves left: `Arrows` and `Icons` by one cell, `None` by two.
- The indent per level is 20 for folders and projects in every mode (`INDENT` in `layout.ts`, user 2026-11-18), with no extra pull for projects in `None` (a 12 px pull was tried and dropped by the user).
- Not checked: `Both`, `Arrows`, `Icons` on the live panel (see `Before you change it`).

### `Tree guides`

`none` (default), `visible`, `subtle`: a vertical line through the indent of each ancestor level (`.guide`, `pointer-events: none`). Read from code, not checked on the live panel.

- One line per ancestor level at `GUIDE_CENTER` (8 px) under that ancestor's first mark, so lines of touching rows join up (`layout.ts`).
- A nested row's status mark is centred on its parent's guide line, whether guides show or not.
- The 8 px assumes every ancestor has a 16 px mark cell. With `Folders: None` there is no cell, so the line may fall under empty space; open question.

### `Density`

`compact` / `comfort` / `spacious` set the row height through `--row-height` on `.tree[data-density]` in `src/panel/style.ts`: 24 / 28 / 32 px (2026-11-18). The old fixed 24 px is `compact`; the default is `comfort` (28 px).

### `Time`

`show` (default) / `hide` (`TimeMode`, 2026-11-19, user request): the age at the right of a workspace row (`now`, `5m`, `1d`; see `tree.md`). `hide` draws no `.age`, so the `…` slot is back in the row's flow. Not checked on the live panel.
