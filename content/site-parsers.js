// Site-specific parsers: extract info from current page safely (no external calls)

function parsePage() {
  const host = location.hostname;
  const parser = [
    { match: /totaljobs\.com$/, fn: parseTotalJobs },
    { match: /reed\.co\.uk$/, fn: parseReed },
    { match: /cwjobs\.co\.uk$/, fn: parseCWJobs },
    { match: /linkedin\.com$/, fn: parseLinkedIn },
    { match: /indeed\.(co\.uk|de|ie)$/, fn: parseIndeed },
    { match: /jobsite\.co\.uk$/, fn: parseJobsite },
    { match: /fish4\.co\.uk$/, fn: parseFish4 },
    { match: /adzuna\.co\.uk$/, fn: parseAdzuna },
    { match: /stepstone\.de$/, fn: parseStepstone },
    { match: /monster\.(de|ie)$/, fn: parseMonster },
    { match: /xing\.com$/, fn: parseXing },
    { match: /europa\.eu$/, fn: parseEures },
    { match: /jobware\.de$/, fn: parseJobware },
    { match: /karriere\.de$/, fn: parseKarriere },
    { match: /jobsintown\.de$/, fn: parseJobsInTown },
    { match: /careerjet\.ie$/, fn: parseCareerjet },
    { match: /jobsireland\.ie$/, fn: parseJobsIreland },
    { match: /recruitireland\.com$/, fn: parseRecruitIreland }
  ].find(p => p.match.test(host));

  if (!parser) return defaultParse();
  try {
    return parser.fn();
  } catch {
    return defaultParse();
  }
}

function text(sel) {
  const el = document.querySelector(sel);
  return el ? el.textContent.trim() : '';
}
function defaultParse() {
  return {
    jobTitle: document.title || '',
    companyName: '',
    jobLink: location.href,
    countryName: guessCountryFromHost(location.hostname)
  };
}
function guessCountryFromHost(host) {
  if (host.endsWith('.de')) return 'Germany';
  if (host.endsWith('.ie')) return 'Ireland';
  if (host.endsWith('.co.uk') || host.endsWith('.uk')) return 'United Kingdom';
  return '';
}

// Example parser functions (unchanged from previous version)
function parseTotalJobs() { return { jobTitle: text('h1'), companyName: text('[data-at=companyName], .brand'), jobLink: location.href, countryName: 'United Kingdom' }; }
function parseReed() { return { jobTitle: text('h1'), companyName: document.querySelector('[data-qa="company-logo-image"]').alt, jobLink: location.href, countryName: text('[data-qa="job-location"]') }; }
// ... keep other site-specific parsers as before

function parseCWJobs() {
  return { jobTitle: text('h1'), companyName: text('.job__company, .brand'), jobLink: location.href, countryName: 'United Kingdom' };
}
function parseLinkedIn() {
  const firstText = (selectors) => {
    console.log('LinkedIn selectors:', selectors);
    for (const s of selectors) {
      const t = text(s);
      if (t) return t;
    }
    return '';
  };

  const jobTitle = firstText([
    'h1.top-card-layout__title',
    'h1.topcard__title',
    'h1[data-test-job-title]',
    'h1'
  ]);

  const companyName = firstText([
    '.job-details-jobs-unified-top-card__company-name'
  ]);

  const countryName = firstText([
    '.job-details-jobs-unified-top-card__primary-description-container .tvm__text--low-emphasis'
  ]);
  console.log('Parsed LinkedIn:', { jobTitle, companyName, countryName });
  return { jobTitle, companyName, jobLink: location.href, countryName };
}
function parseIndeed() {
  return { jobTitle: text('.jobsearch-JobInfoHeader-title span, h1.ia-JobHeader-title'), companyName: text('a[id="companyLink"], h1.ia-JobHeader-title~span'), jobLink: location.href, countryName: text('#location-collapsed-header span, h1.ia-JobHeader-title~span') };
}
function parseJobsite() {
  return { jobTitle: text('h1'), companyName: text('.brand, [data-at=companyName]'), jobLink: location.href, countryName: 'United Kingdom' };
}
function parseFish4() {
  return { jobTitle: text('h1'), companyName: text('.job-details-header__recruiter, .brand'), jobLink: location.href, countryName: 'United Kingdom' };
}
function parseAdzuna() {
  return { jobTitle: text('h1'), companyName: text('.job__company, .breadcrumbs a[href*="/company"]'), jobLink: location.href, countryName: 'United Kingdom' };
}
function parseStepstone() {
  return { jobTitle: text('h1'), companyName: text('[data-at=company-name], .company'), jobLink: location.href, countryName: 'Germany' };
}
function parseMonster() {
  return { jobTitle: text('h1'), companyName: text('.company, [data-testid=company-name]'), jobLink: location.href, countryName: guessCountryFromHost(location.hostname) };
}
function parseXing() {
  return { jobTitle: text('h1'), companyName: text('[data-testid=job-company-name], .company'), jobLink: location.href, countryName: 'Germany' };
}
function parseEures() {
  return { jobTitle: text('h1'), companyName: text('.employer-name'), jobLink: location.href, countryName: '' };
}
function parseJobware() {
  return { jobTitle: text('h1'), companyName: text('.company-name'), jobLink: location.href, countryName: 'Germany' };
}
function parseKarriere() {
  return { jobTitle: text('h1'), companyName: text('.company'), jobLink: location.href, countryName: 'Germany' };
}
function parseJobsInTown() {
  return { jobTitle: text('h1'), companyName: text('.company'), jobLink: location.href, countryName: 'Germany' };
}
function parseCareerjet() {
  return { jobTitle: text('h1'), companyName: text('.company, .job_company'), jobLink: location.href, countryName: 'Ireland' };
}
function parseJobsIreland() {
  return { jobTitle: text('h1'), companyName: text('.employer-name, .company'), jobLink: location.href, countryName: 'Ireland' };
}
function parseRecruitIreland() {
  return { jobTitle: text('h1'), companyName: text('.job-details__company, .company'), jobLink: location.href, countryName: 'Ireland' };
}
