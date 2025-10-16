import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawUrl = searchParams.get('url');
    
    if (!rawUrl) {
      return NextResponse.json({ error: 'Image URL is required' }, { status: 400 });
    }

    // Validate that the URL is from the expected domain
    if (!rawUrl.includes('api.gajkesaristeels.in')) {
      return NextResponse.json({ error: 'Invalid image URL' }, { status: 400 });
    }

    // Use the upstream scheme as-is; server-side fetch avoids mixed content
    const imageUrl = rawUrl;

    // Get authentication token from cookies
    const cookieStore = await cookies();
    const authToken = cookieStore.get('authToken')?.value;

    // Prepare headers
    const headers: HeadersInit = {
      'User-Agent': 'Mozilla/5.0 (compatible; NextJS-Image-Proxy)',
      'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    };

    // Add authentication header if token exists
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    // Fetch the image from the external API
    const response = await fetch(imageUrl, { headers });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch image' }, { status: response.status });
    }

    // Get the image data and content type
    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';

    // Return the image with proper headers
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch (error) {
    console.error('Image proxy error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
