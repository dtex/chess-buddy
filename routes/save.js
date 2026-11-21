import { loadState } from '../services/engine.js'
import { saveToGit } from '../services/save.js'

export default async function saveRoutes(app) {
  app.post('/api/save', async (req, reply) => {
    const { progress } = loadState(app.ctx)
    const missions = Object.values(progress.missions)
    const done = missions.filter((m) => m.status === 'done').length
    const summary = `${missions.length} openings uncovered, ${done} complete`
    try {
      return await saveToGit({ repoDir: app.ctx.repoDir, dataDir: app.ctx.store.dir, summary })
    } catch (err) {
      req.log.error(err)
      return reply.code(500).send({ error: String(err.stderr || err.message).trim().split('\n').pop() })
    }
  })
}
