from __future__ import annotations

from functools import lru_cache
from typing import Any, Literal

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

KNOWN_ENVIRONMENTS = frozenset({"development", "test", "staging", "production"})
DEPLOYED_ENVIRONMENTS = frozenset({"staging", "production"})
DEFAULT_SECRET_KEY = "change-me-in-production"  # noqa: S105 - placeholder rejected outside development
DEFAULT_DATABASE_CREDENTIALS = "postgresql+asyncpg://postgres:postgres"
MIN_SECRET_LENGTH = 32


class Settings(BaseSettings):
    # Env vars and .env keys are matched case-insensitively, so the documented
    # UPPERCASE names (ENVIRONMENT, SECRET_KEY, STRIPE_*) are honoured.
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
        populate_by_name=True,
    )

    project_name: str = "Mshwar API"
    version: str = "0.1.0"
    environment: str = "development"
    api_v1_prefix: str = "/api/v1"
    allowed_origins: list[str] = ["http://localhost:3000", "http://localhost:3001"]

    # Database
    database_url: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/mshwar",
        validation_alias=AliasChoices("DATABASE_URL", "database_url"),
    )
    redis_url: str = Field(default="redis://localhost:6379/0", validation_alias=AliasChoices("REDIS_URL", "redis_url"))
    # memory: per-process counters (development, tests). redis: shared across workers (required when deployed).
    rate_limit_store: Literal["memory", "redis"] = Field(
        default="memory",
        validation_alias=AliasChoices("RATE_LIMIT_STORE", "rate_limit_store"),
    )

    # Auth
    secret_key: str = DEFAULT_SECRET_KEY
    session_cookie_name: str = "mshwar_session"
    session_ttl_seconds: int = 60 * 60 * 24 * 7  # 7 days; refresh extends when < half remains
    password_reset_ttl_seconds: int = 30 * 60  # 30 minutes; single-use; revoked on consume
    password_reset_min_ms: int = 80
    forgot_ip_limit: int = 20
    forgot_email_limit: int = 5
    rate_limit_window_seconds: int = 3600
    mailer_backend: str = "console"  # console | smtp | notification
    public_web_origin: str = "http://localhost:3000"
    email_verification_ttl_seconds: int = 24 * 60 * 60
    verify_ip_limit: int = 20
    verify_email_limit: int = 3
    signin_ip_limit: int = 100
    signin_email_limit: int = 10
    signin_window_seconds: int = 15 * 60
    register_ip_limit: int = 30
    # Number of reverse proxies in front of the API (e.g. the Next.js rewrite).
    # 0 means X-Forwarded-For is ignored and the socket address is used.
    trusted_proxy_count: int = 0

    # Internal jobs (cron / workers). Sent as the X-Job-Token header.
    internal_job_token: str = Field(
        default="",
        validation_alias=AliasChoices("INTERNAL_JOB_TOKEN", "internal_job_token"),
    )
    # Test-only endpoints (payment simulation, fault injection). Never in staging/production.
    enable_dev_endpoints: bool = Field(
        default=False,
        validation_alias=AliasChoices("ENABLE_DEV_ENDPOINTS", "enable_dev_endpoints"),
    )

    # Connection pool
    pool_size: int = 20
    max_overflow: int = 10
    pool_recycle: int = 1800
    pool_pre_ping: bool = True
    connect_timeout: int = 10
    statement_timeout_ms: int = 30000
    sql_echo: bool = Field(default=False, validation_alias=AliasChoices("SQL_ECHO", "sql_echo"))

    # Logging
    log_level: str = "INFO"
    log_format: str = "json"

    # External services
    google_maps_api_key: str = ""
    catalogue_embedding_provider: str = "stub"
    catalogue_routing_provider: str = "auto"
    routing_time_bucket_minutes: int = 15
    routing_cache_ttl_seconds: int = 6 * 60 * 60
    routing_plan_budget_usd: float = 0.5
    weather_provider: str = "stub"
    weather_cache_ttl_seconds: int = 60 * 60
    weather_precip_mm_threshold: float = 5.0
    weather_precip_mm_sensitive_threshold: float = 2.0
    weather_wind_kmh_threshold: float = 45.0
    weather_wind_kmh_sensitive_threshold: float = 30.0
    weather_temp_max_c_threshold: float = 38.0
    weather_temp_min_c_threshold: float = 4.0
    openai_api_key: str = Field(
        default="",
        validation_alias=AliasChoices("OPENAI_API_KEY", "openai_api_key"),
    )
    planner_llm_provider: str = Field(
        default="stub",
        validation_alias=AliasChoices("PLANNER_LLM_PROVIDER", "planner_llm_provider"),
    )
    planner_llm_max_attempts: int = Field(
        default=2,
        validation_alias=AliasChoices("PLANNER_LLM_MAX_ATTEMPTS", "planner_llm_max_attempts"),
    )
    planner_llm_timeout_seconds: float = Field(
        default=8.0,
        validation_alias=AliasChoices("PLANNER_LLM_TIMEOUT_SECONDS", "planner_llm_timeout_seconds"),
    )
    planner_circuit_threshold: int = Field(
        default=3,
        validation_alias=AliasChoices("PLANNER_CIRCUIT_THRESHOLD", "planner_circuit_threshold"),
    )
    planner_circuit_reset_seconds: float = Field(
        default=60.0,
        validation_alias=AliasChoices("PLANNER_CIRCUIT_RESET_SECONDS", "planner_circuit_reset_seconds"),
    )
    planner_fault_inject: str = Field(
        default="",
        validation_alias=AliasChoices("PLANNER_FAULT_INJECT", "planner_fault_inject"),
    )
    open_meteo_api_key: str = ""
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    payment_provider: str = Field(
        default="stripe_test",
        validation_alias=AliasChoices("PAYMENT_PROVIDER", "payment_provider"),
    )
    payments_fault: str = Field(
        default="",
        validation_alias=AliasChoices("PAYMENTS_FAULT", "payments_fault"),
    )
    idempotency_ttl_hours: int = Field(
        default=24,
        validation_alias=AliasChoices("IDEMPOTENCY_TTL_HOURS", "idempotency_ttl_hours"),
    )
    imagekit_api_key: str = Field(
        default="", validation_alias=AliasChoices("IMAGEKIT_PRIVATE_KEY", "IMAGEKIT_API_KEY", "imagekit_api_key")
    )
    imagekit_url: str = Field(
        default="", validation_alias=AliasChoices("IMAGEKIT_URL_ENDPOINT", "IMAGEKIT_URL", "imagekit_url")
    )
    private_storage_dir: str = "/tmp/mshwar-private"  # noqa: S108 - dev default; production must override
    max_upload_bytes: int = 10 * 1024 * 1024
    # Per organisation: uploads per hour and total stored bytes.
    upload_org_hourly_limit: int = 60
    upload_org_quota_bytes: int = 500 * 1024 * 1024
    max_image_pixels: int = 40_000_000
    max_images_per_experience: int = 20
    signed_url_ttl_seconds: int = 15 * 60
    staff_invite_ttl_seconds: int = 7 * 24 * 60 * 60
    search_reindex_provider: str = Field(
        default="stub",
        validation_alias=AliasChoices("SEARCH_REINDEX_PROVIDER", "search_reindex_provider"),
    )
    data_quality_scheduler_enabled: bool = Field(
        default=False,
        validation_alias=AliasChoices("DATA_QUALITY_SCHEDULER_ENABLED", "data_quality_scheduler_enabled"),
    )
    data_quality_stale_days: int = Field(
        default=14,
        validation_alias=AliasChoices("DATA_QUALITY_STALE_DAYS", "data_quality_stale_days"),
    )
    smtp_host: str = Field(default="", validation_alias=AliasChoices("SMTP_HOST", "smtp_host"))
    smtp_port: int = Field(default=587, validation_alias=AliasChoices("SMTP_PORT", "smtp_port"))
    smtp_username: str = Field(default="", validation_alias=AliasChoices("SMTP_USERNAME", "smtp_username"))
    smtp_password: str = Field(default="", validation_alias=AliasChoices("SMTP_PASSWORD", "smtp_password"))
    smtp_from: str = Field(
        default="noreply@mshwar.local",
        validation_alias=AliasChoices("SMTP_FROM", "smtp_from"),
    )
    sendgrid_api_key: str = Field(default="", validation_alias=AliasChoices("SENDGRID_API_KEY", "sendgrid_api_key"))
    notification_max_attempts: int = Field(
        default=8,
        validation_alias=AliasChoices("NOTIFICATION_MAX_ATTEMPTS", "notification_max_attempts"),
    )
    notification_dispatch_token: str = Field(
        default="",
        validation_alias=AliasChoices("NOTIFICATION_DISPATCH_TOKEN", "notification_dispatch_token"),
    )
    notification_worker_batch_size: int = Field(
        default=25,
        validation_alias=AliasChoices("NOTIFICATION_WORKER_BATCH_SIZE", "notification_worker_batch_size"),
    )

    # AI generation cost ceilings (MSHWAR-110). Each planner generation call is
    # charged ai_request_cost_usd against the caller's day (Asia/Beirut) and the
    # platform's day; 0 disables a ceiling.
    ai_request_cost_usd: float = 0.01
    ai_user_daily_budget_usd: float = 0.25
    ai_global_daily_budget_usd: float = 50.0

    # Monitoring
    sentry_dsn: str = Field(default="", validation_alias=AliasChoices("SENTRY_DSN", "sentry_dsn"))
    sentry_traces_sample_rate: float = 0.0
    release: str = Field(default="", validation_alias=AliasChoices("RELEASE", "GIT_SHA", "release"))
    # uvicorn access log lines carry URL paths; tokens in them are masked by the scrubber.
    access_log: bool = True

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def is_staging(self) -> bool:
        return self.environment == "staging"

    @property
    def is_development(self) -> bool:
        return self.environment == "development"

    @property
    def is_deployed(self) -> bool:
        """Staging and production: real users, HTTPS, no test shortcuts."""
        return self.environment in DEPLOYED_ENVIRONMENTS

    @property
    def dev_endpoints_enabled(self) -> bool:
        return self.enable_dev_endpoints and not self.is_deployed

    @property
    def job_token(self) -> str:
        return self.internal_job_token or self.notification_dispatch_token

    def model_post_init(self, __context: Any, /) -> None:
        self._validate_for_environment()

    def _validate_for_environment(self) -> None:
        if self.environment not in KNOWN_ENVIRONMENTS:
            raise ValueError(f"ENVIRONMENT must be one of {sorted(KNOWN_ENVIRONMENTS)}")
        if self.is_deployed:
            self._validate_deployed()
        if self.is_production:
            self._validate_production()

    def _validate_deployed(self) -> None:
        """Staging and production: no default secrets and no test shortcuts."""
        if self.secret_key == DEFAULT_SECRET_KEY or len(self.secret_key) < MIN_SECRET_LENGTH:
            raise ValueError(f"{self.environment} SECRET_KEY must be set (at least {MIN_SECRET_LENGTH} characters)")
        if self.enable_dev_endpoints:
            raise ValueError(f"ENABLE_DEV_ENDPOINTS must be false in {self.environment}")
        if len(self.job_token) < MIN_SECRET_LENGTH:
            raise ValueError(
                f"{self.environment} INTERNAL_JOB_TOKEN must be set (at least {MIN_SECRET_LENGTH} characters)"
            )
        if self.rate_limit_store != "redis":
            raise ValueError(f"{self.environment} needs RATE_LIMIT_STORE=redis so limits hold across workers")
        if not self.public_web_origin.startswith("https://") or "localhost" in self.public_web_origin:
            # The cross-site request guard trusts this origin for cookie-carrying writes.
            raise ValueError(f"{self.environment} PUBLIC_WEB_ORIGIN must be the site's https:// origin")
        if self.sql_echo:
            raise ValueError(f"SQL_ECHO logs query parameters (personal data) and must be off in {self.environment}")

    def _validate_production(self) -> None:
        if self.database_url.startswith(DEFAULT_DATABASE_CREDENTIALS):
            raise ValueError("Production DATABASE_URL must not use default credentials")
        if not self.google_maps_api_key:
            raise ValueError("Production GOOGLE_MAPS_API_KEY must be set")
        if self.payment_provider != "stripe_test" or not self.stripe_secret_key or not self.stripe_webhook_secret:
            raise ValueError(
                "Production needs a real payment provider: PAYMENT_PROVIDER=stripe_test with "
                "STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET (stub providers are not allowed)"
            )
        if self.payments_fault or self.planner_fault_inject:
            raise ValueError("Fault injection must be disabled in production")
        if self.private_storage_dir.startswith("/tmp"):  # noqa: S108 - rejecting temp dirs, not using one
            raise ValueError("Production PRIVATE_STORAGE_DIR must be a persistent directory")

    @property
    def database_url_public(self) -> str:
        """Return database URL with credentials stripped for logging."""
        if self.is_production and "@" in self.database_url:
            scheme, rest = self.database_url.split("://", 1)
            _, rest = rest.split("@", 1)
            return f"{scheme}://***:***@{rest}"
        return self.database_url

    @property
    def sentry_dsn_public(self) -> str:
        """Return Sentry DSN with key stripped for logging."""
        if self.sentry_dsn and self.is_production and "@" in self.sentry_dsn:
            scheme, rest = self.sentry_dsn.split("://", 1)
            _, rest = rest.split("@", 1)
            return f"{scheme}://***@{rest}"
        return self.sentry_dsn


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
