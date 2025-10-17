#!/bin/bash

# Setup script for deployment configuration
# Run this script to set up your environment variables

echo "🚀 Setting up deployment configuration..."

# Get ngrok URL from user
echo "Please enter your ngrok URL (e.g., https://abc123.ngrok-free.dev):"
read NGROK_URL

if [ -z "$NGROK_URL" ]; then
    echo "❌ No ngrok URL provided. Exiting."
    exit 1
fi

# Create .env.production.local file
cat > .env.production.local << EOF
# Production environment variables
API_URL=$NGROK_URL
EOF

echo "✅ Created .env.production.local with API_URL=$NGROK_URL"

# Create .env.local for development
cat > .env.local << EOF
# Development environment variables
API_URL=http://localhost:8081
EOF

echo "✅ Created .env.local for development"

echo ""
echo "🎉 Setup complete!"
echo ""
echo "For deployment:"
echo "1. Make sure your MacBook backend is running"
echo "2. Start ngrok: ngrok http 8081"
echo "3. Update .env.production.local with the new ngrok URL if it changes"
echo "4. Deploy your app to Vercel/Netlify/etc."
echo ""
echo "For development:"
echo "1. Run: npm run dev"
echo "2. Your app will use localhost:8081"
