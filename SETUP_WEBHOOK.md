# Setup Database Webhook for OneSignal Push Notifications

## The Problem
The Realtime subscription only works when the app is open. For notifications when the app is closed, we need a **Database Webhook** that triggers the Edge Function.

## Step-by-Step Setup

### 1. Go to Supabase Dashboard
- Navigate to **Database** → **Webhooks**
- Click **"Create a new webhook"**

### 2. Configure the Webhook

**Basic Settings:**
- **Name:** `Send Push Notification on Event`
- **Table:** `events`
- **Events:** Select **INSERT** only

**HTTP Request:**
- **URL:** `https://tnixwhvzkfupsjzobzzt.supabase.co/functions/v1/send-push-notification`
- **Method:** `POST`
- **Headers:**
  - `Authorization`: `Bearer YOUR_SERVICE_ROLE_KEY`
    - Get this from: Supabase → Settings → API → `service_role` key (keep this secret!)
  - `Content-Type`: `application/json`

**Request Body (JSON):**
```json
{
  "event_id": "{{ $1.id }}",
  "user_id": "{{ $1.partner_id }}",
  "title": "{{ $1.title }}",
  "event_date": "{{ $1.event_date }}",
  "event_time": "{{ $1.event_time }}",
  "created_by": "{{ $1.created_by }}"
}
```

**Important:** The `user_id` should be `partner_id` because that's who should receive the notification!

### 3. Add Filter (Optional but Recommended)
Only send notifications when:
- `partner_id` is not null (event is shared with a partner)
- `created_by != partner_id` (don't notify the person who created it)

You can add this as a filter in the webhook settings if available.

### 4. Test the Webhook
1. Create a test event with a `partner_id`
2. Check Supabase → Edge Functions → Logs
3. You should see the Edge Function being called
4. Check OneSignal dashboard for sent notifications

## Troubleshooting

### Webhook not triggering?
- Check webhook is enabled
- Verify the URL is correct
- Check the Authorization header has the service_role key
- Look at Supabase → Database → Webhooks → Your webhook → Logs

### Edge Function not receiving data?
- Check Edge Function logs
- Verify the request body format matches what the Edge Function expects

### No notifications sent?
- Check if user has OneSignal player ID saved in database
- Verify OneSignal secrets are set in Edge Function
- Check OneSignal dashboard for delivery status

## Alternative: Check if Webhook Already Exists

If you already have a webhook set up, make sure:
1. It's pointing to the correct Edge Function URL
2. The request body includes `partner_id` as `user_id`
3. It's enabled and not paused

