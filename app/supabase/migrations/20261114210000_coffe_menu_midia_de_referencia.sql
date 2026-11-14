-- Mídia da biblioteca de referência que acompanha o app (arquivos estáticos em /menu e /video)
-- pode ser usada no cardápio sem passar pelo armazenamento privado da unidade.
-- Só aceita nome de arquivo simples dentro dessas duas pastas: nada de "..", barras extras ou endereços externos.
create or replace function coffe_menu_private.assert_media_key(p_cafe_id uuid, p_key text, p_kind text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_pattern text;
  v_reference text;
begin
  if p_kind = 'video' then
    v_reference := '^video/[a-z0-9][a-z0-9._-]*[.]mp4$';
    v_pattern := '^' || p_cafe_id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.]mp4$';
  else
    v_reference := '^menu/[a-z0-9][a-z0-9._-]*[.](jpg|jpeg|png|webp)$';
    v_pattern := '^' || p_cafe_id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](jpg|png|webp)$';
  end if;

  if p_key is not null and p_key ~* v_reference then
    return;
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
