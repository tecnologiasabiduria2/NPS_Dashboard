-- Renombra el slug interno de "Impulso Empresarial" de workshop -> impulso
-- (hasta hoy solo se le habia cambiado el titulo visible, ver B20 en
-- PENDIENTES.md; el webhook de GHL ya mandaba "impulso" y se traducia con un
-- alias — con este rename el alias ya no hace falta y se elimino del codigo).
--
-- De paso corrige el unico acceso ya calculado con el default viejo de 6
-- meses (deberia ser 4, confirmado por Juan 2026-07-14): el WHERE solo toca
-- filas cuyo access_until coincide EXACTAMENTE con access_started + 6 meses,
-- para no afectar ninguna fecha explicita distinta que haya mandado GHL.

BEGIN;

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_slug_check;

UPDATE products SET slug = 'impulso' WHERE slug = 'workshop';

ALTER TABLE products ADD CONSTRAINT products_slug_check
  CHECK (slug IN ('impulso', 'desafio', 'sabiduria'));

UPDATE user_access ua
SET access_until = (ua.access_started + INTERVAL '4 months')::date,
    updated_at = now()
FROM products p
WHERE ua.product_id = p.id
  AND p.slug = 'impulso'
  AND ua.access_until = (ua.access_started + INTERVAL '6 months')::date;

COMMIT;
