// Financial Integration JavaScript
// Store data for CSV export
let unifiedViewData = [];
let rawDataForExport = [];
// Store brand-approved data for CSV export
let brandApprovedData = { tmh: [], raymond: [] };
// Store original data for search filtering
let allRawData = [];
let allUnifiedData = [];
// Store submitted account numbers for padding logic (used in search)
let submittedAccountNumbersForSearch = new Set();

document.addEventListener('DOMContentLoaded', () => {
    const role = localStorage.getItem('tmhna_role') || 'maya';
    
    // Initialize tabs
    initTabs();
    
    // Load data based on role
    if (role === 'maya') {
        loadBrandApproved();
        loadCorporateUnified();
        loadVariances();
        loadSubmissions();
        loadHistory();
        
        // Brand toggle handler
        const brandToggle = document.getElementById('brand-toggle');
        if (brandToggle) {
            brandToggle.addEventListener('change', () => {
                loadBrandApproved();
                updateBrandDownloadButtons();
            });
            // Initial update of buttons
            updateBrandDownloadButtons();
        }
        
        // Load both brands' approved data for CSV export
        loadBrandApprovedDataForExport();
    } else {
        loadRawData();
        loadPreview();
        loadVariances();
        loadHistory();
    }
});

function initTabs() {
    document.querySelectorAll('.fiori-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const targetId = tab.dataset.target;
            
            // Hide all panes
            document.querySelectorAll('.fiori-pane').forEach(pane => {
                pane.classList.remove('active');
            });
            
            // Remove active from all tabs
            document.querySelectorAll('.fiori-tab').forEach(t => {
                t.classList.remove('active');
            });
            
            // Show target pane
            const targetPane = document.getElementById(targetId);
            if (targetPane) {
                targetPane.classList.add('active');
                tab.classList.add('active');
                
                // Load data for the active tab
                const role = localStorage.getItem('tmhna_role') || 'maya';
                if (role === 'maya') {
                    if (targetId === 'brand-approved-pane') {
                        loadBrandApproved();
                    } else if (targetId === 'corporate-unified-pane') {
                        loadCorporateUnified();
                    } else if (targetId === 'variances-pane') {
                        loadVariances();
                    } else if (targetId === 'submissions-pane') {
                        loadSubmissions();
                    } else if (targetId === 'history-pane') {
                        loadHistory();
                    }
                } else {
                    if (targetId === 'raw-data-pane') {
                        loadRawData();
                    } else if (targetId === 'preview-pane') {
                        loadPreview();
                    } else if (targetId === 'variances-pane') {
                        loadVariances();
                    } else if (targetId === 'history-pane') {
                        loadHistory();
                    }
                }
            }
        });
    });
    
    // Submit button
    const submitBtn = document.getElementById('submit-to-corporate');
    if (submitBtn) {
        submitBtn.addEventListener('click', handleSubmit);
    }
    
    // Search functionality for raw data
    const rawSearchInput = document.getElementById('raw-data-search');
    const clearRawSearch = document.getElementById('clear-raw-search');
    if (rawSearchInput) {
        rawSearchInput.addEventListener('input', (e) => {
            handleRawDataSearch(e.target.value);
            if (clearRawSearch) {
                if (e.target.value) {
                    clearRawSearch.classList.remove('hidden');
                } else {
                    clearRawSearch.classList.add('hidden');
                }
            }
        });
    }
    if (clearRawSearch) {
        clearRawSearch.addEventListener('click', () => {
            if (rawSearchInput) {
                rawSearchInput.value = '';
                handleRawDataSearch('');
                clearRawSearch.classList.add('hidden');
            }
        });
    }
    
    // Search functionality for unified data
    const unifiedSearchInput = document.getElementById('unified-data-search');
    const clearUnifiedSearch = document.getElementById('clear-unified-search');
    if (unifiedSearchInput) {
        unifiedSearchInput.addEventListener('input', (e) => {
            handleUnifiedDataSearch(e.target.value);
            if (clearUnifiedSearch) {
                if (e.target.value) {
                    clearUnifiedSearch.classList.remove('hidden');
                } else {
                    clearUnifiedSearch.classList.add('hidden');
                }
            }
        });
    }
    if (clearUnifiedSearch) {
        clearUnifiedSearch.addEventListener('click', () => {
            if (unifiedSearchInput) {
                unifiedSearchInput.value = '';
                handleUnifiedDataSearch('');
                clearUnifiedSearch.classList.add('hidden');
            }
        });
    }
}

