// Mapping Governance JavaScript - Corporate-only (Maya)
document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    loadAccountMappings();
    loadCostCenterMappings();
    loadVendorRules();
});

function initTabs() {
    document.querySelectorAll('.fiori-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const targetId = tab.dataset.target;

            document.querySelectorAll('.fiori-pane').forEach(pane => {
                pane.classList.remove('active');
            });

            document.querySelectorAll('.fiori-tab').forEach(t => {
                t.classList.remove('active');
            });

            const targetPane = document.getElementById(targetId);
            if (targetPane) {
                targetPane.classList.add('active');
                tab.classList.add('active');

                if (targetId === 'financial-accounts-pane') {
                    loadAccountMappings();
                } else if (targetId === 'financial-cost-centers-pane') {
                    loadCostCenterMappings();
                } else if (targetId === 'vendor-rules-pane') {
                    loadVendorRules();
                }
            }
        });
    });
}

async function loadAccountMappings() {
    const container = document.getElementById('account-mappings-content');
    if (!container) return;

    try {
        const response = await fetch('/api/mappings/financial/accounts');
        if (response.ok) {
            const data = await response.json();
            renderAccountMappings(data.data || []);
        } else {
            container.innerHTML = '<p class="text-muted">Error loading account mappings</p>';
        }
    } catch (err) {
        console.error(err);
        container.innerHTML = '<p class="text-muted">Error loading account mappings</p>';
    }
}

function renderAccountMappings(mappings) {
    const container = document.getElementById('account-mappings-content');
    if (!container) return;

    // Always show the table and Add button, even if no mappings exist
    container.innerHTML = `
        <div style="margin-bottom: 1rem;">
            <button id="add-account-mapping" class="btn btn-ghost" style="border: 1px dashed var(--slate-300); width: 100%;">
                <i class="ph ph-plus" style="margin-right: 0.5rem;"></i> Add Account Mapping
            </button>
        </div>
        <table class="data-table-modern">
            <thead>
                <tr>
                    <th>Source Account Name</th>
                    <th>Unified Account Number</th>
                    <th>Unified Account Name</th>
                    <th style="width: 100px;">Actions</th>
                </tr>
            </thead>
            <tbody id="account-mappings-tbody">
                ${mappings.length === 0 ? `
                    <tr>
                        <td colspan="4" class="text-muted" style="text-align: center; padding: 2rem;">
                            No account mappings found. Click "Add Account Mapping" to create one.
                        </td>
                    </tr>
                ` : mappings.map((m, idx) => `
                    <tr data-index="${idx}">
                        <td><input type="text" class="input-modern account-source-name" value="${escapeHtml(m.source_account_name || '')}" placeholder="Source Account Name"></td>
                        <td><input type="text" class="input-modern account-unified-number" value="${escapeHtml(m.unified_account_number || '')}" placeholder="U100"></td>
                        <td><input type="text" class="input-modern account-unified-name" value="${escapeHtml(m.unified_account_name || '')}" placeholder="Unified Account Name"></td>
                        <td><button class="remove-account-mapping btn btn-ghost" data-index="${idx}" style="color: var(--danger); padding: 0.5rem;"><i class="ph ph-trash"></i></button></td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    window.accountMappings = mappings;

    // Set up Add button event listener
    const addBtn = document.getElementById('add-account-mapping');
    if (addBtn) {
        // Remove any existing listeners by cloning
        const newAddBtn = addBtn.cloneNode(true);
        addBtn.parentNode.replaceChild(newAddBtn, addBtn);

        newAddBtn.addEventListener('click', () => {
            const tbody = document.getElementById('account-mappings-tbody');
            if (!tbody) return;

            // Remove empty state row if it exists
            const emptyRow = tbody.querySelector('tr td[colspan="4"]');
            if (emptyRow) {
                emptyRow.closest('tr').remove();
            }

            const newRow = document.createElement('tr');
            newRow.innerHTML = `
                <td><input type="text" class="input-modern account-source-name" placeholder="Source Account Name"></td>
                <td><input type="text" class="input-modern account-unified-number" placeholder="U100"></td>
                <td><input type="text" class="input-modern account-unified-name" placeholder="Unified Account Name"></td>
                <td><button class="remove-account-mapping btn btn-ghost" style="color: var(--danger); padding: 0.5rem;"><i class="ph ph-trash"></i></button></td>
            `;
            tbody.appendChild(newRow);
            
            // Scroll to the new row and focus on first input
            setTimeout(() => {
                // Scroll the table container to show the new row at the bottom
                const table = tbody.closest('table');
                if (table) {
                    table.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
                newRow.scrollIntoView({ behavior: 'smooth', block: 'end' });
                const firstInput = newRow.querySelector('.account-source-name');
                if (firstInput) firstInput.focus();
            }, 10);
            
            newRow.querySelector('.remove-account-mapping').addEventListener('click', () => {
                newRow.remove();
                // If table becomes empty, show empty state
                if (tbody.querySelectorAll('tr').length === 0) {
                    const emptyRow = document.createElement('tr');
                    emptyRow.innerHTML = `
                        <td colspan="4" class="text-muted" style="text-align: center; padding: 2rem;">
                            No account mappings found. Click "Add Account Mapping" to create one.
                        </td>
                    `;
                    tbody.appendChild(emptyRow);
                }
            });
        });
    }

    // Set up Remove button event listeners
    document.querySelectorAll('.remove-account-mapping').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const row = e.target.closest('tr');
            if (row) {
                row.remove();
                const tbody = document.getElementById('account-mappings-tbody');
                // If table becomes empty, show empty state
                if (tbody && tbody.querySelectorAll('tr').length === 0) {
                    const emptyRow = document.createElement('tr');
                    emptyRow.innerHTML = `
                        <td colspan="4" class="text-muted" style="text-align: center; padding: 2rem;">
                            No account mappings found. Click "Add Account Mapping" to create one.
                        </td>
                    `;
                    tbody.appendChild(emptyRow);
                }
            }
        });
    });
}

