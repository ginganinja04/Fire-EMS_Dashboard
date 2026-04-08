<<<<<<< HEAD
let turnoutData = [];
let uhuData = [];
let oosData = [];
let stemiData = [];
let overdueData = [];

let turnoutChart = null;
let uhuChart = null;

const shiftFilter = document.getElementById("shiftFilter");
const battalionFilter = document.getElementById("battalionFilter");
const turnoutSort = document.getElementById("turnoutSort");
const uhuSort = document.getElementById("uhuSort");
const resetFilters = document.getElementById("resetFilters");

const activeShift = document.getElementById("activeShift");
const activeBattalion = document.getElementById("activeBattalion");
const lastUpdated = document.getElementById("lastUpdated");

const kpiTurnout = document.getElementById("kpiTurnout");
const kpiOOS = document.getElementById("kpiOOS");
const kpiUHU = document.getElementById("kpiUHU");
const kpiReports = document.getElementById("kpiReports");

const oosTableBody = document.getElementById("oosTableBody");
const stemiTableBody = document.getElementById("stemiTableBody");
const reportsTableBody = document.getElementById("reportsTableBody");

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatDateTimeNow() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function parseShiftFromValue(value) {
  if (value === "All") return "All";
  return value.trim().charAt(0).toUpperCase();
}

function getSelectedFilters() {
  return {
    shift: parseShiftFromValue(shiftFilter.value),
    battalion: battalionFilter.value
  };
}

function recordMatchesBattalion(record, selectedBattalion) {
  if (selectedBattalion === "All") return true;

  const battalionCandidates = [
    record.battalion,
    record.battalion_name,
    record.station_group,
    record.battalionname
  ]
    .filter(Boolean)
    .map((v) => String(v).trim());

  return battalionCandidates.includes(selectedBattalion);
}

function recordMatchesShift(record, selectedShift) {
  if (selectedShift === "All") return true;

  const shiftCandidates = [
    record.shift,
    record.active_shift
  ]
    .filter(Boolean)
    .map((v) => String(v).trim().charAt(0).toUpperCase());

  if (shiftCandidates.length === 0) {
    return true;
  }

  return shiftCandidates.includes(selectedShift);
}

function filterDataset(data) {
  const { shift, battalion } = getSelectedFilters();

  return data.filter((record) => {
    const battalionMatch = recordMatchesBattalion(record, battalion);
    const shiftMatch = recordMatchesShift(record, shift);
    return battalionMatch && shiftMatch;
  });
}

function sortTurnoutData(data) {
  const sortBy = turnoutSort.value;

  const sorted = [...data];

  if (sortBy === "missed") {
    sorted.sort((a, b) => safeNumber(b.missed_calls) - safeNumber(a.missed_calls));
  } else if (sortBy === "unit") {
    sorted.sort((a, b) => String(a.unit).localeCompare(String(b.unit)));
  } else {
    sorted.sort((a, b) => safeNumber(a.compliance_rate) - safeNumber(b.compliance_rate));
  }

  return sorted;
}

function sortUhuData(data) {
  const sortBy = uhuSort.value;

  const sorted = [...data];

  if (sortBy === "calls") {
    sorted.sort((a, b) => {
      const bVal = safeNumber(b.call_count_numeric ?? b.call_count);
      const aVal = safeNumber(a.call_count_numeric ?? a.call_count);
      return bVal - aVal;
    });
  } else if (sortBy === "unit") {
    sorted.sort((a, b) => String(a.unit).localeCompare(String(b.unit)));
  } else {
    sorted.sort((a, b) => {
      const bVal = safeNumber(b.uhu_numeric ?? b.uhu);
      const aVal = safeNumber(a.uhu_numeric ?? a.uhu);
      return bVal - aVal;
    });
  }

  return sorted;
}

function updateActiveFilterDisplay() {
  activeShift.textContent = getSelectedFilters().shift;
  activeBattalion.textContent = getSelectedFilters().battalion;
}

function updateKpis(filteredTurnout, filteredOos, filteredUhu, filteredOverdue) {
  const totalCalls = filteredTurnout.reduce((sum, row) => sum + safeNumber(row.total_calls), 0);
  const metCalls = filteredTurnout.reduce((sum, row) => sum + safeNumber(row.met_calls), 0);
  const turnoutRate = totalCalls > 0 ? metCalls / totalCalls : 0;

  const uhuValues = filteredUhu
    .map((row) => safeNumber(row.uhu_numeric ?? row.uhu))
    .filter((v) => Number.isFinite(v));

  const avgUhu = uhuValues.length > 0
    ? uhuValues.reduce((sum, v) => sum + v, 0) / uhuValues.length
    : 0;

  kpiTurnout.textContent = formatPercent(turnoutRate);
  kpiOOS.textContent = filteredOos.length;
  kpiUHU.textContent = avgUhu.toFixed(2);
  kpiReports.textContent = filteredOverdue.length;
}

