begin;

-- Personalização do painel do dono. Cada seção do Dashboard tem uma lista de versões
-- (append-only) por cafeteria: a versão mais alta é a atual. `items` é a lista de cartões
-- (ver app/src/admin/layout/model.ts); `items` nulo significa "voltar ao padrão do código".
-- Escrita só pelas RPCs abaixo (proprietário da unidade, conta permanente, versão esperada).

create table public.dashboard_layout_versions (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public.cafes (id) on delete cascade,
  section text not null,
  version integer not null check (version > 0),
  items jsonb,
  source text not null,
  saved_by uuid references auth.users (id) on delete set null,
  saved_at timestamptz not null default now(),
  constraint dashboard_layout_versions_unique unique (cafe_id, section, version),
  constraint dashboard_layout_versions_section check (section in ('visao', 'vendas', 'produtos', 'ia', 'trafego')),
  constraint dashboard_layout_versions_source check (source in ('manual', 'ia', 'reset', 'restore')),
  constraint dashboard_layout_versions_items_shape check (
    items is null
    or (jsonb_typeof(items) = 'array' and jsonb_array_length(items) <= 30 and pg_column_size(items) <= 65536)
  )
);

create index dashboard_layout_versions_latest_idx
  on public.dashboard_layout_versions (cafe_id, section, version desc);

alter table public.dashboard_layout_versions enable row level security;

create policy dashboard_layout_versions_owner_select
  on public.dashboard_layout_versions for select to authenticated
  using (exists (
    select 1 from public.cafes c
    where c.id = dashboard_layout_versions.cafe_id
      and c.owner_id = (select auth.uid())
  ));

revoke all on table public.dashboard_layout_versions from public, anon, authenticated;
grant select (id, cafe_id, section, version, items, source, saved_by, saved_at)
  on public.dashboard_layout_versions to authenticated;

