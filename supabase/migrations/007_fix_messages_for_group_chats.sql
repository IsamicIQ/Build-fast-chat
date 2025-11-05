-- Allow receiver_id to be NULL for group chat messages
ALTER TABLE public.messages ALTER COLUMN receiver_id DROP NOT NULL;

-- Add conversation_id column if it doesn't exist
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE;

-- Update RLS policies to handle both direct messages and group messages

-- Update SELECT policy to include group messages
DROP POLICY IF EXISTS "Users can view their messages" ON public.messages;
CREATE POLICY "Users can view their messages" ON public.messages
  FOR SELECT USING (
    -- Direct messages: user is sender or receiver
    (receiver_id IS NOT NULL AND (auth.uid() = sender_id OR auth.uid() = receiver_id)) OR
    -- Group messages: user is participant
    (conversation_id IS NOT NULL AND conversation_id IN (
      SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid()
    ))
  );

-- Update INSERT policy to allow sending to conversations
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
CREATE POLICY "Users can send messages" ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND (
      -- Direct message: receiver_id is set
      receiver_id IS NOT NULL OR
      -- Group message: user is participant in conversation
      (conversation_id IS NOT NULL AND conversation_id IN (
        SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid()
      ))
    )
  );

-- Update UPDATE policy for group messages
DROP POLICY IF EXISTS "Users can update received messages" ON public.messages;
CREATE POLICY "Users can update received messages" ON public.messages
  FOR UPDATE USING (
    -- Direct messages: user is receiver
    (receiver_id IS NOT NULL AND auth.uid() = receiver_id) OR
    -- Group messages: user is participant
    (conversation_id IS NOT NULL AND conversation_id IN (
      SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid()
    ))
  );

-- Add index for conversation_id
CREATE INDEX IF NOT EXISTS messages_conversation_idx ON public.messages(conversation_id);

