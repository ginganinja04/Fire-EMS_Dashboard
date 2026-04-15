let turnoutData = [];
let uhuData = [];
let oosData = [];
let stemiData = [];
let overdueData = [];
let unitCallSignData = [];
let activeOosSeverityFilter = null;
let currentFilteredOos = [];

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
const oosLegendButtons = Array.from(document.querySelectorAll("[data-oos-severity]"));
const stemiTableBody = document.getElementById("stemiTableBody");
const reportsView = document.getElementById("reportsView");
const reportsEmptyState = document.getElementById("reportsEmptyState");

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

function formatMinutesAsDuration(value) {
  const minutes = Number(value);

  if (!Number.isFinite(minutes)) {
    return "";
  }

  const totalSeconds = Math.round(minutes * 60);
  const wholeMinutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${wholeMinutes}m ${String(seconds).padStart(2, "0")}s`;
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
    record.BattalionName ??
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

  const filtered = data.filter((record) => {
    const battalionMatch = recordMatchesBattalion(record, battalion);
    const shiftMatch = datasetName === "oos"
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

function buildUnitCallSignLookup(rows) {
  return rows.reduce((lookup, row) => {
    const unit = String(row.UnitCallSign ?? "").trim().toUpperCase();

    if (unit) {
      lookup.set(unit, row);
    }

    return lookup;
  }, new Map());
}

function enrichOosDataWithBattalion(rows, lookup) {
  return rows.map((row) => {
    const unit = String(row.unit ?? "").trim().toUpperCase();
    const match = lookup.get(unit);

    if (!match) {
      return row;
    }

    return {
      ...row,
      unit,
      battalion: match.BattalionName ?? row.battalion ?? "",
      report_name: match.ReportName ?? row.report_name ?? "",
      report_type: match.ReportTypeDesc ?? row.report_type ?? "",
      primary_program: match.PrimaryProgram ?? row.primary_program ?? "",
      service_level: match.ServiceLevel ?? row.service_level ?? ""
    };
  });
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

function getPersonReportIconSvg() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="8" cy="6.5" r="2.5"></circle>
      <path d="M4.5 18v-2.2c0-2.5 1.8-4.8 4.6-4.8 1.1 0 2.1.3 2.9.9"></path>
      <path d="M13 4.5h5.5l2 2V19a1 1 0 0 1-1 1H13a1 1 0 0 1-1-1v-13.5a1 1 0 0 1 1-1z"></path>
      <path d="M18.5 4.5V7h2"></path>
      <path d="M14.7 11h3.8"></path>
      <path d="M14.7 14h3.8"></path>
      <path d="M14.7 17h2.6"></path>
    </svg>
  `;
}

function getCrewMemberName(row) {
  const rawName = row.crew_member_completing ?? row.crew_member ?? row.assigned_to ?? "Unassigned";
  const normalizedName = String(rawName ?? "").trim();

  if (!normalizedName || normalizedName === "Unassigned") {
    return "Unassigned";
  }

  if (!normalizedName.includes(",")) {
    return normalizedName;
  }

  const [lastName, firstName] = normalizedName.split(",").map((part) => part.trim()).filter(Boolean);

  return [firstName, lastName].filter(Boolean).join(" ");
}

function getStationName(row) {
  return row.station ?? row.station_name ?? row.location ?? "Unknown Station";
}

function groupOverdueRowsByPerson(filteredOverdue) {
  const groups = new Map();

  filteredOverdue.forEach((row) => {
    const person = getCrewMemberName(row);
    const group = groups.get(person) ?? {
      person,
      rows: []
    };

    group.rows.push(row);
    groups.set(person, group);
  });

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      rows: group.rows.sort((a, b) => {
        const aDate = a.incident_date_parsed ? new Date(a.incident_date_parsed).getTime() : 0;
        const bDate = b.incident_date_parsed ? new Date(b.incident_date_parsed).getTime() : 0;
        return aDate - bDate;
      })
    }))
    .sort((a, b) => {
      const countDiff = b.rows.length - a.rows.length;
      if (countDiff !== 0) return countDiff;
      return a.person.localeCompare(b.person);
    });
}

