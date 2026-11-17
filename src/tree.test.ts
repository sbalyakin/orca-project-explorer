import { assert, test } from 'orca/testing'
import { buildTree, folderPath } from './tree'
import type { GroupNode, TreeNode } from './types'

const HOME = '/Users/me'

test('folders: first folder under home is one root, a project outside home hangs off its parent', () => {
  assert.deepEqual(folderPath('/Users/me/Space/Dev/projects/app', HOME), ['~/Space', 'Dev', 'projects'])
  assert.deepEqual(folderPath('/Users/me/Space/app', HOME), ['~/Space'])
  assert.deepEqual(folderPath('/Users/me/app', HOME), ['~'])
  assert.deepEqual(folderPath('/Volumes/disk/Courses/Drumeo/', HOME), ['/Volumes/disk/Courses'])
  assert.deepEqual(folderPath('/app', HOME), ['/'])
})

const labels = (nodes: readonly TreeNode[]): string[] => nodes.map((node) => node.label)

test('builds the folder tree: folders first, then projects, each sorted', () => {
  const projects = [
    { id: 'p1', name: 'zeta', path: `${HOME}/Space/Dev/zeta` },
    { id: 'p2', name: 'Alpha', path: `${HOME}/Space/Dev/alpha` },
    { id: 'p3', name: 'nested', path: `${HOME}/Space/Dev/projects/nested` },
    { id: 'p4', name: 'drumeo', path: '/Volumes/disk/Courses/Drumeo' },
    { id: 'p5', name: 'secret', path: `${HOME}/Space/Dev/secret`, hidden: true }
  ]
  const workspaces = projects.map((project) => ({
    id: `w-${project.id}`,
    name: project.name,
    projectId: project.id,
    path: project.path,
    branch: 'main'
  }))
  const tree = buildTree(projects, workspaces, HOME)
  assert.deepEqual(labels(tree), ['/Volumes/disk/Courses', '~/Space'])
  const dev = (tree[1].children[0] as GroupNode).children
  assert.deepEqual(labels(dev), ['projects', 'Alpha', 'zeta'])
})

test('a linked worktree nests under its project; the main checkout is the one at the project path', () => {
  const projects = [{ id: 'p1', name: 'app', path: `${HOME}/Space/app` }]
  const workspaces = [
    { id: 'w2', name: 'feature', projectId: 'p1', path: `${HOME}/orca/app/feature`, branch: 'feature/x' },
    { id: 'w1', name: 'main', projectId: 'p1', path: `${HOME}/Space/app`, branch: 'main' }
  ]
  const [root] = buildTree(projects, workspaces, HOME)
  const [project] = root.children
  assert.equal(project.kind === 'workspace' && project.workspaceId, 'w1')
  assert.equal(project.kind === 'workspace' && project.detail, 'main')
  const [linked] = project.children
  assert.equal(linked.kind === 'workspace' && linked.linked, true)
  assert.equal(linked.kind === 'workspace' && linked.detail, 'feature/x')
})

test('folder workspaces have no branch, and the tree stays plain JSON', () => {
  const projects = [{ id: 'p1', name: 'notes', path: `${HOME}/Space/notes` }]
  const workspaces = [{ id: 'w1', name: 'notes', projectId: 'p1', path: `${HOME}/Space/notes`, branch: null }]
  const tree = buildTree(projects, workspaces, HOME)
  assert.deepEqual(JSON.parse(JSON.stringify(tree)), tree)
})

test('status becomes the strongest need: permission over unread over working', () => {
  const projects = ['a', 'b', 'c', 'd'].map((id) => ({ id, name: id, path: `${HOME}/Space/${id}` }))
  const statuses = [
    { state: 'working', unread: true },
    { state: 'permission', unread: true },
    { state: 'working', unread: false },
    { state: 'inactive', unread: false }
  ]
  const workspaces = projects.map((project, index) => ({
    id: `w-${project.id}`,
    name: project.id,
    projectId: project.id,
    path: project.path,
    branch: null,
    status: statuses[index]
  }))
  const [root] = buildTree(projects, workspaces, HOME)
  const attention = root.children.map((node) => (node.kind === 'workspace' ? node.attention : null))
  assert.deepEqual(attention, ['unread', 'permission', 'working', 'none'])
})