function renderTurnoutChart(filteredTurnout) {
  const sorted = sortTurnoutData(filteredTurnout);

  const labels = sorted.map((row) => row.unit);
  const met = sorted.map((row) => safeNumber(row.met_calls));
  const missed = sorted.map((row) => safeNumber(row.missed_calls));

  const data = {
    labels,
    datasets: [
      {
        label: "Met",
        data: met,
        backgroundColor: "#16a34a"
      },
      {
        label: "Missed",
        data: missed,
        backgroundColor: "#dc2626"
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: "y",
    scales: {
      x: {
        stacked: true,
        beginAtZero: true
      },
      y: {
        stacked: true
      }
    },
    plugins: {
      legend: {
        position: "top"
      },
      tooltip: {
        callbacks: {
          afterBody: (items) => {
            const idx = items[0].dataIndex;
            const row = sorted[idx];
            const rate = safeNumber(row.compliance_rate);
            return `Compliance: ${formatPercent(rate)}`;
          }
        }
      }
    }
  };

  const ctx = document.getElementById("turnoutChart");

  if (turnoutChart) {
    turnoutChart.data = data;
    turnoutChart.options = options;
    turnoutChart.update();
  } else {
    turnoutChart = new Chart(ctx, {
      type: "bar",
      data,
      options
    });
  }
}

function renderUhuChart(filteredUhu) {
  const sorted = sortUhuData(filteredUhu).slice(0, 12);

  const labels = sorted.map((row) => row.unit);
  const values = sorted.map((row) => safeNumber(row.uhu_numeric ?? row.uhu));

  const data = {
    labels,
    datasets: [
      {
        label: "UHU",
        data: values,
        backgroundColor: "#2563eb"
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true
      }
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          afterBody: (items) => {
            const idx = items[0].dataIndex;
            const row = sorted[idx];
            const calls = safeNumber(row.call_count_numeric ?? row.call_count);
            const station = row.station ?? "Unknown";
            return [`Station: ${station}`, `Call Count: ${calls}`];
          }
        }
      }
    }
  };

  const ctx = document.getElementById("uhuChart");

  if (uhuChart) {
    uhuChart.data = data;
    uhuChart.options = options;
    uhuChart.update();
  } else {
    uhuChart = new Chart(ctx, {
      type: "bar",
      data,
      options
    });
  }
}

function createCell(text) {
  const td = document.createElement("td");
  td.textContent = text ?? "";
  return td;
}

function renderOosTable(filteredOos) {
  oosTableBody.innerHTML = "";

  const rows = [...filteredOos].sort((a, b) => {
    const aVal = safeNumber(a.elapsed_seconds);
    const bVal = safeNumber(b.elapsed_seconds);
    return bVal - aVal;
  });

  rows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.appendChild(createCell(row.unit));
    tr.appendChild(createCell(row.location));
    tr.appendChild(createCell(row.since));
    tr.appendChild(createCell(row.elapsed_h_m_s));
    oosTableBody.appendChild(tr);
  });
}

function renderStemiTable(filteredStemi) {
  stemiTableBody.innerHTML = "";

  const rows = [...filteredStemi].slice(0, 12);

  rows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.appendChild(createCell(row.incident_id ?? row.incident_number ?? ""));
    tr.appendChild(createCell(row.patient_name ?? ""));
    tr.appendChild(createCell(row.patient_dob ?? ""));
    tr.appendChild(createCell(row.destination ?? ""));
    tr.appendChild(
      createCell(
        row.minutes_unit_dispatch_to_destination_numeric ??
        row.minutes_unit_dispatch_to_destination ??
        ""
      )
    );
    stemiTableBody.appendChild(tr);
  });
}

function renderReportsTable(filteredOverdue) {
  reportsTableBody.innerHTML = "";

  const rows = [...filteredOverdue].sort((a, b) => {
    const aDate = a.incident_date_parsed ? new Date(a.incident_date_parsed).getTime() : 0;
    const bDate = b.incident_date_parsed ? new Date(b.incident_date_parsed).getTime() : 0;
    return aDate - bDate;
  });

  rows.slice(0, 20).forEach((row) => {
    const tr = document.createElement("tr");
    tr.appendChild(createCell(row.incident ?? row.incident_id ?? ""));
    tr.appendChild(createCell(row.incident_date ?? ""));
    tr.appendChild(createCell(row.vehicle_id ?? row.unit ?? ""));
    tr.appendChild(createCell(row.epcr_status ?? ""));
    tr.appendChild(createCell(row.crew_member_completing ?? ""));
    reportsTableBody.appendChild(tr);
  });
}

