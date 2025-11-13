# Test Edge Function After Deployment

## Test Steps:

1. **Close the app completely on your phone** (swipe it away, don't just minimize)

2. **Test the Edge Function:**
   - Go to Edge Functions → `send_push_notifications` → "Test" or "Invoke"
   - Use this payload (replace with your user_id):
   ```json
   {
     "event_id": "test",
     "user_id": "cc7e55c8-5277-4d35-a1ce-156417b57e46",
     "title": "Test Notification",
     "event_date": "2025-01-15",
     "created_by": "test"
   }
   ```
   - Click "Invoke"

3. **Check the Response:**
   - What does the response say?
   - Should show: `{"message": "Sent X notifications, Y failed", "successful": X, "failed": Y}`

4. **Check the Logs:**
   - Go to Edge Functions → `send_push_notifications` → "Logs" tab
   - Do you see any errors?
   - Look for: "Failed to send to subscription" messages

5. **Check Your Phone:**
   - Did you get a notification?
   - If NO → Check logs for errors
   - If YES → It's working! 🎉

## Common Issues:

### "No subscriptions found for user"
- The user_id doesn't have a push subscription
- Check: `SELECT user_id FROM public.push_subscriptions WHERE user_id = 'cc7e55c8-5277-4d35-a1ce-156417b57e46';`

### "Failed to send to subscription"
- Check logs for the specific error
- Might be VAPID key issue
- Might be invalid subscription

### No response/error
- Check Edge Function secrets are set
- Check logs for runtime errors

## Next: Test with Real Event

Once manual test works:
1. Have someone add an event to your calendar
2. Check Edge Functions → Logs
3. You should see log entries
4. You should get a notification!

