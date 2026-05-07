from rest_framework import generics
from patients.models import MedicalRecord, AnalysisResult, Patient
from patients.serializers import MedicalRecordSerializer, AnalysisResultSerializer
from django.shortcuts import get_object_or_404


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

    def perform_create(self, serializer):
        patient_id = self.request.data.get("patient")
        patient = get_object_or_404(Patient, pk=patient_id, owner=self.request.user)
        record = serializer.save(patient=patient)

        # Sync non-null visit vitals back to the Patient's metric fields
        fields_to_sync = [
            "blood_pressure_systolic",
            "blood_pressure_diastolic",
            "heart_rate",
            "glucose_level",
            "bmi",
        ]
        updated = False
        for field in fields_to_sync:
            val = getattr(record, field, None)
            if val is not None:
                setattr(patient, field, val)
                updated = True

        if updated:
            patient.save()


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
