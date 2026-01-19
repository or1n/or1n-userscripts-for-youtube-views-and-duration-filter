# API Documentation - or1n YouTube Filter

## Configuration

```javascript
const DEFAULT_CONFIG = {
    // Filtering
    MIN_VIEWS: 99999,
    MIN_DURATION_SECONDS: 240,
    FILTER_MODE: 'OR',              // 'AND' or 'OR'
    SKIP_LIVE_STREAMS: true,
    FILTER_ALL_LIVE_STREAMS: false,
    FILTER_ALL_SHORTS: false,

    // Channel Lists
    WHITELIST: [],
    BLACKLIST: [],
    ENABLE_WHITELIST: false,
    ENABLE_BLACKLIST: false,
    CASE_INSENSITIVE_LISTS: true,

    // UI
    SHOW_COUNTER: true,
    OPEN_COUNTER_ON_LOAD: false,
    COUNTER_DRAGGABLE: true,
    COUNTER_OPACITY: 95,
    THEME: 'dark',
    FONT_FAMILY: 'Segoe UI',
    FONT_SIZE: 14,
    FONT_WEIGHT: 'normal',

    // Keyboard
    KEYBOARD_SHORTCUT: 'KeyF',
    USE_CTRL: true,
    USE_ALT: false,
    USE_SHIFT: false,

    // Performance
    DEBOUNCE_DELAY: 30,
    SMOOTH_REMOVAL: false,
    REMOVAL_DURATION_MS: 300,

    // Statistics & Notifications
    ENABLE_STATISTICS: true,
    SHOW_NOTIFICATIONS: true,
    NOTIFICATION_DURATION_MS: 3000,

    // v4.0 Features
    ENABLE_DETAILED_STATS: true,          // Track filter reasons, channels, dates
    ENABLE_PERFORMANCE_METRICS: false,    // Track DOM query timing and batch stats

    DEBUG: false
};
```

---

## Core Functions

### Configuration Management

**`loadConfig()`** - Load saved settings from storage  
**`saveConfig(config)`** - Save settings to storage  
**`updateConfig(updates)`** - Thread-safe partial update

### v4.0 Feature Functions

**`exportSettings()`** - Copy all settings/stats to clipboard as JSON  
**`importSettings(jsonString)`** - Restore settings from JSON string  
**`checkForUpdates()`** - Check GitHub for newer version (hourly max)  
**`addToHistory(array, entry)`** - Track changes with max 10 items  
**`undoLastListChange(listType)`** - Undo last whitelist/blacklist change  
**`recordFilterReason(element, reason, channelInfo)`** - Track why videos filtered  
**`measureQuery(name, queryFn)`** - Track selector performance timing  
**`checkMemoryHealth()`** - Monitor event listener count and health

### Video Filtering

**`filterVideos()`** - Process all videos on page  
**`shouldFilterVideo(element)`** - Check if video should be filtered  
**`processVideoElement(video)`** - Filter single video

### UI Components

**`createCounter()`** - Create floating statistics counter  
**`updateCounter()`** - Update counter display  
**`toggleSettingsPanel()`** - Show/hide settings  
**`showNotification(message, duration)`** - Display toast

---

## Utility Functions

### Data Parsing

```javascript
// Parse "1.2K views" → 1200
parseViewCount(text)

// Parse "12:34" → 754 seconds
timeToSeconds(timeStr)
```

### Channel Management

```javascript
// Extract channel info from video element
extractChannelInfo(element)  // Returns {id, name, href} or null

// Normalize channel name (remove @, channel/)
normalizeChannelName(name)
```

### Other Utilities

```javascript
// Debounce function for performance
debounce(func, delay)

// Detect keyboard shortcut conflicts
detectShortcutConflicts()  // Returns {hasConflicts, conflicts[], shortcutStr}

// Log messages (if DEBUG enabled)
log(...args)
```

---

## Storage API

```javascript
// Get value from persistent storage
GM_getValue(key, defaultValue)

// Set value in persistent storage
GM_setValue(key, value)

// Used keys:
// 'ytFilterConfig'  - User settings
// 'lifetimeStats'   - Statistics data
// 'counterPosition'  - Counter position
```

---

## Event System

**MutationObserver** - Watches for new video elements  
**Keyboard Events** - `setupKeyboardShortcuts()` listens for shortcut  
**YouTube Navigation** - `yt-navigate-finish` event  
**Scroll Events** - Lazy-loaded content detection

---

## Constants

```javascript
const CONSTANTS = {
    CONFIRM_AUTO_DISMISS_MS: 6000,
    INIT_RETRY_DELAY_MS: 100,
    NAVIGATION_FILTER_DELAY_MS: 500,
    SCROLL_FILTER_DELAY_MS: 300,
    COUNTER_FADE_DURATION_MS: 300,
    PARENT_TRAVERSAL_MAX_DEPTH: 10,
    YOUTUBE_SHORTCUTS: ['k', 'j', 'l', 'f', 'm', 'c', 'i', 't', 'p', 'y']
};

const VIDEO_SELECTORS = [
    'ytd-rich-item-renderer', 'ytd-video-renderer', 'ytd-grid-video-renderer',
    'ytd-compact-video-renderer', 'ytd-playlist-video-renderer', 'ytd-rich-grid-media',
    'yt-lockup-view-model', 'ytd-reel-item-renderer'
];
```

---

## Performance Tips

- Use `updateConfig()` for thread-safe updates
- Cache frequently accessed elements
- Enable `DEBUG` mode only for troubleshooting
- Higher `DEBOUNCE_DELAY` = less CPU on slower devices
- `SMOOTH_REMOVAL: false` for instant filtering (faster)

---

## Browser Compatibility

- Chrome 90+
- Firefox 88+
- Edge 90+
- Opera 76+

Requires Violentmonkey, Tampermonkey, or Greasemonkey.

---

## Version

**4.0.0** - January 2026  
**License:** MIT  
**Author:** or1n

### What's New in v4.0

**8 Major Features Added:**

1. **Export/Import Settings** - Backup and restore all configurations as JSON
2. **Auto-Update Version Checking** - Notification when new versions available
3. **History/Undo** - Track and undo last 10 whitelist/blacklist changes
4. **Advanced Statistics Dashboard** - Detailed breakdown by reason, channel, date
5. **Bulk Channel Import** - Import 100+ channels at once (CSV/newline format)
6. **DOM Query Performance Metrics** - Track selector timing and batch stats
7. **WCAG 2.1 AA Accessibility** - ARIA labels, keyboard nav, color contrast fixes
8. **Memory Leak Detection** - Monitor event listeners and WeakSet health
