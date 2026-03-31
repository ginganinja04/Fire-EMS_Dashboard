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