function applyFiltersAndRender() {
  updateActiveFilterDisplay();

  const filteredTurnout = filterDataset(turnoutData);
  const filteredUhu = filterDataset(uhuData);
  const filteredOos = filterDataset(oosData);
  const filteredStemi = filterDataset(stemiData);
  const filteredOverdue = filterDataset(overdueData);

  updateKpis(filteredTurnout, filteredOos, filteredUhu, filteredOverdue);
  renderTurnoutChart(filteredTurnout);
  renderUhuChart(filteredUhu);
  renderOosTable(filteredOos);
  renderStemiTable(filteredStemi);
  renderReportsTable(filteredOverdue);
}

async function loadJson(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.status}`);
  }
  return response.json();
}

async function initializeDashboard() {
  try {
    const [
      turnoutSummary,
      uhuSummary,
      oosSummary,
      stemiClean,
      overdueClean
    ] = await Promise.all([
      loadJson("../data/processed/turnout_summary.json"),
      loadJson("../data/processed/uhu_summary.json"),
      loadJson("../data/processed/oos_summary.json"),
      loadJson("../data/processed/stemi_clean.json"),
      loadJson("../data/processed/overdue_reports_clean.json")
    ]);

    turnoutData = turnoutSummary;
    uhuData = uhuSummary;
    oosData = oosSummary;
    stemiData = stemiClean;
    overdueData = overdueClean;

    lastUpdated.textContent = formatDateTimeNow();
    applyFiltersAndRender();
  } catch (error) {
    console.error(error);
    alert("There was a problem loading the dashboard data. Check file paths and JSON outputs.");
  }
}

shiftFilter.addEventListener("change", applyFiltersAndRender);
battalionFilter.addEventListener("change", applyFiltersAndRender);
turnoutSort.addEventListener("change", applyFiltersAndRender);
uhuSort.addEventListener("change", applyFiltersAndRender);

resetFilters.addEventListener("click", () => {
  shiftFilter.value = "All";
  battalionFilter.value = "All";
  turnoutSort.value = "compliance";
  uhuSort.value = "uhu";
  applyFiltersAndRender();
});

initializeDashboard();
=======

let turnoutData = [];
let uhuData = [];
let oosData = [];
let stemiData = [];
let overdueData = [];

let turnoutChart = null;
let uhuChart = null;

const shiftFilter = document.getElementById("shiftFilter");
const battalionFilter = document.getElementById("battalionFilter");
const turnoutSort = document.getElementById("turnoutSort");
const turnoutSortUnitOption = turnoutSort.querySelector('option[value="unit"]');
const uhuSort = document.getElementById("uhuSort");
const resetFilters = document.getElementById("resetFilters");

const activeShift = document.getElementById("activeShift");
const activeBattalion = document.getElementById("activeBattalion");
const lastUpdated = document.getElementById("lastUpdated");

const kpiTurnout = document.getElementById("kpiTurnout");
const kpiOOS = document.getElementById("kpiOOS");
const kpiUHU = document.getElementById("kpiUHU");
const kpiReports = document.getElementById("kpiReports");

const oosView = document.getElementById("oosView");
const oosEmptyState = document.getElementById("oosEmptyState");
const stemiTableBody = document.getElementById("stemiTableBody");
const reportsTableBody = document.getElementById("reportsTableBody");

const DEBUG = true;

function debugLog(...args) {
  if (DEBUG) {
    console.log(...args);
  }
}

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatDateTimeNow() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function normalizeValue(value) {
  return String(value ?? "").trim().toLowerCase();
}

function parseShiftFromValue(value) {
  if (value === "All") return "All";
  return String(value ?? "").trim().charAt(0).toUpperCase();
}

function getSelectedFilters() {
  return {
    shift: parseShiftFromValue(shiftFilter.value),
    battalion: battalionFilter.value
  };
}

function getRecordBattalion(record) {
  return (
    record.battalion ??
    record.battalion_name ??
    record.station_group ??
    record.battalionname ??
    record.Battalion ??
    record.battalionNumber ??
    ""
  );
}

function getRecordShift(record) {
  return (
    record.shift ??
    record.active_shift ??
    record.assigned_shift ??
    record.Shift ??
    record.current_shift ??
    ""
  );
}

function recordMatchesBattalion(record, selectedBattalion) {
  if (selectedBattalion === "All") return true;

  const selected = normalizeValue(selectedBattalion);
  const recordBattalion = normalizeValue(getRecordBattalion(record));

  return recordBattalion === selected;
}

function recordMatchesShift(record, selectedShift) {
  if (selectedShift === "All") return true;

  const rawShift = getRecordShift(record);
  const recordShift = String(rawShift ?? "").trim().charAt(0).toUpperCase();

  if (!recordShift) {
    return false;
  }

  return recordShift === selectedShift;
}

function filterDataset(data, datasetName = "unknown") {
  const { shift, battalion } = getSelectedFilters();
  const isSystemWideDataset = datasetName === "oos";

  const filtered = data.filter((record) => {
    const battalionMatch = isSystemWideDataset
      ? true
      : recordMatchesBattalion(record, battalion);
    const shiftMatch = isSystemWideDataset
      ? true
      : recordMatchesShift(record, shift);
    return battalionMatch && shiftMatch;
  });

  debugLog(`[FILTER] ${datasetName}`, {
    selectedShift: shift,
    selectedBattalion: battalion,
    before: data.length,
    after: filtered.length
  });

  if (DEBUG && data.length > 0) {
    debugLog(`[FILTER SAMPLE] ${datasetName} first row`, data[0]);
    debugLog(`[FILTER SAMPLE] ${datasetName} extracted values`, {
      battalion: getRecordBattalion(data[0]),
      shift: getRecordShift(data[0])
    });
  }

  return filtered;
}

function sortTurnoutData(data) {
  const sortBy = turnoutSort.value;
  const sorted = [...data];

  if (sortBy === "missed") {
    sorted.sort((a, b) => safeNumber(b.missed_calls) - safeNumber(a.missed_calls));
  } else if (sortBy === "unit") {
    sorted.sort((a, b) => String(a.label ?? a.unit ?? "").localeCompare(String(b.label ?? b.unit ?? "")));
  } else {
    sorted.sort((a, b) => safeNumber(a.compliance_rate) - safeNumber(b.compliance_rate));
  }

  return sorted;
}

function prepareTurnoutChartData(filteredTurnout) {
  const { battalion } = getSelectedFilters();

  if (battalion !== "All") {
    return filteredTurnout.map((row) => ({
      ...row,
      label: row.unit ?? "Unknown"
    }));
  }

  const battalionGroups = new Map();

  filteredTurnout.forEach((row) => {
    const battalionName = getRecordBattalion(row) || "Unknown";
    const existing = battalionGroups.get(battalionName) ?? {
      label: battalionName,
      battalion: battalionName,
      total_calls: 0,
      met_calls: 0,
      missed_calls: 0,
      compliance_rate: 0
    };

    existing.total_calls += safeNumber(row.total_calls);
    existing.met_calls += safeNumber(row.met_calls);
    existing.missed_calls += safeNumber(row.missed_calls);
    existing.compliance_rate = existing.total_calls > 0
      ? existing.met_calls / existing.total_calls
      : 0;

    battalionGroups.set(battalionName, existing);
  });

  return Array.from(battalionGroups.values());
}

function sortUhuData(data) {
  const sortBy = uhuSort.value;
  const sorted = [...data];

  if (sortBy === "calls") {
    sorted.sort((a, b) => {
      const bVal = safeNumber(b.call_count_numeric ?? b.call_count);
      const aVal = safeNumber(a.call_count_numeric ?? a.call_count);
      return bVal - aVal;
    });
  } else if (sortBy === "unit") {
    sorted.sort((a, b) => String(a.unit ?? "").localeCompare(String(b.unit ?? "")));
  } else {
    sorted.sort((a, b) => {
      const bVal = safeNumber(b.uhu_numeric ?? b.uhu);
      const aVal = safeNumber(a.uhu_numeric ?? a.uhu);
      return bVal - aVal;
    });
  }

  return sorted;
}

function updateActiveFilterDisplay() {
  const selected = getSelectedFilters();
  activeShift.textContent = selected.shift;
  activeBattalion.textContent = selected.battalion;
}

function updateTurnoutSortLabel() {
  if (!turnoutSortUnitOption) {
    return;
  }

  turnoutSortUnitOption.textContent = battalionFilter.value === "All" ? "Battalion" : "Unit";
}

function updateKpis(filteredTurnout, filteredOos, filteredUhu, filteredOverdue) {
  const totalCalls = filteredTurnout.reduce((sum, row) => sum + safeNumber(row.total_calls), 0);
  const metCalls = filteredTurnout.reduce((sum, row) => sum + safeNumber(row.met_calls), 0);
  const turnoutRate = totalCalls > 0 ? metCalls / totalCalls : 0;

  const uhuValues = filteredUhu
    .map((row) => safeNumber(row.uhu_numeric ?? row.uhu))
    .filter((v) => Number.isFinite(v));

  const avgUhu = uhuValues.length > 0
    ? uhuValues.reduce((sum, v) => sum + v, 0) / uhuValues.length
    : 0;

  kpiTurnout.textContent = formatPercent(turnoutRate);
  kpiOOS.textContent = filteredOos.length;
  kpiUHU.textContent = avgUhu.toFixed(2);
  kpiReports.textContent = filteredOverdue.length;
}

function renderTurnoutChart(filteredTurnout) {
  const preparedTurnout = prepareTurnoutChartData(filteredTurnout);
  const sorted = sortTurnoutData(preparedTurnout);

  const labels = sorted.map((row) => row.label ?? row.unit ?? "Unknown");
  const met = sorted.map((row) => safeNumber(row.met_calls));
  const missed = sorted.map((row) => safeNumber(row.missed_calls));

  const data = {
    labels,
    datasets: [
      {
        label: "Met",
        data: met,
        backgroundColor: "#16a34a"
      },
      {
        label: "Missed",
        data: missed,
        backgroundColor: "#dc2626"
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: "y",
    scales: {
      x: {
        stacked: true,
        beginAtZero: true
      },
      y: {
        stacked: true
      }
    },
    plugins: {
      legend: {
        position: "top"
      },
      tooltip: {
        callbacks: {
          afterBody: (items) => {
            const idx = items[0].dataIndex;
            const row = sorted[idx];
            const rate = safeNumber(row.compliance_rate);
            return `Compliance: ${formatPercent(rate)}`;
          }
        }
      }
    }
  };

  const ctx = document.getElementById("turnoutChart");

  debugLog("[RENDER] turnout chart rows:", sorted.length);

  if (turnoutChart) {
    turnoutChart.data = data;
    turnoutChart.options = options;
    turnoutChart.update();
  } else {
    turnoutChart = new Chart(ctx, {
      type: "bar",
      data,
      options
    });
  }
}

function renderUhuChart(filteredUhu) {
  const sorted = sortUhuData(filteredUhu).slice(0, 12);

  const labels = sorted.map((row) => row.unit ?? "Unknown");
  const values = sorted.map((row) => safeNumber(row.uhu_numeric ?? row.uhu));

  const data = {
    labels,
    datasets: [
      {
        label: "UHU",
        data: values,
        backgroundColor: "#2563eb"
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true
      }
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          afterBody: (items) => {
            const idx = items[0].dataIndex;
            const row = sorted[idx];
            const calls = safeNumber(row.call_count_numeric ?? row.call_count);
            const station = row.station ?? "Unknown";
            return [`Station: ${station}`, `Call Count: ${calls}`];
          }
        }
      }
    }
  };

  const ctx = document.getElementById("uhuChart");

  debugLog("[RENDER] uhu chart rows:", sorted.length);

  if (uhuChart) {
    uhuChart.data = data;
    uhuChart.options = options;
    uhuChart.update();
  } else {
    uhuChart = new Chart(ctx, {
      type: "bar",
      data,
      options
    });
  }
}

function createCell(text) {
  const td = document.createElement("td");
  td.textContent = text ?? "";
  return td;
}

function getUnitTypeDetails(unitId) {
  const normalized = String(unitId ?? "").trim().toUpperCase();

  if (normalized.startsWith("HBV")) {
    return { key: "heavy-rescue", label: "Heavy Rescue", shortLabel: "HR" };
  }

  const prefix = normalized.slice(0, 2);
  const unitTypeMap = {
    MR: { key: "ambulance", label: "Ambulance", shortLabel: "AM" },
    MD: { key: "ambulance", label: "Ambulance", shortLabel: "AM" },
    BC: { key: "battalion-chief", label: "Battalion Chief", shortLabel: "BC" },
    EN: { key: "engine", label: "Engine", shortLabel: "EN" },
    LD: { key: "ladder", label: "Ladder", shortLabel: "LD" },
    TW: { key: "tower", label: "Tower", shortLabel: "TW" },
    SQ: { key: "squad", label: "Squad", shortLabel: "SQ" },
    PM: { key: "community-paramedic", label: "Community Paramedic", shortLabel: "CP" },
    BR: { key: "brush-truck", label: "Brush Truck", shortLabel: "BR" },
    TE: { key: "tender", label: "Tender", shortLabel: "TN" }
  };

  return unitTypeMap[prefix] ?? { key: "unknown", label: "Unknown Unit Type", shortLabel: "??" };
}

function getOosSeverity(elapsedHours) {
  if (elapsedHours >= 4) return "critical";
  if (elapsedHours >= 2) return "warning";
  return "normal";
}

function getSeverityRank(severity) {
  if (severity === "critical") return 2;
  if (severity === "warning") return 1;
  return 0;
}

function getUnitIconSvg(typeKey) {
  const icons = {
    ambulance: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="9" width="12" height="7" rx="2"></rect>
        <path d="M15 11h3l2 2v3h-5z"></path>
        <path d="M8 10.5v4"></path>
        <path d="M6 12.5h4"></path>
        <circle cx="8" cy="18" r="1.8"></circle>
        <circle cx="18" cy="18" r="1.8"></circle>
      </svg>
    `,
    "battalion-chief": `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3l7 3v5c0 4.2-2.3 7.7-7 10-4.7-2.3-7-5.8-7-10V6z"></path>
        <path d="M12 8l1.1 2.4 2.6.2-2 1.7.6 2.6-2.3-1.4-2.3 1.4.6-2.6-2-1.7 2.6-.2z"></path>
      </svg>
    `,
    engine: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="10" width="11" height="6" rx="1.5"></rect>
        <path d="M14 11h3l2 2v3h-5z"></path>
        <path d="M6 7h5"></path>
        <path d="M5 9h7"></path>
        <circle cx="8" cy="18" r="1.8"></circle>
        <circle cx="18" cy="18" r="1.8"></circle>
      </svg>
    `,
    ladder: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="12" width="10" height="4" rx="1.5"></rect>
        <path d="M10 8l7-3"></path>
        <path d="M11 9l7-3"></path>
        <path d="M13.2 6.6l1.3 2.9"></path>
        <path d="M15.4 5.7l1.3 2.9"></path>
        <circle cx="7" cy="18" r="1.8"></circle>
        <circle cx="16" cy="18" r="1.8"></circle>
      </svg>
    `,
    tower: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="12" width="10" height="4" rx="1.5"></rect>
        <path d="M10 8l6-2.5"></path>
        <path d="M11 9l6-2.5"></path>
        <rect x="16" y="4" width="4" height="3" rx="1"></rect>
        <circle cx="7" cy="18" r="1.8"></circle>
        <circle cx="16" cy="18" r="1.8"></circle>
      </svg>
    `,
    "heavy-rescue": `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="10" width="13" height="6" rx="1.5"></rect>
        <path d="M17 11h2l2 2v3h-4z"></path>
        <path d="M9 9l2-2 2 2"></path>
        <path d="M11 7v5"></path>
        <circle cx="8" cy="18" r="1.8"></circle>
        <circle cx="18" cy="18" r="1.8"></circle>
      </svg>
    `,
    squad: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="10" width="12" height="6" rx="1.5"></rect>
        <path d="M15 11h3l2 2v3h-5z"></path>
        <path d="M8 9l3 4-3 4"></path>
        <circle cx="8" cy="18" r="1.8"></circle>
        <circle cx="18" cy="18" r="1.8"></circle>
      </svg>
    `,
    "community-paramedic": `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="7" r="2.5"></circle>
        <path d="M7 20v-2.5c0-2.3 2.2-4.5 5-4.5s5 2.2 5 4.5V20"></path>
        <path d="M18 9.5h4"></path>
        <path d="M20 7.5v4"></path>
      </svg>
    `,
    "brush-truck": `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 14h12l2 2v1H4z"></path>
        <path d="M8 10l2 2"></path>
        <path d="M10 8l2 2"></path>
        <path d="M12 6l2 2"></path>
        <circle cx="8" cy="18" r="1.8"></circle>
        <circle cx="16" cy="18" r="1.8"></circle>
      </svg>
    `,
    tender: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="11" width="11" height="5" rx="1.5"></rect>
        <path d="M15 12h2.5l2 2v2H15z"></path>
        <path d="M8.5 8.5c1.2 0 2.2 1 2.2 2.2S9.7 13 8.5 13s-2.2-1-2.2-2.2"></path>
        <circle cx="8" cy="18" r="1.8"></circle>
        <circle cx="18" cy="18" r="1.8"></circle>
      </svg>
    `,
    unknown: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="8"></circle>
        <path d="M9.8 9.5a2.4 2.4 0 1 1 4.1 1.7c-.8.7-1.4 1.1-1.4 2.3"></path>
        <circle cx="12" cy="16.8" r="0.8"></circle>
      </svg>
    `
  };

  return icons[typeKey] ?? icons.unknown;
}

