# Contributing to or1n YouTube Filter

## Getting Started

**Prerequisites:** Chrome/Firefox, userscript manager, git, text editor

**Setup:**

1. Fork repository
2. Clone: `git clone https://github.com/YOUR_USERNAME/or1n-userscripts-for-youtube-views-and-duration-filter.git`
3. Copy main script to your userscript manager
4. Make changes and test on YouTube

---

## Development Setup

1. Open userscript manager dashboard
2. Create new script (delete template)
3. Copy/paste `or1n-userscripts-for-youtube-views-and-duration-filter.js` content
4. Save and test on YouTube
5. Use F12 Console for debug logs

**Recommended Tools:**

- VS Code with ESLint extension
- Browser DevTools (F12)
- Git

---

## Coding Standards

### JavaScript Style

- **ES6+ Syntax** - Use modern features
- **No jQuery** - Vanilla JS only
- **No innerHTML** - Use `textContent` or DOM methods
- **Error handling** - Try-catch for critical functions
- **Naming:** `camelCase` for variables, `UPPER_SNAKE_CASE` for constants

### Formatting

- **Indentation:** 4 spaces (no tabs)
- **Line length:** Max 120 characters
- **Semicolons:** Always use them
- **Quotes:** Single quotes for strings
- **Braces:** K&R style (opening brace on same line)

### Comments

```javascript
/**
 * Function description
 * @param {type} name - Parameter description
 * @returns {type} Return description
 */
const myFunction = (name) => {
    // Implementation
};

// Section headers
// ==================== SECTION NAME ====================
```

### Best Practices

- Cache DOM selectors
- Debounce expensive operations
- Use WeakSet for element tracking
- Validate user input
- Null-check before DOM operations
- Optional chaining: `element?.value || 'default'`

---

## Making Changes

### Branch Strategy

- `feature/description` - New features
- `bugfix/description` - Bug fixes
- `docs/description` - Documentation
- `refactor/description` - Code cleanup

Example: `git checkout -b feature/export-settings`

### Commit Messages

```text
feat: add export settings feature
fix: resolve whitelist not persisting
docs: update keyboard shortcut examples
refactor: simplify filter logic
```

### Testing

1. Make changes
2. Test on YouTube (homepage, search, playlist, etc.)
3. Check browser console (F12 → Console)
4. Enable DEBUG mode for detailed logs
5. Test all affected features

---

## Project Structure

```text
or1n-userscripts-for-youtube-views-and-duration-filter/
├── or1n-userscripts-for-youtube-views-and-duration-filter.js  (Main script)
├── or1n-userscripts-for-youtube-views-and-duration-filter.meta.js
├── README.md                  (Overview)
├── USER_GUIDE.md             (User manual)
├── API_DOCUMENTATION.md      (API reference)
├── CONTRIBUTING.md           (This file)
└── LICENSE
```

### Script Organization

```javascript
(() => {
    'use strict';

    // DEFAULT_CONFIG - All configurable settings
    // VIDEO_SELECTORS - YouTube video element selectors
    // CONSTANTS - Magic numbers
    // STATE MANAGEMENT - Runtime state
    // UTILITY FUNCTIONS - Helpers (parsing, validation, etc.)
    // VIDEO FILTERING LOGIC - Core filtering
    // UI COMPONENTS - Counter, settings, notifications
    // INITIALIZATION - Setup and event listeners
})();
```

---

## Code Review Checklist

Before submitting PR:

- [ ] Code follows style guide
- [ ] No console errors/warnings in DEBUG mode
- [ ] Changes tested on multiple YouTube pages
- [ ] Comments added for complex logic
- [ ] No memory leaks (use WeakSet, avoid circular refs)
- [ ] Documentation updated if needed

---

## Submitting Changes

1. **Create branch:** `git checkout -b feature/your-feature`
2. **Make commits:** Keep commits focused and descriptive
3. **Push:** `git push origin feature/your-feature`
4. **Create PR:** Include description of changes
5. **Wait for review**

### PR Description Template

```text
## Description
Brief description of changes

## Type of Change
- [ ] Feature
- [ ] Bug fix
- [ ] Documentation
- [ ] Refactor

## Testing
Describe how you tested this change

## Screenshots
If applicable, add before/after screenshots
```

---

## Reporting Bugs

**Include:**

1. Browser and version
2. Userscript manager and version
3. Steps to reproduce
4. Expected vs actual behavior
5. Console errors (F12 → Console)
6. Screenshot if visual issue

**Example:**

```text
Browser: Chrome 120
Manager: Violentmonkey 9.15
Issue: Whitelist not persisting

Steps:
1. Add channel to whitelist
2. Refresh page
3. Whitelist is empty

Expected: Whitelist persists
Actual: Whitelist cleared after refresh

Console errors: None
```

---

## Feature Requests

**Before requesting:**

1. Check existing issues
2. Ensure it fits the scope (YouTube filtering)
3. Think about implementation

**Include:**

1. Use case (why you need it)
2. Expected behavior
3. Example configurations
4. Priority (nice-to-have, important, critical)

---

## Common Tasks

### Add a new configuration option

1. Add to `DEFAULT_CONFIG`
2. Add input field to settings panel
3. Add to `loadConfig()` / `saveConfig()`
4. Use `CONFIG.YOUR_OPTION` in filtering logic
5. Update USER_GUIDE.md

### Add a new utility function

1. Place in "UTILITY FUNCTIONS" section
2. Add JSDoc comments
3. Use in filtering logic
4. Test thoroughly
5. Add to API_DOCUMENTATION.md if public

### Fix a bug

1. Reproduce issue
2. Add console logs to debug
3. Fix in code
4. Test on all YouTube pages (homepage, search, playlist, etc.)
5. Commit with clear message

---

## Questions?

- Check [API_DOCUMENTATION.md](API_DOCUMENTATION.md)
- Check [USER_GUIDE.md](USER_GUIDE.md)
- Open [GitHub issue](https://github.com/or1n/or1n-userscripts-for-youtube-views-and-duration-filter/issues)

---

## Code of Conduct

- Be respectful and constructive
- Accept feedback gracefully
- Help other contributors
- No harassment or discrimination
