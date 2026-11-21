const TIME_CLASSES = ['bullet', 'blitz', 'rapid', 'daily']

export default async function settingsRoutes(app) {
  app.get('/api/settings', async () => {
    const p = app.ctx.store.loadProgress()
    return { settings: p.settings, timeClassOptions: TIME_CLASSES, lastSync: p.lastSync }
  })

  app.put('/api/settings', async (req, reply) => {
    const body = req.body || {}
    const username = String(body.username || '').trim()
    if (!/^[A-Za-z0-9_-]{2,30}$/.test(username)) {
      return reply.code(400).send({ error: 'Enter your chess.com username: letters, numbers, dashes or underscores.' })
    }
    const timeClasses = TIME_CLASSES.filter((t) => (body.timeClasses || []).includes(t))
    if (!timeClasses.length) return reply.code(400).send({ error: 'Tick at least one type of game to count.' })

    const p = app.ctx.store.loadProgress()
    p.settings = { username, timeClasses, ratedOnly: body.ratedOnly !== false }
    app.ctx.store.saveProgress(p)
    return { settings: p.settings }
  })
}