async function saveAccountMappings() {
    const tbody = document.getElementById('account-mappings-tbody');
    if (!tbody) return;

    const mappings = [];
    tbody.querySelectorAll('tr').forEach(row => {
        // Skip empty state row
        if (row.querySelector('td[colspan="4"]')) {
            return;
        }

        const sourceName = row.querySelector('.account-source-name')?.value.trim();
        const unifiedNumber = row.querySelector('.account-unified-number')?.value.trim();
        const unifiedName = row.querySelector('.account-unified-name')?.value.trim();

        // Only add if all fields are filled
        if (sourceName && unifiedNumber && unifiedName) {
            mappings.push({
                source_account_name: sourceName,
                unified_account_number: unifiedNumber,
                unified_account_name: unifiedName
            });
        }
    });

    if (mappings.length === 0) {
        alert('No valid mappings to save. Please add at least one mapping with all fields filled.');
        return;
    }

    try {
        const response = await fetch('/api/mappings/financial/accounts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mappings })
        });

        const result = await response.json();
        if (result.ok) {
            alert(`Account mappings saved successfully! (${mappings.length} mapping(s))`);
            // Small delay to ensure backend has written the file
            setTimeout(() => {
                loadAccountMappings();
            }, 100);
            // Refresh variances and data quality views if on financial page
            if (window.loadVariances) {
                setTimeout(() => {
                    if (window.loadVariances) window.loadVariances();
                }, 200);
            }
            if (window.loadDataQuality) {
                setTimeout(() => {
                    if (window.loadDataQuality) window.loadDataQuality();
                }, 200);
            }
        } else {
            alert(`Error: ${result.error || 'Failed to save mappings'}`);
        }
    } catch (err) {
        console.error('Error saving account mappings:', err);
        alert('Error saving account mappings');
    }
}

async function loadCostCenterMappings() {
    const container = document.getElementById('cost-center-mappings-content');
    if (!container) return;

    try {
        const response = await fetch('/api/mappings/financial/cost-centers');
        if (response.ok) {
            const data = await response.json();
            renderCostCenterMappings(data.data || []);
        } else {
            container.innerHTML = '<p class="text-muted">Error loading cost center mappings</p>';
        }
    } catch (err) {
        console.error(err);
        container.innerHTML = '<p class="text-muted">Error loading cost center mappings</p>';
    }
}

