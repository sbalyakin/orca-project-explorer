import { assert, test } from 'orca/testing'
import { parseClaudeModels, parseCodexModels, parseCursorModels, parseGeminiModels, parseOpenCodeModels, parsePiModels, parsePiRpcModels } from './parse'

test('codex: visible models with their levels and defaults', () => {
  const rows = [
    {
      id: 'gpt-6-luna',
      displayName: 'GPT-6-Luna',
      hidden: false,
      isDefault: false,
      defaultReasoningEffort: 'medium',
      supportedReasoningEfforts: [{ reasoningEffort: 'low' }, { reasoningEffort: 'medium' }, { reasoningEffort: 'high' }]
    },
    { id: 'gpt-6.1-sol', displayName: 'GPT-6.1-Sol', hidden: false, isDefault: true, supportedReasoningEfforts: [] },
    { id: 'old', displayName: 'Old', hidden: true, supportedReasoningEfforts: [] },
    { id: 'gpt-6-luna', displayName: 'Duplicate', supportedReasoningEfforts: [] }
  ]
  assert.deepEqual(parseCodexModels(rows), [
    { id: 'gpt-6-luna', label: 'GPT-6-Luna', efforts: ['low', 'medium', 'high'], defaultEffort: 'medium' },
    { id: 'gpt-6.1-sol', label: 'GPT-6.1-Sol', efforts: [], isDefault: true }
  ])
  assert.deepEqual(parseCodexModels('nope'), [])
})

test('claude: the default row becomes a mark on the model it resolves to', () => {
  const rows = [
    { value: 'default', resolvedModel: 'claude-opus-5-5', displayName: 'Default (recommended)', supportsEffort: true, supportedEffortLevels: ['low'] },
    { value: 'claude-sonnet-4-5', displayName: 'Claude 4.5 Sonnet', supportsThinkingOff: true },
    { value: 'claude-opus-5-5', resolvedModel: 'claude-opus-5-5', displayName: 'Claude Opus 5.5', supportsEffort: true, supportedEffortLevels: ['low', 'high'] }
  ]
  assert.deepEqual(parseClaudeModels(rows), [
    { id: 'claude-sonnet-4-5', label: 'Claude 4.5 Sonnet', efforts: [] },
    { id: 'claude-opus-5-5', label: 'Claude Opus 5.5', efforts: ['low', 'high'], isDefault: true }
  ])
})

test('pi: provider/model ids, levels only where the model thinks', () => {
  const text = [
    'provider           model                        context  max-out  thinking  images',
    'bionic             qwen3.8-27b-obliterated      262.1K   32.8K    no        yes   ',
    'jb-central-codex   gpt-6-luna                   1.1M     128K     yes       no    ',
    'jb-central-codex   gpt-6-luna                   1.1M     128K     yes       no    '
  ].join('\n')
  assert.deepEqual(parsePiModels(text), [
    { id: 'bionic/qwen3.8-27b-obliterated', label: 'bionic/qwen3.8-27b-obliterated', efforts: [] },
    { id: 'jb-central-codex/gpt-6-luna', label: 'jb-central-codex/gpt-6-luna', efforts: ['low', 'medium', 'high', 'xhigh', 'max'] }
  ])
})

test('opencode: ids only, log lines ignored', () => {
  const text = 'INFO starting up\njb-openai/openai/gpt-6-luna\n\njb-gemini/gemini-4-argon\njb-openai/openai/gpt-6-luna\n'
  assert.deepEqual(parseOpenCodeModels(text).map((model) => model.id), ['jb-openai/openai/gpt-6-luna', 'jb-gemini/gemini-4-argon'])
})

test('cursor: id and label, the default marked', () => {
  const text = 'Available models\n\nauto - Auto (default)\ngpt-5.2 - GPT-5.2\n'
  assert.deepEqual(parseCursorModels(text), [
    { id: 'auto', label: 'Auto', efforts: [], isDefault: true },
    { id: 'gpt-5.2', label: 'GPT-5.2', efforts: [] }
  ])
})

test('pi rpc: display names, provider-prefixed ids, levels from the model map', () => {
  const rows = [
    { id: 'anthropic/claude-fable-5-2', name: 'Claude Fable 5.2 | JB', provider: 'jb-litellm', reasoning: true, thinkingLevelMap: { off: null, xhigh: 'xhigh', max: 'max' } },
    { id: 'plain', provider: 'local', reasoning: false },
    { id: 'plain', provider: 'local', reasoning: false }
  ]
  assert.deepEqual(parsePiRpcModels(rows), [
    { id: 'jb-litellm/anthropic/claude-fable-5-2', label: 'Claude Fable 5.2 | JB', efforts: ['minimal', 'low', 'medium', 'high', 'xhigh', 'max'] },
    { id: 'local/plain', label: 'plain', efforts: [] }
  ])
})

test('gemini: id (Label) lines under heading, indented metadata ignored', () => {
  const text = [
    'Available Gemini Models:',
    '',
    'auto (Auto)',
    '  Description:   Let Gemini CLI decide the best model for the task: gemini-2.5-pro, gemini-3.5-flash',
    '  Context limit: 1,048,576 input tokens / 8,192 output tokens',
    '',
    'gemini-2.5-pro (gemini-2.5-pro)',
    '  Context limit: 1,048,576 input tokens / 8,192 output tokens',
    ''
  ].join('\n')
  assert.deepEqual(parseGeminiModels(text), [
    { id: 'auto', label: 'Auto', efforts: [] },
    { id: 'gemini-2.5-pro', label: 'gemini-2.5-pro', efforts: [] }
  ])
})
