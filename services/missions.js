// Mission state: which openings are uncovered, which two are active, and what
// happens when a game counts. All functions mutate the `progress` object passed in.
import { judge, userSide } from './matcher.js'

/** Parked missions allowed per colour. Keeps "choose another branch" from uncovering the whole map. */
const MAX_PARKED = 1

export const isUncovered = (progress, id) => !!progress.missions[id]

function walk(node, visit) {
  visit(node)
  for (const c of node.children) walk(c, visit)
}

/**
 * Hidden openings for `side` that sit next to something already uncovered,
 * main lines first. These are the fog tiles on the map.
 */
export function candidates(tree, progress, side) {
  const out = []
  walk(tree.root, (n) => {
    if (n === tree.root || isUncovered(progress, n.id)) return
    const parentOpen = n.parent === tree.root.id || isUncovered(progress, n.parent)
    if (parentOpen && (!side || n.side === side)) out.push(n)
  })
  return out
}

function activate(progress, node, since) {
  const m = (progress.missions[node.id] ??= { status: 'active', side: node.side, startedAt: since, games: [] })
  m.status = 'active'
  m.since = since
  progress.slots[node.side] = node.id
  return m
}

/** Give each empty slot the next opening in line. Returns the openings that were uncovered. */
export function fillSlots(tree, progress, since) {
  const started = []
  for (const side of ['w', 'b']) {
    if (progress.slots[side]) continue
    const next = candidates(tree, progress, side)[0]
    if (!next) continue
    activate(progress, next, since)
    started.push(next)
  }
  return started
}

/**
 * Judge games that have no verdict yet, oldest first, and advance missions.
 * Returns { judged, events } where judged are the games whose verdict was set.
 */
export function processGames(tree, progress, games) {
  const { settings } = progress
  const judged = []
  const events = []
  const pending = games.filter((g) => !g.verdict).sort((a, b) => a.end - b.end)

  for (const game of pending) {
    judged.push(game)
    const side = userSide(game, settings.username)
    if (!side) {
      game.verdict = { type: 'not_eligible', reason: `${settings.username} did not play in this game` }
      continue
    }
    if (game.end <= progress.createdAt) {
      game.verdict = { type: 'history' }
      continue
    }
    const id = progress.slots[side]
    const mission = id ? progress.missions[id] : null
    const node = id ? tree.byId.get(id) : null
    if (mission && game.end <= mission.since) {
      game.verdict = { type: 'before_mission', node: id }
      continue
    }
    const verdict = judge(game, { node, side, settings })
    if (verdict.type === 'counted') {
      mission.games.push(game.uuid)
      verdict.count = mission.games.length
      verdict.target = node.target
      if (mission.games.length >= node.target) {
        mission.status = 'done'
        mission.completedAt = game.end
        progress.slots[side] = null
        // The next mission starts from this game's end, so games later in the same sync can count for it.
        const [next] = fillSlots(tree, progress, game.end)
        const event = { id: `${id}-${game.end}`, type: 'completed', node: id, next: next?.id ?? null, at: game.end, seen: false }
        progress.events.push(event)
        events.push(event)
      }
    }
    game.verdict = verdict
  }
  return { judged, events }
}

/**
 * Switch a colour's mission to another opening: either a hidden neighbour
 * (which uncovers it) or a parked mission. The current mission is parked and keeps its count.
 */
export function switchMission(tree, progress, toId, now) {
  const node = tree.byId.get(toId)
  if (!node || node === tree.root) throw new Error('That opening is not on the map.')
  const side = node.side
  const existing = progress.missions[toId]
  if (existing?.status === 'done') throw new Error('That mission is already complete.')
  if (existing?.status === 'active') return node
  if (!existing && !candidates(tree, progress, side).includes(node)) {
    throw new Error('That opening is not next to anything you have uncovered yet.')
  }

  const currentId = progress.slots[side]
  const parked = Object.values(progress.missions).filter((m) => m.side === side && m.status === 'parked').length
  const parkedAfter = parked + (currentId ? 1 : 0) - (existing ? 1 : 0)
  if (parkedAfter > MAX_PARKED) {
    throw new Error('You already have a parked mission for this colour. Finish or resume it before uncovering another.')
  }
  if (currentId) progress.missions[currentId].status = 'parked'
  activate(progress, node, now)
  return node
}
