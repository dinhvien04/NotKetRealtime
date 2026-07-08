ALTER TABLE message_reactions
ADD COLUMN IF NOT EXISTS reaction_type varchar(20) NOT NULL DEFAULT 'emoji';

ALTER TABLE message_reactions
ADD COLUMN IF NOT EXISTS value varchar(120);

ALTER TABLE message_reactions
ADD COLUMN IF NOT EXISTS color varchar(20);

UPDATE message_reactions
SET value = emoji
WHERE value IS NULL AND emoji IS NOT NULL;

ALTER TABLE message_reactions
ALTER COLUMN value SET NOT NULL;

ALTER TABLE message_reactions
DROP CONSTRAINT IF EXISTS message_reactions_pkey;

ALTER TABLE message_reactions
ADD CONSTRAINT message_reactions_pkey
PRIMARY KEY (message_id, user_id, reaction_type, value);

ALTER TABLE message_reactions
DROP CONSTRAINT IF EXISTS message_reactions_type_check;

ALTER TABLE message_reactions
ADD CONSTRAINT message_reactions_type_check
CHECK (reaction_type IN ('emoji', 'icon'));

CREATE UNIQUE INDEX IF NOT EXISTS message_reactions_unique_idx
ON message_reactions (message_id, user_id, reaction_type, value);

ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS icon_name varchar(120);

ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS icon_color varchar(20);

UPDATE conversations
SET icon_name = 'lucide:globe-2',
    icon_color = '#22c55e'
WHERE type = 'public' AND icon_name IS NULL;

CREATE TABLE IF NOT EXISTS user_recent_icons (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  icon_name varchar(120) NOT NULL,
  icon_color varchar(20),
  used_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, icon_name)
);

CREATE INDEX IF NOT EXISTS user_recent_icons_user_used_idx
ON user_recent_icons (user_id, used_at DESC);