function groupOosRowsByUnitType(filteredOos) {
  const groups = new Map();

  filteredOos.forEach((row) => {
    const unitType = getUnitTypeDetails(row.unit);
    const severity = getOosSeverity(safeNumber(row.elapsed_hours));
    const normalizedRow = {
      ...row,
      unitType,
      severity
    };

    const group = groups.get(unitType.key) ?? {
      unitType,
      rows: []
    };

    group.rows.push(normalizedRow);
    groups.set(unitType.key, group);
  });

  return Array.from(groups.values())
    .map((group) => {
      const rows = group.rows.sort((a, b) => safeNumber(b.elapsed_seconds) - safeNumber(a.elapsed_seconds));
      const groupSeverity = rows.reduce((highest, row) => {
        const rank = getSeverityRank(row.severity);
        return rank > getSeverityRank(highest) ? row.severity : highest;
      }, "normal");

      return {
        ...group,
        rows,
        severity: groupSeverity
      };
    })
    .sort((a, b) => {
      const severityDiff = getSeverityRank(b.severity) - getSeverityRank(a.severity);
      if (severityDiff !== 0) return severityDiff;

      const countDiff = b.rows.length - a.rows.length;
      if (countDiff !== 0) return countDiff;

      return a.unitType.label.localeCompare(b.unitType.label);
    });
}

