from django.urls import path

from .views import ChildListCreateView, GenerateCodeView, VerifyCodeView

urlpatterns = [
    path("children/", ChildListCreateView.as_view(), name="children"),
    path("generate-code/", GenerateCodeView.as_view(), name="generate-code"),
    path("verify-code/", VerifyCodeView.as_view(), name="verify-code"),
]