function renderCostCenterMappings(mappings) {
    const container = document.getElementById('cost-center-mappings-content');
    if (!container) return;

    // Always show the table and Add button, even if no mappings exist
    container.innerHTML = `
        <div style="margin-bottom: 1rem;">
            <button id="add-cost-center-mapping" class="btn btn-ghost" style="border: 1px dashed var(--slate-300); width: 100%;">
                <i class="ph ph-plus" style="margin-right: 0.5rem;"></i> Add Cost Center Mapping
            </button>
        </div>
        <table class="data-table-modern">
            <thead>
                <tr>
                    <th>Source Cost Center</th>
                    <th>Unified Cost Center</th>
                    <th>Unified Cost Center Name</th>
                    <th style="width: 100px;">Actions</th>
                </tr>
            </thead>
            <tbody id="cost-center-mappings-tbody">
                ${mappings.length === 0 ? `
                    <tr>
                        <td colspan="4" class="text-muted" style="text-align: center; padding: 2rem;">
                            No cost center mappings found. Click "Add Cost Center Mapping" to create one.
                        </td>
                    </tr>
                ` : mappings.map((m, idx) => `
                    <tr data-index="${idx}">
                        <td><input type="text" class="input-modern cc-source" value="${escapeHtml(m.source_cost_center || '')}" placeholder="CC10"></td>
                        <td><input type="text" class="input-modern cc-unified" value="${escapeHtml(m.unified_cost_center || '')}" placeholder="UCC100"></td>
                        <td><input type="text" class="input-modern cc-unified-name" value="${escapeHtml(m.unified_cost_center_name || '')}" placeholder="Manufacturing"></td>
                        <td><button class="remove-cost-center-mapping btn btn-ghost" data-index="${idx}" style="color: var(--danger); padding: 0.5rem;"><i class="ph ph-trash"></i></button></td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    window.costCenterMappings = mappings;

    // Set up Add button event listener
    const addBtn = document.getElementById('add-cost-center-mapping');
    if (addBtn) {
        // Remove any existing listeners by cloning
        const newAddBtn = addBtn.cloneNode(true);
        addBtn.parentNode.replaceChild(newAddBtn, addBtn);

        newAddBtn.addEventListener('click', () => {
            const tbody = document.getElementById('cost-center-mappings-tbody');
            if (!tbody) return;

            // Remove empty state row if it exists
            const emptyRow = tbody.querySelector('tr td[colspan="4"]');
            if (emptyRow) {
                emptyRow.closest('tr').remove();
            }

            const newRow = document.createElement('tr');
            newRow.innerHTML = `
                <td><input type="text" class="input-modern cc-source" placeholder="CC10"></td>
                <td><input type="text" class="input-modern cc-unified" placeholder="UCC100"></td>
                <td><input type="text" class="input-modern cc-unified-name" placeholder="Manufacturing"></td>
                <td><button class="remove-cost-center-mapping btn btn-ghost" style="color: var(--danger); padding: 0.5rem;"><i class="ph ph-trash"></i></button></td>
            `;
            tbody.appendChild(newRow);
            
            // Scroll to the new row and focus on first input
            setTimeout(() => {
                // Scroll the table container to show the new row at the bottom
                const table = tbody.closest('table');
                if (table) {
                    table.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
                newRow.scrollIntoView({ behavior: 'smooth', block: 'end' });
                const firstInput = newRow.querySelector('.cc-source');
                if (firstInput) firstInput.focus();
            }, 10);
            
            newRow.querySelector('.remove-cost-center-mapping').addEventListener('click', () => {
                newRow.remove();
                // If table becomes empty, show empty state
                if (tbody.querySelectorAll('tr').length === 0) {
                    const emptyRow = document.createElement('tr');
                    emptyRow.innerHTML = `
                        <td colspan="4" class="text-muted" style="text-align: center; padding: 2rem;">
                            No cost center mappings found. Click "Add Cost Center Mapping" to create one.
                        </td>
                    `;
                    tbody.appendChild(emptyRow);
                }
            });
        });
    }

    // Set up Remove button event listeners
    document.querySelectorAll('.remove-cost-center-mapping').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const row = e.target.closest('tr');
            if (row) {
                row.remove();
                const tbody = document.getElementById('cost-center-mappings-tbody');
                // If table becomes empty, show empty state
                if (tbody && tbody.querySelectorAll('tr').length === 0) {
                    const emptyRow = document.createElement('tr');
                    emptyRow.innerHTML = `
                        <td colspan="4" class="text-muted" style="text-align: center; padding: 2rem;">
                            No cost center mappings found. Click "Add Cost Center Mapping" to create one.
                        </td>
                    `;
                    tbody.appendChild(emptyRow);
                }
            }
        });
    });
}

