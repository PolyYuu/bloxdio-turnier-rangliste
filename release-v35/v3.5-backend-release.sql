-- HUB V3.5 release hardening / reproducibility
-- Already applied to the connected Supabase project on 2026-09-03.

-- Restrict public SECURITY DEFINER execution. Grant only authenticated application
-- functions and service_role as appropriate in the actual project.

create or replace function public.delete_tournament_round(p_tournament_id uuid, p_round integer)
returns void
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  v_current integer;
  v_editing integer;
begin
  if not public.is_admin() then raise exception 'Admin privileges required'; end if;

  select current_round, editing_round into v_current, v_editing
  from public.tournaments where id=p_tournament_id for update;

  if v_current is null then raise exception 'Tournament not found'; end if;
  if v_current<=1 then raise exception 'At least one round must remain'; end if;
  if p_round<1 or p_round>v_current then raise exception 'Invalid round'; end if;

  if exists(select 1 from public.rating_rounds where tournament_id=p_tournament_id and round>=p_round) then
    raise exception 'This round is already rating-finalized. Edit its results and recalculate rating instead of deleting it.';
  end if;

  delete from public.events e using public.players p
  where e.player_id=p.id and p.tournament_id=p_tournament_id and e.round=p_round;

  delete from public.round_participation
  where tournament_id=p_tournament_id and round=p_round;

  update public.events e set round=round-1 from public.players p
  where e.player_id=p.id and p.tournament_id=p_tournament_id and e.round>p_round;

  update public.round_participation set round=round+10000
  where tournament_id=p_tournament_id and round>p_round;
  update public.round_participation set round=round-10001
  where tournament_id=p_tournament_id and round>10000+p_round;

  update public.tournaments
  set current_round=v_current-1,
      editing_round=greatest(1,least(v_current-1,
        case when v_editing>p_round then v_editing-1
             when v_editing=p_round then least(p_round,v_current-1)
             else v_editing end)),
      updated_at=now()
  where id=p_tournament_id;

  perform private.rebuild_all_career_stats();
end;
$function$;

revoke execute on function public.delete_tournament_round(uuid,integer) from public,anon;
grant execute on function public.delete_tournament_round(uuid,integer) to authenticated,service_role;
