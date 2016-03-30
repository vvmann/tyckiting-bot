"use strict";

var _ = require("lodash");
var position = require("../../position.js");
var chalk = require("chalk");

// Change botNames and teamName to your choice.
var teamname = "Los Collos Manos";

var botNames = [
  "HerrManni",
  "Peenislintu",
  "Derp"
];

module.exports = function Ai() {

  var radaredPositions = [];
  var lastTarget = {};

  function prepareAction(action, x, y) {
    return function() {
      action(x, y);
    };
  }

  function randInt(min, max) {
    var range = max - min;
    var rand = Math.floor(Math.random() * (range + 1));
    return min + rand;
  }

  function planForAttack(plannedActions, players, x, y) {
    var offSetCounter = 0;
    var hasRadaring = false;
    return _.reduce(plannedActions, function(finalActions, player, botId, collection) {
      if (player.mode === "EVADE") {
        finalActions[botId] = player;
      } else {
        var botsAlive = _.filter(players, function(player) {
          return player.alive;
        });
        if (!hasRadaring && botsAlive.length > 1) {
          finalActions[botId] = {
            mode: "RADAR",
            action: prepareAction(players[botId].radar, x, y)
          };
          hasRadaring = true;
        }
        else {
          if (offSetCounter == 0) {
            finalActions[botId] = {
              mode: "ATTACK",
              action: prepareAction(players[botId].cannon, x, y - 1)
            };
            offSetCounter += 1;
          } else {
            finalActions[botId] = {
              mode: "ATTACK",
              action: prepareAction(players[botId].cannon, x, y + 1)
            };
          }
        }
      }
      return finalActions;
    }, {});
  }

  function containsPos(array, position) {
    for (var i; i < array.length; i++) {
      if (array[i].x === newRadaringPosition.x && allPosCopy[i].y === newRadaringPosition.y) {
        return true;
      }
    }
    return false;
  }

  function moveOrRadar(player, allPos, maxMove) {
    var moveOrRadar = randInt(0, 10);
    if (moveOrRadar < 3) {
      var neighbouringPositions = position.neighbours(position.make(player.x, player.y), maxMove);
      var randomMovePosition = neighbouringPositions[randInt(0, neighbouringPositions.length - 1)];
      return {
        mode: "MOVE",
        action: prepareAction(player.move, randomMovePosition.x, randomMovePosition.y)
      }
    }

    var allPosCopy = _.clone(allPos);

    var radaredNeighbours = _.map(radaredPositions, function(position) {
      return position.neighbours(position, 3);
    });
    radaredNeighbours.push(radaredPositions);

    do {
      var newRadaringPosition = allPosCopy[randInt(0, allPos.length - 1)];

      for (var i; i < allPosCopy.length; i++) {
        if (allPosCopy[i].x === newRadaringPosition.x && allPosCopy[i].y === newRadaringPosition.y) {
          allPosCopy.splice(i, 1);
          break;
        }
      }
    }
    while (containsPos(allPosCopy, newRadaringPosition));

    if (radaredPositions.length > 8) radaredPositions = radaredPositions.splice(radaredPositions.length - 1);

    return {
      mode: "RADAR",
      action: prepareAction(player.radar, newRadaringPosition.x, newRadaringPosition.y)
    }
  }

  function isLegalPosition(x, y, radius) {
    return Math.abs(x) + Math.abs(y) <= radius;
  }

  function evade(config, players, event, plannedActions){
    var evadePositions = [
      {x: 0, y: -2}, {x: 1, y: -2}, {x: 2, y: -2}, {x: -1, y: -1}, {x: 2, y: -1}, {x: -2, y: 0}, {x: 2, y: 0},
      {x: -2, y: 1}, {x: 1, y: 1}, {x: -2, y: 2}, {x: -1, y: 2}, {x: 0, y: 2}
    ];
    var maxMove = config.move;
    var player = players[event.botId];

    do {
      var index = Math.floor(Math.random() * evadePositions.length);
      var x = player.x + evadePositions[index].x;
      var y = player.y + evadePositions[index].y;
      evadePositions = evadePositions.splice(index, 1);
    }
    while (isLegalPosition(x, y, config.radius));

    plannedActions[event.botId] = {
      mode: "EVADE",
      action: prepareAction(player.move, x, y)
    };
  }

  function makeDecisions(roundId, events, bots, config) {

    // Get all positions
    var allPositions = position.neighbours(position.origo, config.fieldRadius);
    allPositions.push(position.origo);

    // Map bot to id, for easier usage
    var players = _.reduce(bots, function(memo, bot) {
      memo[bot.botId] = bot;
      return memo;
    }, {});

    // Insert default action for every bot
    var plannedActions = _.reduce(players, function(memo, player) {
      if (player.alive) {
        memo[player.botId] = moveOrRadar(player, allPositions, config.move);
      }
      return memo;
    }, {});

    // Resolve events
    _.each(events, function(event) {
      if (event.event === "damaged" || event.event === "detected") {
        evade(config, players, event, plannedActions);
      } else if (event.event === "hit") {
        plannedActions = planForAttack(plannedActions, players, lastTarget.x, lastTarget.y);
      } else if (event.event === "see" || event.event === "radarEcho") {
        var pos = event.pos;
        plannedActions = planForAttack(plannedActions, players, pos.x, pos.y);
        lastTarget = _.clone(pos);
      } else if (event.event === "noaction") {
        console.log("Bot did not respond in required time", event.data);
      }
    });

    // Execute actions
    _.each(plannedActions, function(plan) {
      plan.action.apply();
    });
  }

  return {
    teamName: teamname,
    botNames: botNames,
    makeDecisions: makeDecisions
  };
};
