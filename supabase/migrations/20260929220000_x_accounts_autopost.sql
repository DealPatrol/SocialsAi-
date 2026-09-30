-- Additive Auto Post support for the NextAuth + tweet_content schema.
-- Safe to run on a project that already applied AUTOMATION_SCHEMA.sql.

create table if not exists x_accounts (
  user_id text primary key,
  x_user_id text,
  username text,
  access_token_enc text not null,
  refresh_token_enc text,
  token_expires_at timestamptz,
  updated_at timestamptz default now()
);

alter table automation_queue add column if not exists posted_tweet_id text;

alter table x_accounts enable row level security;
