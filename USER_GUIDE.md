# User Guide - or1n YouTube Filter v3.4.1

## Table of Contents

1. [Installation](#installation)
2. [Quick Start](#quick-start)
3. [Features Overview](#features-overview)
4. [Settings Guide](#settings-guide)
5. [Advanced Usage](#advanced-usage)
6. [Troubleshooting](#troubleshooting)
7. [FAQ](#faq)

---

## Installation

### Prerequisites

- Modern browser (Chrome, Firefox, Edge, Opera)
- Userscript manager extension:
  - **Violentmonkey**
  - **Tampermonkey**
  - **Greasemonkey**

### Installation Steps

1. **Install a Userscript Manager**
   - Chrome/Edge: [Violentmonkey](https://chrome.google.com/webstore/detail/violentmonkey/)
   - Firefox: [Violentmonkey](https://addons.mozilla.org/firefox/addon/violentmonkey/)

2. **Install the Script**
   - Click: [Install YouTube Filter](https://github.com/or1n/or1n-userscripts-for-youtube-views-and-duration-filter/raw/main/or1n-userscripts-for-youtube-views-and-duration-filter.js)
   - Your userscript manager will open
   - Click "Confirm Installation" or "Install"

3. **Verify Installation**
   - Visit [YouTube](https://www.youtube.com)
   - You should see a floating counter in the top-left corner
   - The script is now active!

---

## Quick Start

### First Run

When you first load YouTube with the filter installed:

1. **Counter Appears:** A small floating box shows "🔥 or1n YT filter"
2. **Default Filtering:** Videos with < 99,999 views or < 4 minutes are hidden
3. **Statistics:** "Session" counter shows how many videos were filtered

### Basic Controls

**Counter Buttons:**

- ⚙️ **Settings** - Open full settings panel
- − **Toggle** - Hide/show statistics
- ⋮ **Menu** - Quick actions menu
- ✕ **Close** - Close the counter

**Keyboard Shortcut:**

- `Ctrl+F` - Toggle counter visibility (configurable)

---

## Features Overview

### 🎯 Smart Filtering

#### View Count Filter

Hide videos below a specific view threshold.

**Use Cases:**

- Filter out low-engagement content
- Find popular videos only
- Reduce clutter on homepage

**Example:** Set to 100,000 to only see videos with 100K+ views

#### Duration Filter

Hide videos shorter than a specific length.

**Use Cases:**

- Skip short clips
- Find in-depth content
- Filter out quick uploads

**Example:** Set to 600 (10 minutes) for longer videos only

#### Filter Modes

**OR Mode (Default):**

- Hides videos that fail EITHER condition
- More aggressive filtering
- Example: < 10K views OR < 5 min → filtered

**AND Mode:**

- Hides videos that fail BOTH conditions
- More lenient filtering  
- Example: < 10K views AND < 5 min → filtered

### 📺 Special Content Handling

#### Live Streams

- **Skip Live:** Don't filter currently streaming videos (default: ON)
- **Filter All Live:** Hide ALL live streams regardless of views (default: OFF)

#### YouTube Shorts

- **Filter All Shorts:** Hide ALL Shorts regardless of views/duration (default: OFF)
- Uses 4-strategy detection for accuracy

### ✅ Whitelist & Blacklist

#### Whitelist (Never Filter)

Add channels whose videos you ALWAYS want to see.

**How to Add:**

1. Open Settings → Whitelist section
2. Enable "Enable Whitelist"
3. Right-click any video → "Add to Whitelist" (via Tampermonkey menu)
4. Or add manually via Settings panel

**Use Cases:**

- Your favorite creators
- Educational channels
- News sources

#### Blacklist (Always Filter)

Add channels whose videos you NEVER want to see.

**How to Add:**

1. Open Settings → Blacklist section
2. Enable "Enable Blacklist"
3. Right-click any video → "Add to Blacklist"

**Use Cases:**

- Unwanted recommendations
- Spam channels
- Content you're not interested in

**Pro Tip:** Enable "Case-insensitive matching" to catch variations

### 📊 Statistics Tracking

#### Session Stats

- Count of videos filtered in current browsing session
- Resets when you close YouTube or refresh

#### Lifetime Stats

- Total videos filtered since installation
- Days active
- Persists across sessions

**Disable:** Settings → Statistics → Uncheck "Track Lifetime Statistics"

### 🎨 Customization

#### Themes

- **Dark Mode:** Black/gray color scheme (default)
- **Light Mode:** White/light color scheme

#### Fonts

- **Family:** Choose from 7 fonts (Segoe UI, Arial, Roboto, etc.)
- **Size:** 10-20px (slider)
- **Weight:** Normal, Bold, Light, Semi-Bold

#### Counter Appearance

- **Opacity:** 50-100% transparency
- **Draggable:** Move counter by clicking header
- **Position:** Automatically saved between sessions
 - **Open on Load:** Control whether the counter opens automatically when YouTube/new tabs load (Settings → Appearance)

### ⌨️ Keyboard Shortcuts

**Default:** `Ctrl+F` (configurable)

**Customization:**

1. Settings → Keyboard Shortcut
2. Select modifiers: Ctrl, Alt, Shift
3. Select key: F, H, Y, Q
4. ⚠️ Conflict warnings shown automatically

**Conflict Detection:**

- Warns about YouTube shortcuts (k, j, l, f, m, etc.)
- Warns about browser shortcuts (Ctrl+F, Ctrl+T, etc.)

### 🔔 Notifications

Toast notifications for actions:

- Settings saved
- Channel added to whitelist/blacklist
- Statistics reset
- Filter applied

**Customize:**

- Duration: 500-10,000ms
- Fade speed: 50-2,000ms
- Enable/disable entirely

---

## Settings Guide

### Accessing Settings

**Method 1:** Click ⚙️ button on counter  
**Method 2:** Right-click page → Tampermonkey → YouTube Filter → Settings  
**Method 3:** Press `Ctrl+F` → Click ⚙️

### Settings Sections

#### 🎯 Filter Settings

##### Minimum Views

```text
Range: 0 - ∞
Default: 99,999
Step: 1,000
```

Set to 0 to disable view filtering.

##### Minimum Duration (seconds)

```text
Range: 0 - ∞
Default: 240 (4 minutes)
Step: 30
```

Set to 0 to disable duration filtering.

**Quick Conversions:**

- 60s = 1 minute
- 300s = 5 minutes
- 600s = 10 minutes
- 1200s = 20 minutes

#### ⚡ Filter Logic

**Combine Filters With:**

- **AND:** Both conditions must fail
- **OR:** Either condition can fail

**Example Scenario:**

```text
MIN_VIEWS: 10,000
MIN_DURATION: 300 (5 min)
```

**OR Mode:** Video with 5K views and 10 min → Filtered (views too low)  
**AND Mode:** Same video → Not Filtered (duration is OK)

#### ✅ Whitelist Section

1. **Enable Whitelist:** Toggle checkbox
2. **View Channels:** List of whitelisted channels
3. **Add Channel:** Via menu or manual entry
4. **Remove:** Click 🗑️ next to channel

**Format:** Accepts channel IDs (@username) or URLs

#### 🚫 Blacklist Section

Same interface as Whitelist, but for channels to always filter.

#### 🎨 Appearance

**Theme:**

- Dark (recommended for night viewing)
- Light (better for bright environments)

**Font Family:**
Dropdown with 7 options. Preview changes live.

**Font Size:**
Slider (10-20px) with live preview.

**Font Weight:**

- Normal (regular text)
- Bold (thick text)
- Lighter (thin text)
- 600 (semi-bold)

**Counter Opacity:**
Slider (50-100%). Lower = more transparent.

#### ⌨️ Keyboard Shortcut

**Modifiers:**

- ☐ Ctrl
- ☐ Alt
- ☐ Shift

**Key:** Dropdown (F, H, Y, Q)

**Conflict Warning:**
Red/orange boxes appear if shortcut conflicts detected.

**Recommendations:**

- ✅ Use Ctrl+Alt+[Key] (safest)
- ⚠️ Avoid F, K, J, L without modifiers
- ⚠️ Avoid Ctrl+F (browser find)

#### 📊 Statistics

**Track Lifetime Statistics:**

- Enable: Saves total filtered count
- Disable: Only session stats

**Show Notifications:**
Toggle toast notifications on/off.

**Stats Display:**

- Total Filtered: Lifetime count
- Active Since: Installation date
- Days Active: Days since install

**Reset Statistics:** Button to clear all stats

#### 🔧 Advanced

**Smooth Video Removal Animation:**

- Fade-out effect when filtering
- Disable for instant removal (faster)

**Draggable Counter:**

- Enable: Click and drag header to move
- Disable: Counter stays fixed

**Do not filter LIVE videos:**

- Skip filtering for active livestreams

**Case-insensitive whitelist/blacklist:**

- "TechChannel" matches "techchannel"

**Filter ALL LIVE streams:**

- Hide all livestreams (overrides skip setting)

**Filter ALL Shorts:**

- Hide all YouTube Shorts

**Enable Debug Logging:**

- Console logs for troubleshooting
- ⚠️ May slow down browser

**Animation Timings:**
Fine-tune animation speeds (advanced users):

- Removal Duration: Fade-out speed
- Removal Scale: Shrink amount
- Notification Duration: How long toasts stay
- Notification Fade: Toast fade speed
- Counter Pulse Duration: Stat update animation
- Counter Pulse Scale: Stat update grow amount

### Saving Settings

**Save Settings Button:**

- Green button at bottom
- Validates all inputs
- Shows conflict warnings
- Displays "✓ Settings saved" notification

**Reset to Defaults Button:**

- Gray button at bottom
- Restores all factory settings
- Requires confirmation

---

## Advanced Usage

### Custom Filtering Strategies

#### Strategy 1: Quality Content Only

```javascript
MIN_VIEWS: 100,000
MIN_DURATION: 600 (10 min)
FILTER_MODE: AND
```

Only filters videos with low views AND short duration.

#### Strategy 2: Remove Shorts & Clips

```javascript
FILTER_ALL_SHORTS: true
MIN_DURATION: 180 (3 min)
```

Removes all Shorts plus videos under 3 minutes.

#### Strategy 3: Popular Videos Only

```javascript
MIN_VIEWS: 1,000,000
MIN_DURATION: 0
FILTER_MODE: OR
```

Only shows videos with 1M+ views, any duration.

#### Strategy 4: Curated Feed

```javascript
ENABLE_WHITELIST: true
WHITELIST: [favorite channels]
MIN_VIEWS: 50,000
```

Shows all videos from favorites, plus 50K+ from others.

### Using Greasemonkey Menu

Right-click page → Tampermonkey/Violentmonkey → YouTube Filter:

**Menu Commands:**

- ⚙️ Open Settings
- 👁️ Toggle Counter
- 🔄 Force Re-Filter
- 📈 Reset Statistics
- ✅ Add Current Channel to Whitelist
- 🚫 Add Current Channel to Blacklist
- 🔴 Toggle LIVE Filtering

### Quick Menu Actions

Click ⋮ on counter:

1. **👁️ Toggle Counter:** Show/hide stats
2. **🚫 Close Counter:** Remove counter completely
3. **📈 Reset Stats:** Clear all statistics
4. **🔴 Ignore LIVE:** Toggle live stream filtering
5. **🔄 Force Filter:** Re-process all videos
6. **✅ Whitelist [Channel]:** Quick-add current channel
7. **🚫 Blacklist [Channel]:** Quick-block current channel

### Performance Tuning

**For Slower Computers:**

```javascript
DEBOUNCE_DELAY: 100  // Higher = less CPU usage
SMOOTH_REMOVAL: false  // Disable animations
DEBUG: false  // Turn off logging
```

**For Faster Computers:**

```javascript
DEBOUNCE_DELAY: 10  // Lower = faster filtering
SMOOTH_REMOVAL: true  // Enable animations
```

### Exporting/Importing Settings

Currently manual via browser console:

**Export:**

```javascript
console.log(JSON.stringify(GM_getValue('ytFilterConfig')));
```

**Import:**

```javascript
GM_setValue('ytFilterConfig', {paste JSON here});
location.reload();
```

---

## Troubleshooting

### Videos Not Being Filtered

**Check:**

1. Is the counter showing on the page?
2. Are view counts/durations meeting thresholds?
3. Is channel in whitelist?
4. Is "Skip LIVE" enabled for livestreams?
5. Open Settings → Enable Debug → Check console

**Solutions:**

- Click ⋮ → Force Filter
- Refresh the page
- Check filter mode (AND vs OR)
- Verify thresholds are correct

### Counter Not Visible

**Causes:**

- Closed via ✕ button
- Hidden via keyboard shortcut
- CSS conflict with YouTube updates

**Solutions:**

- Press `Ctrl+F` to toggle
- Refresh page
- Right-click → Tampermonkey → Toggle Counter
- Check browser console for errors

### Settings Not Saving

**Solutions:**

1. Check if Greasemonkey storage is enabled
2. Try different browser
3. Reinstall script
4. Check for browser console errors

### Performance Issues

**Symptoms:**

- YouTube is slow/laggy
- Videos load slowly
- Browser freezes

**Solutions:**

1. Increase `DEBOUNCE_DELAY` to 100+
2. Disable `SMOOTH_REMOVAL`
3. Disable `DEBUG` mode
4. Disable `ENABLE_STATISTICS`
5. Reduce browser extensions

### Conflicts with Other Scripts

**Common Issues:**

- Keyboard shortcuts overlap
- Counter position conflicts
- CSS style conflicts

**Solutions:**

1. Use conflict detection (Settings → Keyboard Shortcut)
2. Change shortcut to Ctrl+Alt+[Key]
3. Move counter to different position
4. Disable other YouTube scripts temporarily

### YouTube Layout Changes

**If script stops working after YouTube update:**

1. Check GitHub for updates
2. Reinstall script (may have auto-updated)
3. Report issue with browser console logs
4. Enable DEBUG mode and screenshot console

---

## FAQ

### General Questions

**Q: Is this safe to use?**  
A: Yes. Open-source, MIT licensed, no data collection, runs locally.

**Q: Does it slow down YouTube?**  
A: Minimal impact. Optimized with caching and debouncing.

**Q: Can YouTube detect I'm using this?**  
A: No. Runs client-side, no server communication.

**Q: Does it work on mobile?**  
A: Only on mobile browsers that support userscripts (e.g., Firefox + Violentmonkey).

### Filtering Questions

**Q: Why are some filtered videos still visible?**  
A: They may be added after page load. Click "Force Filter" or scroll to trigger.

**Q: Can I filter by upload date?**  
A: Not currently. Feature request on GitHub.

**Q: Can I filter by keywords?**  
A: Not currently. Use YouTube's native search filters.

**Q: Do filters apply to search results?**  
A: Yes. Filters work on all YouTube pages.

### Whitelist/Blacklist Questions

**Q: How do I find a channel ID?**  
A: Visit channel → Copy from URL → Paste in settings

**Q: Can I whitelist multiple channels at once?**  
A: Not via UI. Use console to bulk-add to CONFIG.WHITELIST array.

**Q: Do lists sync across devices?**  
A: No. Stored locally. Export/import manually.

### Statistics Questions

**Q: Where are stats stored?**  
A: Locally in Greasemonkey storage (your browser).

**Q: Can I export my stats?**  
A: Via console: `console.log(GM_getValue('lifetimeStats'))`

**Q: Do stats count manually hidden videos?**  
A: No. Only automatically filtered videos.

### Customization Questions

**Q: Can I change the counter position?**  
A: Yes. Enable "Draggable" and drag to desired position.

**Q: Can I hide the counter permanently?**  
A: Yes. Click ✕ or disable SHOW_COUNTER in settings.

**Q: Can I style the counter with custom CSS?**  
A: Advanced users can edit the `injectStyles()` function.

**Q: Can I add more keyboard shortcuts?**  
A: Requires code modification. See CONTRIBUTING.md.

---

## Tips & Tricks

### Pro Tips

1. **Combine Filters:** Use whitelist + high thresholds for curated feed
2. **Quick Toggle:** `Ctrl+F` to quickly enable/disable counter
3. **Force Filter:** Use after changing settings to apply immediately
4. **Save Position:** Counter position auto-saves when dragged
5. **Batch Operations:** Use menu commands for quick channel actions

### Recommended Settings

**For Discovering New Content:**

```javascript
MIN_VIEWS: 5,000
MIN_DURATION: 120
FILTER_MODE: AND
```

**For Established Content Only:**

```javascript
MIN_VIEWS: 500,000
MIN_DURATION: 600
FILTER_MODE: OR
```

**For No Shorts/Clips:**

```javascript
FILTER_ALL_SHORTS: true
MIN_DURATION: 300
```

**For Specific Creators:**

```javascript
ENABLE_WHITELIST: true
MIN_VIEWS: 999999 (effectively high)
```

### Keyboard Workflow

1. Browse YouTube normally
2. See low-quality video → Right-click → "Add to Blacklist"
3. `Ctrl+F` → Toggle counter if needed
4. ⋮ Menu → Force Filter to reprocess
5. Continue browsing filtered feed

---

## Getting Help

### Support Channels

**GitHub Issues:**  
<https://github.com/or1n/or1n-userscripts-for-youtube-views-and-duration-filter/issues>

**Documentation:**

- API_DOCUMENTATION.md (for developers)
- CONTRIBUTING.md (for contributors)
- This file (for users)

### Reporting Bugs

**Include:**

1. Browser version
2. Userscript manager version
3. Script version (3.4.1)
4. Console errors (F12 → Console)
5. Steps to reproduce
6. Screenshots if applicable

### Feature Requests

**Before requesting:**

1. Check existing issues on GitHub
2. Read API documentation
3. Consider if it fits the scope

**When requesting:**

1. Describe use case
2. Explain expected behavior
3. Provide examples

---

## Updates & Changelog

**Current Version:** 3.4.1

**Update Method:**

- Automatic via userscript manager
- Manual: Reinstall from GitHub

**What's New in 3.4.1:**

- ⌨️ Keyboard conflict detection
- 🔒 Memory leak fixes
- ⚡ Performance optimizations
- 🎯 Enhanced Shorts detection
- 💾 Counter position persistence
- 🔔 Notification queue system

**See Full Changelog:**  
<https://github.com/or1n/or1n-userscripts-for-youtube-views-and-duration-filter/releases>

---

## License

MIT License - Free to use, modify, and distribute.

See LICENSE file for details.

---

Thank you for using or1n YouTube Filter! 🔥

For more help, visit our [GitHub repository](https://github.com/or1n/or1n-userscripts-for-youtube-views-and-duration-filter).
