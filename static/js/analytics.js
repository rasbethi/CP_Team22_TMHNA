// Analytics JavaScript - Read-only analytics dashboard
document.addEventListener('DOMContentLoaded', () => {
    // Get role from session (injected in base template) or localStorage
    let role = 'maya';
    try {
        role = window.currentRole || localStorage.getItem('tmhna_role') || 'maya';
        localStorage.setItem('tmhna_role', role);
    } catch (e) {
        console.error('Error getting role:', e);
    }

    console.log('Analytics page loaded, role:', role);

    // Load all analytics
    Promise.all([
        loadDataQualityAnalytics(),
        loadVarianceAnalytics(),
        loadSubmissionAnalytics()
    ]).then(() => {
        // Load charts after data is loaded
        loadAllCharts(role);
    });

    // Load mapping impact only for Maya
    if (role === 'maya') {
        loadMappingImpactAnalytics();
    }
});

// Load all charts after analytics data is ready
function loadAllCharts(role) {
    setTimeout(() => {
        loadDataReadinessChart();
        loadVarianceBreakdownChart();
        loadVendorHarmonizationChart();
        loadVendorConfidenceChart();
        if (role === 'maya') {
            loadMappingCoverageChart();
        }
    }, 300);
}

function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getReadinessColor(percent) {
    if (percent >= 90) return '#10B981'; // Green
    if (percent >= 70) return '#F59E0B'; // Yellow
    return '#EF4444'; // Red
}

async function loadDataQualityAnalytics() {
    const container = document.getElementById('data-quality-analytics');
    if (!container) return;

    try {
        const response = await fetch('/api/analytics/data-quality');
        const data = await response.json();

        if (data.total_raw_rows === 0) {
            container.innerHTML = '<p class="text-muted">No data available yet</p>';
            return;
        }

        const readinessColor = getReadinessColor(data.readiness_percent);
        const statusText = data.readiness_percent >= 90 ? '✓ Excellent' :
            data.readiness_percent >= 70 ? '⚠ Good' : '✗ Needs Attention';

        container.innerHTML = `
            <div class="kpi-row">
                <div class="kpi-card">
                    <div class="kpi-title">Total Rows</div>
                    <div class="kpi-value">${data.total_raw_rows}</div>
                </div>
                <div class="kpi-card" style="border-left: 4px solid #10B981;">
                    <div class="kpi-title" style="color: #059669;">Mapped</div>
                    <div class="kpi-value" style="color: #10B981;">${data.fully_mapped_rows}</div>
                </div>
                <div class="kpi-card" style="border-left: 4px solid #EF4444;">
                    <div class="kpi-title" style="color: #dc2626;">Unmapped</div>
                    <div class="kpi-value" style="color: #EF4444;">${data.unmapped_rows}</div>
                </div>
                <div class="kpi-card" style="border-left: 4px solid ${readinessColor}; background: linear-gradient(to right, rgba(255,255,255,0.9), rgba(255,255,255,0.5));">
                    <div class="kpi-title" style="color: ${readinessColor};">Readiness</div>
                    <div class="kpi-value" style="color: ${readinessColor};">${data.readiness_percent}%</div>
                    <div style="font-size: 0.875rem; color: ${readinessColor}; margin-top: 0.5rem; font-weight: 600;">${statusText}</div>
                </div>
            </div>
        `;
    } catch (err) {
        console.error('Error loading data quality analytics:', err);
        container.innerHTML = '<p class="text-muted">Error loading analytics</p>';
    }
}

function loadDataReadinessChart() {
    const ctx = document.getElementById('data-readiness-chart');
    if (!ctx) return;

    fetch('/api/analytics/data-quality').then(response => response.json()).then(data => {
        if (data.total_raw_rows > 0) {
            new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['Fully Mapped', 'Unmapped'],
                    datasets: [{
                        data: [data.fully_mapped_rows, data.unmapped_rows],
                        backgroundColor: ['#10B981', '#EF4444'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    cutout: '70%',
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                padding: 20,
                                font: { size: 12, family: 'Inter' },
                                usePointStyle: true,
                                pointStyle: 'circle'
                            }
                        }
                    }
                }
            });
        } else {
            ctx.parentElement.innerHTML = '<p class="text-muted" style="text-align: center;">No data available</p>';
        }
    }).catch(err => {
        console.error('Error loading data readiness chart:', err);
    });
}

