-- Reconcile the existing 56 catalogue SKUs in place. NULL stock means the supplied
-- count was absent or unclear and existing inventory must not be touched.
-- Confirmed counts are adjusted only if stock still matches the observed baseline.
BEGIN;
CREATE TEMP TABLE bt_catalogue_update (
  sku text PRIMARY KEY, name text NOT NULL, volume text, mrp numeric(12,2) NOT NULL,
  target_stock integer, expected_stock integer NOT NULL
) ON COMMIT DROP;
INSERT INTO bt_catalogue_update (sku, name, volume, mrp, target_stock, expected_stock) VALUES
  ('BT-CATALOG-001', 'Kerafill Pre Shampoo', '1000 ml', 2500, 14, 0),
  ('BT-CATALOG-002', 'Hair Kerafill Treatment', '1000 ml', 16000, 17, 0),
  ('BT-CATALOG-003', 'Keratin Post Mask', '1000 ml', 2500, 117, 0),
  ('BT-CATALOG-004', 'Kera Recovery Shampoo', '250 ml', 1200, 93, 0),
  ('BT-CATALOG-005', 'Kera Recovery Conditionar', '250 ml', 1200, 214, 0),
  ('BT-CATALOG-006', 'Straight Therapy A', '450 ml', 1700, 238, 0),
  ('BT-CATALOG-007', 'Straight Therapy B', '450 ml', 300, 212, 0),
  ('BT-CATALOG-008', 'Hydra Active Shampoo', '250 ml', 950, 47, 0),
  ('BT-CATALOG-009', 'Hydra Active Conditionar', '250 ml', 950, 57, 0),
  ('BT-CATALOG-010', 'Hydra Active Shampoo', '1000 ml', 2500, 11, 0),
  ('BT-CATALOG-011', 'Hydra Active Conditionar', '1000 ml', 2500, NULL, 0),
  ('BT-CATALOG-012', 'Revitalizing Hair Mask', '800 gm', 1199, 636, 0),
  ('BT-CATALOG-013', 'Injection Repair Shampoo', '250 ml', 900, 554, 0),
  ('BT-CATALOG-014', 'Injection Repair Mask', '200 ml', 1050, 44, 0),
  ('BT-CATALOG-015', 'Injection Smoothing Shampoo', '250 ml', 900, 180, 0),
  ('BT-CATALOG-016', 'Injection Smoothing Mask', '200 ml', 1050, 63, 0),
  ('BT-CATALOG-017', 'Injection Nutri Oil Shampoo', '250 ml', 900, 580, 0),
  ('BT-CATALOG-018', 'Injection Nutri Oil Mask', '200 ml', 1050, 366, 0),
  ('BT-CATALOG-019', 'One Step Treatment', '1000 ml', 27000, NULL, 0),
  ('BT-CATALOG-020', 'Surgery B1 Bond Shaper', '1 ltr', 15000, 6, 0),
  ('BT-CATALOG-021', 'Surgery B2 Bond Smoother', '500 ml', 15000, NULL, 0),
  ('BT-CATALOG-022', 'Surgery B3 Bond PH', '1 ltr', 15000, NULL, 0),
  ('BT-CATALOG-023', 'Surgery B4 Bond Laminizer', '1 ltr', 15000, NULL, 0),
  ('BT-CATALOG-024', 'Surgery B Pro Acidic Shampoo', '250 ml', 1500, NULL, 0),
  ('BT-CATALOG-025', 'Surgery B Pro Acidic Mask', '250 ml', 1500, 20, 0),
  ('BT-CATALOG-026', 'New Brazilian S3', '1 ltr', 15000, 5, 0),
  ('BT-CATALOG-027', 'S Pro Protein Shampoo', '1000 ml', 2000, 239, 0),
  ('BT-CATALOG-028', 'S Pro Protein Mask', '500 gm', 1400, 145, 0),
  ('BT-CATALOG-029', 'Multi Action Living Spary', '200 ml', 800, 32, 0),
  ('BT-CATALOG-030', 'D Pro Shampoo', '1 ltr', 1650, 52, 0),
  ('BT-CATALOG-031', 'D Miracle Scalp Liquid', '100 ml', 700, 71, 0),
  ('BT-CATALOG-032', 'D Treatment & Hair Mud Mask', '200 gm', 1050, 128, 0),
  ('BT-CATALOG-033', 'D Miracle Anti Pelliculaire', '100 ml', 700, 19, 0),
  ('BT-CATALOG-034', 'D Pro Shampoo', '250 ml', 700, 227, 0),
  ('BT-CATALOG-035', 'Argan Oil', '50 ml', 1100, 381, 95),
  ('BT-CATALOG-036', 'S Pro Protin Shampoo', '250 ml', 800, 256, 0),
  ('BT-CATALOG-037', 'S Pro Protin Mask', '250 ml', 800, 56, 0),
  ('BT-CATALOG-038', 'S Pro Syrum', '110 ml', 800, 69, 0),
  ('BT-CATALOG-039', 'Injection Repair Shampoo', '1000 ml', 2500, 80, 0),
  ('BT-CATALOG-040', 'Injection Nutri Oil Shampoo', '1000 ml', 2500, NULL, 0),
  ('BT-CATALOG-041', 'Injection Nutri Oil Mask', '500 gm', 1700, 24, 0),
  ('BT-CATALOG-042', 'Injection Smoothing Shampoo', '1000 ml', 2500, 28, 0),
  ('BT-CATALOG-043', 'Injection Smoothing Mask', '500 gm', 1700, 72, 0),
  ('BT-CATALOG-044', 'Injection Repair Mask', '500 gm', 1700, 60, 0),
  ('BT-CATALOG-045', 'Gen Pro Hair Colour 2/0', '100 gm', 549, NULL, 0),
  ('BT-CATALOG-046', 'Gen Pro Hair Colour 3/0', '100 gm', 549, NULL, 0),
  ('BT-CATALOG-047', 'Gen Pro Hair Colour 4/0', '100 gm', 549, NULL, 0),
  ('BT-CATALOG-048', 'Gen Pro Hair Colour 5/0', '100 gm', 549, NULL, 0),
  ('BT-CATALOG-049', 'Gen Pro Developer', '1000 ml', 650, 13, 0),
  ('BT-CATALOG-050', 'Microtox', '1000 ml', 20000, 48, 0),
  ('BT-CATALOG-051', 'Microtox Shampoo', '250 ml', 999, 3, 0),
  ('BT-CATALOG-052', 'Microtox Mask', '200 gm', 999, 35, 0),
  ('BT-CATALOG-053', 'Bond Golden Caviae Kit', NULL, 9999, 27, 0),
  ('BT-CATALOG-054', 'Bond Plex Kit', '100 ml', 9999, 66, 0),
  ('BT-CATALOG-055', 'Bond Revival Luxe x 3 Nos', '300 ml', 9999, 30, 0),
  ('BT-CATALOG-056', 'Bond Revival Luxe', '100 ml', 3999, 36, 0);

