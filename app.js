/* app.js - MP DTE 2025 B.Tech Cutoff Predictor Logic (Performance, Wizard & Strategy Optimized) */

// --- Global Constants & State ---
const PAGE_SIZE = 30;
let filteredRecords = [];
let strategyRecords = [];
let displayedCount = 0;
let activeBranchFilter = "ALL";

// --- College Alias Map for Smarter Search ---
const COLLEGE_ALIASES = {
    "sgsits": ["shri g.s. institute of technology", "sgsits", "sgs"],
    "mits": ["madhav institute of technology", "mits"],
    "iet": ["institute of engineering and technology", "iet", "davv"],
    "davv": ["institute of engineering and technology", "iet", "davv"],
    "jec": ["jabalpur engineering college", "jec"],
    "uec": ["ujjain engineering college", "uec"],
    "sati": ["samrat ashok technological institute", "sati"],
    "lnct": ["lakshmi narain college of technology", "lnct"],
    "acropolis": ["acropolis institute of technology", "acropolis"],
    "ips": ["ips academy", "ips"]
};

// --- Friendly Branch Code Mappings ---
const BRANCH_NAMES = {
    "CSE": "Computer Science & Engineering",
    "CS": "Computer Science & Engineering",
    "IT": "Information Technology",
    "EC": "Electronics & Communication Engineering",
    "ET": "Electronics & Telecommunication Engineering",
    "EE": "Electrical Engineering",
    "EX": "Electrical & Electronics Engineering",
    "CE": "Civil Engineering",
    "ME": "Mechanical Engineering",
    "MECH": "Mechanical Engineering",
    "CHEM": "Chemical Engineering",
    "CH": "Chemical Engineering",
    "BT": "Biotechnology",
    "BM": "Biomedical Engineering",
    "EI": "Electronics & Instrumentation Engineering",
    "IP": "Industrial & Production Engineering",
    "AIML": "CS (Artificial Intelligence & Machine Learning)",
    "AI": "Artificial Intelligence",
    "AIADS": "CS (AI & Data Science)",
    "AIAIDS": "CS (AI & Artificial Intelligence)",
    "CSEAI": "CS (Artificial Intelligence)",
    "CSEIML": "CS (AI & Machine Learning)",
    "CSEDS": "CS (Data Science)",
    "CSD": "Computer Science & Design",
    "CSBS": "Computer Science & Business Systems",
    "CYSEC": "CS (Cyber Security)",
    "AUTO": "Automobile Engineering",
    "MINING": "Mining Engineering",
    "AG": "Agricultural Engineering",
    "AGE": "Agricultural Engineering"
};

// --- DOM Element Cache ---
const elements = {
    // Screens
    screenForm: document.getElementById('screen-form'),
    screenResults: document.getElementById('screen-results'),
    screenStrategy: document.getElementById('screen-strategy'),
    
    // Forms & Inputs
    predictorForm: document.getElementById('predictor-form'),
    rankInput: document.getElementById('input-rank'),
    domicileSelect: document.getElementById('select-domicile'),
    categorySelect: document.getElementById('select-category'),
    genderSelect: document.getElementById('select-gender'),
    examSelect: document.getElementById('select-exam'),
    tfwCheck: document.getElementById('check-tfw'),
    
    // Rounds Checkboxes
    checkR1: document.getElementById('check-r1'),
    checkR1Up: document.getElementById('check-r1-up'),
    checkR2: document.getElementById('check-r2'),
    checkR3: document.getElementById('check-r3'),
    
    // Navigation / Actions
    btnBack: document.getElementById('btn-back'),
    btnExport: document.getElementById('btn-export'),
    resultsMetaDesc: document.getElementById('results-meta-desc'),
    btnShowStrategy: document.getElementById('btn-show-strategy'),
    
    btnBackToResults: document.getElementById('btn-back-to-results'),
    btnExportStrategy: document.getElementById('btn-export-strategy'),
    strategyMetaDesc: document.getElementById('strategy-meta-desc'),
    strategyTableBody: document.getElementById('strategy-table-body'),
    
    // Toolbar controls
    searchInput: document.getElementById('input-search'),
    sortSelect: document.getElementById('select-sort'),
    chanceSelect: document.getElementById('select-chance'),
    
    // Layout groups
    categoryGroup: document.getElementById('category-group'),
    genderGroup: document.getElementById('gender-group'),
    tfwGroup: document.getElementById('tfw-group'),
    
    // Output Containers
    resultsGrid: document.getElementById('results-grid'),
    loadingState: document.getElementById('loading'),
    emptyState: document.getElementById('empty-state'),
    
    // Stats elements
    statCount: document.getElementById('stat-count'),
    statHigh: document.getElementById('stat-high'),
    statBorderline: document.getElementById('stat-borderline'),
    
    // Pagination
    paginationPanel: document.getElementById('pagination-panel'),
    pageInfo: document.getElementById('page-info'),
    btnLoadMore: document.getElementById('btn-load-more'),
    
    branchPillsContainer: document.getElementById('branch-pills')
};

