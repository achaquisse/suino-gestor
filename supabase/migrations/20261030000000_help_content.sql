create or replace function public.help_fold(p_text text)
returns text
language sql
immutable
parallel safe
as $$
  select lower(translate(coalesce(p_text, ''),
    'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
    'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'))
$$;

create table public.help_docs (
  id text primary key check (id ~ '^[a-z0-9-]+$'),
  kind text not null check (kind in ('guide', 'article')),
  cat text not null check (cat in ('Saúde', 'Reprodução', 'Alimentação', 'Maneio', 'Usar o Suino Gestor')),
  title text not null check (title <> ''),
  blurb text not null default '',
  icon text not null default '',
  mins int not null default 3 check (mins between 1 and 60),
  lead text not null default '',
  facts jsonb not null default '[]' check (jsonb_typeof(facts) = 'array'),
  sections jsonb not null default '[]' check (jsonb_typeof(sections) = 'array'),
  example jsonb check (example is null or jsonb_typeof(example) = 'object'),
  warn jsonb not null default '[]' check (jsonb_typeof(warn) = 'array'),
  cta_label text,
  cta_target text check (cta_target in ('birth', 'illness', 'transfer', 'mating', 'treatment', 'weight', 'death', 'sale',
    'expense', 'purchase', 'buyAnimals', 'activity', 'settings', 'reports')),
  hero_url text check (hero_url is null or hero_url ~ '^https://'),
  hero_alt text not null default '',
  hero_credit text not null default '',
  hero_source text,
  sort int not null default 0,
  published boolean not null default true,
  search_text text not null default '',
  updated_at timestamptz not null default now(),
  check ((cta_label is null) = (cta_target is null))
);

create index help_docs_list_idx on public.help_docs (kind, sort);
create index help_docs_fts_idx on public.help_docs using gin (to_tsvector('portuguese', search_text));

create or replace function public.help_docs_prepare()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.search_text := help_fold(concat_ws(' ', new.title, new.blurb, new.cat, new.lead, (
    select string_agg(t, ' ') from (
      select jsonb_path_query(new.facts, 'lax $[*][*]') #>> '{}' as t
      union all select jsonb_path_query(new.sections, 'lax $[*].h') #>> '{}'
      union all select jsonb_path_query(new.sections, 'lax $[*].p[*]') #>> '{}'
      union all select jsonb_path_query(new.sections, 'lax $[*].list[*]') #>> '{}'
      union all select jsonb_path_query(new.sections, 'lax $[*].steps[*][*]') #>> '{}'
      union all select jsonb_path_query(new.sections, 'lax $[*].tip') #>> '{}'
      union all select jsonb_path_query(new.sections, 'lax $[*].img.caption') #>> '{}'
      union all select jsonb_path_query(coalesce(new.example, '{}'), 'lax $.title') #>> '{}'
      union all select jsonb_path_query(coalesce(new.example, '{}'), 'lax $.intro') #>> '{}'
      union all select jsonb_path_query(coalesce(new.example, '{}'), 'lax $.steps[*][*]') #>> '{}'
      union all select jsonb_path_query(new.warn, 'lax $[*]') #>> '{}'
    ) x
  )));
  new.updated_at := now();
  return new;
end;
$$;

create trigger help_docs_prepare
before insert or update on public.help_docs
for each row execute function public.help_docs_prepare();

alter table public.help_docs enable row level security;
create policy "help_docs: signed-in read published" on public.help_docs
  for select to authenticated using (published);
grant select on public.help_docs to authenticated;

create or replace function public.search_help(p_query text default '', p_cat text default null)
returns jsonb
language sql
stable
set search_path = public
as $$
  with words as (
    select array(
      select w from regexp_split_to_table(regexp_replace(help_fold(left(p_query, 200)), '[^a-z0-9]+', ' ', 'g'), ' ') w
      where w <> '' limit 8
    ) as w
  ),
  q as (
    select w, case when cardinality(w) = 0 then null
      else to_tsquery('portuguese', array_to_string(array(select x || ':*' from unnest(w) x), ' & ')) end as tsq
    from words
  ),
  hits as (
    select d.*,
      case when q.tsq is null then 0
        else ts_rank(to_tsvector('portuguese', d.search_text), q.tsq)
          + case when help_fold(d.title) like '%' || array_to_string(q.w, ' ') || '%' then 1 else 0 end
          + 0.3 * (select count(*) from unnest(q.w) x where help_fold(d.title) like '%' || x || '%')
      end as rank
    from help_docs d, q
    where d.published and (
      q.tsq is null
      or to_tsvector('portuguese', d.search_text) @@ q.tsq
      or not exists (select 1 from unnest(q.w) x where d.search_text !~ ('\m' || x))
    )
  )
  select jsonb_build_object(
    'total', (select count(*) from hits),
    'counts', coalesce((select jsonb_object_agg(cat, n) from (select cat, count(*) as n from hits group by cat) c), '{}'::jsonb),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', h.id, 'kind', h.kind, 'cat', h.cat, 'title', h.title, 'blurb', h.blurb, 'icon', h.icon, 'mins', h.mins,
        'lead', h.lead, 'n_sections', jsonb_array_length(h.sections), 'hero_url', h.hero_url, 'hero_alt', h.hero_alt,
        'rank', round(h.rank::numeric, 4)
      ) order by h.kind desc, h.rank desc, h.sort, h.title)
      from hits h where p_cat is null or h.cat = p_cat
    ), '[]'::jsonb)
  )
$$;

grant execute on function public.search_help(text, text) to authenticated;
grant execute on function public.help_fold(text) to authenticated;

