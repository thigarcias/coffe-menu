-- Quantidade em estoque por produto (Disponibilidade).
-- quantity nula = sem controle de estoque. Quantidade 0 deixa o produto indisponível automaticamente.
-- O cardápio público continua lendo só `available` (a quantidade não é exposta ao anon).

alter table public.product_availability
  add column if not exists quantity integer
  check (quantity is null or (quantity >= 0 and quantity <= 100000));

grant select (quantity) on public.product_availability to authenticated;

create or replace function coffe_menu_private.set_product_stock(
  p_cafe_id uuid,
  p_product_id text,
  p_available boolean,
  p_quantity integer,
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
  v_available boolean;
  v_note text := nullif(btrim(p_note), '');
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
  if p_quantity is not null and (p_quantity < 0 or p_quantity > 100000) then
    raise exception using errcode = '22023', message = 'A quantidade deve ficar entre 0 e 100000.';
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

  v_available := coalesce(p_available, true) and (p_quantity is null or p_quantity > 0);

  if v_available and p_quantity is null and v_note is null then
    delete from public.product_availability where cafe_id = p_cafe_id and product_id = p_product_id;
  else
    insert into public.product_availability (cafe_id, product_id, available, quantity, note, updated_by, updated_at)
    values (p_cafe_id, p_product_id, v_available, p_quantity, v_note, v_user_id, v_updated_at)
    on conflict (cafe_id, product_id) do update
      set available = excluded.available,
          quantity = excluded.quantity,
          note = excluded.note,
          updated_by = excluded.updated_by,
          updated_at = excluded.updated_at;
  end if;

  return jsonb_build_object(
    'cafe_id', p_cafe_id,
    'product_id', p_product_id,
    'available', v_available,
    'quantity', p_quantity,
    'note', v_note,
    'updated_at', v_updated_at
  );
end;
$$;

create or replace function public.set_product_stock(
  p_cafe_id uuid,
  p_product_id text,
  p_available boolean,
  p_quantity integer,
  p_note text default null
)
returns jsonb
language sql
set search_path = ''
as $$ select coffe_menu_private.set_product_stock(p_cafe_id, p_product_id, p_available, p_quantity, p_note); $$;

revoke execute on function coffe_menu_private.set_product_stock(uuid, text, boolean, integer, text) from public, anon, authenticated;
grant execute on function coffe_menu_private.set_product_stock(uuid, text, boolean, integer, text) to authenticated;
revoke execute on function public.set_product_stock(uuid, text, boolean, integer, text) from public, anon;
grant execute on function public.set_product_stock(uuid, text, boolean, integer, text) to authenticated;

-- O editor passa a receber, por produto, { available, quantity, note } (antes era só o booleano).
create or replace function public.get_menu_editor(p_cafe_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'cafe', jsonb_build_object('id', c.id, 'slug', c.slug, 'name', c.name, 'is_active', c.is_active),
    'published', (
      select jsonb_build_object(
        'publication_id', p.id, 'draft_id', p.draft_id, 'draft_name', p.draft_name,
        'version_id', v.id, 'version', v.version, 'published_at', p.published_at, 'menu', v.menu
      )
      from public.menu_publications p
      join public.menu_draft_versions v
        on v.cafe_id = p.cafe_id and v.draft_id = p.draft_id and v.id = p.version_id
      where p.cafe_id = c.id and p.id = c.published_publication_id
    ),
    'drafts', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', d.id, 'name', d.name, 'created_at', d.created_at, 'updated_at', d.updated_at,
        'current_version', d.current_version, 'current_version_id', current_version.id,
        'menu', current_version.menu,
        'versions', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'id', history.id, 'version', history.version, 'saved_at', history.saved_at, 'saved_by', history.saved_by
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
        'id', d.id, 'name', d.name, 'created_at', d.created_at, 'updated_at', d.updated_at,
        'deleted_at', d.deleted_at, 'current_version', d.current_version,
        'versions', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'id', history.id, 'version', history.version, 'saved_at', history.saved_at, 'saved_by', history.saved_by
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
        'publication_id', p.id, 'draft_id', p.draft_id, 'draft_name', p.draft_name,
        'version_id', v.id, 'version', v.version, 'published_at', p.published_at,
        'published_by', p.published_by, 'menu', v.menu
      ) order by p.published_at desc), '[]'::jsonb)
      from public.menu_publications p
      join public.menu_draft_versions v
        on v.cafe_id = p.cafe_id and v.draft_id = p.draft_id and v.id = p.version_id
      where p.cafe_id = c.id
    ),
    'availability', (
      select coalesce(jsonb_object_agg(a.product_id, jsonb_build_object(
        'available', a.available, 'quantity', a.quantity, 'note', a.note
      )), '{}'::jsonb)
      from public.product_availability a
      where a.cafe_id = c.id
    )
  )
  from public.cafes c
  where c.id = p_cafe_id
    and c.owner_id = (select auth.uid())
    and c.is_active;
$$;
