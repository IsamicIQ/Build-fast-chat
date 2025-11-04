# Professional Chat App

A modern messaging platform with professional features like WhatsApp and Telegram.

## Features

### ✅ Feature 1: Message Status (Checkmarks)
- One gray checkmark (✓) = Message sent
- Two gray checkmarks (✓✓) = Message delivered (when recipient opens the app)
- Two blue checkmarks (✓✓) = Message read (when recipient sees it)
- Only visible to the sender

### 📸 Feature 2: Send Images
- Upload button for images
- Send images by themselves or with text
- Preview before sending
- Images displayed in chat
- Click to view larger
- Shows "uploading..." status

### 🚫 Feature 3: Block Users
- "Block User" button on profiles
- Blocked users can't find you in search
- Blocked users can't send you messages
- You don't see their messages
- "Blocked Users" page to manage blocked list
- "Unblock" button to restore access

### 🔍 Feature 4: Search Messages
- Search within a chat with highlight
- Shows result count (e.g., "3 of 12 results")
- Navigate between results with arrows
- Global search bar finds:
  - Users by name
  - Conversations
  - Messages across all chats
- Click any result to navigate directly

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to Project Settings > API
3. Copy your Project URL and anon key
4. Create a `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

### 3. Set Up Database

1. In Supabase Dashboard, go to SQL Editor
2. Run the migration file: `supabase/migrations/001_initial_schema.sql`

### 4. Set Up Storage

1. In Supabase Dashboard, go to **Storage**
2. Click **New bucket**
3. Name it `messages` and make it **Public**
4. Go to **Policies** tab and create these policies:

   **Policy 1 - Allow authenticated users to upload:**
   - Policy name: "Allow authenticated uploads"
   - Allowed operation: INSERT
   - Policy definition:
     ```sql
     (bucket_id = 'messages'::text) AND (auth.role() = 'authenticated'::text)
     ```

   **Policy 2 - Allow authenticated users to read:**
   - Policy name: "Allow authenticated reads"
   - Allowed operation: SELECT
   - Policy definition:
     ```sql
     (bucket_id = 'messages'::text) AND (auth.role() = 'authenticated'::text)
     ```

### 5. Run the App

```bash
npm run dev
```

Visit `http://localhost:3000`

## Tech Stack

- **Next.js 14** - React framework
- **TypeScript** - Type safety
- **Supabase** - Backend (auth, database, storage)
- **Tailwind CSS** - Styling
- **date-fns** - Date formatting

## Project Structure

```
├── app/
│   ├── auth/          # Authentication page
│   ├── page.tsx       # Main chat interface
│   └── layout.tsx     # Root layout
├── components/
│   ├── ChatList.tsx          # Conversation list
│   ├── ChatWindow.tsx        # Main chat interface
│   ├── MessageInput.tsx      # Message input with image upload
│   ├── MessageStatusIcon.tsx # Checkmark status icons
│   ├── MessageSearch.tsx     # Search within chat
│   ├── UserSearch.tsx        # Global search
│   ├── ProfileModal.tsx      # User profile with block
│   ├── BlockedUsersPage.tsx  # Blocked users management
│   └── ImageViewer.tsx       # Full-size image viewer
├── lib/
│   ├── supabase.ts           # Supabase client
│   └── database.types.ts     # Database types
└── supabase/
    └── migrations/
        └── 001_initial_schema.sql  # Database schema
```

## Usage

1. **Sign Up/In**: Create an account or sign in
2. **Start Chatting**: Search for users and start conversations
3. **Send Messages**: Type messages, attach images, see delivery status
4. **Search**: Use the search bar to find users, chats, or messages
5. **Block Users**: Click on a user's profile to block/unblock
6. **Manage Blocks**: Go to "Blocked Users" to see and unblock users

Enjoy your professional chat app! 🎉

