-- =====================================================================
-- Recicla Slide: banco do placar online (Supabase / Postgres)
--
-- Como usar: no painel do Supabase, abra "SQL Editor", cole este arquivo
-- inteiro e clique em "Run". Pode rodar de novo sem estragar nada.
--
-- Regras:
--   * Ninguém escreve direto nas tabelas. Toda escrita passa pelas funções
--     abaixo (security definer), que conferem tudo no servidor.
--   * Leitura pública só do que é placar: views sem o hash do PIN.
--   * Sem e-mail, sem senha, sem dado pessoal. O "aparelho" é um
--     identificador aleatório que o navegador cria e guarda.
--   * O PIN do síndico fica guardado só como hash (bcrypt).
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------

create table if not exists public.predios (
  id                  uuid primary key default gen_random_uuid(),
  codigo              text not null unique check (codigo ~ '^[A-Z0-9]{6}$'),
  nome                text not null check (char_length(nome) between 2 and 60),
  andares             int  not null check (andares between 2 and 60),
  aptos_por_andar     int  not null check (aptos_por_andar between 1 and 20),
  premio_titulo       text check (premio_titulo is null or char_length(premio_titulo) <= 80),
  premio_patrocinador text check (premio_patrocinador is null or char_length(premio_patrocinador) <= 60),
  pin_hash            text not null,
  mes_inicio          timestamptz not null default date_trunc('month', now()),
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now()
);

-- Etapa 3 (painel do síndico). "add column if not exists": quem já rodou a versão
-- anterior deste arquivo pode rodar de novo, sem perder nada.
alter table public.predios add column if not exists premio_exemplo boolean     not null default true;  -- patrocinador ainda fictício
alter table public.predios add column if not exists limpeza_em     timestamptz not null default now(); -- última limpeza dos tubos
alter table public.predios add column if not exists inspecao_em    timestamptz not null default now(); -- última inspeção das portinholas
alter table public.predios add column if not exists pilhas_em      timestamptz not null default now(); -- última troca das pilhas dos sensores

create table if not exists public.descartes (
  id        bigint generated always as identity primary key,
  predio_id uuid not null references public.predios (id) on delete cascade,
  andar     int  not null check (andar >= 1),
  tipo      text not null check (tipo in ('reciclavel', 'organico')),
  origem    text not null check (origem in ('sensor', 'app', 'demo')),
  aparelho  text check (aparelho is null or char_length(aparelho) between 8 and 64),
  criado_em timestamptz not null default now()
);
create index if not exists descartes_predio_quando on public.descartes (predio_id, criado_em desc);
create index if not exists descartes_aparelho_quando on public.descartes (aparelho, criado_em desc);

create table if not exists public.participantes (
  predio_id uuid not null references public.predios (id) on delete cascade,
  aparelho  text not null check (char_length(aparelho) between 8 and 64),
  andar     int  not null check (andar >= 1),
  criado_em timestamptz not null default now(),
  primary key (predio_id, aparelho)
);

-- Avisos do síndico para as telas (desfez, fechou o mês, mudou o prêmio, alerta,
-- manutenção): as telas ouvem esta tabela pelo Realtime e recarregam o placar.
create table if not exists public.eventos_predio (
  id        bigint generated always as identity primary key,
  predio_id uuid not null references public.predios (id) on delete cascade,
  tipo      text not null,
  criado_em timestamptz not null default now()
);
alter table public.eventos_predio drop constraint if exists eventos_predio_tipo_check;
alter table public.eventos_predio add constraint eventos_predio_tipo_check
  check (tipo in ('desfeito', 'mes_fechado', 'premio', 'alerta', 'manutencao'));

-- Alertas de entupimento: um descarte entrou no andar e não chegou à central do térreo.
-- (Hoje vêm do botão "Simular entupimento" do painel de demonstração. Com o sensor da
-- central instalado, é ele quem avisa: veja docs/sensor-serial.md.)
create table if not exists public.alertas (
  id           bigint generated always as identity primary key,
  predio_id    uuid not null references public.predios (id) on delete cascade,
  andar        int  not null check (andar >= 1),
  tipo         text not null check (tipo in ('reciclavel', 'organico')),
  criado_em    timestamptz not null default now(),
  resolvido_em timestamptz
);
create index if not exists alertas_predio_abertos on public.alertas (predio_id, resolvido_em);

