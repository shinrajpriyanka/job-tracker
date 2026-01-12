function currentParse() {
  const parsed = window.parsePage();
  const recruiter = detectRecruiterInfo();
  return {
    applicationDate: new Date().toISOString().slice(0, 10),
    countryName: parsed.countryName || '',
    companyName: parsed.companyName || '',
    recruiter: recruiter || '',
    jobTitle: parsed.jobTitle || '',
    jobLink: parsed.jobLink || location.href,
    status: 'Applied',
    responseRemarks: ''
  };
}

function detectRecruiterInfo() {
  const bodyText = document.body.innerText || '';
  const emailMatch = bodyText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const phoneMatch = bodyText.match(/(\+?\d[\d\s\-().]{6,}\d)/);
  const email = emailMatch ? emailMatch[0] : '';
  const phone = phoneMatch ? phoneMatch[0] : '';
  return [email, phone].filter(Boolean).join(' / ');
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'GET_PAGE_JOB_DATA') {
    sendResponse({ ok: true, data: currentParse() });
  }
});
