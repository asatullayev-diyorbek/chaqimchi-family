from django.db.models import Q
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import ParentUser
from .serializers import ParentUserSerializer, SignupSerializer


class SignupView(generics.CreateAPIView):
    queryset = ParentUser.objects.all()
    serializer_class = SignupSerializer
    permission_classes = [permissions.AllowAny]


class LoginView(APIView):
    """POST {"username": ..., "password": ...} -> {"access": ..., "refresh": ...}

    "username" is matched against either username or email — parent-web's
    login form asks for a username, but parent-mobile still sends the
    field as "email" for existing email/password accounts, so both keys
    are accepted and matched against both columns.
    """

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        identifier = request.data.get("username") or request.data.get("email") or ""
        password = request.data.get("password") or ""
        user = (
            ParentUser.objects.filter(Q(username=identifier) | Q(email=identifier)).first()
            if identifier
            else None
        )

        if user is None or not user.has_usable_password() or not user.check_password(password):
            return Response({"detail": "No active account found with the given credentials"}, status=status.HTTP_401_UNAUTHORIZED)

        refresh = RefreshToken.for_user(user)
        return Response({"access": str(refresh.access_token), "refresh": str(refresh)})


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = ParentUserSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ["get", "patch", "head", "options"]

    def get_object(self):
        return self.request.user

    def get_serializer(self, *args, **kwargs):
        kwargs.setdefault("partial", True)
        return super().get_serializer(*args, **kwargs)
