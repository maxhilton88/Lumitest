# DynTube Integration Verification Guide

## ✅ What's Been Set Up

### 1. **Test Video Created Automatically**
The server now automatically creates a test video with your DynTube key on startup:

- **Video ID**: `video_test_dyntube_001`
- **Title**: "Test Video - Foxy Adventure"
- **DynTube Key**: `sNwOT9edCEVH7aaOyvng`
- **Category**: English
- **Status**: Active, Featured, New
- **Storage**: Saved in KV store with key `foxy_video:video_test_dyntube_001`

### 2. **DynTube Test Page**
A dedicated test page has been created at `/dyntube-test` with:

- ✅ Real-time player status monitoring
- ✅ Detailed error diagnostics
- ✅ Domain whitelisting verification
- ✅ Video key input for testing different videos
- ✅ Comprehensive troubleshooting checklist
- ✅ Browser console logging integration

### 3. **Dev Navigation Shortcut**
Added quick access to DynTube test page:
- Click the **DEV MODE** button (bottom-right corner)
- New **"DynTube Test"** button appears at the bottom of the menu

---

## 🎯 How to Test

### Option 1: Via Test Page (Recommended)
1. Navigate to `/dyntube-test` in your browser
   - Or use Dev Navigation → "DynTube Test"
2. The video key `sNwOT9edCEVH7aaOyvng` is pre-filled
3. Click **"Test Video"**
4. Watch the status indicators:
   - ⏳ Loading → Initializing DynTube SDK
   - ✅ Success → Video player loaded successfully
   - ❌ Error → Shows specific error message with troubleshooting steps

### Option 2: Via Video Library
1. Log in as a parent user
2. Navigate to the **Video Library** tab
3. Your test video should appear in the "Featured" carousel and "New Releases" section
4. Click on it to play

### Option 3: Via Parent Dashboard
1. Log in as a parent user
2. Go to the **Watch** tab
3. Test video should be visible in the grid
4. Click to play

---

## 🔍 Verification Checklist

### Before Testing
- [ ] Domain `foxy.projectlumi.org` is whitelisted in **DynTube Dashboard → Settings → Security → Domain Restrictions**
- [ ] Video with key `sNwOT9edCEVH7aaOyvng` is **published** (not draft) in DynTube dashboard
- [ ] Server has been restarted (to trigger test video creation)

### Expected Results (Success)
- [ ] DynTube SDK loads from `https://embed.dyntube.com/v1.0/dyntube.js`
- [ ] Player `<iframe>` is injected into the page within 10 seconds
- [ ] Video begins playing or shows DynTube's native controls
- [ ] Browser console shows: `[DynTube] Player iframe created successfully!`

### If You See Errors
- [ ] **403 Forbidden**: Domain not whitelisted → Add domain in DynTube settings
- [ ] **404 Not Found**: Video key incorrect or video not published
- [ ] **No iframe created**: Check browser console for SDK loading errors
- [ ] **Timeout after 10s**: Domain whitelist issue or video unpublished

---

## 🛠️ Technical Details

### Server-Side (Automatic)
The test video is created during server startup in `/supabase/functions/server/index.tsx`:

```typescript
// Creates test video if it doesn't exist
const testVideoId = 'video_test_dyntube_001';
const existingTestVideo = await kv.get(`foxy_video:${testVideoId}`);
if (!existingTestVideo) {
  await kv.set(`foxy_video:${testVideoId}`, {
    id: testVideoId,
    title: 'Test Video - Foxy Adventure',
    dyntubeKey: 'sNwOT9edCEVH7aaOyvng',
    // ... other properties
  });
}
```

### Client-Side Integration
Both `VideoLibrary.tsx` and `ParentDashboard.tsx` use the **DynTube JS SDK embed** approach:

```typescript
// 1. Load SDK
<script src="https://embed.dyntube.com/v1.0/dyntube.js"></script>

// 2. Create player div
<div data-dyntube-key="sNwOT9edCEVH7aaOyvng"></div>

// 3. Initialize SDK
window.dyntube.init();
```

### API Endpoints
- **GET** `/make-server-221a61bc/videos` - Public endpoint that fetches all active videos (including test video)
- **GET** `/make-server-221a61bc/admin/videos` - Admin endpoint for video management

