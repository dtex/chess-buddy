// Pull new games from chess.com into data/games/.
import { fetchArchives, fetchMonth } from './chesscom.js'

/**
 * Fetches any month we don't have, and re-checks the two most recent months
 * (a game can finish in either). Unchanged months answer 304 and cost nothing.
 * Returns the games that were not stored before, oldest first.
 */
export async function pullGames({ store, username, fetchImpl = fetch }) {
  const months = await fetchArchives(username, fetchImpl)
  const have = new Set(store.listMonths())
  const meta = store.loadMeta()
  if (meta.username !== username.toLowerCase()) {
    meta.etags = {}
    meta.username = username.toLowerCase()
  }
  const recent = new Set(months.slice(-2))
  const added = []

  for (const key of months) {
    if (have.has(key) && !recent.has(key)) continue
    const res = await fetchMonth(username, key, have.has(key) ? meta.etags[key] : null, fetchImpl)
    if (res.notModified) continue
    const stored = new Map(store.loadMonth(key).map((g) => [g.uuid, g]))
    for (const g of res.games) {
      if (stored.has(g.uuid)) continue
      stored.set(g.uuid, g)
      added.push(g)
    }
    store.saveMonth(key, [...stored.values()])
    if (res.etag) meta.etags[key] = res.etag
  }
  store.saveMeta(meta)
  return added.sort((a, b) => a.end - b.end)
}
