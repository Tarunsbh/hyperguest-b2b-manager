-- =============================================================================
-- HyperGuest B2B Channel Manager — MySQL Schema
-- =============================================================================
-- Compatible: MySQL 8.0+
-- Column names use camelCase to match the Next.js API routes.
-- Run once against your MySQL database:
--   mysql -h 127.0.0.1 -P 3306 -u root -p < db/schema.sql
-- =============================================================================

CREATE DATABASE IF NOT EXISTS hyperguest_b2b
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE hyperguest_b2b;

-- ===========================================================================
-- TABLE: hg_properties
-- Full property cache from HyperGuest Static API
-- ===========================================================================
CREATE TABLE IF NOT EXISTS hg_properties (
  -- Core identity
  id             INT           NOT NULL,
  name           VARCHAR(500)  NOT NULL,
  rating         INT           NULL,
  status         VARCHAR(50)   NULL,
  isTest         TINYINT(1)    NOT NULL DEFAULT 0,

  -- Location
  countryCode    VARCHAR(10)   NULL,
  city           VARCHAR(200)  NULL,
  address        VARCHAR(500)  NULL,
  postcode       VARCHAR(20)   NULL,
  region         VARCHAR(200)  NULL,
  latitude       DOUBLE        NULL,
  longitude      DOUBLE        NULL,
  timezone       VARCHAR(100)  NULL,

  -- Contact
  phone          VARCHAR(100)  NULL,
  email          VARCHAR(200)  NULL,
  website        VARCHAR(500)  NULL,

  -- Stay settings
  currency       VARCHAR(10)   NULL,
  checkIn        VARCHAR(10)   NULL,
  checkOut       VARCHAR(10)   NULL,
  numberOfRooms  INT           NULL,
  hotelType      VARCHAR(100)  NULL,

  -- Commercial
  commission     DOUBLE        NULL,
  commissionType VARCHAR(50)   NULL,

  -- Full JSON snapshot from detail endpoint
  rawData        LONGTEXT      NULL,

  -- Sync tracking
  basicSyncedAt  DATETIME      NULL,
  detailSyncedAt DATETIME      NULL,
  syncedAt       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_status      (status),
  INDEX idx_countryCode (countryCode),
  INDEX idx_city        (city),
  INDEX idx_email       (email),
  INDEX idx_detailSync  (detailSyncedAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ===========================================================================
-- TABLE: hg_subscriptions
-- ARI subscriptions managed via HyperGuest PDM API
-- ===========================================================================
CREATE TABLE IF NOT EXISTS hg_subscriptions (
  id             INT           NOT NULL AUTO_INCREMENT,
  subscriptionId VARCHAR(200)  NOT NULL,
  userId         VARCHAR(200)  NULL,
  propertyIds    TEXT          NULL,   -- JSON array of property IDs
  ratePlanCodes  TEXT          NULL,   -- JSON object mapping propertyId → codes
  method         VARCHAR(50)   NOT NULL DEFAULT 'ARI',
  envelope       VARCHAR(100)  NULL,
  status         VARCHAR(50)   NOT NULL DEFAULT 'enabled',
  version        INT           NOT NULL DEFAULT 1,
  email          VARCHAR(200)  NULL,
  callbackUrl    VARCHAR(1000) NULL,
  rawResponse    LONGTEXT      NULL,
  createdAt      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_subscriptionId (subscriptionId),
  INDEX idx_status (status),
  INDEX idx_userId (userId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ===========================================================================
-- TABLE: hg_bookings
-- Booking push log — every reservation sent to HyperGuest
-- ===========================================================================
CREATE TABLE IF NOT EXISTS hg_bookings (
  id            INT          NOT NULL AUTO_INCREMENT,
  reservationId VARCHAR(200) NOT NULL,
  hotelCode     VARCHAR(50)  NOT NULL,
  resStatus     VARCHAR(50)  NOT NULL DEFAULT 'Commit',
  checkIn       DATE         NULL,
  checkOut      DATE         NULL,
  guestName     VARCHAR(400) NULL,
  guestEmail    VARCHAR(200) NULL,
  rooms         INT          NOT NULL DEFAULT 1,
  totalAmount   DOUBLE       NULL,
  currency      VARCHAR(10)  NULL,
  xmlPayload    LONGTEXT     NULL,
  response      LONGTEXT     NULL,
  success       TINYINT(1)   NOT NULL DEFAULT 0,
  createdAt     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_reservationId (reservationId),
  INDEX idx_hotelCode (hotelCode),
  INDEX idx_resStatus (resStatus),
  INDEX idx_success   (success),
  INDEX idx_createdAt (createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ===========================================================================
-- TABLE: hg_callbacks
-- Incoming ARI update webhooks received from HyperGuest
-- ===========================================================================
CREATE TABLE IF NOT EXISTS hg_callbacks (
  id          INT          NOT NULL AUTO_INCREMENT,
  receivedAt  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  payload     LONGTEXT     NOT NULL,
  propertyId  INT          NULL,
  status      VARCHAR(50)  NOT NULL DEFAULT 'unprocessed',
  processed   TINYINT(1)   NOT NULL DEFAULT 0,
  processedAt DATETIME     NULL,
  sourceIp    VARCHAR(50)  NULL,

  PRIMARY KEY (id),
  INDEX idx_propertyId (propertyId),
  INDEX idx_status     (status),
  INDEX idx_processed  (processed),
  INDEX idx_receivedAt (receivedAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


SELECT 'HyperGuest B2B schema initialised successfully.' AS result;
