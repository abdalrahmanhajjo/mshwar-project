SET search_path = app, public;

-- ============================================================
-- Migration 020: Notifications & messaging (Epic 10, MSHWAR-93–97)
-- Outbox-driven delivery, consent isolation, retry/DLQ, admin health.
-- Failed delivery never writes bookings or payments.
-- ============================================================

-- ---- columns ---------------------------------------------------------

ALTER TABLE app.outbox
    ADD COLUMN IF NOT EXISTS dead_lettered_at timestamptz;

ALTER TABLE app.notifications
    ADD COLUMN IF NOT EXISTS event_type text,
    ADD COLUMN IF NOT EXISTS title text,
    ADD COLUMN IF NOT EXISTS body text,
    ADD COLUMN IF NOT EXISTS deep_link text,
    ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'en',
    ADD COLUMN IF NOT EXISTS next_retry_at timestamptz NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS dead_lettered_at timestamptz,
    ADD COLUMN IF NOT EXISTS last_error_code text,
    ADD COLUMN IF NOT EXISTS last_error text,
    ADD COLUMN IF NOT EXISTS feed_id uuid,
    ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE app.account_notifications
    ADD COLUMN IF NOT EXISTS deep_link text,
    ADD COLUMN IF NOT EXISTS event_type text,
    ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'en';

ALTER TABLE app.user_private
    ADD COLUMN IF NOT EXISTS unsubscribe_token text,
    ADD COLUMN IF NOT EXISTS transactional_email boolean NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS marketing_in_app boolean NOT NULL DEFAULT false;

UPDATE app.user_private
SET unsubscribe_token = replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
WHERE unsubscribe_token IS NULL;

ALTER TABLE app.user_private
    ALTER COLUMN unsubscribe_token SET DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');

CREATE UNIQUE INDEX IF NOT EXISTS user_private_unsubscribe_token_uidx
    ON app.user_private (unsubscribe_token);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'notifications_locale_check'
          AND conrelid = 'app.notifications'::regclass
    ) THEN
        ALTER TABLE app.notifications
            ADD CONSTRAINT notifications_locale_check CHECK (locale IN ('ar', 'en', 'fr'));
    END IF;
END $$;

-- ---- tables ----------------------------------------------------------

CREATE TABLE IF NOT EXISTS app.notification_attempts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id uuid NOT NULL REFERENCES app.notifications(id) ON DELETE CASCADE,
    channel text NOT NULL CHECK (channel IN ('email', 'in_app')),
    attempt_no integer NOT NULL CHECK (attempt_no > 0),
    outcome text NOT NULL CHECK (outcome IN ('sent', 'failed', 'suppressed', 'stubbed')),
    error_code text,
    error_message text,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (notification_id, attempt_no)
);

CREATE TABLE IF NOT EXISTS app.notification_role_prefs (
    organization_id uuid NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
    role text NOT NULL CHECK (role IN ('owner', 'manager', 'inventory', 'bookings', 'finance')),
    event_type text NOT NULL,
    email_enabled boolean NOT NULL DEFAULT true,
    in_app_enabled boolean NOT NULL DEFAULT true,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (organization_id, role, event_type)
);

