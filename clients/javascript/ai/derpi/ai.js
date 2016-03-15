"use strict";

var _ = require("lodash");
var position = require("../../position.js");
var chalk = require("chalk");

// Change botNames and teamName to your choice.
var botNames = [
  "HerrManni",
  "Peenislintu",
  "Derp"
];

module.exports = function Ai() {

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
    return _.reduce(plannedActions, function(result, value, key) {
      if (value.mode === "EVADE") {
        result[key] = value;
      } else {
        _.filter()
        result[key] = {
          mode: "ATTACK",
          action: prepareAction(players[key].cannon, x, y)
        };
      }
      return result;
    }, {});
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

    var newRadaringPosition = allPos[randInt(0, allPos.length - 1)];
    return {
      mode: "RADAR",
      action: prepareAction(player.radar, newRadaringPosition.x, newRadaringPosition.y)
    }
  }

  var lastTarget = {};

  function evade(config, players, event, plannedActions){
      var maxMove = config.move;
      var player = players[event.botId];
      // TODO: fix hexgrid
      var x = player.x + maxMove - maxMove * (Math.floor(Math.random() * maxMove));
      var y = player.y + maxMove - maxMove * (Math.floor(Math.random() * maxMove));
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
      if (event.event === "damaged") {
        evade(config, players, event, plannedActions);
      } else if (event.event === "hit") {
        plannedActions = planForAttack(plannedActions, players, lastTarget.x, lastTarget.y);
      } else if (event.event === "see" || event.event === "radarEcho") {
        var pos = event.pos;
        plannedActions = planForAttack(plannedActions, players, pos.x, pos.y);
        lastTarget = _.clone(pos);
      } else if (event.event === "detected") {
        evade(config, players, event, plannedActions);
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
    // The AI must return these three attributes
    botNames: botNames,
    makeDecisions: makeDecisions
  };
};