function groupOverdueRowsByBattalion(filteredOverdue) {
  const battalionGroups = new Map();

  filteredOverdue.forEach((row) => {
    const battalion = getRecordBattalion(row) || "Unknown Battalion";
    const station = getStationName(row);
    const person = getCrewMemberName(row);

    const battalionGroup = battalionGroups.get(battalion) ?? {
      battalion,
      rows: [],
      stations: new Map()
    };

    battalionGroup.rows.push(row);

    const stationGroup = battalionGroup.stations.get(station) ?? {
      station,
      rows: [],
      people: new Map()
    };

    stationGroup.rows.push(row);

    const personGroup = stationGroup.people.get(person) ?? {
      person,
      rows: []
    };

    personGroup.rows.push(row);
    stationGroup.people.set(person, personGroup);
    battalionGroup.stations.set(station, stationGroup);
    battalionGroups.set(battalion, battalionGroup);
  });

  return Array.from(battalionGroups.values())
    .map((battalionGroup) => ({
      battalion: battalionGroup.battalion,
      rows: battalionGroup.rows,
      stations: Array.from(battalionGroup.stations.values())
        .map((stationGroup) => ({
          station: stationGroup.station,
          rows: stationGroup.rows.sort((a, b) => {
            const aDate = a.incident_date_parsed ? new Date(a.incident_date_parsed).getTime() : 0;
            const bDate = b.incident_date_parsed ? new Date(b.incident_date_parsed).getTime() : 0;
            return aDate - bDate;
          }),
          people: Array.from(stationGroup.people.values())
            .map((personGroup) => ({
              person: personGroup.person,
              rows: personGroup.rows.sort((a, b) => {
                const aDate = a.incident_date_parsed ? new Date(a.incident_date_parsed).getTime() : 0;
                const bDate = b.incident_date_parsed ? new Date(b.incident_date_parsed).getTime() : 0;
                return aDate - bDate;
              })
            }))
            .sort((a, b) => {
              const countDiff = b.rows.length - a.rows.length;
              if (countDiff !== 0) return countDiff;
              return a.person.localeCompare(b.person);
            })
        }))
        .sort((a, b) => {
          const countDiff = b.rows.length - a.rows.length;
          if (countDiff !== 0) return countDiff;
          return a.station.localeCompare(b.station);
        })
    }))
    .sort((a, b) => {
      const countDiff = b.rows.length - a.rows.length;
      if (countDiff !== 0) return countDiff;
      return a.battalion.localeCompare(b.battalion);
    });
}

function updateReportDetailPane(detailPane, row) {
  detailPane.querySelector("[data-field='incident']").textContent = row.incident ?? row.incident_id ?? "Unknown";
  detailPane.querySelector("[data-field='date']").textContent = row.incident_date ?? "Unknown";
  detailPane.querySelector("[data-field='unit']").textContent = row.vehicle_id ?? row.unit ?? "Unknown";
  detailPane.querySelector("[data-field='status']").textContent = row.epcr_status ?? "Unknown";
  detailPane.querySelector("[data-field='station']").textContent = row.station ?? "Unknown";
  detailPane.querySelector("[data-field='shift']").textContent = row.shift ?? "Unknown";
}

function createReportIncidentListItem(row, detailPane) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "report-incident-pill";
  button.textContent = row.incident ?? row.incident_id ?? "Unknown";

  const activate = () => {
    detailPane.parentElement.querySelectorAll(".report-incident-pill.is-active").forEach((node) => {
      node.classList.remove("is-active");
    });
    button.classList.add("is-active");
    updateReportDetailPane(detailPane, row);
  };

  button.addEventListener("mouseenter", activate);
  button.addEventListener("focus", activate);
  button.addEventListener("click", activate);

  return { button, activate };
}

