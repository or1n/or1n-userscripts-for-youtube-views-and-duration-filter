# User Guide - or1n YouTube Filter v4.0

## Installation

**Requirements:** Chrome, Firefox, Edge + [Violentmonkey](https://violentmonkey.github.io/) or [Tampermonkey](https://www.tampermonkey.net/)

**Steps:**

1. Install userscript manager
2. [Click to install script](https://github.com/or1n/or1n-userscripts-for-youtube-views-and-duration-filter/raw/main/or1n-userscripts-for-youtube-views-and-duration-filter.js)
3. Visit YouTube

---

## What's New in v4.0

**8 Major Features:**

- 💾 Export/Import settings as JSON for backup and sharing
- 🔄 Auto-update checking (notified when new version available)
- ↶ Undo last 10 whitelist/blacklist changes
- 📊 Advanced statistics dashboard (breakdown by reason, channel, date)
- 📋 Bulk channel import (paste 100+ channels at once)
- ⚡ Performance metrics tracking (query timing, batch stats)
- ♿ WCAG 2.1 AA accessibility (ARIA labels, keyboard nav, color contrast)
- 💾 Memory leak detection (monitor event listener health)

---

## Quick Start

A floating counter appears in the top-left. Default: hide videos < 99K views OR < 4 min.

**Controls:**

- `Ctrl+F` - Toggle counter visibility
- Click ⚙️ - Open settings
- Click ⋮ - Menu (whitelist, blacklist, force filter, etc.)
- Right-click video → Add to whitelist/blacklist

---

## Settings Guide

Open via ⚙️ button or `Ctrl+F` then ⚙️.

### Filter Settings

- **Min Views:** Default 99,999 (set to 0 to disable)
- **Min Duration:** Default 240s / 4 min (set to 0 to disable)

### Filter Logic

- **AND Mode:** Hide only if BOTH conditions fail (lenient)
- **OR Mode:** Hide if EITHER condition fails (aggressive, default)

### Whitelist & Blacklist

- **Whitelist:** Never filter videos from these channels
- **Blacklist:** Always filter videos from these channels
- Add via menu or manually in settings
- Enable "Case-insensitive matching" to catch name variations

### Content Filters

- **Skip LIVE:** Don't filter active livestreams (default: ON)
- **Filter ALL LIVE:** Hide all livestreams regardless
- **Filter ALL Shorts:** Hide all YouTube Shorts

### Appearance

- **Theme:** Dark (default) or Light
- **Font:** 7 options, size 10-20px, weight: normal/bold/light/600
- **Opacity:** 50-100%
- **Draggable:** Move counter by clicking header
- **Open on Load:** Auto-open counter when loading YouTube

### Keyboard Shortcut

Default: `Ctrl+F`

- Select modifiers: Ctrl, Alt, Shift
- Select key: F, H, Y, Q
- Warnings show for conflicts with YouTube/browser shortcuts

### Advanced

- **Smooth Removal:** Fade animation on filtering (toggle for performance)
- **Debounce Delay:** Higher = slower processing but less CPU
- **Debug Mode:** Logs to browser console
- **Export/Import:** Back up and restore all settings (see v4.0 features below)
- **Performance Tracking:** Enable to monitor query timing
- **Detailed Statistics:** Track filters by reason, channel, and date
- **Memory Diagnostics:** Check event listener health

---

## v4.0 Features Guide

### Export/Import Settings

**Export:**

1. Open settings (⚙️)
2. Scroll to "Export/Import Settings"
3. Click "Export Settings to Clipboard"
4. Settings copied as JSON

**Import:**

1. Open settings (⚙️)
2. Paste previously exported JSON in textarea
3. Click "Import Settings"
4. Settings restored and UI reinitialized

### Auto-Update Checking

- Automatically checks GitHub for newer versions (once per hour)
- Shows notification if update available
- No manual action required

### Whitelist/Blacklist Undo

- Last 10 changes tracked for each list
- Click "Undo Last Change" button in history section
- Reverts to previous state

### Advanced Statistics

- Click "View Detailed Stats" to see breakdown:
  - **By Reason:** views, duration, live, shorts, blacklist counts
  - **By Channel:** Top 10 channels filtered (most to least)
  - **By Date:** Last 7 days of activity
- Stats logged to console (F12)
- Clear all stats with confirmation

### Bulk Channel Import

1. Open settings (⚙️)
2. Paste channels (comma or newline separated): `@channel1, @channel2` or each on new line
3. Select Whitelist or Blacklist
4. Click "Import Channels"
5. All entries added and history tracked

### Performance Metrics

1. Enable "Enable Performance Tracking" in Performance Metrics section
2. Click "View Metrics" to see:
   - Query call counts by selector name
   - Batch processing statistics
   - Total batches and items/batch
3. Data logged to console

### Accessibility (WCAG 2.1 AA)

- Full keyboard navigation support
- ARIA labels on all controls
- Color contrast ≥4.5:1 throughout
- Focus indicators (2px blue outline)
- Screen reader compatible

### Memory Diagnostics

1. Open settings (⚙️)
2. Scroll to "Memory & Diagnostics"
3. Click "Check Memory Health"
4. See event listener count and last check time
5. Alert if count exceeds safe threshold (100)

---

## Common Configurations

**Quality Content Only:**

```javascript
MIN_VIEWS: 100000, MIN_DURATION: 600, FILTER_MODE: 'AND'
```

**Remove Shorts & Clips:**

```javascript
FILTER_ALL_SHORTS: true, MIN_DURATION: 180
```

**Curated Feed (Favorites Only):**

```javascript
ENABLE_WHITELIST: true, WHITELIST: ['@creator1', '@creator2']
```

**Popular Videos:**

```javascript
MIN_VIEWS: 1000000, MIN_DURATION: 0
```

---

## Troubleshooting

**Videos not filtering?**

- Check thresholds in settings
- Verify channel isn't whitelisted
- Click ⋮ → "Force Filter" to reprocess
- Enable Debug mode (F12 → Console) to see logs

**Counter not visible?**

- Press `Ctrl+F` to toggle
- Check settings to confirm SHOW_COUNTER is enabled
- Refresh page

**Settings not saving?**

- Check F12 → Console for errors
- Verify userscript manager has permissions
- Try reinstalling script

**Performance issues?**

- Increase DEBOUNCE_DELAY (Settings → Advanced)
- Disable SMOOTH_REMOVAL
- Disable DEBUG mode

---

## FAQ

**Q: Is it safe?**
A: Yes. Open-source MIT, runs locally, no data collection.

**Q: Does YouTube detect it?**
A: No. Client-side only, no server communication.

**Q: Can I export settings?**
A: Via console: `console.log(GM_getValue('ytFilterConfig'))`

**Q: Do filters work on search results?**
A: Yes, all YouTube pages.

**Q: Can I sync settings across devices?**
A: Not natively. Export/import manually via console.

**Q: How do I find a channel ID?**
A: Visit channel → Copy @name or ID from URL.

**Q: Can I add multiple channels at once?**
A: Not via UI. Use console: `GM_setValue('ytFilterConfig', {WHITELIST: ['@ch1', '@ch2']}); location.reload();`

---

## Advanced Tips

1. **Combine filters:** High view count + whitelist for curated feed
2. **Force reprocess:** Use ⋮ menu → "Force Filter" after changing settings
3. **Save position:** Counter position auto-saves when dragged
4. **Batch operations:** Use menu commands for quick channel actions
5. **Debug workflow:** Enable Debug, check F12 console for filtering logs

---

## Getting Help

- **Issues:** [GitHub Issues](https://github.com/or1n/or1n-userscripts-for-youtube-views-and-duration-filter/issues)
- **API Docs:** [API_DOCUMENTATION.md](API_DOCUMENTATION.md)
- **Contributing:** [CONTRIBUTING.md](CONTRIBUTING.md)