// --- Event Listeners Setup ---
function init() {
    // Check if CUTOFF_DATA exists
    if (typeof CUTOFF_DATA === 'undefined') {
        console.error("CUTOFF_DATA is not loaded. Please ensure data.js is included before app.js.");
        showErrorState("Data loading error. Please regenerate data.js using compile_data.py.");
        return;
    }

    // Intercept Form Submit (Step 1 -> Step 2)
    if (elements.predictorForm) {
        elements.predictorForm.addEventListener('submit', handleFormSubmit);
    }

    // Back to form button
    if (elements.btnBack) {
        elements.btnBack.addEventListener('click', handleBackToForm);
    }

    // Results Export Button
    if (elements.btnExport) {
        elements.btnExport.addEventListener('click', exportToExcel);
    }

    // Show Choice Filling Strategy (Step 2 -> Step 3)
    if (elements.btnShowStrategy) {
        elements.btnShowStrategy.addEventListener('click', handleShowStrategy);
    }

    // Back to Results button
    if (elements.btnBackToResults) {
        elements.btnBackToResults.addEventListener('click', handleBackToResults);
    }

    // Strategy Export Button
    if (elements.btnExportStrategy) {
        elements.btnExportStrategy.addEventListener('click', exportStrategyToExcel);
    }

    // Immediate filters inside Screen 2 (runs instant predictions on list options)
    const toolbarInputs = [
        elements.sortSelect, elements.chanceSelect
    ];
    toolbarInputs.forEach(el => {
        if (el) el.addEventListener('change', runFilterAndRender);
    });

    // Debounced text search filter
    if (elements.searchInput) {
        elements.searchInput.addEventListener('input', queueFilter);
    }

    // Domicile triggers visibility updates
    if (elements.domicileSelect) {
        elements.domicileSelect.addEventListener('change', toggleDomicileControls);
    }

    // Branch Pill clicks
    if (elements.branchPillsContainer) {
        elements.branchPillsContainer.addEventListener('click', handleBranchPillClick);
    }

    // Load More button
    if (elements.btnLoadMore) {
        elements.btnLoadMore.addEventListener('click', loadMore);
    }

    // Initial setups
    toggleDomicileControls();
}

// --- Toggle Category/Gender visibility based on Domicile ---
function toggleDomicileControls() {
    const isMP = elements.domicileSelect.value === 'MP';
    if (isMP) {
        elements.categoryGroup.classList.remove('hidden');
        elements.genderGroup.classList.remove('hidden');
        elements.tfwGroup.classList.remove('hidden');
    } else {
        elements.categoryGroup.classList.add('hidden');
        elements.genderGroup.classList.add('hidden');
        elements.tfwGroup.classList.add('hidden');
    }
}

// --- Navigation: Form Submit (Screen 1 -> Screen 2) ---
function handleFormSubmit(e) {
    e.preventDefault();
    
    const rankValue = elements.rankInput.value.trim();
    if (!rankValue || isNaN(rankValue) || parseInt(rankValue) <= 0) {
        alert("Please enter a valid rank.");
        return;
    }

    // Run matching engine and populate list
    runFilterAndRender();
    
    // Update Meta description on Results page
    updateResultsMetaText();
    
    // Switch screens
    elements.screenForm.classList.remove('active-screen');
    elements.screenForm.classList.add('hidden-screen');
    
    elements.screenResults.classList.remove('hidden-screen');
    elements.screenResults.classList.add('active-screen');
    
    // Scroll page to top
    window.scrollTo({ top: 0, behavior: 'instant' });
}

// --- Navigation: Back to Form (Screen 2 -> Screen 1) ---
function handleBackToForm() {
    elements.screenResults.classList.remove('active-screen');
    elements.screenResults.classList.add('hidden-screen');
    
    elements.screenForm.classList.remove('hidden-screen');
    elements.screenForm.classList.add('active-screen');
    
    window.scrollTo({ top: 0, behavior: 'instant' });
}

