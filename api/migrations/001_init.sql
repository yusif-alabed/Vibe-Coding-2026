-- Beaver Banff — initial schema
-- Accounts, profiles, friendships, currencies, inventory, rooms, reports and moderation.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      VARCHAR(16) NOT NULL UNIQUE,
  password_hash TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at  TIMESTAMPTZ,
  is_banned     BOOLEAN     NOT NULL DEFAULT FALSE,
  role          TEXT        NOT NULL DEFAULT 'player' CHECK (role IN ('player', 'moderator', 'admin'))
);

CREATE TABLE profiles (
  user_id      UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name VARCHAR(16) NOT NULL,
  fur_color    CHAR(7)     NOT NULL DEFAULT '#8a5a3b',
  equipped     JSONB       NOT NULL DEFAULT '{}'::jsonb, -- { hat, scarf, backpack, trail }
  bio          VARCHAR(140) NOT NULL DEFAULT '',
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per direction-independent pair; requester/addressee kept for pending requests.
CREATE TABLE friendships (
  requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (requester_id, addressee_id),
  CHECK (requester_id <> addressee_id)
);
CREATE INDEX friendships_addressee_idx ON friendships (addressee_id);

CREATE TABLE blocks (
  blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id)
);

-- Balances per currency (only 'coins' for now). Changes only through currency_ledger.
CREATE TABLE currencies (
  user_id  UUID   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  currency TEXT   NOT NULL DEFAULT 'coins',
  balance  BIGINT NOT NULL DEFAULT 0 CHECK (balance >= 0),
  PRIMARY KEY (user_id, currency)
);

-- Append-only record of every coin change (race rewards, purchases) for audits and anti-cheat.
CREATE TABLE currency_ledger (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  currency   TEXT   NOT NULL DEFAULT 'coins',
  delta      BIGINT NOT NULL,
  reason     TEXT   NOT NULL, -- 'race_reward', 'purchase', 'starting_grant', 'admin_adjust'
  ref        TEXT,            -- race id or item id
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX currency_ledger_user_idx ON currency_ledger (user_id, created_at DESC);

CREATE TABLE cosmetic_items (
  id    TEXT PRIMARY KEY,
  name  TEXT NOT NULL,
  slot  TEXT NOT NULL CHECK (slot IN ('hat', 'scarf', 'backpack', 'trail', 'emote', 'decoration')),
  price INTEGER NOT NULL CHECK (price >= 0),
  data  JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE inventory (
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id     TEXT NOT NULL REFERENCES cosmetic_items(id),
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_id)
);

CREATE TABLE rooms (
  id          TEXT PRIMARY KEY,           -- e.g. village-1, cabin-K7QPM, race-…
  kind        TEXT NOT NULL CHECK (kind IN ('hub', 'race')),
  is_private  BOOLEAN NOT NULL DEFAULT FALSE,
  invite_code VARCHAR(8) UNIQUE,
  owner_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at   TIMESTAMPTZ
);

CREATE TABLE match_results (
  id         BIGSERIAL PRIMARY KEY,
  room_id    TEXT NOT NULL,
  user_id    UUID REFERENCES users(id) ON DELETE SET NULL, -- NULL for bots
  place      SMALLINT NOT NULL,
  finished   BOOLEAN  NOT NULL,
  time_s     NUMERIC(7,2),
  coins      INTEGER  NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE player_reports (
  id          BIGSERIAL PRIMARY KEY,
  reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reported_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  room_id     TEXT,
  reason      TEXT NOT NULL,
  chat_excerpt TEXT,
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'actioned', 'dismissed')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX player_reports_status_idx ON player_reports (status, created_at);

CREATE TABLE moderation_actions (
  id           BIGSERIAL PRIMARY KEY,
  moderator_id UUID REFERENCES users(id) ON DELETE SET NULL, -- NULL = automatic (filter, rate limit)
  target_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action       TEXT NOT NULL CHECK (action IN ('warn', 'mute', 'kick', 'ban', 'unban', 'chat_filtered', 'rate_limited')),
  report_id    BIGINT REFERENCES player_reports(id) ON DELETE SET NULL,
  reason       TEXT,
  expires_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX moderation_actions_target_idx ON moderation_actions (target_id, created_at DESC);

CREATE TABLE schema_migrations (
  version    TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
