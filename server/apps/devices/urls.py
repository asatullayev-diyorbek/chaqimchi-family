from django.urls import path

from .views import GenerateCodeView, VerifyCodeView

urlpatterns = [
    path("generate-code/", GenerateCodeView.as_view(), name="generate-code"),
    path("verify-code/", VerifyCodeView.as_view(), name="verify-code"),
]
