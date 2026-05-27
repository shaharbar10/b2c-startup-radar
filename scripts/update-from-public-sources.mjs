import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dataPath = join(root, "data", "startups.json");
const jsPath = join(root, "data", "startups.js");
const dryRun = process.argv.includes("--dry-run");

const b2cKeywords = [
  "consumer", "b2c", "app", "apps", "marketplace", "shopping", "commerce", "dtc",
  "direct-to-consumer", "social", "gaming", "game", "games", "wellness", "health",
  "fitness", "food", "snack", "beauty", "fashion", "travel", "pet", "creator",
  "dating", "family", "kids", "parenting", "fintech", "banking", "personal finance",
  "wearable", "hardware", "music", "sports", "retail"
];

const b2bRejects = [
  "enterprise", "developer", "devops", "infrastructure", "database", "cybersecurity",
  "cloud", "api", "saas platform", "hr tech", "procurement", "supply chain",
  "compliance platform", "data platform", "observability", "sales software",
  "deeptech", "industrial", "emissions", "carbon molecules", "ci/cd", "simulation",
  "manufacturing platform", "b2b"
];

const fundingKeywords = [
  "raises", "raised", "secures", "secured", "lands", "funding", "fundraise",
  "pre-seed", "pre seed", "seed", "series a", "angel round"
];

const rssFeeds = [
  { name: "TechCrunch", url: "https://techcrunch.com/feed/" },
  { name: "TechCrunch Startups", url: "https://techcrunch.com/category/startups/feed/" },
  { name: "Crunchbase News", url: "https://news.crunchbase.com/feed/" },
  { name: "FinSMEs", url: "https://www.finsmes.com/feed" },
  { name: "EU-Startups", url: "https://www.eu-startups.com/feed/" },
  { name: "Tech.eu", url: "https://tech.eu/feed/" },
  { name: "Silicon Canals", url: "https://siliconcanals.com/feed/" },
  { name: "Tech Funding News", url: "https://techfundingnews.com/feed/" },
  { name: "VentureBeat", url: "https://venturebeat.com/feed/" },
  { name: "Inc42", url: "https://inc42.com/feed/" },
  { name: "YourStory", url: "https://yourstory.com/feed" },
  { name: "e27", url: "https://e27.co/feed/" },
  { name: "KrASIA", url: "https://kr-asia.com/feed" },
  { name: "Game Developer", url: "https://www.gamedeveloper.com/rss.xml" }
];

const gdeltQueries = [
  '"raises" "seed" startup consumer',
  '"raises" "Series A" startup consumer',
  '"raises" "pre-seed" startup consumer app',
  '"funding" "consumer app" startup',
  '"DTC" startup raises seed',
  '"consumer health" startup raises',
  '"gaming startup" raises seed',
  '"marketplace startup" raises seed'
];

const data = JSON.parse(await readFile(dataPath, "utf8"));
const existingIds = new Set((data.companies || []).map((company) => company.id));
const existingNames = new Set((data.companies || []).map((company) => normalize(company.name)));

const candidates = await collectCandidates();
const newCompanies = candidates
  .filter((candidate) => !existingIds.has(candidate.id) && !existingNames.has(normalize(candidate.name)))
  .slice(0, 20);

if (newCompanies.length) {
  data.lastUpdated = new Date().toISOString();
  data.companies = [...newCompanies, ...(data.companies || [])].slice(0, 80);
}

if (dryRun) {
  console.log(JSON.stringify({ found: candidates.length, new: newCompanies.length, candidates: newCompanies }, null, 2));
} else {
  await writeFile(dataPath, `${JSON.stringify(data, null, 2)}\n`);
  await writeFile(jsPath, `window.STARTUP_RADAR_DATA = ${JSON.stringify(data, null, 2)};\n`);
  console.log(`Added ${newCompanies.length} public-source B2C funding candidates.`);
}

async function collectCandidates() {
  const articles = [];
  const rssResults = await Promise.allSettled(rssFeeds.map(fetchRssFeed));
  for (const result of rssResults) {
    if (result.status === "fulfilled") articles.push(...result.value);
  }

  const gdeltResults = await Promise.allSettled(gdeltQueries.map(fetchGdelt));
  for (const result of gdeltResults) {
    if (result.status === "fulfilled") articles.push(...result.value);
  }

  const uniqueArticles = dedupeByUrl(articles).filter(isRelevant);
  return uniqueArticles.map(articleToCompany);
}

async function fetchRssFeed(feed) {
  const response = await fetch(feed.url, { headers: { "user-agent": "B2C Startup Radar/1.0" } });
  if (!response.ok) return [];
  const xml = await response.text();
  const blocks = [...xml.matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/gi)].map((match) => match[0]);
  return blocks.map((block) => {
    const title = readXml(block, "title");
    const link = readXml(block, "link") || readHref(block);
    const description = readXml(block, "description") || readXml(block, "summary") || readXml(block, "content:encoded");
    const publishedAt = readXml(block, "pubDate") || readXml(block, "published") || readXml(block, "updated");
    return {
      title,
      url: link,
      description: stripHtml(description),
      publishedAt,
      source: feed.name
    };
  }).filter((article) => article.title && article.url);
}

async function fetchGdelt(query) {
  const url = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
  url.searchParams.set("query", query);
  url.searchParams.set("mode", "artlist");
  url.searchParams.set("format", "json");
  url.searchParams.set("maxrecords", "40");
  url.searchParams.set("sort", "datedesc");
  url.searchParams.set("timespan", "3d");
  const response = await fetch(url, { headers: { "user-agent": "B2C Startup Radar/1.0" } });
  if (!response.ok) return [];
  const payload = await response.json();
  return (payload.articles || []).map((article) => ({
    title: article.title,
    url: article.url,
    description: article.seendate ? `Seen ${article.seendate}` : "",
    publishedAt: article.seendate,
    source: article.sourceCommonName || "GDELT"
  }));
}

