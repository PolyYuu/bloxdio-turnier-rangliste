function decodeValue(value) {
  try { return decodeURIComponent(String(value || '')); }
  catch { return String(value || ''); }
}

function shortHash(text) {
  let hash = 2166136261;
  text = String(text || '');
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function base(parts, relayId) {
  return {
    relayId,
    matchId: parts[2],
    syncKey: parts[3],
    round: Number(parts[4]),
    timestamp: Date.now(),
    source: 'bloxd-persistent-relay-v1'
  };
}

function parseMarker(marker, relayId = 'persistent-relay') {
  if (typeof marker !== 'string' || !marker.startsWith('__SG_EVT__|')) return null;
  const parts = marker.trim().split('|');
  const type = String(parts[1] || '').toUpperCase();

  if (type === 'BEGIN' && parts.length >= 7) {
    return {
      ...base(parts, relayId),
      event: 'round_start',
      eventId: `${parts[2]}:round_start`,
      map: decodeValue(parts[5]),
      expectedPlayers: Number(parts[6])
    };
  }

  if (type === 'PLAYER' && parts.length >= 9) {
    const playerName = decodeValue(parts[6]);
    const teamName = decodeValue(parts[7]);
    const teamColor = decodeValue(parts[8]);
    return {
      ...base(parts, relayId),
      event: 'player_seen',
      eventId: `${parts[2]}:player:${parts[5]}:${shortHash(`${playerName}|${teamName}|${teamColor}`)}`,
      playerDbId: parts[5],
      playerName,
      teamName,
      teamColor
    };
  }

  if (type === 'KILL' && parts.length >= 10) {
    return {
      ...base(parts, relayId),
      event: 'kill',
      eventId: parts[5],
      killerDbId: parts[6],
      killerName: decodeValue(parts[7]),
      victimDbId: parts[8],
      victimName: decodeValue(parts[9])
    };
  }

  if (type === 'DM' && parts.length >= 8) {
    return {
      ...base(parts, relayId),
      event: 'deathmatch_start',
      eventId: parts[5],
      playerDbId: parts[6],
      playerName: decodeValue(parts[7])
    };
  }

  if (type === 'WIN' && parts.length >= 8) {
    return {
      ...base(parts, relayId),
      event: 'win',
      eventId: parts[5],
      winnerDbId: parts[6],
      winnerName: decodeValue(parts[7])
    };
  }

  if (type === 'END' && parts.length >= 6) {
    return {
      ...base(parts, relayId),
      event: 'round_end',
      eventId: parts[5]
    };
  }

  // Snapshot fragments are intentionally not guessed here. They remain observable
  // as raw machine markers until their exact v1.3 wire format is recovered/tested.
  return { unsupported: true, type, raw: marker };
}

module.exports = { parseMarker, shortHash, decodeValue };
