# Security Specification (Phase 0: Payload-First Security TDD)

## 1. Data Invariants

1. **Global Default Deny**: Any path not explicitly matched is unconditionally denied (`allow read, write: if false;`).
2. **Verified Identity Invariant**: All read and write operations require `request.auth != null` and write operations strictly require `request.auth.token.email_verified == true`.
3. **Owner & PII Isolation**: `sellers`, `products`, `leads` (which contain client PII: `clientName` and `clientPhone`), and `leads/{leadId}/views` are strictly isolated to `ownerId == request.auth.uid`. Blanket `isSignedIn()` reads or list queries without `resource.data.ownerId == request.auth.uid` are prohibited.
4. **Master Gate & Relational Sync**:
   - Creating a `Lead` requires that the referenced `/sellers/$(incoming().sellerId)` exists and belongs to `request.auth.uid`.
   - Every single-document operation on `/leads/{leadId}/views/{viewId}` verifies via `get()` that the parent `/leads/{leadId}` document exists and its `ownerId == request.auth.uid`, and that `/products/$(incoming().productId)` exists.
5. **Strict Blueprint & Anti-Update-Gap**: Every `create` and `update` must pass `isValidSeller`, `isValidProduct`, `isValidLead`, or `isValidProductView` enforcing `hasAll`, `hasOnly`, exact types, string length bounds, array bounds, and regex patterns (`^[a-zA-Z0-9_\-]+$`).
6. **Temporal & Immutable Integrity**: `createdAt == request.time` on `create`; `updatedAt == request.time` on `update`; `ownerId` and `createdAt` (and `sellerId` on leads) are immutable on `update`.
7. **Terminal State Locking**: Once a `Lead` reaches terminal status `'convertido'`, only explicit status reopen or admin override is permitted, preventing unauthorized state corruption.

## 2. The "Dirty Dozen" Payloads

1. **Identity Spoofing on Seller Create**: `ownerId: "victim-uid"` when `request.auth.uid == "attacker-uid"`.
2. **Unverified Email Write**: Authenticated user with `email_verified: false` attempting to create a `Product`.
3. **Shadow Field Injection on Lead Create**: Valid lead payload plus `"isAdmin": true`.
4. **ID Poisoning on Path Variable**: Document ID containing spaces or >128 chars (`/sellers/bad id with spaces!`).
5. **Orphaned Lead Creation**: Creating a `/leads/{leadId}` referencing a non-existent `sellerId`.
6. **PII Blanket Read Attack**: Authenticated user `attacker-uid` attempting `get` or `list` on `/leads/{leadId}` owned by `victim-uid`.
7. **Value Poisoning on Update**: Updating `leads/{leadId}` with `clientPhone` of 5,000 characters or numeric type.
8. **Immortal Field Mutation**: Updating `createdAt` or `ownerId` or `sellerId` on an existing `Lead`.
9. **Forged Client Timestamp**: Creating a `Product` with a past/future `createdAt` timestamp instead of `request.time`.
10. **Unbounded Array Exhaustion**: Creating a `Product` with `galleryImages` containing 20 elements (limit is 6).
11. **Cross-Tenant Subcollection Write**: Creating `/leads/{victimLeadId}/views/{viewId}` where parent lead belongs to another user.
12. **Terminal State Violation**: Updating `totalViews` on a `Lead` whose `existing().status == 'convertido'` without transitioning status.
