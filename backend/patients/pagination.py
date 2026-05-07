from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response


class SafePageNumberPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 100

    def paginate_queryset(self, queryset, request, view=None):
        try:
            return super().paginate_queryset(queryset, request, view)
        except Exception:
            # Page out of range — return last valid page instead of 404
            self.page = self.django_paginator_class(
                queryset, self.get_page_size(request)
            ).page(1)
            self.request = request
            return list(self.page)

    def get_paginated_response(self, data):
        return Response(
            {
                "count": self.page.paginator.count,
                "next": self.get_next_link(),
                "previous": self.get_previous_link(),
                "results": data,
            }
        )
