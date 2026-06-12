from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get("username", "").strip()
        password = request.data.get("password", "")
        email = request.data.get("email", "").strip()

        if not username or not password:
            return Response(
                {"detail": "Username and password are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if User.objects.filter(username=username).exists():
            return Response(
                {"detail": "Username already taken."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = User.objects.create_user(
            username=username, password=password, email=email
        )
        return Response(
            {"detail": "Account created successfully.", "username": user.username},
            status=status.HTTP_201_CREATED,
        )


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(
            {
                "id": request.user.id,
                "username": request.user.username,
                "email": request.user.email,
            }
        )


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        current = request.data.get("current_password", "")
        new_pass = request.data.get("new_password", "")
        confirm = request.data.get("confirm_password", "")

        if not current or not new_pass or not confirm:
            return Response(
                {"detail": "All three fields are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not request.user.check_password(current):
            return Response(
                {"detail": "Current password is incorrect."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if new_pass != confirm:
            return Response(
                {"detail": "New passwords do not match."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if len(new_pass) < 8:
            return Response(
                {"detail": "New password must be at least 8 characters."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        has_letter = any(c.isalpha() for c in new_pass)
        has_digit = any(c.isdigit() for c in new_pass)
        if not has_letter or not has_digit:
            return Response(
                {
                    "detail": "New password must contain at least one letter and one number."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if new_pass == current:
            return Response(
                {
                    "detail": "New password must be different from your current password."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        request.user.set_password(new_pass)
        request.user.save()
        return Response({"detail": "Password updated successfully."})