function updateOosDetailPane(detailPane, row) {
  detailPane.querySelector("[data-field='unit']").textContent = row.unit ?? "Unknown";
  detailPane.querySelector("[data-field='type']").textContent = row.unitType.label;
  detailPane.querySelector("[data-field='elapsed']").textContent = row.elapsed_h_m_s ?? "Unknown";
  detailPane.querySelector("[data-field='reason']").textContent = row.location ?? "Unknown";
  detailPane.querySelector("[data-field='location']").textContent = row.location ?? "Unknown";
  detailPane.querySelector("[data-field='since']").textContent = row.since ?? "Unknown";
}

function createOosUnitListItem(row, detailPane) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `oos-unit-pill severity-${row.severity}`;
  button.textContent = row.unit ?? "Unknown";

  const activate = () => {
    detailPane.parentElement.querySelectorAll(".oos-unit-pill.is-active").forEach((node) => {
      node.classList.remove("is-active");
    });
    button.classList.add("is-active");
    updateOosDetailPane(detailPane, row);
  };

  button.addEventListener("mouseenter", activate);
  button.addEventListener("focus", activate);
  button.addEventListener("click", activate);

  return { button, activate };
}

function createOosGroupCard(group) {
  const card = document.createElement("article");
  card.className = `oos-group-card severity-${group.severity}`;
  card.tabIndex = 0;

  const trigger = document.createElement("div");
  trigger.className = "oos-group-trigger";

  const iconWrap = document.createElement("div");
  iconWrap.className = "oos-group-icon";
  iconWrap.setAttribute("aria-hidden", "true");
  iconWrap.innerHTML = getUnitIconSvg(group.unitType.key);

  const countBadge = document.createElement("span");
  countBadge.className = "oos-group-count";
  countBadge.textContent = group.rows.length;
  iconWrap.appendChild(countBadge);

  const label = document.createElement("div");
  label.className = "oos-group-label";
  label.textContent = group.unitType.label;

  const sublabel = document.createElement("div");
  sublabel.className = "oos-group-sublabel";
  sublabel.textContent = `${group.rows.length} unit${group.rows.length === 1 ? "" : "s"} OOS`;

  trigger.appendChild(iconWrap);
  trigger.appendChild(label);
  trigger.appendChild(sublabel);

  const popover = document.createElement("div");
  popover.className = "oos-group-popover";

  const unitsColumn = document.createElement("div");
  unitsColumn.className = "oos-popover-column";

  const unitsTitle = document.createElement("div");
  unitsTitle.className = "oos-popover-title";
  unitsTitle.textContent = "Units";

  const unitList = document.createElement("div");
  unitList.className = "oos-unit-list";

  const detailColumn = document.createElement("div");
  detailColumn.className = "oos-popover-column oos-detail-pane";
  detailColumn.innerHTML = `
    <div class="oos-popover-title">Details</div>
    <div class="oos-detail-unit" data-field="unit"></div>
    <div class="oos-detail-type" data-field="type"></div>
    <dl class="oos-detail-list">
      <div><dt>Elapsed</dt><dd data-field="elapsed"></dd></div>
      <div><dt>Reason / Location</dt><dd data-field="reason"></dd></div>
      <div><dt>Since</dt><dd data-field="since"></dd></div>
    </dl>
    <div class="oos-detail-note">
      Location detail: <span data-field="location"></span>
    </div>
  `;

  const listItems = group.rows.map((row) => createOosUnitListItem(row, detailColumn));
  listItems.forEach(({ button }) => unitList.appendChild(button));

  unitsColumn.appendChild(unitsTitle);
  unitsColumn.appendChild(unitList);
  popover.appendChild(unitsColumn);
  popover.appendChild(detailColumn);

  card.appendChild(trigger);
  card.appendChild(popover);

  if (listItems.length > 0) {
    listItems[0].activate();
  }

  return card;
}

