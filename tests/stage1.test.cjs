// Stage 1 regression tests. Built-in Node test runner, no npm installation.
// Run: node --test tests/stage1.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const root = path.join(__dirname, '..');
let nextTimerId = 1;
const timers = new Map();
const allCallbacks = [];
const warnings = [];
const jqueryStub = () => ({ ready() {}, hide() {}, text() {}, val() {}, toggleClass() {}, show() {} });
const fakeChessClass = class {
    constructor() { this.ply = 0; }
    move(token) {
        if (token === 'ILLEGAL') return null;
        return {
            color: this.ply++ % 2 === 0 ? 'w' : 'b',
            piece: 'p', from: 'e2', to: 'e4', san: String(token), flags: 'n'
        };
    }
};
const context = vm.createContext({
    console: { log() {}, warn: (...items) => warnings.push(items), error() {} },
    navigator: { maxTouchPoints: 0 },
    window: { matchMedia: () => ({ matches: false }) },
    document: {},
    Chess: fakeChessClass,
    $: jqueryStub,
    setTimeout(callback, delay) {
        assert.equal(delay, 80);
        const id = nextTimerId++;
        timers.set(id, callback);
        allCallbacks.push(callback);
        return id;
    },
    clearTimeout(id) { timers.delete(id); }
});
const code = fs.readFileSync(path.join(root, 'trainer.js'), 'utf8');
vm.runInContext(code, context, { filename: 'trainer.js' });
const ChessTrainer = vm.runInContext('ChessTrainer', context);

function makeTrainer() {
    const trainer = Object.create(ChessTrainer.prototype);
    trainer.opponentTimer = null;
    trainer.trainingGeneration = 0;
    trainer.mode = 'practice';
    trainer.isTrainingComplete = false;
    trainer.moveCache = new Map();
    trainer.openings = [];
    trainer.addChatMessage = () => {};
    trainer.recreateBoard = () => {};
    trainer.updateProgress = () => {};
    trainer.clearHighlights = () => {};
    trainer.updateButtonsVisibility = () => {};
    return trainer;
}
function resetClock() { timers.clear(); allCallbacks.length = 0; warnings.length = 0; }

test('timer is cancelled when the training generation changes', () => {
    resetClock();
    const trainer = makeTrainer();
    let executed = 0;
    trainer.executeOpponentMove = () => executed++;
    trainer.scheduleOpponentMove();
    assert.equal(timers.size, 1);
    trainer.cancelOpponentMove();
    assert.equal(timers.size, 0);
    assert.equal(trainer.opponentTimer, null);
    // Simulate an event-loop callback that was already queued prior to cancellation.
    allCallbacks[0]();
    assert.equal(executed, 0);
});

test('new schedule replaces existing schedule without duplicate opponent moves', () => {
    resetClock();
    const trainer = makeTrainer();
    let executed = 0;
    trainer.executeOpponentMove = () => executed++;
    trainer.scheduleOpponentMove();
    const stale = allCallbacks[0];
    trainer.scheduleOpponentMove();
    // Already queued old callback must not cancel/execute the new timer.
    stale();
    assert.equal(timers.size, 1);
    for (const callback of timers.values()) callback();
    assert.equal(executed, 1);
    assert.equal(trainer.opponentTimer, null);
});

test('switching to study cancels pending bot move and invalidates queued callback', () => {
    resetClock();
    const trainer = makeTrainer();
    trainer.currentMoves = [{ color: 'w', san: 'e4' }];
    let executed = 0;
    trainer.executeOpponentMove = () => executed++;
    trainer.scheduleOpponentMove();
    const staleCallback = allCallbacks[0];
    trainer.switchMode('study');
    assert.equal(trainer.mode, 'study');
    assert.equal(timers.size, 0);
    staleCallback();
    assert.equal(executed, 0);
});

test('selectVariation cancels pending opponent move and prevents a stale move', () => {
    resetClock();
    const trainer = makeTrainer();
    trainer.openings = [{
        id: 'opening-1', name: 'Test opening', player_side: 'w',
        lines: [{ id: 'line-1', pgn: '1. e4 e5', ordering_number: 0 }]
    }];
    trainer.currentOpening = trainer.openings[0];
    trainer.updateSelectionInfo = () => {};
    trainer.restartCurrentMode = () => {};
    let executed = 0;
    trainer.executeOpponentMove = () => executed++;
    trainer.scheduleOpponentMove();
    const staleCallback = allCallbacks[0];
    const previousGeneration = trainer.trainingGeneration;

    trainer.selectVariation(0, 0, false);
    assert.equal(timers.size, 0);
    assert.equal(trainer.opponentTimer, null);
    assert.ok(trainer.trainingGeneration > previousGeneration);
    assert.equal(trainer.currentVariation.id, 'line-1');
    assert.equal(trainer.currentMoves.length, 2);
    // A queued callback from the previous variation must not execute.
    staleCallback();
    assert.equal(executed, 0);
});

