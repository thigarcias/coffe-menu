begin;

-- Tema do cardápio: além das cores principal e secundária, a marca aceita fundo, cor dos chips e o
-- id do tema pronto. Mesma função de validação de antes, com as chaves novas (todas #RRGGBB).

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
    foreach v_color in array array['accent_color', 'secondary_color', 'background_color', 'soft_color']
    loop
      if p_menu #>> array['cafe', 'branding', v_color] is not null
         and p_menu #>> array['cafe', 'branding', v_color] !~ '^#[0-9A-Fa-f]{6}$' then
        raise exception using errcode = '22023', message = 'As cores da marca precisam usar o formato hexadecimal #RRGGBB.';
      end if;
    end loop;
    if p_menu #> '{cafe,branding,theme}' is not null
       and p_menu #> '{cafe,branding,theme}' is distinct from 'null'::jsonb
       and (jsonb_typeof(p_menu #> '{cafe,branding,theme}') is distinct from 'string'
            or (p_menu #>> '{cafe,branding,theme}') !~ '^[a-z]{1,20}$') then
      raise exception using errcode = '22023', message = 'branding.theme precisa ser o id de um tema.';
    end if;
    if p_menu #> '{cafe,branding,logo_key}' is not null
       and p_menu #> '{cafe,branding,logo_key}' is distinct from 'null'::jsonb
       and jsonb_typeof(p_menu #> '{cafe,branding,logo_key}') is distinct from 'string' then
      raise exception using errcode = '22023', message = 'branding.logo_key precisa ser uma chave de mídia ou nula.';
    end if;
  end if;
end;
$$;

commit;