function renderOosView(filteredOos) {
  oosView.innerHTML = "";

  const groups = groupOosRowsByUnitType(filteredOos);
  debugLog("[RENDER] oos groups:", groups.length);

  const hasRows = groups.length > 0;
  oosView.hidden = !hasRows;
  oosEmptyState.hidden = hasRows;

  groups.forEach((group) => {
    oosView.appendChild(createOosGroupCard(group));
  });
}

function renderStemiTable(filteredStemi) {
  stemiTableBody.innerHTML = "";

  const rows = [...filteredStemi].slice(0, 12);

  debugLog("[RENDER] stemi rows:", rows.length);

  rows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.appendChild(createCell(row.incident_id ?? row.incident_number ?? ""));
    tr.appendChild(createCell(row.patient_name ?? ""));
    tr.appendChild(createCell(row.patient_dob ?? ""));
    tr.appendChild(createCell(row.destination ?? ""));
    tr.appendChild(
      createCell(
        row.minutes_unit_dispatch_to_destination_numeric ??
        row.minutes_unit_dispatch_to_destination ??
        ""
      )
    );
    stemiTableBody.appendChild(tr);
  });
}

function renderReportsTable(filteredOverdue) {
  reportsTableBody.innerHTML = "";

  const rows = [...filteredOverdue].sort((a, b) => {
    const aDate = a.incident_date_parsed ? new Date(a.incident_date_parsed).getTime() : 0;
    const bDate = b.incident_date_parsed ? new Date(b.incident_date_parsed).getTime() : 0;
    return aDate - bDate;
  });

  const visibleRows = rows.slice(0, 20);

  debugLog("[RENDER] overdue rows:", visibleRows.length);

  visibleRows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.appendChild(createCell(row.incident ?? row.incident_id ?? ""));
    tr.appendChild(createCell(row.incident_date ?? ""));
    tr.appendChild(createCell(row.vehicle_id ?? row.unit ?? ""));
    tr.appendChild(createCell(row.epcr_status ?? ""));
    tr.appendChild(createCell(row.crew_member_completing ?? ""));
    reportsTableBody.appendChild(tr);
  });
}

