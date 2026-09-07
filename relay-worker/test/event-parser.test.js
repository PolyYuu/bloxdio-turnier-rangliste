const assert = require('assert');
const { parseMarker, shortHash } = require('../src/event-parser');
const { SnapshotAssembler } = require('../src/snapshot-assembler');

const relayId = 'test-relay';

function parse(marker) {
  const result = parseMarker(marker, relayId);
  assert(result, `Expected marker to parse: ${marker}`);
  return result;
}

(async () => {
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
    const event = parse('__SG_EVT__|CANCEL|match-1|sync-1|7|match-1:round_cancel');
    assert.equal(event.event, 'round_cancel');
    assert.equal(event.eventId, 'match-1:round_cancel');
  }

  {
    let snapshot = null;
    const assembler = new SnapshotAssembler({
      relayId,
      delayMs: 1,
      onSnapshot: async payload => { snapshot = payload; }
    });

    assert.equal(assembler.accept(parse('__SG_EVT__|SNAPBEGIN|match-2|sync-1|8|match-2:snapshot|SG7|2')), true);
    assert.equal(assembler.accept(parse('__SG_EVT__|SNAPPLAYER|match-2|db-1|Player%20One|Team%20A|%2343E9DC|3|1|0')), true);
    assert.equal(assembler.accept(parse('__SG_EVT__|SNAPPLAYER|match-2|db-2|Player%20Two|Team%20A|%2343E9DC|1|1|1')), true);
    assert.equal(assembler.accept(parse('__SG_EVT__|SNAPEND|match-2|match-2:snapshot')), true);
    await new Promise(resolve => setTimeout(resolve, 15));

    assert(snapshot, 'Expected snapshot to be emitted');
    assert.equal(snapshot.event, 'round_snapshot');
    assert.equal(snapshot.eventId, 'match-2:snapshot');
    assert.equal(snapshot.round, 8);
    assert.equal(snapshot.expectedPlayers, 2);
    assert.equal(snapshot.receivedPlayers, 2);
    assert.equal(snapshot.complete, true);
    assert.equal(snapshot.players[0].kills, 3);
    assert.equal(snapshot.players[0].dm, true);
    assert.equal(snapshot.players[1].win, true);
    assert.equal(assembler.pendingCount, 0);
  }

  {
    const event = parse('__SG_EVT__|SNAPSHOT_UNKNOWN|match-1|sync-1|7|x');
    assert.equal(event.unsupported, true);
    assert.equal(event.type, 'SNAPSHOT_UNKNOWN');
  }

  assert.equal(parseMarker('normal chat'), null);
  console.log('event-parser and snapshot tests passed');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
