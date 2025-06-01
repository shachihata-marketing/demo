# 本番環境設定ガイド

このドキュメントは、開発環境を本番環境に近い形で構築するための設定ガイドです。

## 環境変数の設定

### 1. `.env.local`ファイルの作成

すべての環境変数を`.env.local`ファイルで管理します：

```env
# EFP2 API Key（音響認識用）
NEXT_PUBLIC_EFP2_API_KEY=your_efp2_api_key_here

# Supabase設定
NEXT_PUBLIC_SUPABASE_URL=https://yylwtrtpfuluawdzvcfy.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# テストモード（本番環境ではfalse）
NEXT_PUBLIC_TEST_MODE=false
```

### 2. Supabase APIキーの取得

1. [Supabaseダッシュボード](https://supabase.com/dashboard)にログイン
2. プロジェクトを選択
3. Settings → API に移動
4. `anon` public keyをコピー
5. `.env.local`の`NEXT_PUBLIC_SUPABASE_ANON_KEY`に設定

### 3. 匿名認証の有効化

1. Authentication → Providers に移動
2. Email providerを有効化
3. "Enable anonymous sign-ins"をONに設定

## 本番環境チェックリスト

- [ ] `.env.local`ファイルが作成されている
- [ ] `NEXT_PUBLIC_EFP2_API_KEY`が設定されている
- [ ] `NEXT_PUBLIC_SUPABASE_URL`が正しく設定されている
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`が最新のキーに更新されている
- [ ] `NEXT_PUBLIC_TEST_MODE`が`false`に設定されている
- [ ] Supabaseで匿名認証が有効になっている
- [ ] APIキーがハードコーディングされていない

## 開発サーバーの起動

```bash
npm run dev
```

コンソールで以下の確認メッセージが表示されます：

```
=== 環境設定 ===
モード: 本番モード
Supabase URL: ✅ 設定済み
Supabase Key: ✅ 設定済み
EFP2 API Key: ✅ 設定済み
================
```

## トラブルシューティング

### "Invalid API key"エラーが発生する場合

1. Supabaseダッシュボードから最新のanon keyを取得
2. `.env.local`ファイルを更新
3. 開発サーバーを再起動（Ctrl+C → `npm run dev`）

### 環境変数が読み込まれない場合

1. `.env.local`ファイルがプロジェクトルートにあることを確認
2. ファイル名が正確に`.env.local`であることを確認（`.env`ではない）
3. 開発サーバーを完全に停止して再起動

### ローカルモードで動作してしまう場合

Supabase認証が失敗した場合、アプリケーションは自動的にローカルモードにフォールバックします。
これは開発時の利便性のための機能ですが、本番環境では適切なエラーハンドリングに置き換えてください。

## セキュリティ上の注意

- `.env.local`ファイルは**絶対にGitにコミットしない**
- 本番環境では、環境変数はホスティングサービス（Vercel、Netlifyなど）で設定
- APIキーは定期的にローテーション
- 本番環境では`TEST_MODE`を必ず`false`に設定