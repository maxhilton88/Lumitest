# 🎬 DynTube Integration - Quick Start Checklist

## Before You Test (Do These First!)

### 1. ✅ Whitelist Your Domain
**Action Required**: Add to DynTube Dashboard
```
1. Log in to DynTube Dashboard
2. Go to: Settings → Security → Domain Restrictions
3. Add: foxy.projectlumi.org
4. Click "Save"
5. Wait 1-2 minutes for propagation
```

### 2. ✅ Verify Video is Published
**Action Required**: Check DynTube Dashboard
```
1. Go to: DynTube Dashboard → Videos
2. Find video with key: sNwOT9edCEVH7aaOyvng
3. Ensure status is "Published" (not "Draft")
4. If draft, click "Publish" button
```

### 3. ✅ Confirm Video Key
**Action Required**: Double-check spelling
```
Your video key: sNwOT9edCEVH7aaOyvng
- Must be exact match (case-sensitive)
- 20 characters
- Mix of letters and numbers
```

---

## Testing Steps (After Above Completed)

### Quick Test (30 seconds)
```
1. Navigate to: /dyntube-test
2. Click "Test Video" button
3. Wait for status:
   ✅ Green = Success!
   ❌ Red = See error message
```

### Full Test (1 minute)
```
1. Go to: / (root)
2. Log in as parent
3. Click "Library" tab
4. Find "Test Video - Foxy Adventure"
5. Click to play
6. Verify video loads and plays
```

---

## Success Indicators

✅ You'll see: Green "Video loaded successfully!" message  
✅ You'll see: DynTube player with video controls  
✅ Console shows: "[DynTube] Player iframe created successfully!"  
✅ Video plays: Can see and hear content  

---

## If You See Errors

### ❌ Domain Not Whitelisted
**Error**: "Domain may not be whitelisted in DynTube"  
**Fix**: Go back to step 1 above → Add domain → Wait 2 mins → Retry

### ❌ Video Not Found (404)
**Error**: "Failed to load video" or blank player  
**Fix**: Go to step 2 above → Publish video → Retry

### ❌ Wrong Video Key
**Error**: "Invalid video key" or 404  
**Fix**: Go to step 3 above → Verify key spelling → Update if needed

---

## Test Page Features

🎯 **Location**: `/dyntube-test`  
🎯 **Access**: Dev Navigation → "DynTube Test" button  
🎯 **Features**:
- Pre-filled with your video key
- Real-time status monitoring
- Detailed error messages
- Domain verification check
- Browser console integration

---

## Files Created/Modified

### New Files
- ✅ `/pages/DynTubeTestPage.tsx` - Test interface
- ✅ `/DYNTUBE_VERIFICATION_GUIDE.md` - Full documentation
- ✅ `/DYNTUBE_STATUS.md` - Current status summary
- ✅ `/DYNTUBE_CHECKLIST.md` - This checklist

### Modified Files
- ✅ `/supabase/functions/server/index.tsx` - Auto-creates test video
- ✅ `/routes.tsx` - Added /dyntube-test route
- ✅ `/components/DevNavigation.tsx` - Added test page link

---

## Your Test Video Details

```
Video ID: video_test_dyntube_001
Title: Test Video - Foxy Adventure
DynTube Key: sNwOT9edCEVH7aaOyvng
Category: English
Duration: 5:00
Status: Active, Featured, New
Premium: No (free for all users)
```

---

## Quick Debug Commands

### Check if test video exists in KV
```
Browser Console:
fetch('/make-server-221a61bc/videos')
  .then(r => r.json())
  .then(d => console.log(d.videos))
```

### Check DynTube SDK loaded
```
Browser Console:
console.log(window.dyntube)
// Should show: {init: function, ...}
```

### Restart server (if test video missing)
```
Figma Make will auto-restart on code save
Or manually restart the preview
```

---

## Support Resources

📖 **Full Guide**: `/DYNTUBE_VERIFICATION_GUIDE.md`  
📊 **Current Status**: `/DYNTUBE_STATUS.md`  
💻 **Test Page**: `/dyntube-test`  
🔧 **Dev Menu**: Bottom-right DEV MODE button  

---

## Expected Timeline

⏱️ **Domain whitelist**: 1-2 minutes after saving  
⏱️ **Video publish**: Instant  
⏱️ **Test video creation**: On server startup (automatic)  
⏱️ **First test**: 30 seconds  

---

## Still Having Issues?

1. ✅ Completed all 3 pre-test steps above?
2. ✅ Waited 2 minutes after whitelisting domain?
3. ✅ Video is definitely published (not draft)?
4. ✅ Video key spelling is exact match?
5. ✅ Browser console shows detailed logs (F12)?

If all yes and still failing:
- Check DynTube service status
- Try different browser
- Clear browser cache
- Verify video plays in DynTube dashboard directly

---

**Ready to Test?** → Go to `/dyntube-test` now! 🚀
