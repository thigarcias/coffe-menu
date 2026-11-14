begin;

-- Base multiunidade do cardápio. A unidade é sempre vinculada a auth.uid();
-- versões e publicações são snapshots append-only.

create schema if not exists coffe_menu_private;
revoke all on schema coffe_menu_private from public, anon, authenticated;

create table public.cafes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete restrict,
  slug text not null unique,
  name text not null,
  is_active boolean not null default true,
  published_publication_id uuid,
  created_at timestamptz not null default now(),
  constraint cafes_slug_format check (
    length(slug) between 1 and 80
    and slug = lower(slug)
    and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  constraint cafes_name_nonempty check (length(btrim(name)) between 1 and 120)
);

create index cafes_owner_id_idx on public.cafes (owner_id);

create table public.menu_drafts (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public.cafes (id) on delete restrict,
  name text not null,
  current_version integer not null default 1 check (current_version > 0),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint menu_drafts_cafe_id_id_unique unique (cafe_id, id),
  constraint menu_drafts_name_nonempty check (length(btrim(name)) between 1 and 120)
);

create index menu_drafts_cafe_updated_idx
  on public.menu_drafts (cafe_id, updated_at desc)
  where deleted_at is null;

create table public.menu_draft_versions (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null,
  draft_id uuid not null,
  version integer not null check (version > 0),
  menu jsonb not null check (jsonb_typeof(menu) = 'object'),
  saved_by uuid references auth.users (id) on delete set null,
  saved_at timestamptz not null default now(),
  constraint menu_draft_versions_cafe_draft_fk
    foreign key (cafe_id, draft_id)
    references public.menu_drafts (cafe_id, id) on delete restrict,
  constraint menu_draft_versions_draft_version_unique unique (draft_id, version),
  constraint menu_draft_versions_cafe_draft_id_unique unique (cafe_id, draft_id, id)
);

create index menu_draft_versions_cafe_draft_version_idx
  on public.menu_draft_versions (cafe_id, draft_id, version desc);

create table public.menu_publications (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null,
  draft_id uuid not null,
  version_id uuid not null,
  draft_name text not null,
  published_by uuid references auth.users (id) on delete set null,
  published_at timestamptz not null default now(),
  constraint menu_publications_cafe_id_id_unique unique (cafe_id, id),
  constraint menu_publications_cafe_draft_fk
    foreign key (cafe_id, draft_id)
    references public.menu_drafts (cafe_id, id) on delete restrict,
  constraint menu_publications_version_fk
    foreign key (cafe_id, draft_id, version_id)
    references public.menu_draft_versions (cafe_id, draft_id, id) on delete restrict,
  constraint menu_publications_draft_name_nonempty check (length(btrim(draft_name)) between 1 and 120)
);

create index menu_publications_cafe_published_idx
  on public.menu_publications (cafe_id, published_at desc);

alter table public.cafes
  add constraint cafes_published_publication_fk
  foreign key (id, published_publication_id)
  references public.menu_publications (cafe_id, id)
  on delete restrict;

create table public.product_availability (
  cafe_id uuid not null references public.cafes (id) on delete restrict,
  product_id text not null,
  available boolean not null default false,
  note text,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (cafe_id, product_id),
  constraint product_availability_product_id_nonempty check (length(btrim(product_id)) between 1 and 120)
);

alter table public.cafes enable row level security;
alter table public.menu_drafts enable row level security;
alter table public.menu_draft_versions enable row level security;
alter table public.menu_publications enable row level security;
alter table public.product_availability enable row level security;

create policy cafes_owner_select
  on public.cafes for select to authenticated
  using ((select auth.uid()) = owner_id);

create policy cafes_public_select_published
  on public.cafes for select to anon
  using (is_active);

create policy menu_drafts_owner_select
  on public.menu_drafts for select to authenticated
  using (exists (
    select 1 from public.cafes c
    where c.id = menu_drafts.cafe_id
      and c.owner_id = (select auth.uid())
  ));

create policy menu_draft_versions_owner_select
  on public.menu_draft_versions for select to authenticated
  using (exists (
    select 1 from public.cafes c
    where c.id = menu_draft_versions.cafe_id
      and c.owner_id = (select auth.uid())
  ));

create policy menu_draft_versions_public_current_select
  on public.menu_draft_versions for select to anon
  using (exists (
    select 1
    from public.menu_publications p
    join public.cafes c on c.id = p.cafe_id
    where p.cafe_id = menu_draft_versions.cafe_id
      and p.version_id = menu_draft_versions.id
      and c.published_publication_id = p.id
      and c.is_active
  ));

create policy menu_publications_owner_select
  on public.menu_publications for select to authenticated
  using (exists (
    select 1 from public.cafes c
    where c.id = menu_publications.cafe_id
      and c.owner_id = (select auth.uid())
  ));

