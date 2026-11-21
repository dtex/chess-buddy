// Shapes data for the browser. Nothing about a hidden opening leaves the server
// except that it exists, which colour owns it, and what it hangs off.
import { createHash } from 'node:crypto'
import { candidates, isUncovered } from './missions.js'
import { deepestNode, deviation, formatMove, ineligibleReason, reached, userResult, userSide } from './matcher.js'

/** Opaque id for a fog tile, so the real id (which names the opening) is not exposed. */
export const fogId = (id) => createHash('sha1').update(`fog:${id}`).digest('hex').slice(0, 10)

export function resolveFogId(tree, progress, fid) {
  return candidates(tree, progress).find((n) => fogId(n.id) === fid) ?? null
}

function movesText(node) {
  return node.plies.map((san, i) => (i % 2 === 0 ? `${i / 2 + 1}.${san}` : san)).join(' ')
}

function nodeView(node, progress) {
  const m = progress.missions[node.id]
  return {
    id: node.id,
    parent: node.parent,
    name: node.name,
    side: node.side,
    moves: movesText(node),
    lastMove: node.depth ? formatMove(node.depth, node.plies.at(-1)) : '',
    fen: node.fen,
    eco: node.eco ?? null,
    target: node.target,
    status: m ? m.status : 'start',
    count: m ? m.games.length : 0,
  }
}

/** Games where the user had this opening's colour and the game was eligible, oldest first. */
function sideGames(node, games, settings) {
  return games.filter((g) => userSide(g, settings.username) === node.side && !ineligibleReason(g, settings))
}

/** How often recent games of the right colour got to this opening. */
export function reachRate(node, games, settings, lastN = 50) {
  const pool = sideGames(node, games, settings).slice(-lastN)
  return { reached: pool.filter((g) => reached(node, g)).length, of: pool.length }
}

function formatTimeControl(game) {
  const tc = game.timeControl || ''
  const daily = tc.match(/^1\/(\d+)$/)
  if (daily) {
    const days = Math.round(Number(daily[1]) / 86400)
    return `${days} day${days === 1 ? '' : 's'}/move`
  }
  const [base, inc] = tc.split('+').map(Number)
  if (!base) return tc
  const mins = base >= 60 ? `${+(base / 60).toFixed(1)}` : `${base}s`
  return base >= 60 ? `${mins}+${inc || 0}` : `${mins}+${inc || 0}`
}

function gameView(game, tree, progress) {
  const side = userSide(game, progress.settings.username)
  const opp = side === 'w' ? game.black : game.white
  const deepest = game.moves.length ? deepestNode(tree, game) : null
  const v = game.verdict ?? { type: 'pending' }
  return {
    uuid: game.uuid,
    url: game.url,
    end: game.end,
    side,
    opponent: opp.name,
    opponentRating: opp.rating,
    timeClass: game.timeClass,
    timeControl: formatTimeControl(game),
    result: side ? userResult(game, side) : null,
    opening: !deepest ? null : isUncovered(progress, deepest.id) ? { id: deepest.id, name: deepest.name } : { hidden: true },
    verdict: { ...v, nodeName: v.node ? tree.byId.get(v.node)?.name : undefined },
  }
}

export function stateView(tree, progress, games) {
  const nodes = [nodeView(tree.root, progress)]
  for (const n of tree.nodes) if (isUncovered(progress, n.id)) nodes.push(nodeView(n, progress))
  const fog = candidates(tree, progress).map((n) => ({ fid: fogId(n.id), parent: n.parent, side: n.side }))

  const missions = {}
  for (const side of ['w', 'b']) {
    const id = progress.slots[side]
    const node = id ? tree.byId.get(id) : null
    missions[side] = {
      active: node ? { ...nodeView(node, progress), reach: reachRate(node, games, progress.settings) } : null,
      parked: Object.entries(progress.missions)
        .filter(([, m]) => m.side === side && m.status === 'parked')
        .map(([pid]) => nodeView(tree.byId.get(pid), progress)),
    }
  }

  const events = progress.events
    .filter((e) => !e.seen)
    .map((e) => {
      const next = e.next ? tree.byId.get(e.next) : null
      return {
        id: e.id,
        at: e.at,
        node: nodeView(tree.byId.get(e.node), progress),
        next: next && {
          ...nodeView(next, progress),
          blurb: next.blurb,
          reach: reachRate(next, games, progress.settings),
          isActive: progress.slots[next.side] === next.id,
        },
      }
    })

  const recent = games.filter((g) => g.verdict && g.verdict.type !== 'history').slice(-5).reverse()
  return {
    username: progress.settings.username,
    lastSync: progress.lastSync,
    nodes,
    fog,
    missions,
    events,
    latest: recent.map((g) => gameView(g, tree, progress)),
    totals: { uncovered: nodes.length - 1, openings: tree.nodes.length - 1, done: nodes.filter((n) => n.status === 'done').length },
  }
}

export function gamesView(tree, progress, games, limit = 300) {
  const list = games.slice(-limit).reverse().map((g) => gameView(g, tree, progress))
  return { games: list, total: games.length }
}

export function openingsView(tree, progress) {
  return { openings: tree.nodes.filter((n) => isUncovered(progress, n.id)).map((n) => nodeView(n, progress)) }
}

export function openingView(tree, progress, games, id) {
  const node = tree.byId.get(id)
  if (!node || !isUncovered(progress, id)) return null
  const { settings } = progress
  const pool = sideGames(node, games, settings)
  const hit = pool.filter((g) => reached(node, g))
  const record = { win: 0, draw: 0, loss: 0 }
  for (const g of hit) record[userResult(g, node.side)]++

  // Where the games that missed went instead, by the first move off the line.
  const elsewhere = new Map()
  for (const g of pool) {
    if (reached(node, g)) continue
    const d = deviation(node, g)
    if (d.ended) continue
    const move = formatMove(d.ply, d.played)
    const key = `${d.by}|${move}`
    const row = elsewhere.get(key) ?? { move, mine: d.by === node.side, count: 0 }
    row.count++
    elsewhere.set(key, row)
  }

  const yours = node.plies.map((san, i) => ({ san, ply: i + 1 })).filter((p) => (p.ply % 2 === 1) === (node.side === 'w'))
  const theirs = node.plies.map((san, i) => ({ san, ply: i + 1 })).filter((p) => (p.ply % 2 === 1) !== (node.side === 'w'))
  const mission = progress.missions[id]
  const byUuid = new Map(games.map((g) => [g.uuid, g]))
  const fenParam = encodeURIComponent(node.fen)

  return {
    ...nodeView(node, progress),
    blurb: node.blurb ?? '',
    ideas: node.ideas ?? [],
    yourMoves: yours.map((p) => formatMove(p.ply, p.san)),
    theirMoves: theirs.map((p) => formatMove(p.ply, p.san)),
    stats: {
      of: pool.length,
      reached: hit.length,
      record,
      elsewhere: [...elsewhere.values()].sort((a, b) => b.count - a.count).slice(0, 7),
      missed: pool.length - hit.length,
    },
    missionGames: mission.games.map((u) => byUuid.get(u)).filter(Boolean).reverse().map((g) => gameView(g, tree, progress)),
    children: node.children.filter((c) => isUncovered(progress, c.id)).map((c) => nodeView(c, progress)),
    hiddenChildren: node.children.filter((c) => !isUncovered(progress, c.id)).length,
    links: {
      chesscom: `https://www.chess.com/analysis?fen=${fenParam}`,
      lichess: `https://lichess.org/analysis/standard/${node.fen.replace(/ /g, '_')}#explorer`,
    },
  }
}
