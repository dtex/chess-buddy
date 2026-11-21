import { html, nothing } from 'lit'
import { View, api, board, day, dot, resultWord, sideName } from './lib.js'

const STATUS = { active: 'Active mission', parked: 'Parked mission', done: 'Complete' }

/** A small opening card, used in the list and for "what comes next". */
export function openingCard(n) {
  return html`<a class="node ${n.status}" href="#opening-${n.id}">
    ${board(n.fen, n.side === 'b')}
    <b>${n.name}</b><span class="mv">${n.lastMove}</span>
    <span class="st">${dot(n.side)}${n.status === 'done' ? '✓ ' : ''}${n.count}/${n.target}${n.status === 'parked' ? ' parked' : ''}</span>
  </a>`
}

class CbOpenings extends View {
  static properties = { version: {}, data: { state: true } }

  willUpdate(changed) {
    if (changed.has('version')) api('/api/openings').then((d) => (this.data = d))
  }

  render() {
    if (!this.data) return html`<div class="page"><p class="muted">Loading…</p></div>`
    const { openings } = this.data
    return html`<div class="page">
      <div><h2>Openings</h2><p class="muted">Everything you have uncovered so far. Open one for its ideas and your record.</p></div>
      <div class="cards">${openings.map(openingCard)}</div>
    </div>`
  }
}
customElements.define('cb-openings', CbOpenings)

class CbOpening extends View {
  static properties = { openingId: {}, version: {}, data: { state: true }, error: { state: true } }

  willUpdate(changed) {
    if (changed.has('openingId') || changed.has('version')) this.load()
  }

  async load() {
    this.error = ''
    try {
      this.data = await api(`/api/openings/${encodeURIComponent(this.openingId)}`)
    } catch (err) {
      this.data = null
      this.error = err.message
    }
  }

  render() {
    if (this.error) return html`<div class="page"><div><p>${this.error}</p><p><a href="#map">Back to the map</a></p></div></div>`
    const o = this.data
    if (!o) return html`<div class="page"><p class="muted">Loading…</p></div>`
    const s = o.stats
    const max = Math.max(1, ...s.elsewhere.map((e) => e.count))
    const pct = s.of ? Math.round((s.reached / s.of) * 100) : 0
    return html`<div class="page">
      <div><a href="#map">← Map</a></div>
      <div class="detail">
        ${board(o.fen, o.side === 'b')}
        <div>
          <span class="chip ${o.status === 'done' ? 'ok' : 'gold'}">${dot(o.side)}${STATUS[o.status]} · ${o.count} of ${o.target}</span>
          <h2>${o.name}</h2>
          <div class="mv">${o.moves}${o.eco ? ` · ECO ${o.eco}` : ''}</div>
          <p style="margin-top:12px">${o.blurb}</p>
          <p><b>Your moves:</b> <span class="mv">${o.yourMoves.join(', ')}</span>
            ${o.theirMoves.length ? html`<br><b>Opponent has to play:</b> <span class="mv">${o.theirMoves.join(', ')}</span>` : nothing}</p>
          <ul>${o.ideas.map((i) => html`<li>${i}</li>`)}</ul>
          <div class="row">
            <a class="btn" href=${o.links.chesscom} target="_blank" rel="noopener">Open position on chess.com</a>
            <a class="btn" href=${o.links.lichess} target="_blank" rel="noopener">Lichess explorer</a>
          </div>
        </div>
        <div>
          <div class="eyebrow">Your record here, as ${sideName(o.side)}</div>
          <div class="kv">
            <span>Games that reached it</span><b>${s.reached} of ${s.of}</b>
            <span>Reach rate</span><b>${pct}%</b>
            <span>Won / drawn / lost</span><b>${s.record.win} / ${s.record.draw} / ${s.record.loss}</b>
          </div>
          ${s.elsewhere.length
            ? html`<div class="eyebrow">Where the other ${s.missed} went</div>
                <div style="margin-top:8px">${s.elsewhere.map((e) => html`<div class="barrow ${e.mine ? 'mine' : ''}">
                  <span class="mv">${e.move}${e.mine ? ' (you)' : ''}</span>
                  <span class="meter"><s style="width:${(e.count / max) * 100}%"></s></span><span>${e.count}</span></div>`)}</div>
                <p class="muted" style="margin-top:8px">Counts every eligible game you have played as ${sideName(o.side)}, including before the mission.</p>`
            : nothing}
        </div>
      </div>

      ${o.children.length || o.hiddenChildren
        ? html`<div style="margin-top:24px"><div class="eyebrow">From here</div>
            <div class="cards">${o.children.map(openingCard)}</div>
            ${o.hiddenChildren ? html`<p class="muted" style="margin-top:10px">${o.hiddenChildren} hidden opening${o.hiddenChildren === 1 ? '' : 's'} beyond this one.</p>` : nothing}</div>`
        : nothing}

      ${o.missionGames.length
        ? html`<div style="margin-top:24px"><div class="eyebrow">Games that counted</div>
            <div class="tblwrap"><table>
              <tr><th>Date</th><th>Opponent</th><th>Type</th><th>Result</th></tr>
              ${o.missionGames.map((g) => html`<tr>
                <td class="nw"><a href=${g.url} target="_blank" rel="noopener">${day(g.end)}</a></td>
                <td>${g.opponent} <span class="muted">(${g.opponentRating})</span></td>
                <td><span style="text-transform:capitalize">${g.timeClass}</span> <span class="muted">${g.timeControl}</span></td>
                <td>${resultWord[g.result]}</td></tr>`)}
            </table></div></div>`
        : nothing}
    </div>`
  }
}
customElements.define('cb-opening', CbOpening)
