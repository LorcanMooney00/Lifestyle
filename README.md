# Lifestyle - Shared Notes App

A shared notes application for couples, built with React, TypeScript, Tailwind CSS, and Supabase.

## Features

- 🔐 User authentication (sign up / sign in)
- 👥 Partner account linking
- 📝 Topics and notes organization
- 🔄 Real-time updates (via Supabase)
- 📱 Responsive design (mobile-friendly)

## Setup Instructions

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up/login
2. Create a new project
3. Wait for the project to be ready (takes a few minutes)

### 2. Set Up the Database

1. In your Supabase project, go to the SQL Editor
2. Copy the contents of `supabase/schema.sql`
3. Paste and run it in the SQL Editor
4. This will create all necessary tables, indexes, and Row-Level Security policies

### 3. Get Your Supabase Credentials

1. In your Supabase project, go to Settings → API
2. Copy your:
   - Project URL (this is your `VITE_SUPABASE_URL`)
   - `anon` `public` key (this is your `VITE_SUPABASE_ANON_KEY`)

### 4. Set Up Environment Variables

1. Create a `.env` file in the root directory:

```env
VITE_SUPABASE_URL=your_project_url_here
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

2. Replace the placeholders with your actual Supabase credentials

### 5. Install Dependencies

```bash
npm install
```

### 6. Run the Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173` (or the port Vite assigns).

## Project Structure

```
src/
  components/          # Reusable components (if needed)
  lib/
    supabaseClient.ts  # Supabase client configuration
    auth.ts            # Authentication helpers
    api.ts             # Database query helpers
  pages/
    LoginPage.tsx      # Login/signup page
    TopicsPage.tsx     # Topics list page
    TopicPage.tsx      # Notes editor page
    SettingsPage.tsx   # Settings and partner linking
  types/
    index.ts           # TypeScript type definitions
  App.tsx              # Main app component with routing
  main.tsx             # Entry point
  index.css            # Global styles with Tailwind
```

## Usage

1. **Sign Up**: Create an account with your email and password
2. **Link Partner**: Go to Settings and enter your partner's email to link accounts
3. **Create Topics**: Click "+ New Topic" to create a topic
4. **Add Notes**: Open a topic and click "+ New Note" to create notes
5. **Edit Notes**: Click on a note to edit it. Changes auto-save after 2 seconds

## Future Enhancements

- Real-time collaborative editing
- Rich text editor
- File attachments
- Topic sharing with multiple partners
- More features beyond notes (as mentioned in your plan)

## Tech Stack

- **Frontend**: Vite + React + TypeScript
- **Styling**: Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + Realtime)
- **Routing**: React Router DOM

## Notes

- The app uses Row-Level Security (RLS) policies to ensure users can only access their own data and shared topics
- Auto-save is implemented with a 2-second debounce
- Partner linking creates bidirectional links between accounts
- Topics can be shared with partners through the topic_members table

