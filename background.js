/**
 * Coding Contest Tracker - Background Service Worker (Manifest V3)
 * Handles background fetching, alarm scheduling, desktop notifications,
 * extension badge updates, and message handling from the popup.
 */

const PERIODIC_ALARM_NAME = 'contest_tracker_periodic_sync';
const SYNC_INTERVAL_MINUTES = 60; // Auto-sync every hour

// -------------------------------------------------------------
// 1. Extension Lifecycle Listeners
// -------------------------------------------------------------

chrome.runtime.onInstalled.addListener(async () => {
  console.log('[ContestTracker] Extension installed/updated.');

  // Set default settings if not already configured
  const existing = await chrome.storage.local.get([
    'reminderMinutes',
    'enabledPlatforms',
    'clistUsername',
    'clistApiKey',
    'starredContests'
  ]);

  const defaults = {
    reminderMinutes: existing.reminderMinutes ?? 30,
    enabledPlatforms: existing.enabledPlatforms ?? ['Codeforces', 'LeetCode', 'CodeChef', 'AtCoder'],
    clistUsername: existing.clistUsername ?? '',
    clistApiKey: existing.clistApiKey ?? '',
    starredContests: existing.starredContests ?? []
  };

  await chrome.storage.local.set(defaults);

  // Setup periodic sync alarm
  await chrome.alarms.create(PERIODIC_ALARM_NAME, {
    periodInMinutes: SYNC_INTERVAL_MINUTES
  });

  // Initial fetch
  await fetchAndSyncContests();
});

chrome.runtime.onStartup.addListener(async () => {
  const { lastUpdated = 0 } = await chrome.storage.local.get('lastUpdated');
  const thirtyMinutesAgo = Date.now() - (30 * 60 * 1000);
  if (lastUpdated < thirtyMinutesAgo) {
    await fetchAndSyncContests();
  }
});

// -------------------------------------------------------------
// 2. Alarm Handling (CRITICAL FIX: lowercase onAlarm)
// -------------------------------------------------------------

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === PERIODIC_ALARM_NAME) {
    console.log('[ContestTracker] Periodic sync alarm fired.');
    await fetchAndSyncContests();
  } else if (alarm.name.startsWith('notify_')) {
    const contestId = alarm.name.replace('notify_', '');
    console.log('[ContestTracker] Contest notification alarm fired for:', contestId);
    await handleContestReminder(contestId);
  }
});

// -------------------------------------------------------------
// 3. Desktop Notification Handling
// -------------------------------------------------------------

async function handleContestReminder(contestId) {
  try {
    const data = await chrome.storage.local.get([`meta_${contestId}`, 'reminderMinutes']);
    const contest = data[`meta_${contestId}`];
    const minutes = data.reminderMinutes || 30;

    if (!contest) {
      console.warn('[ContestTracker] No metadata found for contest alarm:', contestId);
      return;
    }

    const notificationId = `contest_notif_${contestId}_${Date.now()}`;

    // Store notification link for click handling
    await chrome.storage.local.set({
      [`notif_link_${notificationId}`]: {
        href: contest.href,
        event: contest.event,
        start: contest.start,
        end: contest.end
      }
    });

    chrome.notifications.create(notificationId, {
      type: 'basic',
      iconUrl: 'icons/icon-48.png',
      title: `[${contest.platform}] Starting Soon!`,
      message: `"${contest.event}" starts in ${minutes} minutes. Best of luck!`,
      contextMessage: `Platform: ${contest.platform}`,
      buttons: [
        { title: 'Open Contest' },
        { title: 'Add to Calendar' }
      ],
      priority: 2,
      requireInteraction: true
    });
  } catch (err) {
    console.error('[ContestTracker] Error in handleContestReminder:', err);
  }
}

