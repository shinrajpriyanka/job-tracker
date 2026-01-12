import {
  addOrUpdateJob,
  getJobsByUser,
  deleteJob,
  clearJobsForUser,
  saveSetting,
  getSetting,
  saveUser,
  getUser,
  searchJobs,
  getJob
} from '../db/indexeddb.js';

let currentUser = null;
let currentPage = 1;
const pageSize = 10;
let isManualNew = false;
let hasNextPage = false;

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
  document.getElementById('searchInput').addEventListener('input', debounce(onSearch, 300));

  // Load page defaults
  await loadPageDefaults();

  // render initial pagination controls
  renderPaginationControls();
});


function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

async function initTheme() {
  const saved = await getSetting('theme');
  const theme = saved || 'light';
  document.documentElement.setAttribute('data-theme', theme);

  const themeInputs = document.querySelectorAll('input[name="theme"]');
  const initial = Array.from(themeInputs).find(i => i.value === theme);
  if (initial) initial.checked = true;

  themeInputs.forEach(input => {
    input.addEventListener('change', (e) => {
      if (e.target.checked) {
        document.documentElement.setAttribute('data-theme', e.target.value);
        saveSetting('theme', e.target.value);
      }
    });
  });
}

async function initLogin() {
  const savedUser = await getSetting('currentUser');
  if (savedUser) {
    const userObj = await getUser(savedUser);
    if (userObj) {
      currentUser = userObj.username;
      document.getElementById('usernameInput').value = currentUser;
      setLoginStatus(`Logged in as ${currentUser}`);

      // Remove error highlight if any
      const loginBtn = document.getElementById('loginBtn');
      loginBtn.classList.remove('btn-error-pulse');

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

  // Remove error highlight
  const loginBtn = document.getElementById('loginBtn');
  loginBtn.classList.remove('btn-error-pulse');

  currentPage = 1;
  await refreshJobs();
}

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

// Helper to manage inline form errors
function showFormError(msg) {
  const el = document.getElementById('formError');
  el.textContent = msg;
  el.classList.remove('hidden');
}

function clearFormError() {
  const el = document.getElementById('formError');
  el.textContent = '';
  el.classList.add('hidden');
}

function fillForm(data) {
  clearFormError(); // Clear any previous errors when filling form
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

async function refreshJobs() {
  if (!currentUser) {
    renderTable([]);
    return;
  }

  const query = document.getElementById('searchInput').value.trim();
  const offset = (currentPage - 1) * pageSize;

  const { jobs, hasMore } = await searchJobs({
    user: currentUser,
    query,
    limit: pageSize,
    offset
  });

  hasNextPage = hasMore;
  renderTable(jobs);
  updatePaginationUI();
}

function renderTable(rows) {
  const tbody = document.getElementById('jobsTbody');
  const emptyState = document.getElementById('emptyState');
  const emptyStateSaveOptions = document.getElementById('save-options');
  const emptyStateSearch = document.getElementById('table-search');
  const emptyStateSearchValue = document.getElementById('table-search').textContent;

  tbody.innerHTML = '';

  rows.forEach((row, i) => {
    // Sr. No is global index if possible, but for pagination 1-10 is ok or (page-1)*10 + i + 1
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(row.applicationDate)}</td>
      <td>${escapeHtml(row.countryName)}</td>
      <td>${escapeHtml(row.companyName)}</td>
      <td>${escapeHtml(row.recruiter)}</td>
      <td>${escapeHtml(row.jobTitle)}</td>
      <td><a href="${escapeAttr(row.jobLink)}" target="_blank" rel="noopener noreferrer">Link</a></td>
      <td>${escapeHtml(row.status)}</td>
      <td>${escapeHtml(row.responseRemarks)}</td>
      <td>
        <button class="btn-icon-only" data-action="edit" data-id="${row.id}" title="Edit">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
        </button>
        <button class="btn-icon-only btn-danger-icon" data-action="delete" data-id="${row.id}" title="Delete">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Decide when to show empty state
  // logic: if rows are empty AND current page is 1, show empty state (of no jobs)
  // if rows are empty but page > 1, it's just a blank page (shouldn't happen with hasNextPage logic)
  const isListEmpty = rows.length === 0 && currentPage === 1;

  emptyState.style.display = (isListEmpty && !emptyStateSearchValue) ? 'block' : 'none';
  // Always show search/options if logged in, or at least if we have ever saved a job?
  // Previous logic hid them if no jobs. We'll keep them visible or follow prior:
  emptyStateSaveOptions.style.display = (isListEmpty && !emptyStateSearchValue) ? 'none' : 'block';
  emptyStateSearch.style.display = (isListEmpty && !emptyStateSearchValue) ? 'none' : 'block';

  tbody.querySelectorAll('button[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', () => onEdit(btn.dataset.id));
  });
  tbody.querySelectorAll('button[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', () => onDelete(btn.dataset.id));
  });
}

