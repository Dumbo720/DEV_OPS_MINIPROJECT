const skillCatalog = {
  aws: [/\baws\b/i, /\bamazon web services\b/i],
  lambda: [/\blambda\b/i, /\baws lambda\b/i],
  "api gateway": [/\bapi gateway\b/i, /\bamazon api gateway\b/i],
  dynamodb: [/\bdynamodb\b/i],
  s3: [/\bs3\b/i, /\bamazon s3\b/i],
  textract: [/\btextract\b/i, /\bamazon textract\b/i],
  "node.js": [/\bnode\.?js\b/i, /\bnodejs\b/i],
  javascript: [/\bjavascript\b/i],
  typescript: [/\btypescript\b/i],
  react: [/\breact(?:\.js)?\b/i],
  html: [/\bhtml5?\b/i],
  css: [/\bcss3?\b/i],
  python: [/\bpython\b/i],
  java: [/\bjava\b/i],
  sql: [/\bsql\b/i],
  mongodb: [/\bmongodb\b/i],
  docker: [/\bdocker\b/i],
  kubernetes: [/\bkubernetes\b/i, /\bk8s\b/i],
  terraform: [/\bterraform\b/i],
  serverless: [/\bserverless\b/i],
  "rest api": [/\brest api\b/i, /\brestful api\b/i, /\brestful services\b/i],
  microservices: [/\bmicroservices?\b/i],
  git: [/\bgit\b/i, /\bgithub\b/i, /\bgitlab\b/i],
  "ci/cd": [/\bci\/cd\b/i, /\bcontinuous integration\b/i, /\bcontinuous delivery\b/i],
  agile: [/\bagile\b/i, /\bscrum\b/i]
};

function escapeForRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function createFlexibleSkillPatterns(skill) {
  const normalized = skill.trim().toLowerCase();
  if (!normalized) {
    return [];
  }

  if (skillCatalog[normalized]) {
    return skillCatalog[normalized];
  }

  const escaped = escapeForRegex(normalized)
    .replace(/\\\./g, "\\.?")
    .replace(/\s+/g, "\\s+")
    .replace(/\\\//g, "(?:\\/|\\s+)");

  return [new RegExp(`(^|[^a-z0-9+.#])${escaped}([^a-z0-9+.#]|$)`, "i")];
}

function extractRelevantTextZones(text = "") {
  const lowered = text.toLowerCase();
  const sections = [];
  const sectionRegex = /(skills|technical skills|tech stack|technologies|tools|competencies|expertise)\s*:?\s*([\s\S]{0,800})/gi;
  let match = sectionRegex.exec(text);

  while (match) {
    sections.push(match[0]);
    match = sectionRegex.exec(text);
  }

  const bulletLines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => /[,|]/.test(line) || /^[-*•]/.test(line));

  return [text, lowered, ...sections, ...bulletLines];
}

export function extractName(text = "") {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 8);

  const nameCandidate = lines.find((line) => /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}$/.test(line));
  return nameCandidate || "Unknown Candidate";
}

export function extractExperience(text = "") {
  const yearPattern = /(\d+)\+?\s+years?/i;
  const match = text.match(yearPattern);
  if (match) {
    return `${match[1]} years`;
  }

  const experienceSection = text.match(/experience[:\s]+([^\n]+)/i);
  return experienceSection ? experienceSection[1].trim() : "Not specified";
}

export function extractSkillsFromText(text = "", requiredSkills = []) {
  const discoveredSkills = new Set();
  const searchZones = extractRelevantTextZones(text);
  const candidateSkills = Array.from(new Set([...Object.keys(skillCatalog), ...requiredSkills.map((skill) => skill.toLowerCase())]));

  candidateSkills.forEach((skill) => {
    const patterns = createFlexibleSkillPatterns(skill);
    if (patterns.some((pattern) => searchZones.some((zone) => pattern.test(zone)))) {
      discoveredSkills.add(skill.toLowerCase());
    }
  });

  return Array.from(discoveredSkills).sort();
}

export function computeScore(candidateSkills = [], requiredSkills = []) {
  if (!requiredSkills.length) {
    return 0;
  }

  const normalizedCandidateSkills = new Set(candidateSkills.map((skill) => skill.toLowerCase()));
  const matchedSkills = requiredSkills.filter((skill) => normalizedCandidateSkills.has(skill.toLowerCase()));

  return Math.round((matchedSkills.length / requiredSkills.length) * 100);
}

export function parseResumeText(text, requiredSkills = []) {
  const skills = extractSkillsFromText(text, requiredSkills);
  return {
    name: extractName(text),
    experience: extractExperience(text),
    skills,
    score: computeScore(skills, requiredSkills)
  };
}
