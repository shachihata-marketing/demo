import { test, expect } from '@playwright/test';

test('demo.stamp-rally.funの実際の内容を確認', async ({ page }) => {
  await page.goto('https://demo.stamp-rally.fun');
  await page.waitForLoadState('networkidle');
  
  // タイトルを取得
  const title = await page.title();
  console.log('ページタイトル:', title);
  
  // ページのテキスト内容を取得
  const bodyText = await page.locator('body').textContent();
  console.log('ページの主要なテキスト:', bodyText?.substring(0, 500));
  
  // 主要な要素を確認
  const h1Elements = await page.locator('h1').allTextContents();
  console.log('H1要素:', h1Elements);
  
  const h2Elements = await page.locator('h2').allTextContents();
  console.log('H2要素:', h2Elements);
  
  const buttons = await page.locator('button').allTextContents();
  console.log('ボタン:', buttons);
  
  // スクリーンショットを複数サイズで保存
  await page.screenshot({ path: 'tests/screenshots/actual-page-desktop.png', fullPage: true });
  
  await page.setViewportSize({ width: 375, height: 667 });
  await page.screenshot({ path: 'tests/screenshots/actual-page-mobile.png', fullPage: true });
  
  // HTMLを保存
  const html = await page.content();
  const fs = require('fs');
  fs.writeFileSync('tests/actual-page.html', html);
});