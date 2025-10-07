import { next } from '@vercel/functions';
import { userAgent } from '@edge-runtime/user-agent';

export const config = {
  matcher: '/api/:path*',
};

export default function middleware(request: Request) {
  const ua = userAgent(request);
  
  // ============================================
  // 1. BOT DETECTION & BLOCKING
  // ============================================
  if (ua.isBot) {
    return new Response(
      JSON.stringify({ 
        error: 'Forbidden',
        message: 'Bot access not allowed' 
      }),
      { 
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
  
  // ============================================
  // 2. SUSPICIOUS USER AGENT PATTERNS
  // ============================================
  const suspiciousPatterns = [
    'curl',
    'wget',
    'python-requests',
    'scrapy',
    'postman',
  ];
  
  const userAgentString = ua.ua.toLowerCase();
  const isSuspicious = suspiciousPatterns.some(pattern => 
    userAgentString.includes(pattern)
  );
  
  // Allow if it's the Arduino/ESP32 device
  if (isSuspicious && 
      !userAgentString.includes('artcalendar') && 
      !userAgentString.includes('esp32')) {
    return new Response(
      JSON.stringify({ 
        error: 'Forbidden',
        message: 'Suspicious user agent detected' 
      }),
      { 
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
  
  // ============================================
  // 3. ADD SECURITY HEADERS
  // ============================================
  return next({
    headers: {
      // Prevent MIME type sniffing
      'X-Content-Type-Options': 'nosniff',
      
      // Prevent clickjacking
      'X-Frame-Options': 'DENY',
      
      // Enable XSS protection
      'X-XSS-Protection': '1; mode=block',
      
      // Referrer policy
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      
      // DNS prefetch control
      'X-DNS-Prefetch-Control': 'on',
      
      // Permissions policy
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      
      // Additional CSP for API endpoints
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none';",
    },
  });
}

export const config = {
  runtime: 'edge', // Run on edge for best performance
  matcher: '/api/:path*',
};