// User clicks notification body
chrome.notifications.onClicked.addListener(async (notificationId) => {
  try {
    const data = await chrome.storage.local.get(`notif_link_${notificationId}`);
    const meta = data[`notif_link_${notificationId}`];
    if (meta?.href) {
      chrome.tabs.create({ url: meta.href });
    }
    chrome.notifications.clear(notificationId);
    await chrome.storage.local.remove(`notif_link_${notificationId}`);
  } catch (err) {
    console.error('[ContestTracker] Error handling notification click:', err);
  }
});

// User clicks notification action buttons
chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
  try {
    const data = await chrome.storage.local.get(`notif_link_${notificationId}`);
    const meta = data[`notif_link_${notificationId}`];

    if (buttonIndex === 0 && meta?.href) {
      // Button 0: Open Contest
      chrome.tabs.create({ url: meta.href });
    } else if (buttonIndex === 1 && meta) {
      // Button 1: Add to Google Calendar
      const gcalUrl = buildGoogleCalendarUrl(meta.event, meta.start, meta.end, meta.href);
      chrome.tabs.create({ url: gcalUrl });
    }

    chrome.notifications.clear(notificationId);
    await chrome.storage.local.remove(`notif_link_${notificationId}`);
  } catch (err) {
    console.error('[ContestTracker] Error handling notification button click:', err);
  }
});

// -------------------------------------------------------------
// 4. Multi-Platform Fetchers & Aggregator
// -------------------------------------------------------------

async function fetchCodeforces() {
  try {
    const res = await fetch('https://codeforces.com/api/contest.list');
    const data = await res.json();
    if (data.status !== 'OK') return [];

    const now = Date.now();
    return data.result
      .filter(c => c.phase === 'BEFORE' || c.phase === 'CODING')
      .map(c => {
        const startTime = c.startTimeSeconds * 1000;
        const endTime = startTime + (c.durationSeconds * 1000);
        const isLive = c.phase === 'CODING' || (now >= startTime && now <= endTime);
        return {
          id: `cf_${c.id}`,
          event: c.name,
          platform: 'Codeforces',
          host: 'codeforces.com',
          href: `https://codeforces.com/contest/${c.id}`,
          start: new Date(startTime).toISOString(),
          end: new Date(endTime).toISOString(),
          duration: c.durationSeconds,
          status: isLive ? 'LIVE' : 'UPCOMING'
        };
      });
  } catch (err) {
    console.warn('[ContestTracker] Codeforces fetch failed:', err.message);
    return [];
  }
}

async function fetchLeetCode() {
  try {
    const res = await fetch('https://leetcode.com/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operationName: 'topTwoContests',
        query: 'query topTwoContests { topTwoContests { title titleSlug startTime duration originStartTime } }'
      })
    });
    const data = await res.json();
    const contests = data.data?.topTwoContests || [];
    const now = Date.now();

    return contests.map(c => {
      const startTime = c.startTime * 1000;
      const endTime = startTime + (c.duration * 1000);
      const isLive = now >= startTime && now <= endTime;
      return {
        id: `lc_${c.titleSlug}`,
        event: c.title,
        platform: 'LeetCode',
        host: 'leetcode.com',
        href: `https://leetcode.com/contest/${c.titleSlug}`,
        start: new Date(startTime).toISOString(),
        end: new Date(endTime).toISOString(),
        duration: c.duration,
        status: isLive ? 'LIVE' : 'UPCOMING'
      };
    });
  } catch (err) {
    console.warn('[ContestTracker] LeetCode fetch failed:', err.message);
    return [];
  }
}

