-- Push Notifications for Todos, Notes, and Shopping Items
-- This extends the existing push notification system to include todos, notes, and shopping items

-- Step 1: Enable pg_net extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Step 2: Create trigger function for todos
CREATE OR REPLACE FUNCTION notify_push_on_todo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  edge_function_url TEXT := 'https://tnixwhvzkfupsjzobzzt.supabase.co/functions/v1/send_push_notifications';
  service_role_key TEXT := 'NEW_SERVICE_ROLE_KEY_HERE'; -- ⚠️ REPLACE THIS with your service_role key!
  member_record RECORD;
BEGIN
  -- Only send notification if todo has a partner_id or group_id and wasn't created by the recipient
  IF (NEW.partner_id IS NOT NULL AND NEW.user_id != NEW.partner_id) THEN
    -- Call Edge Function via HTTP
    PERFORM
      net.http_post(
        url := edge_function_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || service_role_key
        ),
        body := jsonb_build_object(
          'type', 'todo',
          'todo_id', NEW.id,
          'user_id', NEW.partner_id,
          'content', NEW.content,
          'created_by', NEW.user_id
        )
      );
  ELSIF NEW.group_id IS NOT NULL THEN
    -- For groups, notify all members except the creator
    FOR member_record IN 
      SELECT user_id
      FROM public.group_members 
      WHERE group_id = NEW.group_id AND user_id != NEW.user_id
    LOOP
      -- Call Edge Function via HTTP for each member
      PERFORM
        net.http_post(
          url := edge_function_url,
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || service_role_key
          ),
          body := jsonb_build_object(
            'type', 'todo',
            'todo_id', NEW.id,
            'user_id', member_record.user_id,
            'content', NEW.content,
            'created_by', NEW.user_id
          )
        );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Step 3: Create trigger function for shopping items
CREATE OR REPLACE FUNCTION notify_push_on_shopping_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  edge_function_url TEXT := 'https://tnixwhvzkfupsjzobzzt.supabase.co/functions/v1/send_push_notifications';
  service_role_key TEXT := 'NEW_SERVICE_ROLE_KEY_HERE'; -- ⚠️ REPLACE THIS with your service_role key!
  member_record RECORD;
BEGIN
  -- Only send notification if shopping item has a partner_id and wasn't created by the recipient
  IF (NEW.partner_id IS NOT NULL AND NEW.user_id != NEW.partner_id) THEN
    -- Call Edge Function via HTTP
    PERFORM
      net.http_post(
        url := edge_function_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || service_role_key
        ),
        body := jsonb_build_object(
          'type', 'shopping',
          'shopping_id', NEW.id,
          'user_id', NEW.partner_id,
          'item_name', NEW.item_name,
          'created_by', NEW.user_id
        )
      );
  END IF;
  
  -- For groups, notify all members except the creator
  -- Note: This assumes group_id column exists. If it doesn't, add it via migration first.
  IF NEW.group_id IS NOT NULL THEN
    FOR member_record IN 
      SELECT user_id
      FROM public.group_members 
      WHERE group_id = NEW.group_id AND user_id != NEW.user_id
    LOOP
      -- Call Edge Function via HTTP for each member
      PERFORM
        net.http_post(
          url := edge_function_url,
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || service_role_key
          ),
          body := jsonb_build_object(
            'type', 'shopping',
            'shopping_id', NEW.id,
            'user_id', member_record.user_id,
            'item_name', NEW.item_name,
            'created_by', NEW.user_id
          )
        );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Step 4: Create trigger function for notes
-- Notes are shared through topics, so we need to check topic members and owner
CREATE OR REPLACE FUNCTION notify_push_on_note()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  edge_function_url TEXT := 'https://tnixwhvzkfupsjzobzzt.supabase.co/functions/v1/send_push_notifications';
  service_role_key TEXT := 'NEW_SERVICE_ROLE_KEY_HERE'; -- ⚠️ REPLACE THIS with your service_role key!
  member_record RECORD;
  topic_owner_id UUID;
BEGIN
  
  -- Get topic owner
  SELECT owner_id INTO topic_owner_id
  FROM public.topics
  WHERE id = NEW.topic_id;
  
  -- Notify topic owner if different from creator
  IF topic_owner_id IS NOT NULL AND topic_owner_id != NEW.created_by THEN
    PERFORM
      net.http_post(
        url := edge_function_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || service_role_key
        ),
        body := jsonb_build_object(
          'type', 'note',
          'note_id', NEW.id,
          'user_id', topic_owner_id,
          'title', COALESCE(NEW.title, 'New Note'),
          'created_by', NEW.created_by
        )
      );
  END IF;
  
  -- Get topic members (excluding the creator and owner)
  FOR member_record IN 
    SELECT tm.user_id
    FROM public.topic_members tm
    WHERE tm.topic_id = NEW.topic_id 
      AND tm.user_id != NEW.created_by
      AND (topic_owner_id IS NULL OR tm.user_id != topic_owner_id)
  LOOP
    -- Call Edge Function via HTTP for each member
    PERFORM
      net.http_post(
        url := edge_function_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || service_role_key
        ),
        body := jsonb_build_object(
          'type', 'note',
          'note_id', NEW.id,
          'user_id', member_record.user_id,
          'title', COALESCE(NEW.title, 'New Note'),
          'created_by', NEW.created_by
        )
      );
  END LOOP;
  
  -- If note has group_id, notify group members
  -- Note: This assumes group_id column exists. If it doesn't, add it via migration first.
  IF NEW.group_id IS NOT NULL THEN
    FOR member_record IN 
      SELECT user_id
      FROM public.group_members 
      WHERE group_id = NEW.group_id AND user_id != NEW.created_by
    LOOP
      PERFORM
        net.http_post(
          url := edge_function_url,
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || service_role_key
          ),
          body := jsonb_build_object(
            'type', 'note',
            'note_id', NEW.id,
            'user_id', member_record.user_id,
            'title', COALESCE(NEW.title, 'New Note'),
            'created_by', NEW.created_by
          )
        );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Step 5: Create triggers
DROP TRIGGER IF EXISTS on_todo_created_push ON public.todos;
CREATE TRIGGER on_todo_created_push
  AFTER INSERT ON public.todos
  FOR EACH ROW
  EXECUTE FUNCTION notify_push_on_todo();

DROP TRIGGER IF EXISTS on_shopping_item_created_push ON public.shopping_list_items;
CREATE TRIGGER on_shopping_item_created_push
  AFTER INSERT ON public.shopping_list_items
  FOR EACH ROW
  EXECUTE FUNCTION notify_push_on_shopping_item();

DROP TRIGGER IF EXISTS on_note_created_push ON public.notes;
CREATE TRIGGER on_note_created_push
  AFTER INSERT ON public.notes
  FOR EACH ROW
  EXECUTE FUNCTION notify_push_on_note();

-- Step 6: Verify triggers were created
SELECT 
  trigger_name, 
  event_manipulation, 
  event_object_table 
FROM information_schema.triggers 
WHERE trigger_name IN ('on_todo_created_push', 'on_shopping_item_created_push', 'on_note_created_push')
ORDER BY trigger_name;

