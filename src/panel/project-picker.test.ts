import { assert, test } from 'orca/testing'
import { matchProjects } from './project-picker'

const projects = [{ label: 'orca-project-tree' }, { label: 'Rider Plugin' }, { label: 'notes' }]

test('a project matches when every typed word is in its name, in any case', () => {
  assert.deepEqual(matchProjects(projects, 'ORCA tree'), [projects[0]])
  assert.deepEqual(matchProjects(projects, ''), projects)
  assert.deepEqual(matchProjects(projects, 'zzz'), [])
})
