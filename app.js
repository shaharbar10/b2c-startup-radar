const FALLBACK_DATA = {
  lastUpdated: "2026-05-27T08:32:00+02:00",
  coverage: [
    "TechCrunch, Dealroom, LinkedIn, investor announcements, startup publications, company pages, and careers pages are checked using public web access only.",
    "Dealroom premium fields and LinkedIn private/profile details are not available without approved account/API access, so employee counts are shown as public ranges when possible.",
    "This prototype is ready for a hosted daily updater to replace data/startups.json every morning."
  ],
  companies: [],
  sourcePool: []
};

const state = {
  data: FALLBACK_DATA,
  filter: "all",
  query: ""
};

const elements = {
  companyList: document.querySelector("#companyList"),
  companyCount: document.querySelector("#companyCount"),
  freshCount: document.querySelector("#freshCount"),
  hiringCount: document.querySelector("#hiringCount"),
  resultCount: document.querySelector("#resultCount"),
  searchInput: document.querySelector("#searchInput"),
  chips: [...document.querySelectorAll(".chip")],
  lastUpdated: document.querySelector("#lastUpdated"),
  emptyState: document.querySelector("#emptyState"),
  sourceButton: document.querySelector("#sourceButton"),
  sourceSheet: document.querySelector("#sourceSheet"),
  closeSources: document.querySelector("#closeSources"),
  sourceCoverage: document.querySelector("#sourceCoverage")
};

async function loadData() {
  try {
    const response = await fetch("data/startups.json", { cache: "no-store" });
    if (!response.ok) throw new Error("Data file unavailable");
    state.data = await response.json();
  } catch {
    state.data = window.STARTUP_RADAR_DATA || FALLBACK_DATA;
  }
}

