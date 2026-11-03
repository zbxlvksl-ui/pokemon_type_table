-- 기존 데이터와 정책을 유지한 채 실행하는 추가 마이그레이션.
-- 업로드 IP/시각을 브라우저에 반환한 후 자산 데이터와 함께 암호화해 저장한다.
-- IP를 공개 테이블의 별도 평문 컬럼에 저장하지 않는다.
begin;

create or replace function public.asset_note_upload_context()
returns jsonb
language plpgsql volatile security invoker
set search_path = ''
as $$
declare
  headers jsonb := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb;
  address text;
  client_ip inet;
begin
  address := coalesce(nullif(headers->>'cf-connecting-ip', ''),
                      nullif(split_part(headers->>'x-forwarded-for', ',', 1), ''),
                      nullif(headers->>'x-real-ip', ''));
  begin
    client_ip := trim(address)::inet;
  exception when invalid_text_representation then
    client_ip := null;
  end;
  return jsonb_build_object('uploadedAt', clock_timestamp(), 'ip', host(client_ip));
end;
$$;

create or replace function public.save_asset_note_sync(
  p_sync_id uuid,
  p_payload jsonb,
  p_expected_updated_at timestamptz
)
returns jsonb
language plpgsql volatile security invoker
set search_path = ''
as $$
declare
  previous public.asset_note_sync%rowtype;
  saved public.asset_note_sync%rowtype;
  exists_already boolean;
begin
  if p_sync_id is null or p_payload is null
     or p_payload->>'version' is distinct from '1'
     or jsonb_typeof(p_payload->'iv') is distinct from 'string'
     or jsonb_typeof(p_payload->'data') is distinct from 'string' then
    raise exception 'Invalid encrypted payload' using errcode = '22023';
  end if;

  -- 동일 행 최초 생성도 직렬화. 기존 행은 FOR UPDATE로 기존 클라이언트 쓰기와도 직렬화.
  perform pg_advisory_xact_lock(hashtextextended(p_sync_id::text, 0));
  select * into previous from public.asset_note_sync
    where sync_id = p_sync_id for update;
  exists_already := found;
  if (exists_already and previous.updated_at is distinct from p_expected_updated_at)
     or (not exists_already and p_expected_updated_at is not null) then
    raise exception 'Cloud data changed; compare again' using errcode = 'PT409';
  end if;

  if exists_already then
    update public.asset_note_sync
      set payload = p_payload, updated_at = clock_timestamp()
      where sync_id = p_sync_id returning * into saved;
  else
    insert into public.asset_note_sync(sync_id, payload, updated_at)
      values (p_sync_id, p_payload, clock_timestamp()) returning * into saved;
  end if;
  return jsonb_build_object('updated_at', saved.updated_at);
end;
$$;

revoke all on function public.asset_note_upload_context() from public;
revoke all on function public.save_asset_note_sync(uuid, jsonb, timestamptz) from public;
grant execute on function public.asset_note_upload_context() to anon, authenticated;
grant execute on function public.save_asset_note_sync(uuid, jsonb, timestamptz) to anon, authenticated;
notify pgrst, 'reload schema';
commit;

-- 되돌리기(기존 데이터는 유지):
-- drop function public.asset_note_upload_context();
-- drop function public.save_asset_note_sync(uuid, jsonb, timestamptz);