async function loadVarianceAnalytics() {
    const container = document.getElementById('variance-analytics');
    if (!container) return;

    try {
        const response = await fetch('/api/analytics/variances');
        const data = await response.json();

        // Show data even if zero for consistent layout
        if (data.total_variances === 0) {
            container.innerHTML = `
                <div style="margin-bottom: 1.5rem;">
                    <div class="kpi-card" style="border-left: 4px solid #10B981; max-width: 240px;">
                        <div class="kpi-title" style="color: #059669;">Total Variances</div>
                        <div class="kpi-value" style="color: #10B981;">0</div>
                    </div>
                </div>
                <p class="text-muted" style="font-size: 0.875rem;">No variances detected. Great job!</p>
            `;
            return;
        }

        // Build variance type table
        let typeRows = '';
        const sortedTypes = Object.entries(data.by_type).sort((a, b) => b[1] - a[1]);
        for (const [varianceType, count] of sortedTypes) {
            typeRows += `
                <tr>
                    <td>${escapeHtml(varianceType)}</td>
                    <td class="text-end"><strong>${count}</strong></td>
                </tr>
            `;
        }

        // Build brand breakdown (if multiple brands)
        let brandRows = '';
        const sortedBrands = Object.entries(data.by_brand).sort((a, b) => b[1] - a[1]);
        if (sortedBrands.length > 0) {
            for (const [brand, count] of sortedBrands) {
                brandRows += `
                    <tr>
                        <td>${escapeHtml(brand)}</td>
                        <td class="text-end"><strong>${count}</strong></td>
                    </tr>
                `;
            }
        }

        container.innerHTML = `
            <div style="margin-bottom: 1.5rem;">
                <div class="kpi-card" style="border-left: 4px solid #EF4444; max-width: 240px;">
                    <div class="kpi-title" style="color: #dc2626;">Total Variances</div>
                    <div class="kpi-value" style="color: #EF4444;">${data.total_variances}</div>
                </div>
            </div>
            
            <div style="display: grid; gap: 1.5rem;">
                ${typeRows ? `
                <div>
                    <h4 style="margin-bottom: 1rem; font-size: 0.875rem; font-weight: 600; text-transform: uppercase; color: var(--slate-600);">By Type</h4>
                    <table class="data-table-modern">
                        <thead>
                            <tr>
                                <th>Type</th>
                                <th class="text-end">Count</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${typeRows}
                        </tbody>
                    </table>
                </div>
                ` : ''}
                ${brandRows ? `
                <div>
                    <h4 style="margin-bottom: 1rem; font-size: 0.875rem; font-weight: 600; text-transform: uppercase; color: var(--slate-600);">By Brand</h4>
                    <table class="data-table-modern">
                        <thead>
                            <tr>
                                <th>Brand</th>
                                <th class="text-end">Count</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${brandRows}
                        </tbody>
                    </table>
                </div>
                ` : ''}
            </div>
        `;
    } catch (err) {
        console.error('Error loading variance analytics:', err);
        container.innerHTML = '<p class="text-muted">Error loading analytics</p>';
    }
}

function loadVarianceBreakdownChart() {
    const ctx = document.getElementById('variance-breakdown-chart');
    if (!ctx) return;

    fetch('/api/analytics/variances').then(response => response.json()).then(data => {
        const sortedTypes = Object.entries(data.by_type || {}).sort((a, b) => b[1] - a[1]);

        if (sortedTypes.length > 0) {
            const labels = sortedTypes.map(([type]) => type);
            const counts = sortedTypes.map(([, count]) => count);

            new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Count',
                        data: counts,
                        backgroundColor: '#3b82f6',
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { beginAtZero: true, grid: { color: '#f1f5f9' } },
                        x: { grid: { display: false } }
                    }
                }
            });
        } else {
            ctx.parentElement.innerHTML = '<p class="text-muted" style="text-align: center;">No variances</p>';
        }
    }).catch(err => {
        console.error('Error loading variance breakdown chart:', err);
    });
}

function loadVarianceByBrandChart() {
    // Similar consistent styling...
    // (Existing implementation was mostly fine, just ensuring consistency)
}

