-- Local development only: `supabase db reset` loads this after the migrations.
-- Never runs in production. Creates three password users (password: suino123)
-- that the dev login picker (src/app/Login.tsx → DEV_USERS) signs in as.
--
--   dono@suinogestor.dev      owner of Granja Boane AND Quinta da Matola
--   tratador@suinogestor.dev  caretaker at Granja Boane
--   vet@suinogestor.dev       vet at Quinta da Matola
--   achaquisse1@gmail.com     super admin (SUPER_ADMIN_EMAIL in .env, applied by `npm run db:reset`)

do $$
declare
  u_owner uuid := '00000000-0000-4000-a000-000000000001';
  u_care  uuid := '00000000-0000-4000-a000-000000000002';
  u_vet   uuid := '00000000-0000-4000-a000-000000000003';
  u_admin uuid := '00000000-0000-4000-a000-000000000004';
  f_boane  uuid := '00000000-0000-4000-b000-000000000001';
  f_matola uuid := '00000000-0000-4000-b000-000000000002';
  u record;
begin
  for u in
    select * from (values
      (u_owner, 'dono@suinogestor.dev', 'Carlos Nhantumbo'),
      (u_care, 'tratador@suinogestor.dev', 'João Mabunda'),
      (u_vet, 'vet@suinogestor.dev', 'Dra. Sitoe'),
      (u_admin, 'achaquisse1@gmail.com', 'Administrador')
    ) as t(id, email, name)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
      extensions.crypt('suino123', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', u.name), now(), now(),
      '', '', '', ''
    );
    insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), u.id, u.id::text, 'email',
      jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true), now(), now(), now());
  end loop;

  insert into public.farms (id, name, created_by) values
    (f_boane, 'Granja Boane', u_owner),
    (f_matola, 'Quinta da Matola', u_owner);

  insert into public.farm_members (farm_id, user_id, role, display_name) values
    (f_boane, u_owner, 'owner', 'Carlos Nhantumbo'),
    (f_matola, u_owner, 'owner', 'Carlos Nhantumbo'),
    (f_boane, u_care, 'caretaker', 'João Mabunda'),
    (f_matola, u_vet, 'vet', 'Dra. Sitoe');

  perform public.seed_defaults(f_boane);
  perform public.seed_demo(f_boane, 'Carlos Nhantumbo');
  perform public.seed_defaults(f_matola);
  perform public.seed_demo(f_matola, 'Carlos Nhantumbo');
end;
$$;
