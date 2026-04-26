from .dashboard import DashboardSummaryView
from .patient_views import PatientListCreateView, PatientDetailView
from .record_views import (
    MedicalRecordListCreateView,
    MedicalRecordDetailView,
    AnalysisResultListView,
)

__all__ = [
    "DashboardSummaryView",
    "PatientListCreateView",
    "PatientDetailView",
    "MedicalRecordListCreateView",
    "MedicalRecordDetailView",
    "AnalysisResultListView",
]
