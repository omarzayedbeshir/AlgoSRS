CREATE TABLE IF NOT EXISTS leetcode_entries (
    id         TEXT    NOT NULL PRIMARY KEY,
    user_id    UUID   NOT NULL REFERENCES auth.users(id),
    title      TEXT   NOT NULL,
    url        TEXT   NOT NULL,
    difficulty TEXT   NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
    rating     SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 4),
    date       TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, url)
);

CREATE INDEX IF NOT EXISTS idx_entries_user_id ON leetcode_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_entries_updated_at ON leetcode_entries(updated_at);
