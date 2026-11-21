import { buildApp } from './app.js'

const port = Number(process.env.PORT || 3210)
// Local tool: listen on this machine only.
const host = process.env.HOST || '127.0.0.1'

const app = buildApp()
try {
  await app.listen({ port, host })
  console.log(`\nChess Buddy is running at http://localhost:${port}\n`)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
