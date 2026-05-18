-- =============================================================================
-- HyperGuest B2B Channel Manager — MySQL Seed Data
-- =============================================================================
-- Run AFTER schema.sql:
--   mysql -h 127.0.0.1 -P 3306 -u root -p hyperguest_b2b < db/seed.sql
-- =============================================================================

USE hyperguest_b2b;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. hg_subscriptions — 3 sample ARI subscriptions
-- ─────────────────────────────────────────────────────────────────────────────

INSERT IGNORE INTO hg_subscriptions
  (subscriptionId, userId, propertyIds, ratePlanCodes, method, envelope,
   status, version, email, callbackUrl, rawResponse, createdAt, updatedAt)
VALUES
(
  '89725931041037377169_254_172_2',
  'eglobe_b2b_user',
  '[19912, 19913]',
  '{"19912": ["BAR", "RACK", "CORP"], "19913": ["BAR", "PROMO"]}',
  'ARI', 'Hyperguest', 'enabled', 1,
  'it@eglobe-solutions.com',
  'https://www.eglobe-solutions.com/webapichannelmanager/hyperguestb2bsubscription/callback/ariupdates',
  '{"subscriptionId":"89725931041037377169_254_172_2","status":"enabled"}',
  '2024-10-15 08:23:11', '2024-10-15 08:23:11'
),
(
  '89725931041037399201_254_172_3',
  'eglobe_b2b_user',
  '[19912]',
  '{"19912": ["BAR"]}',
  'ARI', 'Hyperguest', 'enabled', 2,
  'it@eglobe-solutions.com',
  'https://www.eglobe-solutions.com/webapichannelmanager/hyperguestb2bsubscription/callback/ariupdates',
  '{"subscriptionId":"89725931041037399201_254_172_3","status":"enabled"}',
  '2024-11-03 14:07:45', '2025-01-20 09:12:00'
),
(
  '89725931041037412855_254_172_4',
  'eglobe_b2b_user',
  '[19914, 19915, 19916]',
  '{"19914": ["BAR", "CORP"], "19915": ["BAR"], "19916": ["RACK"]}',
  'ARI', 'Hyperguest', 'disabled', 1,
  'it@eglobe-solutions.com',
  'https://www.eglobe-solutions.com/webapichannelmanager/hyperguestb2bsubscription/callback/ariupdates',
  '{"subscriptionId":"89725931041037412855_254_172_4","status":"disabled"}',
  '2024-08-22 10:55:33', '2024-09-10 16:30:00'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. hg_bookings — 3 sample bookings
-- ─────────────────────────────────────────────────────────────────────────────

INSERT IGNORE INTO hg_bookings
  (reservationId, hotelCode, resStatus, checkIn, checkOut,
   guestName, guestEmail, rooms, totalAmount, currency,
   success, createdAt)
VALUES
(
  'EGS-UQR01K374815', '19912', 'Commit',
  '2025-03-10', '2025-03-14',
  'Tarun Sabharwal', 'tarun@eglobe-solutions.com',
  2, 924.00, 'EUR', 1, '2025-01-15 09:45:00'
),
(
  'EGS-UQR01K374816', '19912', 'Commit',
  '2025-04-18', '2025-04-22',
  'Sarah Thompson', 'sarah.t@travelco.com',
  1, 682.00, 'EUR', 1, '2025-02-10 14:22:30'
),
(
  'EGS-CAN01K374817', '19913', 'Cancel',
  '2025-05-01', '2025-05-05',
  'Marco Rossi', 'm.rossi@italytours.it',
  1, 341.00, 'EUR', 0, '2025-02-20 10:05:00'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. hg_callbacks — 5 sample incoming ARI callbacks
-- ─────────────────────────────────────────────────────────────────────────────

INSERT IGNORE INTO hg_callbacks
  (id, propertyId, payload, receivedAt, status, processed, processedAt, sourceIp)
VALUES
(1, 19912, '<OTA_HotelAvailNotifRQ HotelCode="19912"><AvailStatusMessages/></OTA_HotelAvailNotifRQ>',
   '2025-01-20 06:00:05', 'processed', 1, '2025-01-20 06:00:07', '52.28.140.12'),
(2, 19912, '<OTA_HotelRateAmountNotifRQ HotelCode="19912"><RateAmountMessages/></OTA_HotelRateAmountNotifRQ>',
   '2025-01-21 09:15:03', 'processed', 1, '2025-01-21 09:15:05', '52.28.140.12'),
(3, 19913, '<OTA_HotelAvailNotifRQ HotelCode="19913"><AvailStatusMessages/></OTA_HotelAvailNotifRQ>',
   '2025-02-05 11:30:02', 'processed', 1, '2025-02-05 11:30:04', '52.28.140.12'),
(4, 19912, '<OTA_HotelAvailNotifRQ HotelCode="19912"><AvailStatusMessages/></OTA_HotelAvailNotifRQ>',
   '2025-02-22 15:45:01', 'unprocessed', 0, NULL, '52.28.140.12'),
(5, NULL,  '{"error":"Malformed ARI payload"}',
   '2025-02-25 08:10:00', 'error', 0, NULL, '34.245.19.88');

SELECT 'Seed data inserted successfully.' AS result;
