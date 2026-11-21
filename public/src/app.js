import { html, nothing } from 'lit'
import { View, api, ago } from './lib.js'
import './map.js'
import './settings.js'
import './games.js'
import './opening.js'

const TABS = [['map', 'Map'], ['games', 'Games'], ['openings', 'Openings'], ['settings', 'Settings']]
const SYNC_EVERY_MS = 5 * 60 * 1000

class CbApp extends View {
  static properties = {
    state: { state: true },
    route: { state: true },
    syncing: { state: true },
    notice: { state: true },
    fresh: { state: true },
    version: { state: true },
  }

  constructor() {
    super()
    this.route = this.readRoute()
    this.fresh = new Set()
    this.version = 0
  }

  readRoute() {
    const h = location.hash.slice(1)
    if (h.startsWith('opening-')) return { name: 'opening', id: h.slice(8) }
    return { name: TABS.some(([t]) => t === h) ? h : 'map' }
  }

  async connectedCallback() {
    super.connectedCallback()
    window.addEventListener('hashchange', () => (this.route = this.readRoute()))
    this.addEventListener('cb-state', (e) => this.setState(e.detail.state, e.detail.fresh))
    this.addEventListener('cb-reload', (e) => (e.detail?.sync ? this.sync() : this.load()))
    // Keep "synced 3 min ago" honest, and pick up new games while the tab stays open.
    setInterval(() => this.requestUpdate(), 30_000)
    setInterval(() => document.visibilityState === 'visible' && this.sync({ quiet: true }), SYNC_EVERY_MS)
    await this.load()
    this.sync({ quiet: true })
  }

  setState(state, fresh = []) {
    this.state = state
    if (fresh.length) this.fresh = new Set(fresh)
    this.version++
  }

  async load() {
    try {
      this.setState(await api('/api/state'))
    } catch (err) {
      this.notice = { err: true, text: `Could not load your progress. ${err.message}` }
    }
  }

  async sync({ quiet = false } = {}) {
    if (this.syncing) return
    this.syncing = true
    try {
      const before = new Set(this.state?.nodes.map((n) => n.id))
      const r = await api('/api/sync', { method: 'POST' })
      const state = await api('/api/state')
      this.setState(state, this.state ? state.nodes.filter((n) => !before.has(n.id)).map((n) => n.id) : [])
      if (r.added) {
        this.notice = { text: `${r.added} new game${r.added === 1 ? '' : 's'}, ${r.counted} counted toward a mission.` }
      } else if (!quiet) {
        this.notice = { text: 'No new games since the last sync.' }
      }
    } catch (err) {
      this.notice = { err: true, text: `Sync failed. ${err.message}` }
    } finally {
      this.syncing = false
    }
  }

  renderView() {
    if (!this.state) return html`<div class="page"><p class="muted">Loading…</p></div>`
    switch (this.route.name) {
      case 'settings':
        return html`<cb-settings></cb-settings>`
      case 'games':
        return html`<cb-games .version=${this.version}></cb-games>`
      case 'openings':
        return html`<cb-openings .version=${this.version}></cb-openings>`
      case 'opening':
        return html`<cb-opening .openingId=${this.route.id} .version=${this.version}></cb-opening>`
      default:
        return html`<cb-map .state=${this.state} .fresh=${this.fresh}></cb-map>`
    }
  }

  render() {
    const tab = this.route.name === 'opening' ? 'openings' : this.route.name
    return html`
      <header class="bar">
        <a class="brand" href="#map">Chess Buddy</a>
        <nav class="tabs">${TABS.map(([id, label]) => html`<a class="tab ${tab === id ? 'on' : ''}" href="#${id}">${label}</a>`)}</nav>
        <span class="sp"></span>
        ${this.state ? html`<span class="muted">${this.state.username} · synced ${ago(this.state.lastSync)}</span>` : nothing}
        <button ?disabled=${this.syncing} @click=${() => this.sync()}>${this.syncing ? 'Checking…' : 'Check for new games'}</button>
      </header>
      ${this.notice
        ? html`<div class="notice ${this.notice.err ? 'err' : ''}" role="status"><span>${this.notice.text}</span><span class="sp"></span>
            <button class="link" @click=${() => (this.notice = null)}>Dismiss</button></div>`
        : nothing}
      ${this.renderView()}`
  }
}
customElements.define('cb-app', CbApp)
