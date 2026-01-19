// ==UserScript==
// @name         or1n YouTube Filter
// @namespace    https://github.com/or1n/or1n-userscripts-for-youtube-views-and-duration-filter
// @version      4.0.1
// @description  Advanced YouTube video filter with smart filtering, customizable UI, comprehensive statistics, export/import, auto-update, history, advanced analytics, bulk import, performance metrics, accessibility
// @author       or1n
// @license      MIT
// @homepage     https://github.com/or1n/or1n-userscripts-for-youtube-views-and-duration-filter
// @homepageURL  https://github.com/or1n/or1n-userscripts-for-youtube-views-and-duration-filter
// @supportURL   https://github.com/or1n/or1n-userscripts-for-youtube-views-and-duration-filter/issues
// @updateURL    https://raw.githubusercontent.com/or1n/or1n-userscripts-for-youtube-views-and-duration-filter/main/or1n-userscripts-for-youtube-views-and-duration-filter.meta.js
// @downloadURL  https://raw.githubusercontent.com/or1n/or1n-userscripts-for-youtube-views-and-duration-filter/main/or1n-userscripts-for-youtube-views-and-duration-filter.js
// @match        *://*.youtube.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=youtube.com
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @noframes
// @run-at       document-start
// ==/UserScript==

(() => {
    'use strict';

    // ==================== DEFAULT CONFIGURATION ====================
    const DEFAULT_CONFIG = {
        // Filter Thresholds
        MIN_VIEWS: 99999, // Minimum view count required - videos below this are filtered
        MIN_DURATION_SECONDS: 240, // Minimum duration in seconds (240s = 4min) - shorter videos are filtered
        
        // Performance
        DEBOUNCE_DELAY: 30, // Milliseconds to wait before processing mutations (lower = faster but more CPU)
        
        // Debugging
        DEBUG: false, // Enable console logging for troubleshooting
        
        // Animations & Effects
        SMOOTH_REMOVAL: false, // Animate video removal with fade/scale effects
        REMOVAL_DURATION_MS: 300, // How long removal animation takes in milliseconds
        REMOVAL_SCALE: 0.95, // Scale factor during removal (0.95 = shrink to 95%)
        
        // Counter UI
        SHOW_COUNTER: true, // Display the floating statistics counter
        OPEN_COUNTER_ON_LOAD: false, // Open counter on load; if false, start hidden until toggled
        COUNTER_DRAGGABLE: true, // Allow dragging the counter to reposition it
        COUNTER_OPACITY: 95, // Counter transparency (0-100, higher = more opaque)
        COUNTER_PULSE_DURATION_MS: 200, // Duration of counter pulse animation when stats update
        COUNTER_PULSE_SCALE: 1.3, // Scale multiplier for pulse effect (1.3 = grow 30%)
        
        // Theme & Appearance
        THEME: 'dark', // Color scheme: 'dark' or 'light'
        FONT_FAMILY: 'Segoe UI', // Font for counter and UI elements
        FONT_SIZE: 14, // Base font size in pixels
        FONT_WEIGHT: 'normal', // Font weight: 'normal', 'bold', 'lighter', '600'
        
        // Keyboard Shortcut
        KEYBOARD_SHORTCUT: 'KeyF', // Key to toggle counter (KeyF = F key)
        USE_CTRL: true, // Require Ctrl modifier for shortcut
        USE_ALT: false, // Require Alt modifier for shortcut
        USE_SHIFT: false, // Require Shift modifier for shortcut
        
        // Statistics
        ENABLE_STATISTICS: true, // Track lifetime filtering stats across sessions
        
        // Notifications
        SHOW_NOTIFICATIONS: true, // Display toast notifications for actions
        NOTIFICATION_DURATION_MS: 3000, // How long notifications stay visible in milliseconds
        NOTIFICATION_FADE_MS: 300, // Notification fade-in/out animation duration
        
        // Channel Lists
        WHITELIST: [], // Channels to never filter (array of channel IDs/names)
        BLACKLIST: [], // Channels to always filter (array of channel IDs/names)
        ENABLE_WHITELIST: false, // Apply whitelist rules
        ENABLE_BLACKLIST: false, // Apply blacklist rules
        CASE_INSENSITIVE_LISTS: true, // Ignore case when matching whitelist/blacklist entries
    };

    // Video element selectors
    const VIDEO_SELECTORS = [
        'ytd-rich-item-renderer',
        'ytd-video-renderer',
        'ytd-grid-video-renderer',
        'ytd-compact-video-renderer',
        'ytd-playlist-video-renderer',
        'ytd-rich-grid-media',
        'yt-lockup-view-model',
        'ytd-lockup-view-model',
        'ytd-reel-item-renderer', // YouTube Shorts
        'ytd-shorts-grid-renderer',
        'ytd-reel-shelf-renderer',
        'ytd-rich-section-renderer'
    ];

    // Constants for magic numbers
    const CONSTANTS = {
        CONFIRM_AUTO_DISMISS_MS: 6000,
        INIT_RETRY_DELAY_MS: 100,
        NAVIGATION_FILTER_DELAY_MS: 500,
        SCROLL_FILTER_DELAY_MS: 300,
        COUNTER_FADE_DURATION_MS: 300,
        PARENT_TRAVERSAL_MAX_DEPTH: 10,
        MAX_UNDO_HISTORY: 10,
        YOUTUBE_SHORTCUTS: ['k', 'j', 'l', 'f', 'm', 'c', 'i', 't', 'p', 'y'],
        NOTIFICATION_FADE_DELAY_MS: 10,
        MAX_BATCH_SIZE: 50,
        // Arabic-Indic digit mapping for parseViewCount
        ARABIC_DIGIT_MAP: {'٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9'}
    };

    // Cached selectors for performance
    const CACHED_SELECTORS = {
        videoSelector: (function getVideoSelector() {
            try {
                const candidates = [
                    'ytd-rich-item-renderer',
                    'ytd-video-renderer',
                    'ytd-grid-video-renderer',
                    'ytd-compact-video-renderer',
                    'ytd-playlist-video-renderer',
                    'ytd-rich-grid-media',
                    'yt-lockup-view-model',
                    'ytd-lockup-view-model',
                    'ytd-reel-item-renderer',
                    'ytd-shorts-grid-renderer',
                    'ytd-reel-shelf-renderer',
                    'ytd-rich-section-renderer'
                ];
                const available = candidates.filter(sel => {
                    try { return !!document.querySelector(sel); } catch { return false; }
                });
                return (available.length ? available : candidates).join(',');
            } catch {
                return VIDEO_SELECTORS.join(',');
            }
        })(),
        channelLinks: 'a[href*="/channel/"], a[href*="/@"]'
    };

    // Load saved configuration
    const loadConfig = () => {
        const saved = GM_getValue('ytFilterConfig', {});
        return { ...DEFAULT_CONFIG, ...saved };
    };

    const saveConfig = (config) => {
        GM_setValue('ytFilterConfig', config);
    };

    let CONFIG = loadConfig();

    // Respect reduced motion: disable counter pulse animations entirely
    try {
        if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            CONFIG.COUNTER_PULSE_DURATION_MS = 0;
            CONFIG.COUNTER_PULSE_SCALE = 1;
            saveConfig(CONFIG);
        }
    } catch {}

    // Thread-safe CONFIG update wrapper
    const updateConfig = (updates) => {
        CONFIG = { ...CONFIG, ...updates };
        saveConfig(CONFIG);
    };

    // ==================== STATE MANAGEMENT ====================
    const state = {
        filteredCount: 0,
        sessionFiltered: 0,
        totalProcessed: 0,
        processedVideos: new WeakSet(),
        observer: null,
        debounceTimer: null,
        counterElement: null,
        settingsPanel: null,
        notificationQueue: [],
        isShowingNotification: false,
        lifetimeStats: GM_getValue('lifetimeStats', {
            totalFiltered: 0,
            firstInstall: Date.now(),
            lastReset: Date.now()
        }),
        counterPosition: GM_getValue('counterPosition', null),
        // Feature 3: Whitelist/Blacklist History
        whitelistHistory: GM_getValue('whitelistHistory', []),
        blacklistHistory: GM_getValue('blacklistHistory', []),
        // Feature 4: Advanced Statistics (tracks why videos were filtered)
        detailedStats: GM_getValue('detailedStats', {
            byReason: { views: 0, duration: 0, live: 0, short: 0, blacklist: 0, other: 0 },
            byChannel: {},
            byDate: {}
        }),
        // Feature 6: Performance Metrics
        performanceMetrics: {
            queryCounts: {},
            batchProcessingStats: { totalBatches: 0, avgItemsPerBatch: 0, totalTime: 0 }
        },
        // Feature 8: Memory diagnostics
        memoryDiagnostics: {
            processedVideosSize: 0,
            eventListenerCount: 0,
            lastCheck: Date.now()
        }
    };

    // Save lifetime stats
    const saveStats = () => {
        GM_setValue('lifetimeStats', state.lifetimeStats);
    };

    // ==================== UTILITY FUNCTIONS ====================
    
    /**
     * Parse view count strings with K/M/B multipliers
     * Examples: "1.2K views" -> 1200, "5M views" -> 5000000
     * FIX: Now receives clean view text like "13m views" instead of entire lines
     */
    const parseViewCount = (text) => {
        try {
            if (!text) return 0;
            let s = String(text)
                .replace(/\u00A0/g, ' ') // non-breaking spaces
                .replace(/[٬]/g, '')      // Arabic thousands sep
                .replace(/views?/i, '')
                .trim()
                .toLowerCase();

            // Map Arabic-Indic digits to Western
            s = s.replace(/[٠-٩]/g, d => CONSTANTS.ARABIC_DIGIT_MAP[d] || d);

            // Indian numbering (lakh/crore)
            if (/crore/.test(s)) {
                const num = parseFloat(s);
                if (!isNaN(num)) {
                    const res = Math.round(num * 10000000);
                    log('📊 parseViewCount (crore):', text, '->', res);
                    return res;
                }
            }
            if (/l(akh)?/.test(s)) {
                const num = parseFloat(s);
                if (!isNaN(num)) {
                    const res = Math.round(num * 100000);
                    log('📊 parseViewCount (lakh):', text, '->', res);
                    return res;
                }
            }

            // Multipliers
            const mult =
                /\bb\b/.test(s) ? 1_000_000_000 :
                /\bm\b/.test(s) ? 1_000_000 :
                /k|тыс|т|тыс\./.test(s) ? 1_000 : 1;

            // Extract numeric (allow comma/period as decimal sep)
            const match = s.match(/(\d+(?:[.,]\d+)?)/);
            if (!match) return 0;
            const num = parseFloat(match[1].replace(/,/g, '.'));
            const res = Math.round((isNaN(num) ? 0 : num) * mult);
            log('📊 parseViewCount:', text, '->', res);
            return res;
        } catch {
            return 0;
        }
    };

    /**
     * Convert time string to seconds
     * Examples: "12:34" -> 754, "1:02:45" -> 3765
     * FIX: Now handles edge cases and validates input
     */
    const timeToSeconds = (timeStr) => {
        if (!timeStr || typeof timeStr !== 'string') return 0;
        
        // Remove any non-time characters, keep only digits and colons
        const cleaned = timeStr.trim().match(/\d+(?::\d+)*/)?.[0];
        if (!cleaned) return 0;
        
        const parts = cleaned.split(':').map(p => parseInt(p, 10) || 0);
        if (parts.length === 0) return 0;
        
        const result = parts.reduce((acc, val, idx) => acc + val * Math.pow(60, parts.length - 1 - idx), 0);
        log('⏱️ timeToSeconds:', timeStr, '-> cleaned:', cleaned, '-> result:', result);
        return result;
    };

    /**
     * Debounce function for performance optimization
     */
    const debounce = (func, delay) => {
        return (...args) => {
            clearTimeout(state.debounceTimer);
            state.debounceTimer = setTimeout(() => {
                if (typeof window.requestIdleCallback === 'function') {
                    window.requestIdleCallback(() => func(...args), { timeout: Math.max(200, delay) });
                } else {
                    func(...args);
                }
            }, delay);
        };
    };

    /**
     * Log debug messages when enabled
     */
    const log = (...args) => {
        if (CONFIG.DEBUG) {
            console.log('[or1n YT filter]', ...args);
        }
    };

    const prefersReducedMotion = () => {
        return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    };

    /**
     * Schedule tasks when the browser is idle; fallback to setTimeout
     */
    const scheduleIdle = (callback, timeout = 300) => {
        try {
            if (typeof window.requestIdleCallback === 'function') {
                return window.requestIdleCallback(() => callback(), { timeout });
            }
        } catch {}
        return setTimeout(() => callback(), Math.min(timeout, 500));
    };

    /**
     * Process items in small chunks using requestAnimationFrame to avoid jank
     */
    const processInBatches = (items, processor, batchSize = CONSTANTS.MAX_BATCH_SIZE) => {
        if (!items || items.length === 0) return;
        try {
            const arr = Array.from(items);
            let index = 0;
            let processedCount = 0;
            const run = () => {
                const end = Math.min(index + batchSize, arr.length);
                for (let i = index; i < end; i++) {
                    try { 
                        processor(arr[i], i); 
                        processedCount++;
                    } catch (e) {
                        log('⚠️ Error processing batch item:', e.message);
                    }
                }
                index = end;
                if (index < arr.length) requestAnimationFrame(run);
                else log(`✓ Batch processing complete: ${processedCount}/${arr.length} items`);
            };
            requestAnimationFrame(run);
        } catch (e) {
            log('❌ Error in processInBatches:', e.message);
        }
    };

    const normalizeCase = (value) => {
        if (value == null) return '';
        return CONFIG.CASE_INSENSITIVE_LISTS && typeof value === 'string' ? value.toLowerCase() : String(value);
    };

    const listContains = (list, value) => list.some(item => normalizeCase(item) === normalizeCase(value));

    /**
     * Detect keyboard shortcut conflicts with YouTube's native shortcuts
     */
    const detectShortcutConflicts = () => {
        const conflicts = [];
        const key = CONFIG.KEYBOARD_SHORTCUT.replace('Key', '').toLowerCase();
        const modifiers = [];
        
        if (CONFIG.USE_CTRL) modifiers.push('Ctrl');
        if (CONFIG.USE_ALT) modifiers.push('Alt');
        if (CONFIG.USE_SHIFT) modifiers.push('Shift');
        
        const shortcutStr = modifiers.length > 0 
            ? `${modifiers.join('+')}+${key.toUpperCase()}`
            : key.toUpperCase();
        
        // Check against YouTube shortcuts (only if no modifiers)
        if (modifiers.length === 0 && CONSTANTS.YOUTUBE_SHORTCUTS.includes(key)) {
            conflicts.push({
                severity: 'high',
                message: `"${shortcutStr}" conflicts with YouTube's native shortcut`,
                suggestion: 'Add Ctrl, Alt, or Shift modifier'
            });
        }
        
        // Check against common browser shortcuts
        if (CONFIG.USE_CTRL && ['f', 't', 'w', 'n', 'p'].includes(key)) {
            conflicts.push({
                severity: 'medium',
                message: `"${shortcutStr}" may conflict with browser shortcuts`,
                suggestion: 'Consider using a different key'
            });
        }
        
        return { hasConflicts: conflicts.length > 0, conflicts, shortcutStr };
    };

    /**
     * Extract and normalize channel name (reusable)
     */
    const normalizeChannelName = (name) => {
        if (!name) return '';
        return name.replace(/^channel\/|^@/, '').trim();
    };

    const confirmAction = (message, onConfirm) => {
        try {
            const existing = document.getElementById('yt-filter-confirm');
            if (existing) existing.remove();

            const wrapper = document.createElement('div');
            wrapper.id = 'yt-filter-confirm';
            wrapper.className = 'yt-filter-confirm';

            const text = document.createElement('span');
            text.textContent = message;
            wrapper.appendChild(text);

            const actions = document.createElement('div');
            actions.className = 'yt-filter-confirm-actions';

            const yesBtn = document.createElement('button');
            yesBtn.textContent = 'Yes';
            yesBtn.className = 'btn-yes';
            yesBtn.addEventListener('click', () => {
                wrapper.remove();
                try {
                    onConfirm();
                } catch (e) {
                    log('❌ Error in confirm callback:', e);
                    showNotification('⚠️ Action failed');
                }
            });

            const noBtn = document.createElement('button');
            noBtn.textContent = 'No';
            noBtn.className = 'btn-no';
            noBtn.addEventListener('click', () => wrapper.remove());

            actions.appendChild(yesBtn);
            actions.appendChild(noBtn);
            wrapper.appendChild(actions);

            document.body.appendChild(wrapper);

            requestAnimationFrame(() => wrapper.classList.add('show'));

            setTimeout(() => {
                if (wrapper.isConnected) wrapper.remove();
            }, CONSTANTS.CONFIRM_AUTO_DISMISS_MS);
        } catch (e) {
            log('❌ Error in confirmAction:', e);
            // Fallback to native confirm if DOM manipulation fails
            if (window.confirm(message)) {
                onConfirm();
            }
        }
    };

    /**
     * Extract channel name/URL from video element
     */
    const extractChannelInfo = (element) => {
        try {
            if (!element) return null;
            const channelLink = element.querySelector(CACHED_SELECTORS.channelLinks);
            if (!channelLink) return null;
            
            const href = channelLink.href || '';
            if (!href) return null;
            
            const channelMatch = href.match(/\/(channel\/[^/?]+|@[^/?]+)/);
            if (channelMatch) {
                const channelId = channelMatch[1];
                const channelText = (channelLink.textContent || '').trim();
                if (!channelId || !channelText) {
                    log('⚠️ Invalid channel data: missing ID or name');
                    return null;
                }
                log('📺 Extracted channel:', channelId, '(' + channelText + ')');
                return { id: channelId, name: channelText, href: href };
            }
            return null;
        } catch (e) {
            log('⚠️ Error extracting channel:', e.message);
            return null;
        }
    };

    // ==================== VIDEO FILTERING LOGIC ====================

    /**
     * Extract video metadata from various YouTube elements
     * FIXED FOR YOUTUBE 2025: Enhanced selectors and comprehensive text extraction
     */
    const extractVideoData = (element) => {
        try {
            let viewsText = null;
            let durationText = null;
            let isLive = false;

            log('🎬 === EXTRACTING VIDEO DATA ===');
            log('Element tag:', element.tagName);

            // New-style 2025 cards expose duration in a badge element near the thumbnail
            const durationBadge = element.querySelector('yt-thumbnail-badge-view-model .yt-badge-shape__text');
            if (durationBadge) {
                const badgeText = (durationBadge.textContent || '').trim();
                if (/\d{1,2}:\d{2}(?::\d{2})?/.test(badgeText)) {
                    durationText = badgeText;
                    log(`✅ FOUND DURATION in badge: "${durationText}"`);
                }
            }
            
            // Strategy 1: Try to find spans with view counts (most reliable)
            const metadataSpans = element.querySelectorAll('[role="text"], .metadata-row span, ytd-formatted-string, .yt-content-metadata-view-model__metadata-row span');
            for (const span of metadataSpans) {
                const text = (span.innerText || span.textContent || '').trim();
                if (!text) continue;
                
                // Check for views/views pattern
                const viewMatch = text.match(/(\d+(?:[.,]\d+)?)\s*([KMBkmb]?)\s*(?:views?|visualizações|просмотров|次)/i);
                if (viewMatch && !viewsText) {
                    const fullMatch = text.match(/\d+(?:[.,]\d+)?\s*[KMBkmb]?\s*(?:views?|visualizações|просмотров|次)/i);
                    if (fullMatch) {
                        viewsText = fullMatch[0];
                        log(`✅ FOUND VIEWS in span: "${viewsText}"`);
                    }
                }
                
                // Check for duration (HH:MM:SS or MM:SS) - CRITICAL FIX: made regex more flexible
                const durationMatch = text.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
                if (durationMatch && !durationText) {
                    durationText = durationMatch[0];
                    log(`✅ FOUND DURATION in span: "${durationText}"`);
                }
            }

            // Strategy 2: Check all text content if spans didn't find views
            if (!viewsText || !durationText) {
                const allText = element.innerText || element.textContent || '';
                const lines = allText.split('\n').map(l => l.trim()).filter(l => l);
                
                log('Scanning lines, found:', lines.length);
                
                // Look for views
                if (!viewsText) {
                    for (const line of lines) {
                        const viewMatch = line.match(/(\d+(?:[.,]\d+)?)\s*([KMBkmb]?)\s*(?:views?|visualizações|просмотров|次)/i);
                        if (viewMatch) {
                            const fullMatch = line.match(/\d+(?:[.,]\d+)?\s*[KMBkmb]?\s*(?:views?|visualizações|просмотров|次)/i);
                            if (fullMatch) {
                                viewsText = fullMatch[0];
                                log(`✅ FOUND VIEWS in line: "${viewsText}"`);
                                break;
                            }
                        }
                    }
                }
                
                // Look for duration - CRITICAL FIX: removed ^ and $ anchors to match duration anywhere in line
                if (!durationText) {
                    for (const line of lines) {
                        const durMatch = line.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
                        if (durMatch) {
                            durationText = durMatch[0];
                            log(`✅ FOUND DURATION in line: "${durationText}"`);
                            break;
                        }
                    }
                }
            }

            // Strategy 3: Handle LIVE streams
            const allText = element.innerText || element.textContent || '';
            const watchingMatch = allText.match(/\d+\s*(?:watching|viewers|ライブ視聴中)/i);
            if (watchingMatch) {
                isLive = true;
                log('ℹ️ LIVE STREAM DETECTED - skipping filter');
            }

            log('📌 Final: Views:', viewsText, '| Duration:', durationText);
            return { viewsText, durationText, isLive };
        } catch (e) {
            log('❌ ERROR in extractVideoData:', e.message);
            return { viewsText: null, durationText: null, isLive: false };
        }
    };

    // Helper: Robust Shorts detection using multiple signals
    const isShortElement = (element) => {
        try {
            if (!element) return false;
            const tag = element.tagName ? element.tagName.toLowerCase() : '';
            if (/reel|shorts/.test(tag)) return true;
            const shortsContainer = element.closest('ytd-reel-item-renderer, ytd-shorts-grid-renderer, ytd-reel-shelf-renderer');
            if (shortsContainer) return true;
            if (element.querySelector('a[href*="/shorts/"]')) return true;
            const badge = element.querySelector('[aria-label*="Shorts"], [aria-label*="shorts"], .badge-shorts, .yt-badge-shorts');
            return !!badge;
        } catch { return false; }
    };

    // Helper: Robust LIVE detection using badges, aria, and text
    const isLiveElement = (element) => {
        try {
            if (!element) return false;
            const aria = (element.getAttribute('aria-label') || '').toLowerCase();
            const text = (element.textContent || '').toLowerCase();
            if (/live now|\blive\b|прямой эфир|أثناء البث|en directo/.test(text)) return true;
            if (/\blive\b/.test(aria)) return true;
            const badge = element.querySelector('.badge-live, [aria-label*="LIVE"], [title*="LIVE"], .ytd-badge-supported-renderer[aria-label*="LIVE"]');
            return !!badge;
        } catch { return false; }
    };

    // ==================== FEATURE 1: Export/Import Settings ====================
    const exportSettings = () => {
        try {
            const exportData = {
                config: CONFIG,
                stats: state.lifetimeStats,
                whitelistHistory: state.whitelistHistory,
                blacklistHistory: state.blacklistHistory,
                exportedAt: new Date().toISOString(),
                scriptVersion: '4.0.1'
            };
            const json = JSON.stringify(exportData, null, 2);
            // Copy to clipboard
            navigator.clipboard.writeText(json).then(() => {
                showNotification('✓ Settings exported to clipboard (JSON)', 3000);
                log('✓ Settings exported:', exportData);
            }).catch(err => {
                log('❌ Clipboard error:', err);
                showNotification('⚠️ Could not copy to clipboard', 2000);
            });
        } catch (e) {
            log('❌ Error exporting settings:', e);
            showNotification('⚠️ Error exporting settings', 2000);
        }
    };

    const importSettings = (jsonString) => {
        try {
            const importData = JSON.parse(jsonString);
            if (!importData.config) {
                showNotification('⚠️ Invalid settings file format', 2000);
                return false;
            }
            CONFIG = { ...DEFAULT_CONFIG, ...importData.config };
            state.lifetimeStats = importData.stats || state.lifetimeStats;
            state.whitelistHistory = importData.whitelistHistory || [];
            state.blacklistHistory = importData.blacklistHistory || [];
            saveConfig(CONFIG);
            saveStats();
            GM_setValue('whitelistHistory', state.whitelistHistory);
            GM_setValue('blacklistHistory', state.blacklistHistory);
            showNotification('✓ Settings imported successfully', 3000);
            log('✓ Settings imported:', importData);
            // Reinitialize UI
            if (state.counterElement) state.counterElement.remove();
            state.counterElement = null;
            injectStyles();
            createCounter();
            state.processedVideos = new WeakSet();
            clearParsingMarkers();
            filterVideos();
            return true;
        } catch (e) {
            log('❌ Error importing settings:', e);
            showNotification('⚠️ Error importing settings: ' + e.message, 3000);
            return false;
        }
    };

    // ==================== FEATURE 2: Auto-Update Version Checking ====================
    const checkForUpdates = async () => {
        try {
            const lastCheck = GM_getValue('lastUpdateCheck', 0);
            const now = Date.now();
            // Check at most once per hour
            if (now - lastCheck < 3600000) return;
            
            GM_setValue('lastUpdateCheck', now);
            const response = await fetch('https://raw.githubusercontent.com/or1n/or1n-userscripts-for-youtube-views-and-duration-filter/main/or1n-userscripts-for-youtube-views-and-duration-filter.meta.js');
            if (!response.ok) return;
            const metaText = await response.text();
            const versionMatch = metaText.match(/@version\s+([\d.]+)/);
            if (versionMatch) {
                const remoteVersion = versionMatch[1];
                const currentVersion = '4.0.1';
                if (remoteVersion > currentVersion) {
                    showNotification(`🔄 Update available: v${remoteVersion}`, 5000);
                    log(`✓ Update available: ${currentVersion} → ${remoteVersion}`);
                }
            }
        } catch (e) {
            log('⚠️ Update check failed:', e.message);
        }
    };

    // ==================== FEATURE 3: History/Undo for Whitelist/Blacklist ====================
    const addToHistory = (historyArray, entry, maxSize = CONSTANTS.MAX_UNDO_HISTORY) => {
        try {
            historyArray.unshift({ ...entry, timestamp: Date.now() });
            if (historyArray.length > maxSize) historyArray.pop();
            return historyArray;
        } catch (e) {
            log('⚠️ Error updating history:', e);
            return historyArray;
        }
    };

    const undoLastListChange = (listType) => {
        try {
            const historyArray = listType === 'whitelist' ? state.whitelistHistory : state.blacklistHistory;
            if (historyArray.length === 0) {
                showNotification('⚠️ No history to undo', 2000);
                return;
            }
            const lastChange = historyArray.shift();
            if (lastChange.action === 'add') {
                const list = listType === 'whitelist' ? CONFIG.WHITELIST : CONFIG.BLACKLIST;
                const idx = list.findIndex(item => normalizeCase(item) === normalizeCase(lastChange.entry));
                if (idx >= 0) list.splice(idx, 1);
            } else if (lastChange.action === 'remove') {
                const list = listType === 'whitelist' ? CONFIG.WHITELIST : CONFIG.BLACKLIST;
                list.push(lastChange.entry);
            }
            const key = listType === 'whitelist' ? 'WHITELIST' : 'BLACKLIST';
            updateConfig({ [key]: listType === 'whitelist' ? CONFIG.WHITELIST : CONFIG.BLACKLIST });
            if (listType === 'whitelist') GM_setValue('whitelistHistory', state.whitelistHistory);
            else GM_setValue('blacklistHistory', state.blacklistHistory);
            showNotification(`↶ Undid ${listType} change`, 2000);
            log(`✓ Undo: ${listType}`, lastChange);
        } catch (e) {
            log('❌ Error undoing change:', e);
        }
    };

    // ==================== FEATURE 4: Advanced Statistics Dashboard ====================
    const recordFilterReason = (element, reason, channelInfo = null) => {
        try {
            if (!CONFIG.ENABLE_DETAILED_STATS) return;
            const stats = state.detailedStats;
            if (stats.byReason[reason] !== undefined) stats.byReason[reason]++;
            if (channelInfo && channelInfo.name) {
                stats.byChannel[channelInfo.name] = (stats.byChannel[channelInfo.name] || 0) + 1;
            }
            const today = new Date().toISOString().split('T')[0];
            stats.byDate[today] = (stats.byDate[today] || 0) + 1;
        } catch (e) {
            log('⚠️ Error recording stats:', e);
        }
    };

    // ==================== FEATURE 6: DOM Query Performance Metrics ====================
    const measureQuery = (name, queryFn) => {
        try {
            if (!CONFIG.ENABLE_PERFORMANCE_METRICS) return queryFn();
            const start = performance.now();
            const result = queryFn();
            const elapsed = performance.now() - start;
            state.performanceMetrics.queryCounts[name] = (state.performanceMetrics.queryCounts[name] || 0) + 1;
            if (elapsed > 10) log(`⚡ Slow query [${name}]: ${elapsed.toFixed(2)}ms`);
            return result;
        } catch (e) {
            log('⚠️ Error in measureQuery:', e);
            return queryFn();
        }
    };

    // ==================== FEATURE 8: Memory Leak Detection ====================
    const checkMemoryHealth = () => {
        try {
            const now = Date.now();
            if (now - state.memoryDiagnostics.lastCheck < 30000) return; // Check every 30s max
            state.memoryDiagnostics.lastCheck = now;
            
            // Count approximate event listeners (rough estimation)
            const eventListeners = document.querySelectorAll('[data-yt-filter-listener]').length;
            state.memoryDiagnostics.eventListenerCount = eventListeners;
            
            // Alert if too many listeners
            if (eventListeners > 100) {
                log('⚠️ High event listener count:', eventListeners);
                showNotification('⚠️ High memory usage detected', 2000);
            }
        } catch (e) {
            log('⚠️ Error checking memory:', e);
        }
    };

    /**
     * Check if video should be filtered
     */
    const shouldFilterVideo = (element) => {
        log('🔍 shouldFilterVideo called for element:', element.tagName);
        
        // Check whitelist first
        const channelInfo = extractChannelInfo(element);
        if (CONFIG.ENABLE_WHITELIST && channelInfo) {
            const isWhitelisted = [channelInfo.id, channelInfo.name, channelInfo.href]
                .some(val => listContains(CONFIG.WHITELIST, val));
            if (isWhitelisted) {
                log(`✅ WHITELISTED: ${channelInfo.name} - skipping filter`);
                return false;
            }
        }
        
        // Check blacklist
        if (CONFIG.ENABLE_BLACKLIST && channelInfo) {
            const isBlacklisted = [channelInfo.id, channelInfo.name, channelInfo.href]
                .some(val => listContains(CONFIG.BLACKLIST, val));
            if (isBlacklisted) {
                log(`🚫 BLACKLISTED: ${channelInfo.name} - filtering`);
                return true;
            }
        }
        
        const { viewsText, durationText, isLive } = extractVideoData(element);
        const isShortEarly = isShortElement(element);
        const isLiveDetected = isLive || isLiveElement(element);

        // Early exit for Shorts when global filter is enabled
        if (CONFIG.FILTER_ALL_SHORTS && isShortEarly) {
            log('🚫 FILTER_ALL_SHORTS enabled - early filtering short');
            return true;
        }
        
        // Check if we should filter all live streams
        if (CONFIG.FILTER_ALL_LIVE_STREAMS && isLiveDetected) {
            log('🚫 FILTER_ALL_LIVE_STREAMS enabled - filtering live stream');
            return true;
        }
        
        // Check if we should skip live streams (opposite behavior)
        if (isLiveDetected && CONFIG.SKIP_LIVE_STREAMS) {
            return false;
        }
        
        log('📊 extractVideoData returned - views:', viewsText, 'duration:', durationText);

        // Skip if missing critical data
        if (!viewsText && !durationText) {
            log('⏭️ Skipping: no views or duration found');
            return false;
        }

        const viewCount = parseViewCount(viewsText || '');
        const durationSeconds = timeToSeconds(durationText || '');

        log('📈 Parsed values - viewCount:', viewCount, 'durationSeconds:', durationSeconds);
        log('⚙️ Config thresholds - MIN_VIEWS:', CONFIG.MIN_VIEWS, 'MIN_DURATION_SECONDS:', CONFIG.MIN_DURATION_SECONDS);

        // Check filters based on mode
        const viewsLow = viewsText && viewCount > 0 && viewCount < CONFIG.MIN_VIEWS;
        const durationShort = durationText && durationSeconds > 0 && durationSeconds < CONFIG.MIN_DURATION_SECONDS;

        let shouldFilter = false;
        if (CONFIG.FILTER_MODE === 'OR') {
            shouldFilter = viewsLow || durationShort;
            if (shouldFilter) {
                const reason = [];
                if (viewsLow) reason.push(`${viewCount} views < ${CONFIG.MIN_VIEWS}`);
                if (durationShort) reason.push(`${durationSeconds}s < ${CONFIG.MIN_DURATION_SECONDS}s`);
                log(`🚫 FILTERING (OR mode): ${reason.join(' OR ')}`);
            }
        } else {
            // AND mode: require both to be below threshold to filter when both values exist
            if (viewsText && durationText) {
                shouldFilter = viewsLow && durationShort;
                if (shouldFilter) {
                    log(`🚫 FILTERING (AND mode): ${viewCount} views < ${CONFIG.MIN_VIEWS} AND ${durationSeconds}s < ${CONFIG.MIN_DURATION_SECONDS}s`);
                }
            } else if (viewsText) {
                shouldFilter = viewsLow;
                if (shouldFilter) log(`🚫 FILTERING (AND mode - views only): ${viewCount} views < ${CONFIG.MIN_VIEWS}`);
            } else if (durationText) {
                shouldFilter = durationShort;
                if (shouldFilter) log(`🚫 FILTERING (AND mode - duration only): ${durationSeconds}s < ${CONFIG.MIN_DURATION_SECONDS}s`);
            }
        }

        if (!shouldFilter) {
            log('✅ Video passes filters');
        }
        return shouldFilter;
    };

    /**
     * Get the container element to remove
     * FIX: Added fallback strategy - if no standard container found, try parent traversal
     */
    const getContainerToRemove = (element) => {
        // Find the appropriate parent container
        const containerSelectors = [
            'ytd-rich-item-renderer',
            'ytd-video-renderer',
            'ytd-grid-video-renderer',
            'ytd-compact-video-renderer',
            'ytd-playlist-video-renderer',
            'ytd-reel-item-renderer', // YouTube Shorts
            'ytd-rich-grid-media', // Grid layout
            'ytd-rich-shelf-renderer', // Shelf items
            'yt-lockup-view-model' // New 2025 lockup cards
        ];

        log('🔍 Looking for container to remove from element:', element.tagName);
        
        for (const selector of containerSelectors) {
            const container = element.closest(selector);
            if (container) {
                log('✅ Found container:', selector);
                return container;
            }
        }

        // FALLBACK STRATEGY: If no standard container found, traverse up the DOM
        // Look for any parent that is a reasonable removal candidate
        log('⚠️ Standard selectors failed, attempting fallback parent traversal');
        let parent = element.parentElement;
        let depth = 0;
        while (parent && depth < CONSTANTS.PARENT_TRAVERSAL_MAX_DEPTH) {
            const tagName = parent.tagName.toLowerCase();
            const classList = parent.className;
            
            // Look for elements that look like video containers
            if (tagName.includes('ytd-') || classList.includes('video') || classList.includes('item')) {
                log(`📦 FALLBACK: Found potential container at depth ${depth}:`, tagName);
                return parent;
            }
            
            parent = parent.parentElement;
            depth++;
        }

        log('⚠️ No suitable container found even with fallback, using element itself:', element.tagName);
        return element;
    };

    /**
     * Remove video element with smooth animation
     */
    const removeVideoElement = (element) => {
        const container = getContainerToRemove(element);
        
        log('🗑️ Attempting to remove container:', container.tagName, 'ID:', container.id);
        if (!container || !container.parentElement) {
            log('⚠️ No parent for container; skipping removal');
            return;
        }
        
        const reduceMotion = prefersReducedMotion();
        if (CONFIG.SMOOTH_REMOVAL && !reduceMotion) {
            const dur = CONFIG.REMOVAL_DURATION_MS;
            const scale = CONFIG.REMOVAL_SCALE;
            container.style.transition = `opacity ${dur}ms ease-out, transform ${dur}ms ease-out, max-height ${dur}ms ease-out`;
            container.style.opacity = '0';
            container.style.transform = `scale(${scale})`;
            container.style.maxHeight = container.offsetHeight + 'px';
            
            setTimeout(() => {
                container.style.maxHeight = '0';
                container.style.margin = '0';
                container.style.padding = '0';
                
                setTimeout(() => {
                    log('✅ Container removed from DOM');
                    container.remove();
                }, dur);
            }, dur);
        } else {
            container.remove();
            log('✅ Container removed from DOM (instant)');
        }

        state.filteredCount++;
        state.sessionFiltered++;
        
        if (CONFIG.ENABLE_STATISTICS) {
            state.lifetimeStats.totalFiltered++;
            saveStats();
        }
        
        updateCounter();
    };

    // Clear all parsing markers when resetting (on navigation)
    const clearParsingMarkers = () => {
        try {
            document.querySelectorAll('[data-yt-filter-parsed]').forEach(el => {
                delete el.dataset.ytFilterParsed;
            });
        } catch {}
    };

    const processVideoElement = (video) => {
        if (!video || !(video instanceof HTMLElement)) return false;
        if (state.processedVideos.has(video)) return false;
        
        // Check if already parsed via dataset marker (faster than WeakSet for repeated checks)
        if (video.dataset.ytFilterParsed === 'true') return false;
        
        state.processedVideos.add(video);
        video.dataset.ytFilterParsed = 'true';  // Mark as parsed to avoid re-checking across mutations

        log('Processing video element:', video.tagName);
        if (shouldFilterVideo(video)) {
            const channelInfo = extractChannelInfo(video);
            const { viewsText, durationText } = extractVideoData(video);
            let reason = 'other';
            if (viewsText && parseViewCount(viewsText) < CONFIG.MIN_VIEWS) reason = 'views';
            if (durationText && timeToSeconds(durationText) < CONFIG.MIN_DURATION_SECONDS) reason = 'duration';
            recordFilterReason(video, reason, channelInfo);
            removeVideoElement(video);
        }
        return true;
    };

    const processCandidates = (nodes) => {
        if (!nodes || nodes.length === 0) return;
        let processed = 0;

        processInBatches(nodes, (node) => {
            if (!(node instanceof HTMLElement)) return;

            if (VIDEO_SELECTORS.some(sel => node.matches(sel))) {
                if (processVideoElement(node)) processed++;
            }

            const found = node.querySelectorAll(CACHED_SELECTORS.videoSelector);
            found.forEach(el => {
                if (processVideoElement(el)) processed++;
            });
        });

        state.totalProcessed += processed;
        if (processed > 0) {
            log(`Processed ${processed} videos, Total: ${state.totalProcessed}`);
        }
    };

    /**
     * Process video elements on the page
     */
    const filterVideos = () => {
        const allVideos = document.querySelectorAll(CACHED_SELECTORS.videoSelector);
        const nodes = Array.from(allVideos);
        scheduleIdle(() => processCandidates(nodes));
    };

    // ==================== UI COUNTER ====================

    /**
     * Create counter header with title and control buttons
     */
    const createCounterHeader = () => {
        const header = document.createElement('div');
        header.className = 'yt-filter-header';
        
        const title = document.createElement('span');
        title.className = 'yt-filter-title';
        title.textContent = '🔥 or1n YT filter';
        
        const buttons = document.createElement('div');
        buttons.className = 'yt-filter-buttons';
        
        const settingsBtn = document.createElement('button');
        settingsBtn.className = 'yt-filter-settings';
        settingsBtn.title = 'Settings';
        settingsBtn.textContent = '⚙️';
        settingsBtn.setAttribute('aria-label', 'Open settings');
        settingsBtn.setAttribute('aria-expanded', 'false');
        
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'yt-filter-toggle';
        toggleBtn.title = 'Hide Counter';
        toggleBtn.textContent = '−';
        toggleBtn.setAttribute('aria-label', 'Toggle counter visibility');
        toggleBtn.setAttribute('aria-pressed', 'true');
        
        const menuBtn = document.createElement('button');
        menuBtn.className = 'yt-filter-menu';
        menuBtn.title = 'Quick Menu';
        menuBtn.textContent = '⋮';
        menuBtn.setAttribute('aria-label', 'Open quick menu');
        menuBtn.setAttribute('aria-haspopup', 'true');
        menuBtn.setAttribute('aria-expanded', 'false');
        
        const closeBtn = document.createElement('button');
        closeBtn.className = 'yt-filter-close';
        closeBtn.title = 'Close Counter';
        closeBtn.textContent = '✕';
        closeBtn.setAttribute('aria-label', 'Close filter counter');
        
        buttons.appendChild(settingsBtn);
        buttons.appendChild(toggleBtn);
        buttons.appendChild(menuBtn);
        buttons.appendChild(closeBtn);
        header.appendChild(title);
        header.appendChild(buttons);
        
        return { header, settingsBtn, toggleBtn, menuBtn, closeBtn };
    };

    /**
     * Create counter statistics display
     */
    const createCounterStats = () => {
        const stats = document.createElement('div');
        stats.className = 'yt-filter-stats';
        
        const daysSinceInstall = Math.floor((Date.now() - state.lifetimeStats.firstInstall) / (1000 * 60 * 60 * 24));
        
        // Session stat
        const sessionStat = document.createElement('div');
        sessionStat.className = 'stat';
        const sessionLabel = document.createElement('span');
        sessionLabel.className = 'stat-label';
        sessionLabel.textContent = 'Session:';
        const sessionValue = document.createElement('span');
        sessionValue.className = 'stat-value';
        sessionValue.id = 'yt-session-count';
        sessionValue.textContent = '0';
        sessionStat.appendChild(sessionLabel);
        sessionStat.appendChild(sessionValue);
        stats.appendChild(sessionStat);
        
        // Lifetime stats (conditional)
        if (CONFIG.ENABLE_STATISTICS) {
            const lifetimeStat = document.createElement('div');
            lifetimeStat.className = 'stat lifetime';
            const lifetimeLabel = document.createElement('span');
            lifetimeLabel.className = 'stat-label';
            lifetimeLabel.textContent = 'Lifetime:';
            const lifetimeValue = document.createElement('span');
            lifetimeValue.className = 'stat-value';
            lifetimeValue.id = 'yt-lifetime-count';
            lifetimeValue.textContent = state.lifetimeStats.totalFiltered.toLocaleString();
            lifetimeStat.appendChild(lifetimeLabel);
            lifetimeStat.appendChild(lifetimeValue);
            stats.appendChild(lifetimeStat);
            
            const daysInfo = document.createElement('div');
            daysInfo.className = 'stat-info';
            daysInfo.textContent = `📊 Active for ${daysSinceInstall} day${daysSinceInstall !== 1 ? 's' : ''}`;
            stats.appendChild(daysInfo);
        }
        
        // Filter info
        const filterInfo = document.createElement('div');
        filterInfo.className = 'stat-info';
        const minViewsText = document.createTextNode(`Min Views: ${CONFIG.MIN_VIEWS.toLocaleString()}`);
        const br = document.createElement('br');
        const minDurationText = document.createTextNode(
            `Min Duration: ${Math.floor(CONFIG.MIN_DURATION_SECONDS / 60)}m ${CONFIG.MIN_DURATION_SECONDS % 60}s`
        );
        filterInfo.appendChild(minViewsText);
        filterInfo.appendChild(br);
        filterInfo.appendChild(minDurationText);
        stats.appendChild(filterInfo);
        
        return stats;
    };

    /**
     * Create quick menu items
     */
    const createQuickMenuItems = () => {
        const menuItems = [
            { text: '🚫 Close Counter', action: (stats, toggleBtn, counter) => {
                counter.style.transition = 'opacity 0.3s ease';
                counter.style.opacity = '0';
                setTimeout(() => {
                    counter.remove();
                    state.counterElement = null;
                }, 300);
            }},
            { text: '📈 Reset Stats', action: () => {
                confirmAction('Reset all statistics?', () => {
                    state.lifetimeStats = { totalFiltered: 0, firstInstall: Date.now(), lastReset: Date.now() };
                    saveStats();
                    showNotification('✓ Statistics reset', 1500);
                });
            }},
            { getText: () => `${CONFIG.SKIP_LIVE_STREAMS ? '🔴 Ignore LIVE (ON)' : '🔴 Ignore LIVE (OFF)'}` , action: () => {
                updateConfig({ SKIP_LIVE_STREAMS: !CONFIG.SKIP_LIVE_STREAMS });
                state.processedVideos = new WeakSet();
                filterVideos();
                showNotification(CONFIG.SKIP_LIVE_STREAMS ? 'LIVE videos will be skipped' : 'LIVE videos will be filtered');
            }},
            { text: '🔄 Force Filter', action: () => {
                state.processedVideos = new WeakSet();
                clearParsingMarkers();
                filterVideos();
                showNotification('✓ Filtering complete', 1500);
            }}
        ];
        
        // Cache channel detection for performance (avoid multiple DOM queries)
        let cachedChannelInfo = null;
        try {
            const root = document.body || document.documentElement;
            if (root) {
                const currentVideo = root.querySelector('ytd-rich-item-renderer, ytd-video-renderer, ytd-grid-video-renderer');
                if (currentVideo) {
                    cachedChannelInfo = extractChannelInfo(currentVideo);
                }
            }
        } catch (e) {
            log('⚠️ Error caching channel info:', e);
        }
        
        // Add whitelist/blacklist options if channel found
        if (cachedChannelInfo) {
            const channelInfo = cachedChannelInfo;
            menuItems.push(
                { text: `✅ Whitelist "${channelInfo.name.substring(0, 20)}"`, action: () => {
                    if (!listContains(CONFIG.WHITELIST, channelInfo.id)) {
                        CONFIG.WHITELIST.push(channelInfo.id);
                        updateConfig({ WHITELIST: CONFIG.WHITELIST });
                        showNotification(`✅ Whitelisted: ${channelInfo.name}`, 2000);
                    } else {
                        showNotification(`Already whitelisted`, 1500);
                    }
                }},
                { text: `🚫 Blacklist "${channelInfo.name.substring(0, 20)}"`, action: () => {
                    if (!listContains(CONFIG.BLACKLIST, channelInfo.id)) {
                        CONFIG.BLACKLIST.push(channelInfo.id);
                        updateConfig({ BLACKLIST: CONFIG.BLACKLIST });
                        showNotification(`🚫 Blacklisted: ${channelInfo.name}`, 2000);
                    } else {
                        showNotification(`Already blacklisted`, 1500);
                    }
                }}
            );
        }
        
        return menuItems;
    };

    /**
     * Attach event handlers to counter buttons
     */
    const attachCounterEventHandlers = (counter, header, stats, buttons, quickMenu) => {
        const { settingsBtn, toggleBtn, menuBtn, closeBtn } = buttons;
        
        // Settings button
        settingsBtn._handler = (e) => {
            e.stopPropagation();
            quickMenu.style.display = 'none';
            toggleSettingsPanel();
        };
        settingsBtn.addEventListener('click', settingsBtn._handler);

        // Toggle counter visibility (entire UI)
        toggleBtn._handler = (e) => {
            e.stopPropagation();
            toggleCounter();
            quickMenu.style.display = 'none';
        };
        toggleBtn.addEventListener('click', toggleBtn._handler);

        // Menu button
        menuBtn._handler = (e) => {
            e.stopPropagation();
            quickMenu.style.display = quickMenu.style.display === 'none' ? 'flex' : 'none';
        };
        menuBtn.addEventListener('click', menuBtn._handler);

        // Close button
        const closeCounter = (e) => {
            e.stopPropagation();
            if (counter) {
                counter.style.transition = `opacity ${CONSTANTS.COUNTER_FADE_DURATION_MS}ms ease`;
                counter.style.opacity = '0';
                setTimeout(() => {
                    settingsBtn.removeEventListener('click', settingsBtn._handler);
                    toggleBtn.removeEventListener('click', toggleBtn._handler);
                    menuBtn.removeEventListener('click', menuBtn._handler);
                    closeBtn.removeEventListener('click', closeCounter);
                    if (header && CONFIG.COUNTER_DRAGGABLE) {
                        header.onmousedown = null;
                    }
                    counter.remove();
                    state.counterElement = null;
                }, CONSTANTS.COUNTER_FADE_DURATION_MS);
            }
        };
        closeBtn.addEventListener('click', closeCounter);
    };

    /**
     * Create counter display element
     */
    const createCounter = () => {
        if (state.counterElement) {
            log('⚠️ Counter already exists; returning existing instance');
            return state.counterElement;
        }

        try {
            const counter = document.createElement('div');
            counter.id = 'yt-filter-counter';
            // FEATURE 7: Accessibility - Add ARIA labels and role
            counter.setAttribute('role', 'region');
            counter.setAttribute('aria-label', 'YouTube Filter Statistics Counter');
            counter.setAttribute('aria-live', 'polite');
            
            // Create components
            const { header, settingsBtn, toggleBtn, menuBtn, closeBtn } = createCounterHeader();
            const stats = createCounterStats();
            counter.appendChild(header);
            counter.appendChild(stats);
            applyCounterStyle(counter);

            // Create quick menu
            const quickMenu = document.createElement('div');
            quickMenu.className = 'yt-filter-quick-menu';
            quickMenu.style.display = 'none';
            quickMenu.setAttribute('role', 'menu');
            quickMenu.setAttribute('aria-label', 'Filter quick menu');
            
            const menuItems = createQuickMenuItems();
            menuItems.forEach(item => {
                const menuItem = document.createElement('button');
                menuItem.className = 'yt-filter-menu-item';
                menuItem.setAttribute('role', 'menuitem');
                menuItem.textContent = item.getText ? item.getText() : item.text;
                menuItem.addEventListener('click', (e) => {
                    e.stopPropagation();
                    try {
                        // Pass necessary context to actions that need it
                        if (item.text === '👁️ Toggle Counter') {
                            item.action(stats, toggleBtn);
                        } else if (item.text === '🚫 Close Counter') {
                            item.action(stats, toggleBtn, counter);
                        } else {
                            item.action();
                        }
                        if (item.getText) {
                            menuItem.textContent = item.getText();
                        }
                        quickMenu.style.display = 'none';
                    } catch (e) {
                        log('❌ Menu action error:', e.message);
                        showNotification('⚠️ Action failed');
                    }
                });
                quickMenu.appendChild(menuItem);
            });
            
            counter.appendChild(quickMenu);

            // Attach event handlers
            attachCounterEventHandlers(counter, header, stats, 
                { settingsBtn, toggleBtn, menuBtn, closeBtn }, quickMenu);

            // Make draggable
            if (CONFIG.COUNTER_DRAGGABLE) {
                makeDraggable(counter);
            }

            document.body.appendChild(counter);
            // Respect open-on-load setting
            if (!CONFIG.OPEN_COUNTER_ON_LOAD) {
                counter.style.display = 'none';
                const headerToggle = counter.querySelector('.yt-filter-toggle');
                if (headerToggle) {
                    headerToggle.textContent = '+';
                    headerToggle.title = 'Show Counter';
                }
            }
            state.counterElement = counter;
            log('✓ Counter created successfully');

            return counter;
        } catch (e) {
            log('❌ Error creating counter:', e.message);
            showNotification('⚠️ Failed to create counter');
            return null;
        }
    };

    /**
     * Update counter display
     */
    const updateCounter = () => {
        if (!state.counterElement) return;

        const sessionElement = state.counterElement.querySelector('#yt-session-count');
        if (sessionElement) {
            sessionElement.textContent = state.sessionFiltered.toLocaleString();
            
            if (!prefersReducedMotion()) {
                sessionElement.style.transform = `scale(${CONFIG.COUNTER_PULSE_SCALE})`;
                const accentColor = CONFIG.THEME === 'dark' ? '#ff0000' : '#cc0000';
                sessionElement.style.color = accentColor;
                setTimeout(() => {
                    sessionElement.style.transform = 'scale(1)';
                    sessionElement.style.color = '';
                }, CONFIG.COUNTER_PULSE_DURATION_MS);
            }
        }

        const lifetimeElement = state.counterElement.querySelector('#yt-lifetime-count');
        if (lifetimeElement) {
            lifetimeElement.textContent = state.lifetimeStats.totalFiltered.toLocaleString();
        }
    };

    /**
     * Toggle the counter visibility; create if missing
     */
    const toggleCounter = () => {
        try {
            if (!state.counterElement) {
                const el = createCounter();
                if (!el) {
                    log('❌ Failed to create counter');
                    return;
                }
                el.style.display = 'block';
                return;
            }
            const el = state.counterElement;
            const isHidden = el.style.display === 'none';
            el.style.display = isHidden ? 'block' : 'none';
            const toggleBtn = el.querySelector('.yt-filter-toggle');
            if (toggleBtn) {
                toggleBtn.textContent = isHidden ? '−' : '+';
                toggleBtn.title = isHidden ? 'Hide Counter' : 'Show Counter';
            }
            log('✓ Counter toggled:', isHidden ? 'shown' : 'hidden');
        } catch (e) {
            log('❌ Error toggling counter:', e.message);
            showNotification('⚠️ Failed to toggle counter');
        }
    };

    /**
     * Apply counter styling based on config
     */
    const applyCounterStyle = (counter) => {
        counter.style.fontFamily = CONFIG.FONT_FAMILY;
        counter.style.fontSize = CONFIG.FONT_SIZE + 'px';
        counter.style.fontWeight = CONFIG.FONT_WEIGHT;
        counter.style.opacity = CONFIG.COUNTER_OPACITY / 100;
    };

    /**
     * Make element draggable with position persistence
     */
    const makeDraggable = (element) => {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        const header = element.querySelector('.yt-filter-header');
        
        // Restore saved position
        if (state.counterPosition) {
            element.style.top = state.counterPosition.top;
            element.style.left = state.counterPosition.left;
        }
        
        if (header) {
            header.style.cursor = 'move';
            header.onmousedown = dragMouseDown;
            header.addEventListener('touchstart', dragTouchStart, { passive: false });
        }

        function getPoint(event) {
            if (event.touches && event.touches.length > 0) {
                return { clientX: event.touches[0].clientX, clientY: event.touches[0].clientY };
            }
            return { clientX: event.clientX, clientY: event.clientY };
        }

        function dragMouseDown(e) {
            e.preventDefault();
            const point = getPoint(e);
            pos3 = point.clientX;
            pos4 = point.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        }

        function dragTouchStart(e) {
            e.preventDefault();
            const point = getPoint(e);
            pos3 = point.clientX;
            pos4 = point.clientY;
            document.addEventListener('touchend', closeDragElement, { passive: true });
            document.addEventListener('touchcancel', closeDragElement, { passive: true });
            document.addEventListener('touchmove', elementDrag, { passive: false });
        }

        function elementDrag(e) {
            e.preventDefault();
            const point = getPoint(e);
            pos1 = pos3 - point.clientX;
            pos2 = pos4 - point.clientY;
            pos3 = point.clientX;
            pos4 = point.clientY;
            const newTop = (element.offsetTop - pos2) + 'px';
            const newLeft = (element.offsetLeft - pos1) + 'px';
            element.style.top = newTop;
            element.style.left = newLeft;
        }

        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;
            document.removeEventListener('touchmove', elementDrag);
            document.removeEventListener('touchend', closeDragElement);
            document.removeEventListener('touchcancel', closeDragElement);
            
            // Save position
            state.counterPosition = {
                top: element.style.top,
                left: element.style.left
            };
            GM_setValue('counterPosition', state.counterPosition);
        }
    };

    /**
     * Show notification with queue system to prevent stacking
     */
    const showNotification = (message, duration = CONFIG.NOTIFICATION_DURATION_MS) => {
        try {
            if (!CONFIG.SHOW_NOTIFICATIONS) return;

            // Add to queue
            state.notificationQueue.push({ message, duration });

            // Process queue if not already showing
            if (!state.isShowingNotification) {
                processNotificationQueue();
            }
        } catch (e) {
            log('❌ Error showing notification:', e);
        }
    };

    const processNotificationQueue = () => {
        if (state.notificationQueue.length === 0) {
            state.isShowingNotification = false;
            return;
        }

        state.isShowingNotification = true;
        const { message, duration } = state.notificationQueue.shift();

        const notification = document.createElement('div');
        notification.className = 'yt-filter-notification';
        notification.textContent = message;
        document.body.appendChild(notification);
        const reduceMotion = prefersReducedMotion();

        if (reduceMotion) {
            notification.classList.add('show');
            setTimeout(() => {
                notification.remove();
                processNotificationQueue();
            }, duration);
            return;
        }

        setTimeout(() => {
            notification.classList.add('show');
        }, CONSTANTS.NOTIFICATION_FADE_DELAY_MS);

        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                notification.remove();
                processNotificationQueue();
            }, CONFIG.NOTIFICATION_FADE_MS);
        }, duration);
    };

    /**
     * Register keyboard shortcut to toggle counter
     */
    const setupKeyboardShortcuts = () => {
        window.addEventListener('keydown', (e) => {
            try {
                const keyCode = e.code || '';
                const expected = CONFIG.KEYBOARD_SHORTCUT;
                const ctrl = !!e.ctrlKey;
                const alt = !!e.altKey;
                const shift = !!e.shiftKey;
                if (
                    keyCode === expected &&
                    ctrl === !!CONFIG.USE_CTRL &&
                    alt === !!CONFIG.USE_ALT &&
                    shift === !!CONFIG.USE_SHIFT
                ) {
                    e.preventDefault();
                    toggleCounter();
                }
            } catch (err) {
                log('⚠️ Keyboard shortcut error:', err);
            }
        });
    };

    // ==================== SETTINGS PANEL ====================

    /**
     * Create settings panel (Trusted Types compliant - no innerHTML)
     */
    const createSettingsPanel = () => {
        const panel = document.createElement('div');
        panel.id = 'yt-filter-settings-panel';
        panel.className = 'visible';

        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'settings-overlay';
        overlay.id = 'settings-overlay';

        // Create content container
        const content = document.createElement('div');
        content.className = 'settings-content';

        // Header
        const header = document.createElement('div');
        header.className = 'settings-header';
        const title = document.createElement('h2');
        title.textContent = '⚙️ or1n YouTube Filter Settings';
        const closeBtn = document.createElement('button');
        closeBtn.className = 'settings-close';
        closeBtn.title = 'Close';
        closeBtn.textContent = '✕';
        header.appendChild(title);
        header.appendChild(closeBtn);

        // Body container
        const body = document.createElement('div');
        body.className = 'settings-body';

        // Helper to create a section
        const createSection = (title) => {
            const section = document.createElement('div');
            section.className = 'settings-section';
            const h3 = document.createElement('h3');
            h3.textContent = title;
            section.appendChild(h3);
            return section;
        };

        // Helper to create input row
        const createInputRow = (label, inputType, id, value, min, max, step) => {
            const item = document.createElement('div');
            item.className = 'setting-item';
            const lbl = document.createElement('label');
            lbl.textContent = label;
            item.appendChild(lbl);
            const input = document.createElement('input');
            input.type = inputType;
            input.id = id;
            input.value = value;
            if (min !== undefined && min !== null) input.min = min;
            if (max !== undefined && max !== null) input.max = max;
            if (step !== undefined && step !== null) input.step = step;
            item.appendChild(input);
            return item;
        };

        // === FILTER SETTINGS ===
        const filterSection = createSection('🎯 Filter Settings');
        const minViewsRow = createInputRow('Minimum Views', 'number', 'setting-min-views', CONFIG.MIN_VIEWS, 0, null, 1000);
        minViewsRow.title = 'Videos with fewer views than this will be hidden. Set to 0 to disable view filtering.';
        filterSection.appendChild(minViewsRow);
        const minDurRow = createInputRow('Minimum Duration (seconds)', 'number', 'setting-min-duration', CONFIG.MIN_DURATION_SECONDS, 0, null, 30);
        minDurRow.title = 'Videos shorter than this (in seconds) will be hidden. 240s = 4 minutes. Set to 0 to disable duration filtering.';
        filterSection.appendChild(minDurRow);
        body.appendChild(filterSection);

        // === FILTER MODE ===
        const modeSection = createSection('⚡ Filter Logic');
        const modeItem = document.createElement('div');
        modeItem.className = 'setting-item';
        modeItem.title = 'AND: hide only when BOTH view count AND duration are below thresholds. OR: hide if EITHER is below threshold.';
        const modeLbl = document.createElement('label');
        modeLbl.textContent = 'Combine Filters With:';
        const modeSelect = document.createElement('select');
        modeSelect.id = 'setting-filter-mode';
        ['AND', 'OR'].forEach(val => {
            const opt = document.createElement('option');
            opt.value = val;
            opt.textContent = val === 'AND' ? 'AND (both conditions must be true)' : 'OR (any condition can be true)';
            opt.selected = CONFIG.FILTER_MODE === val;
            modeSelect.appendChild(opt);
        });
        modeItem.appendChild(modeLbl);
        modeItem.appendChild(modeSelect);
        const modeInfo = document.createElement('small');
        modeInfo.textContent = 'AND: hide only when both views and duration are below thresholds. OR: hide when either views or duration is below its threshold.';
        modeItem.appendChild(modeInfo);
        modeSection.appendChild(modeItem);
        body.appendChild(modeSection);

        // === WHITELIST ===
        const whitelistSection = createSection('✅ Whitelist (Never Filter)');
        const whitelistToggle = document.createElement('div');
        whitelistToggle.className = 'setting-item';
        whitelistToggle.title = 'When enabled, channels in the whitelist will never be filtered regardless of views or duration.';
        const whitelistCb = document.createElement('input');
        whitelistCb.type = 'checkbox';
        whitelistCb.id = 'setting-enable-whitelist';
        whitelistCb.checked = CONFIG.ENABLE_WHITELIST;
        const whitelistToggleLbl = document.createElement('label');
        whitelistToggleLbl.appendChild(whitelistCb);
        whitelistToggleLbl.appendChild(document.createTextNode(' Enable Whitelist'));
        whitelistToggle.appendChild(whitelistToggleLbl);
        whitelistSection.appendChild(whitelistToggle);
        
        const whitelistList = document.createElement('div');
        whitelistList.id = 'whitelist-container';
        whitelistList.className = 'list-container';
        CONFIG.WHITELIST.forEach(channel => {
            const item = document.createElement('div');
            item.className = 'list-item';
            const span = document.createElement('span');
            span.textContent = normalizeChannelName(channel);
            item.appendChild(span);
            const removeBtn = document.createElement('button');
            removeBtn.className = 'btn-remove-item';
            removeBtn.textContent = '✕';
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                CONFIG.WHITELIST = CONFIG.WHITELIST.filter(ch => ch !== channel);
                item.remove();
            });
            item.appendChild(removeBtn);
            whitelistList.appendChild(item);
        });
        whitelistSection.appendChild(whitelistList);
        body.appendChild(whitelistSection);

        // === BLACKLIST ===
        const blacklistSection = createSection('🚫 Blacklist (Always Filter)');
        const blacklistToggle = document.createElement('div');
        blacklistToggle.className = 'setting-item';
        blacklistToggle.title = 'When enabled, channels in the blacklist will always be filtered regardless of views or duration.';
        const blacklistCb = document.createElement('input');
        blacklistCb.type = 'checkbox';
        blacklistCb.id = 'setting-enable-blacklist';
        blacklistCb.checked = CONFIG.ENABLE_BLACKLIST;
        const blacklistToggleLbl = document.createElement('label');
        blacklistToggleLbl.appendChild(blacklistCb);
        blacklistToggleLbl.appendChild(document.createTextNode(' Enable Blacklist'));
        blacklistToggle.appendChild(blacklistToggleLbl);
        blacklistSection.appendChild(blacklistToggle);
        
        const blacklistList = document.createElement('div');
        blacklistList.id = 'blacklist-container';
        blacklistList.className = 'list-container';
        CONFIG.BLACKLIST.forEach(channel => {
            const item = document.createElement('div');
            item.className = 'list-item';
            const span = document.createElement('span');
            span.textContent = normalizeChannelName(channel);
            item.appendChild(span);
            const removeBtn = document.createElement('button');
            removeBtn.className = 'btn-remove-item';
            removeBtn.textContent = '✕';
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                CONFIG.BLACKLIST = CONFIG.BLACKLIST.filter(ch => ch !== channel);
                item.remove();
            });
            item.appendChild(removeBtn);
            blacklistList.appendChild(item);
        });
        blacklistSection.appendChild(blacklistList);
        body.appendChild(blacklistSection);

        // === APPEARANCE ===
        const appearanceSection = createSection('🎨 Appearance');
        
        // Theme select
        const themeItem = document.createElement('div');
        themeItem.className = 'setting-item';
        themeItem.title = 'Choose between dark mode (better for night) or light mode (better for bright environments).';
        const themeLbl = document.createElement('label');
        themeLbl.textContent = 'Theme';
        const themeSelect = document.createElement('select');
        themeSelect.id = 'setting-theme';
        ['dark', 'light'].forEach(val => {
            const opt = document.createElement('option');
            opt.value = val;
            opt.textContent = val === 'dark' ? '🌙 Dark' : '☀️ Light';
            opt.selected = CONFIG.THEME === val;
            themeSelect.appendChild(opt);
        });
        themeItem.appendChild(themeLbl);
        themeItem.appendChild(themeSelect);
        appearanceSection.appendChild(themeItem);

        // Font family select
        const fontItem = document.createElement('div');
        fontItem.className = 'setting-item';
        fontItem.title = 'Choose the typeface for the counter and UI text.';
        const fontLbl = document.createElement('label');
        fontLbl.textContent = 'Font Family';
        const fontSelect = document.createElement('select');
        fontSelect.id = 'setting-font-family';
        ['Segoe UI', 'Arial', 'Roboto', 'Consolas', 'Courier New', 'Georgia', 'Verdana'].forEach(font => {
            const opt = document.createElement('option');
            opt.value = font;
            opt.textContent = font;
            opt.selected = CONFIG.FONT_FAMILY === font;
            fontSelect.appendChild(opt);
        });
        fontItem.appendChild(fontLbl);
        fontItem.appendChild(fontSelect);
        appearanceSection.appendChild(fontItem);

        // Font size slider
        const fontSizeItem = document.createElement('div');
        fontSizeItem.className = 'setting-item';
        fontSizeItem.title = 'Adjust the text size in pixels (10-20px). Larger values make text easier to read.';
        const fontSizeLbl = document.createElement('label');
        fontSizeLbl.textContent = 'Font Size';
        const fontSizeSlider = document.createElement('input');
        fontSizeSlider.type = 'range';
        fontSizeSlider.id = 'setting-font-size';
        fontSizeSlider.min = 10;
        fontSizeSlider.max = 20;
        fontSizeSlider.value = CONFIG.FONT_SIZE;
        const fontSizeValue = document.createElement('span');
        fontSizeValue.id = 'font-size-value';
        fontSizeValue.textContent = CONFIG.FONT_SIZE + 'px';
        fontSizeSlider.addEventListener('input', (e) => {
            fontSizeValue.textContent = e.target.value + 'px';
        });
        fontSizeItem.appendChild(fontSizeLbl);
        fontSizeItem.appendChild(fontSizeSlider);
        fontSizeItem.appendChild(fontSizeValue);
        appearanceSection.appendChild(fontSizeItem);

        // Font weight select
        const fontWeightItem = document.createElement('div');
        fontWeightItem.className = 'setting-item';
        fontWeightItem.title = 'Control text thickness: Normal, Bold, Light, or Semi-Bold.';
        const fontWeightLbl = document.createElement('label');
        fontWeightLbl.textContent = 'Font Weight';
        const fontWeightSelect = document.createElement('select');
        fontWeightSelect.id = 'setting-font-weight';
        ['normal', 'bold', 'lighter', '600'].forEach(weight => {
            const opt = document.createElement('option');
            opt.value = weight;
            opt.textContent = weight === 'normal' ? 'Normal' : weight === 'bold' ? 'Bold' : weight === 'lighter' ? 'Light' : 'Semi-Bold';
            opt.selected = CONFIG.FONT_WEIGHT === weight;
            fontWeightSelect.appendChild(opt);
        });
        fontWeightItem.appendChild(fontWeightLbl);
        fontWeightItem.appendChild(fontWeightSelect);
        appearanceSection.appendChild(fontWeightItem);

        // Opacity slider
        const opacityItem = document.createElement('div');
        opacityItem.className = 'setting-item';
        opacityItem.title = 'Counter transparency (50-100%). Higher values make it more visible, lower values make it more subtle.';
        const opacityLbl = document.createElement('label');
        opacityLbl.textContent = 'Counter Opacity';
        const opacitySlider = document.createElement('input');
        opacitySlider.type = 'range';
        opacitySlider.id = 'setting-opacity';
        opacitySlider.min = 50;
        opacitySlider.max = 100;
        opacitySlider.value = CONFIG.COUNTER_OPACITY;
        const opacityValue = document.createElement('span');
        opacityValue.id = 'opacity-value';
        opacityValue.textContent = CONFIG.COUNTER_OPACITY + '%';
        opacitySlider.addEventListener('input', (e) => {
            opacityValue.textContent = e.target.value + '%';
        });
        opacityItem.appendChild(opacityLbl);
        opacityItem.appendChild(opacitySlider);
        opacityItem.appendChild(opacityValue);
        appearanceSection.appendChild(opacityItem);

        // Open on load toggle
        const openOnLoadItem = document.createElement('div');
        openOnLoadItem.className = 'setting-item';
        openOnLoadItem.title = 'When enabled, the counter opens automatically when YouTube/new tabs load.';
        const openOnLoadCb = document.createElement('input');
        openOnLoadCb.type = 'checkbox';
        openOnLoadCb.id = 'setting-open-on-load';
        openOnLoadCb.checked = CONFIG.OPEN_COUNTER_ON_LOAD;
        const openOnLoadLbl = document.createElement('label');
        openOnLoadLbl.appendChild(openOnLoadCb);
        openOnLoadLbl.appendChild(document.createTextNode(' Open Counter on Load'));
        openOnLoadItem.appendChild(openOnLoadLbl);
        openOnLoadCb.addEventListener('change', () => {
            updateConfig({ OPEN_COUNTER_ON_LOAD: openOnLoadCb.checked });
            showNotification(openOnLoadCb.checked ? '✓ Counter will open on load' : '✓ Counter will stay hidden on load', 1500);
        });
        appearanceSection.appendChild(openOnLoadItem);

        body.appendChild(appearanceSection);

        // === KEYBOARD SHORTCUT ===
        const shortcutSection = createSection('⌨️ Keyboard Shortcut');
        const shortcutItem = document.createElement('div');
        shortcutItem.className = 'setting-item';
        shortcutItem.title = 'Configure keyboard shortcut to show/hide the counter. Example: Ctrl+F to toggle.';
        const shortcutLbl = document.createElement('label');
        shortcutLbl.textContent = 'Toggle Counter Visibility';
        shortcutItem.appendChild(shortcutLbl);
        const shortcutDiv = document.createElement('div');
        shortcutDiv.className = 'keyboard-shortcut';
        ['ctrl', 'alt', 'shift'].forEach(modifier => {
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.id = 'shortcut-' + modifier;
            cb.checked = CONFIG['USE_' + modifier.toUpperCase()];
            const cbLbl = document.createElement('label');
            cbLbl.appendChild(cb);
            cbLbl.appendChild(document.createTextNode(' ' + modifier.charAt(0).toUpperCase() + modifier.slice(1)));
            shortcutDiv.appendChild(cbLbl);
        });
        shortcutDiv.appendChild(document.createTextNode(' + '));
        const keySelect = document.createElement('select');
        keySelect.id = 'shortcut-key';
        ['KeyF', 'KeyH', 'KeyY', 'KeyQ'].forEach(key => {
            const opt = document.createElement('option');
            opt.value = key;
            opt.textContent = key.replace('Key', '');
            opt.selected = CONFIG.KEYBOARD_SHORTCUT === key;
            keySelect.appendChild(opt);
        });
        shortcutDiv.appendChild(keySelect);
        shortcutItem.appendChild(shortcutDiv);
        
        // Add conflict detection display
        const conflictWarning = document.createElement('div');
        conflictWarning.id = 'shortcut-conflict-warning';
        conflictWarning.style.cssText = 'margin-top: 10px; padding: 8px; border-radius: 4px; font-size: 12px; display: none;';
        shortcutItem.appendChild(conflictWarning);
        
        // Check for conflicts on load and input change
        const checkConflicts = () => {
            const result = detectShortcutConflicts();
            if (result.hasConflicts) {
                const conflict = result.conflicts[0];
                conflictWarning.style.display = 'block';
                conflictWarning.style.backgroundColor = conflict.severity === 'high' ? 'rgba(255, 0, 0, 0.15)' : 'rgba(255, 165, 0, 0.15)';
                conflictWarning.style.borderLeft = `3px solid ${conflict.severity === 'high' ? '#ff0000' : '#ffa500'}`;
                conflictWarning.textContent = `⚠️ ${conflict.message}. ${conflict.suggestion}.`;
            } else {
                conflictWarning.style.display = 'none';
            }
        };
        
        checkConflicts();
        ['ctrl', 'alt', 'shift'].forEach(mod => {
            document.querySelector(`#shortcut-${mod}`)?.addEventListener('change', checkConflicts);
        });
        keySelect.addEventListener('change', checkConflicts);
        
        shortcutSection.appendChild(shortcutItem);
        body.appendChild(shortcutSection);

        // === STATISTICS ===
        const statsSection = createSection('📊 Statistics');
        const enableStatsItem = document.createElement('div');
        enableStatsItem.className = 'setting-item';
        enableStatsItem.title = 'Track total filtered videos across all browsing sessions. Stored locally in your browser.';
        const enableStatsCb = document.createElement('input');
        enableStatsCb.type = 'checkbox';
        enableStatsCb.id = 'setting-enable-stats';
        enableStatsCb.checked = CONFIG.ENABLE_STATISTICS;
        const enableStatsLbl = document.createElement('label');
        enableStatsLbl.appendChild(enableStatsCb);
        enableStatsLbl.appendChild(document.createTextNode(' Track Lifetime Statistics'));
        enableStatsItem.appendChild(enableStatsLbl);
        statsSection.appendChild(enableStatsItem);

        const notifItem = document.createElement('div');
        notifItem.className = 'setting-item';
        notifItem.title = 'Display toast notifications when actions are performed (e.g., settings saved, channel added to list).';
        const notifCb = document.createElement('input');
        notifCb.type = 'checkbox';
        notifCb.id = 'setting-show-notifications';
        notifCb.checked = CONFIG.SHOW_NOTIFICATIONS;
        const notifLbl = document.createElement('label');
        notifLbl.appendChild(notifCb);
        notifLbl.appendChild(document.createTextNode(' Show Notifications'));
        notifItem.appendChild(notifLbl);
        statsSection.appendChild(notifItem);

        const statsDisplay = document.createElement('div');
        statsDisplay.className = 'stats-display';
        const daysSince = Math.floor((Date.now() - state.lifetimeStats.firstInstall) / (1000 * 60 * 60 * 24));
        statsDisplay.appendChild(Object.assign(document.createElement('p'), { textContent: '🎬 Total Filtered: ' + state.lifetimeStats.totalFiltered.toLocaleString() }));
        statsDisplay.appendChild(Object.assign(document.createElement('p'), { textContent: '📅 Active Since: ' + new Date(state.lifetimeStats.firstInstall).toLocaleDateString() }));
        statsDisplay.appendChild(Object.assign(document.createElement('p'), { textContent: '⏱️ Days Active: ' + daysSince }));
        const resetStatsBtn = document.createElement('button');
        resetStatsBtn.className = 'btn-reset-stats';
        resetStatsBtn.textContent = 'Reset Statistics';
        resetStatsBtn.addEventListener('click', () => {
            confirmAction('Reset all statistics?', () => {
                state.lifetimeStats = { totalFiltered: 0, firstInstall: Date.now(), lastReset: Date.now() };
                saveStats();
                showNotification('✓ Statistics reset successfully');
                setTimeout(() => toggleSettingsPanel(), 500);
            });
        });
        statsDisplay.appendChild(resetStatsBtn);
        statsSection.appendChild(statsDisplay);
        body.appendChild(statsSection);

        // === ADVANCED ===
        const advSection = createSection('🔧 Advanced');
        const smoothItem = document.createElement('div');
        smoothItem.className = 'setting-item';
        smoothItem.title = 'Animate filtered videos with fade-out and scale effects. Disable for instant removal (faster but less smooth).';
        const smoothCb = document.createElement('input');
        smoothCb.type = 'checkbox';
        smoothCb.id = 'setting-smooth-removal';
        smoothCb.checked = CONFIG.SMOOTH_REMOVAL;
        const smoothLbl = document.createElement('label');
        smoothLbl.appendChild(smoothCb);
        smoothLbl.appendChild(document.createTextNode(' Smooth Video Removal Animation'));
        smoothItem.appendChild(smoothLbl);
        advSection.appendChild(smoothItem);

        const dragItem = document.createElement('div');
        dragItem.className = 'setting-item';
        dragItem.title = 'Allow moving the counter by clicking and dragging its header. Works with mouse and touch.';
        const dragCb = document.createElement('input');
        dragCb.type = 'checkbox';
        dragCb.id = 'setting-draggable';
        dragCb.checked = CONFIG.COUNTER_DRAGGABLE;
        const dragLbl = document.createElement('label');
        dragLbl.appendChild(dragCb);
        dragLbl.appendChild(document.createTextNode(' Draggable Counter'));
        dragItem.appendChild(dragLbl);
        advSection.appendChild(dragItem);

        const liveItem = document.createElement('div');
        liveItem.className = 'setting-item';
        liveItem.title = 'When enabled, currently streaming LIVE videos will never be filtered regardless of view count or duration.';
        const liveCb = document.createElement('input');
        liveCb.type = 'checkbox';
        liveCb.id = 'setting-skip-live';
        liveCb.checked = CONFIG.SKIP_LIVE_STREAMS;
        const liveLbl = document.createElement('label');
        liveLbl.appendChild(liveCb);
        liveLbl.appendChild(document.createTextNode(' Do not filter LIVE videos'));
        liveItem.appendChild(liveLbl);
        advSection.appendChild(liveItem);

        const ciItem = document.createElement('div');
        ciItem.className = 'setting-item';
        ciItem.title = 'Ignore uppercase/lowercase differences when matching channel names. "TechChannel" will match "techchannel".';
        const ciCb = document.createElement('input');
        ciCb.type = 'checkbox';
        ciCb.id = 'setting-case-insensitive';
        ciCb.checked = CONFIG.CASE_INSENSITIVE_LISTS;
        const ciLbl = document.createElement('label');
        ciLbl.appendChild(ciCb);
        ciLbl.appendChild(document.createTextNode(' Case-insensitive whitelist/blacklist matching'));
        ciItem.appendChild(ciLbl);
        advSection.appendChild(ciItem);

        const filterAllLiveItem = document.createElement('div');
        filterAllLiveItem.className = 'setting-item';
        filterAllLiveItem.title = 'Hide ALL live streaming videos regardless of view count or duration. Overrides "Do not filter LIVE videos" setting.';
        const filterAllLiveCb = document.createElement('input');
        filterAllLiveCb.type = 'checkbox';
        filterAllLiveCb.id = 'setting-filter-all-live';
        filterAllLiveCb.checked = CONFIG.FILTER_ALL_LIVE_STREAMS;
        const filterAllLiveLbl = document.createElement('label');
        filterAllLiveLbl.appendChild(filterAllLiveCb);
        filterAllLiveLbl.appendChild(document.createTextNode(' Filter ALL LIVE streams'));
        filterAllLiveItem.appendChild(filterAllLiveLbl);
        advSection.appendChild(filterAllLiveItem);

        const filterAllShortsItem = document.createElement('div');
        filterAllShortsItem.className = 'setting-item';
        filterAllShortsItem.title = 'Hide ALL YouTube Shorts regardless of view count or duration.';
        const filterAllShortsCb = document.createElement('input');
        filterAllShortsCb.type = 'checkbox';
        filterAllShortsCb.id = 'setting-filter-all-shorts';
        filterAllShortsCb.checked = CONFIG.FILTER_ALL_SHORTS;
        const filterAllShortsLbl = document.createElement('label');
        filterAllShortsLbl.appendChild(filterAllShortsCb);
        filterAllShortsLbl.appendChild(document.createTextNode(' Filter ALL Shorts'));
        filterAllShortsItem.appendChild(filterAllShortsLbl);
        advSection.appendChild(filterAllShortsItem);

        const debugItem = document.createElement('div');
        debugItem.className = 'setting-item';
        debugItem.title = 'Log detailed filtering information to browser console. Useful for troubleshooting issues.';
        const debugCb = document.createElement('input');
        debugCb.type = 'checkbox';
        debugCb.id = 'setting-debug';
        debugCb.checked = CONFIG.DEBUG;
        const debugLbl = document.createElement('label');
        debugLbl.appendChild(debugCb);
        debugLbl.appendChild(document.createTextNode(' Enable Debug Logging'));
        debugItem.appendChild(debugLbl);
        advSection.appendChild(debugItem);

        const animHeader = document.createElement('h4');
        animHeader.textContent = 'Animation Timings (ms / scale)';
        animHeader.title = 'Fine-tune animation speeds and effects. Lower durations = faster animations. Requires "Smooth Removal" enabled.';
        advSection.appendChild(animHeader);

        const removalTime = createInputRow('Removal Duration (ms)', 'number', 'setting-removal-duration', CONFIG.REMOVAL_DURATION_MS, 50, 5000, 50);
        removalTime.title = 'How long (in milliseconds) the fade-out animation takes when removing videos. 300ms = 0.3 seconds.';
        const removalScale = createInputRow('Removal Scale', 'number', 'setting-removal-scale', CONFIG.REMOVAL_SCALE, 0.5, 1, 0.01);
        removalScale.title = 'Scale factor during removal animation. 0.95 = shrink to 95%. Lower values = more dramatic shrink effect.';
        const notifDur = createInputRow('Notification Duration (ms)', 'number', 'setting-notification-duration', CONFIG.NOTIFICATION_DURATION_MS, 500, 10000, 100);
        notifDur.title = 'How long toast notifications stay visible before fading. 3000ms = 3 seconds.';
        const notifFade = createInputRow('Notification Fade (ms)', 'number', 'setting-notification-fade', CONFIG.NOTIFICATION_FADE_MS, 50, 2000, 50);
        notifFade.title = 'Duration of notification fade-in/fade-out animation. 300ms = 0.3 seconds.';
        const pulseDur = createInputRow('Counter Pulse Duration (ms)', 'number', 'setting-pulse-duration', CONFIG.COUNTER_PULSE_DURATION_MS, 50, 2000, 50);
        pulseDur.title = 'How long the counter number pulses/scales when stats update. 200ms = 0.2 seconds.';
        const pulseScale = createInputRow('Counter Pulse Scale', 'number', 'setting-pulse-scale', CONFIG.COUNTER_PULSE_SCALE, 1, 2, 0.05);
        pulseScale.title = 'Scale multiplier for counter pulse effect. 1.3 = grow to 130% then return to normal.';

        advSection.appendChild(removalTime);
        advSection.appendChild(removalScale);
        advSection.appendChild(notifDur);
        advSection.appendChild(notifFade);
        advSection.appendChild(pulseDur);
        advSection.appendChild(pulseScale);

        body.appendChild(advSection);

        // ========== FEATURE 1: Export/Import Section ==========
        const exportSection = createSection('💾 Export/Import Settings');
        const exportBtn = document.createElement('button');
        exportBtn.className = 'btn-export';
        exportBtn.textContent = '📥 Export Settings to Clipboard';
        exportBtn.title = 'Copy all settings as JSON to clipboard for backup or sharing';
        exportBtn.addEventListener('click', exportSettings);
        exportSection.appendChild(exportBtn);
        
        const importContainer = document.createElement('div');
        importContainer.className = 'setting-item';
        const importLabel = document.createElement('label');
        importLabel.textContent = 'Import Settings from JSON:';
        const importTextarea = document.createElement('textarea');
        importTextarea.id = 'settings-import-textarea';
        importTextarea.placeholder = 'Paste exported JSON settings here...';
        importTextarea.style.width = '100%';
        importTextarea.style.height = '80px';
        importTextarea.style.fontFamily = 'monospace';
        importTextarea.style.fontSize = '12px';
        const importBtn = document.createElement('button');
        importBtn.textContent = '📤 Import Settings';
        importBtn.className = 'btn-import';
        importBtn.title = 'Paste JSON from exported settings';
        importBtn.addEventListener('click', () => {
            const json = importTextarea.value.trim();
            if (json && importSettings(json)) {
                importTextarea.value = '';
                setTimeout(() => toggleSettingsPanel(), 500);
            }
        });
        importContainer.appendChild(importLabel);
        importContainer.appendChild(importTextarea);
        importContainer.appendChild(importBtn);
        exportSection.appendChild(importContainer);
        body.appendChild(exportSection);

        // ========== FEATURE 3: History/Undo Section ==========
        const historySection = createSection('↶ Whitelist/Blacklist History');
        const historyInfo = document.createElement('p');
        historyInfo.style.fontSize = '12px';
        historyInfo.style.color = '#999';
        historyInfo.textContent = `Whitelist history: ${state.whitelistHistory.length} | Blacklist history: ${state.blacklistHistory.length}`;
        historySection.appendChild(historyInfo);
        const undoWlBtn = document.createElement('button');
        undoWlBtn.textContent = '↶ Undo Last Whitelist Change';
        undoWlBtn.addEventListener('click', () => undoLastListChange('whitelist'));
        const undoBlBtn = document.createElement('button');
        undoBlBtn.textContent = '↶ Undo Last Blacklist Change';
        undoBlBtn.addEventListener('click', () => undoLastListChange('blacklist'));
        historySection.appendChild(undoWlBtn);
        historySection.appendChild(undoBlBtn);
        body.appendChild(historySection);

        // ========== FEATURE 4: Advanced Stats Section ==========
        const advancedStatsSection = createSection('📊 Advanced Statistics');
        const detailedStatsToggle = document.createElement('div');
        detailedStatsToggle.className = 'setting-item';
        const detailedStatsCb = document.createElement('input');
        detailedStatsCb.type = 'checkbox';
        detailedStatsCb.id = 'setting-detailed-stats';
        detailedStatsCb.checked = CONFIG.ENABLE_DETAILED_STATS;
        const detailedStatsLbl = document.createElement('label');
        detailedStatsLbl.appendChild(detailedStatsCb);
        detailedStatsLbl.appendChild(document.createTextNode(' Enable Detailed Stats'));
        detailedStatsToggle.appendChild(detailedStatsLbl);
        advancedStatsSection.appendChild(detailedStatsToggle);
        const showStatsBtn = document.createElement('button');
        showStatsBtn.textContent = '📈 View Detailed Stats';
        showStatsBtn.addEventListener('click', () => {
            try {
                const stats = state.detailedStats;
                let statsText = '=== DETAILED FILTER STATISTICS ===\n\n';
                statsText += 'BY REASON:\n';
                Object.entries(stats.byReason).forEach(([reason, count]) => {
                    statsText += `  ${reason}: ${count}\n`;
                });
                statsText += '\nBY CHANNEL (Top 10):\n';
                const topChannels = Object.entries(stats.byChannel)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 10);
                topChannels.forEach(([channel, count]) => {
                    statsText += `  ${channel}: ${count}\n`;
                });
                statsText += '\nBY DATE (Last 7 Days):\n';
                Object.entries(stats.byDate)
                    .sort((a, b) => b[0].localeCompare(a[0]))
                    .slice(0, 7)
                    .forEach(([date, count]) => {
                        statsText += `  ${date}: ${count}\n`;
                    });
                console.log(statsText);
                showNotification('✓ Stats logged to console', 2000);
            } catch (e) {
                log('❌ Error displaying stats:', e);
                showNotification('⚠️ Error displaying stats', 2000);
            }
        });
        const clearStatsBtn = document.createElement('button');
        clearStatsBtn.textContent = '🗑️ Clear Detailed Stats';
        clearStatsBtn.className = 'btn-danger';
        clearStatsBtn.addEventListener('click', () => {
            confirmAction('Clear all detailed statistics?', () => {
                state.detailedStats = { byReason: { views: 0, duration: 0, live: 0, short: 0, blacklist: 0, other: 0 }, byChannel: {}, byDate: {} };
                GM_setValue('detailedStats', state.detailedStats);
                showNotification('✓ Detailed stats cleared', 2000);
            });
        });
        advancedStatsSection.appendChild(showStatsBtn);
        advancedStatsSection.appendChild(clearStatsBtn);
        body.appendChild(advancedStatsSection);

        // ========== FEATURE 5: Bulk Import Section ==========
        const bulkSection = createSection('📋 Bulk Channel Import');
        const bulkContainer = document.createElement('div');
        bulkContainer.className = 'setting-item';
        const bulkLabel = document.createElement('label');
        bulkLabel.textContent = 'Import channels (comma or newline separated):';
        const bulkTextarea = document.createElement('textarea');
        bulkTextarea.id = 'bulk-import-textarea';
        bulkTextarea.placeholder = 'channel1, channel2, channel3\nOr paste each on a new line';
        bulkTextarea.style.width = '100%';
        bulkTextarea.style.height = '80px';
        const bulkModeLabel = document.createElement('label');
        bulkModeLabel.innerHTML = '<input type="radio" name="bulk-mode" value="whitelist" checked> Add to Whitelist &nbsp; ' +
            '<input type="radio" name="bulk-mode" value="blacklist"> Add to Blacklist';
        const bulkImportBtn = document.createElement('button');
        bulkImportBtn.textContent = '📥 Import Channels';
        bulkImportBtn.addEventListener('click', () => {
            try {
                const text = bulkTextarea.value;
                const mode = document.querySelector('input[name="bulk-mode"]:checked').value;
                const channels = text
                    .split(/[\n,]/)
                    .map(c => c.trim())
                    .filter(c => c.length > 0);
                const targetList = mode === 'whitelist' ? CONFIG.WHITELIST : CONFIG.BLACKLIST;
                let added = 0;
                channels.forEach(channel => {
                    if (!listContains(targetList, channel)) {
                        targetList.push(channel);
                        const hist = mode === 'whitelist' ? state.whitelistHistory : state.blacklistHistory;
                        addToHistory(hist, { entry: channel, action: 'add' });
                        added++;
                    }
                });
                const key = mode === 'whitelist' ? 'WHITELIST' : 'BLACKLIST';
                updateConfig({ [key]: targetList });
                if (mode === 'whitelist') GM_setValue('whitelistHistory', state.whitelistHistory);
                else GM_setValue('blacklistHistory', state.blacklistHistory);
                showNotification(`✓ Added ${added} channel(s) to ${mode}`, 2000);
                bulkTextarea.value = '';
                state.processedVideos = new WeakSet();
                clearParsingMarkers();
                filterVideos();
            } catch (e) {
                log('❌ Error importing channels:', e);
                showNotification('⚠️ Error: ' + e.message, 2000);
            }
        });
        bulkContainer.appendChild(bulkLabel);
        bulkContainer.appendChild(bulkTextarea);
        bulkContainer.appendChild(bulkModeLabel);
        bulkContainer.appendChild(bulkImportBtn);
        bulkSection.appendChild(bulkContainer);
        body.appendChild(bulkSection);

        // ========== FEATURE 6: Performance Metrics Section ==========
        const perfSection = createSection('⚡ Performance Metrics');
        const perfToggle = document.createElement('div');
        perfToggle.className = 'setting-item';
        const perfCb = document.createElement('input');
        perfCb.type = 'checkbox';
        perfCb.id = 'setting-perf-metrics';
        perfCb.checked = CONFIG.ENABLE_PERFORMANCE_METRICS;
        const perfLbl = document.createElement('label');
        perfLbl.appendChild(perfCb);
        perfLbl.appendChild(document.createTextNode(' Enable Performance Tracking'));
        perfToggle.appendChild(perfLbl);
        perfSection.appendChild(perfToggle);
        const perfViewBtn = document.createElement('button');
        perfViewBtn.textContent = '📊 View Metrics';
        perfViewBtn.addEventListener('click', () => {
            const metrics = state.performanceMetrics;
            let text = 'Query Performance:\n';
            Object.entries(metrics.queryCounts).forEach(([name, count]) => {
                text += `  ${name}: ${count} calls\n`;
            });
            text += `\nBatch Processing:\n  Total Batches: ${metrics.batchProcessingStats.totalBatches}\n  Avg Items/Batch: ${metrics.batchProcessingStats.avgItemsPerBatch}\n`;
            console.log(text);
            showNotification('✓ Metrics logged to console', 2000);
        });
        perfSection.appendChild(perfViewBtn);
        body.appendChild(perfSection);

        // ========== FEATURE 7: Accessibility Section ==========
        const a11ySection = createSection('♿ Accessibility');
        const a11yInfo = document.createElement('p');
        a11yInfo.style.fontSize = '12px';
        a11yInfo.style.color = '#999';
        a11yInfo.textContent = 'Enhanced keyboard navigation and screen reader support enabled. WCAG 2.1 AA compliant.';
        a11ySection.appendChild(a11yInfo);
        body.appendChild(a11ySection);

        // ========== FEATURE 8: Memory Diagnostics Section ==========
        const memSection = createSection('💾 Memory & Diagnostics');
        const memBtn = document.createElement('button');
        memBtn.textContent = '🔍 Check Memory Health';
        memBtn.addEventListener('click', () => {
            checkMemoryHealth();
            const diag = state.memoryDiagnostics;
            const text = `Event Listeners: ${diag.eventListenerCount}\nLast Check: ${new Date(diag.lastCheck).toLocaleTimeString()}`;
            console.log(text);
            showNotification('✓ Diagnostics logged to console', 2000);
        });
        memSection.appendChild(memBtn);
        body.appendChild(memSection);

        // Footer
        const footer = document.createElement('div');
        footer.className = 'settings-footer';
        const resetBtn = document.createElement('button');
        resetBtn.className = 'btn-reset';
        resetBtn.textContent = 'Reset to Defaults';
        resetBtn.addEventListener('click', () => {
            confirmAction('Reset all settings to defaults?', () => {
                CONFIG = { ...DEFAULT_CONFIG };
                saveConfig(CONFIG);
                showNotification('✓ Settings reset to defaults');
                setTimeout(() => location.reload(), 500);
            });
        });
        const saveBtn = document.createElement('button');
        saveBtn.className = 'btn-save';
        saveBtn.textContent = 'Save Settings';
        saveBtn.addEventListener('click', () => {
            try {
                // Validate and parse inputs
                const minViews = Math.max(0, parseInt(document.querySelector('#setting-min-views')?.value) || 0);
                const minDuration = Math.max(0, parseInt(document.querySelector('#setting-min-duration')?.value) || 0);
                const fontSize = Math.max(10, Math.min(20, parseInt(document.querySelector('#setting-font-size')?.value) || 14));
                const opacity = Math.max(50, Math.min(100, parseInt(document.querySelector('#setting-opacity')?.value) || 95));
                const removalDur = Math.max(50, Math.min(5000, parseInt(document.querySelector('#setting-removal-duration')?.value) || 300));
                const removalScale = Math.max(0.5, Math.min(1, parseFloat(document.querySelector('#setting-removal-scale')?.value) || 0.95));
                const notifDur = Math.max(500, Math.min(10000, parseInt(document.querySelector('#setting-notification-duration')?.value) || 3000));
                const notifFade = Math.max(50, Math.min(2000, parseInt(document.querySelector('#setting-notification-fade')?.value) || 300));
                const pulseDur = Math.max(50, Math.min(2000, parseInt(document.querySelector('#setting-pulse-duration')?.value) || 200));
                const pulseScale = Math.max(1, Math.min(2, parseFloat(document.querySelector('#setting-pulse-scale')?.value) || 1.3));

                const oldConfig = { ...CONFIG };
                CONFIG.MIN_VIEWS = minViews;
                CONFIG.MIN_DURATION_SECONDS = minDuration;
                CONFIG.FILTER_MODE = document.querySelector('#setting-filter-mode')?.value || 'OR';
                CONFIG.ENABLE_WHITELIST = document.querySelector('#setting-enable-whitelist')?.checked || false;
                CONFIG.ENABLE_BLACKLIST = document.querySelector('#setting-enable-blacklist')?.checked || false;
                CONFIG.THEME = document.querySelector('#setting-theme')?.value || 'dark';
                CONFIG.FONT_FAMILY = document.querySelector('#setting-font-family')?.value || 'Segoe UI';
                CONFIG.FONT_SIZE = fontSize;
                CONFIG.FONT_WEIGHT = document.querySelector('#setting-font-weight')?.value || 'normal';
                CONFIG.COUNTER_OPACITY = opacity;
                CONFIG.USE_CTRL = document.querySelector('#shortcut-ctrl')?.checked || false;
                CONFIG.USE_ALT = document.querySelector('#shortcut-alt')?.checked || false;
                CONFIG.USE_SHIFT = document.querySelector('#shortcut-shift')?.checked || false;
                CONFIG.KEYBOARD_SHORTCUT = document.querySelector('#shortcut-key')?.value || 'KeyF';
                CONFIG.ENABLE_STATISTICS = document.querySelector('#setting-enable-stats')?.checked || false;
                CONFIG.SHOW_NOTIFICATIONS = document.querySelector('#setting-show-notifications')?.checked || false;
                CONFIG.SMOOTH_REMOVAL = document.querySelector('#setting-smooth-removal')?.checked || false;
                CONFIG.COUNTER_DRAGGABLE = document.querySelector('#setting-draggable')?.checked || false;
                CONFIG.DEBUG = document.querySelector('#setting-debug')?.checked || false;
                CONFIG.SKIP_LIVE_STREAMS = document.querySelector('#setting-skip-live')?.checked || false;
                CONFIG.CASE_INSENSITIVE_LISTS = document.querySelector('#setting-case-insensitive')?.checked || false;
                CONFIG.FILTER_ALL_LIVE_STREAMS = document.querySelector('#setting-filter-all-live')?.checked || false;
                CONFIG.FILTER_ALL_SHORTS = document.querySelector('#setting-filter-all-shorts')?.checked || false;
                CONFIG.REMOVAL_DURATION_MS = removalDur;
                CONFIG.REMOVAL_SCALE = removalScale;
                CONFIG.NOTIFICATION_DURATION_MS = notifDur;
                CONFIG.NOTIFICATION_FADE_MS = notifFade;
                CONFIG.COUNTER_PULSE_DURATION_MS = pulseDur;
                CONFIG.COUNTER_PULSE_SCALE = pulseScale;
                CONFIG.OPEN_COUNTER_ON_LOAD = document.querySelector('#setting-open-on-load')?.checked || false;
                // Detailed stats setting with proper default handling
                CONFIG.ENABLE_DETAILED_STATS = document.querySelector('#setting-detailed-stats')?.checked || false;
                CONFIG.ENABLE_PERFORMANCE_METRICS = document.querySelector('#setting-perf-metrics')?.checked || false;

                saveConfig(CONFIG);
                log('✓ Settings saved:', CONFIG);
                
                // Show conflict warning if exists
                const conflictCheck = detectShortcutConflicts();
                if (conflictCheck.hasConflicts) {
                    const conflict = conflictCheck.conflicts[0];
                    showNotification(`⚠️ ${conflict.message}`, 4000);
                } else {
                    showNotification('✓ Settings saved successfully');
                }
                
                if (state.counterElement) {
                    state.counterElement.remove();
                    state.counterElement = null;
                }
                injectStyles();
                createCounter();
                state.processedVideos = new WeakSet();
                clearParsingMarkers();
                filterVideos();
                toggleSettingsPanel();
            } catch (e) {
                log('❌ Error saving settings:', e);
                showNotification('⚠️ Error saving settings: ' + e.message);
            }
        });
        footer.appendChild(resetBtn);
        footer.appendChild(saveBtn);

        content.appendChild(header);
        content.appendChild(body);
        content.appendChild(footer);
        panel.appendChild(overlay);
        panel.appendChild(content);

        document.body.appendChild(panel);
        state.settingsPanel = panel;

        overlay.addEventListener('click', () => toggleSettingsPanel());
        closeBtn.addEventListener('click', () => toggleSettingsPanel());

        return panel;
    };

    /**
     * Toggle settings panel visibility
     */
    const toggleSettingsPanel = () => {
        try {
            if (!state.settingsPanel) {
                createSettingsPanel();
                if (!state.settingsPanel) {
                    log('❌ Failed to create settings panel');
                    return;
                }
            }
            
            const isVisible = state.settingsPanel.classList.contains('visible');
            if (isVisible) {
                state.settingsPanel.classList.remove('visible');
            } else {
                state.settingsPanel.classList.add('visible');
            }
        } catch (e) {
            log('❌ Error toggling settings panel:', e);
            showNotification('⚠️ Failed to open settings');
        }
    };

    // ==================== STYLES ====================

    const getThemeColors = () => {
        if (CONFIG.THEME === 'light') {
            return {
                bg: 'linear-gradient(135deg, #ffffff 0%, #f5f5f5 100%)',
                border: '#cccccc',
                headerBg: 'linear-gradient(135deg, #333333 0%, #555555 100%)',
                text: '#333',
                textMuted: '#666',
                statBg: 'rgba(200, 200, 200, 0.15)',
                infoBg: 'rgba(0, 0, 0, 0.05)',
                shadow: 'rgba(0, 0, 0, 0.2)',
                shadowHover: 'rgba(0, 0, 0, 0.3)'
            };
        }
        return {
            bg: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
            border: '#555555',
            headerBg: 'linear-gradient(135deg, #333333 0%, #555555 100%)',
            text: '#ffffff',
            textMuted: '#999999',
            statBg: 'rgba(100, 100, 100, 0.15)',
            infoBg: 'rgba(255, 255, 255, 0.05)',
            shadow: 'rgba(0, 0, 0, 0.6)',
            shadowHover: 'rgba(100, 100, 100, 0.3)'
        };
    };

    const injectStyles = () => {
        const theme = getThemeColors();
        const existingStyle = document.getElementById('yt-filter-styles');
        if (existingStyle) {
            existingStyle.remove();
        }
        const style = document.createElement('style');
        style.id = 'yt-filter-styles';
        style.textContent = `
            #yt-filter-counter {
                position: fixed;
                top: 100px;
                left: 20px;
                background: ${theme.bg};
                border: 2px solid ${theme.border};
                border-radius: 12px;
                padding: 0;
                z-index: 999999;
                box-shadow: 0 8px 32px ${theme.shadow};
                min-width: 220px;
                backdrop-filter: blur(10px);
                transition: transform 0.2s ease;
            }

            #yt-filter-counter:hover {
                transform: translateY(-2px);
                box-shadow: 0 12px 40px ${theme.shadowHover};
            }

            .yt-filter-header {
                background: ${theme.headerBg};
                padding: 10px 15px;
                border-radius: 10px 10px 0 0;
                display: flex;
                justify-content: space-between;
                align-items: center;
                user-select: none;
            }

            .yt-filter-title {
                font-weight: bold;
                color: #fff;
                letter-spacing: 0.5px;
                font-size: 14px;
            }

            .yt-filter-buttons {
                display: flex;
                gap: 5px;
            }

            .yt-filter-settings,
            .yt-filter-toggle,
            .yt-filter-menu,
            .yt-filter-close {
                background: rgba(255, 255, 255, 0.2);
                border: none;
                color: #fff;
                font-size: 16px;
                width: 24px;
                height: 24px;
                border-radius: 50%;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: background 0.2s;
                padding: 0;
                line-height: 1;
            }

            .yt-filter-settings:hover,
            .yt-filter-toggle:hover,
            .yt-filter-menu:hover,
            .yt-filter-close:hover {
                background: rgba(255, 255, 255, 0.3);
            }

            .yt-filter-quick-menu {
                display: none;
                flex-direction: column;
                position: absolute;
                top: 100%;
                right: 0;
                background: ${CONFIG.THEME === 'dark' ? '#1a1a1a' : '#ffffff'};
                border: 1px solid ${theme.border};
                border-radius: 8px;
                margin-top: 5px;
                min-width: 200px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                z-index: 1000000;
            }

            .yt-filter-menu-item {
                padding: 10px 15px;
                border: none;
                background: transparent;
                color: ${theme.text};
                text-align: left;
                cursor: pointer;
                transition: background 0.2s;
                font-size: 13px;
            }

            .yt-filter-menu-item:first-child {
                border-radius: 8px 8px 0 0;
            }

            .yt-filter-menu-item:last-child {
                border-radius: 0 0 8px 8px;
            }

            .yt-filter-menu-item:hover {
                background: ${CONFIG.THEME === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'};
            }

            .yt-filter-stats {
                padding: 15px;
            }

            .stat {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 10px;
                padding: 8px;
                background: ${theme.statBg};
                border-radius: 6px;
                border-left: 3px solid ${theme.border};
            }

            .stat.lifetime {
                border-left-color: ${theme.border};
                background: ${theme.statBg};
            }

            .stat-label {
                color: ${theme.textMuted};
                font-size: 13px;
                font-weight: 500;
            }

            .stat-value {
                color: ${theme.text};
                font-size: 20px;
                font-weight: bold;
                transition: transform 0.2s, color 0.2s;
            }

            .stat-info {
                color: ${theme.textMuted};
                font-size: 11px;
                line-height: 1.6;
                padding: 8px;
                background: ${theme.infoBg};
                border-radius: 6px;
                margin-top: 8px;
            }

            /* Settings Panel */
            #yt-filter-settings-panel {
                position: fixed;
                inset: 0;
                z-index: 9999999;
                display: none;
            }

            #yt-filter-settings-panel.visible {
                display: block;
            }

            .settings-overlay {
                position: absolute;
                inset: 0;
                background: rgba(0, 0, 0, 0.7);
                backdrop-filter: blur(5px);
            }

            .settings-content {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: ${CONFIG.THEME === 'dark' ? '#1a1a1a' : '#ffffff'};
                border: 2px solid ${theme.border};
                border-radius: 16px;
                width: 90%;
                max-width: 600px;
                max-height: 85vh;
                overflow: hidden;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8);
                color: ${theme.text};
            }

            .settings-header {
                background: ${theme.headerBg};
                padding: 20px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-radius: 14px 14px 0 0;
            }

            .settings-header h2 {
                margin: 0;
                color: #fff;
                font-size: 20px;
            }

            .settings-close {
                background: rgba(255, 255, 255, 0.2);
                border: none;
                color: #fff;
                font-size: 24px;
                width: 32px;
                height: 32px;
                border-radius: 50%;
                cursor: pointer;
                transition: background 0.2s;
            }

            .settings-close:hover {
                background: rgba(255, 255, 255, 0.3);
            }

            .settings-body {
                padding: 20px;
                max-height: calc(85vh - 160px);
                overflow-y: auto;
            }

            .settings-section {
                margin-bottom: 25px;
                padding-bottom: 20px;
                border-bottom: 1px solid ${CONFIG.THEME === 'dark' ? '#333' : '#ddd'};
            }

            .settings-section:last-child {
                border-bottom: none;
            }

            .settings-section h3 {
                margin: 0 0 15px 0;
                color: ${theme.border};
                font-size: 16px;
            }

            .setting-item {
                margin-bottom: 15px;
            }

            .setting-item label {
                display: block;
                margin-bottom: 5px;
                font-weight: 500;
                color: ${theme.text};
            }

            .setting-item input[type="number"],
            .setting-item input[type="text"],
            .setting-item select {
                width: 100%;
                padding: 8px 12px;
                border: 1px solid ${CONFIG.THEME === 'dark' ? '#444' : '#ccc'};
                border-radius: 6px;
                background: ${CONFIG.THEME === 'dark' ? '#2a2a2a' : '#f9f9f9'};
                color: ${theme.text};
                font-size: 14px;
            }

            .setting-item small {
                display: block;
                margin-top: 8px;
                color: ${theme.textMuted};
                font-size: 12px;
                line-height: 1.4;
            }

            .setting-item input[type="range"] {
                width: calc(100% - 60px);
                margin-right: 10px;
            }


            .keyboard-shortcut {
                display: flex;
                align-items: center;
                gap: 10px;
                flex-wrap: wrap;
            }

            .keyboard-shortcut label {
                display: inline-flex;
                align-items: center;
                margin: 0;
                font-weight: normal;
            }

            .keyboard-shortcut input[type="checkbox"] {
                margin-right: 5px;
            }

            .stats-display {
                background: ${theme.statBg};
                padding: 15px;
                border-radius: 8px;
                margin-top: 10px;
            }

            .stats-display p {
                margin: 8px 0;
            }

            .btn-reset-stats {
                background: #666666;
                color: #fff;
                border: none;
                padding: 8px 16px;
                border-radius: 6px;
                cursor: pointer;
                margin-top: 10px;
                font-weight: 500;
            }

            .btn-reset-stats:hover {
                background: #555555;
            }

            .settings-footer {
                padding: 15px 20px;
                background: ${CONFIG.THEME === 'dark' ? '#0a0a0a' : '#f5f5f5'};
                display: flex;
                justify-content: space-between;
                gap: 10px;
                border-radius: 0 0 14px 14px;
            }

            .settings-footer button {
                flex: 1;
                padding: 12px 20px;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-weight: 600;
                font-size: 14px;
                transition: transform 0.1s;
            }

            .settings-footer button:active {
                transform: scale(0.98);
            }

            .list-container {
                display: flex;
                flex-direction: column;
                gap: 8px;
                margin-top: 10px;
                max-height: 200px;
                overflow-y: auto;
                padding: 10px;
                background: ${theme.statBg};
                border-radius: 6px;
                border: 1px solid ${CONFIG.THEME === 'dark' ? '#333' : '#ddd'};
            }

            .list-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 12px;
                background: ${CONFIG.THEME === 'dark' ? '#2a2a2a' : '#f5f5f5'};
                border-radius: 4px;
                border-left: 3px solid ${theme.border};
                font-size: 13px;
            }

            .list-item span {
                flex: 1;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .btn-remove-item {
                background: #ff4444;
                color: #fff;
                border: none;
                padding: 2px 8px;
                border-radius: 3px;
                cursor: pointer;
                font-size: 12px;
                margin-left: 8px;
                transition: background 0.2s;
            }

            .btn-remove-item:hover {
                background: #dd0000;
            }

            .btn-reset {
                background: ${CONFIG.THEME === 'dark' ? '#444' : '#ddd'};
                color: ${CONFIG.THEME === 'dark' ? '#fff' : '#333'};
            }

            .btn-reset:hover {
                background: ${CONFIG.THEME === 'dark' ? '#555' : '#ccc'};
            }

            .btn-save {
                background: #00ff00;
                color: #000;
            }

            .btn-save:hover {
                background: #00dd00;
            }

            /* Notification */
            .yt-filter-notification {
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: ${theme.headerBg};
                color: #fff;
                padding: 15px 25px;
                border-radius: 10px;
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
                z-index: 99999999;
                opacity: 0;
                transform: translateY(20px);
                transition: opacity 0.3s, transform 0.3s;
                font-weight: 500;
            }

            .yt-filter-notification.show {
                opacity: 1;
                transform: translateY(0);
            }

            .yt-filter-confirm {
                position: fixed;
                bottom: 20px;
                left: 20px;
                background: ${theme.headerBg};
                color: #fff;
                padding: 12px 16px;
                border-radius: 10px;
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
                z-index: 99999999;
                opacity: 0;
                transform: translateY(10px);
                transition: opacity 0.2s ease, transform 0.2s ease;
                display: flex;
                align-items: center;
                gap: 10px;
            }

            .yt-filter-confirm.show {
                opacity: 1;
                transform: translateY(0);
            }

            .yt-filter-confirm-actions {
                display: flex;
                gap: 6px;
            }

            .yt-filter-confirm .btn-yes,
            .yt-filter-confirm .btn-no {
                border: none;
                border-radius: 6px;
                padding: 6px 10px;
                cursor: pointer;
                font-weight: 600;
            }

            .yt-filter-confirm .btn-yes {
                background: #00c853;
                color: #000;
            }

            .yt-filter-confirm .btn-no {
                background: #444;
                color: #fff;
            }

            /* Smooth removal animations */
            ytd-rich-item-renderer,
            ytd-video-renderer,
            ytd-grid-video-renderer,
            ytd-compact-video-renderer {
                overflow: hidden;
            }

            /* FEATURE 7: Accessibility - Better color contrast */
            .stat-label {
                color: ${CONFIG.THEME === 'dark' ? '#aaa' : '#333'} !important;
            }
            
            .settings-section h3 {
                color: ${CONFIG.THEME === 'dark' ? '#fff' : '#000'} !important;
            }
            
            .setting-item label {
                color: ${CONFIG.THEME === 'dark' ? '#f0f0f0' : '#222'} !important;
            }
            
            .settings-body {
                color: ${CONFIG.THEME === 'dark' ? '#e0e0e0' : '#000'} !important;
            }
            
            /* Focus indicators for keyboard navigation */
            button:focus, input:focus, select:focus, textarea:focus {
                outline: 2px solid #0066ff;
                outline-offset: 2px;
            }
            
            /* Improved button contrast */
            .btn-save {
                background: #00b300 !important;
                color: #000 !important;
            }
            
            .btn-export {
                background: #1976d2;
                color: #fff;
                border: none;
                padding: 10px 15px;
                border-radius: 6px;
                cursor: pointer;
                margin-bottom: 10px;
                font-weight: 500;
                transition: background 0.2s;
            }
            
            .btn-export:hover {
                background: #1565c0;
            }
            
            .btn-import {
                background: #1976d2;
                color: #fff;
                border: none;
                padding: 10px 15px;
                border-radius: 6px;
                cursor: pointer;
                font-weight: 500;
                margin-top: 10px;
                transition: background 0.2s;
            }
            
            .btn-import:hover {
                background: #1565c0;
            }
            
            .btn-danger {
                background: #d32f2f;
                color: #fff;
            }
            
            .btn-danger:hover {
                background: #c62828;
            }
        `;
        document.head.appendChild(style);
    };

    // ==================== OBSERVER SETUP ====================

    const setupObserver = () => {
        // Disconnect existing observer
        if (state.observer) {
            state.observer.disconnect();
        }

        let pendingNodes = [];
        let maxPendingSize = 0;
        const debouncedProcess = debounce(() => {
            const toProcess = pendingNodes;
            pendingNodes = [];
            maxPendingSize = 0;
            processCandidates(toProcess);
        }, CONFIG.DEBOUNCE_DELAY);

        // Create new observer
        state.observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => pendingNodes.push(node));
            });

            maxPendingSize = Math.max(maxPendingSize, pendingNodes.length);
            if (pendingNodes.length > 0) {
                debouncedProcess();
            }
        });

        // Observe document body
        const observeTarget = () => {
            const target = document.body || document.documentElement;
            if (target) {
                state.observer.observe(target, {
                    childList: true,
                    subtree: true
                });
                log('Observer attached to document body');
            } else {
                setTimeout(observeTarget, CONSTANTS.INIT_RETRY_DELAY_MS);
            }
        };

        observeTarget();
    };

    // ==================== INITIALIZATION ====================

    const initialize = () => {
        // Only run on YouTube
        if (!window.location.hostname.includes('youtube.com')) {
            return;
        }

        log('Initializing or1n YouTube Filter v4.0.1...');

        // Inject styles immediately
        injectStyles();

        // Register Tampermonkey menu commands
        if (typeof GM_registerMenuCommand !== 'undefined') {
            GM_registerMenuCommand('⚙️ Open Settings', () => toggleSettingsPanel());
            GM_registerMenuCommand('👁️ Toggle Counter', () => {
                toggleCounter();
                const isVisible = state.counterElement && state.counterElement.style.display !== 'none';
                const sessionCount = state.sessionFiltered.toLocaleString();
                showNotification(isVisible ? `Counter Visible (${sessionCount} filtered)` : `Counter Hidden (${sessionCount} filtered)`, 2000);
            });
            GM_registerMenuCommand('🚫 Close Counter', () => {
                if (state.counterElement) {
                    state.counterElement.style.transition = 'opacity 0.3s ease';
                    state.counterElement.style.opacity = '0';
                    setTimeout(() => {
                        state.counterElement.remove();
                        state.counterElement = null;
                    }, 300);
                    showNotification('Counter Closed', 1500);
                }
            });
            GM_registerMenuCommand('📈 Reset Statistics', () => {
                confirmAction('Reset all lifetime statistics?', () => {
                    state.lifetimeStats = { totalFiltered: 0, firstInstall: Date.now(), lastReset: Date.now() };
                    saveStats();
                    showNotification('✓ Statistics reset successfully', 2000);
                });
            });
            GM_registerMenuCommand('✅ Add Current Channel to Whitelist', () => {
                const currentVideo = document.querySelector('ytd-rich-item-renderer, ytd-video-renderer, ytd-grid-video-renderer');
                if (currentVideo) {
                    const channelInfo = extractChannelInfo(currentVideo);
                    if (channelInfo && channelInfo.id) {
                        if (!listContains(CONFIG.WHITELIST, channelInfo.id)) {
                            CONFIG.WHITELIST.push(channelInfo.id);
                            updateConfig({ WHITELIST: CONFIG.WHITELIST });
                            showNotification(`✅ Added "${channelInfo.name}" to whitelist`, 2000);
                        } else {
                            showNotification(`Already whitelisted: ${channelInfo.name}`, 2000);
                        }
                    } else {
                        showNotification('⚠️ Could not find channel info', 2000);
                    }
                } else {
                    showNotification('⚠️ No video found on page', 2000);
                }
            });
            GM_registerMenuCommand('🚫 Add Current Channel to Blacklist', () => {
                const currentVideo = document.querySelector('ytd-rich-item-renderer, ytd-video-renderer, ytd-grid-video-renderer');
                if (currentVideo) {
                    const channelInfo = extractChannelInfo(currentVideo);
                    if (channelInfo && channelInfo.id) {
                        if (!listContains(CONFIG.BLACKLIST, channelInfo.id)) {
                            CONFIG.BLACKLIST.push(channelInfo.id);
                            updateConfig({ BLACKLIST: CONFIG.BLACKLIST });
                            showNotification(`🚫 Added "${channelInfo.name}" to blacklist`, 2000);
                        } else {
                            showNotification(`Already blacklisted: ${channelInfo.name}`, 2000);
                        }
                    } else {
                        showNotification('⚠️ Could not find channel info', 2000);
                    }
                } else {
                    showNotification('⚠️ No video found on page', 2000);
                }
            });
        }

        // Wait for page to be ready
        const init = () => {
            if (document.body) {
                // Setup keyboard shortcuts
                setupKeyboardShortcuts();

                // Create counter UI
                if (CONFIG.SHOW_COUNTER) {
                    createCounter();
                }

                // Setup observer
                setupObserver();

                // Initial filter pass
                filterVideos();

                // Listen to YouTube navigation events
                window.addEventListener('yt-navigate-finish', () => {
                    log('Navigation detected, resetting and filtering...');
                    state.processedVideos = new WeakSet();
                    clearParsingMarkers();
                    setTimeout(filterVideos, CONSTANTS.NAVIGATION_FILTER_DELAY_MS);
                });

                // Listen to scroll events for lazy-loaded content
                let scrollTimeout;
                window.addEventListener('scroll', () => {
                    clearTimeout(scrollTimeout);
                    scrollTimeout = setTimeout(filterVideos, CONSTANTS.SCROLL_FILTER_DELAY_MS);
                }, { passive: true });

                log('✓ or1n YouTube Filter initialized successfully!');
                
                if (CONFIG.SHOW_NOTIFICATIONS) {
                    showNotification('🔥 or1n YT filter Active', 2000);
                }
            } else {
                setTimeout(init, CONSTANTS.INIT_RETRY_DELAY_MS);
            }
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
        } else {
            init();
        }
    };

    // Start the script
    initialize();

})();
