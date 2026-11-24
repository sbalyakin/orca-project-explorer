# Launching agents and listing models

## Agent list (2026-11-19)

- The menu lists the agents returned by `orca agent installed --json` (`src/agents.ts`, `agents.installed` worker request): enabled agents in Settings → Agents, including custom commands, in Orca's order.
- Cached in panel storage (`agents:v1`) and refreshed on startup and on panel focus/look (`reloadOnLook`). Falls back to `DEFAULT_AGENT_IDS` if the CLI is missing or fails.

## Launch

- `src/launch.ts` runs `orca agent launch --agent --worktree --focus --json` with optional `--model`, `--effort`, `--prompt`, `--surface`. The host API `agent.launch` takes only agent and prompt, which is why the CLI is used.
- `--effort` needs `--model`; the CLI refuses it alone. An empty prompt is left out.
- Worktree selector: `identity:...` ids as they are, other ids (folders) as `id:<id>`.
- Without `--surface` Orca uses the person's Chat | CLI choice for that agent. The plugin cannot read that setting. A row click and `Enter` in the menu search launch without a surface; the flyout buttons and `Enter` in its fields pass `chat` or `terminal` explicitly. Chat is drawn as the primary button by assumption.
- Fast mode has no CLI flag, so the flyout has no Fast toggle.
- `--surface chat` is refused when Orca knows the agent cannot open as a chat (Orca's own picker shows "No chat on this host" for Cursor).
- Verified by launching Pi in a real workspace: `jb-litellm/anthropic/claude-haiku-5-5` at `low` started as `(jb-litellm) anthropic/claude-haiku-5-5 • low` (2026-11-17). Claude, Codex, OpenCode and Cursor launches from the menu are not verified.

## Model lists

Each agent is asked through its own CLI, as Orca's picker does (`src/catalog/probe.ts`, parsers in `parse.ts`, each with a test and a real sample).

| Agent | Source |
|---|---|
| Codex | `codex app-server`: `initialize`, `initialized`, paged `model/list` |
| Claude | `claude -p --input-format stream-json --output-format stream-json --verbose --strict-mcp-config`, `control_request` `list_models` (no model turn) |
| Pi | `pi --mode rpc`, `{"type":"get_available_models"}`: display names, `thinkingLevelMap`; launch id is `provider/id`. Fallback: `pi --list-models` (table, printed to stdout and stderr) |
| OpenCode 2 | `opencode-jb models`; no `--verbose`, no reasoning levels |
| Cursor | `cursor-agent --list-models` |
| Gemini | `gemini --list-models` (checked 2026-11-19) |
| Antigravity | `agy models` (`id\tLabel` when piped, 2+ spaces on a TTY; `-(low|medium|high|xhigh|max)` variants grouped into one model with `efforts`) (checked 2026-11-24) |

- Pi levels: `off, minimal, low, medium, high`, plus `xhigh` and `max` only when the model maps them; a level mapped to `null` is dropped; a model without `reasoning` has none. Matches Orca's picker (2026-11-17).
- The Codex and Claude protocols are undocumented. After an agent update, a failing probe is the first suspect.
- Other agents (Copilot, Droid, Grok, Kimi, Kiro) launch without a list; the flyout accepts a typed model id.

## Cache

- Plugin storage, key `models-v3:<agent>`, 6 h, stale-while-revalidate with in-flight dedupe; a refresh is pushed to the panel as `models.updated`. Change the key when the stored shape changes (it was `models-v2:<agent>` before Antigravity effort grouping).
- `last:<agent>` holds the last model and effort. A saved model missing from a fresh list is kept as the chosen one; the flyout still opens scrolled to it when it is listed.
