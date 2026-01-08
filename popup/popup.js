import {
  addOrUpdateJob,
  getJobsByUser,
  deleteJob,
  clearJobsForUser,
  saveSetting,
  getSetting,
  saveUser,
  getUser
} from '../db/indexeddb.js';

let currentUser = null;
let displayLimit = 10;
let inMemoryRows = [];
let isManualNew = false;

document.addEventListener('DOMContentLoaded', () => {
  const themeInputs = document.querySelectorAll('input[name="theme"]');

  const applyTheme = (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
  };

  // initialize from storage (default to light)
  const stored = localStorage.getItem('theme') || 'light';
  applyTheme(stored);
  const initial = Array.from(themeInputs).find(i => i.value === stored);
  if (initial) initial.checked = true;

  // listen for changes
  themeInputs.forEach(input => {
    input.addEventListener('change', (e) => {
      if (e.target.checked) {
        applyTheme(e.target.value);
        localStorage.setItem('theme', e.target.value);
      }
    });
  });
});
async function initTheme() {
  const saved = await getSetting('theme');
  const theme = saved || 'light';
  document.documentElement.setAttribute('data-theme', theme);
  //document.getElementById('themeSelect').value = theme;
}

async function initLimit() {
  const saved = await getSetting('displayLimit');
  displayLimit = saved || 10;
  document.getElementById('limitSelect').value = String(displayLimit);
}

async function initLogin() {
  const savedUser = await getSetting('currentUser');
  if (savedUser) {
    const userObj = await getUser(savedUser);
    if (userObj) {
      currentUser = userObj.username;
      document.getElementById('usernameInput').value = currentUser;
      setLoginStatus(`Logged in as ${currentUser}`);
      await refreshJobs();
    }
  }
}

function setLoginStatus(msg) {
  document.getElementById('loginStatus').textContent = msg;
}

async function onLogin() {
  const username = document.getElementById('usernameInput').value.trim();
  if (!username) {
    setLoginStatus('Enter a username to login.');
    return;
  }
  await saveUser({ username });
  await saveSetting('currentUser', username);
  currentUser = username;
  setLoginStatus(`Logged in as ${currentUser}`);
  await refreshJobs();
}

// inside loadPageDefaults()
async function loadPageDefaults() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_JOB_DATA' });
    if (response?.ok && response.data) {
      fillForm(response.data);
    } else {
      fillForm(defaultForm(tab.url));
    }
  } catch {
    fillForm(defaultForm(tab?.url || ''));
  }
}


function defaultForm(url) {
  return {
    applicationDate: new Date().toISOString().slice(0, 10),
    countryName: '',
    companyName: '',
    recruiter: '',
    jobTitle: document.title || '',
    jobLink: url || '',
    status: 'Applied',
    responseRemarks: ''
  };
}

function fillForm(data) {
  document.getElementById('applicationDate').value = data.applicationDate || new Date().toISOString().slice(0, 10);
  document.getElementById('countryName').value = data.countryName || '';
  document.getElementById('companyName').value = data.companyName || '';
  document.getElementById('recruiter').value = data.recruiter || '';
  document.getElementById('jobTitle').value = data.jobTitle || '';
  document.getElementById('jobLink').value = data.jobLink || '';
  document.getElementById('status').value = data.status || 'Applied';
  document.getElementById('responseRemarks').value = data.responseRemarks || '';
}

function onManualNew() {
  isManualNew = true;
  document.getElementById('jobId').value = '';
  fillForm({
    applicationDate: new Date().toISOString().slice(0, 10),
    countryName: '',
    companyName: '',
    recruiter: '',
    jobTitle: '',
    jobLink: '',
    status: 'Applied',
    responseRemarks: ''
  });
}

async function onSave(e) {
  e.preventDefault();
  if (!currentUser) {
    setLoginStatus('Please login before saving.');
    return;
  }
  const job = formToJob();
  job.user = currentUser;

  const saved = await addOrUpdateJob(job);
  upsertInMemory(saved);

  const todays = (await getJobsByUser(currentUser)).filter(j => j.applicationDate === job.applicationDate);
  if (todays.length > 10) {
    toast('🎉 Hurray! You’ve applied to more than 10 jobs today. Keep pushing forward!', 'success');
  }
  enforceLimit();
  await refreshJobs();
}

