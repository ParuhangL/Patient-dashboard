from rest_framework import generics, filters
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from patients.models import Patient, AnalysisResult
from patients.serializers import (
    PatientSerializer,
    PatientListSerializer,
    AnalysisResultSerializer,
)
from patients.models.audit_log import AuditLog


# ── Audit helper ──────────────────────────────────────────────────────────
def log_action(user, action, obj, details=None):
    AuditLog.objects.create(
        user=user,
        action=action,
        model_name="Patient",
        object_id=obj.id,
        object_str=str(obj),
        details=details or {},
    )


class PatientListCreateView(generics.ListCreateAPIView):
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["first_name", "last_name", "gender"]
    ordering_fields = ["created_at", "first_name", "last_name"]

    def get_queryset(self):
        qs = Patient.objects.filter(owner=self.request.user, is_active=True).order_by(
            "-created_at"
        )
        return qs

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())

        # Apply risk_level filter in Python since it's a @property
        risk_level = request.query_params.get("risk_level")
        if risk_level:
            queryset = [p for p in queryset if p.risk_level == risk_level]
            # Manual pagination for filtered list
            page_size = int(request.query_params.get("page_size", 10))
            page = int(request.query_params.get("page", 1))
            total = len(queryset)
            start = (page - 1) * page_size
            end = start + page_size
            sliced = queryset[start:end]
            serializer = self.get_serializer(sliced, many=True)
            return Response(
                {
                    "count": total,
                    "next": None,
                    "previous": None,
                    "results": serializer.data,
                }
            )

        # Normal paginated path for no filter
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    def get_serializer_class(self):
        if self.request.method == "GET":
            return PatientListSerializer
        return PatientSerializer

    def perform_create(self, serializer):
        patient = serializer.save(owner=self.request.user)
        log_action(
            self.request.user,
            "create",
            patient,
            details={
                "fields": {
                    "name": f"{patient.first_name} {patient.last_name}",
                    "dob": str(patient.date_of_birth),
                    "gender": patient.gender,
                    "email": patient.email or "",
                }
            },
        )


class PatientDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = PatientSerializer

    def get_queryset(self):
        return Patient.objects.filter(owner=self.request.user)

    def destroy(self, request, *args, **kwargs):
        patient = self.get_object()
        patient.deactivate()
        return Response(
            {"message": "Patient deactivated."}, status=status.HTTP_204_NO_CONTENT
        )

    def perform_update(self, serializer):
        old = serializer.instance
        # snapshot old values before save
        TRACKED_FIELDS = [
            "first_name",
            "last_name",
            "date_of_birth",
            "gender",
            "email",
            "phone",
            "blood_pressure_systolic",
            "blood_pressure_diastolic",
            "heart_rate",
            "glucose_level",
            "bmi",
            "cholesterol",
            "is_smoker",
            "is_diabetic",
            "has_hypertension",
            "is_active",
        ]
        old_values = {f: str(getattr(old, f, None)) for f in TRACKED_FIELDS}

        patient = serializer.save()

        # compare new values
        new_values = {f: str(getattr(patient, f, None)) for f in TRACKED_FIELDS}
        changes = {
            f: {"from": old_values[f], "to": new_values[f]}
            for f in TRACKED_FIELDS
            if old_values[f] != new_values[f]
        }

        log_action(self.request.user, "update", patient, details={"changes": changes})

    def perform_destroy(self, instance):
        log_action(
            self.request.user,
            "delete",
            instance,
            {"name": f"{instance.first_name} {instance.last_name}"},
        )
        instance.delete()


class PatientAnalysesView(APIView):
    def get(self, request, pk):
        try:
            patient = Patient.objects.get(pk=pk, owner=request.user)
        except Patient.DoesNotExist:
            return Response(
                {"error": "Patient not found."}, status=status.HTTP_404_NOT_FOUND
            )

        analyses = AnalysisResult.objects.filter(patient=patient).order_by(
            "-created_at"
        )
        serializer = AnalysisResultSerializer(analyses, many=True)
        return Response(
            {
                "patient_id": patient.id,
                "patient_name": f"{patient.first_name} {patient.last_name}",
                "total": analyses.count(),
                "analyses": serializer.data,
            }
        )


class PatientBulkDeleteView(APIView):
    def delete(self, request):
        ids = request.data.get("ids", [])
        if not ids:
            return Response(
                {"error": "No patient IDs provided."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        deleted, _ = Patient.objects.filter(id__in=ids, owner=request.user).delete()
        return Response({"deleted": deleted}, status=status.HTTP_200_OK)
