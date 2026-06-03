# Netlify Deployment Guide

## Current Deployment

- **URL**: https://iconsales.netlify.app

## Backend API

The app calls the Azure backend directly:

```bash
https://app-iconsteel-eadwdthkg5ffh7gq.centralindia-01.azurewebsites.net
```

No `API_URL` environment variable is required for normal frontend API calls.

## Netlify Setup

1. Go to your Netlify dashboard: https://app.netlify.com
2. Select the `iconsales` site.
3. Deploy or redeploy the site normally.
4. Confirm the Azure backend CORS settings allow requests from the Netlify site URL.

## Current API Configuration

Frontend code uses direct Azure URLs for API requests. Authenticated requests send the JWT in the `Authorization` header.

## Troubleshooting

### API calls fail with CORS errors

Update the Azure backend CORS allowlist to include the Netlify domain.

### Login works but later API calls fail

Check the browser Network tab and confirm follow-up requests include:

```bash
Authorization: Bearer <token>
```

### API calls are going to the wrong host

Search for stale endpoint references:

```bash
rg "centralindia-01.azurewebsites.net"
```