function formatDate(value) {
  if (!value) return "Date unknown";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function relativeUpdated(value) {
  if (!value) return "Last update unknown";
  const date = new Date(value);
  return `Updated ${formatDate(date)} at ${date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit"
  })}`;
}

function normalize(text) {
  return String(text || "").toLowerCase();
}

function matchesFilter(company) {
  if (state.filter === "all") return true;
  if (state.filter === "fresh") return company.status === "fresh";
  if (state.filter === "hiring") return company.hiring?.status === "active";
  return normalize(company.roundKey) === state.filter;
}

function matchesQuery(company) {
  const query = normalize(state.query).trim();
  if (!query) return true;
  const haystack = [
    company.name,
    company.description,
    company.industry,
    company.location,
    company.round,
    company.fundingAmount,
    ...(company.investors || []),
    ...(company.tags || []),
    ...(company.founders || []).map((founder) => founder.name)
  ].join(" ");
  return normalize(haystack).includes(query);
}

function sortByFundingDate(companies) {
  return [...companies].sort((a, b) => new Date(b.fundingDate) - new Date(a.fundingDate));
}

function sourceLinks(sources) {
  return sources
    .map((source) => `<a href="${source.url}" target="_blank" rel="noreferrer">${source.label}</a>`)
    .join("");
}

function founderLinks(founders) {
  return founders
    .map((founder) => {
      if (founder.linkedin) {
        return `<a href="${founder.linkedin}" target="_blank" rel="noreferrer">${founder.name}</a>`;
      }
      return `<b>${founder.name}</b>`;
    })
    .join("");
}

function hiringLabel(hiring) {
  if (!hiring || hiring.status === "none") return "No clear active hiring signal";
  if (hiring.status === "open") return "Open applications / soft hiring signal";
  return "Appears to be actively hiring";
}

function hiringClass(hiring) {
  if (!hiring || hiring.status === "none") return "no";
  if (hiring.status === "open") return "open";
  return "yes";
}

function companyCard(company) {
  const sourceMarkup = sourceLinks(company.sources || []);
  const founderMarkup = founderLinks(company.founders || []);
  const hiringLink = company.hiring?.url
    ? `<a class="action-link primary" href="${company.hiring.url}" target="_blank" rel="noreferrer">Jobs</a>`
    : "";

  return `
    <article class="company-card">
      <div class="card-top">
        <div class="logo-tile" data-tone="${company.tone || "teal"}">${company.logoText || company.name[0]}</div>
        <div>
          <div class="title-line">
            <a class="company-name" href="${company.website}" target="_blank" rel="noreferrer">${company.name}</a>
            <span class="status-pill ${company.status === "catch-up" ? "catch-up" : ""}">
              ${company.status === "fresh" ? "Fresh" : "Catch-up"}
            </span>
          </div>
          <p class="description">${company.description}</p>
        </div>
      </div>

      <div class="facts">
        <div class="fact">
          <span>Funding</span>
          <strong>${company.fundingAmount}</strong>
        </div>
        <div class="fact">
          <span>Round</span>
          <strong>${company.round}</strong>
        </div>
        <div class="fact">
          <span>Date</span>
          <strong>${formatDate(company.fundingDate)}</strong>
        </div>
        <div class="fact">
          <span>Employees</span>
          <strong>${company.employees}</strong>
        </div>
      </div>

      <div class="tags" aria-label="${company.name} tags">
        <span class="tag">${company.location}</span>
        <span class="tag">${company.industry}</span>
        ${(company.tags || []).map((tag) => `<span class="tag">${tag}</span>`).join("")}
      </div>

      <div class="hiring ${hiringClass(company.hiring)}">${hiringLabel(company.hiring)}</div>

      <div class="founders">
        <span>Founders</span>
        <div class="founder-list">${founderMarkup}</div>
      </div>

      <div class="actions">
        <a class="action-link" href="${company.website}" target="_blank" rel="noreferrer">Website</a>
        ${hiringLink}
      </div>

      <div class="sources">
        <span>Sources</span>
        <div class="source-list">${sourceMarkup}</div>
      </div>
    </article>
  `;
}

function render() {
  const companies = state.data.companies || [];
  const filtered = sortByFundingDate(companies).filter((company) => matchesFilter(company) && matchesQuery(company));

  elements.companyCount.textContent = companies.length;
  elements.freshCount.textContent = companies.filter((company) => company.status === "fresh").length;
  elements.hiringCount.textContent = companies.filter((company) => company.hiring?.status === "active").length;
  elements.resultCount.textContent = `${filtered.length} ${filtered.length === 1 ? "result" : "results"}`;
  elements.lastUpdated.textContent = relativeUpdated(state.data.lastUpdated);
  elements.companyList.innerHTML = filtered.map(companyCard).join("");
  elements.emptyState.hidden = filtered.length > 0;

  elements.sourceCoverage.innerHTML = (state.data.coverage || [])
    .map((paragraph) => `<p>${paragraph}</p>`)
    .join("") + sourcePoolMarkup(state.data.sourcePool || []);
}

function wireEvents() {
  elements.searchInput.addEventListener("input", (event) => {
    state.query = event.target.value;
    render();
  });

  elements.chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      state.filter = chip.dataset.filter;
      elements.chips.forEach((item) => item.classList.toggle("is-active", item === chip));
      render();
    });
  });

  elements.sourceButton.addEventListener("click", () => {
    elements.sourceSheet.classList.add("is-open");
    elements.sourceSheet.setAttribute("aria-hidden", "false");
  });

  elements.closeSources.addEventListener("click", closeSources);
  elements.sourceSheet.addEventListener("click", (event) => {
    if (event.target === elements.sourceSheet) closeSources();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeSources();
  });
}

function closeSources() {
  elements.sourceSheet.classList.remove("is-open");
  elements.sourceSheet.setAttribute("aria-hidden", "true");
}

function sourcePoolMarkup(sourcePool) {
  if (!sourcePool.length) return "";
  return `
    <div class="source-pool">
      <h3>Source watchlist</h3>
      ${sourcePool
        .map(
          (group) => `
            <section>
              <strong>${group.category}</strong>
              <div>
                ${group.sources
                  .map((source) => `<a href="${source.url}" target="_blank" rel="noreferrer">${source.name}</a>`)
                  .join("")}
              </div>
            </section>
          `
        )
        .join("")}
    </div>
  `;
}

loadData().then(() => {
  wireEvents();
  render();
});
