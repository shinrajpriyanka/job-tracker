# Job Tracker Extension

A local-first Chrome extension to track your job applications efficiently. Keep all your application details in one place, stored securely in your browser.

## Features

- **One-Click Tracking**: Automatically extracts job details (Company, Title, Link) from popular job boards.
- **Local Storage**: All data is stored in your browser's IndexedDB. No external servers or tracking.
- **Management**: Search, filter, and edit your saved applications.
- **Export**: Export your job list to Excel for backup or analysis.
- **Themes**: Switch between Light, Dark, and High Contrast modes.
- **Offline Capable**: Works without an internet connection (except for initial page parsing).

## Installation

1. Clone or download this repository.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable "Developer mode" in the top right.
4. Click "Load unpacked" and select the extension directory.

## Usage

1. **Navigate** to a job posting on sites like LinkedIn, Indeed, etc.
2. **Open** the Job Tracker popup.
3. The form will **auto-fill** with available details.
4. Click **Save** to add it to your list.
5. Use the **Saved jobs** section to view, search, or export your history.

## Privacy

This extension prioritizes your privacy. See [PRIVACY.md](PRIVACY.md) for details.