function createReportGroupCard(group) {
  const card = document.createElement("article");
  card.className = "report-group-card";
  card.tabIndex = 0;

  const trigger = document.createElement("div");
  trigger.className = "report-group-trigger";

  const iconWrap = document.createElement("div");
  iconWrap.className = "report-group-icon";
  iconWrap.setAttribute("aria-hidden", "true");
  iconWrap.innerHTML = getPersonReportIconSvg();

  const countBadge = document.createElement("span");
  countBadge.className = "report-group-count";
  countBadge.textContent = group.rows.length;
  iconWrap.appendChild(countBadge);

  const label = document.createElement("div");
  label.className = "report-group-label";
  label.textContent = group.person;

  const sublabel = document.createElement("div");
  sublabel.className = "report-group-sublabel";
  sublabel.textContent = `${group.rows.length} overdue report${group.rows.length === 1 ? "" : "s"}`;

  trigger.appendChild(iconWrap);
  trigger.appendChild(label);
  trigger.appendChild(sublabel);

  const popover = document.createElement("div");
  popover.className = "report-group-popover";

  const incidentsColumn = document.createElement("div");
  incidentsColumn.className = "report-popover-column";

  const incidentsTitle = document.createElement("div");
  incidentsTitle.className = "report-popover-title";
  incidentsTitle.textContent = "Incidents";

  const incidentList = document.createElement("div");
  incidentList.className = "report-incident-list";

  const detailColumn = document.createElement("div");
  detailColumn.className = "report-popover-column report-detail-pane";
  detailColumn.innerHTML = `
    <div class="report-detail-incident" data-field="incident"></div>
    <dl class="report-detail-list">
      <div><dt>Date</dt><dd data-field="date"></dd></div>
      <div><dt>Unit</dt><dd data-field="unit"></dd></div>
      <div><dt>Status</dt><dd data-field="status"></dd></div>
      <div><dt>Station</dt><dd data-field="station"></dd></div>
      <div><dt>Shift</dt><dd data-field="shift"></dd></div>
    </dl>
  `;

  const listItems = group.rows.map((row) => createReportIncidentListItem(row, detailColumn));
  listItems.forEach(({ button }) => incidentList.appendChild(button));

  incidentsColumn.appendChild(incidentsTitle);
  incidentsColumn.appendChild(incidentList);
  popover.appendChild(incidentsColumn);
  popover.appendChild(detailColumn);

  card.appendChild(trigger);
  card.appendChild(popover);

  if (listItems.length > 0) {
    listItems[0].activate();
  }

  return card;
}

function updateBattalionReportIncidentDetail(detailPane, row) {
  detailPane.querySelector("[data-field='person']").textContent = getCrewMemberName(row);
  detailPane.querySelector("[data-field='incident']").textContent = row.incident ?? row.incident_id ?? "Unknown";
  detailPane.querySelector("[data-field='date']").textContent = row.incident_date ?? "Unknown";
  detailPane.querySelector("[data-field='unit']").textContent = row.vehicle_id ?? row.unit ?? "Unknown";
  detailPane.querySelector("[data-field='status']").textContent = row.epcr_status ?? "Unknown";
  detailPane.querySelector("[data-field='shift']").textContent = row.shift ?? "Unknown";
}

