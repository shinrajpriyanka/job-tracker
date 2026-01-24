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

## Supported Job Sites
The extension auto-fills job details from these sites:
### United Kingdom
- [LinkedIn](https://www.linkedin.com)
- [Indeed UK](https://www.indeed.co.uk)
- [TotalJobs](https://www.totaljobs.com)
- [Reed](https://www.reed.co.uk)
- [CWJobs](https://www.cwjobs.co.uk)
- [Jobsite](https://www.jobsite.co.uk)
- [Fish4Jobs](https://www.fish4.co.uk)
- [Adzuna UK](https://www.adzuna.co.uk)
### Germany
- [Indeed Germany](https://www.indeed.de)
- [StepStone](https://www.stepstone.de)
- [Monster Germany](https://www.monster.de)
- [XING](https://www.xing.com)
- [Jobware](https://www.jobware.de)
- [Karriere.de](https://www.karriere.de)  
- [JobsInTown](https://www.jobsintown.de)
### Ireland
- [Indeed Ireland](https://www.indeed.ie)
- [Monster Ireland](https://www.monster.ie)
- [Careerjet Ireland](https://www.careerjet.ie)
- [JobsIreland](https://www.jobsireland.ie)
- [RecruitIreland](https://www.recruitireland.com)
### European Union
- [EU EURES](https://ec.europa.eu)
## Troubleshooting
### Auto-fill not working
1. Ensure you're on a supported job site (see list above)
2. Make sure you've logged in with a username in the extension
3. Refresh the job posting page
4. Check that you're on an actual job posting, not the search page
### Jobs not saving
- Ensure you've logged in with a username
- Check that required fields (Company Name, Job Title, Job Link) are filled
- Check browser console for errors (F12)
### Data disappeared
- Data is stored per username - make sure you're logged in with the correct username
- Data is stored in browser's IndexedDB - clearing browser data will delete it
- Export your jobs regularly as backup
### Export to Excel not working
- Ensure you have at least one saved job
- Try exporting a single page first before "Export All"
- Check browser's download settings/permissions

