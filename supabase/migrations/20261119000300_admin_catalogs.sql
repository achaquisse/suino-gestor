-- Catalogs (treatment products, breeds, symptoms) are managed by the platform super admin from
-- the admin area. Members keep reading them for their forms; only the super admin writes.
drop policy if exists treatment_products_write on public.treatment_products;
drop policy if exists breeds_write on public.breeds;
drop policy if exists symptoms_write on public.symptoms;
create policy treatment_products_write on public.treatment_products for all
  using (public.is_super_admin()) with check (public.is_super_admin());
create policy breeds_write on public.breeds for all
  using (public.is_super_admin()) with check (public.is_super_admin());
create policy symptoms_write on public.symptoms for all
  using (public.is_super_admin()) with check (public.is_super_admin());
