-- =====================================================
-- RLS Configuration for Products and Categories
-- =====================================================
-- Enable public read access to products and categories
-- Admin can do everything

-- =====================================================
-- CATEGORIES TABLE
-- =====================================================

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Everyone can read categories (even unauthenticated for public catalog)
CREATE POLICY "categories_select_all"
    ON categories FOR SELECT
    USING (true);

-- Only authenticated users can insert/update/delete
CREATE POLICY "categories_modify_authenticated"
    ON categories FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- =====================================================
-- PRODUCTS TABLE
-- =====================================================

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Everyone can read active products
CREATE POLICY "products_select_active"
    ON products FOR SELECT
    USING (ativo = true OR auth.uid() IS NOT NULL);

-- Authenticated users can do everything
CREATE POLICY "products_modify_authenticated"
    ON products FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- =====================================================
-- LOTS TABLE
-- =====================================================

ALTER TABLE lots ENABLE ROW LEVEL SECURITY;

-- Everyone can read open lots
CREATE POLICY "lots_select_open"
    ON lots FOR SELECT
    USING (status = 'aberto' OR auth.uid() IS NOT NULL);

-- Authenticated users can do everything
CREATE POLICY "lots_modify_authenticated"
    ON lots FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- =====================================================
-- LOT_PRODUCTS TABLE
-- =====================================================

ALTER TABLE lot_products ENABLE ROW LEVEL SECURITY;

-- Everyone can read lot products
CREATE POLICY "lot_products_select_all"
    ON lot_products FOR SELECT
    USING (true);

-- Authenticated users can modify
CREATE POLICY "lot_products_modify_authenticated"
    ON lot_products FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- =====================================================
-- ORDERS TABLE
-- =====================================================

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Users can see their own orders
CREATE POLICY "orders_select_own"
    ON orders FOR SELECT
    USING (auth.uid() IN (SELECT auth_id FROM clients WHERE id = client_id));

-- Users can create their own orders
CREATE POLICY "orders_insert_own"
    ON orders FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() IN (SELECT auth_id FROM clients WHERE id = client_id));

-- Users can update their own pending orders
CREATE POLICY "orders_update_own"
    ON orders FOR UPDATE
    USING (
        auth.uid() IN (SELECT auth_id FROM clients WHERE id = client_id) 
        AND status = 'pendente'
    );

-- Admins can see all orders
CREATE POLICY "orders_admin_all"
    ON orders FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM clients 
            WHERE auth_id = auth.uid() AND role = 'admin'
        )
    );

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Check RLS status
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename IN ('categories', 'products', 'lots', 'lot_products', 'orders')
ORDER BY tablename;

-- Check policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE tablename IN ('categories', 'products', 'lots', 'lot_products', 'orders')
ORDER BY tablename, policyname;
