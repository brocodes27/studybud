-- Function to create a class and generate a unique code
CREATE OR REPLACE FUNCTION create_class(class_name TEXT)
RETURNS TABLE(id UUID, class_code TEXT) AS $$
DECLARE
    new_class_id UUID;
    new_class_code TEXT;
BEGIN
    -- Generate a unique 6-character code
    LOOP
        new_class_code := (
            SELECT string_agg(substr('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', floor(random() * 36 + 1)::int, 1), '')
            FROM generate_series(1, 6)
        );
        -- Ensure the code is unique
        IF NOT EXISTS (SELECT 1 FROM classes WHERE classes.class_code = new_class_code) THEN
            EXIT;
        END IF;
    END LOOP;

    -- Insert the new class
    INSERT INTO classes (teacher_id, class_name, class_code)
    VALUES (auth.uid(), class_name, new_class_code)
    RETURNING classes.id INTO new_class_id;

    RETURN QUERY SELECT new_class_id, new_class_code;
END;
$$ LANGUAGE plpgsql;

-- Replace the join_class function to use class_id instead of class_code
CREATE OR REPLACE FUNCTION join_class(class_id uuid)
RETURNS void AS $$
BEGIN
  INSERT INTO class_members (class_id, user_id)
  VALUES (class_id, auth.uid())
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 