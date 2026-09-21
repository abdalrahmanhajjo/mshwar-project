from __future__ import annotations

import time
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta

from app.planner.geo_math import duration_seconds, road_distance_m
from app.planner.routing import RouteLeg, RoutingCost, RoutingService

INF = 10**12
# Held-Karp is exact but O(2^n · n²): 12 stops solve in ~0.1 s, 16 in seconds.
MAX_OPTIMIZE_STOPS = 12
MAX_SOLVER_TIMEOUT_MS = 5000


@dataclass
class OptimizeStop:
    id: str
    lat: float
    lng: float
    label: str = "Stop"
    duration_minutes: int = 60
    locked: bool = False
    position: int | None = None
    window_start: datetime | None = None
    window_end: datetime | None = None
    closes_at: datetime | None = None
    weather_sensitivity: str = "outdoor"
    estimated_minor: int = 0


@dataclass
class SolveStop:
    id: str
    label: str
    lat: float
    lng: float
    position: int
    locked: bool
    arrives_at: datetime | None
    departs_at: datetime | None
    duration_minutes: int
    weather_sensitivity: str
    estimated_minor: int


@dataclass
class OptimizeResult:
    feasible: bool
    reason: str | None
    solver: str
    fallback: bool
    timeout: bool
    ordered: list[SolveStop]
    legs: list[RouteLeg]
    total_distance_m: int | None
    total_duration_seconds: int | None
    metrics_available: bool
    routing_cost: RoutingCost
    solve_ms: float
    window_start: datetime
    return_by: datetime


def _seconds_since(origin: datetime, moment: datetime | None, default: int) -> int:
    if moment is None:
        return default
    return int((_aware(moment) - _aware(origin)).total_seconds())


def _haversine_matrix(coords: list[tuple[float, float]], mode: str) -> list[list[int]]:
    grid: list[list[int]] = []
    for i, (olat, olng) in enumerate(coords):
        row: list[int] = []
        for j, (dlat, dlng) in enumerate(coords):
            if i == j:
                row.append(0)
            else:
                row.append(duration_seconds(road_distance_m(olat, olng, dlat, dlng), mode))
        grid.append(row)
    return grid


@dataclass
class _TourProblem:
    """Times are seconds from the window start. Node 0 is the start point; stops are 1..n."""

    travel: list[list[int]]
    stay: list[int]
    windows: list[tuple[int, int]]
    closes: list[int]
    locked_at: dict[int, int]  # visit position (1-based) -> node
    return_limit: int
    locked_nodes: frozenset[int] = field(init=False, default=frozenset())

    def __post_init__(self) -> None:
        self.locked_nodes = frozenset(self.locked_at.values())

    @property
    def size(self) -> int:
        return len(self.travel) - 1

    def position_allowed(self, position: int, node: int) -> bool:
        """A locked position takes only its stop, and a locked stop goes only to its position."""
        required = self.locked_at.get(position)
        if required is not None:
            return required == node
        return node not in self.locked_nodes

    def arrival(self, node: int, ready_at: int) -> int | None:
        """Arrival time at `node` when leaving for it at `ready_at`, or None if the visit cannot fit."""
        open_t, close_t = self.windows[node]
        arrive = max(ready_at, open_t)  # waiting for opening is allowed
        depart = arrive + self.stay[node]
        if arrive > close_t or depart > self.closes[node] or depart > self.return_limit:
            return None
        return arrive


# dp[(visited mask, last stop)] = (earliest arrival at last stop, previous stop).
# Keeping only the earliest arrival is safe because waiting is always allowed.
_States = dict[tuple[int, int], tuple[int, int]]


def _held_karp(problem: _TourProblem, timeout_at: float) -> tuple[list[int], list[int]] | None:
    """Exact time-window TSP. Returns (stop order, arrival seconds), or None if infeasible or timed out."""
    if problem.size == 0:
        return ([], [])
    states = _first_visits(problem)
    for mask in range(1, 1 << problem.size):
        if time.monotonic() > timeout_at:
            return None
        _extend(problem, states, mask)
    return _best_tour(problem, states)


def _first_visits(problem: _TourProblem) -> _States:
    states: _States = {}
    for node in range(1, problem.size + 1):
        if not problem.position_allowed(1, node):
            continue
        arrive = problem.arrival(node, problem.travel[0][node])
        if arrive is not None:
            states[(1 << (node - 1), node)] = (arrive, 0)
    return states


