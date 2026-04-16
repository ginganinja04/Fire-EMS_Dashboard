# Fire-EMS Dashboard

An operational dashboard prototype for Battalion Chief situational awareness. The project combines processed fire and EMS sample data into a browser-based overview of turnout compliance, out-of-service units, ambulance workload, STEMI timing, and overdue reporting activity.

## Overview

This repository supports an Information Visualization project focused on short-term operational monitoring rather than retrospective reporting. The dashboard is built as a static web app and is organized around the monitoring tasks described in the project proposal.

The current dashboard includes:

- KPI summary cards
- Turnout compliance chart with battalion filtering
- Out-of-service unit view grouped by unit type with iconography
- Ambulance UHU / workload chart
- STEMI case table
- Overdue incident report table

## Tech Stack

- Frontend: HTML, CSS, JavaScript
- Charts: Chart.js
- Data processing: Python, pandas
- Hosting target: GitHub Pages via `docs/`

## Repository Structure

```text
Fire-EMS_Dashboard/
├── README.md
├── LICENSE
├── notes/
│   ├── InfoVis_Proposal (6).pdf
│   └── call_sign_breakdown.txt
├── scripts/
│   ├── inspect_data.py
│   └── preprocess_data.py
└── docs/
    ├── index.html
    ├── css/
    │   └── style.css
    ├── js/
    │   └── main.js
    ├── notes.md
    └── data/
        └── processed/
            ├── ambulance_uhu_clean.json
            ├── oos_summary.json
            ├── oos_units_clean.json
            ├── overdue_reports_clean.json
            ├── overdue_summary.json
            ├── stemi_clean.json
            ├── stemi_summary.json
            ├── turnout_summary.json
            ├── turnout_time_compliance_clean.json
            └── uhu_summary.json
```

## Key Directories

- `docs/`: static site files used by the dashboard and GitHub Pages
- `docs/data/processed/`: JSON data consumed directly by the browser app
- `scripts/`: Python utilities for inspecting and transforming source data
- `notes/`: proposal material and local reference notes

## Running the Dashboard

Open [docs/index.html](/home/maria/info_vis/Fire-EMS_Dashboard/docs/index.html) in a local server environment so the JSON files can be fetched correctly by the browser.

If you are using a simple Python server from the repo root:

```bash
python3 -m http.server
```

Then open:

```text
http://localhost:8000/docs/
```

## Data Notes

- The dashboard reads from `docs/data/processed/*.json`.
- The `data/processed/` directory contains the source processed outputs used to populate the `docs/` copy.
- Out-of-service data is currently treated as system-wide because the available OOS dataset does not yet include battalion metadata.
- Unit-type iconography in the OOS panel is based on the call sign definitions in `notes/call_sign_breakdown.txt`.

## Current Status

This is an actively evolving prototype. The layout and interaction design are being refined as the project develops and as additional operational context becomes available.
