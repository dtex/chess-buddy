import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { saveToGit } from '../services/save.js'

const sh = (cwd, ...args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim()

function repoWithRemote() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'cb-save-'))
  const remote = path.join(base, 'remote.git')
  const repo = path.join(base, 'repo')
  execFileSync('git', ['init', '-q', '--bare', remote])
  execFileSync('git', ['init', '-q', repo])
  sh(repo, 'config', 'user.email', 'test@example.com')
  sh(repo, 'config', 'user.name', 'Test')
  sh(repo, 'config', 'commit.gpgsign', 'false')
  fs.mkdirSync(path.join(repo, 'data'))
  fs.writeFileSync(path.join(repo, 'data', 'progress.json'), '{}')
  fs.writeFileSync(path.join(repo, 'code.js'), '// v1')
  sh(repo, 'add', '-A')
  sh(repo, 'commit', '-q', '-m', 'init')
  return { repo, remote, dataDir: path.join(repo, 'data') }
}

test('commits only data/ and pushes', async () => {
  const { repo, remote, dataDir } = repoWithRemote()
  sh(repo, 'remote', 'add', 'origin', remote)
  fs.writeFileSync(path.join(dataDir, 'progress.json'), '{"a":1}')
  fs.writeFileSync(path.join(repo, 'code.js'), '// work in progress')
  sh(repo, 'add', 'code.js') // staged, but not ours to commit

  const res = await saveToGit({ repoDir: repo, dataDir, summary: '3 openings uncovered, 1 complete' })
  assert.deepEqual([res.committed, res.pushed], [true, true])
  assert.equal(sh(repo, 'log', '-1', '--format=%s'), 'Progress: 3 openings uncovered, 1 complete')
  assert.equal(sh(repo, 'show', '--name-only', '--format=', 'HEAD'), 'data/progress.json')
  assert.match(sh(repo, 'status', '--porcelain'), /code\.js/, 'other work is left alone')
  assert.equal(execFileSync('git', ['--git-dir', remote, 'log', '-1', '--format=%s'], { encoding: 'utf8' }).trim(),
    'Progress: 3 openings uncovered, 1 complete')

  const again = await saveToGit({ repoDir: repo, dataDir, summary: 'x' })
  assert.deepEqual([again.committed, again.pushed], [false, true])
})

test('without a remote it commits and says nothing was pushed', async () => {
  const { repo, dataDir } = repoWithRemote()
  fs.writeFileSync(path.join(dataDir, 'progress.json'), '{"a":2}')
  const res = await saveToGit({ repoDir: repo, dataDir, summary: 's' })
  assert.deepEqual([res.committed, res.pushed], [true, false])
  assert.match(res.message, /No "origin" remote/)
})

test('refuses a data folder outside the repository', async () => {
  const { repo } = repoWithRemote()
  await assert.rejects(saveToGit({ repoDir: repo, dataDir: os.tmpdir(), summary: 's' }), /outside this repository/)
})
