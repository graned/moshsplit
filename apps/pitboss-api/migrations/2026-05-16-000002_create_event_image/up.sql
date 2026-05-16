CREATE TYPE app.event_image_type AS ENUM ('banner', 'gallery');

CREATE TABLE IF NOT EXISTS app.event_image (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id    UUID NOT NULL REFERENCES app.event(id) ON DELETE CASCADE,
    url         TEXT NOT NULL,
    alt_text    TEXT,
    image_type  app.event_image_type NOT NULL,
    sort_order  INT NOT NULL DEFAULT 0,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_event_image_event_id ON app.event_image(event_id);
CREATE INDEX idx_event_image_event_type ON app.event_image(event_id, image_type);
CREATE INDEX idx_event_image_sort_order ON app.event_image(event_id, image_type, sort_order);
