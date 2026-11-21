import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Fastify from 'fastify'
import fastifyStatic from '@fastify/static'
import { createStore } from './services/store.js'
import syncRoutes from './routes/sync.js'
import settingsRoutes from './routes/settings.js'
import missionRoutes from './routes/missions.js'
import saveRoutes from './routes/save.js'

const ROOT = path.dirname(fileURLToPath(import.meta.url))

export function buildApp({ store = createStore(), fetchImpl = fetch, logger = true, repoDir = ROOT } = {}) {
  const app = Fastify({ logger })
  app.decorate('ctx', { store, fetchImpl, repoDir })

  app.register(fastifyStatic, { root: path.join(ROOT, 'public') })
  app.register(syncRoutes)
  app.register(settingsRoutes)
  app.register(missionRoutes)
  app.register(saveRoutes)
  return app
}
