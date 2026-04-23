// File: src/app/api/health/route.ts
/**
 * Health Check API Route Handler
 * GET /api/health — Liveness probe confirming the Next.js application process is running.
 * No database call, no auth required. Returns { status: 'ok' } on 200.
 * (Why: infrastructure-level liveness probe for container orchestration and CI checks)
 */

// Return a static JSON response confirming the app process is alive
// No business logic — if this route responds, the application is running
export function GET() {
  return Response.json({ status: 'ok' });
}
