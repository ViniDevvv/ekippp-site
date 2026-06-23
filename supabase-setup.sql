-- Colle ce SQL dans l'éditeur SQL de ton projet Supabase

-- Table des licences
CREATE TABLE licenses (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key           TEXT UNIQUE NOT NULL,
  hwid          TEXT,
  email         TEXT,
  activated_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Désactive l'accès public (on passe par la fonction uniquement)
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;

-- Fonction d'activation / validation (appelée par l'app)
CREATE OR REPLACE FUNCTION activate_license(p_key TEXT, p_hwid TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_hwid TEXT;
BEGIN
  SELECT hwid INTO v_hwid
  FROM licenses
  WHERE key = p_key;

  IF NOT FOUND THEN
    RETURN 'INVALID';
  END IF;

  IF v_hwid IS NULL THEN
    -- Première activation : lie le HWID à la clé
    UPDATE licenses
    SET hwid = p_hwid, activated_at = NOW()
    WHERE key = p_key;
    RETURN 'ACTIVATED';
  ELSIF v_hwid = p_hwid THEN
    -- Même PC : OK
    RETURN 'VALID';
  ELSE
    -- PC différent : refusé
    RETURN 'HWID_MISMATCH';
  END IF;
END;
$$;

-- Autorise l'appel de la fonction sans authentification (anon key)
GRANT EXECUTE ON FUNCTION activate_license(TEXT, TEXT) TO anon;
