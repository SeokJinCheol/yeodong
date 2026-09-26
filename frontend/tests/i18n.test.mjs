import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';

const stored = new Map([['yeodong-language', 'ko']]);
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: key => stored.get(key) ?? null,
    setItem: (key, value) => stored.set(key, value),
} });
globalThis.document = { documentElement: { lang: '' }, title: '' };
const result = await build({
    entryPoints: [new URL('../src/lib/i18n.ts', import.meta.url).pathname],
    bundle: true, write: false, platform: 'node', format: 'esm',
});
const { default: i18n, t, resolveLanguage, changeLanguage, locale, translateMessage } =
    await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
const flatten = (tree, prefix = '') => Object.fromEntries(Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'string' ? [[path, value]] : Object.entries(flatten(value, path));
}));
const [ko, en] = await Promise.all(['ko', 'en'].map(async language =>
    flatten(JSON.parse(await readFile(new URL(`../src/locales/${language}.json`, import.meta.url), 'utf8')))));

test('saved language takes precedence; region variants and unsupported languages fall back safely', () => {
    assert.equal(resolveLanguage('ko', ['en-US']), 'ko');
    assert.equal(resolveLanguage('en', ['ko-KR']), 'en');
    assert.equal(resolveLanguage('invalid', ['fr-FR', 'en-GB']), 'en');
    assert.equal(resolveLanguage(null, ['ko-KR']), 'ko');
    assert.equal(resolveLanguage(null, ['ja-JP']), 'ko');
    assert.equal(resolveLanguage(null, []), 'ko');
});

test('all translations preserve interpolation variables and both languages have the same keys', () => {
    assert.deepEqual(Object.keys(ko).sort(), Object.keys(en).sort());
    const variables = value => [...value.matchAll(/\{\{(.*?)\}\}/g)].map(match => match[1]).sort();
    for (const key of Object.keys(ko)) {
        assert.match(key, /^[a-z][a-zA-Z0-9]*(?:\.[a-z][a-zA-Z0-9]*(?:_(?:one|other))?)+$/);
        assert.equal(ko[key], ko[key].trim(), `Leading/trailing space: ${key}`);
        assert.equal(en[key], en[key].trim(), `Leading/trailing space: ${key}`);
        assert.equal(/\{\{value\d+\}\}/.test(ko[key]), false, `Unnamed interpolation: ${key}`);
        assert.deepEqual(variables(ko[key]), variables(en[key]), key);
        assert.equal(/[가-힣]/.test(en[key]), false, `Untranslated English: ${key}`);
    }
});

test('switching persists choice, updates document and locale, and keeps interpolation data intact', async () => {
    await changeLanguage('en');
    assert.equal(t("auth.button.login"), 'Log in');
    assert.equal(locale(), 'en-US');
    assert.equal(document.documentElement.lang, 'en');
    assert.equal(document.title, 'Yeodong · Your own journey');
    assert.equal(stored.get('yeodong-language'), 'en');
    assert.equal(t("common.accessibility.edit", {name:'사용자 장소 <test>'}), 'Edit 사용자 장소 <test>');
    assert.equal(translateMessage('아이디 또는 비밀번호가 올바르지 않습니다.'), 'Incorrect username or password.');
    assert.equal(translateMessage('사용자 장소: 필수 12:00보다 5분 늦게 도착합니다.'), '사용자 장소: arrival is 5 min after the required time of 12:00.');
    await changeLanguage('ko');
    assert.equal(translateMessage('Incorrect username or password.'), '아이디 또는 비밀번호가 올바르지 않습니다.');
    assert.equal(locale(), 'ko-KR');
    assert.equal(document.documentElement.lang, 'ko');
    assert.equal(translateMessage('unrecognized system message'), 'unrecognized system message');
    assert.equal(translateMessage('common.button.delete'), 'common.button.delete');
});

test('blocked browser storage does not prevent a language change', async () => {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('Blocked'); } });
    await assert.doesNotReject(changeLanguage('en'));
    assert.equal(i18n.resolvedLanguage, 'en');
    assert.equal(t("auth.button.login"), 'Log in');
});


test('common actions and full phrases handle spacing, variables and plural forms centrally', async () => {
    await changeLanguage('ko');
    assert.equal(t('common.button.delete'), '삭제');
    assert.equal(t('place.checklist.progress', {completed: 1, total: 3}), '할 일 · 1/3 완료');
    assert.equal(t('account.greeting', {name: '이름'}), '이름 님');
    assert.equal(t('common.duration.hoursMinutes', {hours: 1, minutes: 5}), '1시간 5분');
    await changeLanguage('en');
    assert.equal(t('common.button.delete'), 'Delete');
    assert.equal(t('place.checklist.progress', {completed: 1, total: 3}), 'Checklist · 1/3 complete');
    assert.equal(t('account.greeting', {name: 'Name'}), 'Name');
    assert.equal(t('place.count', {count: 0}), '0 places');
    assert.equal(t('place.count', {count: 1}), '1 place');
    assert.equal(t('place.count', {count: 2}), '2 places');
    assert.equal(t('transit.headsign', {destination: '<도쿄> & Shinjuku'}), 'Toward <도쿄> & Shinjuku');
});
