import { assert, test } from 'orca/testing'
import { buildTree, folderPath } from './tree'
import { isProjectFolder, type GroupNode, type TreeNode } from './types'

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

test('a project with other worktrees folds: the main checkout is its first child, then the linked ones', () => {
  const projects = [{ id: 'p1', name: 'app', path: `${HOME}/Space/app` }]
  const workspaces = [
    { id: 'w2', name: 'feature', projectId: 'p1', path: `${HOME}/orca/app/feature`, branch: 'feature/x' },
    { id: 'w1', name: 'main', projectId: 'p1', path: `${HOME}/Space/app`, branch: 'main' }
  ]
  const [root] = buildTree(projects, workspaces, HOME)
  const [project] = root.children
  assert.equal(project.kind === 'workspace' && project.workspaceId, 'w1')
  assert.equal(project.kind === 'workspace' && project.detail, undefined)
  assert.equal(project.kind === 'workspace' && isProjectFolder(project), true)
  const [primary, linked] = project.children
  assert.equal(primary.kind === 'workspace' && primary.primary, true)
  assert.equal(primary.label, 'app')
  assert.equal(primary.kind === 'workspace' && primary.detail, 'main')
  assert.equal(primary.kind === 'workspace' && primary.workspaceId, 'w1')
  assert.notEqual(primary.key, project.key)
  assert.equal(linked.kind === 'workspace' && linked.linked, true)
  assert.equal(linked.kind === 'workspace' && linked.detail, 'feature/x')
})

test('the primary child stays first whatever the worktrees are called, and takes the status', () => {
  const projects = [{ id: 'p1', name: 'zz', path: `${HOME}/Space/zz` }]
  const workspaces = [
    { id: 'w2', name: 'aaa', projectId: 'p1', path: `${HOME}/orca/zz/aaa`, branch: 'a' },
    { id: 'w1', name: 'zz', projectId: 'p1', path: `${HOME}/Space/zz`, branch: 'main', status: { state: 'working', unread: false } }
  ]
  const [root] = buildTree(projects, workspaces, HOME)
  const [project] = root.children
  assert.deepEqual(labels(project.children), ['zz', 'aaa'])
  assert.equal(project.kind === 'workspace' && project.attention, 'none')
  assert.equal(project.children[0].kind === 'workspace' && project.children[0].attention, 'working')
})

test('a project without other worktrees is one row that opens its workspace', () => {
  const projects = [{ id: 'p1', name: 'app', path: `${HOME}/Space/app` }]
  const workspaces = [{ id: 'w1', name: 'app', projectId: 'p1', path: `${HOME}/Space/app`, branch: 'main' }]
  const [root] = buildTree(projects, workspaces, HOME)
  const [project] = root.children
  assert.equal(project.children.length, 0)
  assert.equal(project.kind === 'workspace' && isProjectFolder(project), false)
  assert.equal(project.kind === 'workspace' && project.detail, 'main')
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
