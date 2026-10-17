import { test, expect, type Page } from '@playwright/test';
import { prepareReview, decodeReview } from '../src/examiner';
import { reviewFixture, testEssay } from '../test-fixtures/examiner';
import { readFileSync } from 'node:fs';
import type { Bank } from '../src/types';
const bank = JSON.parse(readFileSync(new URL('../public/content/bank.json', import.meta.url), 'utf8')) as Bank;
async function connect(page: Page, signedIn = true) {
  await page.route('**/api/chatgpt/state', route => route.fulfill({ json: { available: true, connected: signedIn, sharing: signedIn, connecting: false, activeId: signedIn ? 'test' : undefined, email: signedIn ? 'candidate@example.test' : undefined, accounts: signedIn ? [{ id: 'test', label: 'Connection 1', email: 'candidate@example.test', connected: true }] : [] } }));
  await page.route('**/api/chatgpt/models', route => route.fulfill({ json: { models: [{ slug: 'test-model', name: 'Test model' }] } }));
}
async function completed(page: Page, skill: 'writing' | 'reading' | 'listening') {
  await page.goto('/');
  await page.getByRole('heading', { name: 'Make test day feel familiar.' }).waitFor();
  await page.evaluate(async ({ skill, essay }) => {
    const bank = await (await fetch('/content/bank.json')).json(); const engine = await import('/src/engine.ts');
    const session = engine.createSession(bank, skill, 0, 'practice', Date.now());
    if (skill === 'writing') { const paper = bank.writing.find((p: { id: string }) => p.id === session.paperIds.writing); session.answers = Object.fromEntries(paper.tasks.map((t: { id: string }) => [t.id, essay])); }
    else { const paper = bank[skill].find((p: { id: string }) => p.id === session.paperIds[skill]); session.answers[paper.parts[0].groups[0].questions[0].id] = 'Wrong answer'; }
    localStorage.setItem('ielts-studio-v1:active', JSON.stringify(session));
  }, { skill, essay: testEssay });
  await page.reload();
  await page.getByRole('button', { name: 'Finish section', exact: true }).click();
  await page.getByRole('button', { name: 'Submit ' + skill[0].toUpperCase() + skill.slice(1), exact: true }).click();
}
test('connection page replaces voice handoff, requires no API key and fits mobile', async ({ page }) => {
  await connect(page, false); await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#chatgpt-speaking');
  await expect(page).toHaveURL(/#chatgpt-examiner$/);
  await expect(page.getByRole('heading', { name: 'Connect your ChatGPT plan.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue with ChatGPT', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copy examiner brief', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: '../docs/simulator/chatgpt-examiner-mobile.png' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: '../docs/simulator/chatgpt-examiner-preview.png' });
});
test('Writing review stays on the results page, shows examiner feedback and persists without rerunning inference', async ({ page }) => {
  await connect(page); let requests = 0;
  await page.route('**/api/chatgpt/review', async route => { requests++; const input = route.request().postDataJSON(); await route.fulfill({ json: { review: decodeReview(JSON.stringify(reviewFixture(prepareReview(bank, input))), prepareReview(bank, input)), model: 'test-model', reviewedAt: Date.now() } }); });
  await completed(page, 'writing');
  await expect(page.getByRole('combobox', { name: 'ChatGPT reviewer model' })).toHaveValue('test-model');
  await expect(page.getByRole('combobox', { name: 'Feedback language' })).toHaveValue('id');
  await page.getByRole('button', { name: 'Review with ChatGPT', exact: true }).click();
  await expect(page.getByText('Estimated Writing band: 7.5', { exact: true })).toBeVisible();
  await expect(page.getByText('Keep your idea. Make the English work harder.')).toHaveCount(2);
  await expect(page.getByText('Claim, reason, example, link', { exact: true })).toHaveCount(2);
  await page.locator('.examiner-criteria summary').first().click();
  await expect(page.locator('.criterion-upgrade').first()).toContainText('Toward Band 9');
  await expect(page.locator('.criterion-upgrade').first()).toContainText('Check your rewrite');
  await page.getByRole('button', { name: 'Back to workspace' }).click();
  await page.locator('.history-table .history-row').first().click();
  await expect(page.getByText('Estimated Writing band: 7.5', { exact: true })).toBeVisible();
  expect(requests).toBe(1);
  await page.screenshot({ path: '../docs/simulator/chatgpt-writing-review-test.png', fullPage: true });
});
test('failed registration shows the exact retry connection while retaining the active account', async ({ page }) => {
  await connect(page);
  await page.route('**/api/chatgpt/state', route => route.fulfill({ json: { available: true, connected: true, sharing: true, connecting: false, activeId: 'test', retryAccountId: 'second', retryAccountLabel: 'Connection 2', accounts: [{ id: 'test', label: 'Connection 1', connected: true }, { id: 'second', label: 'Connection 2', connected: false }], error: 'OpenAI rejected this sign-in code (invalid_grant). Retry the saved connection to request a fresh code.' } }));
  await page.goto('/#chatgpt-examiner');
  await expect(page.getByRole('button', { name: 'Retry Connection 2', exact: true })).toBeEnabled();
  await expect(page.getByRole('combobox', { name: 'ChatGPT connection', exact: true })).toHaveValue('test');
  await expect(page.getByRole('alert')).toContainText('invalid_grant');
  await expect(page.getByText(/Retry will resume Connection 2 with a fresh sign-in code/)).toBeVisible();
});
test('objective reviews show evidence and traps in batches while keeping deterministic scores', async ({ page }) => {
  await connect(page);
  await page.route('**/api/chatgpt/review', async route => { const input = route.request().postDataJSON(); expect(input.questionIds.length).toBeLessThanOrEqual(8); await route.fulfill({ json: { review: decodeReview(JSON.stringify(reviewFixture(prepareReview(bank, input))), prepareReview(bank, input)), model: 'test-model', reviewedAt: Date.now() } }); });
  await completed(page, 'reading');
  const score = await page.locator('.result-score>strong').innerText();
  await page.getByRole('button', { name: 'Review with ChatGPT', exact: true }).click();
  await expect(page.getByText('Why that answer can look tempting', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Matched to the supplied passage').first()).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Review focus' })).toHaveValue('all');
  await expect(page.getByText('Focus on the deciding words', { exact: true }).first()).toBeVisible();
  await expect(page.locator('.examiner-focus mark').first()).toBeVisible();
  await expect(page.getByText('A habit to build toward Band 9', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Prepare the next question batch' })).toBeVisible();
  expect(await page.locator('.result-score>strong').innerText()).toBe(score);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
test('strategy playbook works without ChatGPT access and explains the shared website limitation', async ({ page }) => {
  await page.route('**/api/chatgpt/state', route => route.fulfill({ json: { available: false, connected: false, sharing: false, connecting: false, accounts: [] } }));
  await page.goto('/#chatgpt-examiner');
  await expect(page.getByRole('heading', { name: 'Personal reviews in the local edition.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue with ChatGPT', exact: true })).toHaveCount(0);
  const guide = page.locator('.band9-playbook');
  await guide.locator('.strategy-card summary').first().click();
  await expect(guide).toContainText('Some, but not all');
  await page.getByRole('combobox', { name: 'Strategy skill' }).selectOption('listening');
  await guide.locator('.strategy-card summary').first().click();
  await expect(guide.getByText(/Friday\. Tuesday dibatalkan/)).toBeVisible();
  await page.getByRole('combobox', { name: 'Strategy skill' }).selectOption('writing');
  await guide.locator('.strategy-card summary').last().click();
  await expect(guide.getByText(/Template yang dihafal/)).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await guide.locator('h2').scrollIntoViewIfNeeded();
  await page.screenshot({ path: '../docs/simulator/band9-strategies-mobile.png' });
});
test('Listening review links transcript evidence to an applied framework and measurable practice', async ({ page }) => {
  await connect(page);
  await page.route('**/api/chatgpt/review', async route => { const input = route.request().postDataJSON(); expect(input.skill).toBe('listening'); const prepared = prepareReview(bank, input); await route.fulfill({ json: { review: decodeReview(JSON.stringify(reviewFixture(prepared)), prepared), model: 'test-model', reviewedAt: Date.now() } }); });
  await completed(page, 'listening');
  await page.getByRole('button', { name: 'Review with ChatGPT', exact: true }).click();
  await expect(page.getByText('Matched to the supplied transcript').first()).toBeVisible();
  await expect(page.getByText('Framework applied to this question').first()).toBeVisible();
  await expect(page.locator('.examiner-band9-habit').first()).toContainText('Check yourself');
  await page.locator('.question-strategy .strategy-card summary').first().click();
  await expect(page.locator('.question-strategy .strategy-card').first()).toContainText('Predict → Track → Confirm → Check');
});