// Search handlers
function handleRawDataSearch(searchTerm) {
    if (!allRawData || allRawData.length === 0) return;
    
    const term = searchTerm.toLowerCase().trim();
    const role = localStorage.getItem('tmhna_role') || 'maya';
    const brand = role === 'liam' ? 'raymond' : 'tmh';
    const tbody = document.getElementById('raw-data-body');
    if (!tbody) return;
    
    // Filter data based on search term
    let filteredData = allRawData;
    if (term) {
        filteredData = allRawData.filter(row => {
            const accountNum = String(row.source_account_number || '').toLowerCase();
            const accountName = String(row.source_account_name || '').toLowerCase();
            const costCenter = String(row.source_cost_center || '').toLowerCase();
            const amount = String(row.amount || '').toLowerCase();
            return accountNum.includes(term) || accountName.includes(term) || costCenter.includes(term) || amount.includes(term);
        });
    }
    
    const newestRowAccountNumbers = brand === 'raymond' 
        ? new Set(['09-970', '09-975', '09-980', '09-985', '09-990', '09-995', '09-945', '09-950'])
        : new Set(['09-960', '09-965', '09-980', '09-985', '09-990', '09-995', '09-915', '09-920', '09-925', '09-991', '09-992']);
    
    if (filteredData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-muted" style="padding: 1rem; text-align: center;">No results found</td></tr>';
        return;
    }
    
    tbody.innerHTML = filteredData.map((row, index) => {
        const sourceAccount = row.source_account_number || '';
        const isNewRow = newestRowAccountNumbers.has(sourceAccount) && !submittedAccountNumbersForSearch.has(sourceAccount);
        const rowClass = isNewRow ? 'class="new-data-row"' : '';
        return `
        <tr ${rowClass}>
            <td>${escapeHtml(row.source_account_number || '')}</td>
            <td>${escapeHtml(row.source_account_name || '')}</td>
            <td>${escapeHtml(row.source_cost_center || '')}</td>
            <td>${escapeHtml(row.amount || '')}</td>
        </tr>
    `;
    }).join('');
}

function handleUnifiedDataSearch(searchTerm) {
    if (!allUnifiedData || allUnifiedData.length === 0) return;
    
    const term = searchTerm.toLowerCase().trim();
    const container = document.getElementById('corporate-unified-content');
    if (!container) return;
    
    let filteredData = allUnifiedData;
    if (term) {
        filteredData = allUnifiedData.filter(row => {
            const unifiedAccount = String(row.unified_account || '').toLowerCase();
            const unifiedAccountName = String(row.unified_account_name || '').toLowerCase();
            const unifiedCostCenter = String(row.unified_cost_center || '').toLowerCase();
            const unifiedCostCenterName = String(row.unified_cost_center_name || '').toLowerCase();
            const amount = String(row.amount || '').toLowerCase();
            const brands = (row.contributing_brands || []).join(' ').toLowerCase();
            return unifiedAccount.includes(term) || unifiedAccountName.includes(term) || 
                   unifiedCostCenter.includes(term) || unifiedCostCenterName.includes(term) ||
                   amount.includes(term) || brands.includes(term);
        });
    }
    
    if (filteredData.length === 0) {
        container.innerHTML = '<div class="text-muted" style="padding: 2rem; text-align: center;">No results found</div>';
        return;
    }
    
    // Re-render the table with filtered data (same structure as loadCorporateUnified)
    const tableHtml = `
        <table class="data-table-modern">
            <thead>
                <tr>
                    <th>Unified Account</th>
                    <th>Unified Cost Center</th>
                    <th>Total Amount</th>
                    <th>Contributing Brands</th>
                </tr>
            </thead>
            <tbody>
                ${filteredData.map(row => `
                    <tr>
                        <td>${escapeHtml(row.unified_account || '')}</td>
                        <td>${escapeHtml(row.unified_cost_center || '')}</td>
                        <td>${escapeHtml(row.amount || '')}</td>
                        <td>${escapeHtml((row.contributing_brands || []).join(', ') || 'N/A')}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    container.innerHTML = tableHtml;
}

// Brand Controller Functions
async function loadRawData() {
    const tbody = document.getElementById('raw-data-body');
    if (!tbody) return;
    
    try {
        const role = localStorage.getItem('tmhna_role') || 'maya';
        const brand = role === 'liam' ? 'raymond' : 'tmh';
        
        // Check if there are submitted or approved submissions
        const submissionsResponse = await fetch('/api/financial/submissions');
        const submissionsData = await submissionsResponse.json();
        const brandSubmissions = (submissionsData.data || []).filter(s => 
            s.brand && s.brand.toUpperCase() === brand.toUpperCase()
        );
        const hasSubmittedOrApproved = brandSubmissions.some(s => 
            s.status === 'SUBMITTED' || s.status === 'APPROVED'
        );
        
        // Get all APPROVED or SUBMITTED source accounts to exclude them from new row styling
        // REJECTED submissions should allow rows to show padding again (can be resubmitted)
        let submittedAccountNumbers = new Set();
        if (hasSubmittedOrApproved) {
            const submittedSubmissionIds = brandSubmissions
                .filter(s => s.status === 'SUBMITTED' || s.status === 'APPROVED')
                .map(s => s.submission_id);
            
            // Fetch submission rows to get submitted account numbers - await all in parallel
            await Promise.all(submittedSubmissionIds.map(async (submissionId) => {
                try {
                    const rowsResponse = await fetch(`/api/financial/submission/${submissionId}/rows`);
                    const rowsData = await rowsResponse.json();
                    if (rowsData.data) {
                        rowsData.data.forEach(row => {
                            if (row.source_account) {
                                submittedAccountNumbers.add(row.source_account);
                            }
                        });
                    }
                } catch (err) {
                    console.error('Error loading submission rows:', err);
                }
            }));
        }
        
        const response = await fetch('/api/financial/raw');
        const data = await response.json();
        
        if (data.error) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-muted" style="padding: 1rem; text-align: center;">Unauthorized</td></tr>';
            rawDataForExport = [];
            return;
        }
        
        if (data.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-muted" style="padding: 1rem; text-align: center;">No raw data available</td></tr>';
            rawDataForExport = [];
            return;
        }
        
        // Store data for CSV export and search
        rawDataForExport = data.data || [];
        allRawData = data.data || [];
        // Store submitted account numbers for search filtering
        submittedAccountNumbersForSearch = submittedAccountNumbers;
        
        // Identify newly added rows - brand-specific (most recent batch only)
        // TMH newest: Legal (09-960), Training (09-965), Telecommunications (09-980), Insurance (09-985), R&D (09-990), Unmapped (09-995), Office Supplies (09-915), Depreciation (09-920), Professional Services (09-925), Warranty (09-991), Bank Fees (09-992)
        // Raymond newest: Software License (09-970), Freight (09-975), Property Tax (09-980), Depreciation (09-985), Bad Debt (09-990), Unmapped (09-995), Maintenance (09-945), Rent (09-950)
        const newestRowAccountNumbers = brand === 'raymond' 
            ? new Set(['09-970', '09-975', '09-980', '09-985', '09-990', '09-995', '09-945', '09-950']) // Raymond's newest (including 3 new test rows)
            : new Set(['09-960', '09-965', '09-980', '09-985', '09-990', '09-995', '09-915', '09-920', '09-925', '09-991', '09-992']); // TMH's newest (including 6 new test rows)
        
        tbody.innerHTML = data.data.map((row, index) => {
            const sourceAccount = row.source_account_number || '';
            // Only show padding for new rows that haven't been submitted yet
            const isNewRow = newestRowAccountNumbers.has(sourceAccount) && !submittedAccountNumbers.has(sourceAccount);
            const rowClass = isNewRow ? 'class="new-data-row"' : '';
            return `
            <tr ${rowClass}>
                <td>${escapeHtml(row.source_account_number || '')}</td>
                <td>${escapeHtml(row.source_account_name || '')}</td>
                <td>${escapeHtml(row.source_cost_center || '')}</td>
                <td>${escapeHtml(row.amount || '')}</td>
            </tr>
        `;
        }).join('');
    } catch (err) {
        console.error('Error loading raw data:', err);
        tbody.innerHTML = '<tr><td colspan="4" class="text-muted" style="padding: 1rem; text-align: center;">Error loading raw data</td></tr>';
        rawDataForExport = [];
    }
}

