// DebutFlow 1.0 release-candidate static checks.
// These tests do NOT prove network/CDN/SRI validity, chess legality or real-device touch behaviour.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const load = name => fs.readFileSync(path.join(root, name), 'utf8');
const html = load('index.html');
const css = load('style.css');
const readme = load('README.md');

test('release local CSS and JS share one version with no stale stage label', () => {
    const assets = [...html.matchAll(/(?:href|src)="(style\.css|openings\.js|comments\.js|progress\.js|trainer\.js)\?v=([^"&]+)"/g)];
    assert.equal(assets.length, 5);
    assert.deepEqual(new Set(assets.map(m => m[1])), new Set(['style.css','openings.js','comments.js','progress.js','trainer.js']));
    assert.equal(new Set(assets.map(m => m[2])).size, 1);
    assert.equal(assets[0][2], '1.0.0');
    assert.doesNotMatch(html, /stage2-review|s3-i2-20261116/);
});

test('status uses implicit polite live announcements; decorative icons are hidden', () => {
    assert.match(html, /class="training-stats"[^>]*role="status"[^>]*aria-label="Статистика практики"/);
    assert.doesNotMatch(html, /class="training-stats"[^>]*aria-live=|class="training-stats"[^>]*aria-atomic=/);
    assert.match(html, /aria-hidden="true">✅<\/span> Пройдено линий/);
    assert.match(html, /aria-hidden="true">🎯<\/span> Ошибок/);
    assert.match(html, /id="clearChatBtn"[^>]*><span aria-hidden="true">🗑️<\/span> Очистить/);
});

test('removed empty pulse keyframes without introducing animation regressions', () => {
    assert.doesNotMatch(css, /@keyframes\s+(errorPulse|successFlash)/);
    assert.match(css, /\.square-error\s*\{[^}]*animation:\s*none\s*!important/s);
    assert.match(css, /\.move-success\s*\{[^}]*animation:\s*none\s*!important/s);
});

test('release README links the other language and documents earlier screenshots and pending browser validation', () => {
    const en = load('README.en.md');
    assert.match(readme, /README\.en\.md/);
    assert.match(en, /\]\(README\.md\)/);
    assert.match(readme, /более ранняя версия интерфейса/);
    assert.match(en, /earlier interface version/);
    assert.match(readme, /227 линий/);
    assert.match(en, /227 lines/);
    assert.match(readme, /полный результат браузерного валидатора пока не подтверждён/i);
    assert.match(en, /full real-browser result remains unconfirmed/i);
    assert.doesNotMatch(readme, /кандидатную сборку.*не опубликованную/i);
});
