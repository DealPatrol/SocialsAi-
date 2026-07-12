# Full Twitter Automation Setup Guide

This guide walks you through setting up fully automated Twitter posting, following, liking, and DM functionality.

## Phase 1: Database Setup (Required First)

### 1. Run the SQL Schema in Supabase

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the entire contents of `AUTOMATION_SCHEMA.sql` from this project
4. Paste into Supabase SQL Editor
5. Click **Run** to create all tables

This creates:
- `automation_queue` - Stores tweets waiting to be posted
- `engagement_history` - Tracks follows, likes, DMs to prevent duplicates
- `automation_settings` - User preferences for rate limits
- `target_accounts` - Accounts to follow/like from
- `dm_templates` - Personalized DM message templates

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
```

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
4. Session is created with your access tokens

### Step 2: Generate & Queue a Tweet
1. Go to "Generate Posts" tab
2. Create a tweet using the generator
3. Click "Post" to add to automation queue

**What happens**: Tweet is added to `automation_queue` table with status "pending"

### Step 3: Test Cron Job (Posting)
Option A - Manual Test:
```bash
curl -X POST https://yourdomain.vercel.app/api/cron/post-tweets \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Option B - Wait for scheduled run (every 3 hours by default)

**Expected result**: Tweet status changes from "pending" → "posted", tweet appears on your account

### Step 4: Enable Automation Settings
1. Go to "Automation Settings" tab
2. Toggle on:
   - ✓ Auto Post
   - ✓ Auto Follow
   - ✓ Auto Like
   - ✓ Auto DM (optional - requires DM template)
3. Adjust rate limits as desired
4. Click "Save Settings"

### Step 5: Test Engagement Cron (Follows/Likes/DMs)
```bash
curl -X POST https://yourdomain.vercel.app/api/cron/engagement \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**Expected result**: Random actions taken (follows, likes, or DMs) to target accounts

## How It Works

### Posting Flow
1. **Generation**: You or Claude generate tweets
2. **Queueing**: Clicked "Post" adds tweet to queue
3. **Automation**: Cron job runs every 3 hours, posts pending tweets
4. **Verification**: Tweet status updates in database

### Engagement Flow
1. **Configuration**: User sets target accounts and enables automation
2. **Scheduling**: Cron job runs every 6 hours
3. **Conservative Actions**: 
   - Max 1-2 follows/day (with 2-3 day delay)
   - Max 2-3 likes/day (spread throughout day)
   - Max 1-2 DMs/day (with 24-48h delay)
4. **No Disclosure**: All actions appear native/human-like (no bot indicators)

### Rate Limiting & Safety

**Automatic Conservative Limits**:
- Post interval: Every 2-4 hours (configurable)
- Follows: Max 1-2/day with 2-3 day delay
- Likes: Max 2-3/day with random timing
- DMs: Max 1-2/day with 24-48 hour delay

**Random Delays**: All actions have random 2-10 second delays to avoid pattern detection

**No Bot Markers**: 
- No "#AutomatedPost" hashtags
- No "Sent from SocialsAI" attribution
- No bot account indicators
- Posts appear as native user activity

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

**Issue**: Engagement (follows/likes) not working
- Make sure `auto_follow_enabled`, `auto_like_enabled` are TRUE in settings
- Add target accounts to `target_accounts` table
- Verify Twitter scopes include `users.read`
- Check `engagement_history` table for duplicate actions

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
      "schedule": "0 0 * * *"  // Once per day at midnight
    }
  ]
}
```

### Add Custom DM Template
Insert into `dm_templates` table:
```sql
INSERT INTO dm_templates (user_id, template) VALUES (
  'your-user-id',
  'Hey {name}! 👋 Love your work on {bio}. Let's connect!'
);
```

Placeholders available:
- `{name}` - User's display name
- `{handle}` - @username
- `{bio}` - User's bio/description
- `{followers}` - Follower count

## Verifying It's Working

After setup is complete, you should see:
1. ✅ Tweets appear on your account at randomized intervals
2. ✅ New follows/likes on your account (conservative rate)
3. ✅ DMs sent to target accounts with personalized messages
4. ✅ No bot indicators or disclosure messages
5. ✅ All activity appears human-generated

## Support

If something isn't working:
1. Check Vercel deployment logs
2. Check Supabase SQL editor for table data
3. Verify all environment variables are set
4. Test cron endpoints manually with curl
5. Check Twitter Developer Portal for rate limit info
