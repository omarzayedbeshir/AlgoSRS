CREATE TABLE IF NOT EXISTS leetcode_entries (
    id              TEXT            NOT NULL PRIMARY KEY,
    user_id         UUID            NOT NULL REFERENCES auth.users(id),
    title           TEXT            NOT NULL,
    url             TEXT            NOT NULL,
    difficulty      TEXT            NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
    tags            TEXT[]          NOT NULL DEFAULT '{}',
    rating          SMALLINT        NOT NULL CHECK (rating >= 1 AND rating <= 4),
    date            TIMESTAMPTZ     NOT NULL,
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    stability       DOUBLE PRECISION DEFAULT 0,
    difficulty_fsrs DOUBLE PRECISION DEFAULT 0,
    due_date        TIMESTAMPTZ,
    reps            INTEGER         DEFAULT 0,
    lapses          INTEGER         DEFAULT 0,
    fsrs_state      INTEGER         DEFAULT 0,
    last_review_at  TIMESTAMPTZ,
    UNIQUE(user_id, url)
);

CREATE INDEX IF NOT EXISTS idx_entries_user_id ON leetcode_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_entries_updated_at ON leetcode_entries(updated_at);

CREATE TABLE IF NOT EXISTS user_delete_requests (
    user_id    UUID         NOT NULL PRIMARY KEY REFERENCES auth.users(id),
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
