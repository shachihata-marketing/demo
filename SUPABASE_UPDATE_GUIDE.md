# Supabase APIキー更新ガイド

現在、「Invalid API key」エラーが発生しています。これを修正するには以下の手順を実行してください：

## 手順

1. **Supabaseダッシュボードにログイン**
   - https://supabase.com/dashboard にアクセス
   - プロジェクト「yylwtrtpfuluawdzvcfy」を選択

2. **APIキーを取得**
   - 左側メニューから「Settings」をクリック
   - 「API」タブを選択
   - 「Project API keys」セクションを確認

3. **anon keyをコピー**
   - 「anon」public キーの値をコピー
   - このキーは`eyJ`で始まる長い文字列です

4. **.env.localファイルを更新**
   ```
   NEXT_PUBLIC_SUPABASE_ANON_KEY=ここに新しいanon keyを貼り付け
   ```

5. **開発サーバーを再起動**
   ```bash
   # Ctrl+C で現在のサーバーを停止
   npm run dev
   ```

## 確認事項

- 匿名認証が有効になっていることを確認
  - Authentication > Providers > Email で「Enable Email provider」がON
  - 「Enable anonymous sign-ins」がON

- プロジェクトURLが正しいことを確認
  - Settings > API で表示される「Project URL」が以下と一致：
  - `https://yylwtrtpfuluawdzvcfy.supabase.co`

## トラブルシューティング

もし上記の手順でも解決しない場合：

1. Supabaseプロジェクトが一時停止されていないか確認
2. APIキーに使用制限が設定されていないか確認
3. ブラウザのキャッシュをクリアして再試行

## ローカルモードについて

現在、Supabase認証が失敗した場合でも、アプリケーションはローカルモードで動作するように設定されています。これにより：
- スタンプの収集は正常に機能します
- データはローカルストレージに保存されます
- Supabaseへのデータ同期のみが無効になります