-- ============================================================
-- Supabase DB Trigger: auto-create public.users row on signup
-- ============================================================
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor).
--
-- When a new user signs up (email/password or OAuth), Supabase
-- inserts a row into auth.users. This trigger automatically
-- creates the matching row in public.users along with default
-- preference rows so the backend doesn't have to.
-- ============================================================

-- 1. Create the trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert into public.users
  INSERT INTO public.users (id, email, name, avatar_url, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'name', NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', NEW.raw_user_meta_data ->> 'picture'),
    NOW(),
    NOW()
  );

  -- Create default user preferences
  INSERT INTO public.user_preferences (user_id)
  VALUES (NEW.id);

  -- Create default notification preferences
  INSERT INTO public.notification_preferences (user_id)
  VALUES (NEW.id);

  RETURN NEW;
END;
$$;

-- 2. Create the trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 3. (Optional) Grant necessary permissions
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT INSERT ON public.users TO supabase_auth_admin;
GRANT INSERT ON public.user_preferences TO supabase_auth_admin;
GRANT INSERT ON public.notification_preferences TO supabase_auth_admin;
