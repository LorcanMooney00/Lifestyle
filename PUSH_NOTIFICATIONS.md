# Push Notifications Setup

## Overview
Push notifications are implemented using OneSignal, which allows notifications to work even when the app is fully closed.

## Architecture
1. **Client**: OneSignal SDK registers device and saves player ID to database
2. **Database Trigger**: Automatically calls Edge Function when events are created
3. **Edge Function**: Sends push notification via OneSignal API
4. **OneSignal**: Delivers notification to user's device

## Setup (Already Complete)

### 1. OneSignal Account
- App ID: `56a8f812-6bb8-49de-a0ce-528ef87d563d`
- REST API Key: Set in Supabase Edge Function secrets

### 2. Database
- `push_subscriptions` table stores OneSignal player IDs
- Database trigger `on_event_created_push` calls Edge Function

### 3. Edge Function
- Function: `send_push_notifications`
- Secrets: `ONESIGNAL_APP_ID`, `ONESIGNAL_REST_API_KEY`

### 4. Client
- OneSignal SDK loaded in `index.html`
- Player IDs saved automatically when user accepts permission

## How It Works

1. User accepts push notification permission
2. OneSignal registers device and gets player ID
3. Player ID saved to `push_subscriptions` table
4. When event is created with `partner_id`:
   - Database trigger fires
   - Edge Function called with event data
   - Edge Function sends notification via OneSignal API
   - User receives notification (even if app is closed)

## Testing

### Test Edge Function Manually
1. Go to **Supabase → Edge Functions → send_push_notifications → Test**
2. Use payload:
   ```json
   {
     "event_id": "test-123",
     "user_id": "USER_ID_HERE",
     "title": "Test Event",
     "event_date": "2025-01-15",
     "created_by": "CREATOR_ID"
   }
   ```

### Test Full Flow
1. Create event with `partner_id` set
2. Check Edge Function logs
3. Partner should receive notification

## Troubleshooting

### No notifications when creating events?
- Check if trigger exists: `SELECT trigger_name FROM information_schema.triggers WHERE trigger_name = 'on_event_created_push';`
- Make sure event has `partner_id` set
- Check Edge Function logs

### Player ID not saved?
- User needs to accept push permission
- Check browser console for OneSignal errors
- Verify `push_subscriptions` table has `onesignal_player_id`

### Edge Function not called?
- Verify trigger exists and is enabled
- Check database logs for trigger errors
- Make sure `pg_net` extension is enabled

