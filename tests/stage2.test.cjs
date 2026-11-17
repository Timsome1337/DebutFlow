// Stage 2: focused Node tests. Uses a fake chess engine for UI state transitions;
// real PGN legality and device behavior remain separate browser checks.
// Run: node --test tests/stage1.test.cjs tests/stage2.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');

class MemoryStorage {
    constructor() { this.items = new Map(); }
    getItem(key) { return this.items.get(key) ?? null; }
    setItem(key, value) { this.items.set(key, value); }
}
function fixture() {
    return { openings: [
        { id: 'opening-white', name: 'White opening', player_side: 'w', ordering_number: 0,
          lines: [ { id: 'line-a', ordering_number: 0, pgn: '1. e4 e5 2. Nf3 Nc6' },
                   { id: 'line-b', ordering_number: 1, pgn: '1. d4 d5' } ] },
        { id: 'opening-black', name: 'Black opening', player_side: 'b', ordering_number: 1,
          lines: [ { id: 'line-c', ordering_number: 0, pgn: '1. e4 e5' } ] }
    ]};
}
function setup(storage = new MemoryStorage()) {
    let nextTimer = 1;
    const timers = new Map();
    const values = new Map();
    const warnings = [];
    const dom = (key) => {
        const api = {
            text(value) { if (value !== undefined) values.set(key, value); return value === undefined ? values.get(key) : this; },
            val(value) { if (value !== undefined) values.set(`${key}:val`, value); return value === undefined ? values.get(`${key}:val`) : this; },
            ready() { return this; }, on() { return this; }, hide() { return this; }, show() { return this; },
            toggle() { return this; }, toggleClass() { return this; }, empty() { return this; },
            appendTo() { return this; }, addClass() { return this; }, removeClass() { return this; },
            append() { return this; }, scrollTop() { return this; }, children() { return { length:0 }; }
        };
        return api;
    };
    class FakeChess {
        constructor() { this.history = []; }
        move(token) {
            if (token === 'ILLEGAL') return null;
            const san = typeof token === 'string' ? token : token.to === 'e4' ? 'e4' : token.to === 'a3' ? 'a3' : token.to;
            const result = {
                color: this.history.length % 2 ? 'b' : 'w',
                san, from: typeof token === 'string' ? 'e2' : token.from,
                to: typeof token === 'string' ? 'e4' : token.to,
                piece:'p', flags:'n'
            };
            this.history.push(result);
            return result;
        }
        undo() { return this.history.pop() || null; }
        fen() { return `fen-ply-${this.history.length}`; }
    }
    const context = vm.createContext({
        window: { localStorage:storage, matchMedia: () => ({ matches:false }) },
        navigator: { maxTouchPoints:0 },
        document: { title:'' },
        console: { warn: (...args) => warnings.push(args), log(){}, error(){} },
        Chess:FakeChess, $: (key) => dom(key), alert() {},
        setTimeout(callback, milliseconds) { assert.equal(milliseconds, 80); const id=nextTimer++; timers.set(id,callback); return id; },
        clearTimeout(id) { timers.delete(id); }
    });
    for (const file of ['progress.js','trainer.js']) {
        vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'), context, {filename:file});
    }
    const ProgressManager = vm.runInContext('ProgressManager', context);
    const ChessTrainer = vm.runInContext('ChessTrainer', context);
    // Only DOM rendering is mocked; domain decisions remain unmodified.
    ChessTrainer.prototype.recreateBoard = function(){};
    ChessTrainer.prototype.forceUpdateBoard = function(){};
    ChessTrainer.prototype.clearHighlights = function(){};
    ChessTrainer.prototype.highlightSquare = function(){};
    ChessTrainer.prototype.addChatMessage = function(){};
    ChessTrainer.prototype.clearTapSelection = function(){};
    ChessTrainer.prototype.updateSelectionInfo = function(){};
    ChessTrainer.prototype.showWelcomeMessage = function(){};
    return { storage, timers, values, warnings, ProgressManager, ChessTrainer, FakeChess, database:fixture() };
}

test('saved session and unique completion statistics survive a simulated reload', () => {
    const {ProgressManager, storage} = setup();
    const pm = new ProgressManager();
    pm.setSession({openingId:'opening-white',lineId:'line-a',mode:'practice',moveIndex:3});
    assert.equal(pm.markPracticeLineCompleted('opening-white','line-a'), true);
    assert.equal(pm.markPracticeLineCompleted('opening-white','line-a'), false);
    pm.recordWrongMove();
    const restored = new ProgressManager(storage);
    assert.equal(restored.getSession().moveIndex, 3);
    assert.equal(restored.getStatistics().completedLines, 1);
    assert.equal(restored.getStatistics().errors, 1);
});

test('storage failures and malformed data do not block training', () => {
    const storage = { getItem() {throw new Error('disabled');}, setItem(){throw new Error('disabled');} };
    const {ProgressManager} = setup(storage);
    const pm = new ProgressManager(storage);
    assert.equal(pm.getSession(), null);
    assert.equal(pm.save(), false);
    const corrupt = new MemoryStorage(); corrupt.setItem('debutflow.progress.v1','not-json');
    const parsed = new ProgressManager(corrupt);
    assert.equal(parsed.getSession(), null);
    assert.equal(parsed.getStatistics().completedLines, 0);
    assert.equal(parsed.getStatistics().errors, 0);
});

