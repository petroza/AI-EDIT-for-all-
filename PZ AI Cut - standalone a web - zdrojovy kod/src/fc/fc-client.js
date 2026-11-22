'use strict';
// Klient řídicího portu FilmCraftu (JSON-lines přes TCP, docs/control-protocol.md):
// jeden požadavek na řádek {id, token, method, params} -> jedna odpověď {id, ok, result|error}.
// Spojení se drží otevřené a po chybě/timeoutu se samo obnoví (server ho po chybě zavírá).
const net = require('net');

const TICKS = 254016000000; // ticků za sekundu (FilmCraft, stejně jako Premiere)

class FcClient {
  constructor({ port = 9876, host = '127.0.0.1', token } = {}) {
    this.port = port; this.host = host; this.token = token;
    this.sock = null; this.buf = ''; this.nextId = 1; this.pending = new Map(); this.connecting = null;
  }

  connect() {
    if (this.sock && !this.sock.destroyed) return Promise.resolve();
    if (this.connecting) return this.connecting;
    this.connecting = new Promise((resolve, reject) => {
      const s = net.connect(this.port, this.host);
      s.setNoDelay(true);
      s.once('connect', () => { this.sock = s; this.connecting = null; resolve(); });
      s.on('data', (d) => this.onData(d));
      const fail = (e) => {
        this.connecting = null;
        if (this.sock === s) this.sock = null;
        for (const [, p] of this.pending) p.reject(new Error('FilmCraft: spojení přerušeno' + (e ? ` (${e.message || e})` : '')));
        this.pending.clear();
        reject(e || new Error('closed'));
      };
      s.once('error', fail);
      s.once('close', () => fail());
    });
    return this.connecting;
  }

  onData(d) {
    this.buf += d;
    let k;
    while ((k = this.buf.indexOf('\n')) >= 0) {
      const line = this.buf.slice(0, k); this.buf = this.buf.slice(k + 1);
      if (!line.trim()) continue;
      let j;
      try { j = JSON.parse(line); } catch (e) { continue; }
      const p = this.pending.get(j.id);
      if (!p) continue;
      this.pending.delete(j.id);
      clearTimeout(p.timer);
      if (j.ok) p.resolve(j.result); else p.reject(new Error(`FilmCraft (${p.what}): ${j.error || 'chyba'}`));
    }
  }

  async request(method, params, timeoutMs = 120000) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await this.connect();
        return await new Promise((resolve, reject) => {
          const id = this.nextId++;
          const what = method === 'engine.execute' ? params.command : method;
          const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`FilmCraft (${what}): timeout`)); }, timeoutMs);
          this.pending.set(id, { resolve, reject, timer, what });
          this.sock.write(JSON.stringify({ id, token: this.token, method, params }) + '\n');
        });
      } catch (e) {
        // spojení spadlo před odesláním / server ho zavřel – jednou zkusit znovu
        if (attempt === 0 && /spojení|ECONN|closed|EPIPE/i.test(e.message)) { this.sock = null; continue; }
        throw e;
      }
    }
    return null;
  }

  /** Engine příkaz (id z `filmcraft-cli commands`). */
  exec(command, params = {}, timeoutMs) { return this.request('engine.execute', { command, params }, timeoutMs); }

  close() { if (this.sock) this.sock.destroy(); this.sock = null; }
}

const sec = (ticks) => Number(ticks) / TICKS;
const ticks = (s) => Math.round(Number(s) * TICKS);

module.exports = { FcClient, TICKS, sec, ticks };
