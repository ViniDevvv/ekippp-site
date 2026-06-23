-- Table des commandes
CREATE TABLE IF NOT EXISTS orders (
  order_id       TEXT PRIMARY KEY,
  discord_id     TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  status         TEXT DEFAULT 'pending', -- pending | validated | delivered
  license_key    TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Créer une commande (appelé par le site)
CREATE OR REPLACE FUNCTION create_order(p_order_id TEXT, p_discord_id TEXT, p_payment_method TEXT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO orders (order_id, discord_id, payment_method)
  VALUES (p_order_id, p_discord_id, p_payment_method)
  ON CONFLICT (order_id) DO NOTHING;
  RETURN 'OK';
END;
$$;
GRANT EXECUTE ON FUNCTION create_order(TEXT, TEXT, TEXT) TO anon;

-- Lire le statut d'une commande (appelé par la page de statut)
CREATE OR REPLACE FUNCTION get_order_status(p_order_id TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v orders%ROWTYPE;
BEGIN
  SELECT * INTO v FROM orders WHERE order_id = p_order_id;
  IF NOT FOUND THEN RETURN json_build_object('found', false); END IF;
  RETURN json_build_object(
    'found', true,
    'status', v.status,
    'license_key', CASE WHEN v.status = 'delivered' THEN v.license_key ELSE NULL END,
    'payment_method', v.payment_method,
    'created_at', v.created_at
  );
END;
$$;
GRANT EXECUTE ON FUNCTION get_order_status(TEXT) TO anon;
