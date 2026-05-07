from django.urls import path
from patients.views import (
    PatientListCreateView,
    PatientDetailView,
    MedicalRecordListCreateView,
    MedicalRecordDetailView,
    AnalysisResultListView,
    DashboardSummaryView,
    DataUploadView,
    AnalyseView,
    PredictView,
    BatchReportListView,
    BatchReportDetailView,
    PatientAnalysesView,
)
from patients.views.analysis_views import AnalysePatientView
from patients.views.patient_views import PatientBulkDeleteView

urlpatterns = [
    path("patients/", PatientListCreateView.as_view()),
    path("patients/<int:pk>/", PatientDetailView.as_view()),
    path("records/", MedicalRecordListCreateView.as_view()),
    path("records/<int:pk>/", MedicalRecordDetailView.as_view()),
    path("analyses/", AnalysisResultListView.as_view()),
    path("dashboard/", DashboardSummaryView.as_view()),
    path("upload/", DataUploadView.as_view()),
    path("analyse/", AnalyseView.as_view()),
    path("predict/", PredictView.as_view()),
    path("reports/", BatchReportListView.as_view()),
    path("reports/<int:pk>/", BatchReportDetailView.as_view()),
    path("patients/<int:pk>/analyses/", PatientAnalysesView.as_view()),
    path("patients/<int:pk>/analyse/", AnalysePatientView.as_view()),
    path("patients/bulk-delete/", PatientBulkDeleteView.as_view()),
]
