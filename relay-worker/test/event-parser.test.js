const assert = require('assert');
const { parseMarker, shortHash } = require('../src/event-parser');

const relayId = 'test-relay';

function parse(marker) {
  const result = parseMarker(marker, relayId);
  assert(result, `Expected marker to parse: ${marker}`);
  return result;
}

{
  const event = parse('__SG_EVT__|BEGIN|match-1|sync-1|7|SG7|24');
  assert.equal(event.event, 'round_start');
  assert.equal(event.eventId, 'match-1:round_start');
  assert.equal(event.round, 7);
  assert.equal(event.map, 'SG7');
  assert.equal(event.expectedPlayers, 24);
}

{
  const name = 'H%C3%BCbscher%20Mann';
  const team = 'Team%20A';
  const color = '%2343E9DC';
  const event = parse(`__SG_EVT__|PLAYER|match-1|sync-1|7|db-1|${name}|${team}|${color}`);
  assert.equal(event.event, 'player_seen');
  assert.equal(event.playerName, 'Hübscher Mann');
  assert.equal(event.teamName, 'Team A');
  assert.equal(event.teamColor, '#43E9DC');
  const expectedHash = shortHash('Hübscher Mann|Team A|#43E9DC');
  assert.equal(event.eventId, `match-1:player:db-1:${expectedHash}`);
}

{
  const event = parse('__SG_EVT__|KILL|match-1|sync-1|7|match-1:kill:victim|killer|Killer|victim|Victim');
  assert.equal(event.event, 'kill');
  assert.equal(event.killerDbId, 'killer');
  assert.equal(event.victimDbId, 'victim');
}

{
  const event = parse('__SG_EVT__|DM|match-1|sync-1|7|match-1:dm:db-1|db-1|Player');
  assert.equal(event.event, 'deathmatch_start');
  assert.equal(event.playerDbId, 'db-1');
}

{
  const event = parse('__SG_EVT__|WIN|match-1|sync-1|7|match-1:win|db-1|Winner');
  assert.equal(event.event, 'win');
  assert.equal(event.winnerDbId, 'db-1');
}

{
  const event = parse('__SG_EVT__|END|match-1|sync-1|7|match-1:round_end');
  assert.equal(event.event, 'round_end');
  assert.equal(event.eventId, 'match-1:round_end');
}

{
  const event = parse('__SG_EVT__|SNAPSHOT_UNKNOWN|match-1|sync-1|7|x');
  assert.equal(event.unsupported, true);
  assert.equal(event.type, 'SNAPSHOT_UNKNOWN');
}

assert.equal(parseMarker('normal chat'), null);
console.log('event-parser tests passed');
