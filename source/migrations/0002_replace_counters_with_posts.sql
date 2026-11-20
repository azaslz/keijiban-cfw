-- カウンターのサンプルを廃止し、掲示板の投稿テーブルに置き換える。
DROP TABLE IF EXISTS counters;

CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL DEFAULT '名無し' CHECK (length(name) BETWEEN 1 AND 50),
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 1000),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts (created_at DESC, id DESC);
