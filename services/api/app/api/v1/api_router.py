from fastapi import APIRouter

from app.api.v1.endpoints import (
    auth,
    catalogue,
    favorites,
    health,
    locations,
    planner,
    privacy,
    profile,
    trips,
)

router = APIRouter()

router.include_router(health.router, prefix="/health", tags=["health"])
router.include_router(auth.router, prefix="/auth", tags=["auth"])
router.include_router(profile.router, prefix="/profile", tags=["profile"])
router.include_router(privacy.router, prefix="/privacy", tags=["privacy"])
router.include_router(locations.router, prefix="/locations", tags=["locations"])
router.include_router(planner.router, prefix="/planner", tags=["planner"])
router.include_router(catalogue.router, prefix="/catalogue", tags=["catalogue"])
router.include_router(trips.router, prefix="/trips", tags=["trips"])
router.include_router(favorites.router, prefix="/favorites", tags=["favorites"])
