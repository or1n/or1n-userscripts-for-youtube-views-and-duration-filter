# API Documentation - or1n YouTube Filter v3.4.1

## Table of Contents

- [Core Configuration](#core-configuration)
- [Public API](#public-api)
- [Utility Functions](#utility-functions)
- [UI Components](#ui-components)
- [Storage API](#storage-api)
- [Event System](#event-system)
- [Constants](#constants)

---

## Core Configuration

### DEFAULT_CONFIG Object

Central configuration object with all customizable settings.

```javascript
const DEFAULT_CONFIG = {
    // Filter Thresholds
    MIN_VIEWS: 99999,                    // Minimum view count required
    MIN_DURATION_SECONDS: 240,           // Minimum duration in seconds
    
    // Performance
    DEBOUNCE_DELAY: 30,                  // Mutation processing delay (ms)
    
    // Debugging
    DEBUG: false,                        // Enable console logging
    
    // Animations & Effects
    SMOOTH_REMOVAL: false,               // Animate video removal
    REMOVAL_DURATION_MS: 300,            // Animation duration
    REMOVAL_SCALE: 0.95,                 // Scale during removal
    
    // Counter UI
    SHOW_COUNTER: true,                  // Display statistics counter
    COUNTER_DRAGGABLE: true,             // Enable counter dragging
    COUNTER_OPACITY: 95,                 // Counter transparency (0-100)
    COUNTER_PULSE_DURATION_MS: 200,      // Pulse animation duration
    COUNTER_PULSE_SCALE: 1.3,            // Pulse scale multiplier
    
    // Theme & Appearance
    THEME: 'dark',                       // 'dark' or 'light'
    FONT_FAMILY: 'Segoe UI',            // UI font family
    FONT_SIZE: 14,                       // Base font size (px)
    FONT_WEIGHT: 'normal',               // Font weight
    
    // Keyboard Shortcut
    KEYBOARD_SHORTCUT: 'KeyF',           // Toggle key
    USE_CTRL: true,                      // Ctrl modifier
    USE_ALT: false,                      // Alt modifier
    USE_SHIFT: false,                    // Shift modifier
    
    // Statistics
    ENABLE_STATISTICS: true,             // Track lifetime stats
    
    // Notifications
    SHOW_NOTIFICATIONS: true,            // Display notifications
    NOTIFICATION_DURATION_MS: 3000,      // Notification duration
    NOTIFICATION_FADE_MS: 300,           // Fade animation duration
    
    // Channel Lists
    WHITELIST: [],                       // Never filter these channels
    BLACKLIST: [],                       // Always filter these channels
    ENABLE_WHITELIST: false,             // Enable whitelist
    ENABLE_BLACKLIST: false,             // Enable blacklist
    CASE_INSENSITIVE_LISTS: true,        // Case-insensitive matching
    
    // Filter Logic
    FILTER_MODE: 'OR',                   // 'AND' or 'OR'
    SKIP_LIVE_STREAMS: true,             // Don't filter live videos
    FILTER_ALL_LIVE_STREAMS: false,      // Hide ALL live streams
    FILTER_ALL_SHORTS: false             // Hide ALL YouTube Shorts
};
```

---

## Public API

### Configuration Management

#### `loadConfig()`

Loads saved configuration from Greasemonkey storage.

**Returns:** `Object` - Merged configuration (defaults + saved)

**Example:**

```javascript
const config = loadConfig();
console.log(config.MIN_VIEWS); // 99999
```

#### `saveConfig(config)`

Saves configuration to Greasemonkey storage.

**Parameters:**

- `config` (Object) - Configuration object to save

**Example:**

```javascript
saveConfig({ ...CONFIG, MIN_VIEWS: 50000 });
```

#### `updateConfig(updates)`

Thread-safe configuration update wrapper.

**Parameters:**

- `updates` (Object) - Partial configuration to merge

**Example:**

```javascript
updateConfig({ 
    MIN_VIEWS: 100000,
    FILTER_ALL_SHORTS: true 
});
```

### Video Filtering

#### `filterVideos()`

Processes all video elements on the current page.

**Returns:** `void`

**Example:**

```javascript
// Manually trigger filtering
filterVideos();
```

#### `shouldFilterVideo(element)`

Determines if a video should be filtered.

**Parameters:**

- `element` (HTMLElement) - Video container element

**Returns:** `boolean` - true if video should be filtered

**Logic:**

1. Check whitelist (skip if whitelisted)
2. Check blacklist (filter if blacklisted)
3. Check live stream filters
4. Check Shorts filters
5. Apply view/duration thresholds

**Example:**

```javascript
const videoElement = document.querySelector('ytd-video-renderer');
if (shouldFilterVideo(videoElement)) {
    console.log('Video will be filtered');
}
```

#### `processVideoElement(video)`

Processes single video element.

**Parameters:**

- `video` (HTMLElement) - Video element to process

**Returns:** `boolean` - true if processed successfully

**Side Effects:**

- Adds to `state.processedVideos` WeakSet
- Calls `removeVideoElement()` if filtered

#### `removeVideoElement(element)`

Removes filtered video with optional animation.

**Parameters:**

- `element` (HTMLElement) - Video element to remove

**Side Effects:**

- Updates `state.filteredCount`
- Updates `state.sessionFiltered`
- Updates lifetime stats if enabled
- Calls `updateCounter()`

---

## Utility Functions

### Data Parsing

#### `parseViewCount(text)`

Parses view count strings with K/M/B multipliers.

**Parameters:**

- `text` (string) - View count text (e.g., "1.2M views")

**Returns:** `number` - Numeric view count

**Examples:**

```javascript
parseViewCount("1.2K views");  // 1200
parseViewCount("5M views");    // 5000000
parseViewCount("850 views");   // 850
```

**Supported Formats:**

- English: K (thousand), M (million), B (billion)
- Russian: Т/т (thousand), Л/л (million)

#### `timeToSeconds(timeStr)`

Converts time string to seconds.

**Parameters:**

- `timeStr` (string) - Duration string (e.g., "12:34")

**Returns:** `number` - Duration in seconds

**Examples:**

```javascript
timeToSeconds("12:34");     // 754
timeToSeconds("1:02:45");   // 3765
timeToSeconds("45");        // 45
```

### Channel Management

#### `extractChannelInfo(element)`

Extracts channel information from video element.

**Parameters:**

- `element` (HTMLElement) - Video container

**Returns:** `Object|null` - Channel info or null

```javascript
{
    id: string,      // Channel ID (e.g., "@channelname")
    name: string,    // Display name
    href: string     // Full URL
}
```

#### `normalizeChannelName(name)`

Normalizes channel name by removing prefixes.

**Parameters:**

- `name` (string) - Raw channel name

**Returns:** `string` - Normalized name

**Example:**

```javascript
normalizeChannelName("@TechChannel");  // "TechChannel"
normalizeChannelName("channel/UC...");  // "UC..."
```

### Conflict Detection

#### `detectShortcutConflicts()`

Detects keyboard shortcut conflicts.

**Returns:** `Object`

```javascript
{
    hasConflicts: boolean,
    conflicts: Array<{
        severity: 'high'|'medium',
        message: string,
        suggestion: string
    }>,
    shortcutStr: string
}
```

**Example:**

```javascript
const result = detectShortcutConflicts();
if (result.hasConflicts) {
    console.warn(result.conflicts[0].message);
}
```

---

## UI Components

### Counter

#### `createCounter()`

Creates floating statistics counter.

**Returns:** `HTMLElement` - Counter element

**Side Effects:**

- Appends to `document.body`
- Sets `state.counterElement`

**Components:**

- Header with title and buttons
- Stats display (session/lifetime)
- Filter info
- Quick menu
 
 **Behavior:**
 
 - Open on load controlled by `OPEN_COUNTER_ON_LOAD` (default: true)
 - Header toggle shows/hides the entire counter

#### `updateCounter()`

Updates counter display with current stats.

**Side Effects:**

- Updates session count
- Updates lifetime count
- Triggers pulse animation

#### `applyCounterStyle(counter)`

Applies theme-based styling to counter.

**Parameters:**

- `counter` (HTMLElement) - Counter element

### Settings Panel

#### `createSettingsPanel()`

Creates comprehensive settings UI.

**Returns:** `HTMLElement` - Settings panel element

**Sections:**

1. Filter Settings (views, duration)
2. Filter Logic (AND/OR mode)
3. Whitelist/Blacklist management
4. Appearance (theme, fonts)
5. Keyboard shortcuts
6. Statistics
7. Advanced options

#### `toggleSettingsPanel()`

Shows/hides settings panel.

**Returns:** `void`

### Notifications

#### `showNotification(message, duration)`

Displays toast notification with queue system.

**Parameters:**

- `message` (string) - Notification text
- `duration` (number) - Display duration in ms (default: 3000)

**Example:**

```javascript
showNotification('✓ Settings saved', 2000);
```

**Features:**

- Queue-based to prevent overlap
- Auto-dismissal
- Fade animations
- Accessibility support

---

## Storage API

### Greasemonkey Storage

#### `GM_getValue(key, defaultValue)`

Retrieves value from persistent storage.

**Parameters:**

- `key` (string) - Storage key
- `defaultValue` (any) - Fallback value

**Returns:** `any` - Stored value or default

**Used Keys:**

- `ytFilterConfig` - User configuration
- `lifetimeStats` - Statistics data
- `counterPosition` - Counter position

#### `GM_setValue(key, value)`

Saves value to persistent storage.

**Parameters:**

- `key` (string) - Storage key
- `value` (any) - Value to store

#### `saveStats()`

Saves lifetime statistics to storage.

**Example:**

```javascript
state.lifetimeStats.totalFiltered += 10;
saveStats();
```

---

## Event System

### MutationObserver

#### `setupObserver()`

Initializes DOM mutation observer.

**Features:**

- Debounced processing
- Watches for new video elements
- Handles dynamic content loading

### Keyboard Events

#### `setupKeyboardShortcuts()`

Registers keyboard shortcut handler.

**Default:** `Ctrl+F` (configurable)

**Action:** Toggles counter visibility

### YouTube Navigation

**Events Listened:**

- `yt-navigate-finish` - Page navigation
- `scroll` - Lazy loading detection

---

## Constants

### CONSTANTS Object

```javascript
const CONSTANTS = {
    CONFIRM_AUTO_DISMISS_MS: 6000,           // Confirmation timeout
    INIT_RETRY_DELAY_MS: 100,                // Initialization retry
    NAVIGATION_FILTER_DELAY_MS: 500,         // Post-navigation delay
    SCROLL_FILTER_DELAY_MS: 300,             // Scroll debounce
    COUNTER_FADE_DURATION_MS: 300,           // Counter fade duration
    PARENT_TRAVERSAL_MAX_DEPTH: 10,          // DOM traversal limit
    MAX_UNDO_HISTORY: 10,                    // Undo stack size
    YOUTUBE_SHORTCUTS: ['k', 'j', 'l', ...], // Native shortcuts
    NOTIFICATION_FADE_DELAY_MS: 10           // Notification delay
};
```

### VIDEO_SELECTORS Array

YouTube video container selectors:

```javascript
[
    'ytd-rich-item-renderer',
    'ytd-video-renderer',
    'ytd-grid-video-renderer',
    'ytd-compact-video-renderer',
    'ytd-playlist-video-renderer',
    'ytd-rich-grid-media',
    'yt-lockup-view-model',
    'ytd-reel-item-renderer'  // Shorts
]
```

### CACHED_SELECTORS Object

Pre-computed selectors for performance:

```javascript
{
    videoSelector: string,      // Joined video selectors
    channelLinks: string        // Channel link selector
}
```

---

## State Management

### state Object

Global application state:

```javascript
const state = {
    filteredCount: number,           // Total filtered this session
    sessionFiltered: number,         // Session filter count
    totalProcessed: number,          // Total videos processed
    processedVideos: WeakSet,        // Processed video cache
    observer: MutationObserver,      // DOM observer
    debounceTimer: number,           // Debounce timer ID
    counterElement: HTMLElement,     // Counter reference
    settingsPanel: HTMLElement,      // Settings reference
    notificationQueue: Array,        // Notification queue
    isShowingNotification: boolean,  // Notification state
    lifetimeStats: Object,           // Lifetime statistics
    counterPosition: Object          // Saved position
};
```

---

## Error Handling

All public functions include error handling:

```javascript
try {
    // Function logic
} catch (e) {
    log('⚠️ Error:', e.message);
    return fallbackValue;
}
```

**Features:**

- Try-catch boundaries
- Null checks
- Graceful degradation
- Fallback values

---

## Performance Considerations

### Optimization Techniques

1. **Selector Caching:** Pre-computed selectors stored in `CACHED_SELECTORS`
2. **Debouncing:** MutationObserver processing debounced (30ms default)
3. **WeakSet:** Processed videos tracked without memory leaks
4. **Event Delegation:** Minimal event listeners
5. **Animation Checks:** Respects `prefers-reduced-motion`

### Best Practices

- Use `updateConfig()` for thread-safe updates
- Call `filterVideos()` sparingly (handled automatically)
- Enable `DEBUG` mode only for troubleshooting
- Use higher `DEBOUNCE_DELAY` on slower devices

---

## Version Information

**Version:** 3.4.1  
**Release Date:** January 2026  
**License:** MIT  
**Author:** or1n

---

## Support

For API questions or feature requests:

- **GitHub Issues:** <https://github.com/or1n/or1n-userscripts-for-youtube-views-and-duration-filter/issues>
- **Documentation:** This file + USER_GUIDE.md
- **Contributing:** See CONTRIBUTING.md
