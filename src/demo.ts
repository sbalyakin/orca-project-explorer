// Fixture tree and agent texts for taking screenshots without exposing real projects.
// Enabled only when `.orca/demo` exists in the plugin root (gitignored).
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { AgentText, DemoDisplay, ProjectTree } from './types'

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

const DEFAULT_DEMO_FLAG = join(dirname(fileURLToPath(import.meta.url)), '..', '.orca', 'demo')

export type DemoConfig = {
  favorites: boolean
  display?: DemoDisplay
}

export function demoConfig(flagPath: string = DEFAULT_DEMO_FLAG): DemoConfig | null {
  if (flagPath === DEFAULT_DEMO_FLAG && process.env.NODE_TEST_CONTEXT) return null
  try {
    if (!existsSync(flagPath)) return null
    const content = readFileSync(flagPath, 'utf8').trim()
    if (content === 'no-favorites') return { favorites: false }
    if (content.startsWith('{')) {
      const parsed = JSON.parse(content) as { favorites?: unknown; display?: unknown }
      const favorites = parsed.favorites !== false
      const display = parsed.display && typeof parsed.display === 'object' ? (parsed.display as DemoDisplay) : undefined
      return display ? { favorites, display } : { favorites }
    }
    return { favorites: true }
  } catch {
    return null
  }
}

export function isDemoMode(flagPath: string = DEFAULT_DEMO_FLAG): boolean {
  return demoConfig(flagPath) !== null
}

export function demoTree(now: number = Date.now(), cfg: DemoConfig = { favorites: true }): ProjectTree {
  return {
    demoFavorites: cfg.favorites ? ['demo:web-platform', 'demo:ai-copilot', 'demo:orca-project-explorer'] : [],
    ...(cfg.display ? { demoDisplay: cfg.display } : {}),
    nodes: [
      {
        kind: 'group',
        key: 'group:~/work',
        label: '~/work',
        children: [
          {
            kind: 'workspace',
            key: 'demo:web-platform',
            workspaceId: 'demo:web-platform',
            label: 'web-platform',
            linked: false,
            icon: { type: 'lucide', name: 'Globe' },
            color: '#3b82f6',
            attention: 'none',
            children: [
              {
                kind: 'workspace',
                key: 'demo:web-platform:main',
                workspaceId: 'demo:web-platform',
                label: 'web-platform',
                detail: 'main',
                linked: false,
                primary: true,
                attention: 'none',
                activeAt: now - 3 * HOUR,
                terminals: 1,
                children: []
              },
              {
                kind: 'workspace',
                key: 'demo:web-platform:auth',
                workspaceId: 'demo:web-platform:auth',
                label: 'feature/oauth-pkce',
                detail: 'feature/oauth-pkce',
                linked: true,
                attention: 'working',
                activeAt: now - 15_000,
                terminals: 2,
                children: []
              },
              {
                kind: 'workspace',
                key: 'demo:web-platform:billing',
                workspaceId: 'demo:web-platform:billing',
                label: 'fix/invoice-tax',
                detail: 'fix/invoice-tax',
                linked: true,
                attention: 'permission',
                unread: true,
                activeAt: now - 4 * MIN,
                terminals: 1,
                children: []
              }
            ]
          },
          {
            kind: 'group',
            key: 'group:~/work/backend',
            label: 'backend',
            children: [
              {
                kind: 'workspace',
                key: 'demo:api-gateway',
                workspaceId: 'demo:api-gateway',
                label: 'api-gateway',
                detail: 'feat/rate-limits',
                linked: false,
                icon: { type: 'lucide', name: 'Server' },
                color: '#10b981',
                attention: 'unread',
                unread: true,
                activeAt: now - 12 * MIN,
                terminals: 1,
                children: []
              },
              {
                kind: 'workspace',
                key: 'demo:analytics-db',
                workspaceId: 'demo:analytics-db',
                label: 'analytics-db',
                detail: 'migrations/q4',
                linked: false,
                icon: { type: 'lucide', name: 'Database' },
                color: '#14b8a6',
                attention: 'none',
                activeAt: now - 5 * HOUR,
                children: []
              }
            ]
          },
          {
            kind: 'group',
            key: 'group:~/work/clients',
            label: 'clients',
            children: [
              {
                kind: 'workspace',
                key: 'demo:design-system',
                workspaceId: 'demo:design-system',
                label: 'design-system',
                detail: 'main',
                linked: false,
                icon: { type: 'lucide', name: 'Palette' },
                color: '#8b5cf6',
                attention: 'none',
                activeAt: now - 2 * HOUR,
                children: []
              },
              {
                kind: 'workspace',
                key: 'demo:mobile-app',
                workspaceId: 'demo:mobile-app',
                label: 'mobile-app',
                detail: 'feat/offline-sync',
                linked: false,
                icon: { type: 'lucide', name: 'Rocket' },
                color: '#ec4899',
                attention: 'working',
                activeAt: now - 3 * MIN,
                terminals: 1,
                children: []
              }
            ]
          }
        ]
      },
      {
        kind: 'group',
        key: 'group:~/oss',
        label: '~/oss',
        children: [
          {
            kind: 'workspace',
            key: 'demo:orca-project-explorer',
            workspaceId: 'demo:orca-project-explorer',
            label: 'orca-project-explorer',
            detail: 'main',
            linked: false,
            icon: { type: 'lucide', name: 'Layers' },
            color: '#f59e0b',
            attention: 'monitoring',
            activeAt: now - 28 * MIN,
            terminals: 2,
            children: []
          },
          {
            kind: 'workspace',
            key: 'demo:tiny-router',
            workspaceId: 'demo:tiny-router',
            label: 'tiny-router',
            detail: 'v2-rewrite',
            linked: false,
            icon: { type: 'lucide', name: 'SquareTerminal' },
            color: '#06b6d4',
            attention: 'none',
            activeAt: now - 1 * DAY,
            children: []
          },
          {
            kind: 'workspace',
            key: 'demo:cli-tools',
            workspaceId: 'demo:cli-tools',
            label: 'cli-tools',
            detail: 'fix/ansi-width',
            linked: false,
            icon: { type: 'lucide', name: 'Wrench' },
            color: '#f97316',
            attention: 'unread',
            unread: true,
            activeAt: now - 42 * MIN,
            children: []
          }
        ]
      },
      {
        kind: 'group',
        key: 'group:~/labs',
        label: '~/labs',
        children: [
          {
            kind: 'workspace',
            key: 'demo:ai-copilot',
            workspaceId: 'demo:ai-copilot',
            label: 'ai-copilot',
            detail: 'exp/tool-streaming',
            linked: false,
            icon: { type: 'lucide', name: 'Bot' },
            color: '#6366f1',
            attention: 'permission',
            unread: true,
            activeAt: now - 2 * MIN,
            terminals: 2,
            children: []
          },
          {
            kind: 'workspace',
            key: 'demo:docs-site',
            workspaceId: 'demo:docs-site',
            label: 'docs-site',
            detail: 'main',
            linked: false,
            icon: { type: 'lucide', name: 'Code2' },
            color: '#84cc16',
            attention: 'none',
            activeAt: now - 2 * DAY,
            children: []
          }
        ]
      }
    ]
  }
}

