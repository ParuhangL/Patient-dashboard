from rest_framework import generics
from patients.models import MedicalRecord, AnalysisResult
from patients.serializers import MedicalRecordSerializer, AnalysisResultSerializer


class MedicalRecordListCreateView(generics.ListCreateAPIView):
    serializer_class = MedicalRecordSerializer

    def get_queryset(self):
        # Only records belonging to this user's patients
        qs = (
            MedicalRecord.objects.select_related("patient")
            .filter(patient__owner=self.request.user)
            .order_by("-visit_date")
        )

        patient_id = self.request.query_params.get("patient_id")
        if patient_id:
            qs = qs.filter(patient_id=patient_id)
        return qs


class MedicalRecordDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = MedicalRecordSerializer

    def get_queryset(self):
        return MedicalRecord.objects.filter(patient__owner=self.request.user)


class AnalysisResultListView(generics.ListAPIView):
    serializer_class = AnalysisResultSerializer

    def get_queryset(self):
        # Only analyses belonging to this user's patients
        qs = (
            AnalysisResult.objects.select_related("patient")
            .filter(patient__owner=self.request.user)
            .order_by("-created_at")
        )

        patient_id = self.request.query_params.get("patient_id")
        if patient_id:
            qs = qs.filter(patient_id=patient_id)
        return qs
