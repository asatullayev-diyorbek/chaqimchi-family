from rest_framework import generics, permissions
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import ParentUser
from .serializers import ParentUserSerializer, SignupSerializer


class SignupView(generics.CreateAPIView):
    queryset = ParentUser.objects.all()
    serializer_class = SignupSerializer
    permission_classes = [permissions.AllowAny]


class LoginView(TokenObtainPairView):
    """POST {"email": ..., "password": ...} -> {"access": ..., "refresh": ...}"""


class MeView(generics.RetrieveAPIView):
    serializer_class = ParentUserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user
