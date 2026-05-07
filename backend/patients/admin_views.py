from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from rest_framework.permissions import IsAdminUser
from .models import Patient, AnalysisResult, BatchAnalysisReport
from .models.medical_record import MedicalRecord
from django.db.models import Avg, Count, Max
from .models.audit_log import AuditLog


class AdminLoginView(APIView):
    permission_classes = []
    authentication_classes = []

    def post(self, request):
        username = request.data.get("username")
        password = request.data.get("password")

        if not username or not password:
            return Response(
                {"error": "Username and password are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = authenticate(request, username=username, password=password)

        if user is None:
            return Response(
                {"error": "Invalid credentials."}, status=status.HTTP_401_UNAUTHORIZED
            )

        if not user.is_staff:
            return Response(
                {"error": "Admin access only."}, status=status.HTTP_403_FORBIDDEN
            )

        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email,
                    "is_staff": user.is_staff,
                },
            }
        )


class AdminStatsView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        from django.utils import timezone
        from datetime import timedelta

        now = timezone.now()
        last_30 = now - timedelta(days=30)

        total_users = User.objects.count()
        total_patients = Patient.objects.count()
        total_analyses = AnalysisResult.objects.count()
        total_records = MedicalRecord.objects.count()
        total_reports = BatchAnalysisReport.objects.count()

        new_users_30d = User.objects.filter(date_joined__gte=last_30).count()
        new_patients_30d = Patient.objects.filter(created_at__gte=last_30).count()
        new_analyses_30d = AnalysisResult.objects.filter(
            created_at__gte=last_30
        ).count()

        risk_counts = {
            "HIGH": Patient.objects.filter(blood_pressure_systolic__gte=140).count(),
            "MEDIUM": Patient.objects.filter(
                blood_pressure_systolic__gte=130, blood_pressure_systolic__lt=140
            ).count(),
            "LOW": Patient.objects.filter(blood_pressure_systolic__lt=130).count(),
        }

        return Response(
            {
                "totals": {
                    "users": total_users,
                    "patients": total_patients,
                    "analyses": total_analyses,
                    "records": total_records,
                    "reports": total_reports,
                },
                "last_30_days": {
                    "new_users": new_users_30d,
                    "new_patients": new_patients_30d,
                    "new_analyses": new_analyses_30d,
                },
                "risk_distribution": risk_counts,
            }
        )


class AdminUserListView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        users = User.objects.all().order_by("-date_joined")
        data = []
        for user in users:
            patient_count = Patient.objects.filter(owner=user).count()
            last_report = (
                BatchAnalysisReport.objects.filter(owner=user)
                .order_by("-created_at")
                .first()
            )

            data.append(
                {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email,
                    "is_active": user.is_active,
                    "is_staff": user.is_staff,
                    "date_joined": user.date_joined,
                    "last_login": user.last_login,
                    "patient_count": patient_count,
                    "last_upload": last_report.created_at if last_report else None,
                }
            )

        return Response(data)

    def patch(self, request, pk):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({"error": "User not found."}, status=404)

        is_active = request.data.get("is_active")
        if is_active is not None:
            user.is_active = is_active
            user.save()

        return Response({"id": user.id, "is_active": user.is_active})

    def delete(self, request, pk):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({"error": "User not found."}, status=404)

        if user == request.user:
            return Response(
                {"error": "You cannot delete your own account."}, status=400
            )

        user.delete()
        return Response({"deleted": pk})


class AdminReportsView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        reports = BatchAnalysisReport.objects.select_related("owner").order_by(
            "-created_at"
        )
        data = []
        for r in reports:
            data.append(
                {
                    "id": r.id,
                    "owner": r.owner.username if r.owner else "—",
                    "owner_id": r.owner.id if r.owner else None,
                    "file_name": r.file_name,
                    "status": r.status,
                    "total_rows": r.total_rows,
                    "linked_patients": r.linked_patients,
                    "unlinked_rows": r.unlinked_rows,
                    "created_at": r.created_at,
                }
            )
        return Response(data)

    def delete(self, request, pk):
        try:
            report = BatchAnalysisReport.objects.get(pk=pk)
        except BatchAnalysisReport.DoesNotExist:
            return Response({"error": "Report not found."}, status=404)
        report.delete()
        return Response({"deleted": pk})


class AdminMLHealthView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        MODEL_TYPES = [
            "rule_based",
            "linear_regression",
            "kmeans",
            "logistic",
            "decision_tree",
        ]

        data = []
        for model_type in MODEL_TYPES:
            qs = AnalysisResult.objects.filter(model_type=model_type)
            agg = qs.aggregate(
                total=Count("id"),
                avg_confidence=Avg("confidence"),
                last_run=Max("created_at"),
            )
            risk_counts = {
                "HIGH": qs.filter(risk_label="HIGH").count(),
                "MEDIUM": qs.filter(risk_label="MEDIUM").count(),
                "LOW": qs.filter(risk_label="LOW").count(),
            }
            data.append(
                {
                    "model_type": model_type,
                    "total_runs": agg["total"],
                    "avg_confidence": (
                        round(agg["avg_confidence"], 3)
                        if agg["avg_confidence"]
                        else None
                    ),
                    "last_run": agg["last_run"],
                    "risk_counts": risk_counts,
                }
            )

        return Response(data)


class AdminAuditLogView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        logs = AuditLog.objects.select_related("user").order_by("-timestamp")[:200]
        data = []
        for log in logs:
            data.append(
                {
                    "id": log.id,
                    "user": log.user.username if log.user else "deleted",
                    "action": log.action,
                    "model_name": log.model_name,
                    "object_id": log.object_id,
                    "object_str": log.object_str,
                    "timestamp": log.timestamp,
                    "details": log.details,
                }
            )
        return Response(data)
