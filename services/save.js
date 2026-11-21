// "Save to GitHub": commit the data folder and push. Nothing outside data/ is touched.
import { execFile } from 'node:child_process'
import path from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)

async function git(repoDir, args) {
  const { stdout } = await run('git', ['-C', repoDir, ...args], { timeout: 60_000 })
  return stdout.trim()
}

const lastLine = (err) => String(err.stderr || err.message).trim().split('\n').filter(Boolean).pop()

export async function saveToGit({ repoDir, dataDir, summary }) {
  const rel = path.relative(repoDir, dataDir)
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('The data folder is outside this repository, so there is nothing to commit.')
  }

  let committed = false
  const changed = await git(repoDir, ['status', '--porcelain', '--', rel])
  if (changed) {
    await git(repoDir, ['add', '--', rel])
    // The pathspec keeps anything else you have staged out of this commit.
    await git(repoDir, ['commit', '-m', `Progress: ${summary}`, '--', rel])
    committed = true
  }

  const remotes = await git(repoDir, ['remote'])
  if (!remotes.split('\n').includes('origin')) {
    return { committed, pushed: false, message: `${committed ? 'Committed.' : 'Nothing new to commit.'} No "origin" remote is set up, so nothing was pushed.` }
  }
  try {
    await git(repoDir, ['push', '-u', 'origin', 'HEAD'])
  } catch (err) {
    return { committed, pushed: false, message: `${committed ? 'Committed locally, but the push failed' : 'Push failed'}: ${lastLine(err)}` }
  }
  return { committed, pushed: true, message: committed ? 'Progress committed and pushed to GitHub.' : 'Nothing new to commit. GitHub is up to date.' }
}
