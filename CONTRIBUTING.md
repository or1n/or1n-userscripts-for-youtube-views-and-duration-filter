# Contributing to or1n YouTube Filter

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Coding Standards](#coding-standards)
- [Making Changes](#making-changes)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Features](#suggesting-features)

---

## Code of Conduct

### Our Standards

- Be respectful and inclusive
- Provide constructive feedback
- Accept constructive criticism gracefully
- Focus on what's best for the community
- Show empathy towards others

### Unacceptable Behavior

- Harassment or discriminatory language
- Trolling or insulting comments
- Personal or political attacks
- Publishing others' private information
- Other conduct inappropriate in a professional setting

---

## Getting Started

### Prerequisites

- Modern browser (Chrome, Firefox, Edge)
- Userscript manager (Violentmonkey, Tampermonkey)
- Git installed
- Text editor (VS Code recommended)
- Basic JavaScript knowledge

### Fork and Clone

1. **Fork the Repository**
   - Visit: <https://github.com/or1n/or1n-userscripts-for-youtube-views-and-duration-filter>
   - Click "Fork" button (top right)

2. **Clone Your Fork**

   ```bash
   git clone https://github.com/YOUR-USERNAME/or1n-userscripts-for-youtube-views-and-duration-filter.git
   cd or1n-userscripts-for-youtube-views-and-duration-filter
   ```

3. **Add Upstream Remote**

   ```bash
   git remote add upstream https://github.com/or1n/or1n-userscripts-for-youtube-views-and-duration-filter.git
   ```

---

## Development Setup

### Installing Development Version

1. **Open Userscript Manager Dashboard**
   - Click extension icon → Dashboard

2. **Create New Script**
   - Click "+" button
   - Delete template code

3. **Copy Development Code**
   - Copy contents of `or1n-userscripts-for-youtube-views-and-duration-filter.js`
   - Paste into editor

4. **Enable Dev Mode**
   - Add to top of script:

   ```javascript
   const DEFAULT_CONFIG = {
       DEBUG: true,  // Enable console logging
       // ... rest of config
   };
   ```

5. **Save and Test**
   - Visit YouTube
   - Open browser console (F12)
   - Look for debug messages

### Recommended Tools

**VS Code Extensions:**

- ESLint (code quality)
- Prettier (code formatting)
- JavaScript (ES6) code snippets
- GitLens (git integration)

**Browser DevTools:**

- Console (debug logging)
- Elements (inspect DOM)
- Network (monitor requests)
- Performance (profiling)

---

## Project Structure

### File Organization

```text
or1n-userscripts-for-youtube-views-and-duration-filter/
├── or1n-userscripts-for-youtube-views-and-duration-filter.js  # Main script
├── README.md                      # Project overview
├── LICENSE                        # MIT license
├── API_DOCUMENTATION.md           # API reference
├── USER_GUIDE.md                  # User manual
├── CONTRIBUTING.md                # This file
├── CODE_ANALYSIS_REPORT.md        # Quality report
└── CODE_QUALITY_FINAL_REPORT.md   # Final audit
```

### Code Structure

**Main Script Organization:**

```javascript
// ==UserScript== metadata
// ├── @name, @version, @description
// ├── @author, @license, @homepage
// ├── @match, @icon, @grant
// └── @run-at

(() => {
    'use strict';
    
    // 1. DEFAULT CONFIGURATION
    // 2. CONSTANTS & SELECTORS
    // 3. CONFIGURATION MANAGEMENT
    // 4. STATE MANAGEMENT
    // 5. UTILITY FUNCTIONS
    // 6. VIDEO FILTERING LOGIC
    // 7. UI COMPONENTS
    //    ├── Counter
    //    └── Settings Panel
    // 8. KEYBOARD SHORTCUTS
    // 9. STYLES
    // 10. OBSERVER SETUP
    // 11. INITIALIZATION
})();
```

### Key Components

**Configuration (`DEFAULT_CONFIG`):**

- All user-configurable settings
- Well-documented with comments
- Loaded/saved via GM API

**State Management (`state`):**

- Runtime application state
- Cached elements
- Statistics tracking

**Utility Functions:**

- Data parsing (views, duration)
- Channel management
- Conflict detection
- Logging

**Filtering Logic:**

- Video detection
- Filter rule application
- DOM manipulation

**UI Components:**

- Counter creation/update
- Settings panel
- Notifications
- Quick menu

---

## Coding Standards

### JavaScript Style Guide

#### General Principles

- **ES6+ Syntax:** Use modern JavaScript
- **No jQuery:** Vanilla JS only
- **Trusted Types:** No innerHTML usage
- **Functional:** Prefer pure functions
- **Defensive:** Check nulls, handle errors

#### Naming Conventions

**Variables & Functions (camelCase):**

```javascript
const minViews = 100000;
const parseViewCount = (text) => {};
```

**Constants (UPPER_SNAKE_CASE):**

```javascript
const DEFAULT_CONFIG = {};
const CONSTANTS = { MAX_DEPTH: 10 };
```

**Private Functions (leading underscore):**

```javascript
const _internalHelper = () => {};
```

**DOM Elements (descriptive):**

```javascript
const counter = document.createElement('div');
const settingsPanel = document.createElement('div');
```

#### Code Formatting

**Indentation:** 4 spaces (no tabs)

**Line Length:** Max 120 characters

**Semicolons:** Always use them

**Quotes:** Single quotes for strings

**Braces:** K&R style

```javascript
if (condition) {
    // code
} else {
    // code
}
```

**Arrow Functions:**

```javascript
// Single parameter
const square = x => x * x;

// Multiple parameters
const add = (a, b) => a + b;

// Block body
const complex = (x) => {
    const result = x * 2;
    return result + 1;
};
```

#### Comments

**Function Documentation:**

```javascript
/**
 * Parse view count strings with K/M/B multipliers
 * @param {string} text - View count text (e.g., "1.2M views")
 * @returns {number} Numeric view count
 */
const parseViewCount = (text) => {
    // Implementation
};
```

**Inline Comments:**

```javascript
// Check whitelist first (performance optimization)
if (CONFIG.ENABLE_WHITELIST && channelInfo) {
    // Logic
}
```

**Section Headers:**

```javascript
// ==================== VIDEO FILTERING LOGIC ====================
```

### Best Practices

#### Error Handling

**Always Use Try-Catch:**

```javascript
const safeFunction = () => {
    try {
        // Risky operations
        return result;
    } catch (e) {
        log('⚠️ Error in safeFunction:', e.message);
        return fallbackValue;
    }
};
```

#### Null Checks

**Before DOM Operations:**

```javascript
const element = document.querySelector('#some-id');
if (!element) return;

element.textContent = 'Safe';
```

**Optional Chaining:**

```javascript
const value = document.querySelector('#input')?.value || 'default';
```

#### Performance

**Cache Selectors:**

```javascript
// ❌ Bad
document.querySelectorAll('.video').forEach(...);
document.querySelectorAll('.video').forEach(...);

// ✅ Good
const videos = document.querySelectorAll('.video');
videos.forEach(...);
videos.forEach(...);
```

**Debounce Expensive Operations:**

```javascript
const debounce = (func, delay) => {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => func(...args), delay);
    };
};

const expensiveOp = debounce(filterVideos, 300);
```

**Use WeakSet for Tracking:**

```javascript
// Prevents memory leaks
const processedVideos = new WeakSet();
processedVideos.add(element);
if (processedVideos.has(element)) return;
```

#### Security

**No eval() or Function():**

```javascript
// ❌ Never do this
eval(userInput);
new Function(userInput)();

// ✅ Parse safely
const parsed = JSON.parse(userInput);
```

**Validate User Input:**

```javascript
const minViews = Math.max(0, parseInt(input.value) || 0);
const fontSize = Math.max(10, Math.min(20, parseInt(input.value) || 14));
```

**Sanitize DOM Insertion:**

```javascript
// ❌ XSS vulnerability
element.innerHTML = userInput;

// ✅ Safe
element.textContent = userInput;
// or
const text = document.createTextNode(userInput);
element.appendChild(text);
```

---

## Making Changes

### Branch Strategy

**Branch Naming:**

- `feature/description` - New features
- `bugfix/description` - Bug fixes
- `hotfix/description` - Critical fixes
- `docs/description` - Documentation
- `refactor/description` - Code refactoring

**Example:**

```bash
git checkout -b feature/export-import-config
```

### Development Workflow

1. **Create Branch**

   ```bash
   git checkout -b feature/my-feature
   ```

2. **Make Changes**
   - Edit code
   - Follow coding standards
   - Add comments
   - Update documentation

3. **Test Thoroughly**
   - Manual testing on YouTube
   - Check console for errors
   - Test edge cases
   - Verify existing features work

4. **Commit Changes**

   ```bash
   git add .
   git commit -m "feat: add export/import config feature"
   ```

5. **Push to Fork**

   ```bash
   git push origin feature/my-feature
   ```

### Commit Message Format

**Structure:**

```text
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**

- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation
- `style` - Formatting (no code change)
- `refactor` - Code refactoring
- `perf` - Performance improvement
- `test` - Adding tests
- `chore` - Maintenance

**Examples:**

```text
feat(filter): add regex pattern matching for channels

- Allows users to use regex in whitelist/blacklist
- Adds validation for regex syntax
- Updates settings UI with pattern examples

Closes #42
```

```text
fix(counter): prevent memory leak in event listeners

- Added cleanup in closeCounter function
- Store handlers as _handler properties
- Remove all listeners before DOM removal

Fixes #123
```

### Code Review Checklist

Before submitting:

- [ ] Code follows style guide
- [ ] Functions are documented
- [ ] Error handling added
- [ ] Null checks present
- [ ] No magic numbers (use constants)
- [ ] No code duplication
- [ ] Performance optimized
- [ ] Security validated
- [ ] Console has no errors
- [ ] Existing features work
- [ ] Documentation updated

---

## Testing

### Manual Testing

**Test Checklist:**

1. **Installation**
   - Fresh install works
   - Update from previous version works

2. **Core Filtering**
   - View count filter works
   - Duration filter works
   - AND/OR modes work correctly
   - Live stream handling works
   - Shorts filtering works

3. **Whitelist/Blacklist**
   - Add channel works
   - Remove channel works
   - Filtering respects lists
   - Case-insensitive matching works

4. **UI Components**
   - Counter displays correctly
   - Settings panel opens/closes
   - All inputs work
   - Validation works
   - Keyboard shortcuts work
   - Notifications display

5. **Cross-Browser**
   - Chrome/Chromium
   - Firefox
   - Edge
   - Opera (if possible)

6. **Edge Cases**
   - Empty YouTube page
   - No videos match filters
   - All videos filtered
   - Rapid page navigation
   - Slow network connection

### Browser Console Testing

**Enable Debug Mode:**

```javascript
CONFIG.DEBUG = true;
```

**Watch for:**

- No errors in console
- Debug logs show expected behavior
- Performance warnings
- Memory leaks (use Chrome DevTools)

### Performance Testing

**Profile with DevTools:**

1. Open Performance tab
2. Start recording
3. Navigate YouTube
4. Stop recording
5. Analyze:
   - JavaScript execution time
   - DOM manipulation cost
   - Memory usage
   - FPS (should stay 60)

---

## Submitting Changes

### Pull Request Process

1. **Update Documentation**
   - Update README.md if needed
   - Update API_DOCUMENTATION.md for API changes
   - Update USER_GUIDE.md for user-facing changes
   - Add entry to CHANGELOG (if exists)

2. **Sync with Upstream**

   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

3. **Push to Fork**

   ```bash
   git push origin feature/my-feature
   ```

4. **Create Pull Request**
   - Go to GitHub repository
   - Click "Pull requests" → "New pull request"
   - Select your fork and branch
   - Fill in template:

### Pull Request Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix (non-breaking change fixing an issue)
- [ ] New feature (non-breaking change adding functionality)
- [ ] Breaking change (fix or feature causing existing functionality to break)
- [ ] Documentation update

## Testing
Describe testing performed:
- [ ] Manual testing on YouTube
- [ ] Tested in Chrome
- [ ] Tested in Firefox
- [ ] No console errors
- [ ] Existing features work

## Checklist
- [ ] Code follows project style guide
- [ ] Self-review performed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] No new warnings generated
- [ ] Tests pass

## Screenshots (if applicable)
Add screenshots showing changes

## Related Issues
Closes #(issue number)
```

### Review Process

**What to Expect:**

1. Automated checks (if set up)
2. Code review by maintainer
3. Requested changes (if needed)
4. Approval
5. Merge to main

**Response Time:**

- Initial review: 1-7 days
- Follow-up: 1-3 days

---

## Reporting Bugs

### Before Reporting

1. **Search Existing Issues**
   - Check if already reported
   - Read similar issues
   - Check if fixed in latest version

2. **Verify Bug**
   - Test in incognito mode
   - Disable other extensions
   - Test in different browser
   - Check if YouTube-related

### Bug Report Template

```markdown
**Describe the Bug**
Clear and concise description

**To Reproduce**
Steps to reproduce:
1. Go to '...'
2. Click on '...'
3. Scroll down to '...'
4. See error

**Expected Behavior**
What should happen

**Screenshots**
If applicable, add screenshots

**Environment:**
- OS: [e.g., Windows 11]
- Browser: [e.g., Chrome 120]
- Userscript Manager: [e.g., Violentmonkey 2.15.0]
- Script Version: [e.g., 3.4.1]

**Console Errors**
```

Paste console errors here

```text

**Additional Context**
Any other relevant information
```

### Priority Labels

Maintainers will add labels:

- `critical` - Breaks core functionality
- `high` - Major issue affecting many users
- `medium` - Noticeable issue, workaround exists
- `low` - Minor issue, cosmetic

---

## Suggesting Features

### Before Suggesting

1. **Check Existing Issues**
   - Look for similar requests
   - Check if already planned
   - Read project roadmap (if exists)

2. **Consider Scope**
   - Does it fit project goals?
   - Is it broadly useful?
   - Is it technically feasible?

### Feature Request Template

```markdown
**Feature Description**
Clear description of proposed feature

**Use Case**
Explain why this feature is needed:
- Who would use it?
- What problem does it solve?
- How often would it be used?

**Proposed Solution**
Describe how you envision this working

**Alternatives Considered**
Other approaches you've thought about

**Additional Context**
- Mockups/screenshots
- Code examples
- Links to similar implementations
```

### Feature Discussion

**Engagement:**

- Maintainer may ask clarifying questions
- Community feedback welcome
- Implementation timeline discussed
- Assigned to milestone (if approved)

---

## Development Tips

### Debugging Techniques

**1. Console Logging:**

```javascript
log('🔍 Checking video:', element);
log('📊 Parsed views:', viewCount);
log('⚙️ Current config:', CONFIG);
```

**2. Breakpoints:**

- Use browser debugger
- Add `debugger;` statement
- Inspect variables at runtime

**3. DOM Inspection:**

```javascript
console.log('Element:', element);
console.log('Children:', element.children);
console.log('Computed style:', getComputedStyle(element));
```

**4. Performance Profiling:**

```javascript
console.time('filterVideos');
filterVideos();
console.timeEnd('filterVideos');
```

### Common Pitfalls

#### 1. YouTube DOM Changes

- YouTube frequently updates their HTML
- Selectors may break
- Always test with latest YouTube

#### 2. Async Issues

- Use MutationObserver for dynamic content
- Be aware of timing
- Debounce expensive operations

#### 3. Memory Leaks

- Always remove event listeners
- Use WeakSet for element tracking
- Clear timers on cleanup

#### 4. Cross-Browser Compatibility

- Test in multiple browsers
- Use standard APIs
- Avoid browser-specific features

### Useful Resources

**JavaScript:**

- [MDN Web Docs](https://developer.mozilla.org/)
- [JavaScript.info](https://javascript.info/)

**Greasemonkey API:**

- [Violentmonkey API](https://violentmonkey.github.io/api/)
- [Tampermonkey Documentation](https://www.tampermonkey.net/documentation.php)

**YouTube:**

- [YouTube API](https://developers.google.com/youtube)
- [YouTube DOM structure](https://www.youtube.com) (inspect elements)

---

## Recognition

### Contributors

All contributors will be:

- Listed in CONTRIBUTORS.md (if we create one)
- Credited in release notes
- Mentioned in project README

### Types of Contributions

We appreciate all contributions:

- **Code:** Features, fixes, refactoring
- **Documentation:** Guides, API docs, examples
- **Testing:** Bug reports, testing, feedback
- **Design:** UI/UX improvements, mockups
- **Community:** Helping others, answering questions

---

## Questions?

**Need Help?**

- Open a discussion on GitHub
- Comment on relevant issue
- Check existing documentation
- Ask in pull request

**Contact:**

- GitHub Issues: <https://github.com/or1n/or1n-userscripts-for-youtube-views-and-duration-filter/issues>
- Project: <https://github.com/or1n/or1n-userscripts-for-youtube-views-and-duration-filter>

---

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to or1n YouTube Filter! 🎉

Your contributions help make YouTube a better experience for everyone.
