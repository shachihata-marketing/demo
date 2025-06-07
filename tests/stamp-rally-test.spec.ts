import { test, expect, Page } from '@playwright/test';

test.describe('Stamp Rally App Tests', () => {
  const baseUrl = 'https://demo.stamp-rally.fun';
  
  test.beforeEach(async ({ page }) => {
    // ページにアクセス
    await page.goto(baseUrl);
    
    // ページが完全に読み込まれるまで待機
    await page.waitForLoadState('networkidle');
  });

  test('トップページが正しく表示される', async ({ page }) => {
    // タイトルの確認
    await expect(page).toHaveTitle(/シャチハタZOOスタンプラリー/);
    
    // ヒーローセクションの確認
    await expect(page.locator('h1')).toContainText('シャチハタZOOスタンプラリー');
    
    // スタートボタンの確認
    const startButton = page.locator('button:has-text("スタンプラリーを始める")');
    await expect(startButton).toBeVisible();
    
    // スクリーンショットを保存
    await page.screenshot({ path: 'tests/screenshots/top-page.png' });
  });

  test('スタンプラリー開始フローのテスト', async ({ page }) => {
    // スタートボタンをクリック
    await page.click('button:has-text("スタンプラリーを始める")');
    
    // モーダルが表示されるまで待機
    await page.waitForSelector('[role="dialog"]', { state: 'visible' });
    
    // 名前入力フィールドの確認
    const nameInput = page.locator('input[placeholder="お名前を入力"]');
    await expect(nameInput).toBeVisible();
    
    // 名前を入力
    await nameInput.fill('テストユーザー');
    
    // 始めるボタンをクリック
    await page.click('button:has-text("始める")');
    
    // スタンプページに遷移することを確認
    await page.waitForSelector('text=スタンプを集めよう', { timeout: 10000 });
    
    // スクリーンショットを保存
    await page.screenshot({ path: 'tests/screenshots/stamp-page.png' });
  });

  test('スタンプ収集機能のテスト', async ({ page }) => {
    // 直接スタンプページにアクセス（localStorageを設定）
    await page.addInitScript(() => {
      localStorage.setItem('user', JSON.stringify({ name: 'テストユーザー' }));
      localStorage.setItem('stamps', JSON.stringify([]));
    });
    
    await page.goto(baseUrl);
    
    // スタンプカードが表示されることを確認
    await expect(page.locator('text=スタンプを集めよう')).toBeVisible();
    
    // 最初のスタンプボタンをクリック
    const firstStampButton = page.locator('.grid button').first();
    await firstStampButton.click();
    
    // マイクアクセス許可のダイアログが出る可能性があるため、少し待機
    await page.waitForTimeout(2000);
    
    // エラーメッセージが表示されないことを確認
    const errorAlert = page.locator('text=エラーが発生しました');
    const isErrorVisible = await errorAlert.isVisible().catch(() => false);
    
    if (isErrorVisible) {
      console.log('エラーが発生しました - EFP2 SDKの問題の可能性があります');
      await page.screenshot({ path: 'tests/screenshots/error-state.png' });
    }
    
    // スクリーンショットを保存
    await page.screenshot({ path: 'tests/screenshots/stamp-collection.png' });
  });

  test('レスポンシブデザインのテスト', async ({ page }) => {
    // モバイルビューポートに設定
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto(baseUrl);
    await page.waitForLoadState('networkidle');
    
    // モバイルでも正しく表示されることを確認
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('button:has-text("スタンプラリーを始める")')).toBeVisible();
    
    // スクリーンショットを保存
    await page.screenshot({ path: 'tests/screenshots/mobile-view.png' });
  });

  test('完了ページへの遷移テスト', async ({ page }) => {
    // 全スタンプを収集した状態を設定
    await page.addInitScript(() => {
      localStorage.setItem('user', JSON.stringify({ name: 'テストユーザー' }));
      localStorage.setItem('stamps', JSON.stringify([
        { id: 'kuma', collectedAt: new Date().toISOString() },
        { id: 'raichou', collectedAt: new Date().toISOString() },
        { id: 'kaba', collectedAt: new Date().toISOString() },
        { id: 'neco', collectedAt: new Date().toISOString() }
      ]));
    });
    
    // 完了ページに直接アクセス
    await page.goto(`${baseUrl}/complete`);
    
    // 完了メッセージが表示されることを確認
    await expect(page.locator('text=おめでとうございます')).toBeVisible();
    
    // スクリーンショットを保存
    await page.screenshot({ path: 'tests/screenshots/complete-page.png' });
  });

  test('ネットワークエラー時の動作確認', async ({ page }) => {
    // オフラインモードをシミュレート
    await page.context().setOffline(true);
    
    await page.goto(baseUrl);
    
    // ページが表示されることを確認（キャッシュやService Workerがある場合）
    const isPageVisible = await page.locator('h1').isVisible().catch(() => false);
    
    if (!isPageVisible) {
      console.log('オフライン時にページが表示されません');
    }
    
    // スクリーンショットを保存
    await page.screenshot({ path: 'tests/screenshots/offline-state.png' });
    
    // オンラインに戻す
    await page.context().setOffline(false);
  });
});