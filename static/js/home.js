// Home page JavaScript - Fiori Launchpad Style
document.addEventListener('DOMContentLoaded', () => {
    const role = localStorage.getItem('tmhna_role') || 'maya';
    
    // Load all KPIs
    loadKPIData(role);
    
    // Initialize forklifts counter
    initializeForkliftsCounter();
});

const loadKPIData = async (role) => {
    try {
        // Load vendor data for vendor count
        const vendorEl = document.getElementById('kpi-vendor-records');
        
        if (role === 'maya') {
            // For Maya, show harmonized vendors
            const vendorRes = await fetch('/api/vendors/harmonized');
            if (vendorRes.ok) {
                const vendor = await vendorRes.json();
                const vendorData = vendor.data || [];
                if (vendorEl) {
                    vendorEl.textContent = vendorData.length;
                }
            }
        } else {
            // For Liam and Ethan, show total raw vendors for their brand
            const vendorRes = await fetch('/api/vendors/raw');
            if (vendorRes.ok) {
                const vendor = await vendorRes.json();
                let vendorCount = 0;
                if (role === 'liam') {
                    vendorCount = (vendor.raymond || []).length;
                } else if (role === 'ethan') {
                    vendorCount = (vendor.tmh || []).length;
                }
                if (vendorEl) {
                    vendorEl.textContent = vendorCount;
                }
            }
        }
        
        
        // Load financial records count
        const financialRes = await fetch('/api/financial/records-count').catch(() => ({ ok: false }));
        if (financialRes.ok) {
            const financial = await financialRes.json();
            const financialRecordsCount = financial.count || 0;
            const financialEl = document.getElementById('kpi-financial-records');
            if (financialEl) {
                financialEl.textContent = financialRecordsCount;
            }
        }
        
    } catch (err) {
        console.error('Error loading KPI data:', err);
    }
};

const escapeHtml = (text) => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
};

// ============================================
// Forklifts Built This Week Counter
// ============================================

let forkliftsUpdateInterval = null;

const initializeForkliftsCounter = () => {
    // Calculate and display immediately
    updateForkliftsCounter();
    
    // Update every 4 minutes (240,000 milliseconds)
    forkliftsUpdateInterval = setInterval(() => {
        updateForkliftsCounter();
    }, 4 * 60 * 1000);
};

const updateForkliftsCounter = () => {
    const forkliftsBuilt = calculateForkliftsBuilt();
    const target = 1900;
    
    // Update the counter display
    const counterEl = document.getElementById('kpi-forklifts-built');
    if (counterEl) {
        // Format number with commas
        counterEl.textContent = forkliftsBuilt.toLocaleString();
    }
    
    // Calculate percentage
    const percentage = Math.min((forkliftsBuilt / target) * 100, 100);
    
    // Update progress bar (try both possible IDs)
    const progressFillEl = document.getElementById('forklift-progress-fill');
    if (progressFillEl) {
        progressFillEl.style.width = `${percentage}%`;
    }
    
    // Update progress text
    const progressTextEl = document.getElementById('forklift-progress-text');
    if (progressTextEl) {
        progressTextEl.textContent = `${percentage.toFixed(1)}%`;
    }
};

const calculateForkliftsBuilt = () => {
    const now = new Date();
    
    // Get Monday 00:00:00 of current week (local time)
    const monday = getMondayOfCurrentWeek(now);
    
    // Calculate minutes elapsed since Monday 00:00
    const minutesElapsed = Math.floor((now - monday) / (1000 * 60));
    
    // Calculate forklifts built (1 every 4 minutes)
    let forkliftsBuilt = Math.floor(minutesElapsed / 4);
    
    // Cap at 1,900
    forkliftsBuilt = Math.min(forkliftsBuilt, 1900);
    
    return forkliftsBuilt;
};

const getMondayOfCurrentWeek = (date) => {
    // Clone the date to avoid mutating the original
    const d = new Date(date);
    
    // Get day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
    const dayOfWeek = d.getDay();
    
    // Calculate days to subtract to get to Monday
    // If it's Sunday (0), subtract 6 days. Otherwise subtract (dayOfWeek - 1) days
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    
    // Set to Monday 00:00:00.000
    d.setDate(d.getDate() - daysToMonday);
    d.setHours(0, 0, 0, 0);
    
    return d;
};
