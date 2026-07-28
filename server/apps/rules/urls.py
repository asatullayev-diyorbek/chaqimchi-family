from django.urls import path

from .views import DeviceOwnRulesView, RuleCollectionView

urlpatterns = [
    path("device/", DeviceOwnRulesView.as_view(), name="rules-own-device"),
    path("<uuid:id>/", RuleCollectionView.as_view(), name="rules-collection"),
]
