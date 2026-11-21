import { loadState } from '../services/engine.js'
import { switchMission } from '../services/missions.js'
import { gamesView, openingView, openingsView, resolveFogId, stateView } from '../services/views.js'

export default async function missionRoutes(app) {
  app.get('/api/state', async () => {
    const { tree, progress, games } = loadState(app.ctx)
    return stateView(tree, progress, games)
  })

  app.get('/api/games', async () => {
    const { tree, progress, games } = loadState(app.ctx)
    return gamesView(tree, progress, games)
  })

  app.get('/api/openings', async () => {
    const { tree, progress } = loadState(app.ctx)
    return openingsView(tree, progress)
  })

  app.get('/api/openings/:id', async (req, reply) => {
    const { tree, progress, games } = loadState(app.ctx)
    const view = openingView(tree, progress, games, req.params.id)
    return view ?? reply.code(404).send({ error: 'You have not uncovered that opening yet.' })
  })

  // Body: { fid } to uncover a fog tile, or { id } to resume a parked mission.
  app.post('/api/missions/switch', async (req, reply) => {
    const { tree, progress, games } = loadState(app.ctx)
    const { fid, id } = req.body || {}
    const target = fid ? resolveFogId(tree, progress, fid)?.id : id
    if (!target) return reply.code(400).send({ error: 'That opening is no longer available. Reload the map.' })
    try {
      switchMission(tree, progress, target, Math.floor(Date.now() / 1000))
    } catch (err) {
      return reply.code(409).send({ error: err.message })
    }
    app.ctx.store.saveProgress(progress)
    return stateView(tree, progress, games)
  })

  app.post('/api/events/seen', async (req) => {
    const { tree, progress, games } = loadState(app.ctx)
    const ids = new Set(req.body?.ids || [])
    for (const e of progress.events) if (ids.has(e.id)) e.seen = true
    app.ctx.store.saveProgress(progress)
    return stateView(tree, progress, games)
  })
}
