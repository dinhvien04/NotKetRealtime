CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS document_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type varchar(20) NOT NULL CHECK (type IN ('text', 'image', 'file')),
  body text,
  file_key text,
  file_name text,
  mime_type text,
  file_size integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS document_messages_created_idx
ON document_messages (created_at DESC);

CREATE INDEX IF NOT EXISTS document_messages_type_created_idx
ON document_messages (type, created_at DESC);

CREATE INDEX IF NOT EXISTS document_messages_file_key_idx
ON document_messages (file_key);

CREATE TABLE IF NOT EXISTS document_uploads (
  file_key text PRIMARY KEY,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  file_size integer NOT NULL,
  kind varchar(20) NOT NULL CHECK (kind IN ('image', 'file')),
  status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'consumed', 'expired')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  consumed_at timestamptz
);

CREATE INDEX IF NOT EXISTS document_uploads_status_expires_idx
ON document_uploads (status, expires_at);
