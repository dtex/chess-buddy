// Ties the pieces together: load state, sync, and keep missions moving.
import { pullGames } from './sync.js'
import { loadTree } from './tree.js'
import { fillSlots, processGames } from './missions.js'

let tree = null
export function getTree() {
  return (tree ??= loadTree())
}

const now = () => Math.floor(Date.now() / 1000)

/** Progress with both mission slots filled where possible. Saves if anything changed. */
export function loadState({ store }) {
  const progress = store.loadProgress()
  if (fillSlots(getTree(), progress, now()).length) store.saveProgress(progress)
  return { tree: getTree(), progress, games: store.loadAllGames() }
}

/** Judge any stored games that have no verdict yet and save the results. */
function judgeStored(store, progress) {
  const games = store.loadAllGames()
  const { judged, events } = processGames(getTree(), progress, games)
  if (judged.length) store.saveGames(judged)
  return { games, judged, events }
}

export async function runSync({ store, fetchImpl }) {
  // Missions must exist before new games are judged.
  const { progress } = loadState({ store })
  const added = await pullGames({ store, username: progress.settings.username, fetchImpl })
  const { games, judged, events } = judgeStored(store, progress)
  progress.lastSync = now()
  store.saveProgress(progress)
  return {
    added: added.length,
    counted: judged.filter((g) => g.verdict.type === 'counted').length,
    completed: events.length,
    total: games.length,
    lastSync: progress.lastSync,
  }
}
