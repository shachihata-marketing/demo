# Vercel環境変数チェックリスト

## 本番環境でEFP2が動作しない問題の対処法

### 1. Vercelダッシュボードで環境変数を確認

1. Vercelにログイン
2. プロジェクトを選択
3. Settings → Environment Variables に移動
4. 以下の環境変数が設定されているか確認：
   - `NEXT_PUBLIC_EFP2_API_KEY`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_TEST_MODE`

### 2. 環境変数の値を確認

- `NEXT_PUBLIC_EFP2_API_KEY`: 正しいAPIキー（約200文字）
- `NEXT_PUBLIC_TEST_MODE`: `false`

### 3. ブラウザのコンソールで確認

本番環境でブラウザのコンソールを開き、以下を確認：

1. `=== APIキー確認 ===` のログを確認
2. APIキーが「未設定」と表示されていないか
3. `SDK取得開始:` のログでURLにAPIキーが含まれているか

### 4. 401エラーの詳細確認

- Network タブで `efpkit2.js` のリクエストを確認
- URLにAPIキーパラメータが含まれているか
- レスポンスヘッダーを確認

### 5. 再デプロイ

環境変数を設定・更新した後は必ず再デプロイが必要：

```bash
vercel --prod
```

または、Vercelダッシュボードから「Redeploy」を実行

### 6. APIキーのパラメータ名

現在は `?key=` を使用していますが、以下も試してください：
- `?apikey=`
- `?api_key=`
- `?token=`

### 7. CORS/リファラー制限

APIキーがドメイン制限されている可能性：
- Vercelのデプロイメントドメインが許可されているか確認
- カスタムドメインを使用している場合は、そのドメインも許可リストに追加