async function loadSubmissionAnalytics() {
    const container = document.getElementById('submission-analytics');
    if (!container) return;

    try {
        const response = await fetch('/api/analytics/submissions');
        const data = await response.json();

        if (data.total_submissions === 0) {
            container.innerHTML = `
                <div style="margin-bottom: 1.5rem;">
                    <div class="kpi-card" style="border-left: 4px solid #3b82f6; max-width: 240px;">
                        <div class="kpi-title" style="color: #2563eb;">Total Submissions</div>
                        <div class="kpi-value" style="color: #3b82f6;">0</div>
                    </div>
                </div>
                <p class="text-muted" style="font-size: 0.875rem;">No submissions yet</p>
            `;
            return;
        }

        // Build status breakdown
        let statusRows = '';
        const statusOrder = ['SUBMITTED', 'APPROVED', 'REJECTED', 'DRAFT'];
        for (const status of statusOrder) {
            const count = data.by_status[status] || 0;
            if (count > 0) {
                statusRows += `
                    <tr>
                        <td>${escapeHtml(status)}</td>
                        <td class="text-end"><strong>${count}</strong></td>
                    </tr>
                `;
            }
        }

        // Build brand breakdown
        let brandRows = '';
        const sortedBrands = Object.entries(data.by_brand).sort((a, b) => b[1] - a[1]);
        if (sortedBrands.length > 0) {
            for (const [brand, count] of sortedBrands) {
                brandRows += `
                    <tr>
                        <td>${escapeHtml(brand)}</td>
                        <td class="text-end"><strong>${count}</strong></td>
                    </tr>
                `;
            }
        }

        container.innerHTML = `
            <div style="margin-bottom: 1.5rem;">
                <div class="kpi-card" style="border-left: 4px solid #3b82f6; max-width: 240px;">
                    <div class="kpi-title" style="color: #2563eb;">Total Submissions</div>
                    <div class="kpi-value" style="color: #3b82f6;">${data.total_submissions}</div>
                </div>
            </div>
            
            <div style="display: grid; gap: 1.5rem;">
                ${statusRows ? `
                <div>
                    <h4 style="margin-bottom: 1rem; font-size: 0.875rem; font-weight: 600; text-transform: uppercase; color: var(--slate-600);">By Status</h4>
                    <table class="data-table-modern">
                        <thead>
                            <tr>
                                <th>Status</th>
                                <th class="text-end">Count</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${statusRows}
                        </tbody>
                    </table>
                </div>
                ` : ''}
                ${brandRows ? `
                <div>
                     <h4 style="margin-bottom: 1rem; font-size: 0.875rem; font-weight: 600; text-transform: uppercase; color: var(--slate-600);">By Brand</h4>
                    <table class="data-table-modern">
                        <thead>
                            <tr>
                                <th>Brand</th>
                                <th class="text-end">Count</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${brandRows}
                        </tbody>
                    </table>
                </div>
                ` : ''}
            </div>
            ${data.avg_time_to_approve !== null ? `
            <div style="margin-top: 1.5rem; padding: 1rem; background: var(--slate-50); border: 1px solid var(--slate-200); border-radius: var(--radius-sm); font-size: 0.875rem;">
                <strong style="color: var(--slate-900);">Avg Time to Approve:</strong> <span style="color: var(--accent); font-weight: 600;">${data.avg_time_to_approve} hours</span>
            </div>
            ` : ''}
        `;
    } catch (err) {
        console.error('Error loading submission analytics:', err);
        container.innerHTML = '<p class="text-muted">Error loading analytics</p>';
    }
}

function loadSubmissionStatusChart() {
    const ctx = document.getElementById('submission-status-chart');
    if (!ctx) return;

    fetch('/api/analytics/submissions').then(response => response.json()).then(data => {
        const statusOrder = ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'];
        const labels = statusOrder.filter(status => (data.by_status[status] || 0) > 0);
        const counts = labels.map(status => data.by_status[status] || 0);

        if (labels.length > 0) {
            const colors = {
                'DRAFT': '#94a3b8',
                'SUBMITTED': '#3b82f6',
                'APPROVED': '#10b981',
                'REJECTED': '#ef4444'
            };

            new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Count',
                        data: counts,
                        backgroundColor: labels.map(s => colors[s] || '#3b82f6'),
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { beginAtZero: true, grid: { color: '#f1f5f9' } },
                        x: { grid: { display: false } }
                    }
                }
            });
        } else {
            ctx.parentElement.innerHTML = '<p class="text-muted" style="text-align: center;">No submissions</p>';
        }
    }).catch(err => {
        console.error('Error loading submission status chart:', err);
    });
}

async function loadMappingImpactAnalytics() {
    const container = document.getElementById('mapping-impact-analytics');
    if (!container) return;

    try {
        const response = await fetch('/api/analytics/mapping-impact');
        const data = await response.json();

        container.innerHTML = `
            <div class="kpi-row">
                <div class="kpi-card" style="border-left: 4px solid #3b82f6;">
                    <div class="kpi-title" style="color: #2563eb;">Account Mappings</div>
                    <div class="kpi-value" style="color: #3b82f6;">${data.total_account_mappings}</div>
                </div>
                <div class="kpi-card" style="border-left: 4px solid #3b82f6;">
                    <div class="kpi-title" style="color: #2563eb;">Cost Center Mappings</div>
                    <div class="kpi-value" style="color: #3b82f6;">${data.total_cost_center_mappings}</div>
                </div>
                <div class="kpi-card" style="border-left: 4px solid ${data.current_variances > 0 ? '#EF4444' : '#10B981'};">
                    <div class="kpi-title" style="color: ${data.current_variances > 0 ? '#dc2626' : '#059669'};">Current Variances</div>
                    <div class="kpi-value" style="color: ${data.current_variances > 0 ? '#EF4444' : '#10B981'};">${data.current_variances}</div>
                </div>
            </div>
        `;

        // Mapping coverage chart is in the same card, handled separately
    } catch (err) {
        console.error('Error loading mapping impact analytics:', err);
        container.innerHTML = '<p class="text-muted">Error loading analytics</p>';
    }
}

