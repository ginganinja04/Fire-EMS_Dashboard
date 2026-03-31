from pathlib import Path
import pandas as pd
import random

RAW_DIR = Path("data/raw")
PROCESSED_DIR = Path("data/processed")

import random


FIRST_NAMES = [
    "Alex", "Jordan", "Taylor", "Morgan", "Casey",
    "Riley", "Avery", "Quinn", "Drew", "Cameron",
    "Jamie", "Reese", "Logan"
]

LAST_NAMES = [
    "Turner", "Butler", "Hamilton", "Foster",
    "Hayes", "Parker", "Reed", "Sullivan",
    "Morris", "Coleman", "Bennett", "Ward"
]


def generate_fake_patient_info(row_index: int):
    """
    Generates deterministic fake patient name + DOB
    based on row index so results stay reproducible.
    """

    random.seed(row_index)

    first = random.choice(FIRST_NAMES)
    last = random.choice(LAST_NAMES)

    year = random.randint(1945, 2005)
    month = random.randint(1, 12)
    day = random.randint(1, 28)

    dob = f"{year:04d}-{month:02d}-{day:02d}"

    return f"{first} {last}", dob

def normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df.columns = (
        df.columns.astype(str)
        .str.strip()
        .str.lower()
        .str.replace(r"[^a-z0-9]+", "_", regex=True)
        .str.strip("_")
    )
    return df


def save_outputs(df: pd.DataFrame, base_name: str) -> None:
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

    csv_path = PROCESSED_DIR / f"{base_name}.csv"
    json_path = PROCESSED_DIR / f"{base_name}.json"

    df.to_csv(csv_path, index=False)
    df.to_json(json_path, orient="records", indent=2)

    print(f"Saved {csv_path}")
    print(f"Saved {json_path}")


def load_csv(file_name: str) -> pd.DataFrame:
    return pd.read_csv(RAW_DIR / file_name)


def load_embedded_header_csv(file_name: str) -> pd.DataFrame:
    """
    For CSVs where the first row contains the real headers.
    Keeps all columns and rows after the header row.
    """
    df = load_csv(file_name)
    df.columns = df.iloc[0]
    df = df[1:].reset_index(drop=True)
    df = normalize_columns(df)
    return df


def parse_hhmmss_number_to_time_string(value):
    """
    Converts values like 93554 or 102506 into HH:MM:SS strings.
    Returns None if parsing fails.
    """
    if pd.isna(value):
        return None

    value_str = str(value).strip()

    if value_str.endswith(".0"):
        value_str = value_str[:-2]

    if not value_str.isdigit():
        return None

    value_str = value_str.zfill(6)

    hh = value_str[0:2]
    mm = value_str[2:4]
    ss = value_str[4:6]

    try:
        hh_i = int(hh)
        mm_i = int(mm)
        ss_i = int(ss)
    except ValueError:
        return None

    if not (0 <= hh_i <= 23 and 0 <= mm_i <= 59 and 0 <= ss_i <= 59):
        return None

    return f"{hh}:{mm}:{ss}"


def clean_ambulance_uhu() -> pd.DataFrame:
    df = load_csv("ambulance_uhu - Ambulance UHU-Table 1.csv")
    df = normalize_columns(df)

    numeric_cols = ["staffingsec", "busysec", "uhu", "call_count"]
    for col in numeric_cols:
        if col in df.columns:
            df[f"{col}_numeric"] = pd.to_numeric(df[col], errors="coerce")

    return df


def clean_oos_units() -> pd.DataFrame:
    df = load_csv("oos_units - OOS-Table 1.csv")
    df = normalize_columns(df)

    if "elapsed_h_m_s" in df.columns:
        td = pd.to_timedelta(df["elapsed_h_m_s"], errors="coerce")
        df["elapsed_timedelta"] = td
        df["elapsed_seconds"] = td.dt.total_seconds()
        df["elapsed_hours"] = td.dt.total_seconds() / 3600

    if "since" in df.columns:
        df["since_time_parsed"] = pd.to_datetime(
            df["since"], format="%H:%M:%S", errors="coerce"
        )

    return df


def clean_stemi():

    df = load_embedded_header_csv("stemi - Stemi-Table 1.csv")

    rename_map = {
        "incident_number": "incident_id",
        "incident": "incident_id",
        "cad": "cad_number",
        "cad_number": "cad_number",
    }

    df = df.rename(
        columns={k: v for k, v in rename_map.items() if k in df.columns}
    )

    # Clean date column
    if "date" in df.columns:

        df["date_clean"] = (
            df["date"]
            .astype(str)
            .str.replace(" tt", "", regex=False)
        )

        df["date_parsed"] = pd.to_datetime(
            df["date_clean"],
            errors="coerce"
        )

    # Convert minute/time-like columns to numeric versions
    for col in df.columns:

        col_lower = str(col).lower()

        if "minute" in col_lower or "time" in col_lower:

            df[f"{col}_numeric"] = pd.to_numeric(
                df[col],
                errors="coerce"
            )

    # ----------------------------------
    # Add synthetic patient identity data
    # ----------------------------------

    patient_names = []
    patient_dobs = []

    for i in range(len(df)):

        name, dob = generate_fake_patient_info(i)

        patient_names.append(name)
        patient_dobs.append(dob)

    df["patient_name"] = patient_names
    df["patient_dob"] = patient_dobs

    return df

def clean_overdue_reports() -> pd.DataFrame:
    df = load_embedded_header_csv("overdue_reports - Overdue Reports-Table 1.csv")

    for col in df.columns:
        col_lower = str(col).lower()
        if "date" in col_lower or "time" in col_lower:
            df[f"{col}_parsed"] = pd.to_datetime(df[col], errors="coerce")

    return df


