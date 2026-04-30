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


class PatientListCreateView(generics.ListCreateAPIView):
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["first_name", "last_name", "gender"]
    ordering_fields = ["created_at", "first_name", "last_name"]

    def get_queryset(self):
        return Patient.objects.filter(owner=self.request.user, is_active=True).order_by(
            "-created_at"
        )

    def get_serializer_class(self):
        if self.request.method == "GET":
            return PatientListSerializer
        return PatientSerializer

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)


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
