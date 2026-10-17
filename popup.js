/**
 * Coding Contest Tracker - Popup Logic
 * Handles interactive tabs, platform filtering, search, Google Calendar sync,
 * desktop reminders, star bookmarks, and settings management.
 */

document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements
  const contestListEl = document.getElementById('contest-list');
  const searchInput = document.getElementById('search-input');
  const searchClearBtn = document.getElementById('search-clear-btn');
  const refreshBtn = document.getElementById('refresh-btn');
  const settingsBtn = document.getElementById('settings-btn');
  const closeSettingsBtn = document.getElementById('close-settings-btn');
  const settingsModal = document.getElementById('settings-modal');
  const syncStatusEl = document.getElementById('sync-status');
  const toastEl = document.getElementById('toast');

  const countUpcomingEl = document.getElementById('count-upcoming');
  const countLiveEl = document.getElementById('count-live');
  const countStarredEl = document.getElementById('count-starred');

  const tabButtons = document.querySelectorAll('.tab-btn');
  const platformChips = document.querySelectorAll('.chip');

  const reminderSelect = document.getElementById('reminder-select');
  const testNotifBtn = document.getElementById('test-notif-btn');
  const clistUserInput = document.getElementById('clist-user-input');
  const clistKeyInput = document.getElementById('clist-key-input');
  const saveClistBtn = document.getElementById('save-clist-btn');
  const testClistBtn = document.getElementById('test-clist-btn');
  const clistStatusMsg = document.getElementById('clist-status-msg');

  // Application State
  let allContests = [];
  let starredContestIds = new Set();
  let currentTab = 'upcoming'; // 'upcoming' | 'live' | 'starred'
  let currentPlatform = 'all';  // 'all' | 'Codeforces' | 'LeetCode' | 'CodeChef' | 'AtCoder' | 'Other'
  let searchQuery = '';

  // -----------------------------------------------------------
  // 1. Initialization
  // -----------------------------------------------------------

  async function init() {
    setupEventListeners();
    await loadSettings();
    await loadContestsFromStorage();

    // If storage has no contests or data is older than 30 mins, trigger background refresh
    const { lastUpdated = 0 } = await chrome.storage.local.get('lastUpdated');
    if (!allContests.length || Date.now() - lastUpdated > 30 * 60 * 1000) {
      await refreshContests(false);
    }
  }

  // -----------------------------------------------------------
  // 2. Data Loading & Storage
  // -----------------------------------------------------------

  async function loadSettings() {
    const data = await chrome.storage.local.get([
      'reminderMinutes',
      'clistUsername',
      'clistApiKey',
      'starredContests',
      'lastUpdated'
    ]);

    if (data.reminderMinutes) {
      reminderSelect.value = String(data.reminderMinutes);
    }
    if (data.clistUsername) {
      clistUserInput.value = data.clistUsername;
    }
    if (data.clistApiKey) {
      clistKeyInput.value = data.clistApiKey;
    }
    if (Array.isArray(data.starredContests)) {
      starredContestIds = new Set(data.starredContests);
    }
    updateSyncStatus(data.lastUpdated);
  }

  async function loadContestsFromStorage() {
    const { contests = [], lastUpdated } = await chrome.storage.local.get(['contests', 'lastUpdated']);
    allContests = contests;
    updateSyncStatus(lastUpdated);
    renderList();
  }

  async function refreshContests(showUserToast = true) {
    refreshBtn.classList.add('spin-animation');
    syncStatusEl.textContent = 'Syncing contests...';

    try {
      const response = await chrome.runtime.sendMessage({ action: 'FETCH_CONTESTS' });
      if (response?.success && Array.isArray(response.contests)) {
        allContests = response.contests;
        updateSyncStatus(response.lastUpdated);
        renderList();
        if (showUserToast) showToast('Contests updated!');
      } else {
        syncStatusEl.textContent = 'Sync error';
        if (showUserToast) showToast('Failed to refresh contests.');
      }
    } catch (err) {
      console.error('[ContestTracker] Refresh error:', err);
      syncStatusEl.textContent = 'Sync error';
      if (showUserToast) showToast('Refresh failed. Try again.');
    } finally {
      refreshBtn.classList.remove('spin-animation');
    }
  }

  function updateSyncStatus(timestamp) {
    if (!timestamp) {
      syncStatusEl.textContent = 'Not synced yet';
      return;
    }
    const diffMins = Math.floor((Date.now() - timestamp) / (60 * 1000));
    if (diffMins < 1) {
      syncStatusEl.textContent = 'Updated just now';
    } else if (diffMins < 60) {
      syncStatusEl.textContent = `Updated ${diffMins}m ago`;
    } else {
      const diffHours = Math.floor(diffMins / 60);
      syncStatusEl.textContent = `Updated ${diffHours}h ago`;
    }
  }

  // -----------------------------------------------------------
  // 3. Rendering & Filtering
  // -----------------------------------------------------------

  function renderList() {
    const now = Date.now();

    // Re-evaluate live/upcoming status based on current time
    allContests.forEach(c => {
      const start = new Date(c.start).getTime();
      const end = new Date(c.end).getTime();
      if (now >= start && now <= end) {
        c.status = 'LIVE';
      } else if (start > now) {
        c.status = 'UPCOMING';
      } else {
        c.status = 'ENDED';
      }
    });

    // Active contests (exclude ended)
    const activeContests = allContests.filter(c => c.status !== 'ENDED');

    // Counts for badges
    const upcomingCount = activeContests.filter(c => c.status === 'UPCOMING').length;
    const liveCount = activeContests.filter(c => c.status === 'LIVE').length;
    const starredCount = activeContests.filter(c => starredContestIds.has(c.id)).length;

    countUpcomingEl.textContent = upcomingCount;
    countLiveEl.textContent = liveCount;
    countStarredEl.textContent = starredCount;

    // Filter by Tab
    let filtered = activeContests.filter(c => {
      if (currentTab === 'live') return c.status === 'LIVE';
      if (currentTab === 'starred') return starredContestIds.has(c.id);
      return c.status === 'UPCOMING';
    });

    // Filter by Platform
    if (currentPlatform !== 'all') {
      filtered = filtered.filter(c => {
        if (currentPlatform === 'Other') {
          return !['Codeforces', 'LeetCode', 'CodeChef', 'AtCoder'].includes(c.platform);
        }
        return c.platform.toLowerCase() === currentPlatform.toLowerCase();
      });
    }

    // Filter by Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(c =>
        c.event.toLowerCase().includes(q) ||
        c.platform.toLowerCase().includes(q)
      );
    }

    // Clear Container
    contestListEl.innerHTML = '';

    // Empty State Check
    if (filtered.length === 0) {
      contestListEl.appendChild(createEmptyState());
      return;
    }

    // Render Cards
    filtered.forEach(contest => {
      contestListEl.appendChild(createContestCard(contest));
    });
  }

  function createContestCard(contest) {
    const card = document.createElement('div');
    const isLive = contest.status === 'LIVE';
    card.className = `contest-card ${isLive ? 'live-card' : ''}`;

    const isStarred = starredContestIds.has(contest.id);
    const platformClass = getPlatformClass(contest.platform);
    const timeFormatted = formatContestTime(contest.start);
    const durationFormatted = formatDuration(contest.duration);
    const relativeTime = getRelativeTimeLabel(contest.start, contest.end, isLive);

    card.innerHTML = `
      <div class="card-top">
        <span class="platform-pill ${platformClass}">${escapeHtml(contest.platform)}</span>
        <div class="card-top-right">
          <div class="status-indicator ${isLive ? 'live' : 'upcoming'}">
            ${isLive ? '<span class="pulse-dot"></span>' : ''}
            <span>${relativeTime}</span>
          </div>
          <button class="star-btn ${isStarred ? 'starred' : ''}" data-id="${contest.id}" title="${isStarred ? 'Unstar' : 'Star contest'}">
            <svg class="star-icon" viewBox="0 0 24 24" fill="${isStarred ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
            </svg>
          </button>
        </div>
      </div>

      <a href="${escapeHtml(contest.href)}" target="_blank" class="card-title" title="${escapeHtml(contest.event)}">
        ${escapeHtml(contest.event)}
      </a>

      <div class="card-meta">
        <div class="meta-item">
          <svg class="meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
          <span>${timeFormatted}</span>
        </div>
        <div class="meta-item">
          <svg class="meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          <span>${durationFormatted}</span>
        </div>
      </div>

      <div class="card-actions">
        <button class="action-btn gcal-btn" data-action="gcal" title="Add event to Google Calendar">
          <svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
            <line x1="12" y1="14" x2="12" y2="18"></line>
            <line x1="10" y1="16" x2="14" y2="16"></line>
          </svg>
          <span>Add to Google Calendar</span>
        </button>

        <button class="action-btn visit-btn" data-action="visit" title="Go to contest page">
          <svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
          <span>Open Contest</span>
        </button>
      </div>
    `;

    // Event Listeners for Card buttons
    const starBtn = card.querySelector('.star-btn');
    starBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleStar(contest.id);
    });

    const gcalBtn = card.querySelector('[data-action="gcal"]');
    gcalBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      addToGoogleCalendar(contest);
    });

    const visitBtn = card.querySelector('[data-action="visit"]');
    visitBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      chrome.tabs.create({ url: contest.href });
    });

    return card;
  }

  function createEmptyState() {
    const div = document.createElement('div');
    div.className = 'empty-state';

    let title = 'No Contests Found';
    let text = 'Try clearing your search query or changing platform filter.';

    if (currentTab === 'live') {
      title = 'No Live Contests Right Now';
      text = 'Check out the Upcoming tab to see scheduled competitions.';
    } else if (currentTab === 'starred') {
      title = 'No Starred Contests Yet';
      text = 'Click the star icon on any contest card to pin it here for quick access.';
    }

    div.innerHTML = `
      <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      <div class="empty-title">${title}</div>
      <div class="empty-text">${text}</div>
    `;
    return div;
  }

  // -----------------------------------------------------------
  // 4. Calendar Actions
  // -----------------------------------------------------------

  function addToGoogleCalendar(contest) {
    const url = buildGoogleCalendarUrl(contest.event, contest.start, contest.end, contest.href, contest.platform);
    chrome.tabs.create({ url });
    showToast('Opening Google Calendar event...');
  }

  function buildGoogleCalendarUrl(title, startIso, endIso, href, platform) {
    function formatGCal(iso) {
      return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    }
    const dates = `${formatGCal(startIso)}/${formatGCal(endIso)}`;
    const details = `Platform: ${platform || 'Coding Contest'}\nDirect Link: ${href}\n\nAdded via Coding Contest Tracker Chrome Extension`;
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${dates}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(href)}`;
  }

  // -----------------------------------------------------------
  // 5. Star / Bookmark Feature
  // -----------------------------------------------------------

  async function toggleStar(contestId) {
    if (starredContestIds.has(contestId)) {
      starredContestIds.delete(contestId);
      showToast('Removed from Starred');
    } else {
      starredContestIds.add(contestId);
      showToast('Added to Starred!');
    }

    await chrome.storage.local.set({
      starredContests: Array.from(starredContestIds)
    });

    renderList();
  }

  // -----------------------------------------------------------
  // 6. UI Helpers & Formatters
  // -----------------------------------------------------------

  function getPlatformClass(platform) {
    const p = (platform || '').toLowerCase();
    if (p.includes('codeforces')) return 'cf';
    if (p.includes('leetcode')) return 'lc';
    if (p.includes('codechef')) return 'cc';
    if (p.includes('atcoder')) return 'ac';
    return 'other';
  }

  function formatContestTime(isoString) {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return 'TBD';

    const options = {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    };
    return d.toLocaleString(undefined, options);
  }

  function formatDuration(seconds) {
    if (!seconds || seconds <= 0) return 'TBD';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);

    if (hrs > 24) {
      const days = Math.round(hrs / 24);
      return `${days} days`;
    }
    if (hrs > 0 && mins > 0) return `${hrs}h ${mins}m`;
    if (hrs > 0) return `${hrs}h`;
    return `${mins}m`;
  }

  function getRelativeTimeLabel(startIso, endIso, isLive) {
    const now = Date.now();
    if (isLive) {
      const end = new Date(endIso).getTime();
      const leftMs = end - now;
      if (leftMs <= 0) return 'Ending now';
      const leftMins = Math.floor(leftMs / (60 * 1000));
      if (leftMins < 60) return `LIVE • Ends in ${leftMins}m`;
      const leftHours = Math.floor(leftMins / 60);
      const remainingMins = leftMins % 60;
      return `LIVE • Ends in ${leftHours}h ${remainingMins}m`;
    }

    const start = new Date(startIso).getTime();
    const diffMs = start - now;
    if (diffMs <= 0) return 'Starting now';

    const diffMins = Math.floor(diffMs / (60 * 1000));
    if (diffMins < 60) return `Starts in ${diffMins}m`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) {
      const remMins = diffMins % 60;
      return `Starts in ${diffHours}h ${remMins}m`;
    }

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Starts tomorrow';
    return `Starts in ${diffDays} days`;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function showToast(message) {
    toastEl.textContent = message;
    toastEl.classList.remove('hidden');
    clearTimeout(toastEl._timer);
    toastEl._timer = setTimeout(() => {
      toastEl.classList.add('hidden');
    }, 2400);
  }

  // -----------------------------------------------------------
  // 7. Event Listeners
  // -----------------------------------------------------------

  function setupEventListeners() {
    // Refresh button
    refreshBtn.addEventListener('click', () => refreshContests(true));

    // Settings Modal
    settingsBtn.addEventListener('click', () => settingsModal.classList.remove('hidden'));
    closeSettingsBtn.addEventListener('click', () => settingsModal.classList.add('hidden'));
    settingsModal.addEventListener('click', (e) => {
      if (e.target === settingsModal) settingsModal.classList.add('hidden');
    });

    // Tab buttons
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        tabButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTab = btn.getAttribute('data-tab');
        renderList();
      });
    });

    // Platform chip filter
    platformChips.forEach(chip => {
      chip.addEventListener('click', () => {
        platformChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        currentPlatform = chip.getAttribute('data-platform');
        renderList();
      });
    });

    // Search input
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      if (searchQuery.trim()) {
        searchClearBtn.classList.remove('hidden');
      } else {
        searchClearBtn.classList.add('hidden');
      }
      renderList();
    });

    // Search clear button
    searchClearBtn.addEventListener('click', () => {
      searchInput.value = '';
      searchQuery = '';
      searchClearBtn.classList.add('hidden');
      renderList();
      searchInput.focus();
    });

    // Reminder timing select
    reminderSelect.addEventListener('change', async (e) => {
      const minutes = parseInt(e.target.value, 10);
      await chrome.storage.local.set({ reminderMinutes: minutes });
      await chrome.runtime.sendMessage({ action: 'RESCHEDULE_REMINDERS' });
      showToast(`Reminder set to ${minutes} mins before start`);
    });

    // Test notification button
    testNotifBtn.addEventListener('click', async () => {
      await chrome.runtime.sendMessage({ action: 'TEST_NOTIFICATION' });
      showToast('Test notification sent! Check desktop.');
    });

    // Save CLIST Credentials
    saveClistBtn.addEventListener('click', async () => {
      const username = clistUserInput.value.trim();
      const apiKey = clistKeyInput.value.trim();
      await chrome.storage.local.set({ clistUsername: username, clistApiKey: apiKey });

      clistStatusMsg.className = 'status-msg success';
      clistStatusMsg.textContent = 'Credentials saved! Refreshing contests...';
      clistStatusMsg.classList.remove('hidden');

      await refreshContests(true);
    });

    // Test CLIST connection
    testClistBtn.addEventListener('click', async () => {
      const username = clistUserInput.value.trim();
      const apiKey = clistKeyInput.value.trim();

      if (!username || !apiKey) {
        clistStatusMsg.className = 'status-msg error';
        clistStatusMsg.textContent = 'Please enter both Username and API Key.';
        clistStatusMsg.classList.remove('hidden');
        return;
      }

      clistStatusMsg.className = 'status-msg';
      clistStatusMsg.textContent = 'Testing connection with CLIST API...';
      clistStatusMsg.classList.remove('hidden');

      const res = await chrome.runtime.sendMessage({
        action: 'TEST_CLIST',
        username,
        apiKey
      });

      if (res?.success) {
        clistStatusMsg.className = 'status-msg success';
        clistStatusMsg.textContent = `Success! Connected to CLIST.BY (Found ${res.count} contests).`;
      } else {
        clistStatusMsg.className = 'status-msg error';
        clistStatusMsg.textContent = `Connection failed: ${res?.error || 'Invalid credentials'}`;
      }
    });
  }

  // Start app
  init();
});