test('starting practice twice keeps only one opponent timer', () => {
    resetClock();
    const trainer = makeTrainer();
    trainer.currentMoves = [];
    trainer.startPracticeMode(false);
    const first = allCallbacks[0];
    trainer.startPracticeMode(false);
    assert.equal(timers.size, 1);
    let count = 0;
    trainer.executeOpponentMove = () => count++;
    first();
    for (const cb of timers.values()) cb();
    assert.equal(count, 1);
});

test('all original PGN lines are passed through validation (mock, not chess legality)', () => {
    resetClock();
    const data = JSON.parse(fs.readFileSync(path.join(root, 'DebutFlow_openings_database.json'), 'utf8'));
    const trainer = makeTrainer();
    trainer.openings = data.openings;
    const total = data.openings.reduce((n, opening) => n + opening.lines.length, 0);
    assert.equal(total, 227);
    const errors = trainer.validateAllLines();
    assert.equal(errors.length, 0);
    assert.equal(trainer.moveCache.size, total);
    // This test uses a fake chess engine and therefore does NOT certify legality.
});

test('a malformed line is reported and does not abort validation of other lines', () => {
    resetClock();
    const trainer = makeTrainer();
    trainer.openings = [{name:'fixture', player_side:'w', lines:[
        {id:'valid', pgn:'1. e4 e5', ordering_number:0},
        {id:'broken', pgn:'1. e4 ILLEGAL', ordering_number:1},
        {id:'valid2', pgn:'1. d4 d5', ordering_number:2}
    ]}];
    const errors = trainer.validateAllLines();
    assert.equal(errors.length, 1);
    assert.equal(errors[0].variationId, 'broken');
    assert.equal(trainer.moveCache.size, 2);
    assert.ok(warnings.length >= 1);
});

test('SRI hashes match the pinned URLs of all four remote assets', () => {
    // Known published digests. This checks committed markup, not live CDN bytes.
    const expected = new Map([
        ['https://code.jquery.com/jquery-3.7.1.min.js', 'sha256-/JqT3SQfawRcv/BIHPThkBvs0OEvtFFmqPF/lYI/Cxo='],
        ['https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.10.3/chess.min.js', 'sha512-xRllwz2gdZciIB+AkEbeq+gVhX8VB8XsfqeFbUh+SzHlN96dEduwtTuVuc2u9EROlmW9+yhRlxjif66ORpsgVA=='],
        ['https://cdnjs.cloudflare.com/ajax/libs/chessboard-js/1.0.0/chessboard-1.0.0.min.css', 'sha512-TU/clvRaSqKB43MX6dvJPEWV8tEGDTbmT4mdxTs6DSYsBY9zKmiw4Qeykp0nS10ndH14HRNG2VWN+IjiMfA17Q=='],
        ['https://cdnjs.cloudflare.com/ajax/libs/chessboard-js/1.0.0/chessboard-1.0.0.min.js', 'sha512-WfASs5HtTgTL/eZsLaOftSN9wMQl7WZGlU5UiKx/yxTViMfGh9whWRwKAC27qH8VtZJqSMqDdbq2uUb1tY3jvQ==']
    ]);
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const tags = [...html.matchAll(/<(?:script|link)\b[^>]*>/g)].map(m => m[0]);
    const found = new Map();
    for (const tag of tags) {
        const url = tag.match(/(?:src|href)="([^"]+)"/)?.[1];
        if (!url || !expected.has(url)) continue;
        const digest = tag.match(/\bintegrity="([^"]+)"/)?.[1];
        assert.equal(digest, expected.get(url), `Incorrect SRI for ${url}`);
        assert.match(tag, /\bcrossorigin="anonymous"/);
        assert.equal(found.has(url), false, `Duplicate asset: ${url}`);
        found.set(url, digest);
    }
    assert.deepEqual([...found.keys()].sort(), [...expected.keys()].sort());
    // Browser/CDN digest verification remains a separate prerequisite.
});

test('mobile tap is processed only after stationary pointerup; scrolling is not intercepted', () => {
    const trainer = makeTrainer();
    trainer.useTapControls = true;
    trainer.tapInputBound = false;
    const handlers = new Map();
    const board = { addEventListener(name, handler) { handlers.set(name, handler); } };
    const selected = [];
    trainer.handleTapSquare = square => selected.push(square);
    trainer.getSquareNameFromElement = element => element.square;
    context.window.PointerEvent = function PointerEvent() {};
    context.document.getElementById = () => board;
    context.document.elementFromPoint = () => ({square:'e4'});
    trainer.bindTapInput();
    function evt(x, y) { return { pointerId:3, pointerType:'touch', clientX:x, clientY:y, cancelable:true, preventDefault() {}, stopPropagation() {}, target:{square:'e4'} }; }
    handlers.get('pointerdown')(evt(50, 50));
    handlers.get('pointerup')(evt(52, 51));
    assert.deepEqual(selected, ['e4']);
    handlers.get('pointerdown')(evt(50, 50));
    handlers.get('pointerup')(evt(50, 90));
    assert.deepEqual(selected, ['e4']);
    handlers.get('pointerdown')(evt(50, 50));
    handlers.get('pointercancel')();
    handlers.get('pointerup')(evt(50, 51));
    assert.deepEqual(selected, ['e4']);
    delete context.window.PointerEvent;
});