function createBattalionReportGroupCard(group) {
  const card = document.createElement("article");
  card.className = "report-group-card";
  card.tabIndex = 0;

  const trigger = document.createElement("div");
  trigger.className = "report-group-trigger";

  const iconWrap = document.createElement("div");
  iconWrap.className = "report-group-icon";
  iconWrap.setAttribute("aria-hidden", "true");
  iconWrap.innerHTML = getPersonReportIconSvg();

  const countBadge = document.createElement("span");
  countBadge.className = "report-group-count";
  countBadge.textContent = group.rows.length;
  iconWrap.appendChild(countBadge);

  const label = document.createElement("div");
  label.className = "report-group-label";
  label.textContent = group.battalion;

  const sublabel = document.createElement("div");
  sublabel.className = "report-group-sublabel";
  sublabel.textContent = `${group.stations.length} station${group.stations.length === 1 ? "" : "s"} with overdue reports`;

  trigger.appendChild(iconWrap);
  trigger.appendChild(label);
  trigger.appendChild(sublabel);

  const popover = document.createElement("div");
  popover.className = "report-group-popover report-group-popover-wide";

  const stationsColumn = document.createElement("div");
  stationsColumn.className = "report-popover-column";

  const stationsTitle = document.createElement("div");
  stationsTitle.className = "report-popover-title";
  stationsTitle.textContent = "Stations";

  const stationList = document.createElement("div");
  stationList.className = "report-station-list";

  const detailColumn = document.createElement("div");
  detailColumn.className = "report-popover-column report-detail-pane report-battalion-detail-pane";
  detailColumn.innerHTML = `
    <div class="report-detail-header">
      <div class="report-detail-station" data-field="station"></div>
      <div class="report-detail-station-meta" data-field="stationMeta"></div>
    </div>
    <div class="report-battalion-breakdown">
      <div class="report-battalion-people-pane">
        <div class="report-popover-title">People</div>
        <div class="report-person-list" data-field="personList"></div>
      </div>
      <div class="report-incident-detail-card" data-field="incidentDetailCard" hidden>
        <div class="report-detail-person" data-field="person"></div>
        <div class="report-person-meta" data-field="personMeta"></div>
        <div class="report-incident-detail-layout">
          <div class="report-incident-picker-pane" data-field="incidentPickerPane">
            <div class="report-popover-title report-incidents-title" data-field="incidentsTitle">Incidents</div>
            <div class="report-incident-list" data-field="incidentList"></div>
          </div>
          <div class="report-incident-breakdown-pane">
            <div class="report-detail-incident" data-field="incident"></div>
            <dl class="report-detail-list">
              <div><dt>Date</dt><dd data-field="date"></dd></div>
              <div><dt>Unit</dt><dd data-field="unit"></dd></div>
              <div><dt>Status</dt><dd data-field="status"></dd></div>
              <div><dt>Shift</dt><dd data-field="shift"></dd></div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  `;

  const personList = detailColumn.querySelector("[data-field='personList']");
  const incidentList = detailColumn.querySelector("[data-field='incidentList']");
  const incidentsTitle = detailColumn.querySelector("[data-field='incidentsTitle']");
  const incidentPickerPane = detailColumn.querySelector("[data-field='incidentPickerPane']");
  const personMeta = detailColumn.querySelector("[data-field='personMeta']");
  const stationMeta = detailColumn.querySelector("[data-field='stationMeta']");
  const incidentDetailCard = detailColumn.querySelector("[data-field='incidentDetailCard']");

  const activatePerson = (personGroup, personButton) => {
    personList.querySelectorAll(".report-person-pill.is-active").forEach((node) => {
      node.classList.remove("is-active");
    });
    personButton.classList.add("is-active");

    detailColumn.querySelector("[data-field='person']").textContent = personGroup.person;
    personMeta.textContent = `${personGroup.rows.length} overdue incident${personGroup.rows.length === 1 ? "" : "s"}`;

    incidentList.innerHTML = "";
    incidentDetailCard.hidden = false;
    updateBattalionReportIncidentDetail(detailColumn, {});

    const hasMultipleIncidents = personGroup.rows.length > 1;
    incidentsTitle.hidden = !hasMultipleIncidents;
    incidentList.hidden = !hasMultipleIncidents;
    incidentPickerPane.hidden = !hasMultipleIncidents;

    const incidentButtons = hasMultipleIncidents ? personGroup.rows.map((row) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "report-incident-pill report-incident-pill-station";
      button.textContent = row.incident ?? row.incident_id ?? "Unknown";

      const activate = () => {
        incidentList.querySelectorAll(".report-incident-pill.is-active").forEach((node) => {
          node.classList.remove("is-active");
        });
        button.classList.add("is-active");
        updateBattalionReportIncidentDetail(detailColumn, row);
      };

      button.addEventListener("focus", activate);
      button.addEventListener("click", activate);

      return { button, activate };
    }) : [];

    incidentButtons.forEach(({ button }) => incidentList.appendChild(button));

    if (hasMultipleIncidents && incidentButtons.length > 0) {
      incidentButtons[0].activate();
    } else if (personGroup.rows.length > 0) {
      updateBattalionReportIncidentDetail(detailColumn, personGroup.rows[0]);
    }
  };

  const activateStation = (stationGroup, stationButton) => {
    stationList.querySelectorAll(".report-station-pill.is-active").forEach((node) => {
      node.classList.remove("is-active");
    });
    stationButton.classList.add("is-active");

    detailColumn.querySelector("[data-field='station']").textContent = stationGroup.station;
    stationMeta.textContent = `${stationGroup.rows.length} overdue report${stationGroup.rows.length === 1 ? "" : "s"} across ${stationGroup.people.length} person${stationGroup.people.length === 1 ? "" : "s"}`;

    personList.innerHTML = "";
    incidentList.innerHTML = "";
    incidentList.hidden = false;
    incidentsTitle.hidden = false;
    incidentDetailCard.hidden = true;
    detailColumn.querySelector("[data-field='person']").textContent = "";
    personMeta.textContent = "";
    updateBattalionReportIncidentDetail(detailColumn, {});

    const personButtons = stationGroup.people.map((personGroup) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "report-person-pill";
      button.innerHTML = `
        <span class="report-person-pill-name">${personGroup.person}</span>
        <span class="report-person-pill-count">${personGroup.rows.length}</span>
      `;

      const activate = () => {
        activatePerson(personGroup, button);
      };

      button.addEventListener("focus", activate);
      button.addEventListener("click", activate);

      return { button, activate };
    });

    personButtons.forEach(({ button }) => personList.appendChild(button));
  };

  const stationButtons = group.stations.map((stationGroup) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "report-station-pill";
    button.innerHTML = `
      <span class="report-station-pill-name">${stationGroup.station}</span>
      <span class="report-station-pill-count">${stationGroup.rows.length}</span>
    `;

    const activate = () => activateStation(stationGroup, button);
    button.addEventListener("mouseenter", activate);
    button.addEventListener("focus", activate);
    button.addEventListener("click", activate);

    return { button, activate };
  });

  stationButtons.forEach(({ button }) => stationList.appendChild(button));

  stationsColumn.appendChild(stationsTitle);
  stationsColumn.appendChild(stationList);
  popover.appendChild(stationsColumn);
  popover.appendChild(detailColumn);

  card.appendChild(trigger);
  card.appendChild(popover);

  if (stationButtons.length > 0) {
    stationButtons[0].activate();
  }

  return card;
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