function renderPaginationControls() {
  // If not already existing, append to table section
  let paginationDiv = document.getElementById('paginationControls');
  if (!paginationDiv) {
    const tableSection = document.querySelector('.table-section');
    paginationDiv = document.createElement('div');
    paginationDiv.id = 'paginationControls';
    paginationDiv.className = 'pagination-controls';
    tableSection.appendChild(paginationDiv);
  }
}

function updatePaginationUI() {
  const div = document.getElementById('paginationControls');
  if (!div) return;

  // logic: Prev if > 1, Next if hasMore
  // Show "Page X"
  if (!currentUser || (currentPage === 1 && !hasNextPage)) {
    div.style.display = 'none';
    return;
  }
  div.style.display = 'flex';

  div.innerHTML = `
        <button id="prevPageBtn" class="btn" ${currentPage === 1 ? 'disabled' : ''}>Previous</button>
        <span class="page-info">Page ${currentPage}</span>
        <button id="nextPageBtn" class="btn" ${!hasNextPage ? 'disabled' : ''}>Next</button>
    `;

  document.getElementById('prevPageBtn').addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      refreshJobs();
    }
  });

  document.getElementById('nextPageBtn').addEventListener('click', () => {
    if (hasNextPage) {
      currentPage++;
      refreshJobs();
    }
  });
}

function onSearch() {
  currentPage = 1;
  refreshJobs();
}

