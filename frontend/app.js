const state = {
  selectedFile: null,
  candidates: [],
  filteredCandidates: [],
  uploadProgress: 0,
  progressTimer: null,
  savedApiBaseUrl: window.localStorage.getItem("resumeai.apiBaseUrl") || ""
};

const roleProfiles = {
  cloud_engineer: {
    label: "Cloud Engineer",
    description: "Scores candidates for AWS, Lambda, S3, DynamoDB, API Gateway, and serverless strengths."
  },
  frontend_developer: {
    label: "Frontend Developer",
    description: "Scores candidates for HTML, CSS, JavaScript, React, and Git fundamentals."
  },
  backend_developer: {
    label: "Backend Developer",
    description: "Scores candidates for Node.js, APIs, databases, and backend engineering experience."
  },
  fullstack_developer: {
    label: "Full-Stack Developer",
    description: "Scores candidates across frontend, backend, APIs, and cloud development breadth."
  },
  data_analyst: {
    label: "Data Analyst",
    description: "Scores candidates for Python, SQL, reporting, and analytics tooling skills."
  }
};

const elements = {
  apiBaseUrl: document.getElementById("apiBaseUrl"),
  resumeFile: document.getElementById("resumeFile"),
  dropzone: document.getElementById("dropzone"),
  filePreview: document.getElementById("filePreview"),
  fileTypeBadge: document.getElementById("fileTypeBadge"),
  uploadBtn: document.getElementById("uploadBtn"),
  selectFileBtn: document.getElementById("selectFileBtn"),
  uploadStatus: document.getElementById("uploadStatus"),
  progressBar: document.getElementById("progressBar"),
  progressValue: document.getElementById("progressValue"),
  roleSelect: document.getElementById("roleSelect"),
  roleDescription: document.getElementById("roleDescription"),
  refreshBtn: document.getElementById("refreshBtn"),
  candidateList: document.getElementById("candidateList"),
  rankingList: document.getElementById("rankingList"),
  searchInput: document.getElementById("searchInput"),
  skillFilter: document.getElementById("skillFilter"),
  sortBy: document.getElementById("sortBy"),
  statCandidates: document.getElementById("statCandidates"),
  statTopScore: document.getElementById("statTopScore"),
  statAverageScore: document.getElementById("statAverageScore"),
  toastContainer: document.getElementById("toastContainer"),
  skeletonTemplate: document.getElementById("candidateSkeletonTemplate")
};

function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  elements.toastContainer.appendChild(toast);

  window.setTimeout(() => {
    toast.remove();
  }, 3600);
}

function setProgress(value, label) {
  state.uploadProgress = Math.max(0, Math.min(100, value));
  elements.progressBar.style.width = `${state.uploadProgress}%`;
  elements.progressValue.textContent = `${Math.round(state.uploadProgress)}%`;
  if (label) {
    elements.uploadStatus.textContent = label;
  }
}

function resetUploadUi() {
  state.selectedFile = null;
  elements.resumeFile.value = "";
  renderFilePreview(null);
  setProgress(0, "Ready to upload a resume.");
}

function renderRoleOptions() {
  elements.roleSelect.innerHTML = Object.entries(roleProfiles)
    .map(([key, profile]) => `<option value="${key}">${profile.label}</option>`)
    .join("");

  updateRoleDescription();
}

function updateRoleDescription() {
  const profile = roleProfiles[elements.roleSelect.value] || roleProfiles.cloud_engineer;
  elements.roleDescription.textContent = profile.description;
}

function runProgressSequence(steps) {
  window.clearInterval(state.progressTimer);
  let index = 0;
  setProgress(steps[0].value, steps[0].label);

  state.progressTimer = window.setInterval(() => {
    index += 1;
    if (index >= steps.length) {
      window.clearInterval(state.progressTimer);
      return;
    }
    setProgress(steps[index].value, steps[index].label);
  }, 500);
}