async function fetchCodeChef() {
  try {
    const res = await fetch('https://www.codechef.com/api/list/contests/all');
    const data = await res.json();
    const contests = [];
    const now = Date.now();

    // Present (live) contests
    if (Array.isArray(data.present_contests)) {
      for (const c of data.present_contests) {
        if (!c.contest_code || c.contest_code === 'PRACTICE') continue;
        const start = new Date(c.contest_start_date_iso || c.contest_start_date).getTime();
        const end = new Date(c.contest_end_date_iso || c.contest_end_date).getTime();
        contests.push({
          id: `cc_${c.contest_code}`,
          event: c.contest_name,
          platform: 'CodeChef',
          host: 'codechef.com',
          href: `https://www.codechef.com/${c.contest_code}`,
          start: new Date(start).toISOString(),
          end: new Date(end).toISOString(),
          duration: Math.max(0, Math.round((end - start) / 1000)),
          status: 'LIVE'
        });
      }
    }

    // Future (upcoming) contests
    if (Array.isArray(data.future_contests)) {
      for (const c of data.future_contests) {
        const start = new Date(c.contest_start_date_iso || c.contest_start_date).getTime();
        const end = new Date(c.contest_end_date_iso || c.contest_end_date).getTime();
        const isLive = now >= start && now <= end;
        contests.push({
          id: `cc_${c.contest_code}`,
          event: c.contest_name,
          platform: 'CodeChef',
          host: 'codechef.com',
          href: `https://www.codechef.com/${c.contest_code}`,
          start: new Date(start).toISOString(),
          end: new Date(end).toISOString(),
          duration: Math.max(0, Math.round((end - start) / 1000)),
          status: isLive ? 'LIVE' : 'UPCOMING'
        });
      }
    }

    return contests;
  } catch (err) {
    console.warn('[ContestTracker] CodeChef fetch failed:', err.message);
    return [];
  }
}

async function fetchAtCoder() {
  try {
    const res = await fetch('https://atcoder.jp/contests/');
    const html = await res.text();
    const match = html.match(/<div id="contest-table-upcoming">([\s\S]*?)<\/tbody>/);
    if (!match) return [];

    const rows = match[1].match(/<tr>([\s\S]*?)<\/tr>/g) || [];
    const contests = [];
    const now = Date.now();

    for (const row of rows) {
      const timeMatch = row.match(/<time class='[^']*'>([^<]+)<\/time>/);
      const linkMatch = row.match(/<a href="(\/contests\/[^"]+)">([^<]+)<\/a>/);
      const durMatch = row.match(/<td class="text-center">(\d{2}):(\d{2})<\/td>/);

      if (timeMatch && linkMatch) {
        const startStr = timeMatch[1].trim();
        const start = new Date(startStr).getTime();
        if (isNaN(start)) continue;

        let durationSeconds = 7200;
        if (durMatch) {
          const hours = parseInt(durMatch[1], 10);
          const mins = parseInt(durMatch[2], 10);
          durationSeconds = (hours * 3600) + (mins * 60);
        }

        const end = start + (durationSeconds * 1000);
        const contestPath = linkMatch[1];
        const title = linkMatch[2].trim();
        const isLive = now >= start && now <= end;

        contests.push({
          id: `ac_${contestPath.replace('/contests/', '')}`,
          event: title,
          platform: 'AtCoder',
          host: 'atcoder.jp',
          href: `https://atcoder.jp${contestPath}`,
          start: new Date(start).toISOString(),
          end: new Date(end).toISOString(),
          duration: durationSeconds,
          status: isLive ? 'LIVE' : 'UPCOMING'
        });
      }
    }
    return contests;
  } catch (err) {
    console.warn('[ContestTracker] AtCoder fetch failed:', err.message);
    return [];
  }
}

