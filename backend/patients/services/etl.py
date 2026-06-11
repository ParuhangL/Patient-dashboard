import pandas as pd
from dataclasses import dataclass, field
from typing import Dict, Any, Tuple, List


@dataclass
class ETLReport:
    total_rows: int = 0
    valid_rows: int = 0
    dropped_duplicates: int = 0
    filled_missing: int = 0
    outliers_capped: int = 0
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)

    # Detail lists — each entry is a dict describing exactly what happened
    duplicate_details: List[Dict] = field(default_factory=list)
    missing_details: List[Dict] = field(default_factory=list)
    outlier_details: List[Dict] = field(default_factory=list)
    empty_row_details: List[Dict] = field(default_factory=list)
    invalid_date_details: List[Dict] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "total_rows": self.total_rows,
            "valid_rows": self.valid_rows,
            "dropped_duplicates": self.dropped_duplicates,
            "filled_missing": self.filled_missing,
            "outliers_capped": self.outliers_capped,
            "errors": self.errors,
            "warnings": self.warnings,
            "duplicate_details": self.duplicate_details,
            "missing_details": self.missing_details,
            "outlier_details": self.outlier_details,
            "empty_row_details": self.empty_row_details,
            "invalid_date_details": self.invalid_date_details,
        }


class ETLPipeline:
    NUMERIC_COLS = [
        "bmi",
        "blood_pressure_systolic",
        "blood_pressure_diastolic",
        "heart_rate",
        "glucose_level",
        "cholesterol",
    ]

    BOUNDS = {
        "bmi": (10, 70),
        "blood_pressure_systolic": (60, 250),
        "blood_pressure_diastolic": (40, 150),
        "heart_rate": (30, 220),
        "glucose_level": (50, 600),
        "cholesterol": (50, 600),
    }

    REQUIRED_COLUMNS = [
        "first_name",
        "last_name",
        "date_of_birth",
        "blood_pressure_systolic",
    ]

    def extract(self, file_obj, filename: str) -> Tuple[pd.DataFrame, "ETLReport"]:
        report = ETLReport()
        try:
            if filename.endswith(".csv"):
                df = pd.read_csv(
                    file_obj,
                    skip_blank_lines=True,
                    on_bad_lines="skip",
                )
            elif filename.endswith((".xlsx", ".xls")):
                df = pd.read_excel(file_obj, engine="openpyxl")
            else:
                report.errors.append(f"Unsupported file type: {filename}")
                return pd.DataFrame(), report

            report.total_rows = len(df)
            df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]

            # Add a 1-based row number column so we can reference original rows
            # in detail messages. Dropped before returning to ML pipeline.
            df["_row"] = range(2, len(df) + 2)  # +2 = 1-based + skip header

            return df, report
        except Exception as e:
            report.errors.append(f"Extract error: {str(e)}")
            return pd.DataFrame(), report

    def validate(self, df: pd.DataFrame, report: ETLReport) -> pd.DataFrame:
        # 1. Required columns check
        missing_cols = [c for c in self.REQUIRED_COLUMNS if c not in df.columns]
        if missing_cols:
            usable_numeric = [c for c in self.NUMERIC_COLS if c in df.columns]
            has_names = "first_name" in df.columns or "last_name" in df.columns
            if not usable_numeric and not has_names:
                report.errors.append(
                    f"File does not appear to be a patient dataset. "
                    f"Missing columns: {', '.join(missing_cols)}. "
                    f"Please check your CSV headers."
                )
                return df
            else:
                report.warnings.append(
                    f"Missing recommended columns: {', '.join(missing_cols)}. "
                    f"Some features may be unavailable."
                )

        # 2. Drop completely empty rows
        before_empty = len(df)
        empty_mask = df.drop(columns=["_row"], errors="ignore").isnull().all(axis=1)
        empty_rows = df[empty_mask]
        for _, row in empty_rows.iterrows():
            report.empty_row_details.append(
                {
                    "row": int(row.get("_row", "?")),
                    "reason": "Entire row is empty",
                }
            )
        df = df[~empty_mask]
        dropped_empty = before_empty - len(df)
        if dropped_empty > 0:
            report.warnings.append(f"{dropped_empty} completely empty row(s) removed.")

        # 3. Warn on columns with >50% missing
        missing_pct = df.drop(columns=["_row"], errors="ignore").isnull().mean() * 100
        for col, pct in missing_pct.items():
            if pct > 50:
                report.warnings.append(
                    f"Column '{col}' has {pct:.1f}% missing values — results may be unreliable."
                )

        # 4. Drop rows where BOTH first_name and last_name are empty
        if "first_name" in df.columns and "last_name" in df.columns:
            before_names = len(df)
            first_empty = df["first_name"].isna() | (
                df["first_name"].astype(str).str.strip() == ""
            )
            last_empty = df["last_name"].isna() | (
                df["last_name"].astype(str).str.strip() == ""
            )
            both_empty = first_empty & last_empty
            for _, row in df[both_empty].iterrows():
                report.empty_row_details.append(
                    {
                        "row": int(row.get("_row", "?")),
                        "reason": "Both first_name and last_name are empty",
                    }
                )
            df = df[~both_empty]
            dropped_names = before_names - len(df)
            if dropped_names > 0:
                report.warnings.append(
                    f"{dropped_names} row(s) removed: both first_name and last_name were empty."
                )

        # 5. Parse and validate date_of_birth
        if "date_of_birth" in df.columns:
            df = df.copy()
            original_dob = df["date_of_birth"].copy()
            df["date_of_birth"] = pd.to_datetime(df["date_of_birth"], errors="coerce")

            # Find rows where parsing failed (was not already NaT before)
            was_not_null = original_dob.notna()
            now_null = df["date_of_birth"].isna()
            bad_dates = was_not_null & now_null
            for _, row in df[bad_dates].iterrows():
                original_val = (
                    original_dob.iloc[row.name] if hasattr(row, "name") else "unknown"
                )
                report.invalid_date_details.append(
                    {
                        "row": int(row.get("_row", "?")),
                        "name": f"{row.get('first_name', '')} {row.get('last_name', '')}".strip(),
                        "value": str(original_dob.loc[row.name]),
                        "reason": "Unparseable date — age will not be calculated",
                    }
                )

            future_mask = df["date_of_birth"] > pd.Timestamp.today()
            if future_mask.sum() > 0:
                report.warnings.append(
                    f"{future_mask.sum()} row(s) have a date_of_birth in the future."
                )

            null_dob = df["date_of_birth"].isna().sum()
            if null_dob > 0:
                report.warnings.append(
                    f"{null_dob} row(s) have an unparseable date_of_birth — age will not be calculated."
                )

        # 6. Final guard
        if len(df) == 0:
            report.errors.append(
                "No valid rows remain after validation. "
                "Please check your data for empty names and formatting issues."
            )

        return df

    def clean(self, df: pd.DataFrame, report: ETLReport) -> pd.DataFrame:
        # 1. Exact duplicate rows
        before = len(df)
        # Find duplicate rows (excluding _row column)
        cols_for_dedup = [c for c in df.columns if c != "_row"]
        dup_mask = df.duplicated(subset=cols_for_dedup, keep="first")
        for _, row in df[dup_mask].iterrows():
            report.duplicate_details.append(
                {
                    "row": int(row.get("_row", "?")),
                    "name": f"{row.get('first_name', '')} {row.get('last_name', '')}".strip(),
                    "dob": str(row.get("date_of_birth", ""))[:10],
                }
            )
        df = df[~dup_mask]
        report.dropped_duplicates += before - len(df)

        # 2. Fill missing numeric values with column median
        for col in self.NUMERIC_COLS:
            if col in df.columns:
                null_mask = df[col].isnull()
                n_missing = null_mask.sum()
                if n_missing > 0:
                    median_val = df[col].median()
                    for _, row in df[null_mask].iterrows():
                        report.missing_details.append(
                            {
                                "row": int(row.get("_row", "?")),
                                "name": f"{row.get('first_name', '')} {row.get('last_name', '')}".strip(),
                                "column": col,
                                "filled_with": round(float(median_val), 2),
                            }
                        )
                    df[col] = df[col].fillna(median_val)
                    report.filled_missing += int(n_missing)

        # 3. Fill missing strings
        for col in df.select_dtypes(include="object").columns:
            if col != "_row":
                df[col] = df[col].fillna("Unknown")

        # 4. Parse date_of_birth (safe to run again)
        if "date_of_birth" in df.columns:
            df["date_of_birth"] = pd.to_datetime(df["date_of_birth"], errors="coerce")

        # 5. Cap outliers to clinical bounds
        for col, (lo, hi) in self.BOUNDS.items():
            if col in df.columns:
                outlier_mask = (df[col] < lo) | (df[col] > hi)
                outliers = outlier_mask.sum()
                if outliers > 0:
                    for _, row in df[outlier_mask].iterrows():
                        original_val = row[col]
                        capped_val = max(lo, min(hi, original_val))
                        report.outlier_details.append(
                            {
                                "row": int(row.get("_row", "?")),
                                "name": f"{row.get('first_name', '')} {row.get('last_name', '')}".strip(),
                                "column": col,
                                "original": round(float(original_val), 2),
                                "capped_to": capped_val,
                                "bound": f"{lo}–{hi}",
                            }
                        )
                    df[col] = df[col].clip(lo, hi)
                    report.outliers_capped += int(outliers)

        return df

    def transform(self, df: pd.DataFrame) -> pd.DataFrame:
        # Drop the internal row-number column before ML sees the data
        df = df.drop(columns=["_row"], errors="ignore")

        if "date_of_birth" in df.columns:
            today = pd.Timestamp.today()
            df["age"] = df["date_of_birth"].apply(
                lambda d: (today - d).days // 365 if pd.notna(d) else None
            )
        if (
            "blood_pressure_systolic" in df.columns
            and "blood_pressure_diastolic" in df.columns
        ):
            df["bp_category"] = df.apply(self._classify_bp, axis=1)
        if "bmi" in df.columns:
            df["bmi_category"] = pd.cut(
                df["bmi"],
                bins=[0, 18.5, 25, 30, 100],
                labels=["Underweight", "Normal", "Overweight", "Obese"],
            ).astype(str)
        if "glucose_level" in df.columns:
            df["glucose_category"] = pd.cut(
                df["glucose_level"],
                bins=[0, 100, 126, 1000],
                labels=["Normal", "Pre-diabetic", "Diabetic"],
            ).astype(str)
        return df

    def _classify_bp(self, row) -> str:
        s = row.get("blood_pressure_systolic", 0)
        d = row.get("blood_pressure_diastolic", 0)
        if s < 120 and d < 80:
            return "Normal"
        if s < 130 and d < 80:
            return "Elevated"
        if s < 140 or d < 90:
            return "High Stage 1"
        return "High Stage 2"

    def run(self, file_obj, filename: str) -> Tuple[pd.DataFrame, ETLReport]:
        df, report = self.extract(file_obj, filename)
        if report.errors:
            return df, report
        df = self.validate(df, report)
        if report.errors:
            return df, report
        df = self.clean(df, report)
        df = self.transform(df)
        report.valid_rows = len(df)
        return df, report

    def df_to_records(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        df2 = df.copy()
        df2 = df2.drop(columns=["_row"], errors="ignore")
        df2 = df2.where(pd.notnull(df2), None)
        return df2.to_dict(orient="records")
