# Deployment Guide

## Free Hosting Options

### Option 1: Vercel (Recommended - Easiest)

1. **Push your code to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin YOUR_GITHUB_REPO_URL
   git push -u origin main
   ```

2. **Deploy to Vercel:**
   - Go to [vercel.com](https://vercel.com) and sign up/login with GitHub
   - Click "New Project"
   - Import your GitHub repository
   - Vercel will auto-detect Vite settings
   - **Add Environment Variables:**
     - `VITE_SUPABASE_URL` = your Supabase URL
     - `VITE_SUPABASE_ANON_KEY` = your Supabase anon key
     - `VITE_SITE_URL` = your Vercel deployment URL (e.g., `https://your-app.vercel.app`)
   - Click "Deploy"
   - Your app will be live at `your-project-name.vercel.app`

**Important:** After deployment, configure Supabase:
1. Go to your Supabase project dashboard
2. Navigate to **Authentication** → **URL Configuration**
3. Set **Site URL** to your Vercel deployment URL (e.g., `https://your-app.vercel.app`)
4. Add your Vercel URL to **Redirect URLs** (e.g., `https://your-app.vercel.app/**`)
5. Also add `http://localhost:5173/**` for local development if needed

**Pros:** Free, automatic deployments on git push, custom domains, very fast

---

### Option 2: Netlify

1. **Push to GitHub** (same as above)

2. **Deploy to Netlify:**
   - Go to [netlify.com](https://netlify.com) and sign up/login
   - Click "Add new site" → "Import an existing project"
   - Connect your GitHub repo
   - **Build settings:**
     - Build command: `npm run build`
     - Publish directory: `dist`
   - **Add Environment Variables:**
     - `VITE_SUPABASE_URL` = your Supabase URL
     - `VITE_SUPABASE_ANON_KEY` = your Supabase anon key
     - `VITE_SITE_URL` = your Netlify deployment URL (e.g., `https://your-app.netlify.app`)
   - Click "Deploy site"
   - Your app will be live at `your-project-name.netlify.app`

**Important:** After deployment, configure Supabase (same as Vercel instructions above)

**Pros:** Free, automatic deployments, custom domains

---

### Option 3: Cloudflare Pages

1. **Push to GitHub**

2. **Deploy to Cloudflare Pages:**
   - Go to [dash.cloudflare.com](https://dash.cloudflare.com)
   - Pages → Create a project
   - Connect GitHub repo
   - **Build settings:**
     - Framework preset: Vite
     - Build command: `npm run build`
     - Build output directory: `dist`
   - **Add Environment Variables** (same as above)
   - Deploy

**Pros:** Free, very fast CDN, unlimited bandwidth

---

### Option 4: GitHub Pages (More Setup Required)

Requires additional configuration. Vercel/Netlify are easier.

---

## Important Notes

- **Environment Variables:** Make sure to add your Supabase credentials in the hosting platform's settings
- **Supabase:** Already hosted, so no changes needed there
- **Custom Domain:** All platforms allow you to add a custom domain (you'll need to buy one separately)
- **HTTPS:** All platforms provide free SSL certificates

## Recommended: Vercel

Vercel is the easiest and has the best developer experience for React/Vite apps. It's free for personal projects and automatically handles:
- Build optimization
- CDN distribution
- Automatic HTTPS
- Preview deployments for pull requests

