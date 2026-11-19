import { GEIST_URL } from './font-data'

// Styled only from Orca's `--orca-*` theme variables, so a theme change needs no reload.
// Orca's own font (Geist) is bundled: the host does not pass `--font-sans` to panels.
export const CSS = `
@font-face { font-family: 'Geist'; src: url('${GEIST_URL}') format('woff2'); font-weight: 100 900; font-display: block; }
/* --panel-bg and --panel-accent come from index.html. */
* { box-sizing: border-box; }
html, body { height: 100%; margin: 0; }
body {
  display: flex; flex-direction: column;
  background: var(--panel-bg); color: var(--orca-foreground);
  font: 12px/1.4 var(--orca-font-sans, 'Geist', -apple-system, BlinkMacSystemFont, sans-serif); user-select: none; overflow: hidden;
  letter-spacing: 0.01em; -webkit-font-smoothing: antialiased; /* as Orca's body */
}
.toolbar { display: flex; gap: 2px; align-items: center; padding: 8px 8px 6px; }
/* Mirrors Orca's sidebar Search button: bg foreground/5, px-2 py-1.5, 13px medium, rounded-md (0.8 radius), icon 16px at foreground/30. */
.search-box {
  flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px; padding: 6px 8px;
  background: color-mix(in srgb, var(--orca-foreground) 5%, transparent); border-radius: calc(var(--orca-radius) * 0.8);
  transition: background-color .15s;
}
.search-box:hover { background: color-mix(in srgb, var(--orca-foreground) 8%, transparent); }
.search-box:focus-within { box-shadow: inset 0 0 0 1px var(--orca-ring); }
.search-clear {
  display: grid; place-items: center; flex: none; width: 16px; height: 16px; margin: -2px -2px -2px 0; padding: 0;
  color: var(--orca-muted-foreground); background: none; border: 0; border-radius: 4px; cursor: pointer;
}
.search-clear:hover { color: var(--orca-foreground); background: color-mix(in srgb, var(--orca-foreground) 8%, transparent); }
.search-box .search-clear svg { width: 12px; height: 12px; color: inherit; }
.search-box svg { width: 16px; height: 16px; flex: none; color: color-mix(in srgb, var(--orca-foreground) 30%, transparent); }
.search {
  flex: 1; min-width: 0; padding: 0; border: 0; outline: none; background: none; appearance: none;
  font-family: inherit; font-size: 13px; font-weight: 500; line-height: 1.25rem; letter-spacing: -0.025em;
  color: var(--orca-foreground);
}
.search::placeholder { color: color-mix(in srgb, var(--orca-foreground) 60%, transparent); opacity: 1; }
.search::-webkit-search-cancel-button { display: none; }
.tool {
  display: grid; place-items: center; width: 26px; height: 26px; padding: 0; flex: none;
  color: var(--orca-muted-foreground); background: none; border: 0; border-radius: var(--orca-radius); cursor: pointer;
}
.tool:hover { background: var(--panel-accent); color: var(--orca-accent-foreground); }
.tool svg { width: 15px; height: 15px; }
.header { display: flex; align-items: center; gap: 2px; padding: 2px 8px 2px 12px; min-height: 30px; }
.header-title { color: var(--orca-muted-foreground); font-size: 13px; font-weight: 600; line-height: 16px; letter-spacing: -0.01em; }
.header-fold { margin-left: 4px; opacity: 0; transition: opacity .12s; }
.header:hover .header-fold, .header-fold:focus-visible { opacity: 1; }
.header-actions { display: flex; gap: 2px; margin-left: auto; }
.tree { flex: 1; overflow: auto; padding: 2px 0 12px; outline: none; }
.tree[data-density="compact"] { --row-height: 24px; }
.tree[data-density="comfort"] { --row-height: 28px; }
.tree[data-density="spacious"] { --row-height: 32px; }
.message { padding: 16px 12px; color: var(--orca-muted-foreground); }
.message.error { color: var(--orca-destructive); }
/* Rows are cards as in Orca's sidebar: 4px side margin, rounded-lg. GUTTER in layout.ts and this padding allow for the margin. */
.row {
  position: relative; display: flex; align-items: center; gap: 4px; height: var(--row-height); margin: 0 4px; padding-right: 4px;
  border-radius: 8px; cursor: pointer; white-space: nowrap;
}
/* Two states that must not look alike: hover (as Orca's sidebar rows) and the open workspace. */
.row:hover, .row.menu-target { background: color-mix(in srgb, var(--panel-accent) 55%, transparent); }
html.dark .row:hover, html.dark .row.menu-target { background: color-mix(in srgb, var(--orca-foreground) 3.5%, transparent); }
/* Orca's active card (main.css, data-worktree-card-active='primary'): a 1px border in the theme's --worktree-sidebar-active-border
   over the --worktree-sidebar-active wash. Without those tokens Orca derives them from the text colour, as below. Twice, since
   the dark hover rule above is more specific and would otherwise win over the wash. */
.row.current {
  background: var(--panel-active, color-mix(in srgb, var(--orca-foreground) 8%, transparent));
  box-shadow: inset 0 0 0 1px var(--panel-active-border, color-mix(in srgb, var(--orca-border) 40%, transparent)), 0 1px 2px color-mix(in srgb, var(--orca-foreground) 4%, transparent);
}
html.dark .row.current {
  background: var(--panel-active, color-mix(in srgb, var(--orca-foreground) 10%, transparent));
  box-shadow: inset 0 0 0 1px var(--panel-active-border, color-mix(in srgb, var(--orca-foreground) 18%, var(--orca-border))), 0 1px 2px color-mix(in srgb, var(--orca-foreground) 3%, transparent);
}
/* Orca's project header label (SectionHeader.tsx): text-[13px] font-semibold leading-4, in the sidebar foreground. */
.row.group { font-size: 13px; font-weight: 600; line-height: 16px; }
/* Orca's workspace card title (WorktreeTitleInlineRename): text-[13px] leading-5, normal weight, semibold while unread. */
.row.workspace .label { font-size: 13px; line-height: 20px; font-weight: 400; }
.row.workspace.unread .label { font-weight: 600; }
.guide { position: absolute; top: 0; bottom: 0; width: 1px; pointer-events: none; }
.guide.visible { background: color-mix(in srgb, var(--orca-foreground) 22%, transparent); }
.guide.subtle { background: color-mix(in srgb, var(--orca-foreground) 8%, transparent); }
.twistie, .glyph { display: grid; place-items: center; flex: none; width: 16px; height: 16px; }
.twistie { color: var(--orca-muted-foreground); }
.twistie svg { width: 12px; height: 12px; transition: transform .1s; }
.twistie.open svg { transform: rotate(90deg); }
.glyph { color: var(--orca-muted-foreground); }
.glyph svg { width: 15px; height: 15px; }
.row.group .glyph { color: #737373; } /* Orca's default project badge colour (DEFAULT_REPO_BADGE_COLOR) */
.glyph .project-image { width: 15px; height: 15px; border-radius: 4px; object-fit: contain; }
.glyph .project-emoji { font-size: 13px; line-height: 1; }
.label { overflow: hidden; text-overflow: ellipsis; flex: 0 1 auto; min-width: 0; }
.detail { overflow: hidden; text-overflow: ellipsis; flex: 1 1 0; min-width: 0; color: color-mix(in srgb, var(--orca-muted-foreground) 65%, transparent); }
.spacer { flex: 1; }
.slot { display: grid; place-items: center; flex: none; width: 20px; height: 20px; }
.slot > * { grid-area: 1 / 1; }
/* Orca's --agent-question (orange-600, orange-500 in dark; not passed to plugins) on its MessageCircleQuestion glyph. */
.permission-mark { width: 12px; height: 12px; transform: translateX(2px); color: oklch(64.6% 0.222 41.116); }
/* Orca's Activity glyph for a monitoring agent, in --agent-working like the spinner. */
.monitoring-mark { width: 12px; height: 12px; color: oklch(79.5% 0.184 86.047); }
html.dark .permission-mark { color: oklch(70.5% 0.213 47.604); }
.dot { width: 7px; height: 7px; border-radius: 50%; }
/* Orca's --unread (blue-500, blue-400 in dark) is not passed to plugins. */
.dot.unread { background: oklch(62.3% 0.214 259.815); }
html.dark .dot.unread { background: oklch(70.7% 0.165 254.624); }
/* Orca's AgentWorkingSpinner (main.css .agent-working-spinner): a ring with a transparent top, turning once a second,
   in --agent-working (yellow-500, not passed to plugins). Its sidebar size is 8px with a 1.5px border. */
.dot.working {
  box-sizing: border-box; width: 10px; height: 10px; background: none;
  border: 1.5px solid oklch(79.5% 0.184 86.047); border-top-color: transparent;
  animation: spin 1s linear infinite;
}
@keyframes spin { to { transform: rotate(1turn); } }
/* Frozen, the ring is closed so it still reads as a mark (as Orca does, #9515). */
@media (prefers-reduced-motion: reduce) { .dot.working { animation: none; border-top-color: oklch(79.5% 0.184 86.047); } }
/* Air between status sections; the first one sits at the top as it did. */
.row.section:not(:first-child) { margin-top: 10px; }
.section-count { flex: none; color: var(--orca-muted-foreground); font-weight: 400; }
.worktrees-mark { display: grid; place-items: center; flex: none; color: var(--orca-muted-foreground); }
.worktrees-mark svg { width: 13px; height: 13px; }
.status { position: absolute; top: 0; bottom: 0; display: grid; place-items: center; pointer-events: none; }
.more { width: 20px; height: 20px; visibility: hidden; }
.row:hover .more, .row.menu-target .more { visibility: visible; }
.more svg { width: 14px; height: 14px; }
/* Orca's tooltip (ui/tooltip.tsx): bg-foreground, text-background, rounded-md, text-xs, px-3 py-1.5, a 10px arrow. */
.tooltip {
  position: fixed; z-index: 90; width: fit-content; max-width: calc(100vw - 8px); padding: 6px 12px; pointer-events: none;
  background: var(--orca-foreground); color: var(--orca-background); border-radius: 6px;
  font-size: 12px; line-height: 16px; text-wrap: balance; animation: tooltip-in .12s ease-out;
}
.tooltip-arrow {
  position: absolute; width: 10px; height: 10px; margin-left: -5px; background: var(--orca-foreground);
  border-radius: 2px; transform: rotate(45deg);
}
.tooltip-arrow.below-bubble { bottom: -3px; }
.tooltip-arrow.above-bubble { top: -3px; }
@keyframes tooltip-in { from { opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .tooltip { animation: none; } }
.footer { display: flex; align-items: flex-start; gap: 6px; padding: 4px 10px; min-height: 22px; color: var(--orca-muted-foreground); }
.footer.error { color: var(--orca-destructive); }
.footer-text { flex: 1; min-width: 0; overflow-wrap: anywhere; user-select: text; }
.footer .tool { width: 16px; height: 16px; border-radius: 4px; }
.footer .tool svg { width: 12px; height: 12px; }
/* The menu follows Orca's new-tab menu: same sizes, radii and states, on the panel's own theme variables. */
.popover {
  position: fixed; z-index: 10; width: min(288px, calc(100vw - 16px)); min-width: 11rem; padding: 6px;
  background: var(--orca-popover); color: var(--orca-popover-foreground);
  border: 1px solid rgb(0 0 0 / .07); border-radius: 12px; font-size: 13px; line-height: 16px;
  box-shadow: 0 1px 2px rgb(0 0 0 / .04), 0 8px 24px rgb(0 0 0 / .08);
}
html.dark .popover { border-color: rgb(255 255 255 / .09); box-shadow: 0 12px 32px rgb(0 0 0 / .45); }
.popover.picker { padding: 0; overflow: hidden; display: flex; flex-direction: column; max-height: calc(100vh - 16px); }
.menu svg:not(.agent-icon) { stroke-width: 1.5; }
.omnibox { display: flex; align-items: center; height: 36px; margin: -4px -4px 0; padding: 0 12px; font-size: 12px; }
.omnibox-input {
  flex: 1; min-width: 0; height: 36px; padding: 0; color: var(--orca-foreground); font: inherit; font-size: 12px;
  background: transparent; border: 0; outline: none; user-select: text;
}
.omnibox-input::placeholder, .cmd-field::placeholder, .composer-input::placeholder { color: var(--orca-muted-foreground); }
.menu-separator { height: 1px; margin: 6px -6px; background: rgb(0 0 0 / .07); }
.menu-separator.flush { margin: 0 -6px 6px; }
html.dark .menu-separator { background: rgb(255 255 255 / .1); }
.icon-row { display: flex; gap: 2px; }
.icon-button {
  display: grid; place-items: center; flex: none; width: 36px; height: 28px; padding: 0; color: var(--orca-muted-foreground);
  background: none; border: 0; border-radius: 7px; outline: none; cursor: pointer;
}
.icon-button svg { width: 16px; height: 16px; }
.icon-button:hover, .icon-button:focus-visible { color: var(--orca-foreground); background: rgb(0 0 0 / .08); }
html.dark .icon-button:hover, html.dark .icon-button:focus-visible { background: rgb(255 255 255 / .14); }
.launch-row { display: flex; border-radius: 7px; }
.launch-row:hover, .launch-row:focus-within, .launch-row.open { color: var(--orca-accent-foreground); background: var(--orca-accent); }
.launch-main {
  display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; height: 36px; padding: 0 8px;
  color: var(--orca-foreground); font: inherit; font-weight: 500; text-align: left; background: none; border: 0;
  border-radius: 7px 0 0 7px; outline: none; cursor: pointer;
}
.launch-row:hover .launch-main, .launch-row:focus-within .launch-main, .launch-row.open .launch-main { color: var(--orca-accent-foreground); }
.launch-main .agent-icon { width: 14px; height: 14px; }
.menu-item {
  display: flex; align-items: center; gap: 8px; width: 100%; height: 36px; padding: 0 8px; color: var(--orca-foreground);
  font: inherit; font-weight: 500; text-align: left; background: none; border: 0; border-radius: 7px; outline: none; cursor: pointer;
}
.omnibox.after-field { margin-top: 0; }
.project-mark { display: grid; place-items: center; flex: none; width: 14px; height: 14px; }
.project-mark > * { max-width: 14px; max-height: 14px; }
.project-field .menu-item > svg:last-child { margin-left: auto; opacity: .6; }
.launch-label.placeholder { color: var(--orca-muted-foreground); }
.menu.no-project .icon-row, .menu.no-project .agent-list { opacity: .4; pointer-events: none; }
.menu-item:hover, .menu-item:focus-visible { color: var(--orca-accent-foreground); background: var(--orca-accent); }
.menu-item svg { flex: none; width: 14px; height: 14px; }
.launch-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.launch-segment {
  display: grid; place-items: center; flex: none; align-self: stretch; width: 36px; min-height: 24px; padding: 0; color: inherit;
  background: none; border: 0; border-left: 1px solid var(--orca-border); border-radius: 0 7px 7px 0; outline: none; cursor: pointer;
}
.launch-segment svg { width: 14px; height: 14px; }
/* Orca's "Workspace options" popover: a 16px title; the section label is MENU_LABEL_CLASS (px-2.5 pt-[5px] pb-[3px] text-2xs
   semibold muted); the segmented control is SidebarGroupByToggle (ToggleGroup outline, sm, h-6, text-[10px]) in a px-2 pt-0.5 pb-1 box. */
.options-title { padding: 6px 8px 4px; font-size: 16px; font-weight: 600; line-height: 24px; letter-spacing: -0.01em; }
.options-section { padding: 5px 10px 3px; color: var(--orca-muted-foreground); font-size: 11px; font-weight: 600; line-height: 16px; }
.options-group {
  display: flex; width: calc(100% - 16px); height: 24px; margin: 2px 8px 4px; border-radius: calc(var(--orca-radius) * 0.8);
  box-shadow: 0 1px 2px 0 rgb(0 0 0 / .05);
}
.segment {
  flex: 1 1 0; min-width: 0; height: 24px; padding: 0 4px; color: var(--orca-foreground); font: inherit; font-size: 10px; font-weight: 500;
  line-height: 20px; white-space: nowrap; background: transparent; border: 1px solid var(--orca-input); border-left-width: 0; border-radius: 0;
  outline: none; cursor: pointer; transition: color .15s, box-shadow .15s;
}
.segment:first-child { border-left-width: 1px; border-radius: calc(var(--orca-radius) * 0.8) 0 0 calc(var(--orca-radius) * 0.8); }
.segment:last-child { border-radius: 0 calc(var(--orca-radius) * 0.8) calc(var(--orca-radius) * 0.8) 0; }
.segment:hover { color: var(--orca-accent-foreground); background: var(--orca-accent); }
.segment:focus-visible { position: relative; z-index: 1; border-color: var(--orca-ring); box-shadow: 0 0 0 3px color-mix(in srgb, var(--orca-ring) 50%, transparent); }
.segment.on, .segment.on:hover { font-weight: 600; color: var(--orca-foreground); background: color-mix(in srgb, var(--orca-foreground) 10%, transparent); }
.menu-empty { padding: 5px 10px; opacity: .4; }
.setup { display: flex; flex-direction: column; width: 100%; min-height: 0; }
.cmd-input { display: flex; align-items: center; flex: none; height: 40px; padding: 0 10px; border-bottom: 1px solid var(--orca-border); }
.cmd-input svg { flex: none; width: 14px; height: 14px; margin-right: 8px; opacity: .5; }
.cmd-back {
  display: grid; place-items: center; flex: none; width: 24px; height: 24px; margin: 0 4px 0 -4px; padding: 0;
  color: var(--orca-muted-foreground); background: none; border: 0; border-radius: 6px; outline: none; cursor: pointer;
}
.cmd-back:hover, .cmd-back:focus-visible { color: var(--orca-foreground); background: color-mix(in srgb, var(--orca-foreground) 8%, transparent); }
.cmd-input .cmd-back svg { margin: 0; opacity: 1; }
.cmd-field {
  flex: 1; min-width: 0; height: 100%; padding: 0; color: inherit; font: inherit; font-size: 13px;
  background: transparent; border: 0; outline: none; user-select: text;
}
.cmd-list { flex: 0 1 auto; min-height: 0; max-height: 224px; padding: 4px; overflow: auto; }
.cmd-item { display: flex; align-items: center; gap: 8px; min-height: 30px; padding: 0 8px; border-radius: 6px; cursor: default; }
.cmd-item.active { background: color-mix(in srgb, var(--orca-foreground) 12%, var(--orca-popover)); }
html.dark .cmd-item.active { background: color-mix(in srgb, var(--orca-foreground) 8%, var(--orca-popover)); }
.cmd-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cmd-check { display: grid; place-items: center; flex: none; width: 14px; height: 14px; color: var(--orca-muted-foreground); }
.cmd-check svg { width: 14px; height: 14px; }
.setup-note { flex: none; padding: 6px 10px; color: var(--orca-muted-foreground); font-size: 12px; user-select: text; }
.setup-efforts {
  display: flex; flex-wrap: wrap; align-items: center; gap: 2px; flex: none; min-height: 36px; padding: 6px 10px;
  border-top: 1px solid var(--orca-border);
}
.seg {
  height: 24px; min-width: 24px; padding: 0 8px; color: var(--orca-muted-foreground); font: inherit; font-size: 12px; font-weight: 500;
  white-space: nowrap; background: transparent; border: 0; border-radius: 6px; outline: none; cursor: pointer;
}
.seg:hover, .seg:focus-visible { color: var(--orca-foreground); }
.seg.on { color: var(--orca-foreground); background: color-mix(in srgb, var(--orca-foreground) 12%, transparent); }
html.dark .seg.on { background: var(--orca-accent); }
.setup-prompt { flex: none; padding: 8px; }
.composer {
  padding: 6px; background: var(--orca-background); border: 1px solid color-mix(in srgb, var(--orca-foreground) 10%, transparent);
  border-radius: 12px; box-shadow: 0 1px 2px rgb(0 0 0 / .05);
}
html.dark .composer { background: color-mix(in srgb, var(--orca-foreground) 4%, transparent); }
.composer-input {
  display: block; width: 100%; min-height: 28px; max-height: calc(6 * 20px + 8px); padding: 4px 8px; overflow-y: auto; resize: none;
  color: inherit; font: inherit; font-size: 14px; line-height: 20px; background: transparent; border: 0; outline: none; user-select: text;
}
.setup-actions { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: 8px; flex: none; padding: 0 8px 8px; }
.btn {
  display: flex; align-items: center; gap: 6px; min-width: 0; height: 32px; padding: 0 12px; color: var(--orca-foreground);
  font: inherit; font-size: 14px; font-weight: 500; line-height: 20px; white-space: nowrap; background: var(--orca-background);
  border: 1px solid var(--orca-border); border-radius: 6px; box-shadow: 0 1px 2px rgb(0 0 0 / .05); outline: none; cursor: pointer;
}
html.dark .btn { background: color-mix(in srgb, var(--orca-input) 30%, transparent); border-color: var(--orca-input); }
.btn:hover, html.dark .btn:hover { color: var(--orca-accent-foreground); background: var(--orca-accent); }
.btn:focus-visible { border-color: var(--orca-ring); box-shadow: 0 0 0 3px color-mix(in srgb, var(--orca-ring) 50%, transparent); }
.btn.primary, html.dark .btn.primary { color: var(--orca-primary-foreground); background: var(--orca-primary); border-color: transparent; box-shadow: none; }
.btn.primary:hover, html.dark .btn.primary:hover { color: var(--orca-primary-foreground); background: color-mix(in srgb, var(--orca-primary) 90%, transparent); }
.btn svg { flex: none; width: 16px; height: 16px; }
.btn-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; text-align: left; }
.keys { display: inline-flex; align-items: center; gap: 2px; flex: none; font-size: 11px; line-height: 1; opacity: .6; }
.keys svg { width: 12px; height: 12px; }
[hidden] { display: none !important; }
`
