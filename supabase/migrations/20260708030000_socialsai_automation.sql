-- SocialsAI automation schema.
-- Server routes use a Postgres connection string; RLS is enabled so exposed
-- Supabase Data API access remains locked down unless explicit policies are added.

create table if not exists users (
  id text primary key,
  email text not null unique,
  password_hash text,
  name text,
  x_user_id text unique,
  website_url text,
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists auth_codes (
  code text primary key,
  user_id text not null references users(id) on delete cascade,
  expires_at timestamptz not null
);

create table if not exists social_accounts (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  platform text not null,
  platform_user_id text not null,
  username text not null,
  display_name text,
  access_token_enc text not null,
  refresh_token_enc text,
  token_expires_at timestamptz,
  automation_enabled boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists automation_queue (
  id text primary key,
  account_id text not null references social_accounts(id) on delete cascade,
  type text not null,
  status text not null default 'pending',
  payload text not null,
  engagement_score integer,
  compliance_notes text,
  scheduled_at timestamptz,
  executed_at timestamptz,
  error_message text,
  created_at timestamptz not null default now()
);

create table if not exists dm_templates (
  id text primary key,
  account_id text not null references social_accounts(id) on delete cascade,
  name text not null,
  template text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists automation_settings (
  id text primary key,
  account_id text not null unique references social_accounts(id) on delete cascade,
  mode text not null default 'draft',
  growth_preset text not null default 'safe',
  replies_enabled boolean not null default true,
  thread_replies_enabled boolean not null default true,
  follows_enabled boolean not null default true,
  posts_enabled boolean not null default true,
  dms_enabled boolean not null default false,
  likes_enabled boolean not null default true,
  max_replies_per_day integer not null default 20,
  max_follows_per_day integer not null default 12,
  max_posts_per_day integer not null default 4,
  max_dms_per_day integer not null default 3,
  max_likes_per_day integer not null default 3,
  min_minutes_between_actions integer not null default 10,
  tone_mix text not null default '["informative","funny","serious","empathetic"]',
  product_context text,
  website_url text,
  target_keywords text not null default '["indie hacker","saas founder","build in public","side project","bootstrap"]',
  target_accounts text not null default '[]',
  posting_windows text not null default '[]',
  dm_template_id text references dm_templates(id) on delete set null,
  require_approval boolean not null default true,
  disclose_automation boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists posted_tweets (
  id text primary key,
  account_id text not null references social_accounts(id) on delete cascade,
  queue_id text references automation_queue(id) on delete set null,
  tweet_id text not null unique,
  text text not null,
  post_type text not null default 'post',
  posted_at timestamptz not null default now(),
  metrics jsonb,
  created_at timestamptz not null default now()
);

create table if not exists engagement_tracking (
  id text primary key,
  account_id text not null references social_accounts(id) on delete cascade,
  target_user_id text,
  target_username text,
  target_tweet_id text,
  action text not null,
  status text not null default 'executed',
  reason text,
  scheduled_at timestamptz,
  executed_at timestamptz,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists engagement_logs (
  id text primary key,
  account_id text not null references social_accounts(id) on delete cascade,
  action text not null,
  external_id text,
  metadata text,
  created_at timestamptz not null default now()
);

create unique index if not exists engagement_tracking_dedupe_idx
  on engagement_tracking (
    account_id,
    action,
    coalesce(target_user_id, ''),
    coalesce(target_tweet_id, '')
  );

alter table users enable row level security;
alter table auth_codes enable row level security;
alter table social_accounts enable row level security;
alter table automation_settings enable row level security;
alter table automation_queue enable row level security;
alter table posted_tweets enable row level security;
alter table engagement_tracking enable row level security;
alter table dm_templates enable row level security;
alter table engagement_logs enable row level security;
