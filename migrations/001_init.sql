CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username varchar(40) NOT NULL UNIQUE,
  email varchar(255) UNIQUE,
  password_hash text NOT NULL,
  display_name varchar(80),
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type varchar(20) NOT NULL DEFAULT 'direct',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conversation_participants (
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_read_message_id uuid,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type varchar(20) NOT NULL DEFAULT 'text',
  body text,
  file_url text,
  file_key text,
  file_name text,
  mime_type text,
  file_size integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz,
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS messages_conversation_created_idx
ON messages (conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS conversation_participants_user_idx
ON conversation_participants (user_id);

CREATE TABLE IF NOT EXISTS direct_conversations (
  conversation_id uuid PRIMARY KEY REFERENCES conversations(id) ON DELETE CASCADE,
  user_low uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_high uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (user_low, user_high)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'conversation_participants_last_read_fk'
  ) THEN
    ALTER TABLE conversation_participants
    ADD CONSTRAINT conversation_participants_last_read_fk
    FOREIGN KEY (last_read_message_id) REFERENCES messages(id)
    DEFERRABLE INITIALLY DEFERRED;
  END IF;
END $$;