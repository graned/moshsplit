-- Temp seed script for Wacken 2026 — run once
-- Usage: cat scripts/seed-moshsplit.sql | docker exec -i moshsplit-db psql -U postgres -d moshsplit

-- Wacken 2026 event
INSERT INTO app.event (name, description, currency, status, created_by, created_at, updated_at)
VALUES ('Wacken 2026', 'Rain or Shine', 'EUR', 'active', '00000000-0000-0000-0000-000000000001', NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Get event id for images
DO $$
DECLARE
    ev_id UUID;
BEGIN
    SELECT id INTO ev_id FROM app.event WHERE name = 'Wacken 2026' LIMIT 1;
    IF ev_id IS NULL THEN RETURN; END IF;

    INSERT INTO app.event_image (event_id, url, alt_text, image_type, uploaded_at, created_at)
    VALUES (
        ev_id,
        'https://lh3.googleusercontent.com/pw/AP1GczNt-1cnGO05jzzNMJ8q3Ve8r8uojxILI2-GnA4S5huNUFvs-ErsKbKEkNBGRCHA-eZy2TV-X9NztIW02naVwFFtnxQXgRQoAuhWbS1ruVeRiGzojFy0GlAWSdDtkgicrPdnvBvZH390Piw9b5NnY4pdDYLnUV3dMJwF4bIhAVTUBEtA6pRlGbBcGmSObCw5RJzjBHlLQxG59jj6ExhPolekR4P9DTEI9c6fXqKEn_nt_RkR3ieXJksU9hR_LYGeZK1TbOKwIEmVgFnzgT4LCSjry5KEB_ksSZZC_xfB7uGyFZxjK5drcDqOEi4-UEMli0xOQeXYuM-2vcGs3vTAT7fnKV_YXEotWqEGfLms_jPvv5x0Alg0u8EWA7YvNMbBrM3ht3SwH8qpuOEYSyfWCb7IK4DWnddtLcKOUKYx9iS5o1FSeDzt6XqSiV6cMHUFiCRsNmHm3kUkqr66P0s7rXW38fRPI1kfq7hLDvx7lS5D1I2TzrS8n28PiJBCu7EUXmZxbavgspcsfNeRmeIa6ZmONV0u5wix1ulwQGhDXLC5QGYjhJFtWkLawwmd-ma1qTbUgGcPiWcVvJ6BGN1Jfcq7yP4gISJcBO1T0CnFNpuv8VwLmdAiVRIY9j3O3VH9-U280nODs_p9Mj2C4c4vtkWVgPcoZIMWOwHAkuPZxNZUHOxdVl8swzybOKLZ2Uu3Gab0c7XqsI3H8P5mz2zu2dZptIz_xzWS-EafTDtyoZ3FPnk3GC46vYMmJJV4bYs8AQlTq-5LtwtQN9z5iWxt7vZRoyFsYmrV81-XjLdZ0oYtGDuTnb2zkYZlphFkr8rvHvo0J5VTqXX_vrwQDWQy9hw5SPQeFHOCu4rQgzXjjNLG_Snqt5DhzFkjGIR0VT-EQs4MK3SeySzKoaOlAu0erVc6HUQZAkso3Xmwg4lg0xN4MtDSi-Egrpy4tM_gmbie7rdddqQnyiHMA9M=w578-h771-no?authuser=0',
        'wacken-2026',
        'banner',
        NOW(),
        NOW()
    ) ON CONFLICT DO NOTHING;

    RAISE NOTICE 'Wacken 2026 seeded';
END $$;