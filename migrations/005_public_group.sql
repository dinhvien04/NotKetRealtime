ALTER TABLE conversations ADD COLUMN IF NOT EXISTS name varchar(120);
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS slug varchar(80);

ALTER TABLE conversation_participants ADD COLUMN IF NOT EXISTS role varchar(20) NOT NULL DEFAULT 'member';

CREATE UNIQUE INDEX IF NOT EXISTS conversations_slug_unique_idx
ON conversations (slug)
WHERE slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS conversations_type_updated_idx
ON conversations (type, updated_at DESC);

INSERT INTO conversations (type, name, slug)
SELECT 'public', 'Phòng trò chuyện', 'public-main'
WHERE NOT EXISTS (
  SELECT 1 FROM conversations WHERE type = 'public' AND slug = 'public-main'
);