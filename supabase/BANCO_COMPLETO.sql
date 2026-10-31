-- ChapGest360 / Lataria — BANCO COMPLETO para colar no SQL Editor do Supabase.
-- Copie TUDO deste arquivo (Ctrl+A, Ctrl+C), cole no SQL Editor e clique em Run. Rode uma vez só.

-- Lataria — esquema inicial (Supabase / PostgreSQL)
-- Multiempresa: toda tabela de negócio tem organization_id, isolada por RLS.
-- Valores monetários em centavos (bigint).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Organizações e membros
-- ---------------------------------------------------------------------------
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table memberships (
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'admin', 'staff')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index memberships_user_idx on memberships(user_id);

create table counters (
  organization_id uuid not null references organizations(id) on delete cascade,
  kind text not null,
  year int not null,
  value int not null default 0,
  primary key (organization_id, kind, year)
);

create or replace function is_member(org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships m where m.organization_id = org and m.user_id = auth.uid())
$$;

create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger organizations_touch before update on organizations for each row execute function touch_updated_at();

-- ---------------------------------------------------------------------------
-- Clientes e veículos
-- ---------------------------------------------------------------------------
create table customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  name text not null check (length(trim(name)) > 0),
  phone text,
  whatsapp text,
  email text,
  document text,
  zip text,
  address text,
  source text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (id, organization_id)
);
create index customers_org_idx on customers(organization_id, name);

create table vehicles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  customer_id uuid not null,
  plate text not null check (plate ~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$'),
  brand text,
  model text,
  year text,
  color text,
  paint_code text,
  vin text,
  km integer check (km is null or km >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (id, organization_id),
  foreign key (customer_id, organization_id) references customers(id, organization_id)
);
create index vehicles_org_plate_idx on vehicles(organization_id, plate);
create index vehicles_customer_idx on vehicles(customer_id);

-- ---------------------------------------------------------------------------
-- Orçamentos e ordens de serviço
-- items: [{id, kind, description, region, qty, unit, unit_price}]
-- payment_terms: {methods[], installments, down_payment, notes, show_pix_qr}
-- insurance (opcional): {insurer, claim_number, deductible, customer_pays}
-- ---------------------------------------------------------------------------
create table quotes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  number text not null,
  customer_id uuid not null,
  vehicle_id uuid not null,
  status text not null default 'rascunho'
    check (status in ('rascunho', 'enviado', 'aprovado', 'recusado', 'expirado', 'cancelado')),
  valid_until date not null,
  estimated_days integer check (estimated_days is null or estimated_days >= 0),
  simple boolean not null default false,
  simple_description text,
  simple_total bigint not null default 0 check (simple_total >= 0),
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  discount bigint not null default 0 check (discount >= 0),
  surcharge bigint not null default 0 check (surcharge >= 0),
  subtotal bigint not null default 0,
  total bigint not null default 0,
  payment_terms jsonb not null default '{}'::jsonb,
  insurance jsonb,
  customer_notes text,
  internal_notes text,
  public_token text not null unique check (length(public_token) >= 22),
  public_enabled boolean not null default true,
  last_viewed_at timestamptz,
  company_snapshot jsonb,
  decision_by text,
  decision_at timestamptz,
  decision_note text,
  work_order_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (organization_id, number),
  unique (id, organization_id),
  foreign key (customer_id, organization_id) references customers(id, organization_id),
  foreign key (vehicle_id, organization_id) references vehicles(id, organization_id)
);
create index quotes_org_idx on quotes(organization_id, created_at desc);

create table work_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  number text not null,
  customer_id uuid not null,
  vehicle_id uuid not null,
  quote_id uuid,
  stage text not null default 'recebido',
  entry_date date not null default (now() at time zone 'America/Sao_Paulo')::date,
  due_date date,
  delivered_at timestamptz,
  simple boolean not null default false,
  simple_description text,
  simple_total bigint not null default 0 check (simple_total >= 0),
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  discount bigint not null default 0 check (discount >= 0),
  surcharge bigint not null default 0 check (surcharge >= 0),
  subtotal bigint not null default 0,
  total bigint not null default 0,
  payment_terms jsonb not null default '{}'::jsonb,
  insurance jsonb,
  checklist jsonb,
  customer_notes text,
  internal_notes text,
  public_note text,
  delivery_signature text,
  public_token text not null unique check (length(public_token) >= 22),
  public_enabled boolean not null default true,
  last_viewed_at timestamptz,
  company_snapshot jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (organization_id, number),
  unique (id, organization_id),
  foreign key (customer_id, organization_id) references customers(id, organization_id),
  foreign key (vehicle_id, organization_id) references vehicles(id, organization_id),
  foreign key (quote_id, organization_id) references quotes(id, organization_id)
);
create index work_orders_org_idx on work_orders(organization_id, created_at desc);
create unique index work_orders_one_per_quote on work_orders(quote_id) where quote_id is not null and archived_at is null;

