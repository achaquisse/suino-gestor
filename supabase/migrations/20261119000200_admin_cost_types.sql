-- Cost types (categories) are managed by the platform super admin from the admin area.
-- Every member still reads them (forms need them); only the super admin writes.
drop policy if exists "categories: owners write" on public.categories;
create policy "categories: super admin write" on public.categories for all
  using (public.is_super_admin()) with check (public.is_super_admin());
