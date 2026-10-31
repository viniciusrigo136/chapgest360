-- Campos extras de clientes e veículos (cadastro mais completo, todos opcionais).
alter table customers add column if not exists city text;
alter table customers add column if not exists birth_date date;
alter table vehicles add column if not exists fuel text;
alter table vehicles add column if not exists renavam text;