async function loadDataQuality() {
    const container = document.getElementById('data-quality-content');
    if (!container) return;
    
    try {
        const role = localStorage.getItem('tmhna_role') || 'maya';
        const brand = role === 'liam' ? 'raymond' : role === 'ethan' ? 'tmh' : null;
        
        if (!brand && role !== 'maya') {
            container.innerHTML = '<p class="text-muted">Unauthorized</p>';
            return;
        }
        
        // For Maya, show all brands; for Brand Controllers, show their brand only
        let allIssues = [];
        if (role === 'maya') {
            const [tmhRes, raymondRes] = await Promise.all([
                fetch('/api/financial/quality/tmh'),
                fetch('/api/financial/quality/raymond')
            ]);
            const tmhData = await tmhRes.json();
            const raymondData = await raymondRes.json();
            allIssues = [...(tmhData.issues || []), ...(raymondData.issues || [])];
        } else {
            const response = await fetch(`/api/financial/quality/${brand}`);
            const data = await response.json();
            allIssues = data.issues || [];
        }
        
        if (allIssues.length === 0) {
            container.innerHTML = '<p class="text-muted">No data quality issues found. Data is ready for submission.</p>';
            return;
        }
        
        container.innerHTML = `
            <div style="margin-bottom: 1rem;">
                <strong>${allIssues.length} issue(s) found:</strong>
            </div>
            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                ${allIssues.map(issue => `
                    <div style="padding: 1rem; background: var(--bg-light); border-radius: var(--radius-sm); border-left: 4px solid var(--danger);">
                        <div style="font-weight: 600; margin-bottom: 0.25rem;">${escapeHtml(issue.type || '')}</div>
                        <div style="color: var(--slate-500); font-size: 0.875rem;">${escapeHtml(issue.message || '')}</div>
                        ${role === 'maya' ? `<div style="margin-top: 0.5rem; font-size: 0.75rem; color: var(--accent);"><strong>Brand:</strong> ${escapeHtml(issue.brand || '')}</div>` : ''}
                    </div>
                `).join('')}
            </div>
        `;
    } catch (err) {
        console.error('Error loading data quality:', err);
        container.innerHTML = '<p class="text-muted">Error loading data quality issues</p>';
    }
}