insert into public.help_docs (id, kind, cat, title, blurb, icon, mins, lead, facts, sections, example, warn, cta_label, cta_target, hero_url, hero_alt, hero_credit, hero_source, sort) values
(
  'heat',
  'guide',
  'Reprodução',
  'Cio',
  'Detectar, testar, cobrir na hora certa e registar',
  'favorite',
  6,
  'O cio é o curto período em que a porca aceita o macho. Detectá-lo a tempo é o que separa uma ninhada grande de um mês perdido: cada cio falhado custa cerca de 21 dias de produção.',
  '[["Ciclo","21 dias"],["Duração","2–3 dias"],["Cobrir","12–24 h após início"],["Após desmame","4–7 dias"]]'::jsonb,
  '[{"h":"Sinais a observar","p":["Os sinais aparecem de forma gradual. Observe as porcas duas vezes por dia, sempre à mesma hora — de manhã cedo e ao fim da tarde, quando estão mais calmas."],"list":["Vulva inchada e avermelhada, por vezes com muco claro","Inquietação: levanta-se e deita-se muitas vezes","Monta outras porcas ou deixa-se montar","Orelhas erguidas e rígidas, sobretudo em raças de orelha direita","Come menos do que o habitual","Grunhidos curtos e repetidos quando o varrasco passa"],"img":{"src":"https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/Duroc_Boar_at_7_Months_-_1.jpg/1280px-Duroc_Boar_at_7_Months_-_1.jpg","caption":"O varrasco por perto: o cheiro e o som do macho tornam o cio mais evidente","credit":"Dingar · CC0 · Wikimedia Commons","source":"https://commons.wikimedia.org/wiki/File:Duroc_Boar_at_7_Months_-_1.jpg"}},{"h":"Como fazer o teste de cio","p":["O teste mais fiável é o reflexo de imobilidade. Faça-o sempre com o varrasco do outro lado da grade: o cheiro e o som do macho aumentam muito a resposta da porca."],"steps":[["Aproxime o varrasco","Leve o varrasco até à frente do curral, focinho com focinho, durante 1 a 2 minutos."],["Pressione o dorso","Com as duas mãos, pressione firmemente o lombo da porca, logo atrás das costelas. Pode também sentar-se sobre ela."],["Observe a reacção","Se fica imóvel, com as orelhas para trás e o dorso arqueado, está em cio firme. Se foge ou grunhe, ainda não está."],["Anote a hora","Escreva a hora em que o cio começou (num caderno ou numa Actividade com o nome da porca). É esta hora que define quando cobrir."]],"tip":"Teste as porcas desmamadas a partir do 3.º dia: a maioria entra em cio entre o 4.º e o 7.º dia após o desmame."},{"h":"Quando cobrir","p":["A ovulação acontece no último terço do cio. Cobrir cedo demais ou tarde demais reduz o número de leitões.","A regra prática é simples: se o cio começou de manhã, cubra à tarde e repita na manhã seguinte. Se começou à tarde, cubra na manhã seguinte e repita à tarde."],"list":["Porcas adultas: 1.ª cobrição cerca de 12 h após o início do cio","Leitoas: 1.ª cobrição logo que o cio é detectado (o cio é mais curto)","Sempre 2 cobrições com 12 h de intervalo; uma 3.ª se a porca ainda aceitar o macho","Cubra nas horas frescas do dia: o calor reduz a fertilidade do varrasco"]},{"h":"Registar a cobrição","p":["O Suino Gestor não tem um registo próprio de cio: o que fica registado é a cobrição. Registe-a no dia da primeira cobrição."],"steps":[["Toque em Novo","No telemóvel é o botão redondo “+”; no computador, o botão “Novo”. Escolha Cobertura."],["Preencha","Escolha a porca, o método (Monta natural ou Inseminação) e o varrasco."],["Guarde","O Suino Gestor agenda a verificação de repetição de cio aos 21 dias, o parto previsto aos 114 dias e a tarefa “Transferir para a maternidade” uma semana antes do parto."]],"tip":"Aos 18–24 dias depois da cobrição, volte a testar a porca com o varrasco. Se não mostrar cio, está provavelmente prenhe."}]'::jsonb,
  '{"title":"S-014 em Julho de 2026","intro":"Como a equipa da Granja Boane registou o cio da S-014, que acabou por parir 11 leitões.","steps":[["2 Jul · 07:00","João nota a vulva vermelha e a porca a montar a S-017. Anota a hora no caderno."],["2 Jul · 16:30","Teste de dorso com o B-001 por perto: fica imóvel. Cio firme."],["3 Jul · 06:30","1.ª cobrição com o B-001, monta natural. João regista a Cobertura no Suino Gestor."],["3 Jul · 18:00","2.ª cobrição. O Suino Gestor já tinha agendado a verificação de repetição a 24 Jul e o parto previsto a 25 Out."],["24 Out","Parto: 11 nascidos, 10 vivos — um dia antes do previsto."]]}'::jsonb,
  '["Não há cio 7 a 10 dias depois do desmame","O cio volta 3 semanas após a cobrição (repetição)","Corrimento com mau cheiro, amarelo ou com sangue","Cios irregulares em várias porcas ao mesmo tempo"]'::jsonb,
  'Registar cobrição',
  'mating',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/9/99/Duroc_Boar_at_7_Months_-_2.jpg/1280px-Duroc_Boar_at_7_Months_-_2.jpg',
  'Varrasco Duroc no curral',
  'Dingar · CC0 · Wikimedia Commons',
  'https://commons.wikimedia.org/wiki/File:Duroc_Boar_at_7_Months_-_2.jpg',
  10
),
(
  'farrow',
  'guide',
  'Reprodução',
  'Parto',
  'Antes, durante e nas primeiras 24 horas',
  'child_care',
  8,
  'A maioria das perdas de leitões acontece nos primeiros 3 dias de vida. Um parto bem acompanhado — maternidade preparada, leitões secos e a mamar cedo — pode salvar 1 a 2 leitões por ninhada.',
  '[["Gestação","114 dias"],["Duração do parto","2–6 h"],["Entre leitões","15–20 min"],["Colostro","nas primeiras 6 h"]]'::jsonb,
  '[{"h":"Preparar a maternidade","p":["Transfira a porca para a maternidade 5 a 7 dias antes da data prevista. Isto dá-lhe tempo para se adaptar e reduz o stress no dia do parto. O Suino Gestor cria a tarefa “Transferir para a maternidade” 7 dias antes do parto previsto."],"list":["Curral lavado, desinfectado e seco há pelo menos 3 dias","Lâmpada de aquecimento instalada e testada no ninho dos leitões","Cama seca de palha ou serradura","Toalhas limpas, iodo, tesoura e fio para o umbigo","Luvas compridas e lubrificante, para o caso de ajuda","Lanterna — muitos partos acontecem de noite"],"img":{"src":"https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/Newborn_Baby_Pigs_%28Piglets%29_at_Minnesota_State_Fair_-_CHS_Miracle_of_Birth_Center_%2844315352752%29.jpg/1280px-Newborn_Baby_Pigs_%28Piglets%29_at_Minnesota_State_Fair_-_CHS_Miracle_of_Birth_Center_%2844315352752%29.jpg","caption":"Ninho com lâmpada de aquecimento: os leitões precisam de 30–34 °C","credit":"Tony Webster · CC BY 2.0 · Wikimedia Commons","source":"https://commons.wikimedia.org/wiki/File:Newborn_Baby_Pigs_(Piglets)_at_Minnesota_State_Fair_-_CHS_Miracle_of_Birth_Center_(44315352752).jpg"}},{"h":"Sinais de parto próximo","list":["Faz ninho: junta palha e mexe-se muito (12–24 h antes)","Sai leite ao apertar as tetas da frente (cerca de 24 h antes)","Sai leite das tetas de trás: parto em poucas horas","Respiração rápida, deita-se de lado","Corrimento claro e, por vezes, fezes com mecónio"],"tip":"Leite nas tetas de trás é o sinal mais fiável de que o parto vai começar em menos de 6 horas."},{"h":"Durante o parto","steps":[["Observe sem incomodar","Fique por perto, em silêncio. Intervenha só se for preciso."],["Seque cada leitão","Limpe o focinho e a boca, depois seque o corpo com uma toalha ou serradura."],["Trate o umbigo","Se for comprido, ate a 3 cm do corpo, corte e mergulhe em iodo."],["Leve à teta","Coloque o leitão na teta e confirme que mama. Os mais fracos vão para as tetas da frente, que têm mais leite."],["Conte o tempo","Anote a hora de cada leitão. Mais de 45 minutos sem nascer nenhum, com a porca a fazer força, é sinal de problema."]],"tip":"Leitão que nasce sem respirar: limpe a boca e o nariz, segure-o de cabeça para baixo por instantes e esfregue o peito com vigor com uma toalha seca."},{"h":"Primeiras 24 horas","steps":[["Colostro para todos","Todos os leitões devem mamar nas primeiras 6 horas. Leitões pequenos podem precisar de ajuda."],["Placenta","Confirme que a placenta saiu (normalmente até 4 h após o último leitão) e retire-a do curral."],["Registe a ninhada","No Suino Gestor: Novo → Parto. Indique a porca, nascidos vivos, nados-mortos e quem assistiu. Os leitões são criados no curral da porca, com códigos como L14-01, e a tarefa “Injecção de ferro” é agendada para o 3.º dia."],["Vigie a porca","Deve comer e beber no dia seguinte. Se estiver apática, meça a temperatura rectal: acima de 40 °C é febre."]]}]'::jsonb,
  '{"title":"Parto da S-014 · 24 Out 2026","intro":"Um parto nocturno, com um leitão a precisar de ajuda.","steps":[["23 Out · 20:00","Sai leite das tetas de trás. Marta liga a lâmpada e fica de vigia."],["24 Out · 01:10","Nasce o 1.º leitão. Os seguintes chegam a cada 15–20 minutos."],["24 Out · 03:05","Um leitão nasce sem respirar. Marta limpa a boca, esfrega o peito e ele recupera."],["24 Out · 04:20","Último leitão e placenta. 11 nascidos, 10 vivos."],["24 Out · 07:00","Ninhada registada no Suino Gestor. Ferro agendado para 26 Out."]]}'::jsonb,
  '["Mais de 45 minutos de força sem nascer nenhum leitão","Corrimento escuro com mau cheiro antes do primeiro leitão","A porca tem febre acima de 40 °C ou não come no dia seguinte","A porca não tem leite ou os leitões choram e não engordam"]'::jsonb,
  'Registar parto',
  'birth',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/2/20/Lactation_Sow.JPG/1280px-Lactation_Sow.JPG',
  'Porca a amamentar a ninhada na maternidade',
  'Dingar · Public domain · Wikimedia Commons',
  'https://commons.wikimedia.org/wiki/File:Lactation_Sow.JPG',
  20
),
(
  'flu',
  'guide',
  'Saúde',
  'Gripe e tosse',
  'Sinais respiratórios na recria e nas porcas',
  'air',
  5,
  'Os problemas respiratórios espalham-se depressa num curral fechado. Agir nas primeiras 24 horas — isolar, medir a febre e melhorar o ar — evita que um animal doente se transforme num curral inteiro.',
  '[["Incubação","1–3 dias"],["Febre","acima de 40 °C"],["Recuperação","7–10 dias"],["Isolar","no próprio dia"]]'::jsonb,
  '[{"h":"Sinais","list":["Tosse seca ou com expectoração, sobretudo ao levantar","Espirros e corrimento nasal","Respiração rápida, com movimento da barriga","Febre: orelhas quentes, animal deitado e encolhido","Come menos e perde peso"]},{"h":"Medir a temperatura","p":["A temperatura normal de um porco é de 38,5 a 39,5 °C. Acima de 40 °C há febre."],"steps":[["Prepare o termómetro","Use um termómetro digital, limpo e com um pouco de vaselina."],["Introduza no recto","Cerca de 3 cm, inclinado para cima, durante 1 minuto ou até apitar."],["Registe o valor","No Suino Gestor: Novo → Doença, escolha o sintoma Febre e escreva o valor nas Notas (por exemplo “40,6 °C”)."]]},{"h":"O que fazer","steps":[["Isole","Separe os animais com febre para um curral de enfermaria (Novo → Transferência). No registo de Doença, active “Isolar animal” para que o estado do animal o mostre."],["Melhore o ar","Abra a ventilação, mas evite correntes de ar directas sobre os animais."],["Água e comida","Água fresca sempre disponível. Ração humedecida ajuda os que comem pouco."],["Chame o veterinário","Se houver mais de um animal doente, o veterinário decide o tratamento. Não use antibióticos sem receita. Registe o tratamento receitado: a carência é preenchida automaticamente."]],"tip":"Registe cada episódio no animal: o histórico ajuda o veterinário a ver se o problema se repete no mesmo curral.","img":{"src":"https://upload.wikimedia.org/wikipedia/commons/thumb/c/c4/Pig_in_a_pen.jpg/1280px-Pig_in_a_pen.jpg","caption":"Animal isolado num curral de enfermaria, seco e sem correntes de ar","credit":"Andikan Efiok Eduok · CC BY-SA 4.0 · Wikimedia Commons","source":"https://commons.wikimedia.org/wiki/File:Pig_in_a_pen.jpg"}},{"h":"Prevenir","list":["Ventilação sem correntes de ar ao nível dos animais","Evite grandes diferenças de temperatura entre o dia e a noite nos currais","Respeite a densidade: o ar fica pior em currais cheios","Tudo dentro, tudo fora: lave e deixe vazio o curral entre lotes","Vacine contra Mycoplasma se o veterinário o recomendar"]}]'::jsonb,
  '{"title":"G-108 · Recria · Out 2026","intro":"Um caso apanhado a tempo.","steps":[["26 Out · 08:00","João ouve tosse na recria. Mede a temperatura do G-108: 40,6 °C."],["26 Out · 08:30","G-108 isolado na enfermaria. Doença registada no Suino Gestor (Febre, 40,6 °C nas notas), Dr. Sitoe avisado."],["26 Out · 15:00","Dr. Sitoe receita Oxitetraciclina LA 20%. Tratamento registado: carência de 28 dias preenchida automaticamente."],["27 Out","Restantes 13 animais sem febre. Vigilância diária durante uma semana."]]}'::jsonb,
  '["Vários animais com febre ao mesmo tempo","Respiração muito difícil, com a boca aberta","Pele azulada nas orelhas ou na barriga","Não come há mais de 2 dias"]'::jsonb,
  'Registar doença',
  'illness',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Pig_farm_of_GTSEZ.jpg/1280px-Pig_farm_of_GTSEZ.jpg',
  'Tratador a vigiar os animais no pavilhão',
  'Golden Triangle SEZ · CC BY-SA 4.0 · Wikimedia Commons',
  'https://commons.wikimedia.org/wiki/File:Pig_farm_of_GTSEZ.jpg',
  30
),
(
  'diar',
  'guide',
  'Saúde',
  'Diarreia',
  'Mais perigosa em leitões pequenos',
  'water_drop',
  5,
  'Um leitão com diarreia pode morrer de desidratação em 24 a 48 horas. O mais importante é repor água e sais depressa, manter o ninho quente e perceber a causa.',
  '[["Maior risco","0–7 dias e desmame"],["Desidratação","24–48 h"],["Electrólitos","3–4 vezes por dia"],["Ninho","30–34 °C"]]'::jsonb,
  '[{"h":"Sinais e gravidade","list":["Fezes líquidas, amarelas, brancas ou cinzentas","Cauda e traseiro sujos e molhados","Leitões fracos, com pêlo eriçado e olhos fundos","Pele que não volta ao lugar quando se belisca (desidratação)","Sangue nas fezes: sinal grave"]},{"h":"Causas mais comuns","list":["Frio e humidade no ninho — a causa mais frequente nos primeiros dias","Bactérias (E. coli), sobretudo nos primeiros 5 dias e logo após o desmame","Coccidiose: fezes pastosas amarelas entre os 5 e os 15 dias de vida","Pouco colostro nas primeiras horas de vida","Mudanças bruscas de ração ou água suja"]},{"h":"Preparar electrólitos caseiros","p":["Quando não há electrólitos comerciais, esta mistura ajuda a repor os sais perdidos."],"steps":[["1 litro de água","Fervida e arrefecida até à temperatura do corpo."],["6 colheres de chá rasas de açúcar","Cerca de 25 g."],["½ colher de chá rasa de sal","Cerca de 2,5 a 3 g. Sal a mais faz mal: meça com cuidado."],["Dar 3 a 4 vezes por dia","Em bebedouro baixo ou com seringa sem agulha, 20–30 ml por leitão de cada vez. Não tire os leitões da mãe: continuam a mamar."]],"tip":"Prepare uma mistura nova todos os dias e deite fora o que sobrar. Se tiver electrólitos comerciais (Electrólitos orais), prefira-os."},{"h":"Cuidados no curral","steps":[["Aqueça o ninho","Leitões com frio têm mais diarreia. Baixe a lâmpada ou acrescente cama seca."],["Limpe e seque","Retire as fezes duas vezes por dia e espalhe cal ou serradura nas zonas molhadas."],["Registe o episódio","No Suino Gestor: Novo → Doença, sintoma Diarreia, nos leitões afectados. O histórico ajuda o veterinário a ver a evolução."]],"img":{"src":"https://upload.wikimedia.org/wikipedia/commons/thumb/d/d8/Exposici%C3%B3n_Ganadera%2C_Isla_San_Marcos.jpg/1280px-Exposici%C3%B3n_Ganadera%2C_Isla_San_Marcos.jpg","caption":"Cama seca e limpa: leitões quentes têm menos diarreia","credit":"CristinaHV · CC BY-SA 4.0 · Wikimedia Commons","source":"https://commons.wikimedia.org/wiki/File:Exposici%C3%B3n_Ganadera,_Isla_San_Marcos.jpg"}}]'::jsonb,
  '{"title":"Ninhada da S-011 · Set 2026","intro":"Diarreia no 4.º dia de vida, resolvida em 48 horas.","steps":[["12 Set · 07:00","Marta vê fezes amarelas em 4 leitões. A lâmpada estava desligada."],["12 Set · 07:30","Lâmpada reparada, cama trocada, electrólitos a toda a ninhada."],["12 Set · 10:00","Dr. Sitoe confirma por telefone: causa provável é o frio. Manter os cuidados."],["14 Set","Fezes normais. Nenhum leitão perdido."]]}'::jsonb,
  '["Leitões com menos de 7 dias com diarreia","Sangue nas fezes","Dura mais de 24 horas apesar dos electrólitos","Vários leitões morrem no mesmo dia"]'::jsonb,
  'Registar doença',
  'illness',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Baby_Pigs_-_Minnesota_State_Fair_%2848662814363%29.jpg/1280px-Baby_Pigs_-_Minnesota_State_Fair_%2848662814363%29.jpg',
  'Leitões a dormir sob a lâmpada de aquecimento',
  'Tony Webster · CC BY 2.0 · Wikimedia Commons',
  'https://commons.wikimedia.org/wiki/File:Baby_Pigs_-_Minnesota_State_Fair_(48662814363).jpg',
  40
),
(
  'inj',
  'guide',
  'Saúde',
  'Ferimentos',
  'Feridas, mordeduras e coxeira',
  'healing',
  4,
  'Brigas, pisos partidos e arestas causam a maior parte dos ferimentos. Tratar cedo evita infecções; perceber a causa evita o próximo.',
  '[["Limpar","no próprio dia"],["Rever","todos os dias"],["Cicatrização","7–14 dias"],["Carência","conforme o produto"]]'::jsonb,
  '[{"h":"Avaliar a ferida","list":["Superficial: arranhão ou mordedura pouco funda — trata-se na granja","Funda ou com sangramento forte — chame o veterinário","Inchada, quente e com pus — infecção, precisa de tratamento","Coxeira sem ferida visível — pode ser uma lesão na pata ou na articulação"]},{"h":"Limpar e tratar","steps":[["Contenha o animal","Use uma tábua para o encostar a um canto. Peça ajuda a outra pessoa."],["Lave a ferida","Com água limpa e sabão neutro, retirando a sujidade."],["Desinfecte","Aplique iodo ou spray anti-séptico. Em feridas com moscas, use um spray repelente."],["Separe se for preciso","Animais feridos são alvo de mais mordeduras. Separe-os até cicatrizar."],["Registe e reveja","No Suino Gestor: Novo → Doença, com o sintoma Ferida ou Coxeira e a gravidade. Se aplicar antibiótico, registe também o tratamento. Reveja a ferida todos os dias."]]},{"h":"Prevenir brigas","list":["Junte animais de lotes diferentes só à noite, quando estão mais calmos","Respeite a densidade de cada curral","Comedouros com espaço para todos comerem ao mesmo tempo","Repare pisos partidos e arestas metálicas"],"tip":"Brigas repetidas no mesmo curral quase sempre indicam falta de espaço ou de comedouro.","img":{"src":"https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/SB043_Pig_farming_Cuba_2.JPG/1280px-SB043_Pig_farming_Cuba_2.JPG","caption":"Animais de lotes diferentes: junte-os à noite e com espaço suficiente","credit":"Susanne Bollinger · CC BY-SA 4.0 · Wikimedia Commons","source":"https://commons.wikimedia.org/wiki/File:SB043_Pig_farming_Cuba_2.JPG"}}]'::jsonb,
  '{"title":"F-064 · Engorda A · Set 2026","intro":"Mordedura na orelha depois de juntar dois lotes.","steps":[["10 Set","Lote da recria junta-se à Engorda A. Durante a tarde há brigas."],["11 Set · 07:00","João vê a F-064 com a orelha a sangrar. Limpa e aplica spray de iodo."],["11 Set · 07:20","F-064 separada para a enfermaria. Registada em Doença → Ferida, gravidade Ligeira."],["18 Set","Ferida fechada. F-064 volta ao curral."]]}'::jsonb,
  '["Ferida funda ou com sangramento que não pára","Suspeita de fractura: o animal não apoia a pata","O animal não se consegue levantar","Ferida inchada com pus e febre"]'::jsonb,
  'Registar ferimento',
  'illness',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/US_Navy_081006-N-5642P-330_U.S._Public_Health_Service_Lt._Cmdr._Julie_Sinclair%2C_a_veterinarian_embarked_aboard_the_amphibious_assault_ship_USS_Kearsarge_%28LHD_3%29%2C_administers_a_vaccination_to_a_pig_during_a_community_service_pro.jpg/1280px-thumbnail.jpg',
  'Veterinária a examinar um porco',
  'U.S. Navy · Public domain · Wikimedia Commons',
  'https://commons.wikimedia.org/wiki/File:US_Navy_081006-N-5642P-330_U.S._Public_Health_Service_Lt._Cmdr._Julie_Sinclair,_a_veterinarian_embarked_aboard_the_amphibious_assault_ship_USS_Kearsarge_(LHD_3),_administers_a_vaccination_to_a_pig_during_a_community_service_pro.jpg',
  50
),
(
  'psa',
  'guide',
  'Saúde',
  'Peste Suína Africana',
  'Reconhecer, travar e notificar',
  'coronavirus',
  6,
  'A Peste Suína Africana (PSA) existe em Moçambique e não tem vacina nem tratamento. Pode matar quase todos os porcos de uma granja em poucos dias. A única protecção é impedir que o vírus entre.',
  '[["Vacina","não existe"],["Mortalidade","até 100%"],["Incubação","4–19 dias"],["Notificação","obrigatória"]]'::jsonb,
  '[{"h":"Como o vírus entra na granja","p":["O vírus resiste muitos meses na carne congelada ou curada e várias semanas no ambiente. Cozinhar mata o vírus, mas o risco de erro é grande: o mais seguro é nunca dar restos de comida."],"list":["Restos de comida com carne ou enchidos de porco (lavagem)","Porcos comprados ou emprestados de zonas com doença","Pessoas, botas, roupa e veículos que estiveram noutras pocilgas","Porcos soltos, javalis e carraças moles (Ornithodoros)","Carne e sangue de animais doentes abatidos na granja"],"img":{"src":"https://upload.wikimedia.org/wikipedia/commons/f/f0/Feeding_pigs_in_Nagaland.jpg","caption":"Porcos soltos ou em contacto com outros animais correm mais risco","credit":"ILRI · CC BY 2.0 · Wikimedia Commons","source":"https://commons.wikimedia.org/wiki/File:Feeding_pigs_in_Nagaland.jpg"}},{"h":"Sinais de alarme","list":["Febre alta (41–42 °C), porcos deitados e amontoados","Manchas vermelhas ou roxas nas orelhas, barriga e patas","Não comem, vomitam, diarreia por vezes com sangue","Abortos em porcas gestantes","Várias mortes súbitas em poucos dias, em todas as idades"],"tip":"Nem todos os sinais aparecem ao mesmo tempo. Mortes súbitas em vários animais são motivo suficiente para chamar o veterinário."},{"h":"O que fazer se suspeitar","steps":[["Não mova animais","Não venda, não abata, não empreste nem transfira porcos para fora da granja."],["Chame os serviços veterinários","Avise o veterinário e os Serviços Distritais de Actividades Económicas (SDAE). A notificação é obrigatória."],["Feche a granja","Ninguém entra nem sai dos currais sem trocar de botas e roupa. Nada de visitas."],["Não coma nem venda a carne","Não passa para pessoas, mas espalha o vírus a outras granjas."],["Registe","Registe cada animal doente em Novo → Doença e cada morte em Novo → Morte. O histórico ajuda os serviços veterinários."]]},{"h":"Prevenir todos os dias","list":["Cerca à volta dos currais e porcos sempre presos","Pedilúvio e botas só da granja à entrada","Nunca dar restos de cozinha, de restaurantes ou de mercados","Comprar animais só de origem conhecida e fazer quarentena de 3 a 4 semanas","Não visitar outras pocilgas; quem as visita troca de roupa antes de entrar","Enterrar ou queimar os animais mortos, longe dos currais"]}]'::jsonb,
  '{"title":"Surto na vizinhança · Boane","intro":"O que a Granja Boane fez quando houve PSA numa aldeia a 5 km.","steps":[["Dia 1","O SDAE avisa os criadores da zona. Américo suspende visitas e compras de animais."],["Dia 1","Pedilúvio novo à entrada, botas e fato só da granja para João e Marta."],["Dia 2","Restos da cantina deixam de ir para os porcos. Ração só de saco fechado."],["Semanas 1–6","Temperatura medida nos animais com sinais. Nenhum caso na granja."]]}'::jsonb,
  '["Duas ou mais mortes súbitas em poucos dias","Febre alta com manchas roxas nas orelhas ou na barriga","Abortos em várias porcas ao mesmo tempo","Surto de PSA confirmado na sua zona"]'::jsonb,
  'Registar doença',
  'illness',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/Flickr_-_ggallice_-_Foraging_pig.jpg/1280px-Flickr_-_ggallice_-_Foraging_pig.jpg',
  'Porco solto à procura de comida',
  'Geoff Gallice · CC BY 2.0 · Wikimedia Commons',
  'https://commons.wikimedia.org/wiki/File:Flickr_-_ggallice_-_Foraging_pig.jpg',
  60
),
(
  'calor',
  'guide',
  'Maneio',
  'Calor',
  'Proteger os porcos nos dias quentes',
  'thermostat',
  5,
  'Os porcos quase não suam. Acima de 27 °C começam a comer menos, crescem mais devagar e as porcas e varrascos perdem fertilidade. Em Moçambique, o calor é um dos maiores ladrões de produção.',
  '[["Conforto engorda","15–24 °C"],["Stress","acima de 27 °C"],["Água","pode duplicar"],["Ração","até −20%"]]'::jsonb,
  '[{"h":"Sinais de calor a mais","list":["Respiração rápida pela boca, sobretudo em porcas e varrascos","Animais deitados de lado, afastados uns dos outros","Procuram lama, água ou o chão molhado e sujam a zona de deitar","Comem menos e bebem muito mais","Mais cios falhados e repetições depois da cobrição"]},{"h":"Arrefecer os animais","steps":[["Sombra","Telhado com isolamento ou capim por cima das chapas; árvores ou sombrite nos parques."],["Água sempre","Confirme os bebedouros duas vezes por dia. No calor, o consumo pode duplicar."],["Molhar","Aspersores ou mangueira em gotas grossas sobre o dorso e o pescoço, a intervalos. Não molhe leitões pequenos nem o ninho."],["Ventilar","Abra as cortinas e paredes. O ar a circular ajuda a secar a pele molhada e a arrefecer."],["Menos animais","Em currais cheios o calor sobe. Respeite a densidade."]],"tip":"Na engorda, uma poça de lama ou água no parque arrefece muito bem os animais — mantenha-a limpa e mude a água com frequência.","img":{"src":"https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/SB045_Pig_farming_Cuba_4.JPG/1280px-SB045_Pig_farming_Cuba_4.JPG","caption":"Sombra de uma árvore: o abrigo mais barato contra o calor","credit":"Susanne Bollinger · CC BY-SA 4.0 · Wikimedia Commons","source":"https://commons.wikimedia.org/wiki/File:SB045_Pig_farming_Cuba_4.JPG"}},{"h":"Alimentação e maneio","list":["Dê a ração cedo de manhã e ao fim da tarde, nas horas frescas","Ração húmida ajuda as porcas em lactação a comerem mais","Cobrições e transferências só de manhã cedo","Transporte para venda de madrugada, sem amontoar","Electrólitos na água em dias de calor extremo"]}]'::jsonb,
  '{"title":"Onda de calor · Novembro","intro":"Engorda A com 15 animais e 36 °C à tarde durante uma semana.","steps":[["Sinal","Consumo de ração cai de 45 para 37 kg/dia; animais ofegantes às 14:00."],["Acção","Capim sobre as chapas, mangueira 3 vezes à tarde, ração às 05:30 e 18:00."],["Resultado","Em 4 dias o consumo volta a 43 kg/dia."]]}'::jsonb,
  '["Porco com respiração muito rápida que não acalma à sombra","Animal caído, a tremer ou com pele muito vermelha","Porca gestante ofegante e sem comer","Morte súbita num dia de muito calor"]'::jsonb,
  null,
  null,
  'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0f/Cooling_Off_-_7583784354.jpg/1280px-Cooling_Off_-_7583784354.jpg',
  'Porcos a refrescar-se na lama',
  'Bob Haarmans · CC BY 2.0 · Wikimedia Commons',
  'https://commons.wikimedia.org/wiki/File:Cooling_Off_-_7583784354.jpg',
  70
),
(
  'racao',
  'article',
  'Alimentação',
  'Quanta ração dar em cada fase',
  '',
  '',
  6,
  'A ração representa 60 a 75% do custo de produção. Dar a quantidade certa em cada fase é a forma mais directa de melhorar o resultado da granja.',
  '[["Creche","0,5–1 kg/dia"],["Recria","1,5–2 kg/dia"],["Engorda","2,5–3 kg/dia"],["Lactação","6–8 kg/dia"]]'::jsonb,
  '[{"h":"Quantidades por fase","p":["Os valores abaixo são uma referência para raças comerciais. Ajuste à condição corporal: se os animais deixam ração, reduza; se acabam tudo em menos de 30 minutos, aumente um pouco."],"list":["Creche (7–25 kg): 0,5 a 1 kg de ração inicial por dia","Recria (25–60 kg): 1,5 a 2 kg de ração de crescimento","Engorda (60–110 kg): 2,5 a 3 kg de ração de acabamento","Porca gestante: 2 a 2,5 kg; mais 0,5 a 1 kg no último mês","Porca em lactação: 2 kg + 0,5 kg por cada leitão, em geral 6 a 8 kg; à vontade se possível","Varrasco: 2,5 a 3 kg"]},{"h":"Como dar a ração","steps":[["Duas refeições por dia","Sempre à mesma hora. Os animais ficam mais calmos e há menos desperdício."],["Comedouro limpo","Retire a ração velha ou molhada antes de dar a nova."],["Mudanças graduais","Ao mudar de ração, misture as duas durante 3 a 5 dias."]],"img":{"src":"https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/A_man_feeding_his_pigs.jpg/1280px-A_man_feeding_his_pigs.jpg","caption":"Ração a horas certas, em comedouro limpo","credit":"Emmanuel Ssekaggo · CC BY-SA 4.0 · Wikimedia Commons","source":"https://commons.wikimedia.org/wiki/File:A_man_feeding_his_pigs.jpg"}},{"h":"Sinais de que algo não está bem","list":["Ração que sobra no comedouro de uma refeição para a outra","Animais do mesmo lote com tamanhos muito diferentes","Porcas a perder muito peso na lactação","Ração com cheiro a mofo, húmida ou com grumos — não a dê"],"tip":"Registe cada compra de ração em Novo → Compra: o stock é actualizado e recebe um alerta quando estiver a acabar."}]'::jsonb,
  '{"title":"Recria da Granja Boane","intro":"14 animais com cerca de 40 kg.","steps":[["Necessidade","14 × 1,8 kg = 25 kg por dia"],["Em sacos","1 saco de 25 kg por dia, dividido em 2 refeições"],["Stock actual","22 sacos → cerca de 3 semanas"]]}'::jsonb,
  '[]'::jsonb,
  'Registar compra de ração',
  'purchase',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Yiga_feeding_his_pigs.jpg/1280px-Yiga_feeding_his_pigs.jpg',
  'Criador a dar de comer aos porcos',
  'Emmanuel Ssekaggo · CC BY-SA 4.0 · Wikimedia Commons',
  'https://commons.wikimedia.org/wiki/File:Yiga_feeding_his_pigs.jpg',
  10
),
(
  'agua',
  'article',
  'Alimentação',
  'Água: quanto precisa um porco por dia',
  '',
  '',
  3,
  'Um porco bebe 2 a 3 litros de água por cada quilo de ração. Pouca água reduz logo o consumo de ração e o crescimento.',
  '[["Leitão","1–2 L/dia"],["Engorda","5–10 L/dia"],["Lactação","25–40 L/dia"]]'::jsonb,
  '[{"h":"Necessidades por fase","list":["Leitão em creche: 1 a 2 litros","Recria: 3 a 5 litros","Engorda: 5 a 10 litros","Porca gestante: 12 a 20 litros","Porca em lactação: 25 a 40 litros"]},{"h":"Verificar os bebedouros","steps":[["Todos os dias","Pressione cada chupeta: deve sair um jacto forte e contínuo."],["Caudal","Encha um copo durante 1 minuto. Creche: cerca de 0,5 L/min; engorda: cerca de 1 L/min; porcas em lactação: cerca de 2 L/min."],["Limpeza","Lave os bebedouros de taça uma vez por semana."],["Quantidade","Um bebedouro por cada 10 a 12 animais, à altura do ombro do animal mais pequeno."]],"tip":"Em dias de calor, o consumo de água pode duplicar. Confirme que a reserva chega.","img":{"src":"https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Pig_getting_a_drink.jpg/1280px-Pig_getting_a_drink.jpg","caption":"Chupeta à altura do ombro: o porco deve beber sem esforço","credit":"L T Hunter · CC BY 2.0 · Wikimedia Commons","source":"https://commons.wikimedia.org/wiki/File:Pig_getting_a_drink.jpg"}}]'::jsonb,
  null,
  '[]'::jsonb,
  null,
  null,
  'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/A_pig_consuming_water.jpg/1280px-A_pig_consuming_water.jpg',
  'Porco a beber de uma chupeta',
  'USDAgov · Public domain · Wikimedia Commons',
  'https://commons.wikimedia.org/wiki/File:A_pig_consuming_water.jpg',
  20
),
(
  'armazenar',
  'article',
  'Alimentação',
  'Guardar a ração sem perdas',
  '',
  '',
  3,
  'Ração mal guardada ganha bolor, atrai ratos e pode conter aflatoxinas que causam abortos e fígado doente.',
  '[["Rotação","primeiro a entrar, primeiro a sair"],["Validade","alerta a 30 dias"],["Humidade","longe do chão"]]'::jsonb,
  '[{"h":"O armazém","list":["Sacos sobre estrados de madeira, a 15 cm do chão e afastados das paredes","Telhado sem goteiras e local fresco e arejado","Portas fechadas contra ratos, aves e cães","Um saco aberto de cada vez, bem fechado depois de usar"]},{"h":"Sinais de ração estragada","list":["Cheiro a mofo ou a ranço","Grumos, manchas verdes, pretas ou cinzentas","Porcos que recusam a ração ou vomitam"],"tip":"Milho com bolor pode ter aflatoxinas mesmo depois de seco. Na dúvida, não o dê às porcas."},{"h":"No Suino Gestor","steps":[["Registe as compras","Novo → Compra: Artigo, Quantidade, Preço total, Fornecedor e Conta."],["Alertas","Em Hoje → Alertas aparecem os artigos abaixo do mínimo (com o botão Encomendar) e os que expiram nos próximos 30 dias."]]}]'::jsonb,
  null,
  '[]'::jsonb,
  'Registar compra',
  'purchase',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/RECLINING_ON_FEED_SACKS_-_NARA_-_544365.jpg/1280px-RECLINING_ON_FEED_SACKS_-_NARA_-_544365.jpg',
  'Sacos de ração empilhados num armazém',
  'Terry Eiler / NARA · Public domain · Wikimedia Commons',
  'https://commons.wikimedia.org/wiki/File:RECLINING_ON_FEED_SACKS_-_NARA_-_544365.jpg',
  30
),
(
  'vacinas',
  'article',
  'Saúde',
  'Calendário de vacinação recomendado',
  '',
  '',
  5,
  'Vacinar no momento certo protege a porca, passa defesas aos leitões pelo colostro e evita doenças que podem parar a granja.',
  '[["Porcas","Reforço a cada 6 meses"],["Ferro","3.º dia de vida"],["Mycoplasma","21 dias (ou 7 e 21)"]]'::jsonb,
  '[{"h":"Porcas e leitoas","list":["Parvovirose e Erisipela: 2 doses antes da 1.ª cobrição, com 3–4 semanas de intervalo","Reforço de Parvovirose e Erisipela a cada 6 meses, ou 2 semanas antes de cada cobrição","Desparasitar 2 semanas antes do parto"]},{"h":"Leitões","steps":[["Dia 3","Ferro dextrano 200 mg, injectável no pescoço. O Suino Gestor cria esta tarefa ao registar o parto."],["Dia 7 e/ou 21","Mycoplasma: dose única aos 21 dias, ou duas doses aos 7 e 21 dias, conforme a vacina e o veterinário."],["Entrada na creche","Desparasitação, conforme o plano do veterinário."]],"img":{"src":"https://upload.wikimedia.org/wikipedia/commons/thumb/a/ad/Belarusian_meat_pigs_2.jpg/1280px-Belarusian_meat_pigs_2.jpg","caption":"Leitões na maternidade: ferro ao 3.º dia","credit":"Homoatrox · CC BY-SA 3.0 · Wikimedia Commons","source":"https://commons.wikimedia.org/wiki/File:Belarusian_meat_pigs_2.jpg"}},{"h":"Boas práticas","list":["Guarde as vacinas no frigorífico, entre 2 e 8 °C, nunca no congelador","Use uma agulha limpa por curral, no mínimo, e uma por animal nas porcas","Registe o lote da vacina e a validade","Não há vacina contra a Peste Suína Africana: a protecção é a biossegurança"],"tip":"O Suino Gestor regista a vacina em Novo → Tratamento, mas não agenda a dose seguinte. Crie uma Actividade com a data do reforço."}]'::jsonb,
  null,
  '[]'::jsonb,
  'Registar tratamento',
  'treatment',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fd/Noun_Yav_and_his_wife_from_the_village_of_Damrey_Slab_have_their_pigs_vaccinated_by_Sin_Piseth_from_the_ADRA-AusAID_team._Photo-_Kevin_Evans%2C_AusAID_%2810711178384%29.jpg/1280px-thumbnail.jpg',
  'Vacinação de porcos numa pequena exploração',
  'Kevin Evans / AusAID · CC BY 2.0 · Wikimedia Commons',
  'https://commons.wikimedia.org/wiki/File:Noun_Yav_and_his_wife_from_the_village_of_Damrey_Slab_have_their_pigs_vaccinated_by_Sin_Piseth_from_the_ADRA-AusAID_team._Photo-_Kevin_Evans,_AusAID_(10711178384).jpg',
  40
),
(
  'carencia',
  'article',
  'Saúde',
  'Período de carência: o que é e como respeitar',
  '',
  '',
  3,
  'É o tempo mínimo entre o último tratamento e o abate ou venda, para que não fiquem resíduos de medicamento na carne.',
  '[["Oxitetraciclina LA","28 dias"],["Ivermectina","18–28 dias"],["Ferro e vacinas","0 dias"]]'::jsonb,
  '[{"h":"Porque é importante","p":["Carne com resíduos de antibiótico pode ser rejeitada pelo comprador e é um risco para a saúde de quem a come. Cada produto tem o seu período, indicado no rótulo."]},{"h":"Como o Suino Gestor ajuda","steps":[["Registe o tratamento","Em Novo → Tratamento, escolha o produto: o período de carência é preenchido automaticamente."],["Animal marcado","O estado do animal passa a mostrar “Carência até…” com a data."],["Venda bloqueada","Enquanto durar a carência, o Suino Gestor não deixa registar a venda desse animal."],["Fim da carência","Não há aviso no calendário quando termina: antes de vender, confirme a data no animal."]],"tip":"Na dúvida entre dois valores, use sempre o mais longo."},{"h":"Carência dos produtos no Suino Gestor","list":["Oxitetraciclina LA 20%: 28 dias","Ivermectina 1%: 28 dias (o rótulo pode indicar 18 a 28 — o Suino Gestor usa o valor mais longo)","Ferro, vacinas (Parvo + Erisipela, Mycoplasma), Vitamina B12 e Electrólitos orais: 0 dias"],"tip":"Se usar outro produto, siga o rótulo ou o veterinário. Na dúvida entre dois valores, use sempre o mais longo."}]'::jsonb,
  null,
  '[]'::jsonb,
  null,
  null,
  'https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/Pig_farm_Vampula_6.jpg/1280px-Pig_farm_Vampula_6.jpg',
  'Porcos de engorda prontos para venda',
  'kallerna · CC BY-SA 4.0 · Wikimedia Commons',
  'https://commons.wikimedia.org/wiki/File:Pig_farm_Vampula_6.jpg',
  50
),
(
  'parasitas',
  'article',
  'Saúde',
  'Desparasitação e sarna',
  '',
  '',
  4,
  'Lombrigas e sarna roubam ração sem que se note. Um plano simples de desparasitação paga-se muitas vezes.',
  '[["Porcas","2 semanas antes do parto"],["Leitões","à entrada da creche"],["Ivermectina","carência 28 dias"]]'::jsonb,
  '[{"h":"Sinais","list":["Comichão: os porcos esfregam-se nas paredes e grades","Pele com crostas, sobretudo nas orelhas e no pescoço (sarna)","Crescimento lento e pêlo arrepiado apesar de comerem bem","Tosse em leitões, por vezes causada pela passagem das lombrigas pelos pulmões","Manchas brancas no fígado no talho (“fígado com manchas de leite”)"]},{"h":"Plano de desparasitação","steps":[["Porcas","7 a 14 dias antes do parto, para não passarem parasitas aos leitões."],["Varrascos","De 6 em 6 meses."],["Leitões","À entrada da creche ou da recria, conforme o veterinário."],["Animais comprados","Durante a quarentena, antes de se juntarem aos outros."]],"tip":"A Ivermectina 1% trata lombrigas e sarna. No Suino Gestor tem carência de 28 dias: o animal não pode ser vendido nesse período."},{"h":"Evitar a reinfecção","list":["Lave e desinfecte o curral antes de entrar o lote tratado","Retire as fezes todos os dias","Trate todos os animais do curral ao mesmo tempo"]}]'::jsonb,
  null,
  '[]'::jsonb,
  'Registar tratamento',
  'treatment',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Pig_farm_Vampula_1.jpg/1280px-Pig_farm_Vampula_1.jpg',
  'Porcos num parque de terra',
  'kallerna · CC BY-SA 4.0 · Wikimedia Commons',
  'https://commons.wikimedia.org/wiki/File:Pig_farm_Vampula_1.jpg',
  60
),
(
  'bio',
  'article',
  'Saúde',
  'Biossegurança: regras básicas na entrada da granja',
  '',
  '',
  4,
  'A maioria das doenças entra na granja com pessoas, veículos ou animais novos. Algumas regras simples reduzem muito o risco.',
  '[["Quarentena","3–4 semanas"],["Pedilúvio","trocar 2×/semana"],["Restos de comida","nunca"]]'::jsonb,
  '[{"h":"Pessoas e veículos","list":["Limite as visitas e registe quem entra","Botas próprias da granja ou passagem no pedilúvio","Lavar as mãos à entrada e à saída","Camiões de ração e de venda ficam fora da cerca","Quem tem porcos em casa não entra nos currais"]},{"h":"Animais novos","steps":[["Origem conhecida","Compre só a granjas que conhece, sem doença recente na zona."],["Quarentena","Curral separado, longe dos outros, durante 3 a 4 semanas. Ao registar em Novo → Compra de animais, o estado fica “Quarentena até…” (21 dias) e o fim da quarentena entra no calendário."],["Observar","Febre, tosse ou diarreia: chame o veterinário antes de os juntar."],["Vacinar","Siga o calendário da granja antes de entrarem no efectivo."]],"img":{"src":"https://upload.wikimedia.org/wikipedia/commons/thumb/2/29/Pig_Farm_-_Bnashpukurdanga_%281%29.jpg/1280px-Pig_Farm_-_Bnashpukurdanga_%281%29.jpg","caption":"Curral de quarentena afastado dos restantes animais","credit":"Sumitsurai · CC BY-SA 4.0 · Wikimedia Commons","source":"https://commons.wikimedia.org/wiki/File:Pig_Farm_-_Bnashpukurdanga_(1).jpg"}},{"h":"Comida, ratos e cadáveres","list":["Nunca dê restos de cozinha ou de restaurantes com carne de porco: é a principal via de entrada da Peste Suína Africana","Guarde a ração em local fechado, longe de ratos e aves","Enterre ou queime os animais mortos no próprio dia, longe dos currais","Mantenha cães e porcos de vizinhos fora da cerca"]}]'::jsonb,
  null,
  '[]'::jsonb,
  null,
  null,
  'https://upload.wikimedia.org/wikipedia/commons/thumb/f/ff/Pig_Farm_-_Bnashpukurdanga_%282%29.jpg/1280px-Pig_Farm_-_Bnashpukurdanga_%282%29.jpg',
  'Currais de uma pequena granja',
  'Sumitsurai · CC BY-SA 4.0 · Wikimedia Commons',
  'https://commons.wikimedia.org/wiki/File:Pig_Farm_-_Bnashpukurdanga_(2).jpg',
  70
),
(
  'parto',
  'article',
  'Reprodução',
  'Calcular a data do parto',
  '',
  '',
  2,
  'A gestação dura em média 114 dias — a regra dos “3 meses, 3 semanas e 3 dias”.',
  '[["Gestação","114 dias"],["Variação","112–116 dias"]]'::jsonb,
  '[{"h":"Como calcular","p":["Some 114 dias à data da 1.ª cobrição. Se a porca foi coberta a 3 de Julho, o parto previsto é a 25 de Outubro."],"tip":"O Suino Gestor faz este cálculo ao registar a cobertura e cria a tarefa de transferir a porca para a maternidade uma semana antes."}]'::jsonb,
  '{"title":"S-014 coberta a 3 de Julho","intro":"O que o Suino Gestor agenda depois de registar a cobertura.","steps":[["Verificar repetição de cio","24 Jul (+21 dias)"],["Transferir para a maternidade","18 Out (−7 dias)"],["Parto previsto","25 Out (+114 dias)"]]}'::jsonb,
  '[]'::jsonb,
  'Registar cobrição',
  'mating',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9b/Truie-large-white.JPG/1280px-Truie-large-white.JPG',
  'Porca Large White deitada na palha',
  'Grimlock · CC BY-SA 3.0 · Wikimedia Commons',
  'https://commons.wikimedia.org/wiki/File:Truie-large-white.JPG',
  80
),
(
  'leitoes',
  'article',
  'Reprodução',
  'Cuidados com os leitões na primeira semana',
  '',
  '',
  5,
  'A primeira semana decide a ninhada. Calor, colostro e ferro são as três coisas que não podem falhar.',
  '[["Ninho","30–34 °C"],["Colostro","primeiras 6 h"],["Ferro","3.º dia"]]'::jsonb,
  '[{"h":"Calor e colostro","list":["Ninho seco e quente: 30 a 34 °C na primeira semana, depois 28 °C","Lâmpada à altura certa: leitões espalhados por baixo = bem; amontoados = frio; afastados = calor a mais","Todos mamam nas primeiras 6 horas; os mais pequenos nas tetas da frente","Ninhadas grandes: passe leitões para outra porca que tenha parido no mesmo dia ou no dia anterior"],"img":{"src":"https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/%22Ohl_Little_Dancer%22_%28a_Registered_Red_Wattle_Hog%29_and_her_13_piglets..JPG/1280px-%22Ohl_Little_Dancer%22_%28a_Registered_Red_Wattle_Hog%29_and_her_13_piglets..JPG","caption":"Uma ninhada grande a mamar: todos precisam de colostro nas primeiras horas","credit":"Mike Ohlhausen · CC BY-SA 3.0 · Wikimedia Commons","source":"https://commons.wikimedia.org/wiki/File:%22Ohl_Little_Dancer%22_(a_Registered_Red_Wattle_Hog)_and_her_13_piglets..JPG"}},{"h":"Calendário da primeira semana","steps":[["Dia 1","Secar, umbigo com iodo, colostro, registo da ninhada no Suino Gestor."],["Dia 2–3","Injecção de ferro (tarefa criada pelo Suino Gestor). Corte dos dentes só se ferirem a porca."],["Dia 3–7","Castração dos machos, se praticar, com higiene e sem infecções."],["Dia 7","Começar a oferecer um pouco de ração inicial."]]},{"h":"Evitar esmagamentos","list":["Grades ou barras de protecção junto às paredes","Ninho aquecido longe da porca, para os leitões não dormirem encostados a ela","Porca calma e sem dor: vigie a temperatura e o úbere"],"tip":"Registe cada leitão morto em Novo → Morte, com a causa. Ao fim de alguns meses, verá onde estão as perdas."}]'::jsonb,
  null,
  '[]'::jsonb,
  'Registar parto',
  'birth',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Ferkel_Pi%C3%A9train_beim_Saugen.JPG/1280px-Ferkel_Pi%C3%A9train_beim_Saugen.JPG',
  'Leitões a mamar',
  '4028mdk09 · CC BY-SA 3.0 · Wikimedia Commons',
  'https://commons.wikimedia.org/wiki/File:Ferkel_Pi%C3%A9train_beim_Saugen.JPG',
  90
),
(
  'desmame',
  'article',
  'Reprodução',
  'Desmame aos 21–28 dias',
  '',
  '',
  4,
  'Desmamar entre os 21 e 28 dias equilibra a saúde dos leitões e o regresso rápido da porca ao cio.',
  '[["Idade","21–28 dias"],["Peso mínimo","6 kg"],["Cio da porca","4–7 dias depois"]]'::jsonb,
  '[{"h":"Passo a passo","steps":[["Retire a porca","Leve a porca, não os leitões. Ficam no mesmo curral 1 a 2 dias para reduzir o stress."],["Ração inicial","Ofereça ração inicial desde os 10 dias para se habituarem."],["Transfira para a creche","Agrupe por tamanho, não por ninhada."],["Teste de cio","Comece a testar a porca com o varrasco 3 dias depois. A maioria entra em cio entre 4 e 7 dias após o desmame."]]},{"h":"Cuidados com a porca","list":["No dia do desmame, dê pouca ração para secar o leite mais depressa","Do dia seguinte até à cobrição, dê 3 a 4 kg por dia para estimular o cio","Água sempre à vontade","Vigie o úbere: tetas quentes e duras podem ser mamite"],"tip":"A idade de desmame usada pelo Suino Gestor (21 dias) pode ser alterada em Definições → Parâmetros."}]'::jsonb,
  null,
  '[]'::jsonb,
  null,
  null,
  'https://upload.wikimedia.org/wikipedia/commons/thumb/d/df/Piglets_in_a_Shelter_at_a_Farm.jpg/1280px-Piglets_in_a_Shelter_at_a_Farm.jpg',
  'Leitões desmamados num curral de cimento',
  'Andikan Efiok Eduok · CC BY-SA 4.0 · Wikimedia Commons',
  'https://commons.wikimedia.org/wiki/File:Piglets_in_a_Shelter_at_a_Farm.jpg',
  100
),
(
  'leitoas',
  'article',
  'Reprodução',
  'Leitoas de reposição: escolher e preparar',
  '',
  '',
  4,
  'As leitoas de hoje são as porcas dos próximos anos. Escolher bem e cobrir na altura certa dá mais leitões ao longo da vida da porca.',
  '[["1.ª cobrição","7–8 meses"],["Peso","130–140 kg"],["Cio","2.º ou 3.º"]]'::jsonb,
  '[{"h":"Como escolher","list":["Pelo menos 12 tetas bem formadas e espaçadas, 6 de cada lado","Patas fortes e direitas, sem coxeira","Filhas de porcas com ninhadas grandes e boas mães","Crescimento bom em relação ao lote","Vulva de tamanho normal, sem defeitos"]},{"h":"Preparar para a cobrição","steps":[["Contacto com o varrasco","A partir dos 5–6 meses, 10–15 minutos por dia junto ao varrasco ajudam a aparecer o 1.º cio."],["Vacinar","Parvovirose e Erisipela: 2 doses antes da 1.ª cobrição, com 3–4 semanas de intervalo."],["Registar os cios","Anote a data de cada cio para prever o seguinte (21 dias)."],["Cobrir no 2.º ou 3.º cio","Com 7 a 8 meses e 130 a 140 kg. Cobrir mais cedo dá ninhadas pequenas e porcas que duram menos."]],"tip":"Leitoas têm cios mais curtos: cubra logo que detectar o cio e repita 12 horas depois."}]'::jsonb,
  null,
  '[]'::jsonb,
  'Registar cobrição',
  'mating',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bf/Pig_farm_Vampula_9.jpg/1280px-Pig_farm_Vampula_9.jpg',
  'Leitoas de reposição',
  'kallerna · CC BY-SA 4.0 · Wikimedia Commons',
  'https://commons.wikimedia.org/wiki/File:Pig_farm_Vampula_9.jpg',
  110
),
(
  'condicao',
  'article',
  'Reprodução',
  'Condição corporal das porcas',
  '',
  '',
  4,
  'Porcas demasiado magras ou gordas têm menos leitões, partos difíceis e cios atrasados. Avaliar a condição corporal leva um minuto.',
  '[["Escala","1 a 5"],["Ideal ao parto","3 a 3,5"],["Ideal ao desmame","2,5 a 3"]]'::jsonb,
  '[{"h":"Avaliar com a mão","p":["Pressione com a palma da mão a espinha, as ancas e as costelas."],"list":["1 · Muito magra: ossos visíveis à distância","2 · Magra: ossos sentem-se facilmente sem pressão","3 · Ideal: ossos sentem-se só com pressão firme","4 · Gorda: não se sentem os ossos","5 · Muito gorda: camadas de gordura visíveis"]},{"h":"Corrigir pela ração","list":["Magra na gestação: aumente 0,5 kg por dia até recuperar","Gorda na gestação: reduza 0,5 kg, sem descer de 2 kg por dia","Na lactação, dê o máximo que comer: não tente emagrecer uma porca a amamentar","Avalie à cobrição, a meio da gestação, ao entrar na maternidade e ao desmame"],"tip":"Escreva a condição nas Notas do animal. Se possível, pese as porcas ao desmame: Novo → Peso."}]'::jsonb,
  null,
  '[]'::jsonb,
  'Registar peso',
  'weight',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/6/61/Pregnant_sow_near_Whitecross_-_geograph.org.uk_-_7448184.jpg/1280px-Pregnant_sow_near_Whitecross_-_geograph.org.uk_-_7448184.jpg',
  'Porca gestante',
  'Barbara Richardson · CC BY-SA 2.0 · Wikimedia Commons',
  'https://commons.wikimedia.org/wiki/File:Pregnant_sow_near_Whitecross_-_geograph.org.uk_-_7448184.jpg',
  120
),
(
  'densidade',
  'article',
  'Maneio',
  'Densidade: quantos animais por curral',
  '',
  '',
  3,
  'Currais cheios demais aumentam brigas, doenças e perdas de peso.',
  '[["Creche","0,3 m²/leitão"],["Recria","0,6 m²/animal"],["Engorda","0,9 m²/animal"]]'::jsonb,
  '[{"h":"Calcular a capacidade","p":["Divida a área útil do curral pelo espaço por animal. Um curral de engorda com 4 × 3,5 m (14 m²) leva até 15 animais."],"tip":"O Suino Gestor mostra a ocupação de cada curral: a barra fica amarela a partir de 90% e não deixa transferir animais para um curral cheio."},{"h":"Comedouro e bebedouro","list":["Comedouro: 30 a 35 cm por animal de engorda, se todos comem ao mesmo tempo","Bebedouro: 1 por cada 10 a 12 animais","Zona seca para deitar e zona de sujidade bem separadas"]}]'::jsonb,
  null,
  '[]'::jsonb,
  null,
  null,
  'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Pig_Farm_-_Bnashpukurdanga_%283%29.jpg/1280px-Pig_Farm_-_Bnashpukurdanga_%283%29.jpg',
  'Porcos em currais de uma pequena granja',
  'Sumitsurai · CC BY-SA 4.0 · Wikimedia Commons',
  'https://commons.wikimedia.org/wiki/File:Pig_Farm_-_Bnashpukurdanga_(3).jpg',
  130
),
(
  'limpeza',
  'article',
  'Maneio',
  'Limpeza e desinfecção entre lotes',
  '',
  '',
  4,
  'O vazio sanitário entre lotes corta o ciclo das doenças de um grupo para o seguinte.',
  '[["Vazio sanitário","mínimo 3 dias"],["Ideal","5–7 dias"]]'::jsonb,
  '[{"h":"Passo a passo","steps":[["Retire tudo","Cama, fezes e restos de ração."],["Lave","Água com detergente, de cima para baixo."],["Desinfecte","Aplique o desinfectante na dose do rótulo, sobre a superfície já limpa."],["Deixe secar","Curral vazio e seco pelo menos 3 dias."]],"tip":"Tudo dentro, tudo fora: esvazie o curral inteiro de uma vez. Juntar animais novos a um curral que nunca fica vazio mantém as doenças a circular."}]'::jsonb,
  null,
  '[]'::jsonb,
  'Agendar limpeza',
  'activity',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/3/32/A_pig_in_the_drinkers.jpg/1280px-A_pig_in_the_drinkers.jpg',
  'Curral de cimento limpo, com bebedouro',
  'Beatrice Kaseke · CC BY-SA 4.0 · Wikimedia Commons',
  'https://commons.wikimedia.org/wiki/File:A_pig_in_the_drinkers.jpg',
  140
),
(
  'pesar',
  'article',
  'Maneio',
  'Pesar sem balança: a fita métrica',
  '',
  '',
  3,
  'Sem balança, uma fita métrica de costura dá uma estimativa razoável do peso de porcos de recria e engorda.',
  '[["Fórmula","P² × C ÷ 14 400"],["Erro","cerca de 5–10%"],["Melhor","30–120 kg"]]'::jsonb,
  '[{"h":"Como medir","steps":[["Perímetro torácico (P)","Com o porco de pé e a cabeça direita, passe a fita à volta do peito, logo atrás das patas da frente. Em cm."],["Comprimento (C)","Do meio das orelhas até à base da cauda, ao longo da espinha. Em cm."],["Calcule","Peso (kg) ≈ P × P × C ÷ 14 400."],["Registe","No Suino Gestor: Novo → Peso. O gráfico de crescimento do animal é actualizado."]],"tip":"Meça sempre da mesma forma e à mesma hora, antes de comer. O mais importante é a evolução, não o valor exacto."}]'::jsonb,
  '{"title":"G-101 · Recria","intro":"Medição de um porco de recria.","steps":[["Perímetro","95 cm"],["Comprimento","90 cm"],["Cálculo","95 × 95 × 90 ÷ 14 400 ≈ 56 kg"]]}'::jsonb,
  '[]'::jsonb,
  'Registar peso',
  'weight',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bd/Pig_Scales.JPG/1280px-Pig_Scales.JPG',
  'Balança de gancho para pesar porcos',
  'Nick Birse · CC BY-SA 4.0 · Wikimedia Commons',
  'https://commons.wikimedia.org/wiki/File:Pig_Scales.JPG',
  150
),
(
  'ninhada',
  'article',
  'Usar o Suino Gestor',
  'Registar uma ninhada',
  '',
  '',
  2,
  'Registar a ninhada no próprio dia cria os leitões e agenda os cuidados dos primeiros dias.',
  '[]'::jsonb,
  '[{"h":"Passo a passo","steps":[["Toque em Novo","No telemóvel é o botão redondo “+”; no computador, o botão “Novo”. Escolha Parto."],["Escolha a porca","Indique nascidos vivos, nados-mortos, a data e quem assistiu."],["Guarde","Os leitões são criados no curral da porca, com códigos como L14-01, L14-02… e a tarefa “Injecção de ferro” é agendada para o 3.º dia."]],"tip":"Registe no próprio dia. Leitões que morram depois registam-se um a um em Novo → Morte, com a causa (por exemplo, esmagamento)."}]'::jsonb,
  null,
  '[]'::jsonb,
  'Registar parto',
  'birth',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cc/Belarusian_meat_pigs_1.jpg/1280px-Belarusian_meat_pigs_1.jpg',
  'Leitões na maternidade',
  'Homoatrox · CC BY-SA 3.0 · Wikimedia Commons',
  'https://commons.wikimedia.org/wiki/File:Belarusian_meat_pigs_1.jpg',
  160
),
(
  'venda',
  'article',
  'Usar o Suino Gestor',
  'Registar uma venda',
  '',
  '',
  2,
  'A venda retira o animal do efectivo, cria a receita na conta escolhida e entra nos resultados do lote.',
  '[]'::jsonb,
  '[{"h":"Passo a passo","steps":[["Toque em Novo","Escolha Venda. Só o proprietário pode registar vendas."],["Preencha","Animal, Peso vivo, Preço/kg (por omissão 70 MT, alterável em Definições → Parâmetros), Comprador, Conta e Lote."],["Guarde","O valor é calculado (peso × preço) e lançado como receita."]],"tip":"Animais em carência não podem ser vendidos: o Suino Gestor bloqueia a venda até à data indicada no animal."}]'::jsonb,
  null,
  '[]'::jsonb,
  'Registar venda',
  'sale',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Criadero_de_cerdos_del_Instituto_L%C3%ADnea_Cuchilla_%28Ruiz_de_Montoya%29.jpg/1280px-Criadero_de_cerdos_del_Instituto_L%C3%ADnea_Cuchilla_%28Ruiz_de_Montoya%29.jpg',
  'Porcos de engorda no parque',
  'Horacio Cambeiro · CC BY-SA 4.0 · Wikimedia Commons',
  'https://commons.wikimedia.org/wiki/File:Criadero_de_cerdos_del_Instituto_L%C3%ADnea_Cuchilla_(Ruiz_de_Montoya).jpg',
  170
),
(
  'despesas',
  'article',
  'Usar o Suino Gestor',
  'Despesas e compras',
  '',
  '',
  2,
  'Registar cada gasto mostra quanto custa realmente cada lote e quanto resta em cada conta.',
  '[]'::jsonb,
  '[{"h":"Qual escolher","list":["Despesa: gastos sem stock — salários, electricidade, transporte, veterinário","Compra: ração, medicamentos e outros artigos que entram no stock","Compra de animais: leitões ou reprodutores que entram no efectivo, com quarentena automática"]},{"h":"Passo a passo","steps":[["Toque em Novo","Escolha Despesa (abre “Novo movimento”) ou Compra."],["Preencha","Na Compra: Artigo, Quantidade, Preço total, Fornecedor e Conta. O stock é actualizado."],["Anexe o recibo","Abra o movimento em Finanças e anexe a foto da factura."]],"tip":"Despesas que se repetem (salários, renda) podem ser criadas como recorrentes em Finanças."}]'::jsonb,
  null,
  '[]'::jsonb,
  'Registar despesa',
  'expense',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/8061Men_unloading_bags_of_animal_feeds_from_delivery_trucks_16.jpg/1280px-8061Men_unloading_bags_of_animal_feeds_from_delivery_trucks_16.jpg',
  'Descarga de sacos de ração',
  'JFVelasquez Floro · CC0 · Wikimedia Commons',
  'https://commons.wikimedia.org/wiki/File:8061Men_unloading_bags_of_animal_feeds_from_delivery_trucks_16.jpg',
  180
),
(
  'equipa',
  'article',
  'Usar o Suino Gestor',
  'Convidar a equipa e definir permissões',
  '',
  '',
  2,
  'Cada pessoa entra com a sua conta Google e vê só o que o seu papel permite.',
  '[]'::jsonb,
  '[{"h":"Convidar","steps":[["Abra Definições","Toque no seu avatar → Definições → cartão Equipa."],["Toque em Convidar","Escreva o nome, o email Google da pessoa e escolha a função."],["Avise a pessoa","O Suino Gestor não envia email: diga-lhe para entrar com Google usando esse mesmo email. O acesso à granja aparece logo."]]},{"h":"Papéis","list":["Proprietário: acesso total, incluindo vendas, finanças e equipa","Tratador: animais, tarefas e registos do dia-a-dia","Veterinário: animais, saúde e registos; não compra animais","Investidor: só leitura de Finanças e Relatórios"],"tip":"Só o proprietário convida e muda funções. A granja tem sempre pelo menos um proprietário."}]'::jsonb,
  null,
  '[]'::jsonb,
  'Abrir Definições',
  'settings',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2b/Kato_feeding_his_white_pigs.jpg/1280px-Kato_feeding_his_white_pigs.jpg',
  'Tratador a alimentar uma porca',
  'Emmanuel Ssekaggo · CC BY-SA 4.0 · Wikimedia Commons',
  'https://commons.wikimedia.org/wiki/File:Kato_feeding_his_white_pigs.jpg',
  190
),
(
  'investidores',
  'article',
  'Usar o Suino Gestor',
  'Partilhar relatórios com investidores',
  '',
  '',
  2,
  'O investidor recebe um resumo claro do que aportou, do que foi gasto e do saldo disponível.',
  '[]'::jsonb,
  '[{"h":"Enviar um relatório","steps":[["Abra Relatórios","Escolha o período (Este mês, Últimos 3 meses, Este ano ou um intervalo) e a conta."],["Exporte","Exportar → PDF abre a impressão: escolha “Guardar como PDF”. Exportar → Excel descarrega um ficheiro CSV."],["Partilhe","Envie o ficheiro por email ou WhatsApp."]]},{"h":"Ou dê acesso directo","p":["Convide o investidor com a função Investidor: vê Finanças e Relatórios sempre actualizados, sem poder alterar nada."]}]'::jsonb,
  null,
  '[]'::jsonb,
  'Abrir Relatórios',
  'reports',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bd/Small_Pig_Farm_on_China.JPG/1280px-Small_Pig_Farm_on_China.JPG',
  'Pavilhão de uma pequena granja de porcos',
  'Dingar · Public domain · Wikimedia Commons',
  'https://commons.wikimedia.org/wiki/File:Small_Pig_Farm_on_China.JPG',
  200
),
(
  'offline',
  'article',
  'Usar o Suino Gestor',
  'Usar o Suino Gestor sem internet',
  '',
  '',
  2,
  'Sem rede, o Suino Gestor mostra os dados guardados no telemóvel nos últimos 7 dias, incluindo estes guias.',
  '[["Dados guardados","até 7 dias"],["Registos sem rede","não"]]'::jsonb,
  '[{"h":"O que funciona sem rede","list":["Consultar animais, currais, tarefas, calendário e finanças já abertos","Ler e pesquisar os guias e artigos da Ajuda","Aparece o aviso “Sem ligação — a mostrar dados guardados”"]},{"h":"O que não funciona","list":["Guardar registos novos: o Suino Gestor mostra um erro e não guarda","Ver fotos dos animais que nunca abriu com rede"],"tip":"Sem rede, anote os registos num caderno e passe-os para o Suino Gestor quando voltar a ter ligação, com a data correcta."}]'::jsonb,
  null,
  '[]'::jsonb,
  null,
  null,
  'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Pig_husbandry.jpg/1280px-Pig_husbandry.jpg',
  'Porco num curral de uma pequena granja',
  'Adesolive · CC BY-SA 4.0 · Wikimedia Commons',
  'https://commons.wikimedia.org/wiki/File:Pig_husbandry.jpg',
  210
);
