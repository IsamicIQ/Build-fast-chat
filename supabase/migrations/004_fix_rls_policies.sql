-- Fix RLS policies to allow users to read other users' profiles

-- Drop existing restrictive policies if they exist
DROP POLICY IF EXISTS "Users can view other users" ON users;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON users;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON users;

-- Create a simple policy that allows all authenticated users to read all user profiles
CREATE POLICY "Allow authenticated users to read all profiles"
ON users
FOR SELECT
TO authenticated
USING (true);

-- Ensure users can still update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON users;

CREATE POLICY "Users can update own profile"
ON users
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Ensure users can insert their own profile (during signup)
DROP POLICY IF EXISTS "Users can insert own profile" ON users;

CREATE POLICY "Users can insert own profile"
ON users
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);




