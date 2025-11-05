-- Ensure users can insert their own profile during signup
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
CREATE POLICY "Users can insert own profile" ON public.users
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id);

-- Ensure users can read all profiles
DROP POLICY IF EXISTS "Allow authenticated users to read all profiles" ON public.users;
CREATE POLICY "Allow authenticated users to read all profiles" ON public.users
FOR SELECT TO authenticated
USING (true);

