-- Fix the trigger function to use SECURITY DEFINER so it can bypass RLS
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create/update conversations for direct messages (not group)
  IF NEW.receiver_id IS NOT NULL AND NEW.conversation_id IS NULL THEN
    INSERT INTO public.conversations (user1_id, user2_id, last_message_at)
    VALUES (
      LEAST(NEW.sender_id, NEW.receiver_id),
      GREATEST(NEW.sender_id, NEW.receiver_id),
      NOW()
    )
    ON CONFLICT (user1_id, user2_id)
    DO UPDATE SET last_message_at = NOW();
  END IF;
  
  -- Update group conversation timestamp if conversation_id is set
  IF NEW.conversation_id IS NOT NULL THEN
    UPDATE public.conversations
    SET last_message_at = NOW()
    WHERE id = NEW.conversation_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure INSERT policy exists for conversations (for direct messages)
DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;
CREATE POLICY "Users can create conversations" ON public.conversations
  FOR INSERT TO authenticated
  WITH CHECK (
    -- Direct conversations: user is one of the participants
    (is_group = false AND (user1_id = auth.uid() OR user2_id = auth.uid())) OR
    -- Group conversations: user is creator (handled by trigger)
    (is_group = true AND created_by = auth.uid())
  );

-- Ensure UPDATE policy exists for conversations
DROP POLICY IF EXISTS "Users can update conversations" ON public.conversations;
CREATE POLICY "Users can update conversations" ON public.conversations
  FOR UPDATE TO authenticated
  USING (
    -- Direct conversations: user is participant
    (is_group = false AND (user1_id = auth.uid() OR user2_id = auth.uid())) OR
    -- Group conversations: user is participant
    (is_group = true AND id IN (
      SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid()
    ))
  );

