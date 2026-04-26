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

    def to_dict(self) -> Dict[str, Any]:
        return {
            "total_rows": self.total_rows,
            "valid_rows": self.valid_rows,
            "dropped_duplicates": self.dropped_duplicates,
            "filled_missing": self.filled_missing,
            "outliers_capped": self.outliers_capped,
            "errors": self.errors,
            "warnings": self.warnings,
        }


class ETLPipeline:
    """
    Extract, Validate, Clean, Transform patient CSV/Excel data.
    """

    NUMERIC_COLS = [
        "age",
        "bmi",
        "blood_pressure_systolic",
        "blood_pressure_diastolic",
        "heart_rate",
        "glucose_level",
        "cholesterol",
    ]

    BOUNDS = {
        "age": (0, 120),
        "bmi": (10, 70),
        "blood_pressure_systolic": (60, 250),
        "blood_pressure_diastolic": (40, 150),
        "heart_rate": (30, 220),
        "glucose_level": (50, 600),
        "cholesterol": (50, 600),
    }

    # ── Extract ──────────────────────────────────────────────────

    def extract(self, file_obj, filename: str) -> Tuple[pd.DataFrame, ETLReport]:
        report = ETLReport()
        try:
            if filename.endswith(".csv"):
                df = pd.read_csv(file_obj)
            elif filename.endswith((".xlsx", ".xls")):
                df = pd.read_excel(file_obj, engine="openpyxl")
            else:
                report.errors.append(f"Unsupported file type: {filename}")
                return pd.DataFrame(), report

            report.total_rows = len(df)
            # Normalize column names
            df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]
            return df, report

        except Exception as e:
            report.errors.append(f"Extract error: {str(e)}")
            return pd.DataFrame(), report

    # ── Validate ─────────────────────────────────────────────────

    def validate(self, df: pd.DataFrame, report: ETLReport) -> pd.DataFrame:
        missing_pct = df.isnull().mean() * 100
        for col, pct in missing_pct.items():
            if pct > 50:
                report.warnings.append(f"Column '{col}' has {pct:.1f}% missing values.")
        return df

    # ── Clean ────────────────────────────────────────────────────

    def clean(self, df: pd.DataFrame, report: ETLReport) -> pd.DataFrame:
        # Drop duplicates
        before = len(df)
        df = df.drop_duplicates()
        report.dropped_duplicates = before - len(df)

        # Fill numeric missing with median
        for col in self.NUMERIC_COLS:
            if col in df.columns:
                n_missing = df[col].isnull().sum()
                if n_missing > 0:
                    df[col] = df[col].fillna(df[col].median())
                    report.filled_missing += int(n_missing)

        # Fill categorical missing
        for col in df.select_dtypes(include="object").columns:
            df[col] = df[col].fillna("Unknown")

        # Cap outliers to valid bounds
        for col, (lo, hi) in self.BOUNDS.items():
            if col in df.columns:
                outliers = ((df[col] < lo) | (df[col] > hi)).sum()
                if outliers > 0:
                    df[col] = df[col].clip(lo, hi)
                    report.outliers_capped += int(outliers)

        return df

    # ── Transform ────────────────────────────────────────────────

    def transform(self, df: pd.DataFrame) -> pd.DataFrame:
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

    # ── Full pipeline ─────────────────────────────────────────────

    def run(self, file_obj, filename: str) -> Tuple[pd.DataFrame, ETLReport]:
        df, report = self.extract(file_obj, filename)
        if report.errors:
            return df, report

        df = self.validate(df, report)
        df = self.clean(df, report)
        df = self.transform(df)
        report.valid_rows = len(df)
        return df, report

    def df_to_records(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        df2 = df.copy()
        df2 = df2.where(pd.notnull(df2), None)
        return df2.to_dict(orient="records")
