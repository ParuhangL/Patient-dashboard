from rest_framework import generics
from patients.models import MedicalRecord, AnalysisResult
from patients.serializers import MedicalRecordSerializer, AnalysisResultSerializer


class MedicalRecordListCreateView(generics.ListCreateAPIView):
    """GET /api/records/  POST /api/records/"""

    serializer_class = MedicalRecordSerializer

    def get_queryset(self):
        qs = MedicalRecord.objects.select_related("patient").order_by("-visit_date")
        patient_id = self.request.query_params.get("patient_id")
        if patient_id:
            qs = qs.filter(patient_id=patient_id)
        return qs


class MedicalRecordDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET/PUT/PATCH/DELETE /api/records/<id>/"""

    queryset = MedicalRecord.objects.all()
    serializer_class = MedicalRecordSerializer


class AnalysisResultListView(generics.ListAPIView):
    """GET /api/analyses/"""

    serializer_class = AnalysisResultSerializer

    def get_queryset(self):
        qs = AnalysisResult.objects.select_related("patient").order_by("-created_at")
        patient_id = self.request.query_params.get("patient_id")
        if patient_id:
            qs = qs.filter(patient_id=patient_id)
        return qs
