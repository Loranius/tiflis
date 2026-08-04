begin;

alter table public.menu_items
  add column if not exists emoji text,
  add column if not exists stopped boolean not null default false,
  add column if not exists sort_order integer not null default 0,
  add column if not exists updated_at timestamptz not null default now();

comment on table public.menu_items is
  'Canonical normalized menu for Tiflis v2. The legacy settings.menu_items JSON remains as a rollback snapshot.';

create unique index if not exists menu_items_identity_unique
  on public.menu_items (section, category, name);

create index if not exists menu_items_section_category_idx
  on public.menu_items (section, category, sort_order, name);

create index if not exists menu_items_stopped_idx
  on public.menu_items (stopped)
  where stopped = true;

insert into public.menu_items (
  section,
  category,
  name,
  price,
  weight,
  description,
  photo,
  allergens,
  cook_time_normal,
  cook_time_busy,
  emoji,
  stopped,
  sort_order
)
select
  split_part(bucket.key, '::', 1) as section,
  split_part(bucket.key, '::', 2) as category,
  trim(item.value->>'name') as name,
  nullif(replace(trim(coalesce(item.value->>'price', '')), ',', '.'), '')::numeric as price,
  nullif(trim(coalesce(item.value->>'weight', '')), '') as weight,
  nullif(trim(coalesce(item.value->>'description', '')), '') as description,
  nullif(trim(coalesce(item.value->>'photo', '')), '') as photo,
  case
    when jsonb_typeof(item.value->'allergens') = 'array'
      then array(select jsonb_array_elements_text(item.value->'allergens'))
    else array[]::text[]
  end as allergens,
  case
    when trim(coalesce(item.value->>'cookTime', '')) ~ '^[0-9]+$'
      then trim(item.value->>'cookTime')::integer
    else nullif(substring(coalesce(item.value->>'time', '') from '([0-9]+)'), '')::integer
  end as cook_time_normal,
  coalesce(
    case
      when trim(coalesce(item.value->>'cookTimeBusy', '')) ~ '^[0-9]+$'
        then trim(item.value->>'cookTimeBusy')::integer
      else null
    end,
    nullif(substring(coalesce(item.value->>'time', '') from '[0-9]+\s*-\s*([0-9]+)'), '')::integer,
    case
      when trim(coalesce(item.value->>'cookTime', '')) ~ '^[0-9]+$'
        then trim(item.value->>'cookTime')::integer
      else nullif(substring(coalesce(item.value->>'time', '') from '([0-9]+)'), '')::integer
    end
  ) as cook_time_busy,
  nullif(trim(coalesce(item.value->>'emoji', '')), '') as emoji,
  false,
  item.ordinality::integer
from public.settings source
cross join lateral jsonb_each(source.value::jsonb) as bucket(key, value)
cross join lateral jsonb_array_elements(bucket.value) with ordinality as item(value, ordinality)
where source.key = 'menu_items'
  and trim(coalesce(item.value->>'name', '')) <> ''
on conflict (section, category, name) do nothing;

drop trigger if exists menu_items_set_updated_at on public.menu_items;
create trigger menu_items_set_updated_at
before update on public.menu_items
for each row execute function public.set_updated_at();

commit;
