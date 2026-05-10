-- Create PostgreSQL enum types for domain-level statuses and roles.
CREATE TYPE app.event_status AS ENUM ('active', 'archived', 'deleted');
CREATE TYPE app.event_member_role AS ENUM ('admin', 'member');
CREATE TYPE app.split_type AS ENUM ('equal', 'custom', 'percentage', 'shares');
CREATE TYPE app.settlement_status AS ENUM ('pending', 'confirmed', 'disputed');