// --- Navigation: Show Strategy (Screen 2 -> Screen 3) ---
function handleShowStrategy() {
    // Generate the recommended choice-filling lists
    generateStrategy();
    
    // Update strategy metadata
    const rank = parseInt(elements.rankInput.value).toLocaleString('en-IN');
    elements.strategyMetaDesc.textContent = `Rank: ${rank} | Recommended Choice Preference List`;
    
    // Transition screens
    elements.screenResults.classList.remove('active-screen');
    elements.screenResults.classList.add('hidden-screen');
    
    elements.screenStrategy.classList.remove('hidden-screen');
    elements.screenStrategy.classList.add('active-screen');
    
    window.scrollTo({ top: 0, behavior: 'instant' });
}

// --- Navigation: Back to Results (Screen 3 -> Screen 2) ---
function handleBackToResults() {
    elements.screenStrategy.classList.remove('active-screen');
    elements.screenStrategy.classList.add('hidden-screen');
    
    elements.screenResults.classList.remove('hidden-screen');
    elements.screenResults.classList.add('active-screen');
    
    window.scrollTo({ top: 0, behavior: 'instant' });
}

// --- Update Meta Information Text ---
function updateResultsMetaText() {
    const rank = parseInt(elements.rankInput.value).toLocaleString('en-IN');
    const exam = elements.examSelect.value === 'JEE' ? 'JEE CRL' : '12th Marks';
    
    if (elements.domicileSelect.value === 'AI') {
        elements.resultsMetaDesc.textContent = `Rank: ${rank} (${exam}) | All India Candidate`;
    } else {
        const cat = elements.categorySelect.value;
        const gen = elements.genderSelect.value === 'M' ? 'Male' : 'Female';
        const tfw = elements.tfwCheck.checked ? ' + TFW' : '';
        elements.resultsMetaDesc.textContent = `Rank: ${rank} (${exam}) | MP Domicile | ${cat} | ${gen}${tfw}`;
    }
}

// --- Pill Selector Handlers ---
function handleBranchPillClick(e) {
    const pill = e.target.closest('.pill');
    if (!pill) return;
    
    const pills = elements.branchPillsContainer.querySelectorAll('.pill');
    pills.forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    
    activeBranchFilter = pill.getAttribute('data-branch');
    runFilterAndRender();
}

// --- Debounce local text search calls ---
let filterTimeout;
function queueFilter() {
    clearTimeout(filterTimeout);
    filterTimeout = setTimeout(() => {
        runFilterAndRender();
    }, 120);
}

// --- Core Matching Logic ---
function runFilterAndRender() {
    const rankValue = elements.rankInput.value.trim();
    if (!rankValue || isNaN(rankValue) || parseInt(rankValue) <= 0) return;
    
    const rank = parseInt(rankValue);
    const domicile = elements.domicileSelect.value;
    const category = elements.categorySelect.value;
    const gender = elements.genderSelect.value;
    const exam = elements.examSelect.value;
    const showTfw = elements.tfwCheck.checked;
    
    // Counselling Rounds
    const rounds = [];
    if (elements.checkR1.checked) rounds.push("Round 1");
    if (elements.checkR1Up.checked) rounds.push("Round 1 Upgrade");
    if (elements.checkR2.checked) rounds.push("Round 2");
    if (elements.checkR3.checked) rounds.push("Internal Branch Change");
    
    // Get Eligible Reservation Categories for MP Domicile
    const eligibleCategories = getEligibleReservationCategories(category, gender, showTfw);
    
    // Text Search Queries
    const searchQuery = elements.searchInput.value.toLowerCase().trim();
    const searchWords = searchQuery.split(/\s+/).filter(w => w.length > 0);
    
    const chanceFilter = elements.chanceSelect.value;
    const sortVal = elements.sortSelect.value;

    // Filter the records array
    filteredRecords = CUTOFF_DATA.filter(record => {
        // 1. Exam Type Match
        if (record.exam !== exam) return false;
        
        // 2. Counselling Round Match
        if (!rounds.includes(record.round)) return false;
        
        // 3. Domicile & Category Quota Rules
        if (domicile === 'AI') {
            // All India Candidate: Only eligible for All India seats
            if (record.domicile !== 'AI') return false;
        } else {
            // MP Candidate: Eligible for AI seats OR MP seats that match their category ladder
            if (record.domicile === 'MP') {
                if (!eligibleCategories.has(record.allotted_cat)) return false;
            } else if (record.domicile !== 'AI') {
                return false;
            }
        }
        
        // 4. Branch Category Filter (from Pills)
        if (activeBranchFilter !== "ALL") {
            const cat = getBranchCategory(record.branch, getCleanBranchName(record.branch));
            if (cat !== activeBranchFilter) return false;
        }
        
        // 5. Text Search matching
        if (searchWords.length > 0) {
            if (!recordMatchesSearch(record, searchWords)) return false;
        }
        
        // 6. Chance Threshold Filter
        const chance = getChanceLevel(rank, record.cl_rank);
        if (chanceFilter === 'high' && chance !== 'high') return false;
        if (chanceFilter === 'borderline' && chance !== 'borderline') return false;
        if (chanceFilter === 'all' && chance === 'low') return false; 
        
        return true;
    });

    // Sort the filtered results
    sortRecords(filteredRecords, sortVal);
    
    // Compute Counts for Stats cards
    updateStatsGrid(rank);
    
    // Display results
    displayedCount = 0;
    elements.resultsGrid.innerHTML = '';
    elements.loadingState.classList.add('hidden');
    
    if (filteredRecords.length === 0) {
        showNoResultsEmptyState();
        elements.paginationPanel.classList.add('hidden');
    } else {
        elements.emptyState.classList.add('hidden');
        elements.resultsGrid.classList.remove('hidden');
        loadMore(); // Load first batch of results
        elements.paginationPanel.classList.remove('hidden');
    }
}