-- Campeões dos meses fechados.
create table if not exists public.campeoes (
  id         bigint generated always as identity primary key,
  predio_id  uuid not null references public.predios (id) on delete cascade,
  mes_inicio timestamptz not null,
  mes_fim    timestamptz not null,
  andar      int,
  reciclavel int not null default 0,
  organico   int not null default 0,
  pontos     int not null default 0
);

-- Tentativas de PIN erradas (contra quem tenta adivinhar o PIN).
create table if not exists public.tentativas_pin (
  id        bigint generated always as identity primary key,
  predio_id uuid not null references public.predios (id) on delete cascade,
  criado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Segurança: RLS ligado em tudo. Escrita só pelas funções.
-- ---------------------------------------------------------------------

alter table public.predios        enable row level security;
alter table public.descartes      enable row level security;
alter table public.participantes  enable row level security;
alter table public.eventos_predio enable row level security;
alter table public.campeoes       enable row level security;
alter table public.tentativas_pin enable row level security;
alter table public.alertas        enable row level security;

revoke all on public.predios, public.descartes, public.participantes, public.eventos_predio,
  public.campeoes, public.tentativas_pin, public.alertas from anon, authenticated;

-- Leitura pública do que não tem segredo (o Realtime também precisa disso).
grant select on public.descartes, public.participantes, public.eventos_predio, public.campeoes, public.alertas
  to anon, authenticated;

drop policy if exists "leitura publica" on public.descartes;
create policy "leitura publica" on public.descartes for select using (true);
drop policy if exists "leitura publica" on public.participantes;
create policy "leitura publica" on public.participantes for select using (true);
drop policy if exists "leitura publica" on public.eventos_predio;
create policy "leitura publica" on public.eventos_predio for select using (true);
drop policy if exists "leitura publica" on public.campeoes;
create policy "leitura publica" on public.campeoes for select using (true);
drop policy if exists "leitura publica" on public.alertas;
create policy "leitura publica" on public.alertas for select using (true);
-- predios e tentativas_pin: nenhuma política = ninguém lê direto (o PIN fica protegido).

-- ---------------------------------------------------------------------
-- Views públicas (sem o hash do PIN)
-- ---------------------------------------------------------------------

-- (colunas novas sempre no fim: "create or replace view" não deixa mudar a ordem)
create or replace view public.predios_publicos as
select
  p.id, p.codigo, p.nome, p.andares, p.aptos_por_andar,
  p.premio_titulo, p.premio_patrocinador, p.mes_inicio, p.criado_em,
  (select count(*) from public.participantes pa where pa.predio_id = p.id)::int as participantes,
  p.premio_exemplo, p.limpeza_em, p.inspecao_em, p.pilhas_em
from public.predios p;

create or replace view public.placar_publico as
select
  p.codigo, p.id as predio_id, d.andar,
  count(*) filter (where d.tipo = 'reciclavel')::int as reciclavel,
  count(*) filter (where d.tipo = 'organico')::int   as organico,
  max(d.criado_em) as ultimo_em
from public.predios p
join public.descartes d on d.predio_id = p.id and d.criado_em >= p.mes_inicio
group by p.codigo, p.id, d.andar;

-- Descartes do mês por dia (gráfico do painel do síndico), no horário de Brasília.
create or replace view public.resumo_por_dia as
select
  p.codigo, p.id as predio_id,
  (d.criado_em at time zone 'America/Sao_Paulo')::date as dia,
  count(*) filter (where d.tipo = 'reciclavel')::int as reciclavel,
  count(*) filter (where d.tipo = 'organico')::int   as organico
from public.predios p
join public.descartes d on d.predio_id = p.id and d.criado_em >= p.mes_inicio
group by p.codigo, p.id, (d.criado_em at time zone 'America/Sao_Paulo')::date;

grant select on public.predios_publicos, public.placar_publico, public.resumo_por_dia to anon, authenticated;

-- ---------------------------------------------------------------------
-- Funções (toda escrita passa por aqui)
-- ---------------------------------------------------------------------

-- Cria um prédio e devolve o código de 6 caracteres (sem 0, O, 1 e I, que confundem).
create or replace function public.criar_predio(p_nome text, p_andares int, p_aptos_por_andar int, p_pin text)
returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_codigo text;
  v_letras constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  if p_nome is null or char_length(trim(p_nome)) not between 2 and 60 then raise exception 'nome_invalido'; end if;
  if p_andares is null or p_andares not between 2 and 60 then raise exception 'andares_invalido'; end if;
  if p_aptos_por_andar is null or p_aptos_por_andar not between 1 and 20 then raise exception 'aptos_invalido'; end if;
  if p_pin is null or p_pin !~ '^[0-9]{4,6}$' then raise exception 'pin_invalido'; end if;
  loop
    select string_agg(substr(v_letras, 1 + floor(random() * 32)::int, 1), '') into v_codigo
      from generate_series(1, 6);
    exit when not exists (select 1 from public.predios where codigo = v_codigo);
  end loop;
  insert into public.predios (codigo, nome, andares, aptos_por_andar, pin_hash)
    values (v_codigo, trim(p_nome), p_andares, p_aptos_por_andar, extensions.crypt(p_pin, extensions.gen_salt('bf')));
  return v_codigo;
end $$;

-- Coloca o aparelho num andar do prédio: sempre o andar com menos gente.
-- O mesmo aparelho recebe sempre o mesmo andar.
create or replace function public.entrar(p_codigo text, p_aparelho text)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_predio public.predios;
  v_andar  int;
begin
  select * into v_predio from public.predios where codigo = upper(trim(p_codigo));
  if not found then raise exception 'predio_nao_encontrado'; end if;
  if p_aparelho is null or char_length(p_aparelho) not between 8 and 64 then raise exception 'aparelho_invalido'; end if;

  -- um de cada vez neste prédio, para dois celulares não pegarem o mesmo "andar mais vazio"
  perform pg_advisory_xact_lock(hashtext(v_predio.id::text));

  select andar into v_andar from public.participantes
    where predio_id = v_predio.id and aparelho = p_aparelho;
  if found then return v_andar; end if;

  select a.andar into v_andar
    from generate_series(1, v_predio.andares) as a(andar)
    left join public.participantes pa on pa.predio_id = v_predio.id and pa.andar = a.andar
    group by a.andar
    order by count(pa.aparelho), random()
    limit 1;

  insert into public.participantes (predio_id, aparelho, andar) values (v_predio.id, p_aparelho, v_andar);
  return v_andar;
end $$;

-- Registra um descarte. Toques pelo app ('app'): no mínimo 2 segundos entre
-- toques do mesmo aparelho (trava no servidor). Sensor e painel não têm trava.
create or replace function public.registrar_descarte(p_codigo text, p_andar int, p_tipo text, p_origem text, p_aparelho text)
returns public.descartes
language plpgsql security definer set search_path = public as $$
declare
  v_predio public.predios;
  v_linha  public.descartes;
begin
  select * into v_predio from public.predios where codigo = upper(trim(p_codigo));
  if not found then raise exception 'predio_nao_encontrado'; end if;
  if p_andar is null or p_andar not between 1 and v_predio.andares then raise exception 'andar_invalido'; end if;
  if p_tipo not in ('reciclavel', 'organico') then raise exception 'tipo_invalido'; end if;
  if p_origem not in ('sensor', 'app', 'demo') then raise exception 'origem_invalida'; end if;
  if p_aparelho is not null and char_length(p_aparelho) not between 8 and 64 then raise exception 'aparelho_invalido'; end if;

  if p_origem = 'app' then
    if p_aparelho is null then raise exception 'aparelho_invalido'; end if;
    perform pg_advisory_xact_lock(hashtext(p_aparelho));
    if exists (
      select 1 from public.descartes
      where aparelho = p_aparelho and origem = 'app' and criado_em > now() - interval '2 seconds'
    ) then
      raise exception 'devagar' using hint = 'Espere 2 segundos entre um toque e outro.';
    end if;
  end if;

  insert into public.descartes (predio_id, andar, tipo, origem, aparelho)
    values (v_predio.id, p_andar, p_tipo, p_origem, p_aparelho)
    returning * into v_linha;
  return v_linha;
end $$;

-- Confere o PIN do síndico. Mais de 10 erros em 10 minutos bloqueia por um tempo.
-- Devolve o prédio, ou null (e anota a tentativa) se o PIN estiver errado.
create or replace function public.predio_do_sindico(p_codigo text, p_pin text, out o_predio public.predios, out o_erro text)
language plpgsql security definer set search_path = public, extensions as $$
begin
  select * into o_predio from public.predios where codigo = upper(trim(p_codigo));
  if not found then o_erro := 'predio_nao_encontrado'; return; end if;
  if (select count(*) from public.tentativas_pin
        where predio_id = o_predio.id and criado_em > now() - interval '10 minutes') >= 10 then
    o_predio := null; o_erro := 'muitas_tentativas'; return;
  end if;
  if p_pin is null or o_predio.pin_hash <> extensions.crypt(p_pin, o_predio.pin_hash) then
    insert into public.tentativas_pin (predio_id) values (o_predio.id);
    o_predio := null; o_erro := 'pin_errado'; return;
  end if;
end $$;
revoke execute on function public.predio_do_sindico(text, text) from public, anon, authenticated;

-- As funções do síndico devolvem {"ok": true, ...} ou {"ok": false, "erro": "pin_errado"}.
-- (Não levantam erro de PIN para a tentativa errada ficar anotada.)

create or replace function public.verificar_pin(p_codigo text, p_pin text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v record;
begin
  select * into v from public.predio_do_sindico(p_codigo, p_pin);
  if v.o_erro is not null then return jsonb_build_object('ok', false, 'erro', v.o_erro); end if;
  return jsonb_build_object('ok', true, 'codigo', (v.o_predio).codigo, 'nome', (v.o_predio).nome);
end $$;

-- Prêmio do mês. p_exemplo: o patrocinador ainda é fictício (as telas mostram "Exemplo").
drop function if exists public.definir_premio(text, text, text, text);
create or replace function public.definir_premio(p_codigo text, p_pin text, p_titulo text, p_patrocinador text, p_exemplo boolean default true)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v record;
begin
  select * into v from public.predio_do_sindico(p_codigo, p_pin);
  if v.o_erro is not null then return jsonb_build_object('ok', false, 'erro', v.o_erro); end if;
  update public.predios
    set premio_titulo = nullif(left(trim(coalesce(p_titulo, '')), 80), ''),
        premio_patrocinador = nullif(left(trim(coalesce(p_patrocinador, '')), 60), ''),
        premio_exemplo = coalesce(p_exemplo, true),
        atualizado_em = now()
    where id = (v.o_predio).id;
  insert into public.eventos_predio (predio_id, tipo) values ((v.o_predio).id, 'premio');
  return jsonb_build_object('ok', true);
end $$;

-- Desfaz o descarte mais recente do mês.
create or replace function public.desfazer_ultimo(p_codigo text, p_pin text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v record;
  v_linha public.descartes;
begin
  select * into v from public.predio_do_sindico(p_codigo, p_pin);
  if v.o_erro is not null then return jsonb_build_object('ok', false, 'erro', v.o_erro); end if;
  delete from public.descartes
    where id = (
      select id from public.descartes
      where predio_id = (v.o_predio).id and criado_em >= (v.o_predio).mes_inicio
      order by criado_em desc, id desc limit 1
    )
    returning * into v_linha;
  if v_linha.id is null then return jsonb_build_object('ok', true, 'nada', true); end if;
  insert into public.eventos_predio (predio_id, tipo) values ((v.o_predio).id, 'desfeito');
  return jsonb_build_object('ok', true, 'andar', v_linha.andar, 'tipo', v_linha.tipo);
end $$;

-- Fecha o mês: guarda o campeão e zera o placar (o placar conta a partir de agora).
create or replace function public.fechar_mes(p_codigo text, p_pin text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v record;
  v_campeao record;
begin
  select * into v from public.predio_do_sindico(p_codigo, p_pin);
  if v.o_erro is not null then return jsonb_build_object('ok', false, 'erro', v.o_erro); end if;
  select andar,
         count(*) filter (where tipo = 'reciclavel')::int as reciclavel,
         count(*) filter (where tipo = 'organico')::int   as organico,
         (count(*) * 10)::int as pontos
    into v_campeao
    from public.descartes
    where predio_id = (v.o_predio).id and criado_em >= (v.o_predio).mes_inicio
    group by andar
    order by count(*) desc, andar
    limit 1;
  insert into public.campeoes (predio_id, mes_inicio, mes_fim, andar, reciclavel, organico, pontos)
    values ((v.o_predio).id, (v.o_predio).mes_inicio, now(), v_campeao.andar,
            coalesce(v_campeao.reciclavel, 0), coalesce(v_campeao.organico, 0), coalesce(v_campeao.pontos, 0));
  update public.predios set mes_inicio = now(), atualizado_em = now() where id = (v.o_predio).id;
  insert into public.eventos_predio (predio_id, tipo) values ((v.o_predio).id, 'mes_fechado');
  return jsonb_build_object('ok', true, 'andar', v_campeao.andar, 'pontos', coalesce(v_campeao.pontos, 0));
end $$;

-- Demonstração: um descarte entrou no andar e não chegou à central (alerta de entupimento).
create or replace function public.simular_entupimento(p_codigo text, p_pin text, p_andar int, p_tipo text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v record;
  v_id bigint;
begin
  select * into v from public.predio_do_sindico(p_codigo, p_pin);
  if v.o_erro is not null then return jsonb_build_object('ok', false, 'erro', v.o_erro); end if;
  if p_andar is null or p_andar not between 1 and (v.o_predio).andares then raise exception 'andar_invalido'; end if;
  if p_tipo not in ('reciclavel', 'organico') then raise exception 'tipo_invalido'; end if;
  insert into public.alertas (predio_id, andar, tipo) values ((v.o_predio).id, p_andar, p_tipo) returning id into v_id;
  insert into public.eventos_predio (predio_id, tipo) values ((v.o_predio).id, 'alerta');
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

-- O síndico marca o alerta como resolvido (tubo desentupido).
create or replace function public.resolver_alerta(p_codigo text, p_pin text, p_id bigint)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v record;
begin
  select * into v from public.predio_do_sindico(p_codigo, p_pin);
  if v.o_erro is not null then return jsonb_build_object('ok', false, 'erro', v.o_erro); end if;
  update public.alertas set resolvido_em = now()
    where id = p_id and predio_id = (v.o_predio).id and resolvido_em is null;
  if found then insert into public.eventos_predio (predio_id, tipo) values ((v.o_predio).id, 'alerta'); end if;
  return jsonb_build_object('ok', true);
end $$;

-- Manutenção feita hoje: 'limpeza' (tubos, a cada 3 meses), 'inspecao' (portinholas
-- corta-fogo, todo mês) ou 'pilhas' (sensores das lixeiras, a cada 3 meses).
create or replace function public.registrar_manutencao(p_codigo text, p_pin text, p_item text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v record;
begin
  select * into v from public.predio_do_sindico(p_codigo, p_pin);
  if v.o_erro is not null then return jsonb_build_object('ok', false, 'erro', v.o_erro); end if;
  if p_item not in ('limpeza', 'inspecao', 'pilhas') then return jsonb_build_object('ok', false, 'erro', 'item_invalido'); end if;
  update public.predios
    set limpeza_em  = case when p_item = 'limpeza'  then now() else limpeza_em  end,
        inspecao_em = case when p_item = 'inspecao' then now() else inspecao_em end,
        pilhas_em   = case when p_item = 'pilhas'   then now() else pilhas_em   end,
        atualizado_em = now()
    where id = (v.o_predio).id;
  insert into public.eventos_predio (predio_id, tipo) values ((v.o_predio).id, 'manutencao');
  return jsonb_build_object('ok', true, 'em', now());
end $$;

grant execute on function
  public.criar_predio(text, int, int, text),
  public.entrar(text, text),
  public.registrar_descarte(text, int, text, text, text),
  public.verificar_pin(text, text),
  public.definir_premio(text, text, text, text, boolean),
  public.desfazer_ultimo(text, text),
  public.fechar_mes(text, text),
  public.simular_entupimento(text, text, int, text),
  public.resolver_alerta(text, text, bigint),
  public.registrar_manutencao(text, text, text)
to anon, authenticated;

-- ---------------------------------------------------------------------
-- Realtime: as telas recebem cada descarte em menos de um segundo
-- ---------------------------------------------------------------------

do $$
begin
  begin alter publication supabase_realtime add table public.descartes;      exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.participantes;  exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.eventos_predio; exception when duplicate_object then null; end;
end $$;

-- ---------------------------------------------------------------------
-- Conferência (opcional): rode depois, uma linha de cada vez, para testar.
--   select criar_predio('Prédio de Teste', 20, 4, '1234');      -- devolve o código, ex.: K7M2QX
--   select entrar('K7M2QX', 'aparelho-de-teste-1');             -- devolve um andar
--   select registrar_descarte('K7M2QX', 3, 'reciclavel', 'app', 'aparelho-de-teste-1');
--   select * from placar_publico where codigo = 'K7M2QX';
--   select verificar_pin('K7M2QX', '1234');                     -- {"ok": true, ...}
--   select * from resumo_por_dia where codigo = 'K7M2QX';       -- descartes do mês por dia
--   select simular_entupimento('K7M2QX', '1234', 3, 'reciclavel'); -- alerta no painel
-- ---------------------------------------------------------------------
