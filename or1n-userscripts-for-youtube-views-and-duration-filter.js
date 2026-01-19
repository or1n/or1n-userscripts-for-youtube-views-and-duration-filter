// ==UserScript==
// @name         or1n-userscripts-for-youtube-views-and-duration-filter
// @namespace    https://github.com/or1n/or1n-userscripts-for-youtube-views-and-duration-filter
// @version      3.0.0
// @description  Advanced YouTube video filter with customizable settings, themes, and live statistics
// @author       or1n
// @license      MIT
// @homepage     https://github.com/or1n/or1n-userscripts-for-youtube-views-and-duration-filter
// @supportURL   https://github.com/or1n/or1n-userscripts-for-youtube-views-and-duration-filter/issues
// @updateURL    https://raw.githubusercontent.com/or1n/or1n-userscripts-for-youtube-views-and-duration-filter/main/or1n-userscripts-for-youtube-views-and-duration-filter.js
// @downloadURL  https://raw.githubusercontent.com/or1n/or1n-userscripts-for-youtube-views-and-duration-filter/main/or1n-userscripts-for-youtube-views-and-duration-filter.js
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
        MIN_VIEWS: 10000,
        MIN_DURATION_SECONDS: 240,
        DEBOUNCE_DELAY: 100,
        DEBUG: false,
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
        SHOW_NOTIFICATIONS: true
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
     * Examples: "1.2K" -> 1200, "5M" -> 5000000
     */
    const parseViewCount = (text) => {
        if (!text) return 0;
        
        // Remove common text patterns
        text = text.replace(/views?|visualizações|просмотров?/gi, '').trim();
        
        // Match number patterns with optional multipliers
        const match = text.match(/(\d+(?:[.,]\d+)*)\s*([KkMmBbТтЛл])?/);
        if (!match) return 0;

        let [, count, multiplier] = match;
        count = parseFloat(count.replace(/[.,]/g, match => match === ',' ? '.' : ''));

        const multipliers = {
            'K': 1e3, 'k': 1e3, 'T': 1e3, 'т': 1e3,
            'M': 1e6, 'm': 1e6, 'Л': 1e6, 'л': 1e6,
            'B': 1e9, 'b': 1e9
        };

        return Math.floor(count * (multipliers[multiplier] || 1));
    };

    /**
     * Convert time string to seconds
     * Examples: "12:34" -> 754, "1:02:45" -> 3765
     */
    const timeToSeconds = (timeStr) => {
        if (!timeStr) return 0;
        
        const parts = timeStr.split(':').map(p => parseInt(p, 10) || 0);
        return parts.reduce((acc, val, idx) => acc + val * Math.pow(60, parts.length - 1 - idx), 0);
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

    // ==================== VIDEO FILTERING LOGIC ====================

    /**
     * Extract video metadata from various YouTube elements
     */
    const extractVideoData = (element) => {
        // Try multiple selectors for views (YouTube updates these frequently)
        const viewSelectors = [
            'span.inline-metadata-item:first-of-type',
            '#metadata-line span:first-child',
            'span.ytd-video-meta-block:first-of-type',
            '.ytd-video-meta-block span:first-child',
            '#metadata-line .inline-metadata-item:first-child'
        ];

        let viewsText = null;
        for (const selector of viewSelectors) {
            const viewElement = element.querySelector(selector);
            if (viewElement?.textContent) {
                viewsText = viewElement.textContent;
                break;
            }
        }

        // Try multiple selectors for duration
        const durationSelectors = [
            'span.ytd-thumbnail-overlay-time-status-renderer',
            '#time-status #text',
            '.ytd-thumbnail-overlay-time-status-renderer #text',
            'ytd-thumbnail-overlay-time-status-renderer span'
        ];

        let durationText = null;
        for (const selector of durationSelectors) {
            const durationElement = element.querySelector(selector);
            if (durationElement?.textContent?.trim()) {
                durationText = durationElement.textContent.trim();
                break;
            }
        }

        return { viewsText, durationText };
    };

    /**
     * Check if video should be filtered
     */
    const shouldFilterVideo = (element) => {
        // Skip if already processed
        if (state.processedVideos.has(element)) {
            return false;
        }

        const { viewsText, durationText } = extractVideoData(element);

        // Skip if missing critical data
        if (!viewsText && !durationText) {
            return false;
        }

        const viewCount = parseViewCount(viewsText || '');
        const durationSeconds = timeToSeconds(durationText || '');

        // Check filters
        const viewsLow = viewsText && viewCount < CONFIG.MIN_VIEWS;
        const durationShort = durationText && durationSeconds > 0 && durationSeconds < CONFIG.MIN_DURATION_SECONDS;

        if (viewsLow || durationShort) {
            log(`Filtering: ${viewCount} views, ${durationSeconds}s duration`);
            return true;
        }

        return false;
    };

    /**
     * Get the container element to remove
     */
    const getContainerToRemove = (element) => {
        // Find the appropriate parent container
        const containerSelectors = [
            'ytd-rich-item-renderer',
            'ytd-video-renderer',
            'ytd-grid-video-renderer',
            'ytd-compact-video-renderer',
            'ytd-playlist-video-renderer'
        ];

        for (const selector of containerSelectors) {
            const container = element.closest(selector);
            if (container) return container;
        }

        return element;
    };

    /**
     * Remove video element with smooth animation
     */
    const removeVideoElement = (element) => {
        const container = getContainerToRemove(element);
        
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
                    container.remove();
                }, 300);
            }, 300);
        } else {
            container.remove();
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
        
        counter.innerHTML = `
            <div class="yt-filter-header">
                <span class="yt-filter-title">🔥 YT Filter Pro</span>
                <div class="yt-filter-buttons">
                    <button class="yt-filter-settings" title="Settings">⚙️</button>
                    <button class="yt-filter-toggle" title="Hide Counter">−</button>
                </div>
            </div>
            <div class="yt-filter-stats">
                <div class="stat">
                    <span class="stat-label">Session:</span>
                    <span class="stat-value" id="yt-session-count">0</span>
                </div>
                ${CONFIG.ENABLE_STATISTICS ? `
                <div class="stat lifetime">
                    <span class="stat-label">Lifetime:</span>
                    <span class="stat-value" id="yt-lifetime-count">${state.lifetimeStats.totalFiltered.toLocaleString()}</span>
                </div>
                <div class="stat-info">
                    📊 Active for ${daysSinceInstall} day${daysSinceInstall !== 1 ? 's' : ''}
                </div>
                ` : ''}
                <div class="stat-info">
                    Min Views: ${CONFIG.MIN_VIEWS.toLocaleString()}<br>
                    Min Duration: ${Math.floor(CONFIG.MIN_DURATION_SECONDS / 60)}m ${CONFIG.MIN_DURATION_SECONDS % 60}s
                </div>
            </div>
        `;

        // Apply theme and font settings
        applyCounterStyle(counter);

        // Settings button
        const settingsBtn = counter.querySelector('.yt-filter-settings');
        settingsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleSettingsPanel();
        });

        // Toggle visibility
        const toggleBtn = counter.querySelector('.yt-filter-toggle');
        const statsDiv = counter.querySelector('.yt-filter-stats');
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isHidden = statsDiv.style.display === 'none';
            statsDiv.style.display = isHidden ? 'block' : 'none';
            toggleBtn.textContent = isHidden ? '−' : '+';
            toggleBtn.title = isHidden ? 'Hide Counter' : 'Show Counter';
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
     * Create settings panel
     */
    const createSettingsPanel = () => {
        const panel = document.createElement('div');
        panel.id = 'yt-filter-settings-panel';
        panel.innerHTML = `
            <div class="settings-overlay" id="settings-overlay"></div>
            <div class="settings-content">
                <div class="settings-header">
                    <h2>⚙️ YouTube Filter Pro Settings</h2>
                    <button class="settings-close" title="Close">✕</button>
                </div>
                <div class="settings-body">
                    <div class="settings-section">
                        <h3>🎯 Filter Settings</h3>
                        <div class="setting-item">
                            <label>Minimum Views</label>
                            <input type="number" id="setting-min-views" value="${CONFIG.MIN_VIEWS}" min="0" step="1000">
                        </div>
                        <div class="setting-item">
                            <label>Minimum Duration (seconds)</label>
                            <input type="number" id="setting-min-duration" value="${CONFIG.MIN_DURATION_SECONDS}" min="0" step="30">
                            <small>${Math.floor(CONFIG.MIN_DURATION_SECONDS / 60)}m ${CONFIG.MIN_DURATION_SECONDS % 60}s</small>
                        </div>
                    </div>

                    <div class="settings-section">
                        <h3>🎨 Appearance</h3>
                        <div class="setting-item">
                            <label>Theme</label>
                            <select id="setting-theme">
                                <option value="dark" ${CONFIG.THEME === 'dark' ? 'selected' : ''}>🌙 Dark</option>
                                <option value="light" ${CONFIG.THEME === 'light' ? 'selected' : ''}>☀️ Light</option>
                            </select>
                        </div>
                        <div class="setting-item">
                            <label>Font Family</label>
                            <select id="setting-font-family">
                                <option value="Segoe UI" ${CONFIG.FONT_FAMILY === 'Segoe UI' ? 'selected' : ''}>Segoe UI</option>
                                <option value="Arial" ${CONFIG.FONT_FAMILY === 'Arial' ? 'selected' : ''}>Arial</option>
                                <option value="Roboto" ${CONFIG.FONT_FAMILY === 'Roboto' ? 'selected' : ''}>Roboto</option>
                                <option value="Consolas" ${CONFIG.FONT_FAMILY === 'Consolas' ? 'selected' : ''}>Consolas</option>
                                <option value="Courier New" ${CONFIG.FONT_FAMILY === 'Courier New' ? 'selected' : ''}>Courier New</option>
                                <option value="Georgia" ${CONFIG.FONT_FAMILY === 'Georgia' ? 'selected' : ''}>Georgia</option>
                                <option value="Verdana" ${CONFIG.FONT_FAMILY === 'Verdana' ? 'selected' : ''}>Verdana</option>
                            </select>
                        </div>
                        <div class="setting-item">
                            <label>Font Size</label>
                            <input type="range" id="setting-font-size" min="10" max="20" value="${CONFIG.FONT_SIZE}">
                            <span id="font-size-value">${CONFIG.FONT_SIZE}px</span>
                        </div>
                        <div class="setting-item">
                            <label>Font Weight</label>
                            <select id="setting-font-weight">
                                <option value="normal" ${CONFIG.FONT_WEIGHT === 'normal' ? 'selected' : ''}>Normal</option>
                                <option value="bold" ${CONFIG.FONT_WEIGHT === 'bold' ? 'selected' : ''}>Bold</option>
                                <option value="lighter" ${CONFIG.FONT_WEIGHT === 'lighter' ? 'selected' : ''}>Light</option>
                                <option value="600" ${CONFIG.FONT_WEIGHT === '600' ? 'selected' : ''}>Semi-Bold</option>
                            </select>
                        </div>
                        <div class="setting-item">
                            <label>Counter Opacity</label>
                            <input type="range" id="setting-opacity" min="50" max="100" value="${CONFIG.COUNTER_OPACITY}">
                            <span id="opacity-value">${CONFIG.COUNTER_OPACITY}%</span>
                        </div>
                    </div>

                    <div class="settings-section">
                        <h3>⌨️ Keyboard Shortcut</h3>
                        <div class="setting-item">
                            <label>Toggle Counter Visibility</label>
                            <div class="keyboard-shortcut">
                                <label><input type="checkbox" id="shortcut-ctrl" ${CONFIG.USE_CTRL ? 'checked' : ''}> Ctrl</label>
                                <label><input type="checkbox" id="shortcut-alt" ${CONFIG.USE_ALT ? 'checked' : ''}> Alt</label>
                                <label><input type="checkbox" id="shortcut-shift" ${CONFIG.USE_SHIFT ? 'checked' : ''}> Shift</label>
                                <span>+</span>
                                <select id="shortcut-key">
                                    <option value="KeyF" ${CONFIG.KEYBOARD_SHORTCUT === 'KeyF' ? 'selected' : ''}>F</option>
                                    <option value="KeyH" ${CONFIG.KEYBOARD_SHORTCUT === 'KeyH' ? 'selected' : ''}>H</option>
                                    <option value="KeyY" ${CONFIG.KEYBOARD_SHORTCUT === 'KeyY' ? 'selected' : ''}>Y</option>
                                    <option value="KeyQ" ${CONFIG.KEYBOARD_SHORTCUT === 'KeyQ' ? 'selected' : ''}>Q</option>
                                </select>
                            </div>
                            <small>Current: ${CONFIG.USE_CTRL ? 'Ctrl+' : ''}${CONFIG.USE_ALT ? 'Alt+' : ''}${CONFIG.USE_SHIFT ? 'Shift+' : ''}${CONFIG.KEYBOARD_SHORTCUT.replace('Key', '')}</small>
                        </div>
                    </div>

                    <div class="settings-section">
                        <h3>📊 Statistics</h3>
                        <div class="setting-item">
                            <label><input type="checkbox" id="setting-enable-stats" ${CONFIG.ENABLE_STATISTICS ? 'checked' : ''}> Track Lifetime Statistics</label>
                        </div>
                        <div class="setting-item">
                            <label><input type="checkbox" id="setting-show-notifications" ${CONFIG.SHOW_NOTIFICATIONS ? 'checked' : ''}> Show Notifications</label>
                        </div>
                        <div class="stats-display">
                            <p><strong>Total Filtered:</strong> ${state.lifetimeStats.totalFiltered.toLocaleString()}</p>
                            <p><strong>Active Since:</strong> ${new Date(state.lifetimeStats.firstInstall).toLocaleDateString()}</p>
                            <p><strong>Days Active:</strong> ${Math.floor((Date.now() - state.lifetimeStats.firstInstall) / (1000 * 60 * 60 * 24))}</p>
                            <button class="btn-reset-stats">Reset Statistics</button>
                        </div>
                    </div>

                    <div class="settings-section">
                        <h3>🔧 Advanced</h3>
                        <div class="setting-item">
                            <label><input type="checkbox" id="setting-smooth-removal" ${CONFIG.SMOOTH_REMOVAL ? 'checked' : ''}> Smooth Video Removal Animation</label>
                        </div>
                        <div class="setting-item">
                            <label><input type="checkbox" id="setting-draggable" ${CONFIG.COUNTER_DRAGGABLE ? 'checked' : ''}> Draggable Counter</label>
                        </div>
                        <div class="setting-item">
                            <label><input type="checkbox" id="setting-debug" ${CONFIG.DEBUG ? 'checked' : ''}> Enable Debug Logging</label>
                        </div>
                    </div>
                </div>
                <div class="settings-footer">
                    <button class="btn-reset">Reset to Defaults</button>
                    <button class="btn-save">Save Settings</button>
                </div>
            </div>
        `;

        document.body.appendChild(panel);
        state.settingsPanel = panel;

        // Event listeners
        panel.querySelector('.settings-close').addEventListener('click', () => toggleSettingsPanel());
        panel.querySelector('#settings-overlay').addEventListener('click', () => toggleSettingsPanel());
        
        // Live preview for sliders
        const fontSizeSlider = panel.querySelector('#setting-font-size');
        const fontSizeValue = panel.querySelector('#font-size-value');
        fontSizeSlider.addEventListener('input', (e) => {
            fontSizeValue.textContent = e.target.value + 'px';
        });

        const opacitySlider = panel.querySelector('#setting-opacity');
        const opacityValue = panel.querySelector('#opacity-value');
        opacitySlider.addEventListener('input', (e) => {
            opacityValue.textContent = e.target.value + '%';
        });

        // Duration display update
        const durationInput = panel.querySelector('#setting-min-duration');
        durationInput.addEventListener('input', (e) => {
            const seconds = parseInt(e.target.value) || 0;
            const small = e.target.nextElementSibling;
            small.textContent = `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
        });

        // Reset stats
        panel.querySelector('.btn-reset-stats').addEventListener('click', () => {
            if (confirm('Are you sure you want to reset all statistics? This cannot be undone.')) {
                state.lifetimeStats = {
                    totalFiltered: 0,
                    firstInstall: Date.now(),
                    lastReset: Date.now()
                };
                saveStats();
                showNotification('✓ Statistics reset successfully');
                setTimeout(() => toggleSettingsPanel(), 500);
            }
        });

        // Save settings
        panel.querySelector('.btn-save').addEventListener('click', () => {
            CONFIG.MIN_VIEWS = parseInt(panel.querySelector('#setting-min-views').value) || 0;
            CONFIG.MIN_DURATION_SECONDS = parseInt(panel.querySelector('#setting-min-duration').value) || 0;
            CONFIG.THEME = panel.querySelector('#setting-theme').value;
            CONFIG.FONT_FAMILY = panel.querySelector('#setting-font-family').value;
            CONFIG.FONT_SIZE = parseInt(panel.querySelector('#setting-font-size').value) || 14;
            CONFIG.FONT_WEIGHT = panel.querySelector('#setting-font-weight').value;
            CONFIG.COUNTER_OPACITY = parseInt(panel.querySelector('#setting-opacity').value) || 95;
            CONFIG.USE_CTRL = panel.querySelector('#shortcut-ctrl').checked;
            CONFIG.USE_ALT = panel.querySelector('#shortcut-alt').checked;
            CONFIG.USE_SHIFT = panel.querySelector('#shortcut-shift').checked;
            CONFIG.KEYBOARD_SHORTCUT = panel.querySelector('#shortcut-key').value;
            CONFIG.ENABLE_STATISTICS = panel.querySelector('#setting-enable-stats').checked;
            CONFIG.SHOW_NOTIFICATIONS = panel.querySelector('#setting-show-notifications').checked;
            CONFIG.SMOOTH_REMOVAL = panel.querySelector('#setting-smooth-removal').checked;
            CONFIG.COUNTER_DRAGGABLE = panel.querySelector('#setting-draggable').checked;
            CONFIG.DEBUG = panel.querySelector('#setting-debug').checked;

            saveConfig(CONFIG);
            showNotification('✓ Settings saved');
            
            // Recreate counter and styles
            if (state.counterElement) {
                state.counterElement.remove();
                state.counterElement = null;
            }
            injectStyles();
            createCounter();
            
            toggleSettingsPanel();
        });

        // Reset to defaults
        panel.querySelector('.btn-reset').addEventListener('click', () => {
            if (confirm('Reset all settings to defaults?')) {
                CONFIG = { ...DEFAULT_CONFIG };
                saveConfig(CONFIG);
                showNotification('✓ Settings reset to defaults');
                setTimeout(() => location.reload(), 500);
            }
        });

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
                        showNotification(isVisible ? '👁️ Counter Hidden' : '👁️ Counter Visible', 2000);
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
                border: '#cc0000',
                headerBg: 'linear-gradient(135deg, #cc0000 0%, #aa0000 100%)',
                text: '#333',
                textMuted: '#666',
                statBg: 'rgba(204, 0, 0, 0.1)',
                infoBg: 'rgba(0, 0, 0, 0.05)',
                shadow: 'rgba(0, 0, 0, 0.2)',
                shadowHover: 'rgba(204, 0, 0, 0.3)'
            };
        }
        return {
            bg: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
            border: '#ff0000',
            headerBg: 'linear-gradient(135deg, #ff0000 0%, #cc0000 100%)',
            text: '#fff',
            textMuted: '#aaa',
            statBg: 'rgba(255, 0, 0, 0.1)',
            infoBg: 'rgba(255, 255, 255, 0.05)',
            shadow: 'rgba(0, 0, 0, 0.6)',
            shadowHover: 'rgba(255, 0, 0, 0.4)'
        };
    };

    const injectStyles = () => {
        const theme = getThemeColors();
        const style = document.createElement('style');
        style.id = 'yt-filter-styles';
        style.textContent = `
            #yt-filter-counter {
                position: fixed;
                top: 80px;
                right: 20px;
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
            .yt-filter-toggle {
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
            .yt-filter-toggle:hover {
                background: rgba(255, 255, 255, 0.3);
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
                border-left-color: #00ff00;
                background: rgba(0, 255, 0, 0.1);
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

            .setting-item input[type="range"] {
                width: calc(100% - 60px);
                margin-right: 10px;
            }

            .setting-item small {
                display: block;
                margin-top: 5px;
                color: ${theme.textMuted};
                font-size: 12px;
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
                background: #ff0000;
                color: #fff;
                border: none;
                padding: 8px 16px;
                border-radius: 6px;
                cursor: pointer;
                margin-top: 10px;
                font-weight: 500;
            }

            .btn-reset-stats:hover {
                background: #cc0000;
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

        log('Initializing YouTube Filter Pro 2026...');

        // Inject styles immediately
        injectStyles();

        // Register Tampermonkey menu command
        if (typeof GM_registerMenuCommand !== 'undefined') {
            GM_registerMenuCommand('⚙️ Open Settings', () => toggleSettingsPanel());
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
