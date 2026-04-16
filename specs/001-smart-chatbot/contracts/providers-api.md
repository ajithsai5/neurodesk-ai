# API Contract: Providers

## GET /api/providers

List all configured AI model/provider combinations.

**Response** (`200`):

```typescript
{
  providers: Array<{
    id: string;
    providerName: string;
    modelId: string;
    displayName: string;
    isAvailable: boolean;
    sortOrder: number;
  }>;
}
```

Sorted by `sortOrder` ascending.

**Notes**:
- `isAvailable` indicates whether the provider can currently accept
  requests. The frontend MUST visually distinguish unavailable providers
  (e.g., grayed out) and prevent selection.
- This is a read-only endpoint. Provider configuration is admin-only
  in v1.
