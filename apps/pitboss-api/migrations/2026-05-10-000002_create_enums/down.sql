-- Drop enum types (CASCADE will remove dependent columns).
DROP TYPE IF EXISTS app.event_status CASCADE;
DROP TYPE IF EXISTS app.event_member_role CASCADE;
DROP TYPE IF EXISTS app.split_type CASCADE;
DROP TYPE IF EXISTS app.settlement_status CASCADE;