create policy menu_publications_public_current_select
  on public.menu_publications for select to anon
  using (exists (
    select 1 from public.cafes c
    where c.id = menu_publications.cafe_id
      and c.published_publication_id = menu_publications.id
      and c.is_active
  ));

create policy product_availability_owner_select
  on public.product_availability for select to authenticated
  using (exists (
    select 1 from public.cafes c
    where c.id = product_availability.cafe_id
      and c.owner_id = (select auth.uid())
  ));

create policy product_availability_public_current_select
  on public.product_availability for select to anon
  using (exists (
    select 1 from public.cafes c
    where c.id = product_availability.cafe_id
      and c.is_active
      and c.published_publication_id is not null
  ));

-- Leitura direta é somente SELECT. Toda escrita passa pelas RPCs transacionais abaixo.
revoke all on table public.cafes from public, anon, authenticated;
revoke all on table public.menu_drafts from public, anon, authenticated;
revoke all on table public.menu_draft_versions from public, anon, authenticated;
revoke all on table public.menu_publications from public, anon, authenticated;
revoke all on table public.product_availability from public, anon, authenticated;

grant select (id, owner_id, slug, name, is_active, published_publication_id, created_at)
  on public.cafes to authenticated;
grant select (id, slug, name, is_active, published_publication_id)
  on public.cafes to anon;
grant select (id, cafe_id, name, current_version, created_by, created_at, updated_at, deleted_at)
  on public.menu_drafts to authenticated;
grant select (id, cafe_id, draft_id, version, menu, saved_by, saved_at)
  on public.menu_draft_versions to authenticated;
grant select (id, cafe_id, draft_id, version, menu, saved_at)
  on public.menu_draft_versions to anon;
grant select (id, cafe_id, draft_id, version_id, draft_name, published_by, published_at)
  on public.menu_publications to authenticated;
grant select (id, cafe_id, draft_id, version_id, draft_name, published_at)
  on public.menu_publications to anon;
grant select (cafe_id, product_id, available, updated_by, updated_at)
  on public.product_availability to authenticated;
grant select (cafe_id, product_id, available, note, updated_by, updated_at)
  on public.product_availability to authenticated;
grant select (cafe_id, product_id, available, updated_at)
  on public.product_availability to anon;

-- A chave inclui o id da unidade, UUID do arquivo e uma extensão autorizada.
-- A chave fica no snapshot; nunca se persiste URL pública ou URL assinada.
create or replace function coffe_menu_private.assert_media_key(
  p_cafe_id uuid,
  p_key text,
  p_kind text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_pattern text;
begin
  if p_kind = 'video' then
    v_pattern := '^' || p_cafe_id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.]mp4$';
  else
    v_pattern := '^' || p_cafe_id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](jpg|png|webp)$';
  end if;

  if p_key is null or p_key !~* v_pattern then
    raise exception using errcode = '22023', message = 'A mídia precisa usar uma chave UUID pertencente a esta unidade.';
  end if;

  if not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'coffe-menu-media'
      and o.name = p_key
  ) then
    raise exception using errcode = '22023', message = 'A mídia informada não existe no armazenamento privado.';
  end if;
end;
$$;