UPDATE "Product" AS product
SET "name" = catalogue.name,
    "variant" = catalogue.volume,
    "unitPrice" = catalogue.mrp,
    "updatedAt" = NOW()
FROM bt_catalogue_update AS catalogue
WHERE product."sku" = catalogue.sku;

-- Older order rows only had the generic unit before package sizes existed.
UPDATE "OrderItem" AS item
SET "packageSnapshot" = product."variant"
FROM "Product" AS product
WHERE item."productId" = product."id"
  AND product."variant" IS NOT NULL
  AND (item."packageSnapshot" IS NULL OR item."packageSnapshot" = product."unit");

CREATE TEMP TABLE bt_catalogue_stock_changes (
  product_id text PRIMARY KEY, new_stock integer NOT NULL, quantity_change integer NOT NULL
) ON COMMIT DROP;
INSERT INTO bt_catalogue_stock_changes (product_id, new_stock, quantity_change)
SELECT product."id" AS product_id,
       catalogue.target_stock AS new_stock,
       catalogue.target_stock - product."stockOnHand" AS quantity_change
FROM "Product" AS product
JOIN bt_catalogue_update AS catalogue ON catalogue.sku = product."sku"
WHERE catalogue.target_stock IS NOT NULL
  AND product."stockOnHand" = catalogue.expected_stock
  AND product."stockOnHand" <> catalogue.target_stock
FOR UPDATE OF product;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM bt_catalogue_stock_changes)
     AND NOT EXISTS (
       SELECT 1 FROM "UserRole" AS assignment
       JOIN "Role" AS role ON role."id" = assignment."roleId"
       WHERE role."key" = 'SUPER_ADMIN'
     ) THEN
    RAISE EXCEPTION 'Catalogue stock adjustment requires a Super Admin audit actor';
  END IF;
END $$;

UPDATE "Product" AS product
SET "stockOnHand" = changes.new_stock, "updatedAt" = NOW()
FROM bt_catalogue_stock_changes AS changes
WHERE product."id" = changes.product_id;

INSERT INTO "StockMovement" ("id", "productId", "type", "quantityChange", "reason", "recordedById", "createdAt")
SELECT md5(random()::text || clock_timestamp()::text || changes.product_id),
       changes.product_id, 'ADJUSTMENT'::"StockMovementType", changes.quantity_change,
       'Confirmed product catalogue count supplied 13 Oct 2026', administrator."id", NOW()
FROM bt_catalogue_stock_changes AS changes
CROSS JOIN (
  SELECT assignment."userId" AS "id" FROM "UserRole" AS assignment
  JOIN "Role" AS role ON role."id" = assignment."roleId"
  WHERE role."key" = 'SUPER_ADMIN'
  ORDER BY assignment."assignedAt" LIMIT 1
) AS administrator;
COMMIT;