async function onEdit(id) {
  const row = await getJob(id);
  if (!row) return;
  document.getElementById('jobId').value = id;
  fillForm(row);

  // Scroll to form
  document.querySelector('.current-page').scrollIntoView({ behavior: 'smooth' });
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
  const confirmed = confirm(`Are you sure you want to clear all jobs for ${currentUser}? This will export them to Excel first.`);
  if (!confirmed) return;

  try {
    if (typeof XLSX === 'undefined') {
      toast('Excel export library not loaded. Cannot backup before clearing.', 'error');
      return;
    }
    const jobs = await getJobsByUser(currentUser);
    if (jobs.length > 0) {
      jobs.sort((a, b) => new Date(a.applicationDate) - new Date(b.applicationDate));
      const excelData = jobs.map((job, index) => ({
        'Application Date': job.applicationDate || '',
        'Country Name': job.countryName || '',
        'Company Name': job.companyName || '',
        'Recruiter Email & Phone': job.recruiter || '',
        'Job Title': job.jobTitle || '',
        'Job Portal/Company Website/Link': job.jobLink || '',
        'Status': job.status || '',
        'Response Remarks': job.responseRemarks || ''
      }));
      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Jobs');
      const filename = `jobs-backup-${currentUser}-${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(workbook, filename);
      toast('Backup exported to Excel.', 'success');
    }
    await clearJobsForUser(currentUser);
    await refreshJobs();
  } catch (err) {
    toast('Error clearing data.', 'error');
  }
}

async function onExport() {
  if (!currentUser) {
    toast('Please login to export.', 'error');
    return;
  }
  try {
    if (typeof XLSX === 'undefined') {
      toast('Excel export library not loaded.', 'error');
      return;
    }
    const jobs = await getJobsByUser(currentUser);
    if (jobs.length === 0) {
      toast('No jobs to export.', 'error');
      return;
    }
    jobs.sort((a, b) => new Date(a.applicationDate) - new Date(b.applicationDate));
    const excelData = jobs.map((job, index) => ({
      'Application Date': job.applicationDate || '',
      'Country Name': job.countryName || '',
      'Company Name': job.companyName || '',
      'Recruiter Email & Phone': job.recruiter || '',
      'Job Title': job.jobTitle || '',
      'Job Portal/Company Website/Link': job.jobLink || '',
      'Status': job.status || '',
      'Response Remarks': job.responseRemarks || ''
    }));
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Jobs');
    const filename = `jobs-${currentUser}-${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, filename);
    toast('Excel file exported successfully!', 'success');
  } catch (err) {
    toast('Error exporting to Excel.', 'error');
  }
}

function toast(msg, kind = 'success') {
  const p = document.createElement('div');
  p.className = `toast ${kind === 'success' ? 'toast-success' : 'toast-error'}`;
  p.textContent = msg;
  document.body.appendChild(p);
  setTimeout(() => p.remove(), 2500);
}

// Feedback form handlers
function openFeedbackForm() {
  const modal = document.getElementById('feedbackModal');
  if (!modal) return;
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
    toast('Please enter a description.', 'error');
    return;
  }
  if (email && !validateEmail(email)) {
    toast('Please enter a valid email.', 'error');
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
  const recipient = 'pm837389@gmail.com';
  const mailto = `mailto:${recipient}?subject=${subject}&body=${body}`;
  window.location.href = mailto;
  closeFeedbackForm();
}

function escapeHtml(s) {
  return (s || '').toString().replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeAttr(s) {
  return (s || '').toString().replace(/"/g, '&quot;');
}

async function onTrackAdd() {
  if (!currentUser) {
    setLoginStatus('Please login before tracking.');
    // Highlight login button
    const loginBtn = document.getElementById('loginBtn');
    loginBtn.classList.add('btn-error-pulse');
    loginBtn.focus();
    toast('Please login to save jobs.', 'error');
    return;
  }

  // Remove error highlight if valid
  document.getElementById('loginBtn').classList.remove('btn-error-pulse');
  clearFormError(); // Clear visible error if any

  const formData = formToJob();
  const isEditing = !!formData.id;

  if (isManualNew) {
    const job = {
      ...formData,
      user: currentUser
    };
    if (!job.companyName || !job.jobTitle || !job.jobLink) {
      showFormError('Please fill in Company Name, Job Title, and Job Link.');
      return;
    }
    await addOrUpdateJob(job);
    currentPage = 1;
    await refreshJobs();
    toast('New job added successfully!', 'success');
    isManualNew = false;
    document.getElementById('jobId').value = '';
    fillForm(defaultForm(''));
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let parsedData = {};
  if (tab?.id) {
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_JOB_DATA' });
      if (response?.ok && response.data) parsedData = response.data;
    } catch (err) { }
  }

  const job = isEditing ? {
    ...formData,
    id: formData.id,
    user: currentUser
  } : {
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

  if (formData.id) job.id = formData.id;

  if (!job.companyName || !job.jobTitle || !job.jobLink) {
    showFormError('Please fill in Company Name, Job Title, and Job Link.');
    return;
  }

  await addOrUpdateJob(job);
  if (!isEditing) currentPage = 1;
  await refreshJobs();
  toast('Job added successfully!', 'success');
  document.getElementById('jobId').value = '';
  fillForm(defaultForm(job.jobLink));
}
