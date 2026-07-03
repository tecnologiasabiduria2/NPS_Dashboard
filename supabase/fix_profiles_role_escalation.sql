-- FIX SEGURIDAD 2026-07-02: evitar que un cliente se auto-ascienda a admin/owner.
-- La politica RLS "profiles_update" (schema.sql:150) solo verifica id = auth.uid(),
-- sin restringir que columnas puede cambiar. Cualquier usuario autenticado podia
-- hacer PATCH /rest/v1/profiles?id=eq.<su-uid> con {"role":"owner"} y escalar.
--
-- Fix: trigger que bloquea cambios de "role" salvo que quien ejecuta el UPDATE
-- ya sea admin/owner, o la operacion venga de un contexto sin JWT (service role /
-- SQL editor / backend admin), que ya es un canal de confianza existente en la app.

CREATE OR REPLACE FUNCTION prevent_role_self_escalation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     AND auth.uid() IS NOT NULL
     AND NOT (is_admin() OR is_owner()) THEN
    RAISE EXCEPTION 'No tienes permiso para cambiar el rol';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_prevent_role_escalation ON profiles;
CREATE TRIGGER profiles_prevent_role_escalation
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION prevent_role_self_escalation();
