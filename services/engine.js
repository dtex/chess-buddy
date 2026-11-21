// Ties the pieces together for one sync run.
import { pullGames } from './sync.js'

export async function runSync({ store, fetchImpl }) {
  const progress = store.loadProgress()
  const added = await pullGames({ store, username: progress.settings.username, fetchImpl })
  progress.lastSync = Math.floor(Date.now() / 1000)
  store.saveProgress(progress)
  return { added: added.length, total: store.loadAllGames().length, lastSync: progress.lastSync }
}
