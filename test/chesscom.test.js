import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { parseMoves, trimGame } from '../services/chesscom.js'
import { createStore } from '../services/store.js'
import { pullGames } from '../services/sync.js'

const PGN = `[Event "Live Chess"]
[Site "Chess.com"]
[Result "1-0"]

1. e4 {[%clk 0:09:58]} 1... e5 {[%clk 0:09:57]} 2. Nf3 {[%clk 0:09:50]} 2... Nc6 {[%clk 0:09:49]} 3. Bc4 {[%clk 0:09:40]} 1-0`

test('parseMoves strips headers, clocks, numbers and the result', () => {
  assert.deepEqual(parseMoves(PGN), ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'])
  assert.deepEqual(parseMoves(PGN, 2), ['e4', 'e5'])
  assert.deepEqual(parseMoves('1.d4 d5 2.c4 *'), ['d4', 'd5', 'c4'])
})

const raw = (over = {}) => ({
  uuid: 'u1', url: 'https://www.chess.com/game/live/1', end_time: 1795000000, rated: true,
  time_class: 'blitz', time_control: '300', rules: 'chess', pgn: PGN,
  white: { username: 'dtexus', rating: 800, result: 'win' },
  black: { username: 'someone', rating: 790, result: 'resigned' },
  ...over,
})

test('trimGame keeps moves for standard games only', () => {
  assert.equal(trimGame(raw()).moves.length, 5)
  assert.deepEqual(trimGame(raw({ rules: 'chess960' })).moves, [])
  const thematic = trimGame(raw({ initial_setup: 'rnbqkbnr/ppppp1pp/8/5p2/3PP3/8/PPP2PPP/RNBQKBNR b KQkq e3 0 2' }))
  assert.equal(thematic.customStart, true)
  assert.deepEqual(thematic.moves, [])
})

function fakeChessCom(months) {
  const calls = []
  const impl = async (url, { headers }) => {
    calls.push(url)
    const json = (body, etag) => ({ status: 200, ok: true, headers: { get: () => etag }, json: async () => body })
    if (url.endsWith('/archives')) {
      return json({ archives: Object.keys(months).map((k) => `https://api.chess.com/pub/player/x/games/${k.replace('-', '/')}`) })
    }
    const key = url.match(/(\d{4})\/(\d{2})$/).slice(1).join('-')
    if (headers['If-None-Match'] === `etag-${key}-${months[key].length}`) return { status: 304, ok: false }
    return json({ games: months[key] }, `etag-${key}-${months[key].length}`)
  }
  return { impl, calls }
}

test('pullGames stores new games once and skips unchanged months', async () => {
  const store = createStore(fs.mkdtempSync(path.join(os.tmpdir(), 'cb-')))
  const months = {
    '2026-09': [raw({ uuid: 'a', end_time: 1790000000 })],
    '2026-10': [raw({ uuid: 'b', end_time: 1792000000 })],
    '2026-11': [raw({ uuid: 'c', end_time: 1795000000 })],
  }
  const api = fakeChessCom(months)
  const first = await pullGames({ store, username: 'dtexus', fetchImpl: api.impl })
  assert.deepEqual(first.map((g) => g.uuid), ['a', 'b', 'c'])

  months['2026-11'].push(raw({ uuid: 'd', end_time: 1795000500 }))
  api.calls.length = 0
  const second = await pullGames({ store, username: 'dtexus', fetchImpl: api.impl })
  assert.deepEqual(second.map((g) => g.uuid), ['d'])
  assert.equal(api.calls.some((u) => u.endsWith('2026/09')), false, 'old months are not refetched')
  assert.equal(store.loadAllGames().length, 4)
})