function formatFileSize(bytes) {
  if (!bytes) {
    return "0 KB";
  }
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

function renderFilePreview(file) {
  if (!file) {
    elements.filePreview.className = "file-preview empty";
    elements.filePreview.innerHTML = "<p>No file selected yet.</p>";
    elements.fileTypeBadge.textContent = "No file";
    elements.fileTypeBadge.className = "badge muted";
    return;
  }

  const extension = file.name.split(".").pop()?.toUpperCase() || "FILE";
  elements.fileTypeBadge.textContent = extension;
  elements.fileTypeBadge.className = "badge";
  elements.fileTypeBadge.style.background = "rgba(79, 70, 229, 0.12)";
  elements.fileTypeBadge.style.color = "var(--primary)";
  elements.filePreview.className = "file-preview";
  elements.filePreview.innerHTML = `
    <strong>${file.name}</strong>
    <p class="file-meta">${formatFileSize(file.size)}</p>
    <p class="file-meta">Role: ${(roleProfiles[elements.roleSelect.value] || roleProfiles.cloud_engineer).label}</p>
    <p class="file-meta">Last modified: ${new Date(file.lastModified).toLocaleString()}</p>
  `;
}

function setSelectedFile(file) {
  state.selectedFile = file || null;
  renderFilePreview(state.selectedFile);
  if (state.selectedFile) {
    setProgress(8, "File selected. Ready to upload.");
  } else {
    setProgress(0, "Ready to upload a resume.");
  }
}

function createSkeletons(count = 3) {
  elements.candidateList.innerHTML = "";
  elements.rankingList.innerHTML = "";

  for (let index = 0; index < count; index += 1) {
    elements.candidateList.appendChild(elements.skeletonTemplate.content.firstElementChild.cloneNode(true));
  }

  for (let index = 0; index < 3; index += 1) {
    const card = document.createElement("article");
    card.className = "leaderboard-card skeleton-card";
    card.innerHTML = `
      <div class="skeleton skeleton-line wide"></div>
      <div class="skeleton skeleton-line medium" style="margin-top:12px;"></div>
      <div class="skeleton skeleton-line short" style="margin-top:18px;"></div>
    `;
    elements.rankingList.appendChild(card);
  }
}

function updateStats(candidates) {
  const total = candidates.length;
  const topScore = total ? Math.max(...candidates.map((candidate) => Number(candidate.score || 0))) : 0;
  const averageScore = total
    ? Math.round(candidates.reduce((sum, candidate) => sum + Number(candidate.score || 0), 0) / total)
    : 0;

  elements.statCandidates.textContent = String(total);
  elements.statTopScore.textContent = `${topScore}%`;
  elements.statAverageScore.textContent = `${averageScore}%`;
}

function updateSkillFilterOptions(candidates) {
  const selectedValue = elements.skillFilter.value;
  const skills = Array.from(
    new Set(
      candidates.flatMap((candidate) => candidate.skills || []).map((skill) => String(skill).toLowerCase())
    )
  ).sort();

  elements.skillFilter.innerHTML = `<option value="">All Skills</option>${skills
    .map((skill) => `<option value="${skill}">${skill}</option>`)
    .join("")}`;

  elements.skillFilter.value = skills.includes(selectedValue) ? selectedValue : "";
}

function getFilteredCandidates() {
  const searchTerm = elements.searchInput.value.trim().toLowerCase();
  const skillFilter = elements.skillFilter.value;
  const sortBy = elements.sortBy.value;

  const filtered = state.candidates.filter((candidate) => {
    const haystack = `${candidate.name} ${(candidate.skills || []).join(" ")} ${candidate.experience}`.toLowerCase();
    const matchesSearch = !searchTerm || haystack.includes(searchTerm);
    const matchesSkill = !skillFilter || (candidate.skills || []).map((skill) => skill.toLowerCase()).includes(skillFilter);
    return matchesSearch && matchesSkill;
  });

  filtered.sort((left, right) => {
    if (sortBy === "score-asc") {
      return left.score - right.score;
    }
    if (sortBy === "name-asc") {
      return left.name.localeCompare(right.name);
    }
    if (sortBy === "recent-desc") {
      return new Date(right.uploadTime) - new Date(left.uploadTime);
    }
    return right.score - left.score;
  });

  return filtered.map((candidate, index) => ({
    ...candidate,
    rank: index + 1
  }));
}

function renderCandidateCards(candidates) {
  if (!candidates.length) {
    elements.candidateList.innerHTML = `
      <div class="empty-state">
        <div>
          <strong>No candidates match the current filters.</strong>
          <p>Upload a new resume or adjust the search and sort controls.</p>
        </div>
      </div>
    `;
    return;
  }

  elements.candidateList.innerHTML = candidates
    .map(
      (candidate) => `
        <article class="candidate-card">
          <div class="candidate-header">
            <div>
              <h4>${candidate.name || "Unknown Candidate"}</h4>
              <p class="candidate-meta">${candidate.experience || "Not specified"} • ${new Date(candidate.uploadTime).toLocaleString()}</p>
              <p class="candidate-meta">${candidate.roleLabel || candidate.role || "General Role"}</p>
            </div>
            <span class="badge ${candidate.rank <= 3 ? "top" : "muted"}">${candidate.rank <= 3 ? `Top ${candidate.rank}` : `#${candidate.rank}`}</span>
          </div>

          <div class="pill-row">
            ${(candidate.skills || []).map((skill) => `<span class="skill-pill">${skill}</span>`).join("") || `<span class="skill-pill">No skills detected</span>`}
          </div>

          <div>
            <div class="score-label">
              <span>Candidate Score</span>
              <span>${candidate.score}%</span>
            </div>
            <div class="score-track">
              <div class="score-fill" style="width:${candidate.score || 0}%"></div>
            </div>
          </div>

          <div class="candidate-footer">
            <span class="candidate-meta">${candidate.sourceFileName || "Resume uploaded"}</span>
            <div class="card-actions">
              <button class="ghost-button resume-copy" type="button" data-resume-url="${candidate.resumeUrl || ""}">Copy Resume Path</button>
              <button class="ghost-button danger-button candidate-delete" type="button" data-candidate-id="${candidate.id}">Delete</button>
            </div>
          </div>
        </article>
      `
    )
    .join("");
}

function renderRanking(candidates) {
  const topCandidates = candidates.slice(0, 5);

  if (!topCandidates.length) {
    elements.rankingList.innerHTML = `
      <div class="empty-state">
        <div>
          <strong>No ranking data yet.</strong>
          <p>Once candidates are processed, top performers will appear here.</p>
        </div>
      </div>
    `;
    return;
  }

  elements.rankingList.innerHTML = topCandidates
    .map(
      (candidate, index) => `
        <article class="leaderboard-card ${index === 0 ? "top-rank" : ""}">
          <div class="leaderboard-header">
            <div>
              <h4>${candidate.name}</h4>
              <p class="leaderboard-meta">${candidate.experience || "Not specified"}</p>
              <p class="leaderboard-meta">${candidate.roleLabel || candidate.role || "General Role"}</p>
            </div>
            <div class="rank-badge">#${index + 1}</div>
          </div>
          <div class="score-label">
            <span>${index === 0 ? "Top Match" : "Match Score"}</span>
            <span>${candidate.score}%</span>
          </div>
          <div class="score-track">
            <div class="score-fill" style="width:${candidate.score || 0}%"></div>
          </div>
          <div class="pill-row" style="margin-top:14px;">
            ${(candidate.skills || []).slice(0, 4).map((skill) => `<span class="skill-pill">${skill}</span>`).join("")}
          </div>
        </article>
      `
    )
    .join("");
}

function renderAll() {
  state.filteredCandidates = getFilteredCandidates();
  updateStats(state.candidates);
  renderCandidateCards(state.filteredCandidates);
  renderRanking(state.filteredCandidates.length ? state.filteredCandidates : state.candidates);
}

async function requestPresignedUrl(apiBaseUrl, file, requiredSkills) {
  const response = await fetch(`${apiBaseUrl}/uploads/presign`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
      requiredSkills,
      role: elements.roleSelect.value
    })
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Unable to create upload URL: ${details}`);
  }

  return response.json();
}

