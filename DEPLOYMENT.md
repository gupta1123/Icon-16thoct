# Deployment Configuration Guide

## For Production Deployment

### 1. Create Environment Variables

Create a `.env.production.local` file in your project root with your ngrok URL:

```bash
# Replace with your actual ngrok URL
API_URL=https://your-ngrok-url.ngrok-free.dev
```

### 2. Update Your ngrok URL

When you start ngrok on your MacBook, you'll get a URL like:
```
https://abc123.ngrok-free.dev
```

Replace `your-ngrok-url` in the environment file with this actual URL.

### 3. Deployment Platforms

#### Vercel Deployment:
1. Go to your Vercel dashboard
2. Select your project
3. Go to Settings > Environment Variables
4. Add: `API_URL` = `https://your-ngrok-url.ngrok-free.dev`

#### Netlify Deployment:
1. Go to your Netlify dashboard
2. Select your site
3. Go to Site settings > Environment variables
4. Add: `API_URL` = `https://your-ngrok-url.ngrok-free.dev`

#### Other Platforms:
Set the `API_URL` environment variable to your ngrok URL.

### 4. Testing Your Setup

After deployment, test that your API calls work by:
1. Opening browser dev tools
2. Going to Network tab
3. Checking that API calls go to `/api/proxy/...` (not localhost)
4. Verify responses are coming from your ngrok backend

### 5. Common Issues

- **CORS errors**: Make sure your ngrok URL is correct
- **502 errors**: Check that your backend server is running on the MacBook
- **Authentication issues**: Verify your auth tokens are being passed correctly

### 6. Development vs Production

- **Development**: Uses `http://localhost:8081` (hardcoded fallback)
- **Production**: Uses `API_URL` environment variable (your ngrok URL)