export function demoTexts(): Record<string, AgentText> {
  return {
    'demo:web-platform': {
      title: 'Sync staging env variables',
      message: 'Updated .env.example and verified all 18 tests pass.'
    },
    'demo:web-platform:auth': {
      title: 'Add PKCE verifier to OAuth flow',
      message: 'Running integration suite for token refresh edge cases...'
    },
    'demo:web-platform:billing': {
      title: 'Fix VAT rounding on EU invoices',
      message: 'Waiting for approval to run database migration in local Docker.'
    },
    'demo:api-gateway': {
      title: 'Per-tenant sliding window limiter',
      message: 'Implemented Redis Lua script and added burst tests.'
    },
    'demo:design-system': {
      title: 'Audit dark mode contrast tokens',
      message: 'All button and badge pairs now meet WCAG AA.'
    },
    'demo:orca-project-explorer': {
      title: 'Prepare v0.1.0 release',
      message: 'Manifest validated and all 26 test files are green.'
    },
    'demo:tiny-router': {
      title: 'Benchmark wildcard matching',
      message: 'Radix tree lookup is 3.4x faster on 500 routes.'
    },
    'demo:mobile-app': {
      title: 'Background SQLite sync queue',
      message: 'Implementing retry backoff for flaky cellular connections...'
    },
    'demo:analytics-db': {
      title: 'Partition events table by month',
      message: 'Dry-run migration completed in 1.2s with zero lock waits.'
    },
    'demo:cli-tools': {
      title: 'Fix CJK width in table alignment',
      message: 'Added east-asian-width check and snapshot tests.'
    },
    'demo:ai-copilot': {
      title: 'Stream partial tool-call arguments',
      message: 'Waiting for confirmation to run live eval suite.'
    },
    'demo:docs-site': {
      title: 'Add keyboard shortcuts reference',
      message: 'Published updated navigation guide and search index.'
    }
  }
}
