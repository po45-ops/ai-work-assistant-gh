-- Read-only metadata inspection. Run in the existing Supabase SQL Editor.
-- Returns no task content, account data, passwords, or API keys.
-- Share the JSON result so Tasks can use the actual database contract.
with target_tables as (
  select c.oid, n.nspname as schema_name, c.relname as table_name,
         c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
    and c.relname in ('tasks', 'projects', 'milestones', 'daily_actions', 'inbox', 'integration_connections', 'line_messages')
)
select jsonb_pretty(jsonb_build_object(
  'tables', coalesce((
    select jsonb_agg(jsonb_build_object(
      'schema', t.schema_name,
      'table', t.table_name,
      'rls_enabled', t.rls_enabled,
      'rls_forced', t.rls_forced,
      'columns', coalesce((
        select jsonb_agg(jsonb_build_object(
          'name', a.attname,
          'type', format_type(a.atttypid, a.atttypmod),
          'nullable', not a.attnotnull,
          'default', pg_get_expr(d.adbin, d.adrelid),
          'identity', a.attidentity,
          'generated', a.attgenerated,
          'enum_values', (
            select jsonb_agg(e.enumlabel order by e.enumsortorder)
            from pg_enum e where e.enumtypid = a.atttypid
          )
        ) order by a.attnum)
        from pg_attribute a
        left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
        where a.attrelid = t.oid and a.attnum > 0 and not a.attisdropped
      ), '[]'::jsonb),
      'constraints', coalesce((
        select jsonb_agg(jsonb_build_object(
          'name', c.conname, 'definition', pg_get_constraintdef(c.oid)
        ) order by c.conname)
        from pg_constraint c where c.conrelid = t.oid
      ), '[]'::jsonb),
      'policies', coalesce((
        select jsonb_agg(jsonb_build_object(
          'name', p.policyname, 'command', p.cmd, 'roles', p.roles,
          'permissive', p.permissive, 'using', p.qual, 'with_check', p.with_check
        ) order by p.policyname)
        from pg_policies p
        where p.schemaname = t.schema_name and p.tablename = t.table_name
      ), '[]'::jsonb),
      'triggers', coalesce((
        select jsonb_agg(jsonb_build_object(
          'name', tr.tgname, 'definition', pg_get_triggerdef(tr.oid)
        ) order by tr.tgname)
        from pg_trigger tr where tr.tgrelid = t.oid and not tr.tgisinternal
      ), '[]'::jsonb)
    ) order by t.table_name) from target_tables t
  ), '[]'::jsonb)
)) as workspace_schema;