function applyFiltersAndRender() {
  const selected = getSelectedFilters();
  debugLog("====================================");
  debugLog("[APPLY FILTERS] selected:", selected);

  updateTurnoutSortLabel();
  updateActiveFilterDisplay();

  const filteredTurnout = filterDataset(turnoutData, "turnout");
  const filteredUhu = filterDataset(uhuData, "uhu");
  const filteredOos = filterDataset(oosData, "oos");
  const filteredStemi = filterDataset(stemiData, "stemi");
  const filteredOverdue = filterDataset(overdueData, "overdue");

  debugLog("[COUNTS AFTER FILTER]", {
    turnout: filteredTurnout.length,
    uhu: filteredUhu.length,
    oos: filteredOos.length,
    stemi: filteredStemi.length,
    overdue: filteredOverdue.length
  });

  updateKpis(filteredTurnout, filteredOos, filteredUhu, filteredOverdue);
  renderTurnoutChart(filteredTurnout);
  renderUhuChart(filteredUhu);
  renderOosView(filteredOos);
  renderStemiTable(filteredStemi);
  renderReportsTable(filteredOverdue);
}

async function loadJson(path) {
  debugLog("[LOAD] fetching:", path);

  const response = await fetch(path);

  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.status}`);
  }

  const json = await response.json();
  debugLog("[LOAD] success:", path, "rows:", Array.isArray(json) ? json.length : "not array");

  return json;
}

function logDatasetInfo(name, data) {
  debugLog(`========== DATASET: ${name} ==========`);
  debugLog(`[${name}] row count:`, data.length);

  if (data.length > 0) {
    debugLog(`[${name}] sample row:`, data[0]);
    debugLog(`[${name}] keys:`, Object.keys(data[0]));
    debugLog(`[${name}] sample extracted battalion:`, getRecordBattalion(data[0]));
    debugLog(`[${name}] sample extracted shift:`, getRecordShift(data[0]));
  } else {
    debugLog(`[${name}] dataset is empty`);
  }
}

async function initializeDashboard() {
  try {
    const [
      turnoutSummary,
      uhuSummary,
      oosSummary,
      stemiClean,
      overdueClean
    ] = await Promise.all([
      loadJson("data/processed/turnout_summary.json"),
      loadJson("data/processed/uhu_summary.json"),
      loadJson("data/processed/oos_summary.json"),
      loadJson("data/processed/stemi_clean.json"),
      loadJson("data/processed/overdue_reports_clean.json")
    ]);

    turnoutData = turnoutSummary;
    uhuData = uhuSummary;
    oosData = oosSummary;
    stemiData = stemiClean;
    overdueData = overdueClean;

    logDatasetInfo("turnout", turnoutData);
    logDatasetInfo("uhu", uhuData);
    logDatasetInfo("oos", oosData);
    logDatasetInfo("stemi", stemiData);
    logDatasetInfo("overdue", overdueData);

    lastUpdated.textContent = formatDateTimeNow();
    applyFiltersAndRender();
  } catch (error) {
    console.error(error);
    alert("There was a problem loading the dashboard data. Check file paths and JSON outputs.");
  }
}

shiftFilter.addEventListener("change", () => {
  debugLog("[EVENT] shift changed to:", shiftFilter.value);
  applyFiltersAndRender();
});

battalionFilter.addEventListener("change", () => {
  debugLog("[EVENT] battalion changed to:", battalionFilter.value);
  applyFiltersAndRender();
});

turnoutSort.addEventListener("change", () => {
  debugLog("[EVENT] turnout sort changed to:", turnoutSort.value);
  applyFiltersAndRender();
});

uhuSort.addEventListener("change", () => {
  debugLog("[EVENT] uhu sort changed to:", uhuSort.value);
  applyFiltersAndRender();
});

resetFilters.addEventListener("click", () => {
  debugLog("[EVENT] reset clicked");

  shiftFilter.value = "All";
  battalionFilter.value = "All";
  turnoutSort.value = "compliance";
  uhuSort.value = "uhu";

  applyFiltersAndRender();
});

initializeDashboard();
>>>>>>> dc4edd8 (- Refine dashboard layout and add icon-based OOS view)