function setActiveOosSeverityFilter(severity) {
  activeOosSeverityFilter = activeOosSeverityFilter === severity ? null : severity;
  updateOosLegendState();
  renderOosView(currentFilteredOos);
}

function updateOosLegendState() {
  oosLegendButtons.forEach((button) => {
    const isActive = button.dataset.oosSeverity === activeOosSeverityFilter;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function renderOosView(filteredOos) {
  oosView.innerHTML = "";

  const visibleRows = activeOosSeverityFilter
    ? filteredOos.filter((row) => getOosSeverity(safeNumber(row.elapsed_hours)) === activeOosSeverityFilter)
    : filteredOos;

  const groups = groupOosRowsByUnitType(visibleRows);
  debugLog("[RENDER] oos groups:", groups.length);

  const hasRows = groups.length > 0;
  oosView.hidden = !hasRows;
  oosEmptyState.hidden = hasRows;
  oosEmptyState.textContent = activeOosSeverityFilter
    ? "No out of service units match the selected time filter in the current view."
    : "No out of service units in the current view.";

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
      createCell(formatMinutesAsDuration(
        row.of_minutes_from_unit_dispatch_to_arrival_at_destination_numeric ??
        row.of_minutes_from_unit_dispatch_to_arrival_at_destination ??
        ""
      ))
    );
    stemiTableBody.appendChild(tr);
  });
}

function renderReportsView(filteredOverdue) {
  reportsView.innerHTML = "";

  const { battalion } = getSelectedFilters();
  const groups = battalion === "All"
    ? groupOverdueRowsByBattalion(filteredOverdue)
    : groupOverdueRowsByPerson(filteredOverdue);

  debugLog("[RENDER] overdue groups:", groups.length);

  const hasRows = groups.length > 0;
  reportsView.hidden = !hasRows;
  reportsEmptyState.hidden = hasRows;

  groups.forEach((group) => {
    reportsView.appendChild(
      battalion === "All"
        ? createBattalionReportGroupCard(group)
        : createReportGroupCard(group)
    );
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
  currentFilteredOos = filteredOos;

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
  renderReportsView(filteredOverdue);
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
      unitCallSigns,
      stemiClean,
      overdueClean
    ] = await Promise.all([
      loadJson("data/processed/turnout_summary.json"),
      loadJson("data/processed/uhu_summary.json"),
      loadJson("data/processed/oos_summary.json"),
      loadJson("data/processed/PCFR_Unit_Call_Signs.json"),
      loadJson("data/processed/stemi_clean.json"),
      loadJson("data/processed/overdue_reports_clean.json")
    ]);

    const unitCallSignLookup = buildUnitCallSignLookup(unitCallSigns);

    turnoutData = turnoutSummary;
    uhuData = uhuSummary;
    oosData = enrichOosDataWithBattalion(oosSummary, unitCallSignLookup);
    stemiData = stemiClean;
    overdueData = overdueClean;
    unitCallSignData = unitCallSigns;

    logDatasetInfo("turnout", turnoutData);
    logDatasetInfo("uhu", uhuData);
    logDatasetInfo("oos", oosData);
    logDatasetInfo("unit-call-signs", unitCallSignData);
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
  activeOosSeverityFilter = null;
  updateOosLegendState();

  applyFiltersAndRender();
});

oosLegendButtons.forEach((button) => {
  button.addEventListener("click", () => {
    debugLog("[EVENT] oos severity filter changed to:", button.dataset.oosSeverity);
    setActiveOosSeverityFilter(button.dataset.oosSeverity);
  });
});

initializeDashboard();