def clean_turnout_time_compliance() -> pd.DataFrame:
    df = load_csv("turnout_time_compliance - Turnout Time Compliance-Table 1.csv")
    df = normalize_columns(df)

    rename_map = {
        "unit_id": "unit",
        "call_no": "cad_number",
        "call_type_final": "call_type",
        "ts_unit_turnout": "turnout_seconds",
        "turnoutcompliance": "turnout_compliance",
        "battalionname": "battalion",
        "rptcategory": "report_category",
    }
    df = df.rename(columns={k: v for k, v in rename_map.items() if k in df.columns})

    date_cols = [
        "unit_enroute_date",
        "call_entry_date",
        "unit_dispatch_date",
        "unit_onscene_date",
    ]
    for col in date_cols:
        if col in df.columns:
            df[f"{col}_clean"] = (
                df[col]
                .astype(str)
                .str.replace(" 0:00", "", regex=False)
            )
            df[f"{col}_parsed"] = pd.to_datetime(df[f"{col}_clean"], errors="coerce")

    hhmmss_cols = [
        "call_created_time",
        "call_entry_time",
        "unit_dispatch_time",
        "unit_enroute_time",
        "unit_onscene_time",
    ]
    for col in hhmmss_cols:
        if col in df.columns:
            df[f"{col}_time_string"] = df[col].apply(parse_hhmmss_number_to_time_string)
            df[f"{col}_numeric"] = pd.to_numeric(df[col], errors="coerce")

    if "turnout_seconds" in df.columns:
        df["turnout_seconds_numeric"] = pd.to_numeric(df["turnout_seconds"], errors="coerce")
        df["turnout_minutes"] = df["turnout_seconds_numeric"] / 60

    if "turnout_compliance" in df.columns:
        df["turnout_compliance_clean"] = (
            df["turnout_compliance"]
            .astype(str)
            .str.strip()
            .str.title()
        )
        df["met_turnout"] = df["turnout_compliance_clean"].eq("Met")

    if "unit_dispatch_date_parsed" in df.columns:
        df["dispatch_date"] = df["unit_dispatch_date_parsed"]
        df["dispatch_day"] = df["dispatch_date"].dt.day_name()
        df["dispatch_month"] = df["dispatch_date"].dt.month_name()

    if "unit_dispatch_time_time_string" in df.columns:
        df["dispatch_hour"] = pd.to_datetime(
            df["unit_dispatch_time_time_string"],
            format="%H:%M:%S",
            errors="coerce"
        ).dt.hour

    return df


def create_turnout_summary(df: pd.DataFrame) -> pd.DataFrame:
    required_cols = {"unit", "met_turnout"}
    if not required_cols.issubset(df.columns):
        print("Skipping turnout summary; missing required columns.")
        return pd.DataFrame()

    working_df = df.copy()

    if "report_category" in working_df.columns:
        working_df = working_df[
            working_df["report_category"].astype(str).str.lower() != "omit"
        ].copy()

    summary = (
        working_df.groupby("unit", dropna=False)
        .agg(
            total_calls=("met_turnout", "count"),
            met_calls=("met_turnout", "sum"),
        )
        .reset_index()
    )

    summary["missed_calls"] = summary["total_calls"] - summary["met_calls"]
    summary["compliance_rate"] = summary["met_calls"] / summary["total_calls"]

    if "battalion" in working_df.columns:
        battalion_map = (
            working_df[["unit", "battalion"]]
            .dropna()
            .drop_duplicates(subset=["unit"])
        )
        summary = summary.merge(battalion_map, on="unit", how="left")

    if "unit_type" in working_df.columns:
        unit_type_map = (
            working_df[["unit", "unit_type"]]
            .dropna()
            .drop_duplicates(subset=["unit"])
        )
        summary = summary.merge(unit_type_map, on="unit", how="left")

    return summary.sort_values(by=["compliance_rate", "unit"], ascending=[True, True])


def create_uhu_summary(df: pd.DataFrame) -> pd.DataFrame:
    return df.copy()


def create_oos_summary(df: pd.DataFrame) -> pd.DataFrame:
    return df.copy()


def create_stemi_summary(df: pd.DataFrame) -> pd.DataFrame:
    return df.copy()


def create_overdue_summary(df: pd.DataFrame) -> pd.DataFrame:
    return df.copy()


def main() -> None:
    print("Processing datasets...")

    ambulance_uhu = clean_ambulance_uhu()
    save_outputs(ambulance_uhu, "ambulance_uhu_clean")

    oos_units = clean_oos_units()
    save_outputs(oos_units, "oos_units_clean")

    stemi = clean_stemi()
    save_outputs(stemi, "stemi_clean")

    overdue_reports = clean_overdue_reports()
    save_outputs(overdue_reports, "overdue_reports_clean")

    turnout = clean_turnout_time_compliance()
    save_outputs(turnout, "turnout_time_compliance_clean")

    turnout_summary = create_turnout_summary(turnout)
    if not turnout_summary.empty:
        save_outputs(turnout_summary, "turnout_summary")

    uhu_summary = create_uhu_summary(ambulance_uhu)
    save_outputs(uhu_summary, "uhu_summary")

    oos_summary = create_oos_summary(oos_units)
    save_outputs(oos_summary, "oos_summary")

    stemi_summary = create_stemi_summary(stemi)
    save_outputs(stemi_summary, "stemi_summary")

    overdue_summary = create_overdue_summary(overdue_reports)
    save_outputs(overdue_summary, "overdue_summary")

    print("Done.")


if __name__ == "__main__":
    main()