async function loadPreview() {
    const tbody = document.getElementById('preview-body');
    if (!tbody) return;
    
    try {
        const role = localStorage.getItem('tmhna_role') || 'maya';
        const brand = role === 'liam' ? 'raymond' : 'tmh';
        
        // Check if there's already a SUBMITTED submission for this brand
        const submissionsResponse = await fetch('/api/financial/submissions');
        const submissionsData = await submissionsResponse.json();
        const brandSubmissions = (submissionsData.data || []).filter(s => 
            s.brand && s.brand.toUpperCase() === brand.toUpperCase()
        );
        
        const hasSubmitted = brandSubmissions.some(s => s.status === 'SUBMITTED' || s.status === 'APPROVED');
        
        // Get all APPROVED source accounts to exclude them from preview
        // REJECTED submissions should allow rows to reappear (can be resubmitted)
        // SUBMITTED (pending) rows are also filtered out to prevent duplicate submissions
        let submittedAccountNumbers = new Set();
        const approvedOrSubmittedIds = brandSubmissions
            .filter(s => s.status === 'APPROVED' || s.status === 'SUBMITTED')
            .map(s => s.submission_id);
        
        if (approvedOrSubmittedIds.length > 0) {
            const submissionIdsToCheck = approvedOrSubmittedIds;
            
            // Fetch submission rows to get submitted account numbers
            for (const submissionId of submissionIdsToCheck) {
                try {
                    const rowsResponse = await fetch(`/api/financial/submission/${submissionId}/rows`);
                    const rowsData = await rowsResponse.json();
                    if (rowsData.data) {
                        rowsData.data.forEach(row => {
                            if (row.source_account) {
                                submittedAccountNumbers.add(row.source_account);
                            }
                        });
                    }
                } catch (err) {
                    console.error('Error loading submission rows:', err);
                }
            }
        }
        
        // Fetch preview - variances are recomputed dynamically on each request
        const response = await fetch(`/api/financial/preview/${brand}`);
        const data = await response.json();
        
        if (data.error) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-muted" style="padding: 1rem; text-align: center;">Error loading preview</td></tr>';
            return;
        }
        
        // Identify newly added rows for preview view (for padding styling)
        const newestRowAccountNumbers = brand === 'raymond' 
            ? new Set(['09-970', '09-975', '09-980', '09-985', '09-990', '09-995', '09-945', '09-950']) // Raymond's newest (including 3 new test rows)
            : new Set(['09-960', '09-965', '09-980', '09-985', '09-990', '09-995', '09-915', '09-920', '09-925', '09-991', '09-992']); // TMH's newest (including 6 new test rows)
        
        // Filter out already submitted accounts
        let recordsToShow = data.records.filter(row => {
            const sourceAccount = row.source_account || '';
            // Exclude already submitted accounts (this includes just-added test rows after they're submitted)
            if (submittedAccountNumbers.has(sourceAccount)) {
                return false;
            }
            // Show all unsubmitted rows (preview API already filters to only include fully mapped rows)
            return true;
        });
        
        // Show variance status and submission eligibility
        // If there are blocking variances (unmapped accounts/cost centers), block submission
        if (data.blocking_variance_count > 0) {
            // Don't check sessionStorage on load - only show "Request Sent" if button was clicked
            // This prevents auto-selecting the "Request Sent" state
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-muted" style="padding: 2rem; text-align: center;">
                        <div style="margin-bottom: 1rem; color: var(--danger); font-weight: 500;">
                            <i class="ph ph-warning"></i> Cannot submit: ${data.blocking_variance_count} unmapped account(s) or cost center(s) detected.
                        </div>
                        <button id="request-mapping-btn" data-variance-count="${data.blocking_variance_count}" onclick="requestCorporateMappings()" class="btn btn-ghost" style="border: 1px solid var(--slate-300);">
                            Request Corporate to Add Mappings
                        </button>
                    </td>
                </tr>
            `;
            return;
        }
        
        if (recordsToShow.length === 0) {
            if (hasSubmitted) {
                tbody.innerHTML = '<tr><td colspan="4" class="text-muted" style="padding: 2rem; text-align: center;">No new records available for submission</td></tr>';
            } else {
                tbody.innerHTML = '<tr><td colspan="4" class="text-muted" style="padding: 1rem; text-align: center;">No data available for submission (all rows are unmapped)</td></tr>';
            }
            return;
        }
        
        // Show preview with variance status
        let varianceStatus = '';
        if (data.variance_count > 0) {
            // Don't check sessionStorage on load - only show "Request Sent" if button was clicked
            // This prevents auto-selecting the "Request Sent" state
            varianceStatus = `
                <div style="font-size: 0.875rem; color: var(--slate-500); margin-bottom: 0.5rem; padding: 0.5rem; background: var(--bg-light); border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">
                    <span>Note: ${data.variance_count} variance(s) detected</span>
                    <button id="request-mapping-nonblocking-btn" data-variance-count="${data.variance_count}" onclick="requestCorporateMappingsNonBlocking()" class="btn btn-ghost" style="border: 1px solid var(--slate-300); padding: 0.25rem 0.75rem; font-size: 0.875rem;">
                        Request to Map
                    </button>
                </div>
            `;
        } else {
            varianceStatus = '<div style="font-size: 0.875rem; color: var(--success); margin-bottom: 0.5rem; padding: 0.5rem; background: rgba(16, 185, 129, 0.1); border-radius: 4px;">✓ All accounts and cost centers are mapped</div>';
        }
        
        tbody.innerHTML = varianceStatus + recordsToShow.map(row => {
            // Mark new rows with padding (only if they haven't been submitted)
            const sourceAccount = row.source_account || '';
            const isNewRow = newestRowAccountNumbers.has(sourceAccount) && !submittedAccountNumbers.has(sourceAccount);
            const rowClass = isNewRow ? 'class="new-data-row"' : '';
            return `
            <tr ${rowClass}>
                <td>${escapeHtml(row.source_account || '')}</td>
                <td>${escapeHtml(row.unified_account || '')} - ${escapeHtml(row.unified_account_name || '')}</td>
                <td>${escapeHtml(row.unified_cost_center || '')} - ${escapeHtml(row.unified_cost_center_name || '')}</td>
                <td>${escapeHtml(row.amount || '')}</td>
            </tr>
        `;
        }).join('');
    } catch (err) {
        console.error('Error loading preview:', err);
        tbody.innerHTML = '<tr><td colspan="4" class="text-muted" style="padding: 1rem; text-align: center;">Error loading preview</td></tr>';
    }
}

async function handleSubmit() {
    const role = localStorage.getItem('tmhna_role') || 'maya';
    const brand = role === 'liam' ? 'raymond' : 'tmh';
    
    // Recompute variances dynamically before submission
    try {
        const varianceResponse = await fetch('/api/financial/variances');
        const varianceData = await varianceResponse.json();
        
        if (varianceData.data) {
            const blockingVar = varianceData.data.filter(v => 
                v.variance_type === "UNMAPPED_ACCOUNT" || v.variance_type === "UNMAPPED_COST_CENTER"
            );
            
            if (blockingVar.length > 0) {
                alert(`Cannot submit: ${blockingVar.length} unmapped account(s) or cost center(s) must be resolved first. Please update mappings in Mapping Governance.`);
                loadPreview(); // Refresh preview to show current status
                return;
            }
        }
    } catch (err) {
        console.error('Error checking variances:', err);
        // Continue with submission attempt - backend will also check
    }
    
    if (!confirm(`Submit ${brand.toUpperCase()} financial data to corporate?`)) {
        return;
    }
    
    const submitBtn = document.getElementById('submit-to-corporate');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';
    }
    
    try {
        // Backend will recompute variances dynamically and block if needed
        const response = await fetch(`/api/financial/submit/${brand}`, {
            method: 'POST'
        });
        const result = await response.json();
        
        if (result.ok) {
            alert(`Successfully submitted ${result.record_count} records to corporate.`);
            // Force reload preview after a short delay to ensure submission is saved
            setTimeout(() => {
                loadPreview();
                loadHistory();
                loadVariances(); // Refresh variances view
            }, 100);
        } else {
            alert(`Error: ${result.error || 'Failed to submit'}`);
            loadPreview(); // Refresh preview to show current status
        }
    } catch (err) {
        console.error('Error submitting:', err);
        alert('Error submitting data. Please try again.');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit Data Package';
        }
    }
}

// Corporate Reviewer Functions
async function loadBrandApproved() {
    const container = document.getElementById('brand-approved-content');
    if (!container) return;
    
    const brandToggle = document.getElementById('brand-toggle');
    let selectedBrand = brandToggle ? brandToggle.value : 'tmh';
    
    try {
        // If no brand selected, try to find first available approved brand
        if (!selectedBrand) {
            const submissionsResponse = await fetch('/api/financial/submissions');
            const submissionsData = await submissionsResponse.json();
            const approvedBrands = (submissionsData.data || [])
                .filter(s => s.status === 'APPROVED')
                .map(s => s.brand.toLowerCase());
            
            if (approvedBrands.length > 0) {
                selectedBrand = approvedBrands[0];
                if (brandToggle) brandToggle.value = selectedBrand;
            }
        }
        
        const response = await fetch(`/api/financial/brand-approved/${selectedBrand}`);
        const data = await response.json();
        
        if (data.error) {
            container.innerHTML = '<p class="text-muted">Unauthorized</p>';
            return;
        }
        
        if (!data.data || data.data.length === 0) {
            container.innerHTML = `<p class="text-muted">No approved data available for ${selectedBrand.toUpperCase()}.</p>`;
            brandApprovedData[selectedBrand] = [];
            return;
        }
        
        // Store data for CSV export
        brandApprovedData[selectedBrand] = data.data || [];
        
        container.innerHTML = `
            <table class="data-table-modern">
                <thead>
                    <tr>
                        <th>Unified Account</th>
                        <th>Unified Cost Center</th>
                        <th>Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.data.map(row => `
                        <tr>
                            <td>${escapeHtml(row.unified_account || '')}</td>
                            <td>${escapeHtml(row.unified_cost_center || '')}</td>
                            <td>${escapeHtml(row.amount || '')}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (err) {
        console.error('Error loading brand-approved view:', err);
        container.innerHTML = '<p class="text-muted">Error loading brand-approved view</p>';
    } finally {
        // Ensure loading state is always cleared
        if (container) {
            container.style.opacity = '1';
        }
    }
}

function updateBrandDownloadButtons() {
    const brandToggle = document.getElementById('brand-toggle');
    const tmhBtn = document.getElementById('download-tmh-approved-csv');
    const raymondBtn = document.getElementById('download-raymond-approved-csv');
    
    if (!brandToggle) return;
    
    const selectedBrand = brandToggle.value;
    
    if (tmhBtn) {
        tmhBtn.style.display = selectedBrand === 'tmh' ? 'inline-flex' : 'none';
    }
    if (raymondBtn) {
        raymondBtn.style.display = selectedBrand === 'raymond' ? 'inline-flex' : 'none';
    }
}

async function loadBrandApprovedDataForExport() {
    // Load both brands' approved data for CSV export (background load)
    try {
        const [tmhResponse, raymondResponse] = await Promise.all([
            fetch('/api/financial/brand-approved/tmh'),
            fetch('/api/financial/brand-approved/raymond')
        ]);
        
        const tmhData = await tmhResponse.json();
        const raymondData = await raymondResponse.json();
        
        if (tmhData.data) {
            brandApprovedData.tmh = tmhData.data;
        }
        if (raymondData.data) {
            brandApprovedData.raymond = raymondData.data;
        }
    } catch (err) {
        console.error('Error loading brand-approved data for export:', err);
    }
}

async function loadCorporateUnified() {
    const container = document.getElementById('corporate-unified-content');
    if (!container) return;
    
    try {
        const response = await fetch('/api/financial/corporate-unified');
        const data = await response.json();
        
        if (data.error) {
            container.innerHTML = '<p class="text-muted">Unauthorized</p>';
            unifiedViewData = [];
            return;
        }
        
        // Store data for CSV export and search
        unifiedViewData = data.data || [];
        allUnifiedData = data.data || [];
        
        // Show empty state if no approved data exists
        if (data.data.length === 0) {
            container.innerHTML = '<p class="text-muted">No approved data available yet. Unified View shows data from approved submissions.</p>';
            return;
        }
        
        container.innerHTML = `
            <table class="data-table-modern">
                <thead>
                    <tr>
                        <th>Unified Account</th>
                        <th>Unified Cost Center</th>
                        <th>Total Amount</th>
                        <th>Contributing Brands</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.data.map(row => `
                        <tr>
                            <td>${escapeHtml(row.unified_account || '')}</td>
                            <td>${escapeHtml(row.unified_cost_center || '')}</td>
                            <td>${escapeHtml(row.amount || '')}</td>
                            <td>${escapeHtml((row.contributing_brands || []).join(', ') || 'N/A')}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (err) {
        console.error('Error loading corporate unified view:', err);
        container.innerHTML = '<p class="text-muted">Error loading corporate unified view</p>';
        unifiedViewData = [];
    }
}

async function loadVariances() {
    const container = document.getElementById('variances-content');
    if (!container) return;
    
    try {
        const response = await fetch('/api/financial/variances');
        const data = await response.json();
        
        if (data.error) {
            container.innerHTML = '<p class="text-muted">Unauthorized</p>';
            return;
        }
        
        // Show empty state if no variances exist
        if (!data.data || data.data.length === 0) {
            container.innerHTML = '<p class="text-muted">No variances found. All accounts and cost centers are mapped.</p>';
            return;
        }
        
        const role = localStorage.getItem('tmhna_role') || 'maya';
        const isMaya = role === 'maya';
        
        // Different table structure for Maya (cross-brand) vs Brand Controllers (brand-specific)
        if (isMaya) {
            container.innerHTML = `
                <table class="data-table-modern">
                    <thead>
                        <tr>
                            <th>Variance Type</th>
                            <th>Brand</th>
                            <th>Unified Account</th>
                            <th>Unified Cost Center</th>
                            <th>Source Account</th>
                            <th>Source Cost Center</th>
                            <th>Message</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.data.map(v => `
                            <tr>
                                <td>${escapeHtml(v.variance_type || '')}</td>
                                <td>${escapeHtml(v.brand || 'Cross-Brand')}</td>
                                <td>${escapeHtml(v.unified_account || '')}</td>
                                <td>${escapeHtml(v.unified_cost_center || '')}</td>
                                <td>${escapeHtml(v.source_account_name || v.source_account_number || '')}</td>
                                <td>${escapeHtml(v.source_cost_center || '')}</td>
                                <td>${escapeHtml(v.message || '')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        } else {
            // Brand Controller view - filter out cross-brand variances (AMOUNT_MISMATCH, COUNT_MISMATCH)
            const brandVariances = data.data.filter(v => 
                v.variance_type !== 'AMOUNT_MISMATCH' && 
                v.variance_type !== 'COUNT_MISMATCH'
            );
            
            if (brandVariances.length === 0) {
                container.innerHTML = '<p class="text-muted">No variances found for your brand. All accounts and cost centers are mapped.</p>';
                return;
            }
            
            container.innerHTML = `
                <table class="data-table-modern">
                    <thead>
                        <tr>
                            <th>Variance Type</th>
                            <th>Unified Account</th>
                            <th>Source Account</th>
                            <th>Source Cost Center</th>
                            <th>Message</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${brandVariances.map(v => `
                            <tr>
                                <td>${escapeHtml(v.variance_type || '')}</td>
                                <td>${escapeHtml(v.unified_account || '')}</td>
                                <td>${escapeHtml(v.source_account_name || v.source_account_number || '')}</td>
                                <td>${escapeHtml(v.source_cost_center || '')}</td>
                                <td>${escapeHtml(v.message || '')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }
    } catch (err) {
        console.error('Error loading variances:', err);
        container.innerHTML = '<p class="text-muted">Error loading variances</p>';
    }
}

async function loadSubmissions() {
    const container = document.getElementById('submissions-content');
    if (!container) return;
    
    try {
        const response = await fetch('/api/financial/submissions');
        const data = await response.json();
        
        if (data.data.length === 0) {
            container.innerHTML = '<p class="text-muted">No submissions found.</p>';
            return;
        }
        
        // Sort by timestamp descending (newest first)
        const sortedSubmissions = [...data.data].sort((a, b) => {
            const timeA = new Date(a.timestamp || 0).getTime();
            const timeB = new Date(b.timestamp || 0).getTime();
            return timeB - timeA; // Descending order
        });
        
        container.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 1rem;">
                ${sortedSubmissions.map(sub => `
                    <div style="padding: 1.5rem; background: var(--bg-light); border-radius: var(--radius-sm); border: 1px solid var(--slate-200);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
                            <div>
                                <div style="font-weight: 600; margin-bottom: 0.25rem;">${escapeHtml(sub.brand || '')} - ${escapeHtml(sub.status || '')}</div>
                                <div style="color: var(--slate-500); font-size: 0.875rem;">
                                    Submitted: ${new Date(sub.timestamp).toLocaleString()}
                                </div>
                            </div>
                            <div style="display: flex; gap: 0.5rem;">
                                ${sub.status === 'SUBMITTED' ? `
                                    <button class="btn btn-primary" onclick="approveSubmission('${sub.submission_id}')">Approve</button>
                                    <button class="btn btn-ghost" onclick="rejectSubmission('${sub.submission_id}')">Reject</button>
                                ` : ''}
                                <button class="btn btn-ghost" onclick="viewSubmission('${sub.submission_id}')">View Details</button>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    } catch (err) {
        console.error('Error loading submissions:', err);
        container.innerHTML = '<p class="text-muted">Error loading submissions</p>';
    }
}

async function viewSubmission(submissionId) {
    try {
        const response = await fetch(`/api/financial/submission/${submissionId}/rows`);
        const data = await response.json();
        
        if (data.data.length === 0) {
            alert('No rows found for this submission.');
            return;
        }
        
        const rowsHtml = `
            <div style="max-height: 500px; overflow-y: auto;">
                <table class="data-table-modern">
                    <thead>
                        <tr>
                            <th>Source Account</th>
                            <th>Unified Account</th>
                            <th>Unified Cost Center</th>
                            <th>Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.data.map(row => `
                            <tr>
                                <td>${escapeHtml(row.source_account || '')}</td>
                                <td>${escapeHtml(row.unified_account || '')}</td>
                                <td>${escapeHtml(row.unified_cost_center || '')}</td>
                                <td>${escapeHtml(row.amount || '')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        
        // Create modal
        const modal = document.createElement('div');
        modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px);';
        modal.innerHTML = `
            <div style="background: white; padding: 2rem; border-radius: var(--radius-md); max-width: 90%; max-height: 90%; overflow: auto; box-shadow: var(--floating-shadow); min-width: 600px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                    <h3>Submission Details</h3>
                    <button onclick="this.closest('div[style*=\"position: fixed\"]').remove()" style="background: none; border: none; font-size: 24px; cursor: pointer;">×</button>
                </div>
                ${rowsHtml}
            </div>
        `;
        document.body.appendChild(modal);
    } catch (err) {
        console.error('Error loading submission rows:', err);
        alert('Error loading submission details.');
    }
}

async function approveSubmission(submissionId) {
    if (!confirm('Approve this submission?')) return;
    
    try {
        const response = await fetch(`/api/financial/submission/${submissionId}/status`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({status: 'APPROVED'})
        });
        const result = await response.json();
        
        if (result.ok) {
            alert('Submission approved.');
            loadSubmissions();
            loadBrandApproved();
            loadCorporateUnified();
            loadVariances();
        } else {
            alert(`Error: ${result.error || 'Failed to approve'}`);
        }
    } catch (err) {
        console.error('Error approving submission:', err);
        alert('Error approving submission.');
    }
}

async function rejectSubmission(submissionId) {
    if (!confirm('Reject this submission? This will require resubmission.')) return;
    
    try {
        const response = await fetch(`/api/financial/submission/${submissionId}/status`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({status: 'REJECTED'})
        });
        const result = await response.json();
        
        if (result.ok) {
            alert('Submission rejected.');
            loadSubmissions();
            loadBrandApproved();
            loadCorporateUnified();
            loadVariances();
        } else {
            alert(`Error: ${result.error || 'Failed to reject'}`);
        }
    } catch (err) {
        console.error('Error rejecting submission:', err);
        alert('Error rejecting submission.');
    }
}

async function loadHistory() {
    const container = document.getElementById('history-content');
    if (!container) return;
    
    try {
        const response = await fetch('/api/financial/submissions');
        const data = await response.json();
        
        if (data.data.length === 0) {
            container.innerHTML = '<p class="text-muted">No submission history found.</p>';
            return;
        }
        
        container.innerHTML = `
            <table class="data-table-modern">
                <thead>
                    <tr>
                        <th>Submission ID</th>
                        <th>Brand</th>
                        <th>Status</th>
                        <th>Timestamp</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.data.map(sub => `
                        <tr>
                            <td style="font-size: 12px; font-family: monospace;">${escapeHtml(sub.submission_id || '').substring(0, 8)}...</td>
                            <td>${escapeHtml(sub.brand || '')}</td>
                            <td>${escapeHtml(sub.status || '')}</td>
                            <td>${new Date(sub.timestamp).toLocaleString()}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (err) {
        console.error('Error loading history:', err);
        container.innerHTML = '<p class="text-muted">Error loading history</p>';
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Make functions available globally for cross-page access
window.viewSubmission = viewSubmission;
window.approveSubmission = approveSubmission;
window.rejectSubmission = rejectSubmission;
window.loadVariances = loadVariances;
window.loadDataQuality = loadDataQuality;

function requestCorporateMappings() {
    const role = localStorage.getItem('tmhna_role') || 'maya';
    const brand = role === 'liam' ? 'raymond' : 'tmh';
    
    // Get current variance count from button data attribute
    const btn = document.getElementById('request-mapping-btn');
    const currentVarianceCount = btn ? btn.getAttribute('data-variance-count') : '0';
    
    alert('Request sent to Corporate. They will review and add the necessary mappings.');
    
    // Store variance count when request was sent (using sessionStorage so it resets when browser closes)
    sessionStorage.setItem('mapping_request_variance_count_blocking_' + brand, currentVarianceCount);
    sessionStorage.setItem('mapping_request_sent_blocking_' + brand, 'true');
    
    // Disable button
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Request Sent ✓';
        btn.style.opacity = '0.6';
        btn.style.cursor = 'not-allowed';
    }
}
window.requestCorporateMappings = requestCorporateMappings;

function requestCorporateMappingsNonBlocking() {
    const role = localStorage.getItem('tmhna_role') || 'maya';
    const brand = role === 'liam' ? 'raymond' : 'tmh';
    
    // Get current variance count from button data attribute
    const btn = document.getElementById('request-mapping-nonblocking-btn');
    const currentVarianceCount = btn ? btn.getAttribute('data-variance-count') : '0';
    
    alert('Request sent to Corporate. They will review and add the necessary mappings.');
    
    // Store variance count when request was sent (using sessionStorage so it resets when browser closes)
    sessionStorage.setItem('mapping_request_variance_count_' + brand, currentVarianceCount);
    sessionStorage.setItem('mapping_request_sent_' + brand, 'true');
    
    // Disable button and update text
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Request Sent ✓';
        btn.style.opacity = '0.6';
        btn.style.cursor = 'not-allowed';
    }
}
window.requestCorporateMappingsNonBlocking = requestCorporateMappingsNonBlocking;

// CSV Download Functions
function escapeCSV(value) {
    if (value === null || value === undefined) return '';
    const str = String(value);
    // If contains comma, quote, or newline, wrap in quotes and escape quotes
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
}

function convertToCSV(data, headers, fieldMapping) {
    if (!data || data.length === 0) {
        return headers.join(',') + '\n';
    }
    
    const rows = [headers.map(escapeCSV).join(',')];
    data.forEach(row => {
        const values = headers.map(header => {
            const fieldName = fieldMapping[header];
            if (!fieldName) return '';
            
            // Handle nested properties (e.g., contributing_brands array)
            if (fieldName === 'contributing_brands' && Array.isArray(row.contributing_brands)) {
                return row.contributing_brands.join('; ');
            }
            
            return row[fieldName] || '';
        });
        rows.push(values.map(escapeCSV).join(','));
    });
    
    return rows.join('\n');
}

function downloadCSV(csvContent, filename) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function downloadUnifiedCSV() {
    if (!unifiedViewData || unifiedViewData.length === 0) {
        alert('No data available to download.');
        return;
    }
    
    const headers = ['Unified Account', 'Unified Cost Center', 'Total Amount', 'Contributing Brands'];
    const fieldMapping = {
        'Unified Account': 'unified_account',
        'Unified Cost Center': 'unified_cost_center',
        'Total Amount': 'amount',
        'Contributing Brands': 'contributing_brands'
    };
    const csvContent = convertToCSV(unifiedViewData, headers, fieldMapping);
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `corporate_unified_view_${timestamp}.csv`;
    
    downloadCSV(csvContent, filename);
}

function downloadRawDataCSV() {
    if (!rawDataForExport || rawDataForExport.length === 0) {
        alert('No data available to download.');
        return;
    }
    
    const role = localStorage.getItem('tmhna_role') || 'maya';
    const brand = role === 'liam' ? 'raymond' : 'tmh';
    
    const headers = ['Account Number', 'Account Name', 'Cost Center', 'Amount'];
    const fieldMapping = {
        'Account Number': 'source_account_number',
        'Account Name': 'source_account_name',
        'Cost Center': 'source_cost_center',
        'Amount': 'amount'
    };
    const csvContent = convertToCSV(rawDataForExport, headers, fieldMapping);
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `${brand}_raw_data_${timestamp}.csv`;
    
    downloadCSV(csvContent, filename);
}

function downloadBrandApprovedCSV(brand) {
    const data = brandApprovedData[brand.toLowerCase()];
    if (!data || data.length === 0) {
        // Try to fetch the data if not already loaded
        fetch(`/api/financial/brand-approved/${brand}`)
            .then(response => response.json())
            .then(result => {
                if (result.data && result.data.length > 0) {
                    downloadBrandApprovedData(result.data, brand);
                } else {
                    alert(`No approved data available for ${brand.toUpperCase()}.`);
                }
            })
            .catch(err => {
                console.error('Error fetching brand-approved data:', err);
                alert(`Error loading ${brand.toUpperCase()} approved data.`);
            });
        return;
    }
    downloadBrandApprovedData(data, brand);
}

function downloadBrandApprovedData(data, brand) {
    const headers = ['Unified Account', 'Unified Cost Center', 'Amount'];
    const fieldMapping = {
        'Unified Account': 'unified_account',
        'Unified Cost Center': 'unified_cost_center',
        'Amount': 'amount'
    };
    const csvContent = convertToCSV(data, headers, fieldMapping);
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `${brand}_approved_data_${timestamp}.csv`;
    downloadCSV(csvContent, filename);
}

// Make functions globally accessible
window.downloadUnifiedCSV = downloadUnifiedCSV;
window.downloadRawDataCSV = downloadRawDataCSV;
window.downloadBrandApprovedCSV = downloadBrandApprovedCSV;
