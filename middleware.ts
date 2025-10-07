// middleware.ts
// Place this file in your project root directory

import { next } from '@vercel/edge';
import { userAgent } from '@edge-runtime/user-agent';

export const config = {
  matcher: '/api/:path*',
};

export default function middleware(request: Request) {
  const ua = userAgent(request);
  
  // Block known bots at the edge
  if (ua.isBot) {
    return new Response('Forbidden', { 
      status: 403,
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  }
  
  // Add security headers to all API responses
  const response = next();
  
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  
  return response;
}