async function saveCostCenterMappings() {
    const tbody = document.getElementById('cost-center-mappings-tbody');
    if (!tbody) return;

    const mappings = [];
    tbody.querySelectorAll('tr').forEach(row => {
        // Skip empty state row
        if (row.querySelector('td[colspan="4"]')) {
            return;
        }

        const source = row.querySelector('.cc-source')?.value.trim();
        const unified = row.querySelector('.cc-unified')?.value.trim();
        const unifiedName = row.querySelector('.cc-unified-name')?.value.trim();

        // Only add if all fields are filled
        if (source && unified && unifiedName) {
            mappings.push({
                source_cost_center: source,
                unified_cost_center: unified,
                unified_cost_center_name: unifiedName
            });
        }
    });

    if (mappings.length === 0) {
        alert('No valid mappings to save. Please add at least one mapping with all fields filled.');
        return;
    }

    try {
        const response = await fetch('/api/mappings/financial/cost-centers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mappings })
        });

        const result = await response.json();
        if (result.ok) {
            alert(`Cost center mappings saved successfully! (${mappings.length} mapping(s))`);
            // Small delay to ensure backend has written the file
            setTimeout(() => {
                loadCostCenterMappings();
            }, 100);
            // Refresh variances and data quality views if on financial page
            if (window.loadVariances) {
                setTimeout(() => {
                    if (window.loadVariances) window.loadVariances();
                }, 200);
            }
            if (window.loadDataQuality) {
                setTimeout(() => {
                    if (window.loadDataQuality) window.loadDataQuality();
                }, 200);
            }
        } else {
            alert(`Error: ${result.error || 'Failed to save mappings'}`);
        }
    } catch (err) {
        console.error('Error saving cost center mappings:', err);
        alert('Error saving cost center mappings');
    }
}

const loadVendorRules = async () => {
    const container = document.getElementById('vendor-rules-content');
    if (!container) return;

    try {
        const response = await fetch('/api/mappings/vendor');
        if (response.ok) {
            const rules = await response.json();
            renderVendorRules(rules);
        } else {
            container.innerHTML = '<p class="text-muted">Error loading rules</p>';
        }
    } catch (err) {
        console.error(err);
        container.innerHTML = '<p class="text-muted">Error loading rules</p>';
    }
};

const renderVendorRules = (rules) => {
    const container = document.getElementById('vendor-rules-content');
    if (!container) return;

    container.innerHTML = `
    <div style="margin-bottom: 2rem;">
      <p class="text-muted" style="font-size: 0.875rem;">Last updated: ${rules.last_updated ? new Date(rules.last_updated).toLocaleString() : 'Never'} by ${rules.updated_by || 'system'}</p>
    </div>
    
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
        <div>
            <h4 style="margin-bottom: 1rem; font-size: 1rem; font-weight: 600; color: var(--slate-900);">Matching Thresholds</h4>
            <div style="background: var(--slate-50); padding: 1.5rem; border-radius: var(--radius-md); border: 1px solid var(--slate-200);">
                <div style="margin-bottom: 1.5rem;">
                <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; font-size: 0.875rem; color: var(--slate-700);">Confidence Threshold (0-100)</label>
                <input type="number" id="confidence-threshold" class="input-modern" value="${rules.confidence_threshold || 85}" min="0" max="100">
                </div>
                <div style="margin-bottom: 1.5rem;">
                <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; font-size: 0.875rem; color: var(--slate-700);">Name Weight (0-1)</label>
                <input type="number" id="name-weight" class="input-modern" value="${rules.name_weight || 0.7}" min="0" max="1" step="0.1">
                </div>
                <div>
                <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; font-size: 0.875rem; color: var(--slate-700);">Address Weight (0-1)</label>
                <input type="number" id="address-weight" class="input-modern" value="${rules.address_weight || 0.3}" min="0" max="1" step="0.1">
                </div>
            </div>
        </div>
    </div>
  `;

    window.currentVendorRules = rules;
};

const saveVendorRules = async () => {
    const rules = {
        confidence_threshold: parseInt(document.getElementById('confidence-threshold').value),
        name_weight: parseFloat(document.getElementById('name-weight').value),
        address_weight: parseFloat(document.getElementById('address-weight').value),
        normalization_rules: window.currentVendorRules?.normalization_rules || {},
        manual_overrides: window.currentVendorRules?.manual_overrides || {}
    };

    try {
        const response = await fetch('/api/mappings/vendor', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(rules)
        });

        if (response.ok) {
            alert('Vendor rules saved successfully!');
            loadVendorRules();
        } else {
            const error = await response.json();
            alert(`Error: ${error.error || 'Failed to save rules'}`);
        }
    } catch (err) {
        console.error(err);
        alert('Error saving rules');
    }
};

// Event listeners
document.getElementById('save-account-mappings')?.addEventListener('click', saveAccountMappings);
document.getElementById('save-cost-center-mappings')?.addEventListener('click', saveCostCenterMappings);
document.getElementById('save-vendor-rules')?.addEventListener('click', saveVendorRules);

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