CREATE TABLE IF NOT EXISTS app.notification_org_settings (
    organization_id uuid PRIMARY KEY REFERENCES app.organizations(id) ON DELETE CASCADE,
    escalation_first_minutes integer NOT NULL DEFAULT 30 CHECK (escalation_first_minutes >= 1),
    escalation_repeat_minutes integer NOT NULL DEFAULT 60 CHECK (escalation_repeat_minutes >= 1),
    escalation_max integer NOT NULL DEFAULT 3 CHECK (escalation_max >= 1 AND escalation_max <= 20),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.notification_templates (
    event_type text NOT NULL,
    locale text NOT NULL CHECK (locale IN ('ar', 'en', 'fr')),
    audience text NOT NULL CHECK (audience IN ('traveller', 'business')),
    title text NOT NULL,
    body text NOT NULL,
    PRIMARY KEY (event_type, locale, audience)
);

CREATE TABLE IF NOT EXISTS app.notification_escalations (
    booking_id uuid NOT NULL REFERENCES app.bookings(id) ON DELETE CASCADE,
    escalation_no integer NOT NULL CHECK (escalation_no > 0),
    notified_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (booking_id, escalation_no)
);

CREATE INDEX IF NOT EXISTS notifications_pending_retry_idx
    ON app.notifications (next_retry_at, created_at)
    WHERE status IN ('pending', 'failed') AND dead_lettered_at IS NULL;

CREATE INDEX IF NOT EXISTS notifications_user_created_idx
    ON app.notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS notification_attempts_notification_idx
    ON app.notification_attempts (notification_id, created_at DESC);

ALTER TABLE app.notification_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.notification_attempts FORCE ROW LEVEL SECURITY;
ALTER TABLE app.notification_role_prefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.notification_role_prefs FORCE ROW LEVEL SECURITY;
ALTER TABLE app.notification_org_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.notification_org_settings FORCE ROW LEVEL SECURITY;
ALTER TABLE app.notification_escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.notification_escalations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notification_attempts_backend ON app.notification_attempts;
CREATE POLICY notification_attempts_backend ON app.notification_attempts
    FOR ALL TO mshwar_backend USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS notification_role_prefs_backend ON app.notification_role_prefs;
CREATE POLICY notification_role_prefs_backend ON app.notification_role_prefs
    FOR ALL TO mshwar_backend USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS notification_org_settings_backend ON app.notification_org_settings;
CREATE POLICY notification_org_settings_backend ON app.notification_org_settings
    FOR ALL TO mshwar_backend USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS notification_escalations_backend ON app.notification_escalations;
CREATE POLICY notification_escalations_backend ON app.notification_escalations
    FOR ALL TO mshwar_backend USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON app.notification_attempts, app.notification_role_prefs,
    app.notification_org_settings, app.notification_escalations TO mshwar_backend;
GRANT SELECT ON app.notification_attempts, app.notification_role_prefs,
    app.notification_org_settings, app.notification_templates, app.notification_escalations TO mshwar_reader;
GRANT SELECT ON app.notification_templates TO mshwar_backend;

-- ---- templates (three languages) ------------------------------------

INSERT INTO app.notification_templates (event_type, locale, audience, title, body) VALUES
    ('booking.requested', 'en', 'traveller', 'Booking requested', 'Your booking request was received. Open it: {deep_link}'),
    ('booking.requested', 'ar', 'traveller', 'تم طلب الحجز', 'تم استلام طلب حجزك. افتحه: {deep_link}'),
    ('booking.requested', 'fr', 'traveller', 'Réservation demandée', 'Votre demande a été reçue. Ouvrez-la : {deep_link}'),
    ('booking.confirmed', 'en', 'traveller', 'Booking confirmed', 'Your booking is confirmed. Details: {deep_link}'),
    ('booking.confirmed', 'ar', 'traveller', 'تم تأكيد الحجز', 'تم تأكيد حجزك. التفاصيل: {deep_link}'),
    ('booking.confirmed', 'fr', 'traveller', 'Réservation confirmée', 'Votre réservation est confirmée. Détails : {deep_link}'),
    ('booking.rejected', 'en', 'traveller', 'Booking rejected', 'Your booking request was rejected. See why: {deep_link}'),
    ('booking.rejected', 'ar', 'traveller', 'تم رفض الحجز', 'تم رفض طلب حجزك. راجع السبب: {deep_link}'),
    ('booking.rejected', 'fr', 'traveller', 'Réservation refusée', 'Votre demande a été refusée. Voir : {deep_link}'),
    ('booking.cancelled', 'en', 'traveller', 'Booking cancelled', 'Your booking was cancelled. The record stays on your account: {deep_link}'),
    ('booking.cancelled', 'ar', 'traveller', 'تم إلغاء الحجز', 'تم إلغاء حجزك. يبقى السجل في حسابك: {deep_link}'),
    ('booking.cancelled', 'fr', 'traveller', 'Réservation annulée', 'Votre réservation a été annulée. Le dossier reste sur le compte : {deep_link}'),
    ('payment.status_changed', 'en', 'traveller', 'Payment update', 'Payment status is now {status}. Open the booking: {deep_link}'),
    ('payment.status_changed', 'ar', 'traveller', 'تحديث الدفع', 'حالة الدفع أصبحت {status}. افتح الحجز: {deep_link}'),
    ('payment.status_changed', 'fr', 'traveller', 'Mise à jour du paiement', 'Le paiement est maintenant {status}. Ouvrir : {deep_link}'),
    ('itinerary.material_change', 'en', 'traveller', 'Itinerary changed', 'A material change was made to your trip. Review it: {deep_link}'),
    ('itinerary.material_change', 'ar', 'traveller', 'تغيّر في البرنامج', 'تم تطبيق تغيير جوهري على رحلتك. راجعه: {deep_link}'),
    ('itinerary.material_change', 'fr', 'traveller', 'Itinéraire modifié', 'Un changement matériel a été appliqué. Vérifiez : {deep_link}'),
    ('business.booking.requested', 'en', 'business', 'New booking request', 'A traveller requested a booking. Respond now: {deep_link}'),
    ('business.booking.requested', 'ar', 'business', 'طلب حجز جديد', 'طلب مسافر حجزاً. رد الآن: {deep_link}'),
    ('business.booking.requested', 'fr', 'business', 'Nouvelle demande', 'Un voyageur a demandé une réservation. Répondre : {deep_link}'),
    ('business.request.unanswered', 'en', 'business', 'Unanswered booking request', 'A booking request is still waiting. Respond: {deep_link}'),
    ('business.request.unanswered', 'ar', 'business', 'طلب حجز بلا رد', 'ما زال طلب حجز بانتظار ردك: {deep_link}'),
    ('business.request.unanswered', 'fr', 'business', 'Demande sans réponse', 'Une demande attend toujours. Répondre : {deep_link}'),
    ('marketing.campaign', 'en', 'traveller', 'Mshwar update', '{body} Unsubscribe: {unsubscribe_link}'),
    ('marketing.campaign', 'ar', 'traveller', 'تحديث مشوار', '{body} إلغاء الاشتراك: {unsubscribe_link}'),
    ('marketing.campaign', 'fr', 'traveller', 'Actualité Mshwar', '{body} Se désabonner : {unsubscribe_link}')
ON CONFLICT (event_type, locale, audience) DO UPDATE
SET title = EXCLUDED.title, body = EXCLUDED.body;

-- ---- helpers ---------------------------------------------------------

CREATE OR REPLACE FUNCTION app.notification_event_audience(p_event text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE
        WHEN p_event LIKE 'business.%' THEN 'business'
        ELSE 'traveller'
    END
$$;

CREATE OR REPLACE FUNCTION app.notification_event_category(p_event text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE WHEN p_event LIKE 'marketing.%' THEN 'marketing' ELSE 'transactional' END
$$;

CREATE OR REPLACE FUNCTION app.notification_deep_link(p_event text, p_payload jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE
        WHEN p_event LIKE 'business.%' THEN
            '/business/bookings?highlight=' || coalesce(p_payload->>'booking_id', p_payload->>'aggregate_id', '')
        WHEN p_event = 'itinerary.material_change' THEN
            '/trips?highlight=' || coalesce(p_payload->>'trip_id', p_payload->>'aggregate_id', '')
        ELSE
            '/bookings?highlight=' || coalesce(p_payload->>'booking_id', p_payload->>'aggregate_id', '')
    END
$$;

CREATE OR REPLACE FUNCTION app.notification_unsubscribe_link(p_token text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT '/unsubscribe/' || coalesce(p_token, '')
$$;

CREATE OR REPLACE FUNCTION app.render_notification_template(
    p_event text,
    p_locale text,
    p_audience text,
    p_payload jsonb,
    p_unsubscribe text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = app, public
AS $$
DECLARE
    v_row app.notification_templates;
    v_locale text := CASE WHEN p_locale IN ('ar', 'en', 'fr') THEN p_locale ELSE 'en' END;
    v_title text;
    v_body text;
    v_link text := app.notification_deep_link(p_event, p_payload);
    v_status text := coalesce(p_payload->>'status', p_payload->>'payment_status', '');
    v_custom text := coalesce(p_payload->>'body', '');
BEGIN
    SELECT * INTO v_row
    FROM app.notification_templates
    WHERE event_type = p_event AND locale = v_locale AND audience = p_audience;
    IF NOT FOUND THEN
        SELECT * INTO v_row
        FROM app.notification_templates
        WHERE event_type = p_event AND locale = 'en' AND audience = p_audience;
    END IF;
    IF NOT FOUND THEN
        v_title := replace(p_event, '.', ' ');
        v_body := coalesce(p_payload->>'body', p_event);
    ELSE
        v_title := v_row.title;
        v_body := v_row.body;
    END IF;
    v_title := replace(replace(replace(v_title, '{deep_link}', v_link), '{status}', v_status), '{body}', v_custom);
    v_body := replace(replace(replace(replace(v_body, '{deep_link}', v_link), '{status}', v_status), '{body}', v_custom), '{unsubscribe_link}', coalesce(p_unsubscribe, ''));
    IF p_audience = 'traveller' AND p_payload ? 'title' THEN
        v_title := p_payload->>'title';
    END IF;
    RETURN jsonb_build_object('title', v_title, 'body', v_body, 'deep_link', v_link, 'locale', v_locale);
END;
$$;

CREATE OR REPLACE FUNCTION app.ensure_unsubscribe_token(p_user uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_token text;
BEGIN
    UPDATE app.user_private
    SET unsubscribe_token = coalesce(
        unsubscribe_token,
        replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
    )
    WHERE user_id = p_user
    RETURNING unsubscribe_token INTO v_token;
    RETURN v_token;
END;
$$;

CREATE OR REPLACE FUNCTION app.role_channel_enabled(
    p_org uuid,
    p_role text,
    p_event text,
    p_channel text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = app, public
AS $$
DECLARE
    v_email boolean;
    v_in_app boolean;
BEGIN
    SELECT email_enabled, in_app_enabled
    INTO v_email, v_in_app
    FROM app.notification_role_prefs
    WHERE organization_id = p_org AND role = p_role AND event_type = p_event;
    IF NOT FOUND THEN
        -- Defaults: booking-facing roles get both channels; others in-app only.
        IF p_role IN ('owner', 'manager', 'bookings') THEN
            RETURN true;
        END IF;
        RETURN p_channel = 'in_app';
    END IF;
    IF p_channel = 'email' THEN
        RETURN v_email;
    END IF;
    RETURN v_in_app;
END;
$$;

CREATE OR REPLACE FUNCTION app.notification_recipients(
    p_event text,
    p_user uuid,
    p_org uuid,
    p_payload jsonb
)
RETURNS TABLE (user_id uuid, role text)
LANGUAGE plpgsql
STABLE
SET search_path = app, public
AS $$
BEGIN
    IF app.notification_event_audience(p_event) = 'traveller' THEN
        IF p_user IS NULL THEN
            RAISE EXCEPTION 'recipient required' USING ERRCODE = '22023';
        END IF;
        RETURN QUERY SELECT p_user, NULL::text;
        RETURN;
    END IF;
    IF p_org IS NULL THEN
        RAISE EXCEPTION 'organisation required' USING ERRCODE = '22023';
    END IF;
    RETURN QUERY
        SELECT m.user_id, m.role
        FROM app.organization_members m
        WHERE m.organization_id = p_org
          AND m.active
          AND (
              app.role_channel_enabled(p_org, m.role, p_event, 'email')
              OR app.role_channel_enabled(p_org, m.role, p_event, 'in_app')
          );
END;
$$;

CREATE OR REPLACE FUNCTION app.enqueue_user_notification(
    p_user uuid,
    p_event text,
    p_aggregate uuid,
    p_dedupe text,
    p_payload jsonb,
    p_channel text,
    p_category text,
    p_rendered jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_outbox uuid;
    v_note uuid;
    v_feed uuid;
    v_existing_status text;
    v_locale text := coalesce(p_rendered->>'locale', 'en');
    v_title text := coalesce(p_rendered->>'title', p_event);
    v_body text := coalesce(p_rendered->>'body', p_event);
    v_link text := p_rendered->>'deep_link';
    v_consent boolean;
BEGIN
    INSERT INTO app.outbox (event_type, aggregate_id, dedupe_key, payload)
    VALUES (p_event, p_aggregate, p_dedupe, coalesce(p_payload, '{}'::jsonb))
    ON CONFLICT (dedupe_key) DO UPDATE SET payload = EXCLUDED.payload
    RETURNING id INTO v_outbox;

    INSERT INTO app.notifications (
        user_id, outbox_id, channel, category, event_type, title, body, deep_link, locale, status
    )
    VALUES (
        p_user, v_outbox, p_channel, p_category, p_event, v_title, v_body, v_link, v_locale, 'pending'
    )
    ON CONFLICT (user_id, outbox_id, channel) DO UPDATE
        SET title = EXCLUDED.title,
            body = EXCLUDED.body,
            deep_link = EXCLUDED.deep_link,
            locale = EXCLUDED.locale,
            event_type = EXCLUDED.event_type
    RETURNING id, status, feed_id INTO v_note, v_existing_status, v_feed;

    IF v_existing_status IN ('sent', 'suppressed') AND v_feed IS NOT NULL THEN
        RETURN v_note;
    END IF;
    IF v_existing_status = 'sent' AND p_channel = 'email' THEN
        RETURN v_note;
    END IF;

    IF p_category = 'marketing' THEN
        SELECT marketing_consent INTO v_consent FROM app.user_private WHERE user_id = p_user;
        IF coalesce(v_consent, false) IS NOT TRUE THEN
            UPDATE app.notifications
            SET status = 'suppressed', last_error_code = 'marketing_opt_out'
            WHERE id = v_note AND status = 'pending';
            INSERT INTO app.notification_attempts (notification_id, channel, attempt_no, outcome, error_code)
            VALUES (v_note, p_channel, 1, 'suppressed', 'marketing_opt_out')
            ON CONFLICT (notification_id, attempt_no) DO NOTHING;
            RETURN v_note;
        END IF;
    END IF;

    -- In-app store is written with the event (persistence, not a provider call).
    IF p_channel = 'in_app' THEN
        INSERT INTO app.account_notifications (user_id, title, body, category, deep_link, event_type, locale)
        VALUES (p_user, v_title, v_body, p_category, v_link, p_event, v_locale)
        RETURNING id INTO v_feed;
        UPDATE app.notifications
        SET feed_id = v_feed, status = 'sent', attempts = 1
        WHERE id = v_note AND status = 'pending';
        INSERT INTO app.notification_attempts (notification_id, channel, attempt_no, outcome)
        VALUES (v_note, 'in_app', 1, 'sent')
        ON CONFLICT (notification_id, attempt_no) DO NOTHING;
    END IF;
    RETURN v_note;
END;
$$;

CREATE OR REPLACE FUNCTION app.emit_notification_event(
    p_event text,
    p_aggregate uuid,
    p_user uuid,
    p_org uuid,
    p_payload jsonb DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_category text := app.notification_event_category(p_event);
    v_audience text := app.notification_event_audience(p_event);
    v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
    v_ids uuid[] := ARRAY[]::uuid[];
    v_rec record;
    v_user app.users;
    v_priv app.user_private;
    v_rendered jsonb;
    v_unsub text;
    v_dedupe text;
    v_id uuid;
    v_channels text[];
    v_channel text;
BEGIN
    IF p_event IS NULL OR length(btrim(p_event)) < 3 THEN
        RAISE EXCEPTION 'event type required' USING ERRCODE = '22023';
    END IF;
    IF p_aggregate IS NULL THEN
        RAISE EXCEPTION 'aggregate required' USING ERRCODE = '22023';
    END IF;
    v_payload := v_payload || jsonb_build_object('aggregate_id', p_aggregate, 'event_type', p_event);
    IF p_payload ? 'booking_id' THEN
        NULL;
    ELSIF p_event LIKE 'booking.%' OR p_event LIKE 'business.%' OR p_event LIKE 'payment.%' THEN
        v_payload := v_payload || jsonb_build_object('booking_id', p_aggregate);
    END IF;

    FOR v_rec IN SELECT * FROM app.notification_recipients(p_event, p_user, p_org, v_payload)
    LOOP
        SELECT * INTO v_user FROM app.users WHERE id = v_rec.user_id;
        IF NOT FOUND OR v_user.status <> 'active' THEN
            CONTINUE;
        END IF;
        SELECT * INTO v_priv FROM app.user_private WHERE user_id = v_rec.user_id;
        v_unsub := app.notification_unsubscribe_link(app.ensure_unsubscribe_token(v_rec.user_id));
        v_rendered := app.render_notification_template(p_event, v_user.locale, v_audience, v_payload, v_unsub);
        IF v_audience = 'business' AND v_rec.role IS NOT NULL THEN
            v_channels := ARRAY[]::text[];
            IF app.role_channel_enabled(p_org, v_rec.role, p_event, 'in_app') THEN
                v_channels := array_append(v_channels, 'in_app');
            END IF;
            IF app.role_channel_enabled(p_org, v_rec.role, p_event, 'email') THEN
                v_channels := array_append(v_channels, 'email');
            END IF;
        ELSE
            v_channels := ARRAY['in_app', 'email'];
        END IF;
        FOREACH v_channel IN ARRAY v_channels
        LOOP
            v_dedupe := p_event || ':' || p_aggregate::text || ':' || v_rec.user_id::text || ':' || v_channel;
            v_id := app.enqueue_user_notification(
                v_rec.user_id, p_event, p_aggregate, v_dedupe, v_payload, v_channel, v_category, v_rendered
            );
            v_ids := v_ids || v_id;
        END LOOP;
    END LOOP;

    RETURN jsonb_build_object('event_type', p_event, 'aggregate_id', p_aggregate, 'notification_ids', to_jsonb(v_ids));
END;
$$;

CREATE OR REPLACE FUNCTION app.enqueue_notification(
    p_user uuid,
    p_event_type text,
    p_aggregate uuid,
    p_dedupe text,
    p_payload jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_result jsonb;
    v_org uuid;
BEGIN
    v_org := NULLIF(p_payload->>'organization_id', '')::uuid;
    v_result := app.emit_notification_event(p_event_type, p_aggregate, p_user, v_org, coalesce(p_payload, '{}'::jsonb));
    RETURN p_aggregate;
END;
$$;

-- ---- claim / delivery recording -------------------------------------

CREATE OR REPLACE FUNCTION app.claim_notification_batch(p_limit integer DEFAULT 25)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_ids uuid[];
BEGIN
    WITH claimed AS (
        SELECT n.id
        FROM app.notifications n
        WHERE n.channel = 'email'
          AND n.status IN ('pending', 'failed')
          AND n.dead_lettered_at IS NULL
          AND n.next_retry_at <= now()
        ORDER BY n.next_retry_at, n.created_at
        LIMIT GREATEST(coalesce(p_limit, 25), 1)
        FOR UPDATE SKIP LOCKED
    )
    SELECT coalesce(array_agg(id), ARRAY[]::uuid[]) INTO v_ids FROM claimed;

    RETURN coalesce((
        SELECT jsonb_agg(jsonb_build_object(
            'id', n.id,
            'user_id', n.user_id,
            'outbox_id', n.outbox_id,
            'channel', n.channel,
            'category', n.category,
            'event_type', n.event_type,
            'title', n.title,
            'body', n.body,
            'deep_link', n.deep_link,
            'locale', n.locale,
            'attempts', n.attempts,
            'email', p.email,
            'display_name', u.display_name,
            'unsubscribe_token', p.unsubscribe_token,
            'marketing_consent', p.marketing_consent,
            'transactional_email', p.transactional_email
        ))
        FROM app.notifications n
        JOIN app.users u ON u.id = n.user_id
        LEFT JOIN app.user_private p ON p.user_id = n.user_id
        WHERE n.id = ANY (v_ids)
    ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION app.record_notification_delivery(
    p_notification uuid,
    p_outcome text,
    p_error_code text DEFAULT NULL,
    p_error_message text DEFAULT NULL,
    p_max_attempts integer DEFAULT 8
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    n app.notifications;
    v_attempt integer;
    v_delay interval;
    v_dead boolean := false;
BEGIN
    SELECT * INTO n FROM app.notifications WHERE id = p_notification FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'notification not found' USING ERRCODE = 'P0002';
    END IF;
    -- Delivery records never touch booking or payment rows.
    v_attempt := n.attempts + 1;
    INSERT INTO app.notification_attempts (notification_id, channel, attempt_no, outcome, error_code, error_message)
    VALUES (p_notification, n.channel, v_attempt, p_outcome, p_error_code, left(p_error_message, 500));

    IF p_outcome IN ('sent', 'stubbed', 'suppressed') THEN
        UPDATE app.notifications
        SET status = CASE WHEN p_outcome = 'suppressed' THEN 'suppressed' ELSE 'sent' END,
            attempts = v_attempt,
            last_error_code = p_error_code,
            last_error = p_error_message,
            dead_lettered_at = NULL
        WHERE id = p_notification;
        UPDATE app.outbox o
        SET processed_at = coalesce(o.processed_at, now()),
            attempts = o.attempts + 1,
            last_error_code = NULL
        WHERE o.id = n.outbox_id
          AND NOT EXISTS (
              SELECT 1 FROM app.notifications x
              WHERE x.outbox_id = n.outbox_id
                AND x.status IN ('pending', 'failed')
                AND x.dead_lettered_at IS NULL
                AND x.id <> p_notification
          );
    ELSE
        v_dead := v_attempt >= GREATEST(coalesce(p_max_attempts, 8), 1);
        v_delay := make_interval(mins => least(power(2, greatest(v_attempt - 1, 0))::integer, 1440));
        UPDATE app.notifications
        SET status = CASE WHEN v_dead THEN 'failed' ELSE 'failed' END,
            attempts = v_attempt,
            last_error_code = p_error_code,
            last_error = p_error_message,
            next_retry_at = CASE WHEN v_dead THEN next_retry_at ELSE now() + v_delay END,
            dead_lettered_at = CASE WHEN v_dead THEN now() ELSE NULL END
        WHERE id = p_notification;
        UPDATE app.outbox
        SET attempts = attempts + 1,
            last_error_code = p_error_code,
            available_at = CASE WHEN v_dead THEN available_at ELSE now() + v_delay END,
            dead_lettered_at = CASE WHEN v_dead THEN now() ELSE dead_lettered_at END
        WHERE id = n.outbox_id;
    END IF;

    RETURN jsonb_build_object(
        'id', p_notification,
        'outcome', p_outcome,
        'attempt', v_attempt,
        'dead_lettered', v_dead
    );
END;
$$;

-- ---- traveller feed / preferences -----------------------------------

DROP FUNCTION IF EXISTS app.list_my_notifications(uuid, integer, integer);
DROP FUNCTION IF EXISTS app.mark_my_notification_read(uuid, uuid);

CREATE OR REPLACE FUNCTION app.list_my_notifications(p_user_id uuid, p_limit integer, p_offset integer)
RETURNS TABLE (
    id uuid,
    title text,
    body text,
    category text,
    read_at timestamptz,
    created_at timestamptz,
    total bigint,
    deep_link text,
    event_type text,
    locale text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT n.id, n.title, n.body, n.category, n.read_at, n.created_at, COUNT(*) OVER (),
           n.deep_link, n.event_type, n.locale
    FROM app.account_notifications n
    WHERE n.user_id = p_user_id
    ORDER BY n.read_at IS NOT NULL, n.created_at DESC
    LIMIT GREATEST(p_limit, 1)
    OFFSET GREATEST(p_offset, 0);
$$;

CREATE OR REPLACE FUNCTION app.mark_my_notification_read(p_user_id uuid, p_notification_id uuid)
RETURNS TABLE (
    id uuid,
    title text,
    body text,
    category text,
    read_at timestamptz,
    created_at timestamptz,
    deep_link text,
    event_type text,
    locale text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    RETURN QUERY
        UPDATE app.account_notifications n
        SET read_at = coalesce(n.read_at, now())
        WHERE n.id = p_notification_id AND n.user_id = p_user_id
        RETURNING n.id, n.title, n.body, n.category, n.read_at, n.created_at, n.deep_link, n.event_type, n.locale;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'notification not found' USING ERRCODE = 'P0002';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION app.get_communication_preferences(p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    p app.user_private;
BEGIN
    SELECT * INTO p FROM app.user_private WHERE user_id = p_user;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'account not found' USING ERRCODE = 'P0002';
    END IF;
    RETURN jsonb_build_object(
        'transactional_email', coalesce(p.transactional_email, true),
        'marketing_email', coalesce(p.marketing_consent, false),
        'marketing_in_app', coalesce(p.marketing_in_app, false),
        'unsubscribe_token', p.unsubscribe_token,
        'locale', (SELECT locale FROM app.users WHERE id = p_user)
    );
END;
$$;

CREATE OR REPLACE FUNCTION app.set_communication_preferences(
    p_user uuid,
    p_marketing_email boolean,
    p_marketing_in_app boolean,
    p_source text DEFAULT 'preferences'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM app.user_private WHERE user_id = p_user) THEN
        RAISE EXCEPTION 'account not found' USING ERRCODE = 'P0002';
    END IF;
    -- transactional_email stays true: marketing opt-out never suppresses transactional.
    UPDATE app.user_private
    SET marketing_consent = coalesce(p_marketing_email, marketing_consent),
        marketing_in_app = coalesce(p_marketing_in_app, marketing_in_app),
        transactional_email = true,
        updated_at = now()
    WHERE user_id = p_user;
    IF p_marketing_email IS NOT NULL THEN
        INSERT INTO app.consent_events (user_id, purpose, granted, policy_version)
        VALUES (p_user, 'marketing_email', p_marketing_email, coalesce(p_source, 'preferences'));
    END IF;
    IF p_marketing_in_app IS NOT NULL THEN
        INSERT INTO app.consent_events (user_id, purpose, granted, policy_version)
        VALUES (p_user, 'marketing_in_app', p_marketing_in_app, coalesce(p_source, 'preferences'));
    END IF;
    RETURN app.get_communication_preferences(p_user);
END;
$$;

CREATE OR REPLACE FUNCTION app.list_consent_history(p_user uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', e.id,
        'purpose', e.purpose,
        'granted', e.granted,
        'policy_version', e.policy_version,
        'created_at', e.created_at
    ) ORDER BY e.created_at DESC), '[]'::jsonb)
    FROM app.consent_events e
    WHERE e.user_id = p_user
$$;

CREATE OR REPLACE FUNCTION app.unsubscribe_marketing(p_token text, p_source text DEFAULT 'unsubscribe_link')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_user uuid;
BEGIN
    IF p_token IS NULL OR length(btrim(p_token)) < 8 THEN
        RAISE EXCEPTION 'invalid unsubscribe token' USING ERRCODE = 'P0002';
    END IF;
    SELECT user_id INTO v_user FROM app.user_private WHERE unsubscribe_token = btrim(p_token);
    IF v_user IS NULL THEN
        RAISE EXCEPTION 'invalid unsubscribe token' USING ERRCODE = 'P0002';
    END IF;
    RETURN app.set_communication_preferences(v_user, false, false, coalesce(p_source, 'unsubscribe_link'));
END;
$$;

CREATE OR REPLACE FUNCTION app.lookup_unsubscribe_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_user uuid;
    v_email text;
BEGIN
    SELECT user_id, email INTO v_user, v_email
    FROM app.user_private
    WHERE unsubscribe_token = btrim(p_token);
    IF v_user IS NULL THEN
        RAISE EXCEPTION 'invalid unsubscribe token' USING ERRCODE = 'P0002';
    END IF;
    RETURN jsonb_build_object(
        'user_id', v_user,
        'email_domain', CASE WHEN v_email LIKE '%@%' THEN split_part(v_email, '@', 2) ELSE NULL END,
        'marketing_email', (SELECT marketing_consent FROM app.user_private WHERE user_id = v_user)
    );
END;
$$;

-- ---- business role prefs / escalation -------------------------------

CREATE OR REPLACE FUNCTION app.list_role_notification_prefs(p_user uuid, p_org uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_settings app.notification_org_settings;
BEGIN
    PERFORM app.require_capability(p_user, p_org, 'settings');
    SELECT * INTO v_settings FROM app.notification_org_settings WHERE organization_id = p_org;
    RETURN jsonb_build_object(
        'escalation', jsonb_build_object(
            'first_minutes', coalesce(v_settings.escalation_first_minutes, 30),
            'repeat_minutes', coalesce(v_settings.escalation_repeat_minutes, 60),
            'max', coalesce(v_settings.escalation_max, 3)
        ),
        'roles', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'role', r.role,
                'event_type', r.event_type,
                'email_enabled', r.email_enabled,
                'in_app_enabled', r.in_app_enabled
            ) ORDER BY r.role, r.event_type)
            FROM app.notification_role_prefs r
            WHERE r.organization_id = p_org
        ), '[]'::jsonb)
    );
END;
$$;

CREATE OR REPLACE FUNCTION app.put_role_notification_pref(
    p_user uuid,
    p_org uuid,
    p_role text,
    p_event text,
    p_email boolean,
    p_in_app boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    PERFORM app.require_capability(p_user, p_org, 'settings');
    IF p_role NOT IN ('owner', 'manager', 'inventory', 'bookings', 'finance') THEN
        RAISE EXCEPTION 'invalid role' USING ERRCODE = '22023';
    END IF;
    IF p_event NOT IN ('business.booking.requested', 'business.request.unanswered') THEN
        RAISE EXCEPTION 'invalid event' USING ERRCODE = '22023';
    END IF;
    INSERT INTO app.notification_role_prefs (organization_id, role, event_type, email_enabled, in_app_enabled)
    VALUES (p_org, p_role, p_event, coalesce(p_email, true), coalesce(p_in_app, true))
    ON CONFLICT (organization_id, role, event_type) DO UPDATE
        SET email_enabled = EXCLUDED.email_enabled,
            in_app_enabled = EXCLUDED.in_app_enabled,
            updated_at = now();
    INSERT INTO app.audit_log (actor_id, action, table_name, row_key, changes, reason)
    VALUES (
        p_user, 'notification_role_pref', 'notification_role_prefs',
        jsonb_build_object('organization_id', p_org, 'role', p_role, 'event_type', p_event),
        jsonb_build_object('email_enabled', p_email, 'in_app_enabled', p_in_app),
        'Per-role notification preference'
    );
    RETURN app.list_role_notification_prefs(p_user, p_org);
END;
$$;

CREATE OR REPLACE FUNCTION app.put_escalation_settings(
    p_user uuid,
    p_org uuid,
    p_first integer,
    p_repeat integer,
    p_max integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    PERFORM app.require_capability(p_user, p_org, 'settings');
    INSERT INTO app.notification_org_settings (
        organization_id, escalation_first_minutes, escalation_repeat_minutes, escalation_max
    )
    VALUES (
        p_org,
        GREATEST(coalesce(p_first, 30), 1),
        GREATEST(coalesce(p_repeat, 60), 1),
        LEAST(GREATEST(coalesce(p_max, 3), 1), 20)
    )
    ON CONFLICT (organization_id) DO UPDATE
        SET escalation_first_minutes = EXCLUDED.escalation_first_minutes,
            escalation_repeat_minutes = EXCLUDED.escalation_repeat_minutes,
            escalation_max = EXCLUDED.escalation_max,
            updated_at = now();
    INSERT INTO app.audit_log (actor_id, action, table_name, row_key, changes, reason)
    VALUES (
        p_user, 'notification_escalation', 'notification_org_settings',
        jsonb_build_object('organization_id', p_org),
        jsonb_build_object('first', p_first, 'repeat', p_repeat, 'max', p_max),
        'Unanswered-request escalation schedule'
    );
    RETURN app.list_role_notification_prefs(p_user, p_org);
END;
$$;

CREATE OR REPLACE FUNCTION app.escalate_unanswered_requests(p_limit integer DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_count integer := 0;
    rec record;
    v_first integer;
    v_repeat integer;
    v_max integer;
    v_due timestamptz;
    v_next integer;
BEGIN
    FOR rec IN
        SELECT b.id, b.organization_id, b.customer_id, b.created_at, b.response_due_at
        FROM app.bookings b
        WHERE b.status = 'pending' AND b.mode = 'request'
        ORDER BY b.created_at
        LIMIT GREATEST(coalesce(p_limit, 50), 1)
        FOR UPDATE OF b SKIP LOCKED
    LOOP
        SELECT escalation_first_minutes, escalation_repeat_minutes, escalation_max
        INTO v_first, v_repeat, v_max
        FROM app.notification_org_settings
        WHERE organization_id = rec.organization_id;
        v_first := coalesce(v_first, 30);
        v_repeat := coalesce(v_repeat, 60);
        v_max := coalesce(v_max, 3);
        SELECT coalesce(max(escalation_no), 0) + 1 INTO v_next
        FROM app.notification_escalations
        WHERE booking_id = rec.id;
        IF v_next > v_max THEN
            CONTINUE;
        END IF;
        IF v_next = 1 THEN
            v_due := rec.created_at + make_interval(mins => v_first);
        ELSE
            v_due := rec.created_at + make_interval(mins => v_first) + make_interval(mins => v_repeat * (v_next - 1));
        END IF;
        IF rec.response_due_at IS NOT NULL THEN
            v_due := LEAST(v_due, rec.response_due_at);
        END IF;
        IF v_due > now() THEN
            CONTINUE;
        END IF;
        INSERT INTO app.notification_escalations (booking_id, escalation_no)
        VALUES (rec.id, v_next)
        ON CONFLICT DO NOTHING;
        IF NOT FOUND THEN
            CONTINUE;
        END IF;
        PERFORM app.emit_notification_event(
            'business.request.unanswered',
            rec.id,
            rec.customer_id,
            rec.organization_id,
            jsonb_build_object('booking_id', rec.id, 'escalation_no', v_next)
        );
        v_count := v_count + 1;
    END LOOP;
    RETURN jsonb_build_object('escalated', v_count);
END;
$$;

-- ---- material itinerary change --------------------------------------

CREATE OR REPLACE FUNCTION app.detect_material_itinerary_change(p_before jsonb, p_after jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_before jsonb := coalesce(p_before, '{}'::jsonb);
    v_after jsonb := coalesce(p_after, '{}'::jsonb);
BEGIN
    IF v_before = v_after THEN
        RETURN false;
    END IF;
    IF coalesce(v_before->'stops', '[]'::jsonb) IS DISTINCT FROM coalesce(v_after->'stops', '[]'::jsonb) THEN
        RETURN true;
    END IF;
    IF coalesce(v_before->>'window_start', '') IS DISTINCT FROM coalesce(v_after->>'window_start', '') THEN
        RETURN true;
    END IF;
    IF coalesce(v_before->>'return_by', '') IS DISTINCT FROM coalesce(v_after->>'return_by', '') THEN
        RETURN true;
    END IF;
    IF coalesce(v_before->>'start_location', '') IS DISTINCT FROM coalesce(v_after->>'start_location', '') THEN
        RETURN true;
    END IF;
    RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION app.notify_material_itinerary_change(
    p_trip uuid,
    p_owner uuid,
    p_before jsonb,
    p_after jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    IF NOT app.detect_material_itinerary_change(p_before, p_after) THEN
        RETURN jsonb_build_object('notified', false, 'reason', 'not_material');
    END IF;
    RETURN app.emit_notification_event(
        'itinerary.material_change',
        p_trip,
        p_owner,
        NULL,
        jsonb_build_object('trip_id', p_trip, 'before', p_before, 'after', p_after)
    ) || jsonb_build_object('notified', true);
END;
$$;

-- ---- admin health / resend / metrics --------------------------------

CREATE OR REPLACE FUNCTION app.notification_channel_metrics()
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = app, public
AS $$
    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'channel', channel,
        'sent', sent,
        'failed', failed,
        'pending', pending,
        'suppressed', suppressed,
        'dead_lettered', dead_lettered,
        'delivery_rate', CASE WHEN sent + failed = 0 THEN 0
            ELSE round(sent::numeric / (sent + failed), 4) END,
        'failure_rate', CASE WHEN sent + failed = 0 THEN 0
            ELSE round(failed::numeric / (sent + failed), 4) END
    ) ORDER BY channel), '[]'::jsonb)
    FROM (
        SELECT
            n.channel,
            count(*) FILTER (WHERE n.status = 'sent') AS sent,
            count(*) FILTER (WHERE n.status = 'failed') AS failed,
            count(*) FILTER (WHERE n.status = 'pending') AS pending,
            count(*) FILTER (WHERE n.status = 'suppressed') AS suppressed,
            count(*) FILTER (WHERE n.dead_lettered_at IS NOT NULL) AS dead_lettered
        FROM app.notifications n
        GROUP BY n.channel
    ) s
$$;

CREATE OR REPLACE FUNCTION app.admin_notification_health(p_admin uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    PERFORM app.require_admin(p_admin, false);
    RETURN jsonb_build_object(
        'outbox_depth', (SELECT count(*) FROM app.outbox WHERE processed_at IS NULL AND dead_lettered_at IS NULL),
        'dead_letters', (SELECT count(*) FROM app.notifications WHERE dead_lettered_at IS NOT NULL),
        'pending', (SELECT count(*) FROM app.notifications WHERE status IN ('pending', 'failed') AND dead_lettered_at IS NULL),
        'max_attempts', 8,
        'backoff', 'exponential minutes: 1,2,4,8,16,32,64,128 (capped 1440). Dead-letter after 8 attempts.',
        'channels', app.notification_channel_metrics(),
        'recent_failures', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'id', n.id,
                'channel', n.channel,
                'event_type', n.event_type,
                'status', n.status,
                'attempts', n.attempts,
                'last_error_code', n.last_error_code,
                'dead_lettered_at', n.dead_lettered_at,
                'created_at', n.created_at
            ) ORDER BY coalesce(n.dead_lettered_at, n.created_at) DESC)
            FROM (
                SELECT * FROM app.notifications
                WHERE status = 'failed' OR dead_lettered_at IS NOT NULL
                ORDER BY coalesce(dead_lettered_at, created_at) DESC
                LIMIT 25
            ) n
        ), '[]'::jsonb)
    );
END;
$$;

CREATE OR REPLACE FUNCTION app.admin_resend_notification(p_admin uuid, p_notification uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    n app.notifications;
BEGIN
    PERFORM app.require_admin(p_admin, false);
    IF p_reason IS NULL OR length(btrim(p_reason)) < 3 THEN
        RAISE EXCEPTION 'reason required' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO n FROM app.notifications WHERE id = p_notification FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'notification not found' USING ERRCODE = 'P0002';
    END IF;
    -- Resend only re-queues delivery. Booking and payment rows are untouched.
    UPDATE app.notifications
    SET status = 'pending',
        next_retry_at = now(),
        dead_lettered_at = NULL,
        last_error_code = NULL,
        last_error = NULL
    WHERE id = p_notification;
    UPDATE app.outbox
    SET processed_at = NULL,
        dead_lettered_at = NULL,
        available_at = now(),
        last_error_code = NULL
    WHERE id = n.outbox_id;
    INSERT INTO app.audit_log (actor_id, action, table_name, row_key, changes, reason)
    VALUES (
        p_admin, 'notification_resend', 'notifications',
        jsonb_build_object('notification_id', p_notification, 'outbox_id', n.outbox_id),
        jsonb_build_object('channel', n.channel, 'event_type', n.event_type),
        btrim(p_reason)
    );
    RETURN jsonb_build_object('id', p_notification, 'status', 'pending', 'channel', n.channel);
END;
$$;

CREATE OR REPLACE FUNCTION app.admin_list_notifications(
    p_admin uuid,
    p_status text DEFAULT NULL,
    p_channel text DEFAULT NULL,
    p_limit integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    PERFORM app.require_admin(p_admin, false);
    RETURN coalesce((
        SELECT jsonb_agg(jsonb_build_object(
            'id', n.id,
            'user_id', n.user_id,
            'channel', n.channel,
            'category', n.category,
            'event_type', n.event_type,
            'status', n.status,
            'attempts', n.attempts,
            'dead_lettered_at', n.dead_lettered_at,
            'last_error_code', n.last_error_code,
            'deep_link', n.deep_link,
            'created_at', n.created_at
        ) ORDER BY n.created_at DESC)
        FROM (
            SELECT *
            FROM app.notifications
            WHERE (p_status IS NULL OR status = p_status)
              AND (p_channel IS NULL OR channel = p_channel)
            ORDER BY created_at DESC
            LIMIT GREATEST(coalesce(p_limit, 50), 1)
        ) n
    ), '[]'::jsonb);
END;
$$;

-- ---- hub booking hooks (preview bookings on account_bookings) -------

CREATE OR REPLACE FUNCTION app.create_my_booking(
    p_user_id uuid,
    p_listing_slug text,
    p_business_id integer,
    p_policy_summary text
)
RETURNS TABLE (
    id uuid,
    listing_slug text,
    business_id integer,
    status text,
    policy_summary text,
    reason text,
    created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_slug text := btrim(p_listing_slug);
    v_policy text := btrim(p_policy_summary);
    v_id uuid;
BEGIN
    IF length(v_slug) < 1 THEN
        RAISE EXCEPTION 'invalid listing' USING ERRCODE = '22023';
    END IF;
    IF length(v_policy) < 1 THEN
        v_policy := 'Preview booking. Cancel requires a reason. Bookings are never deleted.';
    END IF;
    INSERT INTO app.account_bookings (customer_id, listing_slug, business_id, status, policy_summary)
    VALUES (p_user_id, v_slug, p_business_id, 'confirmed', v_policy)
    RETURNING account_bookings.id INTO v_id;
    PERFORM app.emit_notification_event(
        'booking.confirmed',
        v_id,
        p_user_id,
        NULL,
        jsonb_build_object('booking_id', v_id, 'listing_slug', v_slug, 'status', 'confirmed')
    );
    RETURN QUERY
        SELECT b.id, b.listing_slug, b.business_id, b.status, b.policy_summary, b.reason, b.created_at
        FROM app.account_bookings b
        WHERE b.id = v_id;
END;
$$;

CREATE OR REPLACE FUNCTION app.cancel_my_booking(p_user_id uuid, p_booking_id uuid, p_reason text)
RETURNS TABLE (
    id uuid,
    listing_slug text,
    business_id integer,
    status text,
    policy_summary text,
    reason text,
    created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_reason text := btrim(p_reason);
BEGIN
    IF length(v_reason) < 1 THEN
        RAISE EXCEPTION 'cancel reason required' USING ERRCODE = '22023';
    END IF;
    RETURN QUERY
        UPDATE app.account_bookings b
        SET status = 'cancelled', reason = v_reason
        WHERE b.id = p_booking_id
          AND b.customer_id = p_user_id
          AND b.status IN ('pending', 'confirmed')
        RETURNING b.id, b.listing_slug, b.business_id, b.status, b.policy_summary, b.reason, b.created_at;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'booking not found' USING ERRCODE = 'P0002';
    END IF;
    PERFORM app.emit_notification_event(
        'booking.cancelled',
        p_booking_id,
        p_user_id,
        NULL,
        jsonb_build_object('booking_id', p_booking_id, 'reason', v_reason, 'status', 'cancelled')
    );
END;
$$;

-- ---- marketplace booking / payment composition ----------------------

CREATE OR REPLACE FUNCTION app.notify_booking_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.status = 'pending' THEN
            PERFORM app.emit_notification_event(
                'booking.requested', NEW.id, NEW.customer_id, NEW.organization_id,
                jsonb_build_object('booking_id', NEW.id, 'status', NEW.status, 'organization_id', NEW.organization_id)
            );
            PERFORM app.emit_notification_event(
                'business.booking.requested', NEW.id, NEW.customer_id, NEW.organization_id,
                jsonb_build_object('booking_id', NEW.id, 'status', NEW.status, 'organization_id', NEW.organization_id)
            );
        ELSIF NEW.status IN ('confirmed', 'rejected', 'cancelled') THEN
            PERFORM app.emit_notification_event(
                'booking.' || NEW.status, NEW.id, NEW.customer_id, NEW.organization_id,
                jsonb_build_object('booking_id', NEW.id, 'status', NEW.status, 'organization_id', NEW.organization_id)
            );
        END IF;
        RETURN NEW;
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
        IF NEW.status IN ('confirmed', 'rejected', 'cancelled') THEN
            PERFORM app.emit_notification_event(
                'booking.' || NEW.status, NEW.id, NEW.customer_id, NEW.organization_id,
                jsonb_build_object('booking_id', NEW.id, 'status', NEW.status, 'organization_id', NEW.organization_id)
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION app.notify_payment_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_customer uuid;
    v_org uuid;
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN
        RETURN NEW;
    END IF;
    SELECT customer_id, organization_id INTO v_customer, v_org
    FROM app.bookings WHERE id = NEW.booking_id;
    IF v_customer IS NULL THEN
        RETURN NEW;
    END IF;
    PERFORM app.emit_notification_event(
        'payment.status_changed',
        NEW.booking_id,
        v_customer,
        v_org,
        jsonb_build_object(
            'booking_id', NEW.booking_id,
            'payment_id', NEW.id,
            'status', NEW.status,
            'organization_id', v_org
        )
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_booking_row ON app.bookings;
CREATE TRIGGER trg_notify_booking_row
    AFTER INSERT OR UPDATE OF status ON app.bookings
    FOR EACH ROW
    EXECUTE FUNCTION app.notify_booking_row();

DROP TRIGGER IF EXISTS trg_notify_payment_row ON app.payments;
CREATE TRIGGER trg_notify_payment_row
    AFTER INSERT OR UPDATE OF status ON app.payments
    FOR EACH ROW
    EXECUTE FUNCTION app.notify_payment_row();

-- ---- admin KPI composition ------------------------------------------

CREATE OR REPLACE FUNCTION app.admin_metric_definitions()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT jsonb_build_array(
        jsonb_build_object('key', 'users', 'label', 'Registered users', 'definition', 'Count of app.users rows created in the selected window, excluding deleted.'),
        jsonb_build_object('key', 'businesses', 'label', 'Organisations', 'definition', 'Count of app.organizations created in the window.'),
        jsonb_build_object('key', 'verified_businesses', 'label', 'Verified organisations', 'definition', 'Organisations whose verification equals verified at query time. The badge is only set by admin approval.'),
        jsonb_build_object('key', 'bookings', 'label', 'Bookings created', 'definition', 'Count of app.bookings created in the window.'),
        jsonb_build_object('key', 'confirmed_bookings', 'label', 'Confirmed bookings', 'definition', 'Bookings currently in confirmed status created in the window.'),
        jsonb_build_object('key', 'open_cases', 'label', 'Open support cases', 'definition', 'Support cases in open or investigating status.'),
        jsonb_build_object('key', 'case_backlog_hours', 'label', 'Mean open-case age (hours)', 'definition', 'Average age of open/investigating cases.'),
        jsonb_build_object('key', 'open_quality_issues', 'label', 'Open data-quality issues', 'definition', 'data_quality_issues currently open.'),
        jsonb_build_object('key', 'planner_success_rate', 'label', 'Planner generation success rate', 'definition', 'Share of recommendation_runs with status succeeded. Stubbed at 0 when the planner has not run.'),
        jsonb_build_object('key', 'planner_infeasible_rate', 'label', 'Planner infeasible rate', 'definition', 'Share of recommendation_runs with status infeasible.'),
        jsonb_build_object('key', 'planner_fallback_rate', 'label', 'Planner fallback rate', 'definition', 'Share of recommendation_runs with status fallback.'),
        jsonb_build_object('key', 'notification_email_delivery_rate', 'label', 'Email delivery rate', 'definition', 'sent / (sent + failed) for the email channel. Stubbed deliveries count as sent.'),
        jsonb_build_object('key', 'notification_email_failure_rate', 'label', 'Email failure rate', 'definition', 'failed / (sent + failed) for the email channel.'),
        jsonb_build_object('key', 'notification_dead_letters', 'label', 'Notification dead letters', 'definition', 'Notifications that exhausted retry (8 attempts) and sit in the DLQ.')
    )
$$;

CREATE OR REPLACE FUNCTION app.admin_kpis(p_admin uuid, p_from timestamptz, p_to timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_from timestamptz;
    v_to timestamptz;
    v_runs integer;
    v_email_sent integer;
    v_email_failed integer;
BEGIN
    PERFORM app.require_admin(p_admin, false);
    v_from := coalesce(p_from, now() - interval '30 days');
    v_to := coalesce(p_to, now());
    SELECT count(*) INTO v_runs
    FROM app.recommendation_runs
    WHERE created_at >= v_from AND created_at < v_to;
    SELECT
        count(*) FILTER (WHERE status = 'sent'),
        count(*) FILTER (WHERE status = 'failed')
    INTO v_email_sent, v_email_failed
    FROM app.notifications
    WHERE channel = 'email' AND created_at >= v_from AND created_at < v_to;
    RETURN jsonb_build_object(
        'from', v_from,
        'to', v_to,
        'metrics', jsonb_build_object(
            'users', (SELECT count(*) FROM app.users WHERE created_at >= v_from AND created_at < v_to AND status <> 'deleted'),
            'businesses', (SELECT count(*) FROM app.organizations WHERE created_at >= v_from AND created_at < v_to),
            'verified_businesses', (SELECT count(*) FROM app.organizations WHERE verification = 'verified'),
            'bookings', (SELECT count(*) FROM app.bookings WHERE created_at >= v_from AND created_at < v_to),
            'confirmed_bookings', (SELECT count(*) FROM app.bookings WHERE created_at >= v_from AND created_at < v_to AND status = 'confirmed'),
            'open_cases', (SELECT count(*) FROM app.support_cases WHERE status IN ('open', 'investigating')),
            'case_backlog_hours', coalesce((
                SELECT floor(avg(extract(epoch FROM (now() - created_at)) / 3600))
                FROM app.support_cases
                WHERE status IN ('open', 'investigating')
            ), 0),
            'open_quality_issues', (SELECT count(*) FROM app.data_quality_issues WHERE status = 'open'),
            'planner_success_rate', CASE WHEN v_runs = 0 THEN 0 ELSE (
                SELECT count(*) FILTER (WHERE status = 'succeeded')::numeric / v_runs
                FROM app.recommendation_runs
                WHERE created_at >= v_from AND created_at < v_to
            ) END,
            'planner_infeasible_rate', CASE WHEN v_runs = 0 THEN 0 ELSE (
                SELECT count(*) FILTER (WHERE status = 'infeasible')::numeric / v_runs
                FROM app.recommendation_runs
                WHERE created_at >= v_from AND created_at < v_to
            ) END,
            'planner_fallback_rate', CASE WHEN v_runs = 0 THEN 0 ELSE (
                SELECT count(*) FILTER (WHERE status = 'fallback')::numeric / v_runs
                FROM app.recommendation_runs
                WHERE created_at >= v_from AND created_at < v_to
            ) END,
            'notification_email_delivery_rate', CASE WHEN v_email_sent + v_email_failed = 0 THEN 0
                ELSE round(v_email_sent::numeric / (v_email_sent + v_email_failed), 4) END,
            'notification_email_failure_rate', CASE WHEN v_email_sent + v_email_failed = 0 THEN 0
                ELSE round(v_email_failed::numeric / (v_email_sent + v_email_failed), 4) END,
            'notification_dead_letters', (SELECT count(*) FROM app.notifications WHERE dead_lettered_at IS NOT NULL)
        ),
        'definitions', app.admin_metric_definitions(),
        'planner_source', CASE WHEN v_runs = 0 THEN 'stub' ELSE 'recommendation_runs' END
    );
END;
$$;

-- ---- grants ----------------------------------------------------------

REVOKE ALL ON FUNCTION app.emit_notification_event(text, uuid, uuid, uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.enqueue_user_notification(uuid, text, uuid, text, jsonb, text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.claim_notification_batch(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.record_notification_delivery(uuid, text, text, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.get_communication_preferences(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.set_communication_preferences(uuid, boolean, boolean, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.list_consent_history(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.unsubscribe_marketing(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.lookup_unsubscribe_token(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.list_role_notification_prefs(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.put_role_notification_pref(uuid, uuid, text, text, boolean, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.put_escalation_settings(uuid, uuid, integer, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.escalate_unanswered_requests(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.notify_material_itinerary_change(uuid, uuid, jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.admin_notification_health(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.admin_resend_notification(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.admin_list_notifications(uuid, text, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.list_my_notifications(uuid, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.mark_my_notification_read(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.create_my_booking(uuid, text, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.cancel_my_booking(uuid, uuid, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION app.emit_notification_event(text, uuid, uuid, uuid, jsonb) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.enqueue_user_notification(uuid, text, uuid, text, jsonb, text, text, jsonb) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.enqueue_notification(uuid, text, uuid, text, jsonb) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.claim_notification_batch(integer) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.record_notification_delivery(uuid, text, text, text, integer) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.get_communication_preferences(uuid) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.set_communication_preferences(uuid, boolean, boolean, text) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.list_consent_history(uuid) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.unsubscribe_marketing(text, text) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.lookup_unsubscribe_token(text) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.list_role_notification_prefs(uuid, uuid) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.put_role_notification_pref(uuid, uuid, text, text, boolean, boolean) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.put_escalation_settings(uuid, uuid, integer, integer, integer) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.escalate_unanswered_requests(integer) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.detect_material_itinerary_change(jsonb, jsonb) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.notify_material_itinerary_change(uuid, uuid, jsonb, jsonb) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.admin_notification_health(uuid) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.admin_resend_notification(uuid, uuid, text) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.admin_list_notifications(uuid, text, text, integer) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.admin_kpis(uuid, timestamptz, timestamptz) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.list_my_notifications(uuid, integer, integer) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.mark_my_notification_read(uuid, uuid) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.create_my_booking(uuid, text, integer, text) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.cancel_my_booking(uuid, uuid, text) TO mshwar_backend;
