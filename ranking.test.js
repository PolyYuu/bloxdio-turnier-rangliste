"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { rankMaps, movement } = require("./app.js");

function player(id, name, roundPoints) {
  const events = roundPoints.flatMap((points, round) => Array.from({ length: points }, (_, index) => ({
    id: `${id}-${round}-${index}`,
    round: round + 1,
    type: "kill"
  })));
  return { id, name, events };
}

function tournamentFromScores(scores, names = scores.map((_, index) => `Team ${String.fromCharCode(65 + index)}`)) {
  return {
    teams: scores.map((score, index) => ({
      id: `team-${index}`,
      name: names[index],
      players: [player(`player-${index}`, names[index], [score])]
    }))
  };
}

function ranksFor(scores) {
  const tournament = tournamentFromScores(scores);
  return [...rankMaps(tournament, 1, false).values()];
}

test("team competition ranking handles ties and skipped positions", () => {
  assert.deepEqual(ranksFor([50, 40, 40, 37]), [1, 2, 2, 4]);
  assert.deepEqual(ranksFor([50, 40, 40, 37, 37, 37, 20]), [1, 2, 2, 4, 4, 4, 7]);
  assert.deepEqual(ranksFor([10, 10, 10, 10]), [1, 1, 1, 1]);
  assert.deepEqual(ranksFor([50, 40, 30, 20]), [1, 2, 3, 4]);
});

test("individual ranking gives equal scores equal ranks", () => {
  const tournament = tournamentFromScores([50, 40, 40, 37], ["Delta", "Beta", "Alpha", "Gamma"]);
  const ranks = rankMaps(tournament, 1, true);
  assert.equal(ranks.get("player-2"), 2);
  assert.equal(ranks.get("player-1"), 2);
  assert.deepEqual([...ranks.values()], [1, 2, 2, 4]);
});

test("movement compares competition ranks from consecutive rounds", () => {
  const tournament = {
    teams: [
      { id: "a", name: "A", players: [player("pa", "A", [3, 0])] },
      { id: "b", name: "B", players: [player("pb", "B", [2, 2])] },
      { id: "c", name: "C", players: [player("pc", "C", [1, 3])] }
    ]
  };
  const previous = rankMaps(tournament, 1, false);
  const current = rankMaps(tournament, 2, false);

  assert.deepEqual(Object.fromEntries(previous), { a: 1, b: 2, c: 3 });
  assert.deepEqual(Object.fromEntries(current), { b: 1, c: 1, a: 3 });
  assert.match(movement(current.get("c"), previous.get("c"), 2), /up/);
  assert.match(movement(current.get("a"), previous.get("a"), 2), /down/);
  assert.match(movement(2, 2, 2), /same/);
});
