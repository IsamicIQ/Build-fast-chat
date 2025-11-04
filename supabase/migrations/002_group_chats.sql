-- Update conversations table to support group chats
ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_user1_id_user2_id_key;
ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_check;

-- Add group chat fields
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS is_group BOOLEAN DEFAULT false;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS group_name TEXT;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS group_avatar TEXT;

-- Update conversations table to allow NULL for user2_id (for group chats)
ALTER TABLE public.conversations ALTER COLUMN user2_id DROP NOT NULL;

-- Add RLS policy for group chats
DROP POLICY IF EXISTS "Users can view group conversations" ON public.conversations;
CREATE POLICY "Users can view group conversations" ON public.conversations
  FOR SELECT USING (
    is_group = true AND id IN (
      SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid()
    )
  );

-- Update conversation_participants with better policies
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their participations" ON public.conversation_participants;
CREATE POLICY "Users can view their participations" ON public.conversation_participants
  FOR SELECT USING (
    user_id = auth.uid() OR 
    conversation_id IN (
      SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can add participants to their groups" ON public.conversation_participants;
CREATE POLICY "Users can add participants to their groups" ON public.conversation_participants
  FOR INSERT WITH CHECK (
    conversation_id IN (
      SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can remove participants from their groups" ON public.conversation_participants;
CREATE POLICY "Users can remove participants from their groups" ON public.conversation_participants
  FOR DELETE USING (
    conversation_id IN (
      SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid()
    )
  );

-- Update messages to work with conversation_id for group chats
DROP POLICY IF EXISTS "Users can view group messages" ON public.messages;
CREATE POLICY "Users can view group messages" ON public.messages
  FOR SELECT USING (
    conversation_id IN (
      SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can send group messages" ON public.messages;
CREATE POLICY "Users can send group messages" ON public.messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND
    conversation_id IN (
      SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid()
    )
  );

-- Function to create a group conversation
CREATE OR REPLACE FUNCTION create_group_conversation(
  p_group_name TEXT,
  p_creator_id UUID,
  p_member_ids UUID[]
)
RETURNS UUID AS $$
DECLARE
  v_conversation_id UUID;
  v_member_id UUID;
BEGIN
  -- Create the group conversation
  INSERT INTO public.conversations (is_group, group_name, created_by, user1_id)
  VALUES (true, p_group_name, p_creator_id, p_creator_id)
  RETURNING id INTO v_conversation_id;
  
  -- Add creator as participant
  INSERT INTO public.conversation_participants (conversation_id, user_id)
  VALUES (v_conversation_id, p_creator_id);
  
  -- Add all members as participants
  FOREACH v_member_id IN ARRAY p_member_ids
  LOOP
    IF v_member_id != p_creator_id THEN
      INSERT INTO public.conversation_participants (conversation_id, user_id)
      VALUES (v_conversation_id, v_member_id);
    END IF;
  END LOOP;
  
  RETURN v_conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION create_group_conversation(TEXT, UUID, UUID[]) TO authenticated;