// --- Get Reservation Ladder Categories ---
function getEligibleReservationCategories(category, gender, showTfw) {
    const list = new Set();
    
    // Every MP domicile candidate is eligible for UR (General) state quota seats
    list.add('UR/X/OP');
    list.add('UR/X/OPAI');
    
    // Female general seats
    if (gender === 'F') {
        list.add('UR/X/F');
    }
    
    // Reserved Categories add their own specific seat quotas
    if (category === 'EWS') {
        list.add('EWS');
    } else if (category === 'OBC') {
        list.add('OBC/X/OP');
        if (gender === 'F') {
            list.add('OBC/X/F');
        }
    } else if (category === 'SC') {
        list.add('SC/X/OP');
        if (gender === 'F') {
            list.add('SC/X/F');
        }
    } else if (category === 'ST') {
        list.add('ST/X/OP');
        if (gender === 'F') {
            list.add('ST/X/F');
        }
    }
    
    // TFW option (only valid for MP candidates)
    if (showTfw) {
        list.add('FW/OP');
    }
    
    return list;
}

// --- Check if Branch falls into Pill Categories ---
function getBranchCategory(branchCode, branchName) {
    const code = (branchCode || "").toUpperCase().trim();
    const name = (branchName || "").toUpperCase().trim();
    
    if (code.includes("CS") || code.includes("AI") || code.includes("ML") || code.includes("DS") || 
        code.includes("IOT") || code.includes("DATA") || code.includes("CYBER") ||
        name.includes("COMPUTER") || name.includes("ARTIFICIAL") || name.includes("MACHINE LEARNING") || 
        name.includes("DATA SCIENCE") || name.includes("CYBER") || name.includes("INTERNET OF THINGS")) {
        return "CSE";
    }
    
    if (code.includes("IT") || name.includes("INFORMATION TECHNOLOGY")) {
        return "IT";
    }
    
    if (code.includes("EC") || code.includes("ET") || code.includes("ELEX") || 
        name.includes("ELECTRONIC") || name.includes("TELECOMMUNICATION")) {
        return "EC";
    }
    
    if (code.includes("EE") || code.includes("EX") || code.includes("EL") || 
        name.includes("ELECTRICAL") || name.includes("POWER")) {
        return "EE";
    }
    
    if (code.includes("ME") || code.includes("MECH") || code.includes("AUTO") || 
        name.includes("MECHANICAL") || name.includes("AUTOMOBILE") || name.includes("PRODUCTION")) {
        return "MECH";
    }
    
    if (code === "CE" || code.startsWith("CE") || name.includes("CIVIL")) {
        return "CE";
    }
    
    return "OTHER";
}

// --- Human Readable Branch Name Getter ---
function getCleanBranchName(branch) {
    if (!branch) return "";
    const upper = branch.toUpperCase().trim();
    if (BRANCH_NAMES[upper]) {
        return BRANCH_NAMES[upper];
    }
    // Clean up text-extraction errors
    if (branch.length > 10) {
        return branch.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    }
    return branch;
}

