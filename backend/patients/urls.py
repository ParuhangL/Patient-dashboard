from django.urls import path
from patients.views import (
    DashboardSummaryView,
    PatientListCreateView,
    PatientDetailView,
    MedicalRecordListCreateView,
    MedicalRecordDetailView,
    AnalysisResultListView,
)

urlpatterns = [
    # Dashboard
    path("dashboard/", DashboardSummaryView.as_view(), name="dashboard-summary"),
    # Patients
    path("patients/", PatientListCreateView.as_view(), name="patient-list-create"),
    path("patients/<int:pk>/", PatientDetailView.as_view(), name="patient-detail"),
    # Medical Records
    path("records/", MedicalRecordListCreateView.as_view(), name="record-list-create"),
    path("records/<int:pk>/", MedicalRecordDetailView.as_view(), name="record-detail"),
    # Analysis Results
    path("analyses/", AnalysisResultListView.as_view(), name="analysis-list"),
]
