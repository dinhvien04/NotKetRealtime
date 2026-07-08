-- AI chat sessions & messages
CREATE TABLE IF NOT EXISTS ai_chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
  role varchar(20) NOT NULL,
  content text NOT NULL,
  provider varchar(40),
  model varchar(80),
  tokens_input integer,
  tokens_output integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_chat_sessions_user_updated_idx
  ON ai_chat_sessions (user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS ai_messages_session_created_idx
  ON ai_messages (session_id, created_at ASC);

-- Attachments table (metadata for uploads)
CREATE TABLE IF NOT EXISTS attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid REFERENCES messages(id) ON DELETE SET NULL,
  uploader_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  storage_provider varchar(30) NOT NULL DEFAULT 's3',
  bucket text NOT NULL,
  file_key text NOT NULL UNIQUE,
  file_url text,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  file_size integer NOT NULL,
  kind varchar(20) NOT NULL,
  duration_ms integer,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS attachments_file_key_idx ON attachments (file_key);
CREATE INDEX IF NOT EXISTS attachments_uploader_created_idx ON attachments (uploader_id, created_at DESC);