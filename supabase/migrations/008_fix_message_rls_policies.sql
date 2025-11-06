-- Drop ALL existing message policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view their messages" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
DROP POLICY IF EXISTS "Users can update received messages" ON public.messages;
DROP POLICY IF EXISTS "Users can view group messages" ON public.messages;
DROP POLICY IF EXISTS "Users can send group messages" ON public.messages;

-- Create unified SELECT policy for both direct and group messages
CREATE POLICY "Users can view their messages" ON public.messages
  FOR SELECT USING (
    -- Direct messages: user is sender or receiver
    (receiver_id IS NOT NULL AND (auth.uid() = sender_id OR auth.uid() = receiver_id)) OR
    -- Group messages: user is participant
    (conversation_id IS NOT NULL AND conversation_id IN (
      SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid()
    ))
  );

-- Create unified INSERT policy for both direct and group messages
CREATE POLICY "Users can send messages" ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND (
      -- Direct message: receiver_id is set
      (receiver_id IS NOT NULL AND conversation_id IS NULL) OR
      -- Group message: conversation_id is set and user is participant
      (conversation_id IS NOT NULL AND conversation_id IN (
        SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid()
      ))
    )
  );

-- Create unified UPDATE policy for both direct and group messages
CREATE POLICY "Users can update received messages" ON public.messages
  FOR UPDATE USING (
    -- Direct messages: user is receiver
    (receiver_id IS NOT NULL AND auth.uid() = receiver_id) OR
    -- Group messages: user is participant
    (conversation_id IS NOT NULL AND conversation_id IN (
      SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid()
    ))
  );