def _extend(problem: _TourProblem, states: _States, mask: int) -> None:
    next_position = mask.bit_count() + 1
    for last in range(1, problem.size + 1):
        current = states.get((mask, last))
        if current is None:
            continue
        leave_at = current[0] + problem.stay[last]
        for nxt in range(1, problem.size + 1):
            bit = 1 << (nxt - 1)
            if mask & bit or not problem.position_allowed(next_position, nxt):
                continue
            arrive = problem.arrival(nxt, leave_at + problem.travel[last][nxt])
            if arrive is None:
                continue
            key = (mask | bit, nxt)
            best = states.get(key)
            if best is None or arrive < best[0]:
                states[key] = (arrive, last)


def _best_tour(problem: _TourProblem, states: _States) -> tuple[list[int], list[int]] | None:
    full = (1 << problem.size) - 1
    best: tuple[int, int] | None = None  # (back at start, last stop)
    for last in range(1, problem.size + 1):
        state = states.get((full, last))
        if state is None:
            continue
        back_at = state[0] + problem.stay[last] + problem.travel[last][0]
        if back_at <= problem.return_limit and (best is None or back_at < best[0]):
            best = (back_at, last)
    if best is None:
        return None
    order: list[int] = []
    arrivals: list[int] = []
    mask, last = full, best[1]
    while last != 0:
        arrive, previous = states[(mask, last)]
        order.append(last)
        arrivals.append(arrive)
        mask ^= 1 << (last - 1)
        last = previous
    return order[::-1], arrivals[::-1]


def _simulate(problem: _TourProblem, order: list[int]) -> list[int] | None:
    """Arrival times for a fixed order, or None if that order breaks a constraint."""
    clock = 0
    arrivals: list[int] = []
    previous = 0
    for node in order:
        arrive = problem.arrival(node, clock + problem.travel[previous][node])
        if arrive is None:
            return None
        arrivals.append(arrive)
        clock = arrive + problem.stay[node]
        previous = node
    if clock + problem.travel[previous][0] > problem.return_limit:
        return None
    return arrivals


def _locked_positions(stops: list[OptimizeStop]) -> dict[int, int] | None:
    """Map locked visit positions to stop nodes; None when two stops claim one slot or a slot does not exist."""
    locked_at: dict[int, int] = {}
    for index, stop in enumerate(stops, start=1):
        if not stop.locked:
            continue
        position = stop.position or index
        if position in locked_at or position > len(stops):
            return None
        locked_at[position] = index
    return locked_at


def _travel_seconds(grid: list[list[RouteLeg]]) -> list[list[int]]:
    # A real 0-second leg (two stops at one venue) is valid; only a missing value is unreachable.
    return [[INF if leg.duration_seconds is None else leg.duration_seconds for leg in row] for row in grid]


def optimize_route(
    start_lat: float,
    start_lng: float,
    stops: list[OptimizeStop],
    window_start: datetime,
    return_by: datetime,
    mode: str = "driving",
    plan_id: str = "anon",
    timeout_ms: int = 2000,
    routing: RoutingService | None = None,
) -> OptimizeResult:
    if len(stops) > MAX_OPTIMIZE_STOPS:
        raise ValueError(f"at most {MAX_OPTIMIZE_STOPS} stops can be optimised")
    started = time.monotonic()
    timeout_at = started + min(max(timeout_ms, 50), MAX_SOLVER_TIMEOUT_MS) / 1000.0
    origin = _aware(window_start)
    deadline = _aware(return_by)
    service = routing or RoutingService()

    def infeasible(reason: str, solver: str, *, fallback: bool = False, timeout: bool = False) -> OptimizeResult:
        return _infeasible(reason, solver, fallback, timeout, cost, started, origin, deadline)

    coords = [(start_lat, start_lng)] + [(stop.lat, stop.lng) for stop in stops]
    grid, cost = service.matrix(coords, mode=mode, departure_at=origin, plan_id=plan_id)
    metrics_available = all(leg.available for row in grid for leg in row)
    locked_at = _locked_positions(stops)
    if locked_at is None:
        return infeasible("Locked stops need distinct positions within the plan", "validation")
    problem = _TourProblem(
        travel=_travel_seconds(grid) if metrics_available else _haversine_matrix(coords, mode),
        stay=[0] + [stop.duration_minutes * 60 for stop in stops],
        windows=[(0, INF)]
        + [(_seconds_since(origin, s.window_start, 0), _seconds_since(origin, s.window_end, INF)) for s in stops],
        closes=[INF] + [_seconds_since(origin, stop.closes_at, INF) for stop in stops],
        locked_at=locked_at,
        return_limit=max(int((deadline - origin).total_seconds()), 0),
    )
    solver_name = "held-karp" if metrics_available else "held-karp-internal"
    reason: str | None = None
    solved = _held_karp(problem, timeout_at)
    timeout = solved is None and time.monotonic() > timeout_at
    if solved is not None:
        order, arrivals = solved
    else:
        # Exact search found nothing (or ran out of time): keep the traveller's order if it still works.
        order = list(range(1, len(stops) + 1))
        simulated = _simulate(problem, order)
        if simulated is None:
            if timeout:
                return infeasible(
                    "Solver timed out and the original order is infeasible",
                    "timeout-fallback",
                    fallback=True,
                    timeout=True,
                )
            return infeasible(
                "No feasible sequence honours locked stops, appointment windows, closing times and return-by",
                solver_name,
            )
        arrivals = simulated
        solver_name = "timeout-fallback" if timeout else "deterministic-fallback"
        if not timeout:
            reason = "Optimiser found no improving feasible tour; original order is feasible"
    fallback = solved is None

    if any(order[position - 1] != node for position, node in locked_at.items()):
        return infeasible("Locked stop could not keep its position", solver_name, fallback=fallback, timeout=timeout)

    ordered_stops = _materialize(stops, order, arrivals, origin)
    display_legs, total_distance, total_duration, metrics_ok = _validate_legs(
        service, start_lat, start_lng, ordered_stops, mode, origin, plan_id, metrics_available
    )
    return OptimizeResult(
        feasible=True,
        reason=reason,
        solver=solver_name,
        fallback=fallback,
        timeout=timeout,
        ordered=ordered_stops,
        legs=display_legs,
        total_distance_m=total_distance if metrics_ok else None,
        total_duration_seconds=total_duration if metrics_ok else None,
        metrics_available=metrics_ok,
        routing_cost=cost,
        solve_ms=(time.monotonic() - started) * 1000,
        window_start=origin,
        return_by=deadline,
    )


