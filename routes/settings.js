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

    let p = app.ctx.store.loadProgress()
    if (username.toLowerCase() !== p.settings.username.toLowerCase()) {
      // Stored games and missions belong to the old account.
      if (body.reset !== true) {
        return reply.code(409).send({ error: 'Changing the username starts over.', needsReset: true })
      }
      app.ctx.store.reset()
      p = app.ctx.store.loadProgress()
    }
    p.settings = { username, timeClasses, ratedOnly: body.ratedOnly !== false }
    app.ctx.store.saveProgress(p)
    return { settings: p.settings }
  })
}