alter table quotes add foreign key (work_order_id, organization_id) references work_orders(id, organization_id);

-- Totais sempre recalculados no banco (mesma regra de src/lib/calc.ts).
create or replace function compute_doc_totals() returns trigger language plpgsql as $$
declare
  s bigint;
begin
  if new.simple then
    s := greatest(coalesce(new.simple_total, 0), 0);
  else
    select coalesce(sum(round((e->>'qty')::numeric * (e->>'unit_price')::numeric)), 0)::bigint
      into s from jsonb_array_elements(new.items) e;
  end if;
  if exists (select 1 from jsonb_array_elements(new.items) e
             where (e->>'qty')::numeric < 0 or (e->>'unit_price')::numeric < 0) then
    raise exception 'Itens não podem ter quantidade ou preço negativos';
  end if;
  new.subtotal := s;
  new.total := greatest(s - new.discount + new.surcharge, 0);
  return new;
end $$;

-- Numeração sequencial por organização e ano: ORC-2026-0001, OS-2026-0001.
create or replace function assign_doc_number() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  k text := case when tg_table_name = 'quotes' then 'quote' else 'work_order' end;
  y int := extract(year from now() at time zone 'America/Sao_Paulo')::int;
  n int;
  prefix text;
begin
  if new.number is not null and new.number <> '' then
    return new;
  end if;
  insert into counters (organization_id, kind, year, value) values (new.organization_id, k, y, 1)
    on conflict (organization_id, kind, year) do update set value = counters.value + 1
    returning value into n;
  select coalesce(nullif(settings->>(k || '_prefix'), ''), case when k = 'quote' then 'ORC' else 'OS' end)
    into prefix from organizations where id = new.organization_id;
  new.number := prefix || '-' || y || '-' || lpad(n::text, 4, '0');
  return new;
end $$;

create trigger quotes_number before insert on quotes for each row execute function assign_doc_number();
create trigger quotes_totals before insert or update on quotes for each row execute function compute_doc_totals();
create trigger quotes_touch before update on quotes for each row execute function touch_updated_at();
create trigger work_orders_number before insert on work_orders for each row execute function assign_doc_number();
create trigger work_orders_totals before insert or update on work_orders for each row execute function compute_doc_totals();
create trigger work_orders_touch before update on work_orders for each row execute function touch_updated_at();

create table stage_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  work_order_id uuid not null,
  stage text not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  foreign key (work_order_id, organization_id) references work_orders(id, organization_id)
);
create index stage_events_wo_idx on stage_events(work_order_id, created_at);

-- ---------------------------------------------------------------------------
-- Recebimentos: nunca apagados. Correção = estorno (reversed_at).
-- ---------------------------------------------------------------------------
create table payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  work_order_id uuid,
  quote_id uuid,
  customer_id uuid not null,
  paid_at date not null,
  amount bigint not null check (amount > 0),
  method text not null check (method in ('pix', 'dinheiro', 'debito', 'credito', 'boleto', 'transferencia', 'seguradora')),
  payer text not null default 'cliente' check (payer in ('cliente', 'seguradora')),
  notes text,
  reversed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  check (work_order_id is not null or quote_id is not null),
  foreign key (work_order_id, organization_id) references work_orders(id, organization_id),
  foreign key (quote_id, organization_id) references quotes(id, organization_id),
  foreign key (customer_id, organization_id) references customers(id, organization_id)
);
create index payments_wo_idx on payments(work_order_id);
create index payments_org_date_idx on payments(organization_id, paid_at);

create or replace function guard_payment() returns trigger language plpgsql as $$
declare
  paid bigint;
  tot bigint;
begin
  if tg_op = 'UPDATE' then
    if (to_jsonb(new) - 'reversed_at' - 'updated_at' - 'notes') <> (to_jsonb(old) - 'reversed_at' - 'updated_at' - 'notes') then
      raise exception 'Recebimentos não podem ser alterados; faça um estorno e lance novamente';
    end if;
    new.updated_at := now();
    return new;
  end if;
  if new.work_order_id is not null then
    select total into tot from work_orders where id = new.work_order_id;
    select coalesce(sum(amount), 0) into paid from payments where work_order_id = new.work_order_id and reversed_at is null;
    if paid + new.amount > tot then
      raise exception 'Valor maior que o saldo da OS (saldo: % centavos)', tot - paid;
    end if;
  end if;
  return new;
