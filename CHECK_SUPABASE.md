# Supabase APIキー問題の診断結果

## 現在の状況

- **エラー**: "Invalid API key" (401 Unauthorized)
- **プロジェクトRef**: yylwtrtpfuluawdzvcfy ✅ 正しい
- **JWTトークン**: 有効（2034年まで有効）
- **問題**: Supabase側でこのキーが認識されていない

## 考えられる原因

1. **APIキーが再生成された**
   - Supabaseプロジェクトで新しいキーが生成され、古いキーが無効化された

2. **プロジェクトが一時停止**
   - 無料プランで7日間使用されないとプロジェクトが一時停止される

3. **間違ったプロジェクト**
   - 複数のSupabaseプロジェクトがある場合、別のプロジェクトのキーを使用している

## 確認手順

### 1. Supabaseダッシュボードで確認

```
https://supabase.com/dashboard/project/yylwtrtpfuluawdzvcfy
```

以下を確認：
- プロジェクトのステータス（Active/Paused）
- Settings > API > anon keyが現在の値と一致するか

### 2. プロジェクトが一時停止の場合

ダッシュボードで「Restore project」ボタンをクリック

### 3. APIキーが異なる場合

1. 新しいanon keyをコピー
2. `.env.local`を更新：
   ```
   NEXT_PUBLIC_SUPABASE_ANON_KEY=新しいキーをここに貼り付け
   ```
3. 開発サーバーを再起動

## デバッグ用の最小テスト

```javascript
// ブラウザのコンソールで実行
fetch('https://yylwtrtpfuluawdzvcfy.supabase.co/auth/v1/signup', {
  method: 'POST',
  headers: {
    'apikey': 'あなたのanon key',
    'Content-Type': 'application/json',
    'Authorization': 'Bearer あなたのanon key'
  },
  body: '{}'
}).then(r => r.json()).then(console.log)