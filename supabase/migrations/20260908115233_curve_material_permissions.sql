-- Supabase default privileges can explicitly grant anon execution, beyond PUBLIC.
revoke all on function public.reserve_material_session(uuid,uuid,text,text) from public, anon, authenticated;
revoke all on function public.reserve_material_analysis(uuid) from public, anon, authenticated;
grant execute on function public.reserve_material_session(uuid,uuid,text,text) to authenticated;
grant execute on function public.reserve_material_analysis(uuid) to authenticated;
revoke update,delete on public.curve_material_reports from anon,authenticated;
create index if not exists curve_material_sessions_material_idx on public.curve_material_sessions(material_id);
create index if not exists curve_material_reports_session_idx on public.curve_material_reports(session_id);
create index if not exists curve_material_reports_user_idx on public.curve_material_reports(user_id);
