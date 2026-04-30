from .dashboard import DashboardSummaryView
from .patient_views import PatientListCreateView, PatientDetailView
from .record_views import (
    MedicalRecordListCreateView,
    MedicalRecordDetailView,
    AnalysisResultListView,
)
from .analysis_views import (
    DataUploadView,
    AnalyseView,
    PredictView,
    BatchReportListView,
    BatchReportDetailView,
)
from .patient_views import PatientListCreateView, PatientDetailView, PatientAnalysesView

__all__ = [
    "DashboardSummaryView",
    "PatientListCreateView",
    "PatientDetailView",
    "MedicalRecordListCreateView",
    "MedicalRecordDetailView",
    "AnalysisResultListView",
    "DataUploadView",
    "AnalyseView",
    "PredictView",
    "BatchReportListView",
    "BatchReportDetailView",
]
