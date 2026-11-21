import { runSync } from '../services/engine.js'

let running = null

export default async function syncRoutes(app) {
  // One sync at a time; a second click joins the one already running.
  app.post('/api/sync', async (req, reply) => {
    try {
      running ??= runSync(app.ctx).finally(() => { running = null })
      return await running
    } catch (err) {
      req.log.error(err)
      return reply.code(502).send({ error: err.message })
    }
  })
}