async function fetchClist(username, apiKey) {
  if (!username || !apiKey) return [];
  try {
    const nowIso = new Date().toISOString();
    const url = `https://clist.by/api/v4/contest/?username=${encodeURIComponent(username)}&api_key=${encodeURIComponent(apiKey)}&upcoming=true&order_by=start&limit=50`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[ContestTracker] CLIST returned HTTP ${res.status}`);
      return [];
    }
    const data = await res.json();
    if (!Array.isArray(data.objects)) return [];

    const now = Date.now();
    return data.objects.map(c => {
      const start = new Date(c.start + 'Z').getTime();
      const end = new Date(c.end + 'Z').getTime();
      const isLive = now >= start && now <= end;

      // Map platform friendly name
      let platform = 'Other';
      const host = (c.resource || c.host || '').toLowerCase();
      if (host.includes('codeforces')) platform = 'Codeforces';
      else if (host.includes('leetcode')) platform = 'LeetCode';
      else if (host.includes('codechef')) platform = 'CodeChef';
      else if (host.includes('atcoder')) platform = 'AtCoder';
      else if (host.includes('hackerrank')) platform = 'HackerRank';
      else if (host.includes('topcoder')) platform = 'TopCoder';
      else if (host.includes('kaggle')) platform = 'Kaggle';
      else if (host.includes('geeksforgeeks')) platform = 'GeeksforGeeks';
      else platform = c.resource || c.host || 'Coding Contest';

      return {
        id: `clist_${c.id}`,
        event: c.event,
        platform: platform,
        host: c.host || c.resource || '',
        href: c.href,
        start: new Date(start).toISOString(),
        end: new Date(end).toISOString(),
        duration: c.duration || Math.round((end - start) / 1000),
        status: isLive ? 'LIVE' : 'UPCOMING'
      };
    });
  } catch (err) {
    console.warn('[ContestTracker] CLIST fetch failed:', err.message);
    return [];
  }
}

// -------------------------------------------------------------
// 5. Aggregate, Deduplicate, Store & Schedule
// -------------------------------------------------------------

async function fetchAndSyncContests() {
  try {
    console.log('[ContestTracker] Syncing contests...');
    const settings = await chrome.storage.local.get([
      'clistUsername',
      'clistApiKey',
      'reminderMinutes',
      'enabledPlatforms'
    ]);

    const fetchPromises = [
      fetchCodeforces(),
      fetchLeetCode(),
      fetchCodeChef(),
      fetchAtCoder()
    ];

    if (settings.clistUsername && settings.clistApiKey) {
      fetchPromises.push(fetchClist(settings.clistUsername, settings.clistApiKey));
    }

    const settled = await Promise.allSettled(fetchPromises);
    let allContests = [];

    settled.forEach(res => {
      if (res.status === 'fulfilled' && Array.isArray(res.value)) {
        allContests.push(...res.value);
      }
    });

    // Deduplicate contests (by link or normalized event name)
    const seen = new Set();
    const uniqueContests = [];
    const now = Date.now();

    for (const contest of allContests) {
      // Ignore contests that already ended
      const endTime = new Date(contest.end).getTime();
      if (endTime < now) continue;

      // Normalization key
      const normKey = (contest.href || contest.event).toLowerCase().trim();
      if (seen.has(normKey)) continue;
      seen.add(normKey);
      uniqueContests.push(contest);
    }

    // Sort: LIVE first, then soonest UPCOMING
    uniqueContests.sort((a, b) => {
      if (a.status === 'LIVE' && b.status !== 'LIVE') return -1;
      if (b.status === 'LIVE' && a.status !== 'LIVE') return 1;
      return new Date(a.start).getTime() - new Date(b.start).getTime();
    });

    // Save to storage
    await chrome.storage.local.set({
      contests: uniqueContests,
      lastUpdated: Date.now(),
      syncStatus: 'success'
    });

    // Update Extension Badge
    updateBadge(uniqueContests);

    // Schedule Reminders
    await scheduleAlarms(uniqueContests, settings.reminderMinutes || 30);

    console.log(`[ContestTracker] Successfully synced ${uniqueContests.length} contests.`);
    return uniqueContests;
  } catch (err) {
    console.error('[ContestTracker] fetchAndSyncContests failed:', err);
    await chrome.storage.local.set({ syncStatus: 'error', syncError: err.message });
    return [];
  }
}

// -------------------------------------------------------------
// 6. Badge & Alarm Scheduling Utilities
// -------------------------------------------------------------

function updateBadge(contests) {
  const now = Date.now();
  const next24h = now + (24 * 60 * 60 * 1000);

  const liveCount = contests.filter(c => c.status === 'LIVE').length;
  const upcomingTodayCount = contests.filter(c => {
    const s = new Date(c.start).getTime();
    return c.status !== 'LIVE' && s >= now && s <= next24h;
  }).length;

  if (liveCount > 0) {
    chrome.action.setBadgeText({ text: String(liveCount) });
    chrome.action.setBadgeBackgroundColor({ color: '#d71920' }); // Nothing Red for Live
    chrome.action.setTitle({ title: `${liveCount} contest(s) live right now!` });
  } else if (upcomingTodayCount > 0) {
    chrome.action.setBadgeText({ text: String(upcomingTodayCount) });
    chrome.action.setBadgeBackgroundColor({ color: '#222222' }); // Monochrome Slate for Upcoming Today
    chrome.action.setTitle({ title: `${upcomingTodayCount} contest(s) starting within 24 hours.` });
  } else {
    chrome.action.setBadgeText({ text: '' });
    chrome.action.setTitle({ title: 'Coding Contest Tracker' });
  }
}

async function scheduleAlarms(contests, reminderMinutes) {
  try {
    const existingAlarms = await chrome.alarms.getAll();
    for (const alarm of existingAlarms) {
      if (alarm.name.startsWith('notify_')) {
        await chrome.alarms.clear(alarm.name);
      }
    }

    const now = Date.now();
    const reminderMs = reminderMinutes * 60 * 1000;

    for (const contest of contests) {
      if (contest.status === 'LIVE') continue;

      const startTime = new Date(contest.start).getTime();
      const notifyTime = startTime - reminderMs;

      // Only schedule if notify time is in the future
      if (notifyTime > now) {
        const alarmName = `notify_${contest.id}`;
        await chrome.alarms.create(alarmName, { when: notifyTime });

        // Save contest metadata for alarm handler
        await chrome.storage.local.set({
          [`meta_${contest.id}`]: {
            event: contest.event,
            platform: contest.platform,
            href: contest.href,
            start: contest.start,
            end: contest.end
          }
        });
      }
    }
  } catch (err) {
    console.error('[ContestTracker] scheduleAlarms failed:', err);
  }
}

function buildGoogleCalendarUrl(title, startIso, endIso, href) {
  function formatGCal(iso) {
    return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  }
  const dates = `${formatGCal(startIso)}/${formatGCal(endIso)}`;
  const details = `Coding Contest\nContest Link: ${href}\n\nTracked via Coding Contest Tracker`;
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${dates}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(href)}`;
}

// -------------------------------------------------------------
// 7. Message Bus for Popup Communication
// -------------------------------------------------------------

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'FETCH_CONTESTS') {
    (async () => {
      const contests = await fetchAndSyncContests();
      const { lastUpdated } = await chrome.storage.local.get('lastUpdated');
      sendResponse({ success: true, contests, lastUpdated });
    })();
    return true; // Keep message channel open for async response
  }

  if (request.action === 'RESCHEDULE_REMINDERS') {
    (async () => {
      const { contests = [], reminderMinutes = 30 } = await chrome.storage.local.get(['contests', 'reminderMinutes']);
      await scheduleAlarms(contests, reminderMinutes);
      sendResponse({ success: true });
    })();
    return true;
  }

  if (request.action === 'TEST_NOTIFICATION') {
    chrome.notifications.create(`test_notif_${Date.now()}`, {
      type: 'basic',
      iconUrl: 'icons/icon-48.png',
      title: 'Contest Tracker: Test Notification',
      message: 'Desktop notifications are working perfectly! You will never miss a contest.',
      priority: 2
    });
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'TEST_CLIST') {
    (async () => {
      try {
        const contests = await fetchClist(request.username, request.apiKey);
        if (contests && contests.length > 0) {
          sendResponse({ success: true, count: contests.length });
        } else {
          sendResponse({ success: false, error: 'No contests returned or invalid credentials.' });
        }
      } catch (e) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }
});