create or replace function coffe_menu_private.assert_menu_snapshot(p_menu jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_item jsonb;
  v_price jsonb;
  v_category jsonb;
  v_color text;
begin
  if p_menu is null or jsonb_typeof(p_menu) is distinct from 'object' then
    raise exception using errcode = '22023', message = 'O cardápio precisa ser um objeto JSON.';
  end if;
  if jsonb_typeof(p_menu -> 'cafe') is distinct from 'object'
     or nullif(btrim(p_menu #>> '{cafe,name}'), '') is null then
    raise exception using errcode = '22023', message = 'Informe o nome da cafeteria em cafe.name.';
  end if;
  if jsonb_typeof(p_menu -> 'categories') is distinct from 'array' then
    raise exception using errcode = '22023', message = 'O cardápio precisa ter uma lista de categorias.';
  end if;
  if jsonb_array_length(p_menu -> 'categories') = 0 then
    raise exception using errcode = '22023', message = 'O cardápio precisa ter ao menos uma categoria.';
  end if;
  if jsonb_typeof(p_menu -> 'items') is distinct from 'array' then
    raise exception using errcode = '22023', message = 'O cardápio precisa ter uma lista de produtos.';
  end if;
  if jsonb_array_length(p_menu -> 'items') = 0 then
    raise exception using errcode = '22023', message = 'O cardápio precisa ter ao menos um produto.';
  end if;

  for v_category in select value from jsonb_array_elements(p_menu -> 'categories') as x(value)
  loop
    if jsonb_typeof(v_category) is distinct from 'object'
       or nullif(btrim(v_category ->> 'id'), '') is null
       or nullif(btrim(v_category ->> 'name'), '') is null then
      raise exception using errcode = '22023', message = 'Cada categoria precisa ter id e nome.';
    end if;
  end loop;

  if exists (
    select 1
    from jsonb_array_elements(p_menu -> 'categories') as x(value)
    group by x.value ->> 'id'
    having count(*) > 1
  ) then
    raise exception using errcode = '22023', message = 'Os ids das categorias precisam ser únicos.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_menu -> 'items') as x(value)
    group by x.value ->> 'id'
    having count(*) > 1
  ) then
    raise exception using errcode = '22023', message = 'Os ids dos produtos precisam ser únicos.';
  end if;

  for v_item in select value from jsonb_array_elements(p_menu -> 'items') as x(value)
  loop
    if jsonb_typeof(v_item) is distinct from 'object'
       or nullif(btrim(v_item ->> 'id'), '') is null
       or nullif(btrim(v_item ->> 'name'), '') is null
       or nullif(btrim(v_item ->> 'category'), '') is null then
      raise exception using errcode = '22023', message = 'Cada produto precisa ter id, nome e categoria.';
    end if;
    if not exists (
      select 1 from jsonb_array_elements(p_menu -> 'categories') as x(value)
      where x.value ->> 'id' = v_item ->> 'category'
    ) then
      raise exception using errcode = '22023', message = 'Todo produto deve referenciar uma categoria existente.';
    end if;
    if jsonb_typeof(v_item -> 'prices') is distinct from 'array' then
      raise exception using errcode = '22023', message = 'Cada produto precisa ter uma lista de preços.';
    end if;
    if jsonb_array_length(v_item -> 'prices') = 0 then
      raise exception using errcode = '22023', message = 'Cada produto precisa ter ao menos uma opção de preço.';
    end if;

    for v_price in select value from jsonb_array_elements(v_item -> 'prices') as x(value)
    loop
      if jsonb_typeof(v_price) is distinct from 'object'
         or nullif(btrim(v_price ->> 'size'), '') is null
         or not (v_price ? 'price') then
        raise exception using errcode = '22023', message = 'Cada preço precisa ter tamanho e valor numérico.';
      end if;
      if jsonb_typeof(v_price -> 'price') is distinct from 'number' then
        raise exception using errcode = '22023', message = 'O preço de cada opção precisa ser numérico.';
      end if;
      if jsonb_typeof(v_price -> 'price') = 'number'
         and (v_price ->> 'price')::numeric < 0 then
        raise exception using errcode = '22023', message = 'O preço não pode ser negativo.';
      end if;
    end loop;

    if not (v_item ? 'image')
       or jsonb_typeof(v_item -> 'image') is distinct from 'string'
       or nullif(btrim(v_item ->> 'image'), '') is null then
      raise exception using errcode = '22023', message = 'Cada produto precisa de uma foto válida.';
    end if;
    if (v_item ? 'video') and v_item -> 'video' is distinct from 'null'::jsonb
       and (jsonb_typeof(v_item -> 'video') is distinct from 'string'
            or nullif(btrim(v_item ->> 'video'), '') is null) then
      raise exception using errcode = '22023', message = 'O vídeo deve ser uma chave de mídia ou nulo.';
    end if;
  end loop;

  if p_menu #> '{cafe,branding}' is not null
     and p_menu #> '{cafe,branding}' is distinct from 'null'::jsonb then
    if jsonb_typeof(p_menu #> '{cafe,branding}') is distinct from 'object' then
      raise exception using errcode = '22023', message = 'cafe.branding precisa ser um objeto JSON.';
    end if;
    foreach v_color in array array['accent_color', 'secondary_color']
    loop
      if p_menu #>> array['cafe', 'branding', v_color] is not null
         and p_menu #>> array['cafe', 'branding', v_color] !~ '^#[0-9A-Fa-f]{6}$' then
        raise exception using errcode = '22023', message = 'As cores da marca precisam usar o formato hexadecimal #RRGGBB.';
      end if;
    end loop;
    if p_menu #> '{cafe,branding,logo_key}' is not null
       and p_menu #> '{cafe,branding,logo_key}' is distinct from 'null'::jsonb
       and jsonb_typeof(p_menu #> '{cafe,branding,logo_key}') is distinct from 'string' then
      raise exception using errcode = '22023', message = 'branding.logo_key precisa ser uma chave de mídia ou nula.';
    end if;
  end if;
end;
$$;

create or replace function coffe_menu_private.assert_menu_media_keys(p_cafe_id uuid, p_menu jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_item jsonb;
  v_key text;
begin
  for v_item in select value from jsonb_array_elements(p_menu -> 'items') as x(value)
  loop
    if v_item -> 'image' is not null and v_item -> 'image' is distinct from 'null'::jsonb then
      v_key := v_item ->> 'image';
      perform coffe_menu_private.assert_media_key(p_cafe_id, v_key, 'image');
    end if;
    if v_item -> 'video' is not null and v_item -> 'video' is distinct from 'null'::jsonb then
      v_key := v_item ->> 'video';
      perform coffe_menu_private.assert_media_key(p_cafe_id, v_key, 'video');
    end if;
  end loop;

  if p_menu #> '{cafe,branding,logo_key}' is not null
     and p_menu #> '{cafe,branding,logo_key}' is distinct from 'null'::jsonb then
    perform coffe_menu_private.assert_media_key(p_cafe_id, p_menu #>> '{cafe,branding,logo_key}', 'image');
  end if;
end;
$$;

revoke all on all functions in schema coffe_menu_private from public, anon, authenticated;

create or replace function coffe_menu_private.assert_draft_payload(p_menu jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_menu is null or jsonb_typeof(p_menu) is distinct from 'object' then
    raise exception using errcode = '22023', message = 'O rascunho precisa ser um objeto JSON.';
  end if;
end;
$$;

create or replace function public.list_my_cafes()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(jsonb_build_object(
      'id', c.id,
      'slug', c.slug,
      'name', c.name,
      'is_active', c.is_active
    ) order by c.name),
    '[]'::jsonb
  )
  from public.cafes c
  where c.owner_id = (select auth.uid())
    and c.is_active;
$$;

create or replace function public.get_menu_editor(p_cafe_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'cafe', jsonb_build_object(
      'id', c.id,
      'slug', c.slug,
      'name', c.name,
      'is_active', c.is_active
    ),
    'published', (
      select jsonb_build_object(
        'publication_id', p.id,
        'draft_id', p.draft_id,
        'draft_name', p.draft_name,
        'version_id', v.id,
        'version', v.version,
        'published_at', p.published_at,
        'menu', v.menu
      )
      from public.menu_publications p
      join public.menu_draft_versions v
        on v.cafe_id = p.cafe_id and v.draft_id = p.draft_id and v.id = p.version_id
      where p.cafe_id = c.id and p.id = c.published_publication_id
    ),
    'drafts', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', d.id,
        'name', d.name,
        'created_at', d.created_at,
        'updated_at', d.updated_at,
        'current_version', d.current_version,
        'current_version_id', current_version.id,
        'menu', current_version.menu,
        'versions', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'id', history.id,
            'version', history.version,
            'saved_at', history.saved_at,
            'saved_by', history.saved_by
          ) order by history.version), '[]'::jsonb)
          from public.menu_draft_versions history
          where history.cafe_id = d.cafe_id and history.draft_id = d.id
        )
      ) order by d.updated_at desc), '[]'::jsonb)
      from public.menu_drafts d
      left join public.menu_draft_versions current_version
        on current_version.cafe_id = d.cafe_id
       and current_version.draft_id = d.id
       and current_version.version = d.current_version
      where d.cafe_id = c.id and d.deleted_at is null
    ),
    'archived_drafts', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', d.id,
        'name', d.name,
        'created_at', d.created_at,
        'updated_at', d.updated_at,
        'deleted_at', d.deleted_at,
        'current_version', d.current_version,
        'versions', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'id', history.id,
            'version', history.version,
            'saved_at', history.saved_at,
            'saved_by', history.saved_by
          ) order by history.version), '[]'::jsonb)
          from public.menu_draft_versions history
          where history.cafe_id = d.cafe_id and history.draft_id = d.id
        )
      ) order by d.deleted_at desc), '[]'::jsonb)
      from public.menu_drafts d
      where d.cafe_id = c.id and d.deleted_at is not null
    ),
    'publications', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'publication_id', p.id,
        'draft_id', p.draft_id,
        'draft_name', p.draft_name,
        'version_id', v.id,
        'version', v.version,
        'published_at', p.published_at,
        'published_by', p.published_by,
        'menu', v.menu
      ) order by p.published_at desc), '[]'::jsonb)
      from public.menu_publications p
      join public.menu_draft_versions v
        on v.cafe_id = p.cafe_id and v.draft_id = p.draft_id and v.id = p.version_id
      where p.cafe_id = c.id
    ),
    'availability', (
      select coalesce(jsonb_object_agg(a.product_id, a.available), '{}'::jsonb)
      from public.product_availability a
      where a.cafe_id = c.id
    )
  )
  from public.cafes c
  where c.id = p_cafe_id
    and c.owner_id = (select auth.uid())
    and c.is_active;
