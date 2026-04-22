# API Contract: Health Check

**Endpoint**: `GET /api/health`
**File**: `src/app/api/health/route.ts`
**Auth**: None required
**Purpose**: Liveness probe — confirms the Next.js application process is running.

---

## Request

```
GET /api/health
```

No headers, query parameters, or request body required.

---

## Response

### 200 OK

```json
{ "status": "ok" }
```

| Field | Type | Description |
|-------|------|-------------|
| `status` | `"ok"` | Static string confirming the app is alive |

No database call is made. No external service is contacted.

---

## Error Responses

This endpoint has no error paths — if the process is running, it returns 200.
A non-200 response indicates the application process itself has crashed
(handled at the infrastructure level, not the application level).

---

## Test Contract

```typescript
// __tests__/integration/health-api.test.ts
import { GET } from '@/app/api/health/route';

it('returns 200 with { status: "ok" }', async () => {
  const res = await GET();
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body).toEqual({ status: 'ok' });
});
```
