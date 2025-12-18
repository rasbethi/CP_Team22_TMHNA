const getRole = () => localStorage.getItem('tmhna_role') || 'maya';

const renderTable = (tableEl, data) => {
  if (!tableEl) return;
  tableEl.className = 'data-table-modern';
  tableEl.innerHTML = "";
  if (!data || !data.length) {
    tableEl.innerHTML = "<caption>No data available</caption>";
    return;
  }

  const columns = Object.keys(data[0]);
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  columns.forEach((col) => {
    const th = document.createElement("th");
    th.textContent = col.replace(/_/g, " ");
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);

  const tbody = document.createElement("tbody");
  data.forEach((row) => {
    const tr = document.createElement("tr");
    columns.forEach((col) => {
      const td = document.createElement("td");
      const val = row[col];
      if (col === "confidence" || col === "match_confidence") {
        const pill = document.createElement("span");
        const score = val || 0;
        // Use inline styles for pills or new badge classes
        let color = '#ef4444';
        let bg = '#fef2f2';
        if (score >= 90) { color = '#10b981'; bg = '#ecfdf5'; }
        else if (score >= 75) { color = '#f59e0b'; bg = '#fffbeb'; }

        pill.style.cssText = `display: inline-block; padding: 2px 8px; border-radius: 99px; font-size: 12px; font-weight: 600; color: ${color}; background: ${bg};`;
        pill.textContent = `${score}%`;
        td.appendChild(pill);
      } else {
        td.textContent = val || '';
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  tableEl.appendChild(thead);
  tableEl.appendChild(tbody);
};

let mayaVendorViewMode = 'tmh'; // 'tmh' or 'raymond' for Maya's raw view

const renderRawVendors = (rawData, role) => {
  const tbody = document.getElementById('raw-vendor-body');
  if (!tbody) return;

  // Determine which brands to show
  let vendorsToShow = [];
  if (role === 'maya') {
    // Show only the selected brand for Maya
    if (mayaVendorViewMode === 'tmh') {
      vendorsToShow = (rawData.tmh || []).map(v => ({ ...v, sourceBrand: 'TMH' }));
    } else {
      vendorsToShow = (rawData.raymond || []).map(v => ({ ...v, sourceBrand: 'Raymond' }));
    }
  } else if (role === 'liam') {
    vendorsToShow = (rawData.raymond || []).map(v => ({ ...v, sourceBrand: 'Raymond' }));
  } else if (role === 'ethan') {
    vendorsToShow = (rawData.tmh || []).map(v => ({ ...v, sourceBrand: 'TMH' }));
  }

  if (vendorsToShow.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="padding: 2rem; text-align: center; color: var(--slate-500);">No vendor data available</td></tr>';
    return;
  }

  // Render table rows
  tbody.innerHTML = vendorsToShow.map(vendor => {
    const vendorName = vendor.Vendor_Name || vendor.vendor_name || '';
    const address = vendor.Address || vendor.address || '';
    const phone = vendor.Phone || vendor.phone || '';
    const sourceBrand = vendor.sourceBrand || '';
    const chipClass = sourceBrand.toLowerCase() === 'tmh' ? 'tmh' : 'raymond';
    
    return `
      <tr>
        <td>${escapeHtml(vendorName)}</td>
        <td>${escapeHtml(address)}</td>
        <td>${escapeHtml(phone)}</td>
        <td><span class="role-badge ${chipClass}">${escapeHtml(sourceBrand)}</span></td>
      </tr>
    `;
  }).join('');
};

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

const filterHarmonizedVendors = (data, role) => {
  if (role === 'maya') return data;
  if (role === 'liam') {
    return data.filter(v =>
      v.raymond_source_name ||
      (v.source_brands && v.source_brands.includes('Raymond'))
    );
  }
  if (role === 'ethan') {
    return data.filter(v =>
      v.tmh_source_name ||
      (v.source_brands && v.source_brands.includes('TMH'))
    );
  }
  return data;
};

const updateMetrics = (rawData, harmonizedData, role) => {
  const raw = rawData;
  const harmonized = filterHarmonizedVendors(harmonizedData.data, role);

  const totalRaw = role === 'maya'
    ? (raw.tmh?.length || 0) + (raw.raymond?.length || 0)
    : role === 'liam' ? (raw.raymond?.length || 0) : (raw.tmh?.length || 0);

  const totalHarmonized = harmonized.length;
  const duplicatesRemoved = Math.max(0, totalRaw - totalHarmonized);
  const crossMatches = harmonized.filter(v =>
    (v.tmh_source_name && v.raymond_source_name) ||
    (v.source_brands && v.source_brands.includes('TMH') && v.source_brands.includes('Raymond'))
  ).length;

  const countUp = (el, target) => {
    if (!el) return;
    let current = 0;
    const increment = target / 30;
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        el.textContent = Math.round(target);
        clearInterval(timer);
      } else {
        el.textContent = Math.round(current);
      }
    }, 50);
  };

  countUp(document.getElementById("metric-vendors-loaded"), totalRaw);
  countUp(document.getElementById("metric-duplicates-removed"), duplicatesRemoved);
  countUp(document.getElementById("metric-cross-matches"), crossMatches);
};

let allVendorData = { raw: null, harmonized: null };

const handleSearch = (searchTerm) => {
  if (!allVendorData.raw) return;
  const role = getRole();
  const term = searchTerm.toLowerCase().trim();

  const filterData = (data) => {
    if (!term) return data;
    return data.filter(row =>
      Object.values(row).some(val => {
        if (typeof val === 'object') return false;
        return String(val).toLowerCase().includes(term);
      })
    );
  };

  // Only filter raw data if we're on the raw pane
  const activePane = document.querySelector('.fiori-pane.active');
  if (activePane && activePane.id === 'raw-vendor-pane') {
    const rawFiltered = {
      tmh: filterData(allVendorData.raw.tmh || []),
      raymond: filterData(allVendorData.raw.raymond || [])
    };
    renderRawVendors(rawFiltered, role);
  }

  // Only filter harmonized data if we're on the unified pane and it exists
  if (activePane && activePane.id === 'unified-vendor-pane' && allVendorData.harmonized) {
    const harmonizedTable = document.getElementById("harmonized-vendor-table");
    if (harmonizedTable) {
      const harmonizedFiltered = filterData(filterHarmonizedVendors(allVendorData.harmonized.data, role));
      renderTable(harmonizedTable, harmonizedFiltered);
    }
  }
};

const hydrate = async () => {
  try {
    const role = getRole();
    const raw = await fetch("/api/vendors/raw").then(r => r.json());
    allVendorData.raw = raw;

    // Only render raw vendors if we're on the raw pane
    const activePane = document.querySelector('.fiori-pane.active');
    if (!activePane || activePane.id === 'raw-vendor-pane') {
      renderRawVendors(raw, role);
    }

    // Only load harmonized data for Maya
    if (role === 'maya') {
      const harmonized = await fetch("/api/vendors/harmonized").then(r => r.json());
      allVendorData.harmonized = harmonized;

      // Only render harmonized table if we're on the unified pane
      if (activePane && activePane.id === 'unified-vendor-pane') {
        const harmonizedTable = document.getElementById("harmonized-vendor-table");
        if (harmonizedTable) {
          const filtered = filterHarmonizedVendors(harmonized.data, role);
          renderTable(harmonizedTable, filtered);
        }
      }

      updateMetrics(raw, harmonized, role);
    } else {
      updateMetrics(raw, { data: [] }, role);
    }
  } catch (err) {
    console.error(err);
    alert("Unable to load vendor data. Please retry.");
  }
};

// Function to switch to a specific tab
const switchToVendorTab = (targetId) => {
  document.querySelectorAll(".fiori-pane").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".fiori-tab").forEach(t => t.classList.remove("active"));

  const targetPane = document.getElementById(targetId);
  const targetTab = document.querySelector(`[data-target="${targetId}"]`);

  if (targetPane && targetTab) {
    targetPane.classList.add("active");
    targetTab.classList.add("active");

    const role = getRole();

    // Load data when specific tabs are activated
    if (targetId === 'raw-vendor-pane') {
      if (allVendorData.raw) {
        renderRawVendors(allVendorData.raw, role);
      }
    } else if (targetId === 'unified-vendor-pane' && role === 'maya') {
      if (allVendorData.harmonized) {
        const harmonizedTable = document.getElementById("harmonized-vendor-table");
        if (harmonizedTable) {
          const filtered = filterHarmonizedVendors(allVendorData.harmonized.data, role);
          renderTable(harmonizedTable, filtered);
        }
      } else {
        // Load harmonized data if not already loaded
        fetch("/api/vendors/harmonized")
          .then(r => r.json())
          .then(harmonized => {
            allVendorData.harmonized = harmonized;
            const harmonizedTable = document.getElementById("harmonized-vendor-table");
            if (harmonizedTable) {
              const filtered = filterHarmonizedVendors(harmonized.data, role);
              renderTable(harmonizedTable, filtered);
            }
          })
          .catch(err => console.error(err));
      }
    }
  }
};

document.addEventListener("DOMContentLoaded", () => {
  hydrate();

  // Tabs
  document.querySelectorAll(".fiori-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      const targetId = tab.dataset.target;
      switchToVendorTab(targetId);
    });
  });

  // Toggle buttons for Maya's raw data view (only on vendors page)
  const toggleVendorTMH = document.getElementById('toggle-vendor-tmh');
  const toggleVendorRaymond = document.getElementById('toggle-vendor-raymond');
  
  if (toggleVendorTMH) {
    toggleVendorTMH.addEventListener('click', () => {
      const role = getRole();
      if (role !== 'maya') return;

      // Update active state
      toggleVendorTMH.classList.add('active');
      if (toggleVendorRaymond) toggleVendorRaymond.classList.remove('active');

      // Update view mode
      mayaVendorViewMode = 'tmh';

      // Re-render raw data
      if (allVendorData.raw) {
        renderRawVendors(allVendorData.raw, role);
      }
    });
  }
  
  if (toggleVendorRaymond) {
    toggleVendorRaymond.addEventListener('click', () => {
      const role = getRole();
      if (role !== 'maya') return;

      // Update active state
      if (toggleVendorTMH) toggleVendorTMH.classList.remove('active');
      toggleVendorRaymond.classList.add('active');

      // Update view mode
      mayaVendorViewMode = 'raymond';

      // Re-render raw data
      if (allVendorData.raw) {
        renderRawVendors(allVendorData.raw, role);
      }
    });
  }

  // Raw data download button - downloads based on selected brand
  const downloadRawBtn = document.getElementById("download-raw-vendors-csv");
  if (downloadRawBtn) {
    downloadRawBtn.addEventListener("click", () => {
      const role = getRole();
      let brand = null;
      
      // For Maya, use the toggle state
      if (role === 'maya') {
        brand = mayaVendorViewMode; // 'tmh' or 'raymond'
      } else if (role === 'liam') {
        brand = 'raymond';
      } else if (role === 'ethan') {
        brand = 'tmh';
      }
      
      const url = brand ? `/api/vendors/raw/csv?brand=${brand}` : "/api/vendors/raw/csv";
      window.location.href = url;
    });
  }

  // Unified data download button (Maya only)
  const downloadUnifiedBtn = document.getElementById("download-unified-vendors-csv");
  if (downloadUnifiedBtn) {
    downloadUnifiedBtn.addEventListener("click", () => {
      window.location.href = "/api/vendors/harmonized/csv";
    });
  }

  const searchInput = document.getElementById("vendor-search");
  const clearBtn = document.getElementById("clear-search-vendor");

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      handleSearch(e.target.value);
      if (clearBtn) {
        if (e.target.value) {
          clearBtn.classList.remove('hidden');
        } else {
          clearBtn.classList.add('hidden');
        }
      }
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      if (searchInput) {
        searchInput.value = "";
        handleSearch("");
        clearBtn.classList.add('hidden');
      }
    });
  }

  const roleSelector = document.getElementById('role-selector');
  if (roleSelector) {
    roleSelector.addEventListener('change', () => {
      setTimeout(() => hydrate(), 100);
    });
  }
});
