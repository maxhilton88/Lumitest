# 🐛 Foxy Adventure Debug Guide

## Problem
The app crashes on PC browsers but works fine on mobile. Logs disappear when the browser crashes, making it impossible to debug.

## Solution
We've implemented a comprehensive debugging system with:
- **Persistent logging** (survives crashes)
- **Error boundaries** (catches crashes gracefully)
- **Performance monitoring** (detects slow renders/excessive re-renders)
- **Live debug panel** (view logs in real-time)

---

## 🛠️ Tools Available

### 1. Debug Logger (`/utils/debug-logger.ts`)
Automatically captures and persists logs to `localStorage`:
- ✅ All logs survive page crashes/refreshes
- ✅ Automatically detects desktop vs mobile
- ✅ Captures uncaught errors and promise rejections
- ✅ Auto-saves every 2 seconds

**No code changes needed** - it's already integrated into the app!

### 2. Error Boundary (`/components/ErrorBoundary.tsx`)
Catches React errors before they crash the app:
- Shows user-friendly error screen
- Displays error details
- Allows exporting logs
- Option to clear data and retry

### 3. Debug Panel (`/components/DebugPanel.tsx`)
Live, in-app log viewer:
- Click the **🐛 DEBUG** button (bottom-right corner)
- View real-time logs
- Filter by type (all/errors/performance)
- Export logs to JSON
- Clear old logs

### 4. Performance Monitor (`/components/PerformanceMonitor.tsx`)
Tracks component performance:
- Warns on slow renders (>16ms)
- Detects excessive re-renders
- Logs component mount/unmount times

---

## 📊 How to Debug the PC Crash

### Step 1: Open the App on PC
1. Open your app in a PC browser (Chrome/Firefox/Edge)
2. You'll see a **🐛 DEBUG** button in the bottom-right corner

### Step 2: Reproduce the Crash
1. Click **🐛 DEBUG** to open the debug panel
2. Navigate through the app until it crashes
3. Even if the browser crashes, logs are saved to `localStorage`

### Step 3: Retrieve Crash Logs

**If the app crashes completely:**
1. Refresh the page
2. Click **🐛 DEBUG** button
3. Click **📥 Export** to download logs as JSON
4. Share the JSON file with your team or analyze it yourself

**If the error boundary catches it:**
1. You'll see an error screen instead of a crash
2. Click **📥 Export Logs** button
3. Download and analyze the logs

### Step 4: Analyze the Logs

Look for these patterns in the logs:

#### ❌ Crash Indicators
```json
{
  "level": "error",
  "category": "UNCAUGHT_ERROR",
  "message": "..."
}
```

#### ⚠️ Performance Issues
```json
{
  "level": "warn",
  "category": "EXCESSIVE_RENDERS",
  "message": "VictoryBurst rendered 100 times in 2000ms"
}
```

#### 🐌 Slow Renders
```json
{
  "level": "warn",
  "category": "SLOW_RENDER",
  "message": "QuestionScreen render took 50ms"
}
```

---

## 🔍 Common Issues & Solutions

### Issue: Excessive Renders
**Symptom:** Log shows "EXCESSIVE_RENDERS" warnings

**Cause:** Component re-rendering too many times (infinite loop)

**Fix:**
- Check `useEffect` dependencies
- Ensure state updates don't trigger more updates
- Use `useRef` for values that don't need re-renders

### Issue: Slow Renders
**Symptom:** Log shows "SLOW_RENDER" warnings (>16ms)

**Cause:** Heavy computation or DOM manipulation during render

**Fix:**
- Move heavy calculations to `useMemo`
- Reduce DOM elements (fewer particles in animations)
- Use CSS animations instead of JS

### Issue: Memory Leak
**Symptom:** Memory usage increases over time, browser eventually freezes

**Cause:** Event listeners, timers, or subscriptions not cleaned up

**Fix:**
- Always return cleanup functions from `useEffect`
- Clear `setTimeout`/`setInterval`
- Remove event listeners on unmount

### Issue: VictoryBurst Crashes
**Symptom:** App crashes when correct answer is clicked

**Logs to check:**
```
VICTORY_BURST - Animation triggered
VICTORY_BURST - Starting victory animation
```

**If logs stop after "Starting victory animation":**
- Too many DOM elements (25 embers + 8 gems + 8 rays)
- CSS animations overwhelming GPU
- Try reducing particle counts in `/components/VictoryBurst.tsx`

---

## 🚀 Quick Actions

### Clear All Logs
Open debug panel → **🗑️ Clear** button

### Export Logs for Analysis
Open debug panel → **📥 Export** button → Share JSON file

### Test Error Boundary
Throw an error in any component to test the error boundary:
```tsx
if (someCondition) {
  throw new Error('Test error');
}
```

---

## 📱 Mobile vs Desktop Detection

The debug logger automatically detects if you're on PC or mobile:

```tsx
debugLogger.isDesktop() // returns true on PC, false on mobile
```

**Why this matters:**
- Performance logs are only generated on PC (where the crash happens)
- Helps identify platform-specific issues

---

## 🎯 Next Steps

1. **Test on PC** - Open the app and click 🐛 DEBUG
2. **Reproduce crash** - Navigate to where it usually crashes
3. **Export logs** - Download the JSON file
4. **Analyze** - Look for errors, warnings, or performance issues
5. **Fix** - Based on patterns found in logs

---

## 💡 Tips

- Keep debug panel open while testing on PC
- Filter by "Errors Only" to quickly spot issues  
- Check memory usage in Chrome DevTools (Performance tab)
- Compare PC logs vs Mobile logs to spot differences
- Export logs before clearing them

---

## 🆘 Need Help?

If logs show an error but you're not sure how to fix it:

1. **Export the logs** (📥 button)
2. **Share the JSON file** with your developer
3. **Include:**
   - Device info (PC specs, browser version)
   - Steps to reproduce
   - Screenshots of error boundary screen (if any)

The logs contain:
- Timestamp of each action
- Error stack traces
- Component render counts
- Performance metrics
- Browser/device info

This should give enough information to diagnose and fix the issue!
