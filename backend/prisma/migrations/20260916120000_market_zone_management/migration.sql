-- Admin Market <-> Zone Management: two new, purely additive AuditAction
-- values for the new market-move and market-close operations. No column
-- changes, no data migration — Market.zoneId and Market.status already
-- exist and are reused as-is.
ALTER TYPE "AuditAction" ADD VALUE 'MARKET_ZONE_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE 'MARKET_STATUS_CHANGED';
