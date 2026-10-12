ALTER TABLE "OrderItem" ADD COLUMN "productNameSnapshot" TEXT;
ALTER TABLE "OrderItem" ADD COLUMN "packageSnapshot" TEXT;

UPDATE "OrderItem" AS item
SET "productNameSnapshot" = product."name",
    "packageSnapshot" = COALESCE(NULLIF(product."variant", ''), product."unit")
FROM "Product" AS product
WHERE item."productId" = product."id";
