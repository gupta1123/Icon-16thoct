# Deployment Configuration Guide

## Backend API

The frontend now calls the production backend directly:

```bash
https://app-iconsteel-eadwdthkg5ffh7gq.centralindia-01.azurewebsites.net
```

No tunnel or local API relay is required for normal app API calls.

## Deployment Platforms

### Vercel

1. Deploy the Next.js app normally.
2. No `API_URL` environment variable is required for the frontend API calls.
3. Confirm the Azure backend allows requests from the deployed frontend domain.

### Netlify

1. Deploy the Next.js app normally.
2. No `API_URL` environment variable is required for the frontend API calls.
3. Confirm the Azure backend allows requests from the deployed frontend domain.

## Testing

After deployment:

1. Open browser dev tools.
2. Go to the Network tab.
3. Verify API calls go directly to `app-iconsteel-eadwdthkg5ffh7gq.centralindia-01.azurewebsites.net`.
4. Confirm authenticated requests include the `Authorization: Bearer <token>` header.

## Common Issues

- **CORS errors**: Update the Azure backend CORS allowlist for the frontend domain.
- **Authentication errors**: Verify login returns a token and subsequent requests include the bearer token.
- **Network errors**: Confirm the Azure backend app is running and publicly reachable.