async function uploadResume(uploadUrl, file, headers) {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers,
    body: file
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Resume upload failed (${response.status}): ${details}`);
  }
}

async function loadCandidates() {
  const apiBaseUrl = elements.apiBaseUrl.value.trim();
  if (!apiBaseUrl) {
    state.candidates = [];
    renderAll();
    return;
  }

  createSkeletons();

  try {
    const response = await fetch(`${apiBaseUrl}/candidates`);
    if (!response.ok) {
      throw new Error("Failed to fetch candidates from API");
    }

    const data = await response.json();
    state.candidates = data.candidates || [];
    updateSkillFilterOptions(state.candidates);
    renderAll();
  } catch (error) {
    elements.candidateList.innerHTML = `
      <div class="empty-state">
        <div>
          <strong>Unable to load candidates.</strong>
          <p>${error.message}</p>
        </div>
      </div>
    `;
    elements.rankingList.innerHTML = `
      <div class="empty-state">
        <div>
          <strong>Ranking unavailable.</strong>
          <p>Check the API base URL and try refreshing again.</p>
        </div>
      </div>
    `;
    showToast(error.message, "error");
  }
}

async function copyResumePath(value) {
  if (!value) {
    showToast("No resume path available for this candidate.", "error");
    return;
  }

  try {
    await navigator.clipboard.writeText(value);
    showToast("Resume path copied to clipboard.", "success");
  } catch (error) {
    showToast("Unable to copy resume path.", "error");
  }
}

async function deleteCandidate(candidateId) {
  const apiBaseUrl = elements.apiBaseUrl.value.trim();

  if (!apiBaseUrl) {
    showToast("Add the API base URL before deleting a candidate.", "error");
    return;
  }

  if (!candidateId) {
    showToast("Candidate id is missing.", "error");
    return;
  }

  const confirmed = window.confirm("Delete this candidate and the stored resume file?");
  if (!confirmed) {
    return;
  }

  try {
    showToast("Deleting candidate...", "info");
    const response = await fetch(`${apiBaseUrl}/candidates/${candidateId}`, {
      method: "DELETE"
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(`Delete failed: ${details}`);
    }

    state.candidates = state.candidates.filter((candidate) => candidate.id !== candidateId);
    updateSkillFilterOptions(state.candidates);
    renderAll();
    showToast("Candidate deleted successfully.", "success");
    loadCandidates();
  } catch (error) {
    showToast(error.message, "error");
  }
}

function activateSection(sectionName) {
  document.querySelectorAll(".nav-link").forEach((button) => {
    button.classList.toggle("active", button.dataset.section === sectionName);
  });

  const targetMap = {
    dashboard: document.querySelector(".hero-banner"),
    upload: document.getElementById("section-upload"),
    candidates: document.getElementById("section-candidates"),
    ranking: document.getElementById("section-ranking")
  };

  targetMap[sectionName]?.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function handleUpload() {
  const apiBaseUrl = elements.apiBaseUrl.value.trim();

  if (!apiBaseUrl) {
    showToast("Add the deployed API base URL before uploading.", "error");
    return;
  }

  if (!state.selectedFile) {
    showToast("Select a resume file first.", "error");
    return;
  }

  elements.uploadBtn.disabled = true;
  runProgressSequence([
    { value: 12, label: "Preparing secure upload request..." },
    { value: 34, label: "Requesting signed URL from API Gateway..." }
  ]);

  try {
    const presign = await requestPresignedUrl(apiBaseUrl, state.selectedFile, "");
    runProgressSequence([
      { value: 52, label: "Signed URL received. Uploading to Amazon S3..." },
      { value: 76, label: "Resume upload in progress..." }
    ]);

    await uploadResume(presign.uploadUrl, state.selectedFile, presign.requiredHeaders);
    setProgress(100, "Upload complete. Lambda and analysis services are processing the resume.");
    showToast("Resume uploaded successfully.", "success");
    window.setTimeout(() => {
      resetUploadUi();
      loadCandidates();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 1800);
  } catch (error) {
    setProgress(0, error.message);
    showToast(error.message, "error");
  } finally {
    elements.uploadBtn.disabled = false;
    window.clearInterval(state.progressTimer);
  }
}

elements.selectFileBtn.addEventListener("click", () => elements.resumeFile.click());
elements.resumeFile.addEventListener("change", (event) => setSelectedFile(event.target.files[0]));
elements.uploadBtn.addEventListener("click", handleUpload);
elements.refreshBtn.addEventListener("click", loadCandidates);
elements.searchInput.addEventListener("input", renderAll);
elements.skillFilter.addEventListener("change", renderAll);
elements.sortBy.addEventListener("change", renderAll);
elements.roleSelect.addEventListener("change", () => {
  updateRoleDescription();
  renderFilePreview(state.selectedFile);
});
elements.apiBaseUrl.addEventListener("change", () => {
  window.localStorage.setItem("resumeai.apiBaseUrl", elements.apiBaseUrl.value.trim());
  loadCandidates();
});

elements.candidateList.addEventListener("click", (event) => {
  const button = event.target.closest(".resume-copy");
  if (button) {
    copyResumePath(button.dataset.resumeUrl);
    return;
  }

  const deleteButton = event.target.closest(".candidate-delete");
  if (deleteButton) {
    deleteCandidate(deleteButton.dataset.candidateId);
  }
});

document.querySelectorAll(".nav-link").forEach((button) => {
  button.addEventListener("click", () => activateSection(button.dataset.section));
});

["dragenter", "dragover"].forEach((eventName) => {
  elements.dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    elements.dropzone.classList.add("dragover");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  elements.dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    elements.dropzone.classList.remove("dragover");
  });
});

elements.dropzone.addEventListener("drop", (event) => {
  const file = event.dataTransfer?.files?.[0];
  if (file) {
    setSelectedFile(file);
  }
});

renderFilePreview(null);
renderRoleOptions();
elements.apiBaseUrl.value = state.savedApiBaseUrl;
renderAll();

if (state.savedApiBaseUrl) {
  loadCandidates();
}