def _aware(moment: datetime) -> datetime:
    return moment if moment.tzinfo else moment.replace(tzinfo=UTC)


def _materialize(
    stops: list[OptimizeStop],
    order: list[int],
    arrivals: list[int],
    origin: datetime,
) -> list[SolveStop]:
    result: list[SolveStop] = []
    for position, (node, arrive) in enumerate(zip(order, arrivals, strict=True), start=1):
        stop = stops[node - 1]
        arrives = origin + timedelta(seconds=arrive)
        departs = arrives + timedelta(minutes=stop.duration_minutes)
        result.append(
            SolveStop(
                id=stop.id,
                label=stop.label,
                lat=stop.lat,
                lng=stop.lng,
                position=position,
                locked=stop.locked,
                arrives_at=arrives,
                departs_at=departs,
                duration_minutes=stop.duration_minutes,
                weather_sensitivity=stop.weather_sensitivity,
                estimated_minor=stop.estimated_minor,
            )
        )
    return result


def _validate_legs(
    service: RoutingService,
    start_lat: float,
    start_lng: float,
    ordered: list[SolveStop],
    mode: str,
    origin: datetime,
    plan_id: str,
    prior_available: bool,
) -> tuple[list[RouteLeg], int | None, int | None, bool]:
    points = [(start_lat, start_lng)] + [(stop.lat, stop.lng) for stop in ordered] + [(start_lat, start_lng)]
    legs: list[RouteLeg] = []
    available = prior_available
    distance = 0
    duration = 0
    for index in range(len(points) - 1):
        olat, olng = points[index]
        dlat, dlng = points[index + 1]
        leg = service.route(olat, olng, dlat, dlng, mode=mode, departure_at=origin, plan_id=plan_id)
        legs.append(leg)
        if not leg.available or leg.distance_m is None or leg.duration_seconds is None:
            available = False
        else:
            distance += leg.distance_m
            duration += leg.duration_seconds
    if not available:
        for leg in legs:
            if not leg.available:
                continue
            # Displayed metrics must not mix stub numbers into an unavailable provider result.
            if leg.source == "haversine-stub" and service.provider.name == "google":
                leg.available = False
                leg.source = "unavailable"
                leg.distance_m = None
                leg.duration_seconds = None
        return legs, None, None, False
    return legs, distance, duration, True


def _infeasible(
    reason: str,
    solver: str,
    fallback: bool,
    timeout: bool,
    cost: RoutingCost,
    started: float,
    origin: datetime,
    deadline: datetime,
) -> OptimizeResult:
    return OptimizeResult(
        feasible=False,
        reason=reason,
        solver=solver,
        fallback=fallback,
        timeout=timeout,
        ordered=[],
        legs=[],
        total_distance_m=None,
        total_duration_seconds=None,
        metrics_available=False,
        routing_cost=cost,
        solve_ms=(time.monotonic() - started) * 1000,
        window_start=origin,
        return_by=deadline,
    )