test('progress records unique stable IDs, not order-dependent array indexes', () => {
    const {ChessTrainer, database, storage} = setup();
    const trainer = new ChessTrainer(database);
    trainer.selectVariation(0, 1, false);
    trainer.switchMode('study');
    trainer.nextMove();
    const session=JSON.parse(storage.getItem('debutflow.progress.v1')).session;
    assert.equal(session.openingId,'opening-white');
    assert.equal(session.lineId,'line-b');
    assert.equal(session.moveIndex,1);
    assert.equal(session.mode,'study');
    trainer.prevMove();
    assert.equal(JSON.parse(storage.getItem('debutflow.progress.v1')).session.moveIndex,0);
});

test('reloading study restores same opening, line, mode and ply without crediting a completion', () => {
    const {ChessTrainer, ProgressManager, database, storage} = setup();
    const pm = new ProgressManager();
    pm.setSession({openingId:'opening-black',lineId:'line-c',mode:'study',moveIndex:2});
    const trainer = new ChessTrainer(database);
    assert.equal(trainer.currentOpening.id,'opening-black');
    assert.equal(trainer.currentVariation.id,'line-c');
    assert.equal(trainer.mode,'study');
    assert.equal(trainer.currentMoveIndex,2);
    assert.equal(trainer.game.history.length,2);
    assert.equal(trainer.isCompletionAnnounced,true);
    assert.equal(new ProgressManager(storage).getStatistics().completedLines,0);
});

test('reloading practice with pending opponent reply resumes one bot move only', () => {
    const {ChessTrainer, ProgressManager, database, timers} = setup();
    new ProgressManager().setSession({openingId:'opening-white',lineId:'line-a',mode:'practice',moveIndex:1});
    const trainer = new ChessTrainer(database);
    assert.equal(trainer.mode,'practice');
    assert.equal(trainer.currentMoveIndex,1);
    assert.equal(trainer.game.history.length,1);
    assert.equal(timers.size,1);
    const timer=timers.entries().next().value;
    timers.delete(timer[0]); timer[1]();
    assert.equal(trainer.currentMoveIndex,2);
    assert.equal(timers.size,0);
});

test('reloading completed practice does not double-count completion or schedule another reply', () => {
    const {ChessTrainer, ProgressManager, database, timers} = setup();
    const pm=new ProgressManager();
    pm.markPracticeLineCompleted('opening-white','line-a');
    pm.setSession({openingId:'opening-white',lineId:'line-a',mode:'practice',moveIndex:4});
    const trainer=new ChessTrainer(database);
    assert.equal(trainer.isTrainingComplete,true);
    assert.equal(trainer.currentMoveIndex,4);
    assert.equal(timers.size,0);
    assert.equal(trainer.progressManager.getStatistics().completedLines,1);
});

test('practice completion counts a unique line once even after restart', () => {
    const {ChessTrainer,database,storage} = setup();
    const trainer = new ChessTrainer(database);
    trainer.selectVariation(0,0,false);
    trainer.switchMode('practice');
    trainer.completeTraining();
    trainer.completeTraining();
    assert.equal(trainer.progressManager.getStatistics().completedLines,1);
    trainer.resetTraining();
    trainer.completeTraining();
    assert.equal(trainer.progressManager.getStatistics().completedLines,1);
    trainer.selectVariation(0,1,false);
    trainer.completeTraining();
    assert.equal(trainer.progressManager.getStatistics().completedLines,2);
    assert.equal(JSON.parse(storage.getItem('debutflow.progress.v1')).statistics.completedLineIds.length,2);
});

test('legal but incorrect practice move is rolled back and counted as an error', () => {
    const {ChessTrainer,database,storage} = setup();
    const trainer=new ChessTrainer(database);
    trainer.selectVariation(0,0,false);
    trainer.switchMode('practice');
    trainer.handleUserMove('a2','a3');
    assert.equal(trainer.currentMoveIndex,0);
    assert.equal(trainer.game.history.length,0);
    assert.equal(trainer.progressManager.getStatistics().errors,1);
    assert.equal(JSON.parse(storage.getItem('debutflow.progress.v1')).statistics.errors,1);
});

test('missing saved opening/line IDs fall back to a valid starting variation', () => {
    const {ChessTrainer, ProgressManager,database} = setup();
    new ProgressManager().setSession({openingId:'deleted-opening',lineId:'deleted-line',mode:'practice',moveIndex:9999});
    const trainer=new ChessTrainer(database);
    assert.ok(trainer.currentVariation);
    assert.equal(trainer.mode,null);
    assert.equal(trainer.currentMoveIndex,0);
});

test('saved move index is clamped to the length of the selected line', () => {
    const {ChessTrainer,ProgressManager,database} = setup();
    new ProgressManager().setSession({openingId:'opening-white',lineId:'line-b',mode:'study',moveIndex:5000});
    const trainer=new ChessTrainer(database);
    assert.equal(trainer.currentMoveIndex,2);
    assert.equal(trainer.game.history.length,2);
});

test('Stage 2 markup loads progress.js before trainer.js and exposes counters', () => {
    const html = fs.readFileSync(path.join(root,'index.html'),'utf8');
    const progressSrc = html.match(/src="(progress\.js\?v=[^"]+)"/)?.[1];
    const trainerSrc = html.match(/src="(trainer\.js\?v=[^"]+)"/)?.[1];
    assert.ok(progressSrc && trainerSrc, 'both modules must have cache versions');
    assert.ok(html.indexOf(progressSrc) < html.indexOf(trainerSrc), 'progress must load before trainer');
    assert.match(html,/id="completedLinesValue"/);
    assert.match(html,/id="wrongMovesValue"/);
});
