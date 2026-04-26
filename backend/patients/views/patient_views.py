from rest_framework import generics, filters
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from patients.models import Patient
from patients.serializers import PatientSerializer, PatientListSerializer


class PatientListCreateView(generics.ListCreateAPIView):
    """GET /api/patients/  POST /api/patients/"""

    queryset = Patient.objects.filter(is_active=True).order_by("-created_at")
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["first_name", "last_name", "gender"]
    ordering_fields = ["created_at", "first_name", "last_name"]

    def get_serializer_class(self):
        if self.request.method == "GET":
            return PatientListSerializer
        return PatientSerializer


class PatientDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET/PUT/PATCH/DELETE /api/patients/<id>/"""

    queryset = Patient.objects.all()
    serializer_class = PatientSerializer

    def destroy(self, request, *args, **kwargs):
        patient = self.get_object()
        patient.deactivate()
        return Response(
            {"message": "Patient deactivated."}, status=status.HTTP_204_NO_CONTENT
        )
