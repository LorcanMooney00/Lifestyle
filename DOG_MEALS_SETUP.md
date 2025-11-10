# Dog Meal Tracking Setup

## 🎯 What This Does

Enables you and your partner to track which dog meals have been fed today. When you mark a meal as complete, your partner will see it in real-time!

## 📋 Setup Steps

### 1. Run the Database Migration

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Click on "SQL Editor" in the left sidebar
4. Click "New Query"
5. Copy and paste the contents of `supabase/add_dog_meals.sql`
6. Click "Run" or press Cmd/Ctrl + Enter

### 2. Verify the Setup

Run this query to confirm the table was created:

```sql
SELECT * FROM public.dog_meals LIMIT 1;
```

You should see column headers (even if no data yet):
- `id`
- `dog_id`
- `user_id`
- `meal_date`
- `meal_index`
- `completed`
- `completed_at`
- `created_at`

### 3. Test It Out!

1. Refresh your app
2. Go to the Topics page (home/dashboard)
3. Expand a dog card
4. Click the checkboxes next to meals
5. Have your partner check their app - they should see the same meal status!

## 🔧 How It Works

- **Database Table**: `dog_meals` stores which meals were fed on which dates
- **Real-Time Sync**: When you or your partner marks a meal, it saves to the database
- **Daily Reset**: Each day starts fresh (meals are tracked by date)
- **Shared Access**: Both you and your partner can see and update meal status

## 🐛 Troubleshooting

If meals aren't saving:
1. Check browser console for errors (F12 → Console tab)
2. Verify the SQL migration ran successfully
3. Make sure your dogs have a `partner_id` set (shared with partner)

If meals aren't syncing with your partner:
1. Both users should refresh the page
2. Check that the dog has `partner_id` set correctly
3. Verify RLS policies were created (run the SQL again if needed)

## 📝 Technical Details

- **Optimistic Updates**: UI updates immediately, then syncs with database
- **Unique Constraint**: Prevents duplicate entries for same dog/date/meal
- **Auto Cleanup**: Old meal records can be archived/deleted as needed
- **Row Level Security**: Only you and your partner can see your shared dogs' meals

