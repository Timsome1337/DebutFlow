// Stage 3 iteration 3: documentation, local screenshots, accessibility, CI configuration.
// Static checks. They do NOT prove GitHub Actions has run or mobile/CDN smoke tests pass.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

const html = read('index.html');
const css = read('style.css');
const readme = read('README.md');
const readmeEn = read('README.en.md');
const ci = read('.github/workflows/tests.yml');

test('CI triggers push and pull_request, tests Node 22 and 24, and has read-only permission', () => {
    assert.match(ci, /\bon:\s*\n\s*push:\s*\n\s*pull_request:/);
    assert.match(ci, /permissions:\s*\n\s*contents:\s*read/);
    assert.match(ci, /node-version:\s*\[22,\s*24\]/);
    assert.match(ci, /timeout-minutes:\s*5/);
    assert.match(ci, /uses:\s*actions\/checkout@v4/);
    assert.match(ci, /uses:\s*actions\/setup-node@v4/);
    assert.doesNotMatch(ci.split('\n').filter(line => !line.trim().startsWith('#')).join('\n'), /\bnpm\s+(?:install|ci)\b|\bnpx\b/);
});

test('CI checks every application JavaScript module and runs all Node regression suites', () => {
    for (const name of ['openings.js', 'comments.js', 'progress.js', 'trainer.js']) {
        assert.ok(ci.includes(`node --check ${name}`), `missing syntax check for ${name}`);
    }
    assert.match(ci, /node --test tests\/\*\.test\.cjs/);
    assert.ok(fs.readdirSync(path.join(root, 'tests')).filter(x => x.endsWith('.test.cjs')).length >= 4);
});

test('Russian README uses a personal voice and links to the standalone English translation', () => {
    assert.match(readme, /# ♟️ DebutFlow/);
    assert.match(readme, /Я сделал/);
    assert.match(readme, /README\.en\.md/);
    assert.match(readme, /23 дебютных раздела, 227 линий/);
    assert.match(readme, /debutflow\.progress\.v1/);
    assert.match(readme, /THIRD_PARTY_NOTICES\.md/);
    assert.match(readme, /полный результат браузерного валидатора пока не подтверждён/i);
    assert.doesNotMatch(readme, /кандидатную сборку, пока не опубликованную/i);
});

test('English README is complete, links back to Russian and keeps verification and licence limitations', () => {
    assert.match(readmeEn, /# ♟️ DebutFlow/);
    assert.match(readmeEn, /I built/);
    assert.match(readmeEn, /\]\(README\.md\)/);
    assert.match(readmeEn, /23 opening sections, 227 lines/);
    assert.match(readmeEn, /debutflow\.progress\.v1/);
    assert.match(readmeEn, /No licence is granted/);
    assert.match(readmeEn, /full real-browser result remains unconfirmed/i);
    assert.match(readmeEn, /THIRD_PARTY_NOTICES\.md/);
});

test('both README languages reference real, nonempty JPEG screenshots from the earlier interface', () => {
    const expected = ['start.jpg', 'study.jpg', 'practice-error.jpg', 'mobile-340.jpg'];
    for (const name of expected) {
        const rel = `docs/screenshots/${name}`;
        assert.ok(readme.includes(rel), `RU README screenshot missing: ${name}`);
        assert.ok(readmeEn.includes(rel), `EN README screenshot missing: ${name}`);
        const img = fs.readFileSync(path.join(root, rel));
        assert.ok(img.length > 2000, `screenshot ${name} appears empty`);
        assert.equal(img.subarray(0, 3).toString('hex'), 'ffd8ff', `not a JPEG: ${name}`);
    }
    assert.match(readme, /более ранняя версия интерфейса/);
    assert.match(readmeEn, /earlier interface version/);
});

test('decorative title/chat icons are hidden and live statistics panel is announced accessibly', () => {
    assert.match(html, /<h1>\s*<span aria-hidden="true">♜ <\/span>DebutFlow<span aria-hidden="true"> ♞<\/span><\/h1>/);
    assert.match(html, /class="chat-icon" aria-hidden="true"/);
    assert.match(html, /class="training-stats"[^>]*role="status"[^>]*aria-label="Статистика практики"/);
    assert.doesNotMatch(html, /class="training-stats"[^>]*aria-live=|class="training-stats"[^>]*aria-atomic=/);
    assert.match(html, /id="chatMessages"[^>]*role="log"[^>]*aria-live="polite"/);
});

test('mouse hover lift is gated; touch or hybrid devices receive usable tap targets', () => {
    const hover = css.slice(css.indexOf('/* Hover lifting is only for mouse/trackpad.'));
    assert.match(hover, /@media \(hover: hover\) and \(pointer: fine\)\s*\{[\s\S]*?\.control-btn:hover\s*\{[\s\S]*?transform:\s*translateY\(-2px\)/);
    assert.match(css, /@media \(pointer: coarse\), \(any-pointer: coarse\)\s*\{\s*\.control-btn,/);
    assert.match(css, /min-height:\s*44px/);
    assert.ok(!css.slice(0, css.indexOf('/* Hover lifting is only for mouse/trackpad.')).includes('.control-btn:hover'), 'unconditional hover would cause sticky lift');
});
