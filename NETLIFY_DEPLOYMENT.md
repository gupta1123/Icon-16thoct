# Netlify Deployment Guide

## Current Deployment
- **URL**: https://iconsales.netlify.app

## Environment Variables Setup

For the app to work properly on Netlify, you need to set the following environment variable:

### Required Environment Variables

1. **API_URL**: The backend API URL

#### Steps to Set Environment Variables on Netlify:

1. Go to your Netlify dashboard: https://app.netlify.com
2. Select your site (iconsales)
3. Navigate to **Site settings** → **Environment variables**
4. Click **Add a variable** or **Add environment variable**
5. Add the following:
   - **Key**: `API_URL`
   - **Value**: `https://your-backend-url.ngrok-free.dev` (or your production backend URL)
   - **Scopes**: Select all scopes (Production, Deploy Previews, Branch deploys)
6. Click **Save**
7. Go to **Deploys** tab and click **Trigger deploy** → **Clear cache and deploy site**

### Example Values

#### Development (using ngrok):
```
API_URL=https://unbalkingly-uncharged-elizabet.ngrok-free.dev
```

#### Production (when you have a permanent backend):
```
API_URL=https://api.iconsales.com
```

## Important Notes

1. **ngrok URLs change**: If you're using ngrok for development, remember that free ngrok URLs expire and change. You'll need to update the `API_URL` environment variable on Netlify whenever your ngrok URL changes.

2. **For production**: Consider using a permanent backend URL instead of ngrok. Options include:
   - Deploy your backend to a cloud provider (AWS, Google Cloud, Azure)
   - Use a service like Railway, Render, or Heroku
   - Get a permanent domain for your backend

3. **After updating environment variables**: Always trigger a new deploy for changes to take effect. You can do this by:
   - Going to Deploys → Trigger deploy → Clear cache and deploy site
   - Or pushing a new commit to your repository

## Current API Configuration

The app uses a Next.js API proxy route (`/api/proxy/[...path]`) to:
- Avoid CORS issues
- Handle authentication tokens
- Forward requests to the backend

The proxy configuration is in: `app/api/proxy/[...path]/route.ts`

## Troubleshooting

### Getting "Proxy error" on all API calls?
✅ **Solution**: Make sure `API_URL` environment variable is set in Netlify and redeploy

### API calls work locally but not on Netlify?
✅ **Solution**: Check that your backend URL is accessible from the internet (ngrok tunnel is running, or backend is deployed)

### Changes to environment variables not taking effect?
✅ **Solution**: Clear cache and trigger a new deploy after changing environment variables