function formToJob() {
  const job = {
    applicationDate: document.getElementById('applicationDate').value,
    countryName: document.getElementById('countryName').value,
    companyName: document.getElementById('companyName').value,
    recruiter: document.getElementById('recruiter').value,
    jobTitle: document.getElementById('jobTitle').value,
    jobLink: document.getElementById('jobLink').value,
    status: document.getElementById('status').value,
    responseRemarks: document.getElementById('responseRemarks').value
  };
  // Include job ID if editing an existing job
  const jobId = document.getElementById('jobId').value;
  if (jobId) {
    job.id = jobId;
  }
  return job;
}

function upsertInMemory(job) {
  const idx = inMemoryRows.findIndex(r => r.id === job.id);
  if (idx >= 0) inMemoryRows[idx] = job;
  else inMemoryRows.unshift(job);
}

async function refreshJobs() {
  if (!currentUser) return;
  const jobs = await getJobsByUser(currentUser);
  inMemoryRows = jobs.sort((a, b) => {
    // Prefer recently updated records first
    const aUpdated = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const bUpdated = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    if (bUpdated !== aUpdated) return bUpdated - aUpdated;
    // Fallback to applicationDate descending
    return new Date(b.applicationDate).getTime() - new Date(a.applicationDate).getTime();
  });
  renderTable();
}

function renderTable() {
  const tbody = document.getElementById('jobsTbody');
  const emptyState = document.getElementById('emptyState');
  const emptyStateSaveOptions = document.getElementById('save-options');
  const emptyStateSearch = document.getElementById('table-search');
  tbody.innerHTML = '';
  const filtered = filterRows(inMemoryRows);
  const rowsToShow = filtered; // show all persisted rows

  rowsToShow.forEach((row, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${escapeHtml(row.applicationDate)}</td>
      <td>${escapeHtml(row.countryName)}</td>
      <td>${escapeHtml(row.companyName)}</td>
      <td>${escapeHtml(row.recruiter)}</td>
      <td>${escapeHtml(row.jobTitle)}</td>
      <td><a href="${escapeAttr(row.jobLink)}" target="_blank" rel="noopener noreferrer">Link</a></td>
      <td>${escapeHtml(row.status)}</td>
      <td>${escapeHtml(row.responseRemarks)}</td>
      <td>
        <button class="btn" data-action="edit" data-id="${row.id}">Edit</button>
        <button class="btn btn-danger" data-action="delete" data-id="${row.id}">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  emptyState.style.display = rowsToShow.length ? 'none' : 'block';
  emptyStateSaveOptions.style.display = rowsToShow.length ? 'block' : 'none';
  emptyStateSearch.style.display = rowsToShow.length ? 'block' : 'none';

  tbody.querySelectorAll('button[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', () => onEdit(btn.dataset.id));
  });
  tbody.querySelectorAll('button[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', () => onDelete(btn.dataset.id));
  });

  // remove limit/prompt handling (no UI cap)
}

function filterRows(rows) {
  const q = document.getElementById('searchInput').value.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter(r => {
    const tokens = [
      r.companyName, r.jobTitle, r.status, r.countryName, r.responseRemarks, r.recruiter, r.jobLink
    ].map(x => (x || '').toLowerCase());
    return tokens.some(t => t.includes(q));
  });
}

function onSearch() {
  renderTable();
}

function enforceLimit() {
  // UI-only limit; data is persisted by default.
}

async function onEdit(id) {
  const row = inMemoryRows.find(r => r.id === id);
  if (!row) return;
  document.getElementById('jobId').value = id;
  fillForm(row);
}

async function onDelete(id) {
  await deleteJob(id);
  await refreshJobs();
}

async function onClearAll() {
  if (!currentUser) {
    setLoginStatus('Please login to clear.');
    return;
  }

  // Prompt user for confirmation
  const confirmed = confirm(`Are you sure you want to clear all jobs for ${currentUser}? This will export them to Excel first.`);
  if (!confirmed) {
    return;
  }

  try {
    // Check if SheetJS library is available
    if (typeof XLSX === 'undefined') {
      toast('Excel export library not loaded. Cannot backup before clearing.', 'error');
      return;
    }

    // Get jobs for current user
    const jobs = await getJobsByUser(currentUser);

    if (jobs.length > 0) {
      // Sort jobs by application date
      jobs.sort((a, b) => new Date(a.applicationDate) - new Date(b.applicationDate));

      // Prepare data for Excel
      const excelData = jobs.map((job, index) => ({
        'Sr. No': index + 1,
        'Application Date': job.applicationDate || '',
        'Country Name': job.countryName || '',
        'Company Name': job.companyName || '',
        'Recruiter Email & Phone': job.recruiter || '',
        'Job Title': job.jobTitle || '',
        'Job Portal/Company Website/Link': job.jobLink || '',
        'Status': job.status || '',
        'Response Remarks': job.responseRemarks || ''
      }));

      // Create workbook and worksheet
      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Jobs');

      // Generate filename with current date and timestamp
      const filename = `jobs-backup-${currentUser}-${new Date().toISOString().slice(0, 10)}.xlsx`;

      // Write Excel file
      XLSX.writeFile(workbook, filename);
      toast('Backup exported to Excel.', 'success');
    }

    // Clear all jobs for the user
    await clearJobsForUser(currentUser);
    await refreshJobs();
    //toast('All data cleared.', 'success');
  } catch (err) {
    console.error('Clear all error:', err);
    toast('Error clearing data.', 'error');
  }
}

