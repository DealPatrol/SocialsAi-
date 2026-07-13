# Automation Setup Guide

This guide walks you through setting up scheduled Twitter posting and AI-drafted reply
suggestions.

Automated following, liking, and DMing of strangers is **not** part of this app: it
risks Twitter/X spam enforcement and account suspension, and undisclosed bot activity
violates X's platform rules. Instead, growth automation here is limited to:

- **Auto Post** — posts tweets *you* wrote/generated, from a queue you control.
- **Reply Suggestions** — Claude reads public tweets from accounts in your niche and
  drafts a reply. It is only ever saved as a draft. You review, optionally edit, and
  explicitly click "Post Reply" — nothing is posted, followed, or DMed on its own.

## Phase 1: Database Setup (Required First)

### 1. Run the SQL Schema in Supabase

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the entire contents of `AUTOMATION_SCHEMA.sql` from this project
4. Paste into Supabase SQL Editor
5. Click **Run**

This creates:
- `automation_queue` - Stores tweets waiting to be posted
- `automation_settings` - User preferences (auto-post interval, reply suggestions on/off)
- `reply_suggestions` - AI-drafted replies awaiting your review

The script is safe to re-run on a project that already has an older version of this
schema — it drops the old `engagement_history` / `target_accounts` / `dm_templates`
tables and the auto-follow/like/DM settings columns.

## Phase 2: Environment Variables

Add these to your Vercel project settings:

### Required for Auth
```
TWITTER_CLIENT_ID=your_oauth2_client_id
TWITTER_CLIENT_SECRET=your_oauth2_client_secret
NEXTAUTH_SECRET=run_openssl_rand_-base64_32
NEXTAUTH_URL=https://yourdomain.vercel.app
```

### Required for Supabase
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_key_here
SUPABASE_SERVICE_ROLE_KEY=sb_service_role_key_here
```

### Required for Cron Jobs
```
CRON_SECRET=create_a_random_secret_string
TWITTER_OAUTH_ACCESS_TOKEN=app_level_token_with_tweet.read_and_users.read_scopes
```

`TWITTER_OAUTH_ACCESS_TOKEN` is used only for read-only lookups (resolving a target
account's handle and fetching their recent public tweets) so Claude has real context
to draft a suggestion from. It is never used to post, follow, like, or DM.

## Phase 3: Configure Twitter Developer Portal

1. Go to your app in **Twitter Developer Portal**
2. Click **Settings** → **User authentication settings**
3. Confirm **App permissions** = **"Read and write"** with scopes:
   - `tweet.read`
   - `tweet.write`
   - `users.read`
   - `offline.access`
4. Add **Callback URLs**:
   ```
   https://yourdomain.vercel.app/api/auth/callback/twitter
   ```

## Phase 4: Test the Flow

### Step 1: User Logs In
1. Deploy the app to Vercel
2. Click "Login with Twitter" button
3. Authorize the app to post on your behalf

### Step 2: Generate & Post a Tweet
1. Go to "Generate Posts" tab
2. Create a tweet using the generator
3. Click "Post" to publish it immediately with your account

### Step 3: Enable Automation Settings
1. Go to "Automation Settings" tab
2. Toggle on Auto Post and/or Reply Suggestions as desired
3. Adjust the post interval / max suggestions per day
4. Click "Save Settings"

### Step 4: Test the Post-Tweets Cron (Auto Post)
```bash
curl -X POST https://yourdomain.vercel.app/api/cron/post-tweets \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```
**Expected result**: Any queued tweets change status from "pending" → "posted".

### Step 5: Test the Suggestions Cron
```bash
curl -X POST https://yourdomain.vercel.app/api/cron/engagement \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```
**Expected result**: New rows appear in `reply_suggestions` with `status = 'pending'`.
Nothing is posted by this call — go to the "Reply Suggestions" tab to review them.

### Step 6: Review and Post a Suggestion
1. Go to "Reply Suggestions" tab
2. Read the target tweet and the drafted reply, edit if you want
3. Click "Post Reply" to publish it as a reply with your own account, or "Dismiss"
   to discard it

## How It Works

### Posting Flow
1. **Generation**: You or Claude generate tweets
2. **Posting**: Click "Post" to publish immediately, or add to the queue for the
   Auto Post cron (runs every 3 hours by default) to publish on schedule

### Reply Suggestions Flow
1. **Drafting**: The suggestions cron (runs every 6 hours by default) reads a few
   recent public tweets from accounts in your niche (`src/lib/strategy.ts`) and asks
   Claude to draft one reply per tweet
2. **Review**: Suggestions appear in the "Reply Suggestions" tab with the original
   tweet for context
3. **Approval**: You edit and post, or dismiss — only your explicit action publishes
   anything

## Monitoring & Troubleshooting

### Check Queue Status
```bash
curl https://yourdomain.vercel.app/api/automation/queue \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"
```

### Check Settings
```bash
curl https://yourdomain.vercel.app/api/automation/settings \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"
```

### Common Issues

**Issue**: Tweets not posting
- Check `automation_queue` table - are tweets in "pending" status?
- Verify `CRON_SECRET` env var is set correctly
- Check Twitter API credentials are valid
- Look for error messages in `error_message` column

**Issue**: No reply suggestions appearing
- Make sure `suggestions_enabled` is TRUE in your settings
- Verify `TWITTER_OAUTH_ACCESS_TOKEN` is set and has `tweet.read`/`users.read` scopes
- Check you haven't hit `max_suggestions_per_day`

**Issue**: Auth session expired
- User needs to log in again
- Twitter access tokens are stored in NextAuth session
- Refresh token handling is automatic

## Advanced: Custom Configuration

### Slow Down Posting
Edit `vercel.json` cron schedule:
```json
{
  "crons": [
    {
      "path": "/api/cron/post-tweets",
      "schedule": "0 0 * * *"
    }
  ]
}
```

### Change Target Accounts for Reply Suggestions
Edit `TARGET_ACCOUNTS` in `src/lib/strategy.ts`.

## Support

If something isn't working:
1. Check Vercel deployment logs
2. Check Supabase SQL editor for table data
3. Verify all environment variables are set
4. Test cron endpoints manually with curl
5. Check Twitter Developer Portal for rate limit info
