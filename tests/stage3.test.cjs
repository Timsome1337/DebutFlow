// Stage 3 iteration 1: curated opening commentary, no npm packages.
// This is a DATA/LOOKUP test using a fake Chess class, NOT a legality check.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const db = JSON.parse(fs.readFileSync(path.join(root,'DebutFlow_openings_database.json'), 'utf8'));
const targetNames = new Set([
  'Итальянская партия', 'Испанская партия', 'Сицилианская защита', 'Французская защита',
  'Принятый ферзевый гамбит', 'Отклоненный ферзевый гамбит', 'Контргамбит Альбина'
]);

function makeContext() {
    class FakeChess {
        constructor() { this.ply = 0; }
        move(san) {
            const index = this.ply++;
            // Infer moving piece from SAN for commentary tests. This is not a chess engine.
            const piece = /^O-O/.test(san) ? 'k' : ({ N:'n', B:'b', R:'r', Q:'q', K:'k' }[san[0]] || 'p');
            const to = san.match(/([a-h][1-8])(?:=[QRBN])?[+#]?$/)?.[1] || 'e4';
            const white = index % 2 === 0;
            const backRank = white ? '1' : '8';
            const from = piece === 'n' ? 'g'+backRank
                : piece === 'b' ? 'f'+backRank
                : piece === 'q' ? 'd'+backRank
                : piece === 'r' ? 'a'+backRank
                : piece === 'k' ? 'e'+backRank
                : white ? 'e2' : 'e7';
            const flags = /^O-O-O/.test(san) ? 'q' : /^O-O/.test(san) ? 'k' : san.includes('x') ? 'c' : 'n';
            return { san, color: white ? 'w' : 'b', piece, from, to, flags,
                     ...(san.includes('x') ? {captured:'p'} : {}) };
        }
    }
    const context = vm.createContext({
        window: {}, console, Chess: FakeChess, navigator: { maxTouchPoints:0 }, document: {},
        $: () => ({ ready() {} }),
        setTimeout(){ return 1; }, clearTimeout(){},
    });
    for (const name of ['openings.js', 'comments.js', 'trainer.js']) {
        vm.runInContext(fs.readFileSync(path.join(root,name),'utf8'), context, { filename:name });
    }
    const Trainer = vm.runInContext('ChessTrainer', context);
    const trainer = Object.create(Trainer.prototype);
    trainer.moveCache = new Map();
    return { context, trainer, notes:context.window.DEBUTFLOW_OPENING_COMMENTS };
}

test('opening database remains 23 categories and 227 lines; JS mirror equals JSON', () => {
    const {context} = makeContext();
    assert.equal(db.openings.length,23);
    assert.equal(db.openings.reduce((a,o)=>a+o.lines.length,0),227);
    assert.equal(JSON.stringify(context.window.OPENINGS_DB),JSON.stringify(db));
});

test('catalog covers exactly seven selected opening sections without touching other sections', () => {
    const {notes} = makeContext();
    const target = db.openings.filter(o=>targetNames.has(o.name));
    assert.equal(target.length,7);
    assert.equal(target.reduce((a,o)=>a+o.lines.length,0),87);
    assert.deepEqual(Object.keys(notes).sort(),target.map(o=>o.id).sort());
    assert.equal(db.openings.filter(o=>!targetNames.has(o.name)).length,16);
});

test('each available first eight plies of all target lines has a curated comment', () => {
    const {trainer} = makeContext();
    let checked=0;
    for (const opening of db.openings.filter(o=>targetNames.has(o.name))) {
        for (const line of opening.lines) {
            const tokens=trainer.tokenizePgn(line.pgn);
            for (const [index,san] of tokens.slice(0,8).entries()) {
                const note=trainer.getOpeningComment(opening,san,index);
                assert.ok(note.length>=20 && note.length<=200,`${opening.name}: ${line.name} ply ${index} ${san}`);
                checked++;
            }
        }
    }
    assert.equal(checked,657);
});

test('lookup uses opening ID + ply + SAN and rejects mismatched or out-of-range moves', () => {
    const {trainer} = makeContext();
    const opening=db.openings.find(o=>o.name==='Итальянская партия');
    assert.match(trainer.getOpeningComment(opening,'Bc4',4),/Слон/);
    assert.equal(trainer.getOpeningComment(opening,'Bc4',5),'');
    assert.equal(trainer.getOpeningComment(opening,'Bc5',4),'');
    assert.equal(trainer.getOpeningComment(opening,'e4',8),'');
    assert.equal(trainer.getOpeningComment(null,'e4',0),'');
});

test('prepareMoves uses curated comments for matching opening moves', () => {
    const {trainer} = makeContext();
    const opening=db.openings.find(o=>o.name==='Испанская партия');
    const line=opening.lines[0];
    const moves=trainer.prepareMoves(opening,line);
    assert.equal(moves[4].san,'Bb5');
    assert.equal(moves[4].desc,trainer.getOpeningComment(opening,'Bb5',4));
});

test('line-specific training_descriptions retain highest precedence over catalog', () => {
    const {trainer} = makeContext();
    const opening=db.openings.find(o=>o.name==='Итальянская партия');
    const line={...opening.lines[0],id:'stage3-override-test',training_descriptions:['Авторский комментарий для конкретной линии.']};
    const moves=trainer.prepareMoves(opening,line);
    assert.equal(moves[0].desc,line.training_descriptions[0]);
    assert.equal(moves[1].desc,trainer.getOpeningComment(opening,moves[1].san,1));
});

test('all sixteen unrelated opening sections keep old fallback including non-pawn pieces', () => {
    const {trainer} = makeContext();
    let knights = 0, bishops = 0, queens = 0;
    for (const opening of db.openings.filter(o=>!targetNames.has(o.name))) {
        const line=opening.lines[0];
        const moves=trainer.prepareMoves(opening,line);
        for (const [i,move] of moves.entries()) {
            assert.equal(trainer.getOpeningComment(opening,move.san,i),'');
            assert.ok(typeof move.desc === 'string' && move.desc.length > 0);
            // Test a meaningful piece-specific outcome, not just equality against
            // the same function with a hardcoded pawn mock.
            if (/^N[^x]/.test(move.san) && i < 16) {
                assert.match(move.desc, /Конь/);
                knights++;
            }
            if (/^B[^x]/.test(move.san) && i < 16) {
                assert.match(move.desc, /Слон/);
                bishops++;
            }
            if (/^Q[^x]/.test(move.san) && i < 16) {
                assert.match(move.desc, /Ферзь/);
                queens++;
            }
        }
    }
    assert.ok(knights >= 3, 'expect knight fallback examples');
    assert.ok(bishops >= 1, 'expect bishop fallback examples');
    assert.ok(queens >= 1, 'expect queen fallback examples');
});

test('target line moves after ply seven use the original fallback', () => {
    const {trainer} = makeContext();
    const opening=db.openings.find(o=>o.name==='Итальянская партия');
    const line=opening.lines.find(l=>trainer.tokenizePgn(l.pgn).length>8);
    assert.ok(line,'expect a longer target line');
    const moves=trainer.prepareMoves(opening,line);
    assert.equal(trainer.getOpeningComment(opening,moves[8].san,8),'');
    assert.ok(moves[8].desc.length > 20, 'later moves still receive a generated description');
});

test('missing catalog or bad entries degrade gracefully to generated text', () => {
    const {trainer,context} = makeContext();
    const opening=db.openings.find(o=>o.name==='Итальянская партия');
    const line=opening.lines[0];
    context.window.DEBUTFLOW_OPENING_COMMENTS = {};
    const moves=trainer.prepareMoves(opening,line);
    assert.equal(moves[0].desc,trainer.generateMoveComment({san:moves[0].san,from:moves[0].from,to:moves[0].to,piece:'p',flags:'n'},0));
    trainer.moveCache.clear();
    context.window.DEBUTFLOW_OPENING_COMMENTS = { [opening.id]: { 0: {e4:'x'} } };
    assert.equal(trainer.getOpeningComment(opening,'e4',0),'');
});

test('HTML loads comments after openings but before trainer; saved progress format unchanged', () => {
    const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
    const a=html.indexOf('src="openings.js?'), b=html.indexOf('src="comments.js?'), c=html.indexOf('src="trainer.js?');
    assert.ok(a>=0 && b>a && c>b);
    const progress=fs.readFileSync(path.join(root,'progress.js'),'utf8');
    assert.match(progress,/debutflow\.progress\.v1/);
});

// Regression checks for position-dependent comments flagged by the chess audit.
test('QGD c4 and e6 explanations do not assume d5 exists after 1...Nf6', () => {
    const {trainer} = makeContext();
    const opening = db.openings.find(o=>o.id==='79dd91c1-646a-5679-8675-3ce37aa366fa');
    for (const lineId of ['acb8e404', '9a06ae8c']) {
        const line = opening.lines.find(l=>l.id.startsWith(lineId));
        assert.ok(line, `missing audited QGD line ${lineId}`);
        const tokens=trainer.tokenizePgn(line.pgn);
        assert.deepEqual(Array.from(tokens.slice(0,4)), ['d4','Nf6','c4','e6']);
        const moves=trainer.prepareMoves(opening,line);
        assert.equal(moves[2].desc,'Белая пешка c4 оспаривает поле d5 и начинает борьбу за центр.');
        assert.equal(moves[3].desc,'Чёрная пешка e6 открывает диагональ королевскому слону и укрепляет центр.');
        assert.doesNotMatch(moves[2].desc,/пешку d5/);
        assert.doesNotMatch(moves[3].desc,/пешку d5/);
    }
});

test('QGD Qxd5 description says queen takes pawn rather than returns one', () => {
    const {trainer} = makeContext();
    const opening = db.openings.find(o=>o.id==='79dd91c1-646a-5679-8675-3ce37aa366fa');
    const line = opening.lines.find(l=>l.id.startsWith('2b53c251'));
    assert.ok(line);
    const moves=trainer.prepareMoves(opening,line);
    assert.equal(moves[5].san,'Qxd5');
    assert.equal(moves[5].desc,'Чёрный ферзь забирает белую пешку на d5 и оказывается в центре доски.');
});


// Stage 3 iteration 2: source-level regression checks; not device/browser QA.
test('QGD Cambridge Springs e6 correctly describes direct pawn defense on d5', () => {
    const {trainer} = makeContext();
    const opening = db.openings.find(o => o.id === '79dd91c1-646a-5679-8675-3ce37aa366fa');
    const line = opening.lines.find(l => /Cambridge Springs Defense/.test(l.name));
    assert.ok(line, 'Cambridge Springs Defense must exist');
    const moves = trainer.prepareMoves(opening, line);
    assert.deepEqual(Array.from(moves.slice(0, 8), m => m.san),
        ['d4', 'd5', 'c4', 'c6', 'Nf3', 'Nf6', 'Nc3', 'e6']);
    assert.equal(moves[7].desc,
        'Чёрная пешка e6 защищает пешку d5 по диагонали и открывает путь слону f8.');
});

test('local asset cache versions are identical and source order is preserved', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const assets = ['style.css', 'openings.js', 'comments.js', 'progress.js', 'trainer.js'];
    const versions = assets.map(asset => {
        const escaped = asset.replace('.', '\\.');
        const tag = html.match(new RegExp('(?:href|src)="' + escaped + '\\?v=([a-z0-9.-]+)"'));
        assert.ok(tag, `missing version for ${asset}`);
        return tag[1];
    });
    assert.equal(new Set(versions).size, 1, 'all five local assets must use one release version');
    assert.ok(html.indexOf('openings.js?') < html.indexOf('comments.js?'));
    assert.ok(html.indexOf('comments.js?') < html.indexOf('progress.js?'));
    assert.ok(html.indexOf('progress.js?') < html.indexOf('trainer.js?'));
});

test('small-screen CSS and accessible chat log have the expected structure', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
    assert.doesNotMatch(html, /user-scalable=no/);
    assert.match(html, /id="chatMessages"[^>]*role="log"[^>]*aria-live="polite"/);
    assert.match(css, /@media\s*\(max-width:\s*380px\)/);
    assert.match(css, /\.board-section\s*\{\s*min-width:\s*0;/);
    assert.match(css, /@media\s*\(pointer:\s*coarse\)/);
    assert.match(css, /min-height:\s*44px/);
    assert.match(css, /\.control-btn:focus-visible/);
});