---

## 📊 Monitoring & Debugging

### Browser Console Logs
Watch for these log messages:

**✅ Success Pattern:**
```
[DynTube] Mounting player with key: sNwOT9edCEVH7aaOyvng
[DynTube] Current domain: foxy.projectlumi.org
[DynTube] SDK loaded successfully
[DynTube] SDK init() called
[DynTube] Player iframe created successfully!
```

**❌ Error Pattern:**
```
[DynTube] Mounting player with key: sNwOT9edCEVH7aaOyvng
[DynTube] Player iframe not created after 10s
Domain "foxy.projectlumi.org" may not be whitelisted in DynTube
```

### Server Logs
Check for startup messages:
```
[VIDEO] Created test DynTube video: video_test_dyntube_001
```

Or if it already exists:
```
[VIDEO] Test DynTube video already exists
```

---

## 🚀 Next Steps After Verification

Once the test video plays successfully:

1. **Add More Videos** via Super Admin Dashboard:
   - Go to `/admin` → Video Manager
   - Click "Add Video"
   - Enter DynTube video key for each video
   - Configure categories, series, thumbnails, etc.

2. **Organize into Series**:
   - Create series in Super Admin → Video Manager → Series tab
   - Assign videos to series using the `series_id` field

3. **Set Up Categories**:
   - Create custom categories (English, Math, Science, etc.)
   - Assign videos to categories for better organization

4. **Configure Premium Content**:
   - Toggle `isPremium` to lock videos behind subscription paywall
   - Free users will see lock icon and "Upgrade" prompt

---

## ⚠️ Common Issues & Solutions

### Issue: "Domain not whitelisted" error
**Solution**: 
1. Log in to DynTube Dashboard
2. Go to Settings → Security → Domain Restrictions
3. Add `foxy.projectlumi.org` (without https://)
4. Save changes
5. Wait 1-2 minutes for propagation
6. Refresh your test page

### Issue: Test video doesn't appear in library
**Solution**:
1. Check server logs for `[VIDEO] Created test DynTube video` message
2. If missing, restart the server
3. Verify KV store contains `foxy_video:video_test_dyntube_001` key
4. Check video status is `active` (not `deleted`)

### Issue: Player shows black screen
**Solution**:
1. Verify video is **published** in DynTube (not draft)
2. Check video key is exactly `sNwOT9edCEVH7aaOyvng` (case-sensitive)
3. Try playing video directly in DynTube dashboard to confirm it works

### Issue: SDK fails to load
**Solution**:
1. Check internet connectivity
2. Verify `https://embed.dyntube.com/v1.0/dyntube.js` is accessible
3. Check browser console for CORS errors
4. Try clearing browser cache

---

## 📝 Test Video Details

Your test video configuration:

```json
{
  "id": "video_test_dyntube_001",
  "title": "Test Video - Foxy Adventure",
  "subtitle": "DynTube Integration Test",
  "category": "english",
  "language": "en",
  "duration": "5:00",
  "thumbnail": "https://images.unsplash.com/photo-1769072385024-c962e061c523?w=480&h=270&fit=crop",
  "dyntubeKey": "sNwOT9edCEVH7aaOyvng",
  "isPremium": false,
  "isNew": true,
  "isFeatured": true,
  "status": "active",
  "order": 0
}
```

---

## 🎉 Success Criteria

You'll know everything is working when:

✅ Test page shows green "Video loaded successfully!" message  
✅ DynTube player iframe appears and video is playable  
✅ Test video appears in Video Library (parent view)  
✅ No 403 or domain errors in browser console  
✅ Video plays smoothly with DynTube's native controls  

---

## 📚 Additional Resources

- **DynTube Documentation**: Check your DynTube account for official embed docs
- **Domain Whitelist Settings**: DynTube Dashboard → Settings → Security
- **Video Publishing**: DynTube Dashboard → Videos → [Your Video] → Publish
- **Browser DevTools**: Press F12 to open console for detailed logging

---

**Last Updated**: {{ current_date }}  
**Video Key Used**: `sNwOT9edCEVH7aaOyvng`  
**Domain**: `foxy.projectlumi.org`
