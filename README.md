# Battalion Chief Dashboard

An interactive operational dashboard for visualizing fire-rescue incident activity, unit workload, turnout compliance, and other battalion-level metrics using sample CAD data.

## Project Overview

This project is being developed as a part of my Information Visualization class. The goal is to design and implement a dashboard that supports Battalion Chief situational awareness by presenting key operational metrics in a clear, interactive, and accessible format.

The dashboard is intended to help users explore patterns in incident activity, monitor turnout performance, compare workload across units, and identify operational trends over time and across locations.

## Planned Features

- Turnout time compliance by unit
- Incident volume by unit
- Incident type breakdown
- Timeline views of incidents by hour/date
- Map-based view of incident locations
- Unit status / operational summary panels
- Interactive filtering by date, shift, battalion, or unit

## Tech Stack

- **Frontend:** HTML, CSS, JavaScript
- **Visualization:** Plotly.js and/or D3.js
- **Data Processing:** Python, pandas
- **Hosting:** GitHub Pages

## Repository Structure

```text
battalion-dashboard/
├── index.html
├── dashboard.html
├── README.md
├── data/
│   ├── raw/
│   └── processed/
├── scripts/
├── js/
├── css/
└── docs/
