class SnapshotAssembler {
  constructor({ relayId = 'bloxd-persistent-relay', delayMs = 2500, onSnapshot } = {}) {
    this.relayId = relayId;
    this.delayMs = delayMs;
    this.onSnapshot = typeof onSnapshot === 'function' ? onSnapshot : async () => {};
    this.buffers = new Map();
    this.timers = new Map();
  }

  clear(matchId) {
    const timer = this.timers.get(matchId);
    if (timer) clearTimeout(timer);
    this.timers.delete(matchId);
    this.buffers.delete(matchId);
  }

  accept(fragment) {
    if (!fragment || !fragment.fragment || !fragment.matchId) return false;
    const matchId = fragment.matchId;

    if (fragment.fragmentType === 'snapshot_begin') {
      this.clear(matchId);
      this.buffers.set(matchId, {
        matchId,
        syncKey: fragment.syncKey,
        round: fragment.round,
        eventId: fragment.eventId,
        map: fragment.map,
        expectedPlayers: fragment.expectedPlayers,
        players: new Map(),
        startedAt: Date.now()
      });
      return true;
    }

    if (fragment.fragmentType === 'snapshot_player') {
      const buffer = this.buffers.get(matchId);
      if (!buffer || !fragment.player || !fragment.player.playerDbId) return false;
      buffer.players.set(fragment.player.playerDbId, fragment.player);
      return true;
    }

    if (fragment.fragmentType === 'snapshot_end') {
      const buffer = this.buffers.get(matchId);
      if (!buffer || fragment.eventId !== buffer.eventId) return false;
      const players = Array.from(buffer.players.values());
      const complete = players.length === buffer.expectedPlayers;
      const payload = {
        event: 'round_snapshot',
        eventId: buffer.eventId,
        relayId: this.relayId,
        matchId: buffer.matchId,
        syncKey: buffer.syncKey,
        round: buffer.round,
        map: buffer.map,
        expectedPlayers: buffer.expectedPlayers,
        receivedPlayers: players.length,
        complete,
        players,
        timestamp: Date.now(),
        source: 'bloxd-persistent-relay-v1.1-snapshot'
      };

      const timer = setTimeout(async () => {
        this.timers.delete(matchId);
        try { await this.onSnapshot(payload); }
        finally { this.buffers.delete(matchId); }
      }, this.delayMs);
      this.timers.set(matchId, timer);
      return true;
    }

    return false;
  }

  get pendingCount() {
    return this.buffers.size;
  }
}

module.exports = { SnapshotAssembler };