async function onExport() {
  if (!currentUser) {
    toast('Please login to export.', 'error');
    return;
  }

  try {
    // Check if SheetJS library is available
    if (typeof XLSX === 'undefined') {
      toast('Excel export library not loaded. Please refresh and try again.', 'error');
      console.error('XLSX library not available');
      return;
    }

    // Get jobs for current user
    const jobs = await getJobsByUser(currentUser);

    if (jobs.length === 0) {
      toast('No jobs to export.', 'error');
      return;
    }

    // Sort jobs by application date
    jobs.sort((a, b) => new Date(a.applicationDate) - new Date(b.applicationDate));

    // Prepare data for Excel
    const excelData = jobs.map((job, index) => ({
      'Sr. No': index + 1,
      'Application Date': job.applicationDate || '',
      'Country Name': job.countryName || '',
      'Company Name': job.companyName || '',
      'Recruiter Email & Phone': job.recruiter || '',
      'Job Title': job.jobTitle || '',
      'Job Portal/Company Website/Link': job.jobLink || '',
      'Status': job.status || '',
      'Response Remarks': job.responseRemarks || ''
    }));

    // Create workbook and worksheet
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Jobs');

    // Generate filename with current date
    const filename = `jobs-${currentUser}-${new Date().toISOString().slice(0, 10)}.xlsx`;

    // Write Excel file
    XLSX.writeFile(workbook, filename);

    toast('Excel file exported successfully!', 'success');
  } catch (err) {
    console.error('Export error:', err);
    toast('Error exporting to Excel.', 'error');
  }
}

function toast(msg, kind = 'success') {
  const p = document.createElement('div');
  p.className = `toast ${kind === 'success' ? 'toast-success' : ''}`;
  p.textContent = msg;
  document.body.appendChild(p);
  setTimeout(() => p.remove(), 2500);
}

// Feedback form handlers
function openFeedbackForm() {
  const modal = document.getElementById('feedbackModal');
  if (!modal) return;
  // Prefill name/email if logged in
  const nameInput = document.getElementById('feedbackName');
  const emailInput = document.getElementById('feedbackEmail');
  if (currentUser) {
    nameInput.value = currentUser;
  }
  emailInput.value = '';
  document.getElementById('feedbackDesc').value = '';
  modal.style.display = 'flex';
}

function closeFeedbackForm() {
  const modal = document.getElementById('feedbackModal');
  if (!modal) return;
  modal.style.display = 'none';
}

function validateEmail(e) {
  return /\S+@\S+\.\S+/.test(e || '');
}

function sendFeedbackViaMailto() {
  const name = (document.getElementById('feedbackName').value || '').trim();
  const email = (document.getElementById('feedbackEmail').value || '').trim();
  const desc = (document.getElementById('feedbackDesc').value || '').trim();
  if (!desc) {
    toast('Please enter a description for the issue or feedback.', 'error');
    return;
  }
  if (email && !validateEmail(email)) {
    toast('Please enter a valid email address or leave blank.', 'error');
    return;
  }
  const subject = encodeURIComponent('Job Tracker Feedback');
  const bodyParts = [];
  if (name) bodyParts.push(`Name: ${name}`);
  if (email) bodyParts.push(`Email: ${email}`);
  bodyParts.push(`User: ${currentUser || '(not logged in)'}`);
  bodyParts.push('');
  bodyParts.push(desc);
  bodyParts.push('');
  bodyParts.push(`App: Job Tracker`);
  const body = encodeURIComponent(bodyParts.join('\n'));
  // Change recipient to your support address if desired
  const recipient = 'pm837389@gmail.com';
  const mailto = `mailto:${recipient}?subject=${subject}&body=${body}`;
  // Open user's mail client
  window.location.href = mailto;
  closeFeedbackForm();
}

