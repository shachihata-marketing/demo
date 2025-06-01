# シヤチハタ動物園デモページ

音響認識技術（EFP2Kit WebSDK）を使用したデジタルスタンプラリーのデモンストレーションサイトです。

## 概要

このプロジェクトは、シヤチハタ動物園内で音声を収集するスタンプラリーアプリのデモです。来園者は動物の鳴き声や園内BGMなどの音声を検知してデジタルスタンプを集め、全て集めると30%OFFクーポンがもらえます。

## 技術スタック

- **Framework**: Next.js 15.3.2 (App Router, Static Export)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Backend**: Supabase (認証 + データベース)
- **音響認識**: EFP2Kit WebSDK

## 主な機能

- 音響フィンガープリント技術による音声認識
- リアルタイムスタンプ収集
- プログレストラッキング
- モバイルファーストデザイン
- デスクトップ表示時のiPhoneモックアップ

## 開発環境のセットアップ

```bash
# 依存関係のインストール
npm install

# 開発サーバーの起動（ポート8000）
npm run dev

# プロダクションビルド
npm run build

# リンターの実行
npm run lint
```

## 環境変数

`.env.local`ファイルに以下の環境変数を設定してください：

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## デモ用設定

### テストモード

`src/app/page.tsx`の`TEST_MODE`定数を`true`に設定すると、音声認識なしでスタンプを収集できるテストモードが有効になります。本番環境では必ず`false`に設定してください。

### 音声認識設定

- EFP2Kit CDN URL: `src/hooks/useEFP2.ts`で設定
- API Key: `src/app/page.tsx`で設定
- フィンガープリントデータベースURL: `src/hooks/useEFP2.ts`で設定

## プロジェクト構成

```
src/
├── app/                    # Next.js App Router
│   ├── page.tsx           # メインページ（スタンプ収集）
│   ├── complete/          # 完了ページ（クーポン表示）
│   └── layout.tsx         # ルートレイアウト
├── components/            # Reactコンポーネント
│   └── MobileContainer.tsx # モバイル/デスクトップ表示コンテナ
├── hooks/                 # カスタムフック
│   └── useEFP2.ts        # EFP2Kit音響認識フック
└── lib/                   # ユーティリティ
    ├── stamps.ts          # スタンプ定義
    └── supabase.ts        # Supabaseクライアント

```

## デプロイ

このプロジェクトは静的エクスポート（`output: "export"`）に設定されているため、任意の静的ホスティングサービスにデプロイできます。

```bash
npm run build
# outディレクトリの内容をホスティングサービスにアップロード
```

## ライセンス

このプロジェクトはデモンストレーション目的で作成されています。