end $$;
create trigger payments_guard before insert or update on payments for each row execute function guard_payment();

-- ---------------------------------------------------------------------------
-- Fotos, catálogo e custos
-- ---------------------------------------------------------------------------
create table photos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  parent_type text not null check (parent_type in ('quote', 'work_order', 'vehicle')),
  parent_id uuid not null,
  vehicle_id uuid,
  path text not null unique,
  stage text,
  caption text,
  is_public boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  foreign key (vehicle_id, organization_id) references vehicles(id, organization_id)
);
create index photos_parent_idx on photos(parent_id, position);
create index photos_vehicle_idx on photos(vehicle_id);

create table catalog_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  kind text not null check (kind in ('service', 'part', 'material')),
  description text not null,
  region text,
  unit text not null default 'un',
  price bigint not null default 0 check (price >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table costs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  work_order_id uuid not null,
  category text not null check (category in ('tinta', 'material', 'peca', 'terceiro', 'horas', 'outro')),
  description text not null,
  amount bigint not null check (amount >= 0),
  hours numeric(8, 2),
  spent_at date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  foreign key (work_order_id, organization_id) references work_orders(id, organization_id)
);

create trigger customers_touch before update on customers for each row execute function touch_updated_at();
create trigger vehicles_touch before update on vehicles for each row execute function touch_updated_at();
create trigger photos_touch before update on photos for each row execute function touch_updated_at();
create trigger catalog_touch before update on catalog_items for each row execute function touch_updated_at();
create trigger costs_touch before update on costs for each row execute function touch_updated_at();
create trigger stage_events_touch before update on stage_events for each row execute function touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table organizations enable row level security;
alter table memberships enable row level security;
alter table counters enable row level security;

