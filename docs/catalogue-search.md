# Catalogue search and maps

Public catalogue reads come from PostgreSQL (`app.public_catalogue_*`). Unpublished, paused, archived, or inactive-organization rows never leave those functions.

## Embeddings

CI and local default use a deterministic stub:

- SQL: `app.stub_embedding(text)` (8-dim hash vector)
- Python: `app.catalogue.embeddings.stub_embedding`

Set `CATALOGUE_EMBEDDING_PROVIDER` to a real provider name when an API credential exists. The stub stays the fallback so search tests do not invent listings.

Natural-language queries are tokenized: stopwords (`in`, `the`, Arabic/French equivalents) are dropped, and remaining keywords must all appear in `search_text`. That is why `cedars in Bsharri` still returns the published cedar listing even though the phrase is not stored verbatim. The parser also lifts destination, category, and kind into the same filters as the browse page. Stub embeddings rank those keyword hits; they are not used as a recall fallback, so unknown phrases return no listings.

## Routing / travel time

Related cards still show PostGIS distance plus `app.catalogue.routing.estimate_travel` for nearby ranking.

Planner travel time uses `app.planner.routing.RoutingService` (Google Distance Matrix when a server Maps credential exists, otherwise a labelled Haversine stub). Cache key = origin, destination, mode, time bucket. Provider failure marks metrics unavailable; it does not invent minutes. See `docs/maps-routing-weather.md`.

## Maps

The experiences list/map toggle keeps the same filter query string (`view=map`). Markers are the current result set.

Set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` to a **referrer-restricted** Google Maps key. When it is empty, the UI degrades to clustered pins (Beirut density) and the list remains usable at 390px.
