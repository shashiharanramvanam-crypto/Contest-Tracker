# 🏆 Coding Contest Tracker

> **Never miss another coding round or hackathon.** Track live and upcoming competitions from **LeetCode**, **Codeforces**, **CodeChef**, **AtCoder**, and **100+ platforms** with instant Google Calendar sync and customizable desktop alarms.

[![Manifest V3](https://img.shields.io/badge/Manifest-V3-brightgreen.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Browsers](https://img.shields.io/badge/Browsers-Chrome%20|%20Edge%20|%20Brave%20|%20Opera-blue.svg)](#-how-to-install-in-your-browser)
[![Zero Config](https://img.shields.io/badge/Setup-Zero--Config%20Required-orange.svg)](#-features)
[![Privacy Friendly](https://img.shields.io/badge/Privacy-100%25%20Local%20%26%20Private-success.svg)](#-privacy--security)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 📸 Preview

<img width="548" height="738" alt="Screenshot 2026-10-17 173652" src="https://github.com/user-attachments/assets/55c322c8-4d9c-4983-aff1-db043513bb88" />


---

## ✨ Features

- **⚡ Zero Setup Required**: Automatically fetches public contests from **LeetCode**, **Codeforces**, **CodeChef**, and **AtCoder** right out of the box with zero API keys or logins required.
- **🌐 100+ Platforms via CLIST.by**: Optional free integration with CLIST.by to track HackerRank, Kaggle, TopCoder, Meta Hacker Cup, Google competitions, and university contests.
- **📅 1-Click Google Calendar Sync**: Export any contest directly to your Google Calendar with pre-filled title, localized start/end times, and direct contest URLs.
- **🔔 Smart Desktop Alarms**: Configurable notifications alert you 10, 15, 30, 60, or 120 minutes before a round kicks off. Click the notification to jump straight to the contest!
- **🔴 Live Round Indicator**: Real-time pulsing badge and live countdown timers for competitions happening right now.
- **⭐ Star & Bookmark Contests**: Pin priority competitions to your dedicated Starred tab to easily plan your weekend schedule.
- **🔍 Instant Search & Filter**: Real-time search bar and platform filter chips (*Codeforces, LeetCode, CodeChef, AtCoder, Others*).
- **🔢 Active Toolbar Badge**: Browser icon badge displays live contest count and contests scheduled within the next 24 hours.
- **🖤 Sleek Nothing OS Aesthetic**: AMOLED true black theme (`#000000`), monospace typography, high-contrast badges, and smooth animations.

---

## 🚀 How to Install in Your Browser

You can install this extension directly in any Chromium-based browser (**Google Chrome**, **Microsoft Edge**, **Brave**, **Opera**, **Vivaldi**) in under 60 seconds.

### Step 1: Clone or Download the Code

Open your terminal and clone the repository:

```bash
git clone https://github.com/shashiharanramvanam-crypto/coding-contest-tracker.git
```

*(Alternatively, click **Code > Download ZIP** on GitHub and extract the folder to your computer).*

---

### Step 2: Load Unpacked in Your Browser

#### 🌐 Google Chrome & Brave:
1. Open your browser and navigate to `chrome://extensions` (or `brave://extensions`).
2. Toggle on **Developer mode** in the top-right corner.
3. Click the **Load unpacked** button in the top-left corner.
4. Select the `coding-contest-tracker` project folder (the folder containing `manifest.json`).
5. Click the **Puzzle icon** in your browser toolbar and **pin 📌** Coding Contest Tracker.

#### 🌊 Microsoft Edge:
1. Open Microsoft Edge and navigate to `edge://extensions`.
2. Turn on the **Developer mode** toggle in the left sidebar.
3. Click **Load unpacked**.
4. Select the `coding-contest-tracker` project folder.
5. Click the **Extensions icon** on the address bar and pin the extension.

#### 🔴 Opera / Opera GX:
1. Navigate to `opera://extensions`.
2. Toggle **Developer mode** in the top right.
3. Click **Load unpacked extension** and choose the folder.

---

## 🛠️ How to Use

1. **View Contests**: Click the extension icon in your browser toolbar to open the popup.
2. **Switch Tabs**:
   - **Upcoming**: Contests starting in the future, sorted chronologically.
   - **Live Now**: Ongoing contests with live remaining time counters.
   - **Starred**: Your saved competitions.
3. **Filter**: Click platform chips (**Codeforces**, **LeetCode**, **CodeChef**, **AtCoder**) or type any keyword in the search bar.
4. **Add to Google Calendar**: Click the calendar icon on any card to open a pre-filled Google Calendar tab with exact UTC/local timestamps and contest links.
5. **Set Alarms**: Click the **Settings ⚙️** icon in the header:
   - Choose your preferred reminder timing (e.g., 30 minutes before kickoff).
   - Test your notifications using the **Send Test Notification** button.
   - (Optional) Enter your free **CLIST.by API key** to track 100+ additional platforms.

---

## 🔒 Privacy & Security

- **100% Client-Side**: All data processing and caching happens directly inside your browser.
- **Zero Tracking**: No analytics, telemetry, user tracking, or third-party tracking scripts.
- **Local Storage Only**: Starred rounds, reminder preferences, and cached contest feeds are saved locally via `chrome.storage.local`.
- **Minimal Permissions**: Uses only essential browser APIs (`alarms`, `notifications`, `storage`) to schedule reminders and save your preferences.

---

## 📂 Project Structure

```text
coding-contest-tracker/
├── manifest.json            # Manifest V3 extension configuration
├── background.js            # Background service worker (alarms, sync, notifications)
├── popup.html               # Main dashboard UI structure
├── popup.css                # Nothing OS minimalist dark theme styling
├── popup.js                 # Interactive UI logic, search, calendar sync, filters
├── icons/                   # Extension icons (16px, 32px, 48px, 128px)
├── store-assets/            # Microsoft Edge & Web Store banners, icons, screenshots
│   ├── icon-300x300.png     # Store listing logo
│   ├── promo-small-440x280.png  # Small promotional tile
│   ├── promo-large-1400x560.png # Large promotional tile
│   ├── screenshot-1-1280x800.png # Primary feature screenshot
│   └── screenshot-2-1280x800.png # Notifications & integrations screenshot
├── CHROMEWEBSTORE.md        # Store listing descriptions and justifications
├── INTEGRATION_AND_TESTING_GUIDE.md # Technical verification guide
└── README.md                # Project documentation
```

---

## 🤝 Contributing

Contributions are warmly welcome!
1. Fork the Project.
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`).
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the Branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

---

## 📄 License

Distributed under the **MIT License**. See `LICENSE` for more information.