$$;

create or replace function coffe_menu_private.create_menu_draft(
  p_cafe_id uuid,
  p_name text,
  p_menu jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_draft_id uuid;
  v_version_id uuid;
  v_saved_at timestamptz;
begin
  if v_user_id is null or coalesce(auth.jwt() ->> 'is_anonymous', 'false') = 'true' then
    raise exception using errcode = '42501', message = 'É necessário entrar com uma conta permanente.';
  end if;
  perform 1 from public.cafes c
  where c.id = p_cafe_id and c.owner_id = v_user_id and c.is_active
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Unidade não encontrada ou inativa.';
  end if;
  if p_name is null or length(btrim(p_name)) not between 1 and 120 then
    raise exception using errcode = '22023', message = 'O nome do rascunho precisa ter de 1 a 120 caracteres.';
  end if;
  perform coffe_menu_private.assert_draft_payload(p_menu);

  insert into public.menu_drafts (cafe_id, name, current_version, created_by)
  values (p_cafe_id, btrim(p_name), 1, v_user_id)
  returning id into v_draft_id;

  insert into public.menu_draft_versions (cafe_id, draft_id, version, menu, saved_by)
  values (p_cafe_id, v_draft_id, 1, p_menu, v_user_id)
  returning id, saved_at into v_version_id, v_saved_at;

  return jsonb_build_object(
    'draft_id', v_draft_id,
    'version_id', v_version_id,
    'version', 1,
    'saved_at', v_saved_at
  );
end;
$$;

create or replace function coffe_menu_private.save_menu_draft(
  p_cafe_id uuid,
  p_draft_id uuid,
  p_expected_version integer,
  p_menu jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_current_version integer;
  v_next_version integer;
  v_version_id uuid;
  v_saved_at timestamptz;
begin
  if v_user_id is null or coalesce(auth.jwt() ->> 'is_anonymous', 'false') = 'true' then
    raise exception using errcode = '42501', message = 'É necessário entrar com uma conta permanente.';
  end if;
  perform 1 from public.cafes c
  where c.id = p_cafe_id and c.owner_id = v_user_id and c.is_active
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Unidade não encontrada ou inativa.';
  end if;
  select d.current_version into v_current_version
  from public.menu_drafts d
  where d.id = p_draft_id and d.cafe_id = p_cafe_id and d.deleted_at is null
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Rascunho não encontrado.';
  end if;
  if p_expected_version is distinct from v_current_version then
    raise exception using errcode = '40001', message = 'O rascunho mudou. Recarregue a versão atual antes de salvar.';
  end if;
  perform coffe_menu_private.assert_draft_payload(p_menu);

  v_next_version := v_current_version + 1;
  insert into public.menu_draft_versions (cafe_id, draft_id, version, menu, saved_by)
  values (p_cafe_id, p_draft_id, v_next_version, p_menu, v_user_id)
  returning id, saved_at into v_version_id, v_saved_at;
  update public.menu_drafts
  set current_version = v_next_version, updated_at = v_saved_at
  where id = p_draft_id and cafe_id = p_cafe_id;

  return jsonb_build_object(
    'draft_id', p_draft_id,
    'version_id', v_version_id,
    'version', v_next_version,
    'saved_at', v_saved_at
  );
end;
$$;

create or replace function coffe_menu_private.restore_menu_draft_version(
  p_cafe_id uuid,
  p_draft_id uuid,
  p_version_id uuid,
  p_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_source_name text;
  v_source_version integer;
  v_new_name text;
  v_menu jsonb;
  v_new_draft_id uuid;
  v_new_version_id uuid;
  v_saved_at timestamptz;
begin
  if v_user_id is null or coalesce(auth.jwt() ->> 'is_anonymous', 'false') = 'true' then
    raise exception using errcode = '42501', message = 'É necessário entrar com uma conta permanente.';
  end if;
  perform 1 from public.cafes c
  where c.id = p_cafe_id and c.owner_id = v_user_id and c.is_active
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Unidade não encontrada ou inativa.';
  end if;
  select d.name, v.version, v.menu
  into v_source_name, v_source_version, v_menu
  from public.menu_drafts d
  join public.menu_draft_versions v
    on v.cafe_id = d.cafe_id and v.draft_id = d.id
  where d.id = p_draft_id and d.cafe_id = p_cafe_id and v.id = p_version_id
  for update of d;
  if not found then
    raise exception using errcode = 'P0002', message = 'Versão anterior não encontrada neste rascunho.';
  end if;
  v_new_name := coalesce(nullif(btrim(p_name), ''), left(v_source_name || ' (restaurado v' || v_source_version || ')', 120));
  if length(v_new_name) not between 1 and 120 then
    raise exception using errcode = '22023', message = 'O nome do novo rascunho precisa ter de 1 a 120 caracteres.';
  end if;
  perform coffe_menu_private.assert_draft_payload(v_menu);

  insert into public.menu_drafts (cafe_id, name, current_version, created_by)
  values (p_cafe_id, v_new_name, 1, v_user_id)
  returning id into v_new_draft_id;
  insert into public.menu_draft_versions (cafe_id, draft_id, version, menu, saved_by)
  values (p_cafe_id, v_new_draft_id, 1, v_menu, v_user_id)
  returning id, saved_at into v_new_version_id, v_saved_at;

  return jsonb_build_object(
    'draft_id', v_new_draft_id,
    'version_id', v_new_version_id,
    'version', 1,
    'saved_at', v_saved_at,
    'name', v_new_name
  );
end;
$$;

create or replace function coffe_menu_private.rename_menu_draft(
  p_cafe_id uuid,
  p_draft_id uuid,
  p_name text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_updated_at timestamptz;
begin
  if v_user_id is null or coalesce(auth.jwt() ->> 'is_anonymous', 'false') = 'true' then
    raise exception using errcode = '42501', message = 'É necessário entrar com uma conta permanente.';
  end if;
  perform 1 from public.cafes c
  where c.id = p_cafe_id and c.owner_id = v_user_id and c.is_active
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Unidade não encontrada ou inativa.';
  end if;
  if p_name is null or length(btrim(p_name)) not between 1 and 120 then
    raise exception using errcode = '22023', message = 'O nome do rascunho precisa ter de 1 a 120 caracteres.';
  end if;
  update public.menu_drafts d
  set name = btrim(p_name), updated_at = now()
  where d.id = p_draft_id and d.cafe_id = p_cafe_id and d.deleted_at is null
  returning d.updated_at into v_updated_at;
  if not found then
    raise exception using errcode = 'P0002', message = 'Rascunho não encontrado.';
  end if;
  return jsonb_build_object('draft_id', p_draft_id, 'name', btrim(p_name), 'updated_at', v_updated_at);
end;
$$;

create or replace function coffe_menu_private.delete_menu_draft(
  p_cafe_id uuid,
  p_draft_id uuid,
  p_expected_version integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_current_version integer;
begin
  if v_user_id is null or coalesce(auth.jwt() ->> 'is_anonymous', 'false') = 'true' then
    raise exception using errcode = '42501', message = 'É necessário entrar com uma conta permanente.';
  end if;
  perform 1 from public.cafes c
  where c.id = p_cafe_id and c.owner_id = v_user_id and c.is_active
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Unidade não encontrada ou inativa.';
  end if;
  select d.current_version into v_current_version
  from public.menu_drafts d
  where d.id = p_draft_id and d.cafe_id = p_cafe_id and d.deleted_at is null
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Rascunho não encontrado.';
  end if;
  if p_expected_version is distinct from v_current_version then
    raise exception using errcode = '40001', message = 'O rascunho mudou. Recarregue antes de excluir.';
  end if;
  update public.menu_drafts
  set deleted_at = now(), updated_at = now()
  where id = p_draft_id and cafe_id = p_cafe_id;
  -- As versões e as publicações não são apagadas.
end;
$$;

create or replace function coffe_menu_private.publish_menu_draft(
  p_cafe_id uuid,
  p_draft_id uuid,
  p_expected_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_current_version integer;
  v_draft_name text;
  v_version_id uuid;
  v_menu jsonb;
  v_publication_id uuid;
  v_published_at timestamptz;
begin
  if v_user_id is null or coalesce(auth.jwt() ->> 'is_anonymous', 'false') = 'true' then
    raise exception using errcode = '42501', message = 'É necessário entrar com uma conta permanente.';
  end if;
  perform 1 from public.cafes c
  where c.id = p_cafe_id and c.owner_id = v_user_id and c.is_active
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Unidade não encontrada ou inativa.';
  end if;
  select d.current_version, d.name into v_current_version, v_draft_name
  from public.menu_drafts d
  where d.id = p_draft_id and d.cafe_id = p_cafe_id and d.deleted_at is null
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Rascunho não encontrado.';
  end if;
  if p_expected_version is distinct from v_current_version then
    raise exception using errcode = '40001', message = 'O rascunho mudou. Recarregue a versão atual antes de publicar.';
  end if;
  select v.id, v.menu into v_version_id, v_menu
  from public.menu_draft_versions v
  where v.cafe_id = p_cafe_id and v.draft_id = p_draft_id and v.version = v_current_version;
  if not found then
    raise exception using errcode = 'P0002', message = 'A versão atual do rascunho não foi encontrada.';
  end if;

  perform coffe_menu_private.assert_menu_snapshot(v_menu);
  perform coffe_menu_private.assert_menu_media_keys(p_cafe_id, v_menu);

  insert into public.menu_publications (cafe_id, draft_id, version_id, draft_name, published_by)
  values (p_cafe_id, p_draft_id, v_version_id, v_draft_name, v_user_id)
  returning id, published_at into v_publication_id, v_published_at;
  update public.cafes
  set published_publication_id = v_publication_id
  where id = p_cafe_id and owner_id = v_user_id;

  -- Remove overrides for products absent from the new published snapshot.
  delete from public.product_availability a
  where a.cafe_id = p_cafe_id
    and not exists (
      select 1 from jsonb_array_elements(v_menu -> 'items') as item(value)
      where item.value ->> 'id' = a.product_id
    );

  return jsonb_build_object(
    'publication_id', v_publication_id,
    'version_id', v_version_id,
    'version', v_current_version,
    'published_at', v_published_at
  );
end;
$$;

create or replace function coffe_menu_private.set_product_availability(
  p_cafe_id uuid,
  p_product_id text,
  p_available boolean,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_menu jsonb;
  v_updated_at timestamptz := now();
begin
  if v_user_id is null or coalesce(auth.jwt() ->> 'is_anonymous', 'false') = 'true' then
    raise exception using errcode = '42501', message = 'É necessário entrar com uma conta permanente.';
  end if;
  if p_product_id is null or length(btrim(p_product_id)) not between 1 and 120 then
    raise exception using errcode = '22023', message = 'Informe o id do produto.';
  end if;
  if p_note is not null and length(btrim(p_note)) > 200 then
    raise exception using errcode = '22023', message = 'A observação pode ter até 200 caracteres.';
  end if;
  perform 1 from public.cafes c
  where c.id = p_cafe_id and c.owner_id = v_user_id and c.is_active
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Unidade não encontrada ou inativa.';
  end if;
  select v.menu into v_menu
  from public.cafes c
  join public.menu_publications p on p.cafe_id = c.id and p.id = c.published_publication_id
  join public.menu_draft_versions v
    on v.cafe_id = p.cafe_id and v.draft_id = p.draft_id and v.id = p.version_id
  where c.id = p_cafe_id;
  if not found or not exists (
    select 1 from jsonb_array_elements(v_menu -> 'items') as item(value)
    where item.value ->> 'id' = p_product_id
  ) then
    raise exception using errcode = 'P0002', message = 'O produto não existe no cardápio publicado desta unidade.';
  end if;

  if p_available then
    delete from public.product_availability
    where cafe_id = p_cafe_id and product_id = p_product_id;
  else
    insert into public.product_availability (cafe_id, product_id, available, note, updated_by, updated_at)
    values (p_cafe_id, p_product_id, false, nullif(btrim(p_note), ''), v_user_id, v_updated_at)
    on conflict (cafe_id, product_id) do update
      set available = false,
          note = excluded.note,
          updated_by = excluded.updated_by,
          updated_at = excluded.updated_at;
  end if;

  return jsonb_build_object(
    'cafe_id', p_cafe_id,
    'product_id', p_product_id,
    'available', p_available,
    'note', nullif(btrim(p_note), ''),
    'updated_at', v_updated_at
  );
end;
$$;

create or replace function public.get_published_menu(p_slug text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'cafe', jsonb_build_object('id', c.id, 'slug', c.slug, 'name', c.name),
    'revision', case when p.id is null then null else jsonb_build_object(
      'publication_id', p.id,
      'draft_id', p.draft_id,
      'version_id', v.id,
      'version', v.version,
      'published_at', p.published_at
    ) end,
    'menu', v.menu,
    'availability', coalesce((
      select jsonb_object_agg(a.product_id, a.available)
      from public.product_availability a
      where a.cafe_id = c.id and p.id is not null
    ), '{}'::jsonb)
  )
  from public.cafes c
  left join public.menu_publications p
    on p.cafe_id = c.id and p.id = c.published_publication_id
  left join public.menu_draft_versions v
    on v.cafe_id = p.cafe_id and v.draft_id = p.draft_id and v.id = p.version_id
  where c.slug = p_slug and c.is_active;
$$;

-- Superfície pública invoker. A lógica privilegiada fica em private e confirma
-- auth.uid()/proprietário; coffe_menu_private não deve ser marcado como schema exposto no Data API.
create or replace function public.create_menu_draft(
  p_cafe_id uuid,
  p_name text,
  p_menu jsonb
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select coffe_menu_private.create_menu_draft(p_cafe_id, p_name, p_menu); $$;

create or replace function public.save_menu_draft(
  p_cafe_id uuid,
  p_draft_id uuid,
  p_expected_version integer,
  p_menu jsonb
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select coffe_menu_private.save_menu_draft(p_cafe_id, p_draft_id, p_expected_version, p_menu); $$;

create or replace function public.restore_menu_draft_version(
  p_cafe_id uuid,
  p_draft_id uuid,
  p_version_id uuid,
  p_name text default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select coffe_menu_private.restore_menu_draft_version(p_cafe_id, p_draft_id, p_version_id, p_name); $$;

create or replace function public.rename_menu_draft(
  p_cafe_id uuid,
  p_draft_id uuid,
  p_name text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select coffe_menu_private.rename_menu_draft(p_cafe_id, p_draft_id, p_name); $$;

create or replace function public.delete_menu_draft(
  p_cafe_id uuid,
  p_draft_id uuid,
  p_expected_version integer
)
returns void
language sql
security invoker
set search_path = ''
as $$ select coffe_menu_private.delete_menu_draft(p_cafe_id, p_draft_id, p_expected_version); $$;

create or replace function public.publish_menu_draft(
  p_cafe_id uuid,
  p_draft_id uuid,
  p_expected_version integer
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select coffe_menu_private.publish_menu_draft(p_cafe_id, p_draft_id, p_expected_version); $$;

create or replace function public.set_product_availability(
  p_cafe_id uuid,
  p_product_id text,
  p_available boolean,
  p_note text default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select coffe_menu_private.set_product_availability(p_cafe_id, p_product_id, p_available, p_note); $$;

grant usage on schema coffe_menu_private to authenticated;
revoke execute on all functions in schema coffe_menu_private from public, anon, authenticated;
grant execute on function coffe_menu_private.create_menu_draft(uuid, text, jsonb) to authenticated;
grant execute on function coffe_menu_private.save_menu_draft(uuid, uuid, integer, jsonb) to authenticated;
grant execute on function coffe_menu_private.restore_menu_draft_version(uuid, uuid, uuid, text) to authenticated;
grant execute on function coffe_menu_private.rename_menu_draft(uuid, uuid, text) to authenticated;
grant execute on function coffe_menu_private.delete_menu_draft(uuid, uuid, integer) to authenticated;
grant execute on function coffe_menu_private.publish_menu_draft(uuid, uuid, integer) to authenticated;
grant execute on function coffe_menu_private.set_product_availability(uuid, text, boolean, text) to authenticated;

-- RPCs SECURITY DEFINER são expostas apenas a usuários autenticados. Cada escrita
-- verifica auth.uid(), unidade proprietária e estado ativo dentro da transação.
revoke execute on function public.list_my_cafes() from public, anon;
revoke execute on function public.get_menu_editor(uuid) from public, anon;
revoke execute on function public.create_menu_draft(uuid, text, jsonb) from public, anon;
revoke execute on function public.save_menu_draft(uuid, uuid, integer, jsonb) from public, anon;
revoke execute on function public.restore_menu_draft_version(uuid, uuid, uuid, text) from public, anon;
revoke execute on function public.rename_menu_draft(uuid, uuid, text) from public, anon;
revoke execute on function public.delete_menu_draft(uuid, uuid, integer) from public, anon;
revoke execute on function public.publish_menu_draft(uuid, uuid, integer) from public, anon;
revoke execute on function public.set_product_availability(uuid, text, boolean, text) from public, anon;
revoke execute on function public.get_published_menu(text) from public;

grant execute on function public.list_my_cafes() to authenticated;
grant execute on function public.get_menu_editor(uuid) to authenticated;
grant execute on function public.create_menu_draft(uuid, text, jsonb) to authenticated;
grant execute on function public.save_menu_draft(uuid, uuid, integer, jsonb) to authenticated;
grant execute on function public.restore_menu_draft_version(uuid, uuid, uuid, text) to authenticated;
grant execute on function public.rename_menu_draft(uuid, uuid, text) to authenticated;
grant execute on function public.delete_menu_draft(uuid, uuid, integer) to authenticated;
grant execute on function public.publish_menu_draft(uuid, uuid, integer) to authenticated;
grant execute on function public.set_product_availability(uuid, text, boolean, text) to authenticated;
grant execute on function public.get_published_menu(text) to anon, authenticated;

-- Arquivos privados: o proprietário pode listar/ler os próprios uploads e enviar
-- novos UUIDs apenas dentro de uma unidade que lhe pertence. Não há política pública.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'coffe-menu-media',
  'coffe-menu-media',
  false,
  3145728,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

do $$ begin
  if exists (select 1 from storage.buckets where id = 'coffe-menu-media' and (public is distinct from false or file_size_limit is distinct from 3145728 or allowed_mime_types is distinct from array['image/jpeg','image/png','image/webp'])) then
    raise exception 'Bucket coffe-menu-media existente tem configuração incompatível.';
  end if;
end $$;

create policy coffe_menu_media_owner_read
  on storage.objects for select to authenticated
  using (
    bucket_id = 'coffe-menu-media'
    and exists (
      select 1 from public.cafes c
      where c.id::text = split_part(storage.objects.name, '/', 1)
        and c.owner_id = (select auth.uid())
    )
  );

-- O bucket é privado. Visitantes leem somente arquivos referenciados pelo
-- snapshot atualmente publicado, nunca imagens presentes apenas em rascunhos.
create policy coffe_menu_media_published_read
  on storage.objects for select to anon
  using (
    bucket_id = 'coffe-menu-media'
    and exists (
      select 1
      from public.cafes c
      join public.menu_publications p on p.cafe_id = c.id and p.id = c.published_publication_id
      join public.menu_draft_versions v on v.cafe_id = p.cafe_id and v.draft_id = p.draft_id and v.id = p.version_id
      where c.is_active and c.id::text = split_part(storage.objects.name, '/', 1)
        and (v.menu #>> '{cafe,branding,logo_key}' = storage.objects.name
          or exists (select 1 from jsonb_array_elements(v.menu -> 'items') as item(value)
                     where item.value ->> 'image' = storage.objects.name))
    )
  );

create policy coffe_menu_media_owner_insert
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'coffe-menu-media'
    and name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](jpg|png|webp|mp4)$'
    and exists (
      select 1 from public.cafes c
      where c.id::text = split_part(storage.objects.name, '/', 1)
        and c.owner_id = (select auth.uid())
        and c.is_active
    )
  );

commit;

