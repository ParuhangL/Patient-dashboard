from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from patients.auth_views import RegisterView, MeView
from patients.admin_views import (
    AdminLoginView,
    AdminStatsView,
    AdminUserListView,
    AdminReportsView,
    AdminMLHealthView,
    AdminAuditLogView,
)

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("patients.urls")),
    path("api/auth/login/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/auth/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/auth/register/", RegisterView.as_view(), name="register"),
    path("api/auth/me/", MeView.as_view(), name="me"),
    path("api/admin/login/", AdminLoginView.as_view()),
    path("api/admin/stats/", AdminStatsView.as_view()),
    path("api/admin/users/", AdminUserListView.as_view()),
    path("api/admin/users/<int:pk>/", AdminUserListView.as_view()),
    path("api/admin/reports/", AdminReportsView.as_view()),
    path("api/admin/reports/<int:pk>/", AdminReportsView.as_view()),
    path("api/admin/ml-health/", AdminMLHealthView.as_view()),
    path("api/admin/audit-log/", AdminAuditLogView.as_view()),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
