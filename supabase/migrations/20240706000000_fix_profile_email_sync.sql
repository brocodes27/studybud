-- Fix profile email synchronization
-- This migration improves the email sync between auth.users and user_profiles

-- Drop the existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
DROP FUNCTION IF EXISTS public.handle_user_update() CASCADE;
-- Create an improved function that handles email updates more reliably
CREATE OR REPLACE FUNCTION public.handle_user_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Update user_profiles with the new email
  UPDATE public.user_profiles
  SET 
    email = NEW.email,
    updated_at = NOW()
  WHERE id = NEW.id;
  
  -- If no rows were updated, the profile might not exist, so create it
  IF NOT FOUND THEN
    INSERT INTO public.user_profiles (id, email, updated_at)
    VALUES (NEW.id, NEW.email, NOW())
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      updated_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Recreate the trigger
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_user_update();
-- Create a function to sync all existing user emails
CREATE OR REPLACE FUNCTION public.sync_all_user_emails()
RETURNS void AS $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN 
    SELECT id, email FROM auth.users WHERE email IS NOT NULL
  LOOP
    INSERT INTO public.user_profiles (id, email, updated_at)
    VALUES (user_record.id, user_record.email, NOW())
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      updated_at = NOW();
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Run the sync function to update all existing profiles
SELECT public.sync_all_user_emails();
-- Drop the sync function as it's no longer needed
DROP FUNCTION IF EXISTS public.sync_all_user_emails();
