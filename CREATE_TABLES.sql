-- Supabaseで実行するSQL
-- user_stampsテーブルの作成（このテーブルのみ使用）

-- 既存のテーブルがある場合は削除（必要に応じて）
-- DROP TABLE IF EXISTS user_stamps;

-- user_stampsテーブルの作成
CREATE TABLE IF NOT EXISTS user_stamps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stamps INTEGER[] DEFAULT '{}',
  is_completed BOOLEAN DEFAULT false,
  is_redeemed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Row Level Security (RLS) を有効化
ALTER TABLE user_stamps ENABLE ROW LEVEL SECURITY;

-- ユーザーは自分のデータのみアクセス可能
CREATE POLICY "Users can view own stamps" ON user_stamps
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own stamps" ON user_stamps
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own stamps" ON user_stamps
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own stamps" ON user_stamps
  FOR DELETE USING (auth.uid() = user_id);

-- 更新時にupdated_atを自動更新するトリガー
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_stamps_updated_at BEFORE UPDATE
  ON user_stamps FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();