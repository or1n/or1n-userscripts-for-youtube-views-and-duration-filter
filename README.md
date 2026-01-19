# 🔥 or1n YouTube Filter

Filter YouTube videos by view count, duration, and channel. Lightweight userscript with customizable settings, statistics tracking, and keyboard shortcuts.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-4.0.0-blue.svg)](https://github.com/or1n/or1n-userscripts-for-youtube-views-and-duration-filter/releases)

**[📥 Install](https://github.com/or1n/or1n-userscripts-for-youtube-views-and-duration-filter/raw/main/or1n-userscripts-for-youtube-views-and-duration-filter.js)** • **[Docs](USER_GUIDE.md)** • **[API](API_DOCUMENTATION.md)** • **[Contribute](CONTRIBUTING.md)**

## ✨ Features

- **Filter by**: View count (default: 99K+), Duration (default: 4min+), Channel whitelist/blacklist
- **Smart Logic**: AND/OR modes, live stream & Shorts handling
- **UI**: Draggable floating counter, customizable themes, keyboard shortcuts (`Ctrl+F`)
- **Stats**: Session and lifetime tracking, all stored locally
- **New in v4.0**: Export/Import settings, Auto-update checking, Whitelist/Blacklist history with undo, Advanced statistics dashboard, Bulk channel import, Performance metrics tracking, WCAG 2.1 AA accessibility, Memory leak detection
- **Customization**: Themes, fonts, animations, conflict detection
- **Performance**: Optimized with caching, debouncing, WeakSet tracking

## 🚀 Quick Start

1. **Install a userscript manager**: [Violentmonkey](https://violentmonkey.github.io/) or [Tampermonkey](https://www.tampermonkey.net/)
2. **[Install the script](https://github.com/or1n/or1n-userscripts-for-youtube-views-and-duration-filter/raw/main/or1n-userscripts-for-youtube-views-and-duration-filter.js)**
3. **Visit YouTube** → Counter appears in top-left

**Quick Actions:**

- `Ctrl+F` - Toggle counter
- Click ⚙️ - Settings
- Click ⋮ - Menu
- Right-click video → Whitelist/Blacklist

## ⚙️ Configuration

All settings in the counter UI. Common configs:

```javascript
// Quality content only
MIN_VIEWS: 100000, MIN_DURATION: 600, FILTER_MODE: 'AND'

// Remove Shorts & clips
FILTER_ALL_SHORTS: true, MIN_DURATION: 180

// Curated feed
ENABLE_WHITELIST: true, WHITELIST: ['@creator1', '@creator2']
```

Or via console: `GM_setValue('ytFilterConfig', {...}); location.reload();`

## 📚 Documentation

- **[USER_GUIDE.md](USER_GUIDE.md)** - How to use, settings reference, FAQ
- **[API_DOCUMENTATION.md](API_DOCUMENTATION.md)** - API & config reference
- **[CONTRIBUTING.md](CONTRIBUTING.md)** - Development setup & standards

## 🐛 Issues & Support

- **Bug Reports**: [GitHub Issues](https://github.com/or1n/or1n-userscripts-for-youtube-views-and-duration-filter/issues)
- **Questions**: Check [USER_GUIDE.md](USER_GUIDE.md) FAQ first

## 📄 License

MIT - See [LICENSE](LICENSE) for details.