function loadVendorHarmonizationChart() {
    const ctx = document.getElementById('vendor-harmonization-chart');
    if (!ctx) return;

    fetch('/api/analytics/vendor-harmonization').then(response => response.json()).then(data => {
        if (data.harmonized_count === 0 && data.unmatched_count === 0) {
            ctx.parentElement.innerHTML = '<p class="text-muted" style="text-align: center;">No vendor data available</p>';
            return;
        }

        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Harmonized Vendors', 'Unmatched Vendors'],
                datasets: [{
                    label: 'Vendor Count',
                    data: [data.harmonized_count, data.unmatched_count],
                    backgroundColor: ['#10B981', '#F59E0B'],
                    borderWidth: 0,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ${context.parsed.y}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0,
                            font: { size: 12, family: 'Inter' }
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        }
                    },
                    x: {
                        ticks: {
                            font: { size: 12, family: 'Inter' }
                        },
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }).catch(err => {
        console.error('Error loading vendor harmonization chart:', err);
        if (ctx.parentElement) {
            ctx.parentElement.innerHTML = '<p class="text-muted" style="text-align: center;">Error loading chart</p>';
        }
    });
}

function loadVendorConfidenceChart() {
    const ctx = document.getElementById('vendor-confidence-chart');
    if (!ctx) return;

    fetch('/api/analytics/vendor-harmonization').then(response => response.json()).then(data => {
        const vendors = data.vendor_confidence_scores || [];
        
        if (vendors.length === 0) {
            ctx.parentElement.innerHTML = '<p class="text-muted" style="text-align: center;">No vendor data available</p>';
            return;
        }

        // Get top 8 vendors for better visualization
        const topVendors = vendors.slice(0, 8);
        const labels = topVendors.map(v => {
            // Truncate long vendor names
            const name = v.vendor_name || 'Unknown';
            return name.length > 20 ? name.substring(0, 17) + '...' : name;
        });
        const scores = topVendors.map(v => v.confidence_score);
        const colors = topVendors.map(v => v.is_harmonized ? '#10B981' : '#F59E0B');

        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Confidence Score (%)',
                    data: scores,
                    backgroundColor: colors,
                    borderWidth: 0,
                    borderRadius: 6
                }]
            },
            options: {
                indexAxis: 'y', // Horizontal bar chart
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `Confidence: ${context.parsed.x}%`;
                            },
                            afterLabel: function(context) {
                                const vendor = topVendors[context.dataIndex];
                                return vendor.is_harmonized ? 'Status: Harmonized' : 'Status: Unmatched';
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            precision: 0,
                            font: { size: 12, family: 'Inter' },
                            callback: function(value) {
                                return value + '%';
                            }
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        }
                    },
                    y: {
                        ticks: {
                            font: { size: 11, family: 'Inter' }
                        },
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }).catch(err => {
        console.error('Error loading vendor confidence chart:', err);
        if (ctx.parentElement) {
            ctx.parentElement.innerHTML = '<p class="text-muted" style="text-align: center;">Error loading chart</p>';
        }
    });
}

function loadMappingCoverageChart() {
    const ctx = document.getElementById('mapping-coverage-chart');
    if (!ctx) return;

    fetch('/api/analytics/data-quality').then(response => response.json()).then(dqData => {
        const totalSourceAccounts = dqData.total_raw_rows || 0;
        const mappedAccounts = dqData.fully_mapped_rows || 0;
        const unmappedAccounts = dqData.unmapped_rows || 0;
        const coveragePercent = totalSourceAccounts > 0 ? ((mappedAccounts / totalSourceAccounts) * 100).toFixed(1) : 0;

        if (totalSourceAccounts > 0) {
            new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['Mapped', 'Unmapped'],
                    datasets: [{
                        label: 'Count',
                        data: [mappedAccounts, unmappedAccounts],
                        backgroundColor: ['#10B981', '#EF4444'],
                        borderRadius: 4
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: { display: false },
                        title: {
                            display: true,
                            text: `${coveragePercent}% Coverage`,
                            font: { size: 16, family: 'Inter', weight: '600' },
                            color: '#1e293b'
                        }
                    },
                    scales: {
                        x: { beginAtZero: true, grid: { color: '#f1f5f9' } },
                        y: { grid: { display: false } }
                    }
                }
            });
        } else {
            ctx.parentElement.innerHTML = '<p class="text-muted" style="text-align: center;">No data available</p>';
        }
    }).catch(err => {
        console.error('Error loading mapping coverage:', err);
    });
}