// --- Text Search Matching logic ---
function recordMatchesSearch(record, searchWords) {
    const instName = record.inst_name.toLowerCase();
    const branchCode = record.branch.toLowerCase();
    const branchNameFull = getCleanBranchName(record.branch).toLowerCase();
    
    return searchWords.every(word => {
        // Expand aliases
        if (COLLEGE_ALIASES[word]) {
            const matchesAlias = COLLEGE_ALIASES[word].some(term => instName.includes(term));
            if (matchesAlias) return true;
        }
        
        return instName.includes(word) || 
               branchCode.includes(word) || 
               branchNameFull.includes(word);
    });
}

// --- Chance Level Calculator ---
function getChanceLevel(rank, clRank) {
    if (rank <= 0.8 * clRank) {
        return "high"; // 🟢
    } else if (rank <= clRank) {
        return "borderline"; // 🟡
    } else {
        return "low"; // 🔴
    }
}

// --- Sorting ---
function sortRecords(records, sortType) {
    records.sort((a, b) => {
        if (sortType === 'cl_rank_asc') {
            return a.cl_rank - b.cl_rank;
        } else if (sortType === 'cl_rank_desc') {
            return b.cl_rank - a.cl_rank;
        } else if (sortType === 'college_asc') {
            return a.inst_name.localeCompare(b.inst_name);
        } else if (sortType === 'branch_asc') {
            return a.branch.localeCompare(b.branch);
        }
        return 0;
    });
}

// --- Stats Generator ---
function updateStatsGrid(rank) {
    let highCount = 0;
    let borderlineCount = 0;
    
    filteredRecords.forEach(record => {
        const chance = getChanceLevel(rank, record.cl_rank);
        if (chance === 'high') highCount++;
        else if (chance === 'borderline') borderlineCount++;
    });
    
    elements.statCount.textContent = filteredRecords.length.toLocaleString('en-IN');
    elements.statHigh.textContent = highCount.toLocaleString('en-IN');
    elements.statBorderline.textContent = borderlineCount.toLocaleString('en-IN');
}

// --- Load and Render Next Page Batch - Performance Optimized ---
function loadMore() {
    const start = displayedCount;
    const end = Math.min(displayedCount + PAGE_SIZE, filteredRecords.length);
    const rank = parseInt(elements.rankInput.value);
    
    let html = '';
    for (let i = start; i < end; i++) {
        html += createResultCardHtml(filteredRecords[i], rank);
    }
    elements.resultsGrid.insertAdjacentHTML('beforeend', html);
    
    displayedCount = end;
    
    // Update Pagination controls
    elements.pageInfo.textContent = `Showing ${displayedCount.toLocaleString('en-IN')} of ${filteredRecords.length.toLocaleString('en-IN')} options`;
    
    if (displayedCount >= filteredRecords.length) {
        elements.btnLoadMore.classList.add('hidden');
    } else {
        elements.btnLoadMore.classList.remove('hidden');
    }
}

// --- Generate HTML for a Card ---
function createResultCardHtml(record, rank) {
    const chance = getChanceLevel(rank, record.cl_rank);
    const formattedCutoff = record.cl_rank.toLocaleString('en-IN');
    const formattedOp = record.op_rank.toLocaleString('en-IN');
    const branchName = getCleanBranchName(record.branch);
    
    // Gov vs Private styling
    const instTypeBadge = getInstTypeBadgeHtml(record.inst_type);
    
    // Chance display HTML
    let chanceHtml = '';
    if (chance === 'high') {
        chanceHtml = `<span class="chance-badge"><i class="fa-solid fa-circle-check"></i> High Chance</span>`;
    } else if (chance === 'borderline') {
        chanceHtml = `<span class="chance-badge"><i class="fa-solid fa-circle-exclamation"></i> Borderline</span>`;
    } else {
        chanceHtml = `<span class="chance-badge"><i class="fa-solid fa-triangle-exclamation"></i> Low Cutoff</span>`;
    }
    
    // Round details & category allotment explanation
    let categoryMeta = `Allotted: ${record.allotted_cat}`;
    if (record.eligible_cat) {
        categoryMeta += ` (via ${record.eligible_cat})`;
    }
    
    let remarksMeta = '';
    if (record.remarks) {
        remarksMeta = `<span><i class="fa-solid fa-circle-info"></i> ${record.remarks}</span>`;
    }

    const tFWIndicator = record.fw === 'Y' ? `<span class="badge-fw inst-type-badge badge-govt" style="background:rgba(37,99,235,0.1); border-color:rgba(37,99,235,0.25); color:#60a5fa; margin-left:0.25rem;">TFW Seat</span>` : '';

    return `
        <div class="result-card chance-${chance}">
            <div class="card-details">
                <div class="card-title-row">
                    ${instTypeBadge}
                    ${tFWIndicator}
                    <h3 class="college-name">${escapeHtml(record.inst_name)}</h3>
                </div>
                <div class="branch-info">
                    <span class="branch-tag">${escapeHtml(record.branch)}</span>
                    <span class="branch-name-full">${escapeHtml(branchName)}</span>
                </div>
                <div class="card-meta">
                    <span><i class="fa-solid fa-circle-nodes"></i> ${escapeHtml(record.round)}</span>
                    <span><i class="fa-solid fa-users"></i> ${escapeHtml(categoryMeta)}</span>
                    <span><i class="fa-solid fa-clipboard-question"></i> ${record.exam === 'JEE' ? 'JEE Main Rank' : 'Qualifying 12th Board'}</span>
                    ${remarksMeta}
                </div>
            </div>
            <div class="card-stats">
                <div class="cutoff-box">
                    <span class="cutoff-label">2025 Closing Rank</span>
                    <span class="cutoff-val">${formattedCutoff}</span>
                    <span class="field-hint" style="text-align:right;">Opening: ${formattedOp}</span>
                </div>
                <div class="chance-box">
                    ${chanceHtml}
                </div>
            </div>
        </div>
    `;
}

