# DynTube Integration Flow

## 🔄 Complete Integration Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     SERVER STARTUP                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Check KV for test video:                               │
│     Key: foxy_video:video_test_dyntube_001                 │
│                                                             │
│  2. If NOT found → Create test video:                      │
│     {                                                       │
│       id: 'video_test_dyntube_001',                        │
│       title: 'Test Video - Foxy Adventure',                │
│       dyntubeKey: 'sNwOT9edCEVH7aaOyvng', ← YOUR KEY      │
│       status: 'active',                                     │
│       isFeatured: true,                                     │
│       ...                                                   │
│     }                                                       │
│                                                             │
│  3. Log: "[VIDEO] Created test DynTube video"             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    USER VISITS APP                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Option A: Test Page (/dyntube-test)                       │
│  Option B: Video Library (/library)                        │
│  Option C: Parent Dashboard (/watch)                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                  FRONTEND FETCHES VIDEOS                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  GET /make-server-221a61bc/videos                          │
│  ↓                                                          │
│  Server queries KV: getByPrefix("foxy_video:")            │
│  ↓                                                          │
│  Returns: {                                                 │
│    videos: [                                                │
│      {                                                      │
│        id: 'video_test_dyntube_001',                       │
│        dyntubeKey: 'sNwOT9edCEVH7aaOyvng',                 │
│        ...                                                  │
│      }                                                      │
│    ],                                                       │
│    series: [...],                                           │
│    categories: [...]                                        │
│  }                                                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                 USER CLICKS PLAY BUTTON                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Extract dyntubeKey from video object                   │
│  2. Open video player modal/fullscreen                     │
│  3. Trigger DynTube SDK initialization                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│               DYNTUBE SDK INITIALIZATION                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Step 1: Load SDK Script                                   │
│  ────────────────────────                                  │
│  <script src="https://embed.dyntube.com/v1.0/dyntube.js">  │
│  ↓                                                          │
│  window.dyntube = { init: function, ... }                  │
│                                                             │
│  Step 2: Create Player Div                                 │
│  ───────────────────────                                   │
│  <div data-dyntube-key="sNwOT9edCEVH7aaOyvng">            │
│       ↑                                                     │
│       └── DynTube SDK looks for this attribute             │
│                                                             │
│  Step 3: Initialize SDK                                    │
│  ─────────────────────                                     │
│  window.dyntube.init()                                      │
│  ↓                                                          │
│  SDK scans DOM for [data-dyntube-key] elements            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│              DYNTUBE DOMAIN VERIFICATION                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  DynTube Server Checks:                                     │
│  ✓ Is current domain whitelisted?                          │
│  ✓ Domain: foxy.projectlumi.org                            │
│                                                             │
│  If YES:                                                    │
│  ↓                                                          │
│  ┌──────────────────────────────────────┐                 │
│  │  ✅ Inject authenticated iframe       │                 │
│  │  <iframe src="dyntube.com/player/...">│                 │
│  │  ↓                                     │                 │
│  │  Video decrypted & plays              │                 │
│  └──────────────────────────────────────┘                 │
│                                                             │
│  If NO:                                                     │
│  ↓                                                          │
│  ┌──────────────────────────────────────┐                 │
│  │  ❌ Return 403 Forbidden              │                 │
│  │  No iframe created                    │                 │
│  │  Error: Domain not whitelisted        │                 │
│  └──────────────────────────────────────┘                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   SUCCESS OR ERROR                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ✅ SUCCESS:                                                │
│     • Iframe appears in DOM                                │
│     • Video controls visible                               │
│     • Can play/pause/seek                                  │
│     • Console: "[DynTube] Player iframe created!"          │
│                                                             │
│  ❌ ERROR:                                                  │
│     • No iframe after 10s                                  │
│     • Black screen or empty player                         │
│     • Console: "Domain may not be whitelisted"             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔑 Key Integration Points

### 1. Server-Side (Auto-Creation)
**File**: `/supabase/functions/server/index.tsx`  
**Lines**: 39-78  
**Function**: Creates test video on startup if it doesn't exist

```typescript
const testVideoId = 'video_test_dyntube_001';
const existingTestVideo = await kv.get(`foxy_video:${testVideoId}`);
if (!existingTestVideo) {
  await kv.set(`foxy_video:${testVideoId}`, {
    dyntubeKey: 'sNwOT9edCEVH7aaOyvng', // ← YOUR KEY
    // ... other properties
  });
}
```

### 2. API Endpoint (Video Fetch)
**Endpoint**: `GET /make-server-221a61bc/videos`  
**Function**: Returns all active videos

```typescript
const videos = await kv.getByPrefix("foxy_video:");
const active = videos.filter(v => v.status === "active");
return c.json({ videos: active, series: [...], categories: [...] });
```

### 3. Frontend Components (Player)
**Files**: 
- `/components/parent/VideoLibrary.tsx`
- `/components/dashboards/ParentDashboard.tsx`
- `/pages/DynTubeTestPage.tsx`