-- Valida a forma de cada cartão: do padrão (nome conhecido) ou da IA (receita com tipo conhecido).
-- Os números nunca são guardados: só a receita; o painel calcula na hora.
create or replace function coffe_menu_private.assert_dashboard_items(p_items jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_item jsonb;
  v_ids text[] := '{}';
  v_id text;
begin
  if p_items is null then
    return;
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 30 then
    raise exception using errcode = '22023', message = 'Layout inválido.';
  end if;
  for v_item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception using errcode = '22023', message = 'Cartão inválido.';
    end if;
    v_id := v_item ->> 'id';
    if v_id is null or length(v_id) not between 1 and 60 or v_id = any (v_ids) then
      raise exception using errcode = '22023', message = 'Identificador de cartão inválido ou repetido.';
    end if;
    v_ids := v_ids || v_id;
    if v_item ->> 'kind' = 'builtin' then
      if (v_item ->> 'widget') is null or (v_item ->> 'widget') not in (
        'kpi.revenue', 'kpi.orders', 'kpi.ticket', 'kpi.conv', 'kpi.ai', 'why', 'sales', 'funnel',
        'top', 'categories', 'showcase', 'ai.reco', 'similar', 'heat', 'sources'
      ) then
        raise exception using errcode = '22023', message = 'Cartão do padrão desconhecido.';
      end if;
    elsif v_item ->> 'kind' = 'spec' then
      if jsonb_typeof(v_item -> 'spec') <> 'object'
         or (v_item -> 'spec' ->> 'type') is null
         or (v_item -> 'spec' ->> 'type') not in ('kpis', 'line', 'bars', 'funnel', 'heat', 'table', 'similar', 'ai_picks', 'showcase')
         or length(coalesce(v_item -> 'spec' ->> 'title', '')) not between 1 and 120
         or (v_item ->> 'span') is null
         or (v_item ->> 'span') not in ('4', '5', '6', '7', '8', '12') then
        raise exception using errcode = '22023', message = 'Bloco inválido.';
      end if;
    else
      raise exception using errcode = '22023', message = 'Tipo de cartão desconhecido.';
    end if;
  end loop;
end;
$$;

create or replace function coffe_menu_private.save_dashboard_layout(
  p_cafe_id uuid,
  p_section text,
  p_expected_version integer,
  p_items jsonb,
  p_source text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_current integer;
  v_next integer;
  v_saved_at timestamptz;
begin
  if v_user_id is null or coalesce(auth.jwt() ->> 'is_anonymous', 'false') = 'true' then
    raise exception using errcode = '42501', message = 'É necessário entrar com uma conta permanente.';
  end if;
  if p_section is null or p_section not in ('visao', 'vendas', 'produtos', 'ia', 'trafego') then
    raise exception using errcode = '22023', message = 'Seção desconhecida.';
  end if;
  if p_source is null or p_source not in ('manual', 'ia', 'reset') then
    raise exception using errcode = '22023', message = 'Origem inválida.';
  end if;
  if (p_source = 'reset') <> (p_items is null) then
    raise exception using errcode = '22023', message = 'Voltar ao padrão não leva cartões.';
  end if;
  perform 1 from public.cafes c
  where c.id = p_cafe_id and c.owner_id = v_user_id and c.is_active
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Unidade não encontrada ou inativa.';
  end if;
  perform coffe_menu_private.assert_dashboard_items(p_items);

  select coalesce(max(v.version), 0) into v_current
  from public.dashboard_layout_versions v
  where v.cafe_id = p_cafe_id and v.section = p_section;
  if p_expected_version is distinct from v_current then
    raise exception using errcode = '40001', message = 'O painel mudou. Recarregue antes de salvar.';
  end if;

  v_next := v_current + 1;
  insert into public.dashboard_layout_versions (cafe_id, section, version, items, source, saved_by)
  values (p_cafe_id, p_section, v_next, p_items, p_source, v_user_id)
  returning saved_at into v_saved_at;

  return jsonb_build_object('section', p_section, 'version', v_next, 'saved_at', v_saved_at);
end;
$$;

-- "Desfazer" e "Restaurar": copia uma versão antiga como a nova versão atual (o histórico nunca é apagado).
create or replace function coffe_menu_private.restore_dashboard_layout(
  p_cafe_id uuid,
  p_section text,
  p_expected_version integer,
  p_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_current integer;
  v_next integer;
  v_items jsonb;
  v_saved_at timestamptz;
begin
  if v_user_id is null or coalesce(auth.jwt() ->> 'is_anonymous', 'false') = 'true' then
    raise exception using errcode = '42501', message = 'É necessário entrar com uma conta permanente.';
  end if;
  if p_section is null or p_section not in ('visao', 'vendas', 'produtos', 'ia', 'trafego') then
    raise exception using errcode = '22023', message = 'Seção desconhecida.';
  end if;
  perform 1 from public.cafes c
  where c.id = p_cafe_id and c.owner_id = v_user_id and c.is_active
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Unidade não encontrada ou inativa.';
  end if;

  select coalesce(max(v.version), 0) into v_current
  from public.dashboard_layout_versions v
  where v.cafe_id = p_cafe_id and v.section = p_section;
  if p_expected_version is distinct from v_current then
    raise exception using errcode = '40001', message = 'O painel mudou. Recarregue antes de restaurar.';
  end if;

  select v.items into v_items
  from public.dashboard_layout_versions v
  where v.cafe_id = p_cafe_id and v.section = p_section and v.version = p_version;
  if not found then
    raise exception using errcode = 'P0002', message = 'Versão não encontrada.';
  end if;

  v_next := v_current + 1;
  insert into public.dashboard_layout_versions (cafe_id, section, version, items, source, saved_by)
  values (p_cafe_id, p_section, v_next, v_items, 'restore', v_user_id)
  returning saved_at into v_saved_at;

  return jsonb_build_object('section', p_section, 'version', v_next, 'saved_at', v_saved_at);
end;
$$;

-- Leitura: para cada seção, a versão atual (com os cartões) e as últimas 20 versões (sem os cartões).
create or replace function public.get_dashboard_layouts(p_cafe_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'cafe_id', p_cafe_id,
    'sections', coalesce((
      select jsonb_object_agg(cur.section, jsonb_build_object(
        'version', cur.version, 'items', cur.items, 'source', cur.source, 'saved_at', cur.saved_at
      ))
      from (
        select distinct on (v.section) v.section, v.version, v.items, v.source, v.saved_at
        from public.dashboard_layout_versions v
        where v.cafe_id = p_cafe_id
        order by v.section, v.version desc
      ) cur
    ), '{}'::jsonb),
    'history', coalesce((
      select jsonb_object_agg(h.section, h.entries)
      from (
        select r.section, jsonb_agg(jsonb_build_object(
          'version', r.version, 'source', r.source, 'saved_at', r.saved_at, 'is_default', r.items is null
        ) order by r.version desc) as entries
        from (
          select v.*, row_number() over (partition by v.section order by v.version desc) as rn
          from public.dashboard_layout_versions v
          where v.cafe_id = p_cafe_id
        ) r
        where r.rn <= 20
        group by r.section
      ) h
    ), '{}'::jsonb)
  );
$$;

create or replace function public.save_dashboard_layout(
  p_cafe_id uuid,
  p_section text,
  p_expected_version integer,
  p_items jsonb,
  p_source text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select coffe_menu_private.save_dashboard_layout(p_cafe_id, p_section, p_expected_version, p_items, p_source); $$;

create or replace function public.restore_dashboard_layout(
  p_cafe_id uuid,
  p_section text,
  p_expected_version integer,
  p_version integer
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select coffe_menu_private.restore_dashboard_layout(p_cafe_id, p_section, p_expected_version, p_version); $$;

revoke execute on function coffe_menu_private.assert_dashboard_items(jsonb) from public, anon, authenticated;
revoke execute on function coffe_menu_private.save_dashboard_layout(uuid, text, integer, jsonb, text) from public, anon, authenticated;
revoke execute on function coffe_menu_private.restore_dashboard_layout(uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function coffe_menu_private.save_dashboard_layout(uuid, text, integer, jsonb, text) to authenticated;
grant execute on function coffe_menu_private.restore_dashboard_layout(uuid, text, integer, integer) to authenticated;

revoke execute on function public.get_dashboard_layouts(uuid) from public, anon;
revoke execute on function public.save_dashboard_layout(uuid, text, integer, jsonb, text) from public, anon;
revoke execute on function public.restore_dashboard_layout(uuid, text, integer, integer) from public, anon;
grant execute on function public.get_dashboard_layouts(uuid) to authenticated;
grant execute on function public.save_dashboard_layout(uuid, text, integer, jsonb, text) to authenticated;
grant execute on function public.restore_dashboard_layout(uuid, text, integer, integer) to authenticated;

commit;
