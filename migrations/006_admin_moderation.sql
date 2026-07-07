CREATE TABLE IF NOT EXISTS bad_words (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  word varchar(80) NOT NULL,
  severity varchar(20) NOT NULL DEFAULT 'low',
  replacement varchar(40) NOT NULL DEFAULT '***',
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS bad_words_word_unique_idx
ON bad_words (lower(word));

CREATE INDEX IF NOT EXISTS bad_words_severity_idx
ON bad_words (severity);

ALTER TABLE messages ADD COLUMN IF NOT EXISTS was_filtered boolean NOT NULL DEFAULT false;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS filter_hits text[];