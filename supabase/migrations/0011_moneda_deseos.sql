-- ═══════════════════════════════════════════════════════════════
-- LIFE OS 2027 · Moneda de los deseos de la wishlist
-- Ejecutar después de 0010. Se puede ejecutar más de una vez.
--
--  - wishlist_items.currency: moneda del precio, la de la tienda (COP, USD o EUR).
--    Los deseos que ya existían quedan en COP. El precio ya es numeric(14,2): conserva centavos.
--  - wishlist_items.image_url: puede ser «archivo:<id>» (imagen pegada o subida en el dispositivo).
-- ═══════════════════════════════════════════════════════════════

alter table public.wishlist_items add column if not exists currency text not null default 'COP';
alter table public.wishlist_items drop constraint if exists wishlist_items_currency_valida;
alter table public.wishlist_items add constraint wishlist_items_currency_valida check (currency in ('COP', 'USD', 'EUR'));
