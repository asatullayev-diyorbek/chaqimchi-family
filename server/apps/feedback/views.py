from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import ParentUser

from .models import Review
from .serializers import ReviewSerializer

MAX_COMMENT_LEN = 2000


class ReviewView(APIView):
    """GET /api/feedback/review/ — the requesting parent's own reviews,
    newest first. POST — always creates a new one; a parent may leave
    several over time, so this never updates an earlier submission."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not isinstance(request.user, ParentUser):
            return Response(
                {"detail": "Parent autentifikatsiyasi talab qilinadi"}, status=status.HTTP_401_UNAUTHORIZED
            )
        reviews = Review.objects.filter(parent=request.user)
        return Response(ReviewSerializer(reviews, many=True).data)

    def post(self, request):
        if not isinstance(request.user, ParentUser):
            return Response(
                {"detail": "Parent autentifikatsiyasi talab qilinadi"}, status=status.HTTP_401_UNAUTHORIZED
            )
        rating = request.data.get("rating")
        if not isinstance(rating, int) or isinstance(rating, bool) or not (1 <= rating <= 5):
            return Response(
                {"detail": "rating 1 dan 5 gacha butun son bo'lishi kerak"}, status=status.HTTP_400_BAD_REQUEST
            )
        comment = str(request.data.get("comment") or "").strip()[:MAX_COMMENT_LEN]

        review = Review.objects.create(parent=request.user, rating=rating, comment=comment)
        return Response(ReviewSerializer(review).data, status=status.HTTP_201_CREATED)
