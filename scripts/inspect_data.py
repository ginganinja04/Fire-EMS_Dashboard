from pathlib import Path
import pandas as pd

DATA_DIR = Path("data/raw")

def inspect_csv(path):
    print(f"\nReading: {path}")
    df = pd.read_csv(path)

    print("=" * 60)
    print(f"FILE: {path.name}")
    print("=" * 60)

    print("\nShape:")
    print(df.shape)

    print("\nColumns:")
    print(df.columns.tolist())

    print("\nPreview:")
    print(df.head())

    print("\nMissing values:")
    print(df.isnull().sum())

    print("\nDone with file.\n")

def main():
    print("Current working directory:", Path.cwd())
    print("Looking for CSVs in:", DATA_DIR.resolve())

    csv_files = list(DATA_DIR.glob("*.csv"))
    print("Found CSV files:", csv_files)

    if not csv_files:
        print("No CSV files found.")
        return

    for csv_file in csv_files:
        inspect_csv(csv_file)

if __name__ == "__main__":
    main()
