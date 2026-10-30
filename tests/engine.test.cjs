'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { SnakeEngine } = require('../engine.js');
const make = options => new SnakeEngine({ random: () => 0, ...options });

test('movement preserves length; food grows the snake and scores', () => {
  const g = make();
  assert.equal(g.step().type, 'move');
  assert.deepEqual(g.snake[0], { x: 8, y: 10 });
  assert.equal(g.snake.length, 3);
  g.food = { x: 9, y: 10 };
  assert.equal(g.step().type, 'eat');
  assert.equal(g.snake.length, 4);
  assert.equal(g.score, 10);
  assert.ok(!g.snake.some(p => g.same(p, g.food)));
});

test('buffers two turns in order without allowing reversal or repeat flooding', () => {
  const g = make();
  assert.equal(g.turn('left'), false);
  assert.equal(g.turn('up'), true);
  assert.equal(g.turn('down'), false);
  assert.equal(g.turn('up'), false);
  assert.equal(g.turn('left'), true);
  assert.equal(g.turn('down'), false);
  g.step(); assert.deepEqual(g.snake[0], { x: 7, y: 9 });
  g.step(); assert.deepEqual(g.snake[0], { x: 6, y: 9 });
});

test('classic walls end the game; later steps leave the state unchanged', () => {
  const g = make();
  for (let i = 0; i < 12; i++) assert.equal(g.step().type, 'move');
  assert.deepEqual(g.step(), { type: 'over', reason: 'wall' });
  const before = JSON.stringify(g);
  assert.equal(g.step().type, 'idle');
  assert.equal(JSON.stringify(g), before);
});

test('wrap mode crosses every edge', () => {
  for (const [direction, start, end] of [
    ['right', {x:19,y:5}, {x:0,y:5}], ['left', {x:0,y:5}, {x:19,y:5}],
    ['up', {x:5,y:0}, {x:5,y:19}], ['down', {x:5,y:19}, {x:5,y:0}]
  ]) {
    const g = make({ mode: 'wrap' });
    g.snake = [start]; g.direction = direction;
    assert.equal(g.step().type, 'move'); assert.deepEqual(g.snake[0], end);
  }
});

test('tail collisions end a run, but moving into the vacating tail is legal', () => {
  const g = make();
  g.snake = [{x:5,y:5},{x:5,y:6},{x:6,y:6},{x:6,y:5},{x:7,y:5}];
  assert.deepEqual(g.step(), { type: 'over', reason: 'tail' });
  const legal = make();
  legal.snake = [{x:5,y:5},{x:5,y:6},{x:6,y:6},{x:6,y:5}];
  assert.equal(legal.step().type, 'move');
});

test('maze obstacles collide and food never spawns in the snake or obstacles', () => {
  const g = make({ mode: 'maze' });
  assert.equal(g.obstacles.length, 24);
  g.snake = [{x:3,y:4},{x:2,y:4},{x:1,y:4}];
  assert.deepEqual(g.step(), { type: 'over', reason: 'obstacle' });
  for (let i = 0; i < 100; i++) {
    g.random = () => i / 100;
    const food = g.emptyCell();
    assert.ok(!g.walls.has(g.key(food)));
    assert.ok(!g.snake.some(p => g.same(food, p)));
  }
});

test('fifth bite raises level, increases speed and creates a separate golden bite', () => {
  const g = make();
  for (let i = 0; i < 5; i++) {
    g.food = { x: g.snake[0].x + 1, y: 10 }; g.step();
  }
  assert.equal(g.level, 2); assert.equal(g.interval, 131);
  assert.equal(g.score, 50); assert.ok(g.bonus);
  assert.ok(!g.same(g.food, g.bonus));
  assert.ok(!g.snake.some(p => g.same(p, g.bonus)));
});

test('golden bite grows the snake and scores 3x without replacing normal food', () => {
  const g = make({ difficulty: 'turbo' });
  const food = g.food;
  g.bonus = { x: 8, y: 10, expires: 6500 };
  assert.equal(g.step().type, 'bonus');
  assert.equal(g.score, 60); assert.equal(g.bonusBites, 1);
  assert.equal(g.snake.length, 4); assert.equal(g.bonus, null);
  assert.deepEqual(g.food, food);
});

test('golden bite expires on simulation time and does not award expired points', () => {
  const g = make();
  g.bonus = { x: 8, y: 10, expires: 140 };
  assert.equal(g.step().type, 'move'); assert.equal(g.bonus, null);
  assert.equal(g.score, 0);
});

test('filling the final cell wins without trying to spawn more food', () => {
  const g = make();
  g.snake = [{x:18,y:19}];
  for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) {
    if (y === 19 && x >= 18) continue;
    g.snake.push({x,y});
  }
  g.food = { x:19, y:19 };
  assert.equal(g.step().type, 'win');
  assert.equal(g.snake.length, 400); assert.equal(g.won, true);
  assert.equal(g.food, null); assert.equal(g.over, true);
});

test('a bonus cannot occupy the only cell needed for normal food', () => {
  const g = make();
  g.snake = [{x:17,y:19}];
  for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) {
    if (y === 19 && x >= 17) continue;
    g.snake.push({x,y});
  }
  g.food = {x:18,y:19}; g.bonus = {x:19,y:19,expires:6500};
  assert.equal(g.step().type, 'eat');
  assert.deepEqual(g.food, {x:19,y:19}); assert.equal(g.bonus, null);
  assert.equal(g.step().type, 'win');
});

test('difficulty speeds stay bounded and invalid options fall back safely', () => {
  for (const [difficulty, minimum, points] of [['chill',100,10],['normal',65,10],['turbo',48,20]]) {
    const g = make({ difficulty }); g.bites = 10000;
    assert.equal(g.interval, minimum); assert.equal(g.points, points);
  }
  const g = make({mode:'bad',difficulty:'bad'});
  assert.equal(g.mode, 'classic'); assert.equal(g.difficulty, 'normal');
  assert.equal(g.turn('constructor'), false);
});
