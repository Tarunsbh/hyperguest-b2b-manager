-- =============================================================================
-- HyperGuest B2B — Migration: expand hg_properties columns
-- =============================================================================
-- Run this ONCE against an existing database that was created before this
-- migration was added:
--   mysql -h 127.0.0.1 -P 3306 -u root -p hyperguest_b2b < db/migrate.sql
-- =============================================================================

USE hyperguest_b2b;

-- ── hg_properties: add all missing columns (safe to re-run on MySQL 8.0) ────

ALTER TABLE hg_properties
  ADD COLUMN IF NOT EXISTS isTest         TINYINT(1)    NOT NULL DEFAULT 0          AFTER status,
  ADD COLUMN IF NOT EXISTS address        VARCHAR(500)  NULL                         AFTER city,
  ADD COLUMN IF NOT EXISTS postcode       VARCHAR(20)   NULL                         AFTER address,
  ADD COLUMN IF NOT EXISTS region         VARCHAR(200)  NULL                         AFTER postcode,
  ADD COLUMN IF NOT EXISTS latitude       DOUBLE        NULL                         AFTER region,
  ADD COLUMN IF NOT EXISTS longitude      DOUBLE        NULL                         AFTER latitude,
  ADD COLUMN IF NOT EXISTS timezone       VARCHAR(100)  NULL                         AFTER longitude,
  ADD COLUMN IF NOT EXISTS phone          VARCHAR(100)  NULL                         AFTER timezone,
  ADD COLUMN IF NOT EXISTS email          VARCHAR(200)  NULL                         AFTER phone,
  ADD COLUMN IF NOT EXISTS website        VARCHAR(500)  NULL                         AFTER email,
  ADD COLUMN IF NOT EXISTS numberOfRooms  INT           NULL                         AFTER checkOut,
  ADD COLUMN IF NOT EXISTS hotelType      VARCHAR(100)  NULL                         AFTER numberOfRooms,
  ADD COLUMN IF NOT EXISTS commission     DOUBLE        NULL                         AFTER hotelType,
  ADD COLUMN IF NOT EXISTS commissionType VARCHAR(50)   NULL                         AFTER commission,
  ADD COLUMN IF NOT EXISTS rawData        LONGTEXT      NULL                         AFTER commissionType,
  ADD COLUMN IF NOT EXISTS basicSyncedAt  DATETIME      NULL                         AFTER rawData,
  ADD COLUMN IF NOT EXISTS detailSyncedAt DATETIME      NULL                         AFTER basicSyncedAt;

-- ── Add new indexes (IF NOT EXISTS not supported for indexes in MySQL 8) ─────
-- DROP + recreate is idempotent

DROP INDEX IF EXISTS idx_email      ON hg_properties;
DROP INDEX IF EXISTS idx_detailSync ON hg_properties;
CREATE INDEX idx_email      ON hg_properties (email);
CREATE INDEX idx_detailSync ON hg_properties (detailSyncedAt);

SELECT 'Migration complete: hg_properties expanded.' AS result;
