# Prompt 2 — FMCG QR Collaboration System + Partner Portal

## Context
You are building the FMCG QR reward system for Lumi, a Malaysian kids edtech app. This is a **separate product track** from the core game economy — do not modify existing battle, shop, or reward logic unless explicitly stated. This prompt covers three things:
1. The QR scan + reward claim flow (user-facing)
2. The SuperAdmin campaign creator (internal tool)
3. The FMCG partner portal (read-only B2B dashboard)

---

## Part A — QR Scan & Reward Claim Flow

### How it works
FMCG brands (e.g. Mamee, Milo, Gardenia) print unique QR stickers on product packaging. A kid scans the QR → receives an in-game reward. Each QR code is **global once** — the first user to scan it claims it. After that, the code is permanently marked as redeemed and cannot be claimed by anyone else.

### QR code structure
Each QR encodes a URL:
```
https://app.projectlumi.org/qr?code=<uniqueQRCode>
```
The server resolves `uniqueQRCode` → `campaignId` → `brandId` → reward config.

### Scan flow — all states

| State | What happens |
|-------|-------------|
| Logged in + code unclaimed | Grant reward immediately → show celebration popup with brand theming → done |
| Logged in + code already claimed | Show "This code has already been redeemed" screen. No reward. |
| Logged in + code expired | Show campaign end date message → redirect to home |
| **Not logged in** | Store `pendingReward = { qrCode, campaignId }` in session/localStorage → show branded signup/login screen with message e.g. *"Scan your Milo to unlock your reward!"* → after login/signup completes → auto-claim `pendingReward` → show celebration popup → then continue normal onboarding flow if new user |
| Not logged in + code already claimed | After login, show "already claimed" — do not grant reward |
| Not logged in + code expired | Show expired screen before prompting login |

### Claiming logic (server-side)
```
claimQRReward(userId, qrCode):
  campaign = getCampaignByCode(qrCode)
  
  if campaign.status === 'expired' → return ERROR_EXPIRED
  if qrCode.claimedBy !== null → return ERROR_ALREADY_CLAIMED
  
  // Mark as claimed atomically (prevent race condition)
  atomicSet(qrCode.claimedBy = userId, qrCode.claimedAt = now())
  
  // Grant rewards
  for each reward in campaign.rewardConfig:
    grantReward(userId, reward)
  
  // Log claim event for partner analytics
  logClaimEvent(userId, qrCode, campaignId, timestamp)
  
  return SUCCESS
```

**Important:** The `atomicSet` must be a single atomic operation (use a transaction or conditional write) to prevent two users claiming the same code simultaneously.

### Reward grant logic per type

| Reward type | Grant action |
|-------------|-------------|
| `gold` | Add to `user.gold` |
| `diamonds` | Add to `user.diamonds` |
| `bagSlot` | Increment `user.bagSlots` (max 20). If already at 20 → grant 100g fallback instead, note in popup |
| `existingItem` | Add `itemId` + `quantity: 1` to user bag. If bag full → show "bag full" prompt |
| `customItem` | Same as existingItem — item already exists in catalogue, flagged `fmcgExclusive: true` |

### Celebration popup (brand-themed)
- Show brand logo + brand colour scheme
- Display each reward received with icon and amount
- Animate reward grant (coins flying, item appear, etc.)
- "Collect" button dismisses popup → routes to bag or home

---

## Part B — SuperAdmin Campaign Creator

Add a new section in the SuperAdmin panel: **FMCG Campaigns**.

### Campaign fields

| Field | Type | Validation |
|-------|------|-----------|
| Campaign Name | Text | Required, max 60 chars |
| Brand Name | Text | Required |
| Brand Logo | Image upload | PNG/SVG, used in celebration popup |
| Brand Primary Colour | Colour picker | Used for popup theming |
| QR Batch Size | Number | Required, min 100, max 500,000 |
| Start Date | Date | Required |
| Expiry Date | Date | Required, must be after start |
| Reward Config | See below | At least 1 reward required |
| Custom Item | See below | Optional sub-form |
| FMCG Portal Access | Email | Optional — sends portal invite to brand contact |

### Reward config (multi-select, any combination)
```
☐ Gold        → amount field (50–500)
☐ Diamonds    → amount field (1–3)
☐ Bag Slot    → toggle (grants +1 slot, fallback 100g if at max)
☐ Existing Item → item picker from catalogue
☐ Custom Item → opens sub-form (see below)
```

### Custom Item sub-form
When "Custom Item" is selected, SuperAdmin fills:

| Field | Type | Notes |
|-------|------|-------|
| Item Name | Text | e.g. "Milo Energy Shield" |
| Emoji / Icon | Emoji picker | Displayed in bag and shop |
| Slot type | Select | weapon / armor / boots / accessory |
| Stat type | Select | ATK / DEF / HP / XP% |
| Stat value | Number | Reasonable range: ATK 5–20, DEF 5–25, HP 10–50, XP% 5–15 |
| Flavour text | Text | e.g. "Only from Milo Raya 2026. Never sold in shop." |
| Rarity | Auto-set | Always "FMCG Exclusive" — not editable |
| fmcgExclusive | Auto-set | `true` — never appears in shop, never earnable from gameplay |

On save, the custom item is added to the item catalogue with `fmcgExclusive: true` and `campaignId` reference. It is then selectable as the campaign reward.

### QR batch generation
On campaign publish:
- Generate `batchSize` unique alphanumeric codes (e.g. UUID or nanoid)
- Store each code: `{ code, campaignId, claimedBy: null, claimedAt: null }`
- Make batch available for download as:
  - **CSV** — list of raw codes + full URLs
  - **PDF** — print-ready QR grid (for physical sticker printing)

---

## Part C — FMCG Partner Portal

A **separate read-only web dashboard** for brand managers. SuperAdmin grants access via email invite from the campaign creator. Partners log in with their own credentials — they cannot access the Lumi SuperAdmin panel.

### Access model
```
UserRole: 'superadmin' | 'lumi_staff' | 'fmcg_partner'

fmcg_partner:
  - Can only see campaigns they are assigned to
  - Read-only — no create, edit, or delete
  - Cannot see other brands' data
  - Cannot see individual user PII
```

### Partner portal pages

**1. Campaign Overview**
- Campaign name, brand, status (active / expired / upcoming)
- Total QR codes generated
- Total claimed
- Redemption rate %
- Campaign start / end date

**2. Scan Analytics**
- Claims over time (daily chart)
- Claims by region (state-level, Malaysia)
- Claims by time of day
- New user signups attributed to this campaign (users who signed up via the QR flow)

**3. User Demographics (anonymised/aggregated only — no PII)**
- Age group breakdown (4–6 / 7–9 / 10–12)
- School year distribution
- Top subjects by engagement
- No names, no emails, no individual records

**4. QR Batch Management**
- Download CSV of all codes + claim status
- Download print-ready PDF of unclaimed codes only (for reprints)
- Cannot generate new batches — must request via Lumi SuperAdmin

**5. API Access (optional, for technical partners)**
```
GET  /partner/v1/campaigns/{campaignId}/stats
GET  /partner/v1/campaigns/{campaignId}/codes?status=unclaimed|claimed
POST /partner/v1/campaigns/{campaignId}/webhook  → register webhook URL
```
Webhook payload on claim event:
```json
{
  "event": "qr_claimed",
  "campaignId": "...",
  "qrCode": "...",
  "claimedAt": "2026-03-12T10:00:00Z",
  "userAgeGroup": "7-9",
  "userRegion": "Selangor"
}
```
Note: `userAgeGroup` and `userRegion` only — no PII in webhook payload.

---

## Data models (new)

```typescript
// Campaign
{
  id: string
  name: string
  brandName: string
  brandLogoUrl: string
  brandColour: string         // hex
  batchSize: number
  startDate: Date
  expiryDate: Date
  status: 'draft' | 'active' | 'expired'
  rewardConfig: RewardConfig[]
  partnerEmail?: string       // portal access
  createdBy: string           // superadmin userId
}

// RewardConfig
{
  type: 'gold' | 'diamonds' | 'bagSlot' | 'existingItem' | 'customItem'
  amount?: number             // for gold / diamonds
  itemId?: string             // for existingItem / customItem
}

// QR Code
{
  code: string                // unique
  campaignId: string
  claimedBy: string | null    // userId
  claimedAt: Date | null
}

// Item (extended — existing catalogue)
{
  // ... existing fields ...
  fmcgExclusive: boolean      // default false
  campaignId?: string         // reference if fmcgExclusive
  flavourText?: string
}

// Claim Event Log (for analytics)
{
  id: string
  campaignId: string
  qrCode: string
  userId: string
  claimedAt: Date
  userAgeGroup: string        // derived, not stored raw
  userRegion: string          // from user profile
  isNewUser: boolean          // signed up via this QR flow
}
```

---

## What NOT to change
- Existing user auth flow — only add the `pendingReward` session persistence and post-login auto-claim hook
- Shop, battle, test/practice reward logic — not in scope
- Bag slot logic — already handled in Prompt 1; just call `grantBagSlot(userId)` from this prompt