create policy org_select on organizations for select using (is_member(id));
create policy org_update on organizations for update using (is_member(id)) with check (is_member(id));
create policy memberships_select on memberships for select using (user_id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['customers', 'vehicles', 'quotes', 'work_orders', 'stage_events', 'payments', 'photos', 'catalog_items', 'costs'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for select using (is_member(organization_id))', t || '_select', t);
    execute format('create policy %I on %I for insert with check (is_member(organization_id))', t || '_insert', t);
    execute format('create policy %I on %I for update using (is_member(organization_id)) with check (is_member(organization_id))', t || '_update', t);
  end loop;
  -- Exclusão definitiva só para fotos, catálogo e custos; o resto é arquivado.
  foreach t in array array['photos', 'catalog_items', 'costs'] loop
    execute format('create policy %I on %I for delete using (is_member(organization_id))', t || '_delete', t);
  end loop;
end $$;

-- Cria a oficina do usuário logado e o torna proprietário.
create or replace function create_organization(org_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  org uuid;
begin
  if auth.uid() is null then
    raise exception 'Não autenticado';
  end if;
  insert into organizations (name, settings) values (org_name, jsonb_build_object('trade_name', org_name)) returning id into org;
  insert into memberships (organization_id, user_id, role) values (org, auth.uid(), 'owner');
  return org;
end $$;
revoke all on function create_organization(text) from public, anon;
grant execute on function create_organization(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Página pública (sem login): acesso só por token e só a campos permitidos.
-- ---------------------------------------------------------------------------
create or replace function public_company(s jsonb) returns jsonb language sql immutable as $$
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) from jsonb_each(s)
  where key in ('logo_url', 'trade_name', 'legal_name', 'document', 'tagline', 'brand_color', 'street', 'number', 'district',
                'city', 'state', 'zip', 'phone', 'whatsapp', 'email', 'website', 'instagram', 'opening_hours', 'pix_key',
                'pix_name', 'max_installments', 'installment_fee_percent', 'cash_discount_percent', 'general_terms',
                'warranty_terms', 'stages', 'show_values_on_portal')
$$;

create or replace function public_document(token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  q quotes;
  w work_orders;
  c customers;
  v vehicles;
  s jsonb;
  kind text;
  doc_id uuid;
  base jsonb;
begin
  select * into q from quotes where public_token = token and public_enabled and archived_at is null;
  if found then
    kind := 'quote';
    doc_id := q.id;
    update quotes set last_viewed_at = now() where id = q.id;
    select * into c from customers where id = q.customer_id;
    select * into v from vehicles where id = q.vehicle_id;
    select settings into s from organizations where id = q.organization_id;
    base := jsonb_build_object('number', q.number, 'status', q.status, 'simple', q.simple, 'simple_description', q.simple_description,
      'items', q.items, 'subtotal', q.subtotal, 'discount', q.discount, 'surcharge', q.surcharge, 'total', q.total,
      'payment_terms', q.payment_terms, 'insurance', q.insurance, 'customer_notes', q.customer_notes,
      'valid_until', q.valid_until, 'estimated_days', q.estimated_days, 'decision_by', q.decision_by,
      'decision_at', q.decision_at, 'created_at', q.created_at);
    s := coalesce(q.company_snapshot, s) || jsonb_build_object('stages', s->'stages', 'show_values_on_portal', s->'show_values_on_portal');
  else
    select * into w from work_orders where public_token = token and public_enabled and archived_at is null;
    if not found then
      return null;
    end if;
    kind := 'work_order';
    doc_id := w.id;
    update work_orders set last_viewed_at = now() where id = w.id;
    select * into c from customers where id = w.customer_id;
    select * into v from vehicles where id = w.vehicle_id;
    select settings into s from organizations where id = w.organization_id;
    base := jsonb_build_object('number', w.number, 'stage', w.stage, 'simple', w.simple, 'simple_description', w.simple_description,
      'items', w.items, 'subtotal', w.subtotal, 'discount', w.discount, 'surcharge', w.surcharge, 'total', w.total,
      'payment_terms', w.payment_terms, 'insurance', w.insurance, 'customer_notes', w.customer_notes,
      'entry_date', w.entry_date, 'due_date', w.due_date, 'delivered_at', w.delivered_at, 'public_note', w.public_note,
      'created_at', w.created_at);
    s := coalesce(w.company_snapshot, s) || jsonb_build_object('stages', s->'stages', 'show_values_on_portal', s->'show_values_on_portal');
  end if;

  return jsonb_build_object(
    'kind', kind,
    'doc', base,
    'customer_name', split_part(c.name, ' ', 1),
    'vehicle', jsonb_build_object('brand', v.brand, 'model', v.model, 'year', v.year, 'color', v.color, 'plate', v.plate),
    'company', public_company(s),
    'events', coalesce((select jsonb_agg(jsonb_build_object('stage', e.stage, 'note', e.note, 'created_at', e.created_at) order by e.created_at)
                        from stage_events e where e.work_order_id = doc_id and e.archived_at is null), '[]'::jsonb),
    'photos', coalesce((select jsonb_agg(jsonb_build_object('path', p.path, 'caption', p.caption, 'stage', p.stage) order by p.position)
                        from photos p where p.parent_id = doc_id and p.is_public and p.archived_at is null), '[]'::jsonb),
    'paid', coalesce((select sum(amount) from payments where work_order_id = doc_id and reversed_at is null), 0)
  );
end $$;
grant execute on function public_document(text) to anon, authenticated;

create or replace function public_decision(token text, approve boolean, signer text, note text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if length(trim(coalesce(signer, ''))) < 2 then
    raise exception 'Informe seu nome';
  end if;
  update quotes
     set status = case when approve then 'aprovado' else 'recusado' end,
         decision_by = left(trim(signer), 120), decision_at = now(), decision_note = left(note, 1000)
   where public_token = token and public_enabled and archived_at is null and status in ('rascunho', 'enviado')
     and valid_until >= (now() at time zone 'America/Sao_Paulo')::date;
  if not found then
    raise exception 'Este orçamento não pode mais ser respondido. Fale com a oficina.';
  end if;
end $$;
grant execute on function public_decision(text, boolean, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage: bucket privado "photos", arquivos em <organization_id>/<arquivo>
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('photos', 'photos', false) on conflict (id) do nothing;

create policy photos_member_all on storage.objects for all to authenticated
  using (bucket_id = 'photos' and is_member(((storage.foldername(name))[1])::uuid))
  with check (bucket_id = 'photos' and is_member(((storage.foldername(name))[1])::uuid));

-- Visitante sem login só gera URL de fotos públicas de documentos com link ativo, e do logotipo.
create or replace function is_public_file(object_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from photos p
    where p.path = object_name and p.is_public and p.archived_at is null
      and (exists (select 1 from quotes q where q.id = p.parent_id and q.public_enabled)
           or exists (select 1 from work_orders w where w.id = p.parent_id and w.public_enabled))
  ) or exists (select 1 from organizations o where o.settings->>'logo_url' = object_name)
$$;

create policy photos_public_read on storage.objects for select to anon
  using (bucket_id = 'photos' and is_public_file(name));

-- ===== Parte 2: campos extras de clientes e veículos =====
-- Campos extras de clientes e veículos (cadastro mais completo, todos opcionais).
alter table customers add column if not exists city text;
alter table customers add column if not exists birth_date date;
alter table vehicles add column if not exists fuel text;
alter table vehicles add column if not exists renavam text;