function escapeHtml(s) {
  return (s || '').toString().replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
function escapeAttr(s) {
  return (s || '').toString().replace(/"/g, '&quot;');
}

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize theme
  await initTheme();
  
  // Initialize login
  await initLogin();
  
  // Login button
  document.getElementById('loginBtn').addEventListener('click', onLogin);
  
  // Manual new button
  document.getElementById('manualNewBtn').addEventListener('click', onManualNew);
  
  // Track button
  document.getElementById('trackBtn').addEventListener('click', onTrackAdd);
  
  // Export button
  document.getElementById('exportBtn').addEventListener('click', onExport);
  
  // Clear all button
  document.getElementById('clearAllBtn').addEventListener('click', onClearAll);

  // Feedback link / modal handlers
  const feedbackLink = document.getElementById('feedbackLink');
  if (feedbackLink) feedbackLink.addEventListener('click', (e) => { e.preventDefault(); openFeedbackForm(); });
  const feedbackCancel = document.getElementById('feedbackCancel');
  if (feedbackCancel) feedbackCancel.addEventListener('click', (e) => { e.preventDefault(); closeFeedbackForm(); });
  const feedbackSend = document.getElementById('feedbackSend');
  if (feedbackSend) feedbackSend.addEventListener('click', (e) => { e.preventDefault(); sendFeedbackViaMailto(); });
  
  // Search input
  document.getElementById('searchInput').addEventListener('input', onSearch);
  
  // Load page defaults
  await loadPageDefaults();
});

async function onTrackAdd() {
  if (!currentUser) {
    setLoginStatus('Please login before tracking.');
    return;
  }
  
  const formData = formToJob();
  const isEditing = !!formData.id;
  
  // If isManualNew flag is set, create a new job without parsing page data or checking duplicates
  if (isManualNew) {
    const job = {
      applicationDate: formData.applicationDate,
      countryName: formData.countryName,
      companyName: formData.companyName,
      recruiter: formData.recruiter,
      jobTitle: formData.jobTitle,
      jobLink: formData.jobLink,
      status: formData.status,
      responseRemarks: formData.responseRemarks,
      user: currentUser
      // Note: no job.id, so addOrUpdateJob will always create a new record
    };
    
    // Validate required fields
    if (!job.companyName || !job.jobTitle || !job.jobLink) {
      toast('Please fill in Company Name, Job Title, and Job Link.', 'error');
      return;
    }
    
    const saved = await addOrUpdateJob(job);
    upsertInMemory(saved);
    await refreshJobs();
    toast('New job added successfully!', 'success');
    
    // Reset flag and form
    isManualNew = false;
    document.getElementById('jobId').value = '';
    fillForm(defaultForm(''));
    return;
  }
  
  // Original logic: parse page data and check for duplicates
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let parsedData = {};
  
  // Try to get parsed data from the page
  if (tab?.id) {
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_JOB_DATA' });
      if (response?.ok && response.data) {
        parsedData = response.data;
      }
    } catch (err) {
      // Page parsing failed, will use manual form data
    }
  }
  
  // If editing, use form data; if new entry, merge with parsed data
  const job = isEditing ? {
    id: formData.id,
    applicationDate: formData.applicationDate,
    countryName: formData.countryName,
    companyName: formData.companyName,
    recruiter: formData.recruiter,
    jobTitle: formData.jobTitle,
    jobLink: formData.jobLink,
    status: formData.status,
    responseRemarks: formData.responseRemarks,
    user: currentUser
  } : {
    // New entry: merge parsed data with form data (parsed takes priority)
    applicationDate: parsedData.applicationDate || formData.applicationDate,
    countryName: parsedData.countryName || formData.countryName,
    companyName: parsedData.companyName || formData.companyName,
    recruiter: parsedData.recruiter || formData.recruiter,
    jobTitle: parsedData.jobTitle || formData.jobTitle,
    jobLink: parsedData.jobLink || formData.jobLink,
    status: parsedData.status || formData.status,
    responseRemarks: parsedData.responseRemarks || formData.responseRemarks,
    user: currentUser
  };
  
  // Preserve job ID if editing an existing job
  if (formData.id) {
    job.id = formData.id;
  }
  
  // Validate required fields
  if (!job.companyName || !job.jobTitle || !job.jobLink) {
    toast('Please fill in Company Name, Job Title, and Job Link.', 'error');
    return;
  }
  
  const saved = await addOrUpdateJob(job);
  upsertInMemory(saved);
  await refreshJobs();
  toast('Job added successfully!', 'success');
  document.getElementById('jobId').value = '';
  fillForm(defaultForm(job.jobLink)); // Clear form for next entry
}


