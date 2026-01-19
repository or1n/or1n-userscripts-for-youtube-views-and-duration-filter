// ==UserScript==
// @name         or1n-userscripts-for-youtube-views-and-duration-filter
// @namespace    https://github.com/or1n/or1n-userscripts-for-youtube-views-and-duration-filter
// @version      3.3.1
// @description  Advanced YouTube video filter with customizable settings, themes, and live statistics
// @author       or1n
// @license      MIT
// @homepage     https://github.com/or1n/or1n-userscripts-for-youtube-views-and-duration-filter
// @supportURL   https://github.com/or1n/or1n-userscripts-for-youtube-views-and-duration-filter/issues
// @updateURL    https://raw.githubusercontent.com/or1n/or1n-userscripts-for-youtube-views-and-duration-filter/refs/heads/main/or1n-userscripts-for-youtube-views-and-duration-filter.js
// @downloadURL  https://raw.githubusercontent.com/or1n/or1n-userscripts-for-youtube-views-and-duration-filter/refs/heads/main/or1n-userscripts-for-youtube-views-and-duration-filter.js
// @match        *://*.youtube.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=youtube.com
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @run-at       document-start
// ==/UserScript==

(() => {
    'use strict';

    // ==================== DEFAULT CONFIGURATION ====================
    const DEFAULT_CONFIG = {
        MIN_VIEWS: 99999,
        MIN_DURATION_SECONDS: 240,
        DEBOUNCE_DELAY: 100,
        DEBUG: true,  // ENABLED FOR TESTING - shows console logs
        SMOOTH_REMOVAL: true,
        SHOW_COUNTER: true,
        COUNTER_DRAGGABLE: true,
        THEME: 'dark',
        KEYBOARD_SHORTCUT: 'KeyF',
        USE_CTRL: true,
        USE_ALT: false,
        USE_SHIFT: false,
        FONT_FAMILY: 'Segoe UI',
        FONT_SIZE: 14,
        FONT_WEIGHT: 'normal',
        COUNTER_OPACITY: 95,
        ENABLE_STATISTICS: true,
        SHOW_NOTIFICATIONS: true,
        WHITELIST: [],
        BLACKLIST: [],
        FILTER_MODE: 'AND',  // 'AND' or 'OR' - how to combine view and duration filters
        ENABLE_WHITELIST: true,
        ENABLE_BLACKLIST: true
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
        lifetimeStats: GM_getValue('lifetimeStats', {
            totalFiltered: 0,
            firstInstall: Date.now(),
            lastReset: Date.now()
        })
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
        if (!text) return 0;
        
        // Extract number and multiplier from text like "13m views", "1.2K views", etc
        // This regex is more lenient since we now pass clean view text
        const viewMatch = text.match(/(\d+(?:[.,]\d+)*)\s*([KkMmBbТтЛл])?/);
        if (!viewMatch) {
            log('⚠️ parseViewCount: Could not extract number from:', text);
            return 0;
        }

        let [, count, multiplier] = viewMatch;
        count = parseFloat(count.replace(/,/g, ''));

        const multipliers = {
            'K': 1e3, 'k': 1e3, 'T': 1e3, 'т': 1e3,
            'M': 1e6, 'm': 1e6, 'Л': 1e6, 'л': 1e6,
            'B': 1e9, 'b': 1e9
        };

        const result = Math.floor(count * (multipliers[multiplier] || 1));
        log('📊 parseViewCount:', text, '-> extracted:', count, 'multiplier:', multiplier, '-> result:', result);
        return result;
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
            state.debounceTimer = setTimeout(() => func(...args), delay);
        };
    };

    /**
     * Log debug messages when enabled
     */
    const log = (...args) => {
        if (CONFIG.DEBUG) {
            console.log('[YT Filter Pro]', ...args);
        }
    };

    /**
     * Extract channel name/URL from video element
     */
    const extractChannelInfo = (element) => {
        try {
            const channelLink = element.querySelector('a[href*="/channel/"], a[href*="/@"]');
            if (!channelLink) return null;
            
            const href = channelLink.href || '';
            const channelMatch = href.match(/\/(channel\/[^/?]+|@[^/?]+)/);
            if (channelMatch) {
                const channelId = channelMatch[1];
                const channelText = channelLink.textContent.trim();
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

            log('🎬 === EXTRACTING VIDEO DATA ===');
            log('Element tag:', element.tagName);
            
            // Strategy 1: Try to find spans with view counts (most reliable)
            const metadataSpans = element.querySelectorAll('[role="text"], .metadata-row span, ytd-formatted-string');
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
            if (watchingMatch && !viewsText) {
                log(`ℹ️ LIVE STREAM DETECTED - skipping`);
            }

            log('📌 Final: Views:', viewsText, '| Duration:', durationText);
            return { viewsText, durationText };
        } catch (e) {
            log('❌ ERROR in extractVideoData:', e.message);
            return { viewsText: null, durationText: null };
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
            const isWhitelisted = CONFIG.WHITELIST.some(ch => 
                ch === channelInfo.id || ch === channelInfo.name || ch === channelInfo.href
            );
            if (isWhitelisted) {
                log(`✅ WHITELISTED: ${channelInfo.name} - skipping filter`);
                return false;
            }
        }
        
        // Check blacklist
        if (CONFIG.ENABLE_BLACKLIST && channelInfo) {
            const isBlacklisted = CONFIG.BLACKLIST.some(ch => 
                ch === channelInfo.id || ch === channelInfo.name || ch === channelInfo.href
            );
            if (isBlacklisted) {
                log(`🚫 BLACKLISTED: ${channelInfo.name} - filtering`);
                return true;
            }
        }
        
        const { viewsText, durationText } = extractVideoData(element);
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
            // OR mode: filter if EITHER condition is true
            shouldFilter = viewsLow || durationShort;
            if (shouldFilter) {
                const reason = [];
                if (viewsLow) reason.push(`${viewCount} views < ${CONFIG.MIN_VIEWS}`);
                if (durationShort) reason.push(`${durationSeconds}s < ${CONFIG.MIN_DURATION_SECONDS}s`);
                log(`🚫 FILTERING (OR mode): ${reason.join(' OR ')}`);
            }
        } else {
            // AND mode: filter if BOTH conditions are true (or only one is applicable)
            if (viewsText && durationText) {
                // Both metrics present: require both to be low
                shouldFilter = viewsLow && durationShort;
                if (shouldFilter) {
                    log(`🚫 FILTERING (AND mode): ${viewCount} views < ${CONFIG.MIN_VIEWS} AND ${durationSeconds}s < ${CONFIG.MIN_DURATION_SECONDS}s`);
                }
            } else if (viewsText) {
                // Only views: check views
                shouldFilter = viewsLow;
                if (shouldFilter) log(`🚫 FILTERING (AND mode - views only): ${viewCount} views < ${CONFIG.MIN_VIEWS}`);
            } else if (durationText) {
                // Only duration: check duration
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
            'ytd-reel-item-renderer',  // YouTube Shorts
            'ytd-rich-grid-media',     // Grid layout
            'ytd-rich-shelf-renderer'  // Shelf items
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
        while (parent && depth < 10) {
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
        
        if (CONFIG.SMOOTH_REMOVAL) {
            container.style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out, max-height 0.3s ease-out';
            container.style.opacity = '0';
            container.style.transform = 'scale(0.95)';
            container.style.maxHeight = container.offsetHeight + 'px';
            
            setTimeout(() => {
                container.style.maxHeight = '0';
                container.style.margin = '0';
                container.style.padding = '0';
                
                setTimeout(() => {
                    log('✅ Container removed from DOM');
                    container.remove();
                }, 300);
            }, 300);
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

    /**
     * Process video elements on the page
     */
    const filterVideos = () => {
        // Universal selectors for all YouTube video types
        const videoSelectors = [
            'ytd-rich-item-renderer',
            'ytd-video-renderer',
            'ytd-grid-video-renderer',
            'ytd-compact-video-renderer',
            'ytd-playlist-video-renderer'
        ];

        let processed = 0;
        
        videoSelectors.forEach(selector => {
            const videos = document.querySelectorAll(selector);
            
            videos.forEach(video => {
                if (state.processedVideos.has(video)) return;
                
                state.processedVideos.add(video);
                processed++;
                
                log('Processing video element:', video.tagName);
                if (shouldFilterVideo(video)) {
                    removeVideoElement(video);
                }
            });
        });

        state.totalProcessed += processed;
        log(`Processed ${processed} videos, Total: ${state.totalProcessed}`);
    };

    // ==================== UI COUNTER ====================

    /**
     * Create counter display element
     */
    const createCounter = () => {
        if (state.counterElement) {
            return state.counterElement;
        }

        const counter = document.createElement('div');
        counter.id = 'yt-filter-counter';
        
        const daysSinceInstall = Math.floor((Date.now() - state.lifetimeStats.firstInstall) / (1000 * 60 * 60 * 24));
        
        // Build counter DOM manually (Trusted Types compatible)
        const header = document.createElement('div');
        header.className = 'yt-filter-header';
        
        const title = document.createElement('span');
        title.className = 'yt-filter-title';
        title.textContent = '🔥 YT Filter Pro';
        
        const buttons = document.createElement('div');
        buttons.className = 'yt-filter-buttons';
        
        const settingsBtn = document.createElement('button');
        settingsBtn.className = 'yt-filter-settings';
        settingsBtn.title = 'Settings';
        settingsBtn.textContent = '⚙️';
        
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'yt-filter-toggle';
        toggleBtn.title = 'Hide Counter';
        toggleBtn.textContent = '−';
        
        const menuBtn = document.createElement('button');
        menuBtn.className = 'yt-filter-menu';
        menuBtn.title = 'Quick Menu';
        menuBtn.textContent = '⋮';
        
        const closeBtn = document.createElement('button');
        closeBtn.className = 'yt-filter-close';
        closeBtn.title = 'Close Counter';
        closeBtn.textContent = '✕';
        
        buttons.appendChild(settingsBtn);
        buttons.appendChild(toggleBtn);
        buttons.appendChild(menuBtn);
        buttons.appendChild(closeBtn);
        header.appendChild(title);
        header.appendChild(buttons);
        
        const stats = document.createElement('div');
        stats.className = 'yt-filter-stats';
        
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
        
        counter.appendChild(header);
        counter.appendChild(stats);

        // Apply theme and font settings
        applyCounterStyle(counter);

        // Quick menu (hidden by default)
        const quickMenu = document.createElement('div');
        quickMenu.className = 'yt-filter-quick-menu';
        quickMenu.style.display = 'none';
        
        const menuItems = [
            { text: '👁️ Toggle Counter', action: () => {
                const isHidden = stats.style.display === 'none';
                stats.style.display = isHidden ? 'block' : 'none';
                toggleBtn.textContent = isHidden ? '−' : '+';
            }},
            { text: '🚫 Close Counter', action: () => {
                counter.style.transition = 'opacity 0.3s ease';
                counter.style.opacity = '0';
                setTimeout(() => {
                    counter.remove();
                    state.counterElement = null;
                }, 300);
            }},
            { text: '📈 Reset Stats', action: () => {
                if (confirm('Reset all statistics? Cannot be undone.')) {
                    state.lifetimeStats = { totalFiltered: 0, firstInstall: Date.now(), lastReset: Date.now() };
                    saveStats();
                    showNotification('✓ Statistics reset', 1500);
                }
            }},
            { text: '🔄 Force Filter', action: () => {
                state.processedVideos = new WeakSet();
                filterVideos();
                showNotification('✓ Filtering complete', 1500);
            }}
        ];
        
        // Get current channel for whitelist/blacklist options
        const currentVideo = counter.closest('body').querySelector('ytd-rich-item-renderer, ytd-video-renderer, ytd-grid-video-renderer');
        if (currentVideo) {
            const channelInfo = extractChannelInfo(currentVideo);
            if (channelInfo) {
                menuItems.push(
                    { text: `✅ Whitelist "${channelInfo.name.substring(0, 20)}"`, action: () => {
                        if (!CONFIG.WHITELIST.includes(channelInfo.id)) {
                            CONFIG.WHITELIST.push(channelInfo.id);
                            saveConfig(CONFIG);
                            showNotification(`✅ Whitelisted: ${channelInfo.name}`, 2000);
                        } else {
                            showNotification(`Already whitelisted`, 1500);
                        }
                    }},
                    { text: `🚫 Blacklist "${channelInfo.name.substring(0, 20)}"`, action: () => {
                        if (!CONFIG.BLACKLIST.includes(channelInfo.id)) {
                            CONFIG.BLACKLIST.push(channelInfo.id);
                            saveConfig(CONFIG);
                            showNotification(`🚫 Blacklisted: ${channelInfo.name}`, 2000);
                        } else {
                            showNotification(`Already blacklisted`, 1500);
                        }
                    }}
                );
            }
        }
        menuItems.forEach(item => {
            const menuItem = document.createElement('button');
            menuItem.className = 'yt-filter-menu-item';
            menuItem.textContent = item.text;
            menuItem.addEventListener('click', (e) => {
                e.stopPropagation();
                item.action();
                quickMenu.style.display = 'none';
            });
            quickMenu.appendChild(menuItem);
        });
        
        counter.appendChild(quickMenu);

        // Settings button
        settingsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            quickMenu.style.display = 'none';
            toggleSettingsPanel();
        });

        // Toggle visibility
        const statsDiv = stats;
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isHidden = statsDiv.style.display === 'none';
            statsDiv.style.display = isHidden ? 'block' : 'none';
            toggleBtn.textContent = isHidden ? '−' : '+';
            toggleBtn.title = isHidden ? 'Hide Counter' : 'Show Counter';
            quickMenu.style.display = 'none';
        });

        // Menu button
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            quickMenu.style.display = quickMenu.style.display === 'none' ? 'flex' : 'none';
        });

        // Close button - completely hides and closes the counter
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (counter) {
                counter.style.transition = 'opacity 0.3s ease';
                counter.style.opacity = '0';
                setTimeout(() => {
                    counter.remove();
                    state.counterElement = null;
                }, 300);
            }
        });

        // Make draggable
        if (CONFIG.COUNTER_DRAGGABLE) {
            makeDraggable(counter);
        }

        document.body.appendChild(counter);
        state.counterElement = counter;

        return counter;
    };

    /**
     * Update counter display
     */
    const updateCounter = () => {
        if (!state.counterElement) return;

        const sessionElement = state.counterElement.querySelector('#yt-session-count');
        if (sessionElement) {
            sessionElement.textContent = state.sessionFiltered.toLocaleString();
            
            // Pulse animation on update
            sessionElement.style.transform = 'scale(1.3)';
            const accentColor = CONFIG.THEME === 'dark' ? '#ff0000' : '#cc0000';
            sessionElement.style.color = accentColor;
            setTimeout(() => {
                sessionElement.style.transform = 'scale(1)';
                sessionElement.style.color = '';
            }, 200);
        }

        const lifetimeElement = state.counterElement.querySelector('#yt-lifetime-count');
        if (lifetimeElement) {
            lifetimeElement.textContent = state.lifetimeStats.totalFiltered.toLocaleString();
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
     * Make element draggable
     */
    const makeDraggable = (element) => {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        const header = element.querySelector('.yt-filter-header');
        
        if (header) {
            header.style.cursor = 'move';
            header.onmousedown = dragMouseDown;
        }

        function dragMouseDown(e) {
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        }

        function elementDrag(e) {
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            element.style.top = (element.offsetTop - pos2) + 'px';
            element.style.left = (element.offsetLeft - pos1) + 'px';
        }

        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;
        }
    };

    /**
     * Show notification
     */
    const showNotification = (message, duration = 3000) => {
        const notification = document.createElement('div');
        notification.className = 'yt-filter-notification';
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.classList.add('show');
        }, 10);

        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, duration);
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
        title.textContent = '⚙️ YouTube Filter Pro Settings';
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
            if (min) input.min = min;
            if (max) input.max = max;
            if (step) input.step = step;
            item.appendChild(input);
            return item;
        };

        // === FILTER SETTINGS ===
        const filterSection = createSection('🎯 Filter Settings');
        filterSection.appendChild(createInputRow('Minimum Views', 'number', 'setting-min-views', CONFIG.MIN_VIEWS, 0, null, 1000));
        filterSection.appendChild(createInputRow('Minimum Duration (seconds)', 'number', 'setting-min-duration', CONFIG.MIN_DURATION_SECONDS, 0, null, 30));
        body.appendChild(filterSection);

        // === FILTER MODE ===
        const modeSection = createSection('⚡ Filter Logic');
        const modeItem = document.createElement('div');
        modeItem.className = 'setting-item';
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
        modeInfo.textContent = 'AND: filters only if BOTH view count AND duration are below thresholds. OR: filters if EITHER is below threshold.';
        modeItem.appendChild(modeInfo);
        modeSection.appendChild(modeItem);
        body.appendChild(modeSection);

        // === WHITELIST ===
        const whitelistSection = createSection('✅ Whitelist (Never Filter)');
        const whitelistToggle = document.createElement('div');
        whitelistToggle.className = 'setting-item';
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
            item.innerHTML = `<span>${channel.replace(/^channel\/|^@/, '')}</span>`;
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
            item.innerHTML = `<span>${channel.replace(/^channel\/|^@/, '')}</span>`;
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

        body.appendChild(appearanceSection);

        // === KEYBOARD SHORTCUT ===
        const shortcutSection = createSection('⌨️ Keyboard Shortcut');
        const shortcutItem = document.createElement('div');
        shortcutItem.className = 'setting-item';
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
        shortcutSection.appendChild(shortcutItem);
        body.appendChild(shortcutSection);

        // === STATISTICS ===
        const statsSection = createSection('📊 Statistics');
        const enableStatsItem = document.createElement('div');
        enableStatsItem.className = 'setting-item';
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
            if (confirm('Are you sure you want to reset all statistics? This cannot be undone.')) {
                state.lifetimeStats = { totalFiltered: 0, firstInstall: Date.now(), lastReset: Date.now() };
                saveStats();
                showNotification('✓ Statistics reset successfully');
                setTimeout(() => toggleSettingsPanel(), 500);
            }
        });
        statsDisplay.appendChild(resetStatsBtn);
        statsSection.appendChild(statsDisplay);
        body.appendChild(statsSection);

        // === ADVANCED ===
        const advSection = createSection('🔧 Advanced');
        const smoothItem = document.createElement('div');
        smoothItem.className = 'setting-item';
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
        const dragCb = document.createElement('input');
        dragCb.type = 'checkbox';
        dragCb.id = 'setting-draggable';
        dragCb.checked = CONFIG.COUNTER_DRAGGABLE;
        const dragLbl = document.createElement('label');
        dragLbl.appendChild(dragCb);
        dragLbl.appendChild(document.createTextNode(' Draggable Counter'));
        dragItem.appendChild(dragLbl);
        advSection.appendChild(dragItem);

        const debugItem = document.createElement('div');
        debugItem.className = 'setting-item';
        const debugCb = document.createElement('input');
        debugCb.type = 'checkbox';
        debugCb.id = 'setting-debug';
        debugCb.checked = CONFIG.DEBUG;
        const debugLbl = document.createElement('label');
        debugLbl.appendChild(debugCb);
        debugLbl.appendChild(document.createTextNode(' Enable Debug Logging'));
        debugItem.appendChild(debugLbl);
        advSection.appendChild(debugItem);

        body.appendChild(advSection);

        // Footer
        const footer = document.createElement('div');
        footer.className = 'settings-footer';
        const resetBtn = document.createElement('button');
        resetBtn.className = 'btn-reset';
        resetBtn.textContent = 'Reset to Defaults';
        resetBtn.addEventListener('click', () => {
            if (confirm('Reset all settings to defaults?')) {
                CONFIG = { ...DEFAULT_CONFIG };
                saveConfig(CONFIG);
                showNotification('✓ Settings reset to defaults');
                setTimeout(() => location.reload(), 500);
            }
        });
        const saveBtn = document.createElement('button');
        saveBtn.className = 'btn-save';
        saveBtn.textContent = 'Save Settings';
        saveBtn.addEventListener('click', () => {
            CONFIG.MIN_VIEWS = parseInt(document.querySelector('#setting-min-views').value) || 0;
            CONFIG.MIN_DURATION_SECONDS = parseInt(document.querySelector('#setting-min-duration').value) || 0;
            CONFIG.FILTER_MODE = document.querySelector('#setting-filter-mode').value;
            CONFIG.ENABLE_WHITELIST = document.querySelector('#setting-enable-whitelist').checked;
            CONFIG.ENABLE_BLACKLIST = document.querySelector('#setting-enable-blacklist').checked;
            CONFIG.THEME = document.querySelector('#setting-theme').value;
            CONFIG.FONT_FAMILY = document.querySelector('#setting-font-family').value;
            CONFIG.FONT_SIZE = parseInt(document.querySelector('#setting-font-size').value) || 14;
            CONFIG.FONT_WEIGHT = document.querySelector('#setting-font-weight').value;
            CONFIG.COUNTER_OPACITY = parseInt(document.querySelector('#setting-opacity').value) || 95;
            CONFIG.USE_CTRL = document.querySelector('#shortcut-ctrl').checked;
            CONFIG.USE_ALT = document.querySelector('#shortcut-alt').checked;
            CONFIG.USE_SHIFT = document.querySelector('#shortcut-shift').checked;
            CONFIG.KEYBOARD_SHORTCUT = document.querySelector('#shortcut-key').value;
            CONFIG.ENABLE_STATISTICS = document.querySelector('#setting-enable-stats').checked;
            CONFIG.SHOW_NOTIFICATIONS = document.querySelector('#setting-show-notifications').checked;
            CONFIG.SMOOTH_REMOVAL = document.querySelector('#setting-smooth-removal').checked;
            CONFIG.COUNTER_DRAGGABLE = document.querySelector('#setting-draggable').checked;
            CONFIG.DEBUG = document.querySelector('#setting-debug').checked;

            saveConfig(CONFIG);
            showNotification('✓ Settings saved');
            
            if (state.counterElement) {
                state.counterElement.remove();
                state.counterElement = null;
            }
            injectStyles();
            createCounter();
            toggleSettingsPanel();
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
        if (!state.settingsPanel) {
            createSettingsPanel();
        }
        
        const isVisible = state.settingsPanel.classList.contains('visible');
        if (isVisible) {
            state.settingsPanel.classList.remove('visible');
        } else {
            state.settingsPanel.classList.add('visible');
        }
    };

    // ==================== KEYBOARD SHORTCUTS ====================

    const setupKeyboardShortcuts = () => {
        document.addEventListener('keydown', (e) => {
            // Check if key matches configured shortcut
            const keyMatch = e.code === CONFIG.KEYBOARD_SHORTCUT;
            const ctrlMatch = CONFIG.USE_CTRL ? e.ctrlKey : !e.ctrlKey;
            const altMatch = CONFIG.USE_ALT ? e.altKey : !e.altKey;
            const shiftMatch = CONFIG.USE_SHIFT ? e.shiftKey : !e.shiftKey;

            if (keyMatch && ctrlMatch && altMatch && shiftMatch) {
                e.preventDefault();
                if (state.counterElement) {
                    const isVisible = state.counterElement.style.display !== 'none';
                    state.counterElement.style.display = isVisible ? 'none' : 'block';
                    if (CONFIG.SHOW_NOTIFICATIONS) {
                        const sessionCount = state.sessionFiltered.toLocaleString();
                        showNotification(isVisible ? `👁️ Counter Hidden (${sessionCount} filtered)` : `👁️ Counter Visible (${sessionCount} filtered)`, 2000);
                    }
                }
            }
        });
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

            /* Smooth removal animations */
            ytd-rich-item-renderer,
            ytd-video-renderer,
            ytd-grid-video-renderer,
            ytd-compact-video-renderer {
                overflow: hidden;
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

        // Debounced filter function
        const debouncedFilter = debounce(filterVideos, CONFIG.DEBOUNCE_DELAY);

        // Create new observer
        state.observer = new MutationObserver((mutations) => {
            let shouldFilter = false;

            for (const mutation of mutations) {
                if (mutation.addedNodes.length > 0) {
                    shouldFilter = true;
                    break;
                }
            }

            if (shouldFilter) {
                debouncedFilter();
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
                setTimeout(observeTarget, 100);
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

        log('Initializing YouTube Filter Pro 3.3.1...');

        // Inject styles immediately
        injectStyles();

        // Register Tampermonkey menu commands
        if (typeof GM_registerMenuCommand !== 'undefined') {
            GM_registerMenuCommand('⚙️ Open Settings', () => toggleSettingsPanel());
            GM_registerMenuCommand('👁️ Toggle Counter', () => {
                if (state.counterElement) {
                    const isVisible = state.counterElement.style.display !== 'none';
                    state.counterElement.style.display = isVisible ? 'none' : 'block';
                    const sessionCount = state.sessionFiltered.toLocaleString();
                    showNotification(isVisible ? `Counter Hidden (${sessionCount} filtered)` : `Counter Visible (${sessionCount} filtered)`, 2000);
                }
            });
            GM_registerMenuCommand('📊 Open UI', () => {
                if (!state.counterElement) {
                    createCounter();
                }
                state.counterElement.style.display = 'block';
                showNotification('📊 Counter Displayed', 1500);
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
                if (confirm('Reset all lifetime statistics? This cannot be undone.')) {
                    state.lifetimeStats = { totalFiltered: 0, firstInstall: Date.now(), lastReset: Date.now() };
                    saveStats();
                    showNotification('✓ Statistics reset successfully', 2000);
                }
            });
            GM_registerMenuCommand('✅ Add Current Channel to Whitelist', () => {
                const currentVideo = document.querySelector('ytd-rich-item-renderer, ytd-video-renderer, ytd-grid-video-renderer');
                if (currentVideo) {
                    const channelInfo = extractChannelInfo(currentVideo);
                    if (channelInfo) {
                        if (!CONFIG.WHITELIST.includes(channelInfo.id)) {
                            CONFIG.WHITELIST.push(channelInfo.id);
                            saveConfig(CONFIG);
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
                    if (channelInfo) {
                        if (!CONFIG.BLACKLIST.includes(channelInfo.id)) {
                            CONFIG.BLACKLIST.push(channelInfo.id);
                            saveConfig(CONFIG);
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
                    setTimeout(filterVideos, 500);
                });

                // Listen to scroll events for lazy-loaded content
                let scrollTimeout;
                window.addEventListener('scroll', () => {
                    clearTimeout(scrollTimeout);
                    scrollTimeout = setTimeout(filterVideos, 300);
                }, { passive: true });

                log('✓ YouTube Filter Pro initialized successfully!');
                
                if (CONFIG.SHOW_NOTIFICATIONS) {
                    showNotification('🔥 YT Filter Pro Active', 2000);
                }
            } else {
                setTimeout(init, 100);
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
