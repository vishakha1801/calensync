# Gym Class Calendar Sync

A Chrome extension that automatically adds DSE gym class registrations from emails (e.g., "Barre on 2/24/2025 at 5:15pm") to your Google Calendar.

## Why?

I get emails mentioning the time when registering for gym classes at my university. I often get late or miss them, so I built this to sync them to my Calendar automatically.


## Features

- Scans unread emails from `noreply+@dserec.com`.
- Parses class details and adds them as Google Calendar events.
- Marks emails as read.

## Tech Used

- **JavaScript**
- **Chrome Extension APIs**: `chrome.identity` for OAuth, service worker for background tasks.
- **Gmail API**: Fetches and modifies emails.
- **Google Calendar API**: Adds events.

## Setup

1. Clone the repo: `git clone https://github.com/your-username/gym-class-calendar-sync.git`.
2. Add a `.env` file with your OAuth Client ID:
3. Run `npm install && node build.js` to generate `manifest.json`.
4. Load the extension in Chrome (`chrome://extensions/` > Load unpacked).


