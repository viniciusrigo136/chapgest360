\set ON_ERROR_STOP 1
insert into auth.users values ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b');

-- Usuário A cria a oficina A
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select create_organization('Oficina A') as org_a \gset
insert into customers (organization_id, name) values (:'org_a', 'João da Silva') returning id as cust_a \gset
insert into vehicles (organization_id, customer_id, plate, model) values (:'org_a', :'cust_a', 'ABC1D23', 'Gol') returning id as veh_a \gset
insert into quotes (organization_id, number, customer_id, vehicle_id, valid_until, items, discount, public_token)
values (:'org_a', '', :'cust_a', :'veh_a', current_date + 10,
  '[{"qty":2,"unit_price":15050},{"qty":1.5,"unit_price":1001}]', 500, 'tokenquote_aaaaaaaaaaaaaa')
returning number, subtotal, total \gset
\echo quote :number subtotal :subtotal total :total
select (:'number' = 'ORC-' || extract(year from now())::int || '-0001') as numero_ok, (:subtotal = 31602) as subtotal_ok, (:total = 31102) as total_ok;

-- Usuário B cria a oficina B e não enxerga nada de A
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
select create_organization('Oficina B') as org_b \gset
select count(*) = 0 as isolamento_ok from customers;
select count(*) = 0 as isolamento_quotes_ok from quotes;
do $$ begin
  insert into customers (organization_id, name) values ((select id from organizations where name = 'Oficina A'), 'invasor');
  raise exception 'FALHOU: inseriu em outra oficina';
exception when insufficient_privilege then raise notice 'ok: insert em outra oficina bloqueado';
end $$;
-- B tenta vincular veículo de A a cliente seu
insert into customers (organization_id, name) values (:'org_b', 'Cliente B') returning id as cust_b \gset
do $$ begin
  insert into vehicles (organization_id, customer_id, plate) values ((select id from organizations where name = 'Oficina B'),
     (select id from customers limit 1), 'XYZ1234');
  raise notice 'ok: veículo próprio';
end $$;

-- Volta para A: OS, pagamento acima do saldo, estorno
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select id as quote_a from quotes limit 1 \gset
insert into work_orders (organization_id, number, customer_id, vehicle_id, quote_id, items, public_token)
values (:'org_a', '', :'cust_a', :'veh_a', :'quote_a', '[{"qty":1,"unit_price":10000}]', 'tokenos_aaaaaaaaaaaaaaaaa')
returning id as wo_a, number as wo_number \gset
\echo os :wo_number
insert into payments (organization_id, work_order_id, customer_id, paid_at, amount, method) values (:'org_a', :'wo_a', :'cust_a', current_date, 6000, 'pix') returning id as pay1 \gset
do $$ begin
  insert into payments (organization_id, work_order_id, customer_id, paid_at, amount, method)
  select organization_id, id, customer_id, current_date, 5000, 'pix' from work_orders limit 1;
  raise exception 'FALHOU: aceitou pagamento acima do saldo';
exception when raise_exception then
  if sqlerrm like 'FALHOU%' then raise; end if;
  raise notice 'ok: %', sqlerrm;
end $$;
do $$ begin
  update payments set amount = 1;
  raise exception 'FALHOU: alterou valor de pagamento';
exception when raise_exception then
  if sqlerrm like 'FALHOU%' then raise; end if;
  raise notice 'ok: %', sqlerrm;
end $$;
update payments set reversed_at = now() where id = :'pay1';
do $$ begin
  delete from payments;
  if exists (select 1 from payments) then raise notice 'ok: delete de pagamento ignorado pela RLS'; else raise exception 'FALHOU: apagou pagamento'; end if;
end $$;
insert into photos (organization_id, parent_type, parent_id, path, is_public) values (:'org_a', 'work_order', :'wo_a', :'org_a' || '/p1.jpg', true);
insert into photos (organization_id, parent_type, parent_id, path, is_public) values (:'org_a', 'work_order', :'wo_a', :'org_a' || '/p2.jpg', false);
insert into stage_events (organization_id, work_order_id, stage, note) values (:'org_a', :'wo_a', 'pintura', 'Começamos a pintura');
update work_orders set internal_notes = 'SEGREDO interno', customer_notes = 'ok' where id = :'wo_a';
reset role;
insert into storage.objects (bucket_id, name) values ('photos', :'org_a' || '/p1.jpg'), ('photos', :'org_a' || '/p2.jpg');

-- Visitante anônimo
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select count(*) = 0 as anon_sem_acesso_tabela from customers;
select public_document('token-errado') is null as token_errado_ok;
select public_document('tokenos_aaaaaaaaaaaaaaaaa') as doc \gset
select position('SEGREDO' in :'doc') = 0 as sem_dados_internos,
       jsonb_array_length((:'doc')::jsonb->'photos') = 1 as so_fotos_publicas,
       ((:'doc')::jsonb->>'customer_name') = 'João' as primeiro_nome,
       ((:'doc')::jsonb->>'paid')::int = 0 as pago_sem_estorno,
       jsonb_array_length((:'doc')::jsonb->'events') = 1 as eventos;
select count(*) = 1 as anon_ve_so_foto_publica from storage.objects;
select public_decision('tokenquote_aaaaaaaaaaaaaa', true, 'João da Silva', '');
do $$ begin
  perform public_decision('tokenquote_aaaaaaaaaaaaaa', false, 'João', '');
  raise exception 'FALHOU: respondeu duas vezes';
exception when raise_exception then
  if sqlerrm like 'FALHOU%' then raise; end if;
  raise notice 'ok: %', sqlerrm;
end $$;
reset role;
select status = 'aprovado' and decision_by = 'João da Silva' as aprovacao_ok from quotes where public_token = 'tokenquote_aaaaaaaaaaaaaa';
\echo TODOS OS TESTES SQL PASSARAM
