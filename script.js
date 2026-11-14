const fallbackProjects = [];

async function loadProjects() {
  try {
    const response = await fetch('projects.json');
    if (!response.ok) throw new Error('Could not load projects');
    const data = await response.json();
    return Array.isArray(data) ? data : fallbackProjects;
  } catch (error) {
    return fallbackProjects;
  }
}

function renderOverview(projects, pageType) {
  const grid = document.querySelector('[data-project-grid]');
  if (!grid) return;

  const filtered = projects.filter((item) => item.category === pageType);

  if (!filtered.length) {
    grid.innerHTML = '<div class="empty-state">No projects available yet.</div>';
    return;
  }

  grid.innerHTML = filtered.map((project) => `
    <a class="project-card" href="project-detail.html?slug=${project.slug}" aria-label="Open ${project.title}">
      <div class="project-image" style="background-image:url('${project.image}')">
        <span class="card-tag">${project.location} · ${project.year}</span>
      </div>
      <div class="card-overlay" style="background:${project.color}66;">
        <h3 class="card-title">${project.title}</h3>
        <div class="card-copy">${project.subtitle}</div>
        <span class="card-arrow">↗</span>
      </div>
    </a>
  `).join('');
}

function renderDetail(projects) {
  const detailRoot = document.querySelector('[data-detail-root]');
  if (!detailRoot) return;

  const params = new URLSearchParams(window.location.search);
  const slug = params.get('slug');
  const project = projects.find((item) => item.slug === slug) || projects[0];

  if (!project) {
    detailRoot.innerHTML = '<p>No project details available.</p>';
    return;
  }

  const detailTable = project.table || {};
  const bodySections = Array.isArray(project.body) ? project.body : [];

  detailRoot.innerHTML = `
    <a href="${project.category === 'project' ? 'index.html' : 'initiatives.html'}" class="back-link" aria-label="Back to overview">←</a>
    <div class="detail-header">
      <div class="detail-hero">
        <img src="${project.image}" alt="${project.title}">
      </div>
      <div class="detail-title-wrap">
        <h2 class="detail-title">${project.title}</h2>
        <p class="detail-summary">${project.intro || project.subtitle}</p>
      </div>
    </div>
    <div class="detail-body">
      <div class="table-wrap">
        <table class="summary-table">
          <tbody>
            <tr><th>Topic</th><td>${detailTable.topic || project.title}</td></tr>
            <tr><th>Keywords</th><td>${detailTable.keywords || project.subtitle}</td></tr>
            <tr><th>Team</th><td>${detailTable.team || 'Team not specified yet'}</td></tr>
            <tr><th>Partnership</th><td>${detailTable.partnership || 'Partnership information not available'}</td></tr>
            <tr><th>Funding</th><td>${detailTable.funding || 'Funding details pending'}</td></tr>
            <tr><th>Duration</th><td>${detailTable.duration || 'Ongoing'}</td></tr>
            <tr><th>Location</th><td>${detailTable.location || project.location}</td></tr>
          </tbody>
        </table>
      </div>
      <div class="article-copy">
        ${bodySections.map((section) => `
          <h3>${section.heading}</h3>
          <p>${section.text}</p>
        `).join('')}
      </div>
    </div>
  `;
}

document.addEventListener('DOMContentLoaded', async () => {
  const projectData = await loadProjects();
  const pageType = document.body.dataset.page;

  if (pageType === 'projects') {
    renderOverview(projectData, 'project');
  }

  if (pageType === 'initiatives') {
    renderOverview(projectData, 'initiative');
  }

  if (pageType === 'detail') {
    renderDetail(projectData);
  }

  const current = document.body.dataset.current;
  if (current) {
    const crumb = document.querySelector(`[data-crumb="${current}"]`);
    if (crumb) {
      crumb.classList.add('current');
      crumb.setAttribute('aria-current', 'page');
    }
  }
});