// --- Institute Type Badge Generator ---
function getInstTypeBadgeHtml(type) {
    const t = (type || "").toUpperCase().trim();
    if (t.includes("GOVT") || t.includes("AIDED")) {
        return `<span class="inst-type-badge badge-govt">Govt / Aided</span>`;
    } else {
        return `<span class="inst-type-badge badge-private">Private / SFI</span>`;
    }
}

// --- Escape HTML to prevent XSS ---
function escapeHtml(str) {
    if (!str) return '';
    return str.toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// --- Error Screen ---
function showErrorState(message) {
    elements.resultsGrid.innerHTML = '';
    elements.loadingState.classList.add('hidden');
    elements.paginationPanel.classList.add('hidden');
    elements.emptyState.classList.remove('hidden');
    elements.emptyState.innerHTML = `
        <i class="fa-solid fa-triangle-exclamation" style="font-size:3rem; color:var(--danger)"></i>
        <h3>Error Occurred</h3>
        <p>${escapeHtml(message)}</p>
    `;
}

// --- Empty Filter Screen ---
function showNoResultsEmptyState() {
    elements.emptyState.classList.remove('hidden');
    elements.emptyState.innerHTML = `
        <i class="fa-solid fa-magnifying-glass-chart empty-icon"></i>
        <h3>No Matching Options Found</h3>
        <p>We couldn't find any seat closing ranks above your entered rank with the selected criteria. Go back and try changing categories, choosing more rounds, or expanding your inputs.</p>
    `;
}

// --- Excel (CSV) Export Utility ---
function exportToExcel() {
    if (filteredRecords.length === 0) {
        alert("No records available to export.");
        return;
    }

    const rankVal = parseInt(elements.rankInput.value) || 0;
    
    const headers = [
        "S. No.",
        "College Name",
        "Type",
        "TFW (Yes/No)",
        "Branch Code",
        "Branch Name",
        "Exam Type",
        "Round",
        "Allotted Category",
        "Eligible Category",
        "Domicile Quota",
        "2025 Opening Rank",
        "2025 Closing Rank",
        "Allotted Count",
        "Chances Level",
        "Remarks"
    ];
    
    const rows = filteredRecords.map((r, index) => {
        const branchFull = getCleanBranchName(r.branch);
        const chance = getChanceLevel(rankVal, r.cl_rank).toUpperCase();
        
        const cleanName = `"${(r.inst_name || '').replace(/'/g, "''").replace(/"/g, '""')}"`;
        const cleanBranchName = `"${branchFull.replace(/'/g, "''").replace(/"/g, '""')}"`;
        const cleanEligibleCat = r.eligible_cat ? `"${r.eligible_cat.replace(/"/g, '""')}"` : '""';
        const cleanRemarks = r.remarks ? `"${r.remarks.replace(/"/g, '""')}"` : '""';

        return [
            index + 1,
            cleanName,
            r.inst_type.toUpperCase(),
            r.fw === 'Y' ? 'YES' : 'NO',
            r.branch,
            cleanBranchName,
            r.exam,
            r.round,
            r.allotted_cat,
            cleanEligibleCat,
            r.domicile,
            r.op_rank,
            r.cl_rank,
            r.total_allotted,
            chance,
            cleanRemarks
        ].join(',');
    });

    const csvContent = "\uFEFF" + headers.join(',') + '\n' + rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.setAttribute("href", url);
    
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const filename = `MP_DTE_Options_${rankVal}_${timestamp}.csv`;
    link.setAttribute("download", filename);
    
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// --- College Ranking Weight Matrix ---
function getCollegePrestigeScore(name) {
    const n = name.toLowerCase();
    if (n.includes("shri g.s.") || n.includes("sgsits")) return 1;
    if (n.includes("davv") || n.includes("iet")) return 2;
    if (n.includes("madhav") || n.includes("mits")) return 3;
    if (n.includes("jabalpur") || n.includes("jec")) return 4;
    if ((n.includes("rgpv") || n.includes("rajiv gandhi")) && n.includes("bhopal")) return 5;
    if (n.includes("ujjain") || n.includes("uec")) return 6;
    if (n.includes("samrat") || n.includes("sati")) return 7;
    if (n.includes("rewa")) return 8;
    if (n.includes("sagar") || n.includes("indira gandhi")) return 9;
    if (n.includes("uit") && (n.includes("jhabua") || n.includes("shahdol"))) return 10;
    
    // Premium Private
    if (n.includes("lakshmi narain") || n.includes("lnct") || 
        n.includes("acropolis") || n.includes("ips academy")) return 11;
        
    return 12;
}

// --- Branch Ranking Weight Matrix ---
function getBranchPriorityScore(branchCode, branchName) {
    const code = (branchCode || "").toUpperCase().trim();
    const name = (branchName || "").toUpperCase().trim();
    
    // CSE Exact
    if (code === "CSE" || code === "CS" || name === "COMPUTER SCIENCE & ENGINEERING" || name === "COMPUTER SCIENCE") {
        return 1;
    }
    // IT
    if (code === "IT" || name === "INFORMATION TECHNOLOGY") {
        return 2;
    }
    // CS Specializations (AIML, Data Science, Cyber Security, etc.)
    if (code.includes("CS") || code.includes("AI") || code.includes("ML") || code.includes("DS") || 
        code.includes("IOT") || code.includes("DATA") || code.includes("CYBER") ||
        name.includes("COMPUTER") || name.includes("ARTIFICIAL") || name.includes("MACHINE LEARNING") || 
        name.includes("DATA SCIENCE") || name.includes("CYBER") || name.includes("INTERNET OF THINGS")) {
        return 3;
    }
    // EC / ET / ELEX / Electronics
    if (code.includes("EC") || code.includes("ET") || code.includes("ELEX") || 
        name.includes("ELECTRONIC") || name.includes("TELECOMMUNICATION")) {
        return 4;
    }
    // EE / EX / EL / Electrical
    if (code.includes("EE") || code.includes("EX") || code.includes("EL") || 
        name.includes("ELECTRICAL") || name.includes("POWER")) {
        return 5;
    }
    // EI (Instrumentation) / IP (Production) / Biomed / Biotech
    if (code.includes("EI") || code.includes("IP") || code.includes("BM") || code.includes("BT") || 
        name.includes("INSTRUMENTATION") || name.includes("PRODUCTION") || name.includes("BIOMEDICAL") || name.includes("BIOTECHNOLOGY")) {
        return 6;
    }
    // MECH / ME / Automobile
    if (code.includes("ME") || code.includes("MECH") || code.includes("AUTO") || 
        name.includes("MECHANICAL") || name.includes("AUTOMOBILE") || name.includes("PRODUCTION")) {
        return 7;
    }
    // CE / Civil / CHEM / Chemical
    if (code === "CE" || code.startsWith("CE") || name.includes("CIVIL") || code.includes("CHEM") || name.includes("CHEMICAL")) {
        return 8;
    }
    return 9;
}

// --- Generate recommended Choice Filling list ---
function generateStrategy() {
    const rank = parseInt(elements.rankInput.value);
    
    // Filter records: we only keep 'high' and 'borderline' options for choice filling recommendation
    // Putting options with 0% chance (low/red) is excluded by default to avoid clutter
    strategyRecords = filteredRecords.filter(record => {
        const chance = getChanceLevel(rank, record.cl_rank);
        return chance === 'high' || chance === 'borderline';
    });
    
    // Multi-tier sort:
    // 1. College Prestige Score (prestige 1 is highest, sorted ascending)
    // 2. Branch Priority Score (priority 1 is highest, sorted ascending)
    // 3. TFW seats placed first (fw === 'Y' before 'N')
    // 4. Closing Rank (sorted ascending)
    strategyRecords.sort((a, b) => {
        const prestigeA = getCollegePrestigeScore(a.inst_name);
        const prestigeB = getCollegePrestigeScore(b.inst_name);
        if (prestigeA !== prestigeB) return prestigeA - prestigeB;
        
        const branchA = getBranchPriorityScore(a.branch, getCleanBranchName(a.branch));
        const branchB = getBranchPriorityScore(b.branch, getCleanBranchName(b.branch));
        if (branchA !== branchB) return branchA - branchB;
        
        if (a.fw !== b.fw) {
            return a.fw === 'Y' ? -1 : 1;
        }
        
        return a.cl_rank - b.cl_rank;
    });
    
    // Render Strategy rows in Table
    let html = '';
    strategyRecords.forEach((r, index) => {
        const chance = getChanceLevel(rank, r.cl_rank);
        let chanceBadge = '';
        
        if (chance === 'high') {
            if (rank <= 0.5 * r.cl_rank) {
                chanceBadge = '<span class="chance-badge" style="background:rgba(37,99,235,0.1); color:#60a5fa; border:1px solid rgba(37,99,235,0.2)">Safe (🔵)</span>';
            } else {
                chanceBadge = '<span class="chance-badge" style="background:var(--success-bg); color:var(--success); border:1px solid var(--success-border)">Target (🟢)</span>';
            }
        } else {
            chanceBadge = '<span class="chance-badge" style="background:var(--warning-bg); color:var(--warning); border:1px solid var(--warning-border)">Dream (🟡)</span>';
        }
        
        const formattedCutoff = r.cl_rank.toLocaleString('en-IN');
        const branchName = getCleanBranchName(r.branch);
        const tfwText = r.fw === 'Y' ? ' (TFW)' : '';
        
        html += `
            <tr>
                <td class="priority-cell">${index + 1}</td>
                <td style="color:#fff; font-weight:500;">${escapeHtml(r.inst_name)}</td>
                <td><span class="branch-tag" style="margin-right:0.5rem;">${escapeHtml(r.branch)}</span> ${escapeHtml(branchName)}${tfwText}</td>
                <td>${escapeHtml(r.exam)}</td>
                <td>${escapeHtml(r.allotted_cat)}</td>
                <td style="font-weight:600; color:#fff;">${formattedCutoff}</td>
                <td>${chanceBadge}</td>
            </tr>
        `;
    });
    
    elements.strategyTableBody.innerHTML = html || '<tr><td colspan="7" style="text-align:center; padding:2rem;">No eligible strategy options found. Go back and verify your parameters.</td></tr>';
}

// --- Choice Filling CSV Exporter ---
function exportStrategyToExcel() {
    if (strategyRecords.length === 0) {
        alert("No strategy records available to export.");
        return;
    }

    const rankVal = parseInt(elements.rankInput.value) || 0;
    
    const headers = [
        "Choice Priority",
        "College Name",
        "TFW (Yes/No)",
        "Branch Code",
        "Branch Name",
        "Exam Type",
        "Round",
        "Allotted Category",
        "Eligible Category",
        "Domicile Quota",
        "2025 Closing Rank",
        "Choice Classification"
    ];
    
    const rows = strategyRecords.map((r, index) => {
        const branchFull = getCleanBranchName(r.branch);
        const chance = getChanceLevel(rankVal, r.cl_rank);
        
        let classification = "TARGET";
        if (chance === 'high') {
            if (rankVal <= 0.5 * r.cl_rank) {
                classification = "SAFE";
            }
        } else {
            classification = "DREAM";
        }
        
        const cleanName = `"${(r.inst_name || '').replace(/'/g, "''").replace(/"/g, '""')}"`;
        const cleanBranchName = `"${branchFull.replace(/'/g, "''").replace(/"/g, '""')}"`;
        const cleanEligibleCat = r.eligible_cat ? `"${r.eligible_cat.replace(/"/g, '""')}"` : '""';

        return [
            index + 1,
            cleanName,
            r.fw === 'Y' ? 'YES' : 'NO',
            r.branch,
            cleanBranchName,
            r.exam,
            r.round,
            r.allotted_cat,
            cleanEligibleCat,
            r.domicile,
            r.cl_rank,
            classification
        ].join(',');
    });

    const csvContent = "\uFEFF" + headers.join(',') + '\n' + rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.setAttribute("href", url);
    
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const filename = `MP_DTE_Choice_Strategy_${rankVal}_${timestamp}.csv`;
    link.setAttribute("download", filename);
    
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// --- Run App ---
document.addEventListener('DOMContentLoaded', init);