function isRelevant(article) {
  const text = normalize(`${article.title} ${article.description}`);
  const hasFunding = fundingKeywords.some((keyword) => text.includes(keyword));
  const hasEarlyRound = /pre[- ]?seed|seed|series a|angel/.test(text);
  const hasB2c = b2cKeywords.some((keyword) => text.includes(keyword));
  const hasSeriesBOrLater = /series [bcdefg]\b|growth round|private equity|ipo/.test(text);
  const stronglyB2b = b2bRejects.some((keyword) => text.includes(keyword));
  return hasFunding && hasEarlyRound && hasB2c && !hasSeriesBOrLater && !stronglyB2b;
}

function articleToCompany(article) {
  const name = extractCompanyName(article.title);
  const id = slugify(`${name}-${article.source}`);
  const round = extractRound(article.title);
  const amount = extractAmount(article.title) || "Amount not clear";
  const industry = inferIndustry(`${article.title} ${article.description}`);
  return {
    id,
    name,
    logoText: initials(name),
    tone: inferTone(industry),
    website: article.url,
    description: cleanSentence(article.title),
    industry,
    location: "Global / source pending",
    fundingDate: normalizeDate(article.publishedAt),
    fundingAmount: amount,
    round,
    roundKey: roundKey(round),
    investors: [],
    employees: "Not public in source",
    status: "fresh",
    tags: ["Auto-discovered", "Needs review"],
    founders: [],
    hiring: { status: "none" },
    sources: [{ label: article.source, url: article.url }]
  };
}

function readXml(block, tagName) {
  const match = block.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i"));
  return match ? decodeHtml(match[1].replace(/^<!\[CDATA\[|\]\]>$/g, "").trim()) : "";
}

function readHref(block) {
  const match = block.match(/<link[^>]+href=["']([^"']+)["']/i);
  return match ? decodeHtml(match[1]) : "";
}

function stripHtml(value) {
  return decodeHtml(String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function normalize(value) {
  return String(value || "").toLowerCase();
}

function dedupeByUrl(articles) {
  const seen = new Set();
  return articles.filter((article) => {
    const key = article.url.replace(/[?#].*$/, "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractCompanyName(title) {
  const cleaned = title
    .replace(/\s+[|-]\s+.*$/, "")
    .replace(/^exclusive:\s*/i, "")
    .trim();
  const fundingMatch = cleaned.match(/^(.+?)\s+(raises|raised|secures|secured|lands|closes|gets|announces|emerges)\b/i);
  let candidate = fundingMatch ? fundingMatch[1] : cleaned.split(":")[0];
  candidate = candidate
    .replace(/^yc-backed\s+/i, "")
    .replace(/^(belgian|french|german|uk|us|indian|spanish|italian|swedish|dutch|european|global)\s+/i, "")
    .replace(/.*\b(startup|platform|app|brand|rival)\s+/i, "");
  const capitalized = [...candidate.matchAll(/[A-Z][A-Za-z0-9'’.-]*(?:\s+[A-Z][A-Za-z0-9'’.-]*){0,2}/g)].map((match) => match[0]);
  if (capitalized.length) candidate = capitalized.at(-1);
  const launchMatch = cleaned.match(/^([A-Z][A-Za-z0-9'’.-]*(?:\s+[A-Z][A-Za-z0-9'’.-]*){0,2})\s+(is|wants|launches|builds)\b/);
  if (!fundingMatch && launchMatch) candidate = launchMatch[1];
  return titleCase(candidate.replace(/^startup\s+/i, "").trim()).slice(0, 42);
}

function extractAmount(text) {
  const match = text.match(/([$€£]\s?\d+(?:\.\d+)?\s?(?:m|mn|million|b|bn|billion|k|thousand)?)/i);
  return match ? match[1].replace(/\s+/g, " ").toUpperCase() : "";
}

function extractRound(text) {
  const value = normalize(text);
  if (/series a/.test(value)) return "Series A";
  if (/pre[- ]?seed/.test(value)) return "Pre-seed";
  if (/angel/.test(value)) return "Angel";
  return "Seed";
}

function roundKey(round) {
  if (round === "Series A") return "series-a";
  if (round === "Pre-seed") return "pre-seed";
  return "seed";
}

function inferIndustry(text) {
  const value = normalize(text);
  if (/game|gaming/.test(value)) return "Gaming";
  if (/health|wellness|fitness|medical|patient/.test(value)) return "Consumer health";
  if (/food|snack|beverage|cp/g.test(value)) return "Consumer packaged goods";
  if (/marketplace|shopping|commerce|retail/.test(value)) return "Consumer commerce";
  if (/social|creator|dating|community/.test(value)) return "Consumer social";
  if (/travel|hotel|trip/.test(value)) return "Travel";
  if (/finance|fintech|banking|wallet/.test(value)) return "Consumer fintech";
  if (/hardware|wearable|device/.test(value)) return "Consumer hardware";
  return "Consumer startup";
}

function inferTone(industry) {
  if (/health|hardware/.test(normalize(industry))) return "coral";
  if (/gaming|social/.test(normalize(industry))) return "blue";
  if (/food|commerce/.test(normalize(industry))) return "amber";
  return "teal";
}

function normalizeDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function cleanSentence(title) {
  const text = stripHtml(title).replace(/\s+/g, " ").trim();
  return text.endsWith(".") ? text : `${text}.`;
}

function slugify(value) {
  return normalize(value).replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 72);
}

function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function titleCase(value) {
  return value.replace(/\w\S*/g, (word) => word[0].toUpperCase() + word.slice(1));
}