**Implementation**:
```typescript
// 1. Create container
const container = document.createElement('div');

// 2. Set DynTube key as data attribute
container.setAttribute('data-dyntube-key', video.dyntubeKey);

// 3. Load SDK (if not already loaded)
const script = document.createElement('script');
script.src = 'https://embed.dyntube.com/v1.0/dyntube.js';
document.head.appendChild(script);

// 4. Initialize SDK
script.onload = () => {
  if (window.dyntube && window.dyntube.init) {
    window.dyntube.init();
  }
};

// 5. Wait for iframe to appear
const checkInterval = setInterval(() => {
  const iframe = container.querySelector('iframe');
  if (iframe) {
    // ✅ Success!
    clearInterval(checkInterval);
  }
}, 500);
```

---

## 📊 Data Flow Diagram

```
┌─────────────┐
│  KV STORE   │
│             │
│ Key: foxy_  │
│ video:...   │
│             │
│ Value:      │
│ {           │
│   dyntubeKey│
│   title     │
│   status    │
│   ...       │
│ }           │
└──────┬──────┘
       │
       ↓ (Server queries on API call)
┌─────────────┐
│   SERVER    │
│  (Hono)     │
│             │
│ GET /videos │
│             │
│ Returns:    │
│ JSON        │
└──────┬──────┘
       │
       ↓ (Frontend fetches)
┌─────────────┐
│  FRONTEND   │
│  (React)    │
│             │
│ Video obj:  │
│ { dyntubeKey│
│   ...}      │
└──────┬──────┘
       │
       ↓ (User clicks play)
┌─────────────┐
│  DYNTUBE    │
│    SDK      │
│             │
│ 1. Load JS  │
│ 2. Find div │
│ 3. Check    │
│    domain   │
│ 4. Inject   │
│    iframe   │
└──────┬──────┘
       │
       ↓ (If domain whitelisted)
┌─────────────┐
│   PLAYER    │
│  (iframe)   │
│             │
│ Decrypts &  │
│ plays video │
└─────────────┘
```

---

## 🛡️ Security Flow

```
USER REQUEST
     ↓
 Your Domain: foxy.projectlumi.org
     ↓
 DynTube SDK loaded
     ↓
 SDK calls DynTube API
     ↓
┌─────────────────────────┐
│  DynTube Server Check   │
├─────────────────────────┤
│                         │
│  Is domain whitelisted? │
│  ├─ YES → Inject iframe │
│  └─ NO  → 403 Forbidden │
│                         │
└─────────────────────────┘
     ↓
 If YES:
 ├─ Authenticated iframe created
 ├─ HLS stream decrypted
 └─ Video plays
 
 If NO:
 ├─ No iframe appears
 ├─ Console error
 └─ User sees error message
```

---

## 🧪 Test Flow

```
OPTION 1: Test Page
─────────────────────
/dyntube-test
  ↓
Video key pre-filled
  ↓
Click "Test Video"
  ↓
Real-time status shown
  ↓
✅ Green = Works!
❌ Red = Shows error


OPTION 2: Video Library
───────────────────────
/ → Login → "Library"
  ↓
Test video in carousel
  ↓
Click video card
  ↓
Fullscreen player opens
  ↓
Video plays (if domain whitelisted)


OPTION 3: Parent Dashboard
──────────────────────────
/ → Login → "Watch" tab
  ↓
Test video in grid
  ↓
Click video
  ↓
Inline player shows
  ↓
Video plays (if domain whitelisted)
```

---

## ⚙️ Configuration Points

### Must Be Set in DynTube Dashboard
```
✓ Domain Restrictions
  └─ Add: foxy.projectlumi.org
  
✓ Video Status
  └─ Must be: Published (not Draft)
  
✓ Video Key
  └─ Must match: sNwOT9edCEVH7aaOyvng
```

### Already Set in Code
```
✓ Test video auto-created
✓ API endpoint configured
✓ Frontend components ready
✓ Error handling implemented
✓ Status monitoring active
```

---

## 🎯 Critical Success Factors

1. **Domain Whitelisting** ← REQUIRED
   - Must be set in DynTube Dashboard
   - Domain: `foxy.projectlumi.org`
   - Takes 1-2 minutes to propagate

2. **Video Publishing** ← REQUIRED
   - Video must be published (not draft)
   - Check in DynTube Dashboard

3. **Correct Video Key** ← REQUIRED
   - Must match exactly: `sNwOT9edCEVH7aaOyvng`
   - Case-sensitive

4. **SDK Loaded** ← Automatic
   - Loaded from: `https://embed.dyntube.com/v1.0/dyntube.js`
   - Happens automatically in code

5. **Iframe Creation** ← Automatic
   - Created by DynTube SDK
   - Only if above 3 requirements met

---

**Status**: All code ready ✅  
**Your action**: Whitelist domain + verify video published  
**Test**: Go to `/dyntube-test` 🚀
