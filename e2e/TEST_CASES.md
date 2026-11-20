# Suino Gestor — E2E Test Cases

Priority: **P1** = critical path, **P2** = important, **P3** = nice to have.
Roles: **Owner**, **Caretaker** (tratador), **Investor**, **New user** (no farm yet).
Test data: the isolated demo farm created at bootstrap (same seed as `seed_demo`: 64 animals in 8 pens, accounts *Vendas*, *Investidor A/B*, *Caixa pequena*).

`@future` cases describe expected behaviour that is probably **not implemented yet**. Failures there are expected and feed the backlog.

## Authentication — `features/auth.feature`

| ID | P | Title | Steps | Expected result |
| --- | --- | --- | --- | --- |
| AUTH-01 | P1 | Login screen renders | Open app signed out | "Bem-vindo ao Suino Gestor" and a "Continuar com Google" button are shown |
| AUTH-02 | P1 | Sign in with a dev account | Click "Continuar com Google" → pick *Carlos Nhantumbo* in the dev picker | App opens on `/herd` with the main navigation |
| AUTH-03 | P1 | Sign out | Signed in as Owner → user menu → "Terminar sessão" | Login screen with "Sessão terminada com sucesso." |
| AUTH-04 | P2 | Deep link while signed out | Open `/expenses` signed out | Login screen is shown, finance data is not |

## Onboarding — `features/onboarding.feature`

| ID | P | Title | Steps | Expected result |
| --- | --- | --- | --- | --- |
| ONB-01 | P1 | New user is asked to create a farm | Sign in as New user | "Crie a sua granja para começar" and the user's email are shown |
| ONB-02 | P1 | Create a farm with demo data | Enter farm name → "Criar com dados de exemplo" | Herd page shows 64 animals in the new farm |

## Navigation & access control — `features/navigation.feature`

| ID | P | Title | Steps | Expected result |
| --- | --- | --- | --- | --- |
| NAV-01 | P1 | Owner sees the full navigation | Sign in as Owner | Nav shows Animais, Stock, Despesas, Relatórios, Ajuda |
| NAV-02 | P1 | Caretaker sees only field navigation | Sign in as Caretaker | Nav shows Animais, Stock, Ajuda; no Despesas or Relatórios |
| NAV-03 | P1 | Caretaker cannot open finance pages by URL | Caretaker opens `/expenses`, then `/reports` | "Sem acesso às despesas" / "Sem acesso" |
| NAV-04 | P2 | Unknown route | Open `/does-not-exist` | "Página não encontrada" |
| NAV-05 | P2 | Switch farm | Owner → user menu → second farm | Toast "Mudou para …"; header shows the second farm |
| NAV-06 | P2 | `@future` Today dashboard is the home page | Open `/` | Stays on `/` and shows the "Hoje" dashboard with tasks (README: Today at `/`; NotFound links to "Voltar a Hoje") |

## Herd — `features/herd.feature`

| ID | P | Title | Steps | Expected result |
| --- | --- | --- | --- | --- |
| HERD-01 | P1 | Herd KPIs | Open `/herd` | "Animais" KPI equals the live animals in the farm (DB oracle); "8 currais" |
| HERD-02 | P1 | Search by ear tag | Search "S-009" | List "Resultados para “S-009”" with 1 animal, S-009 |
| HERD-03 | P2 | Search without matches | Search "ZZZ-999" | "0 animais" |
| HERD-04 | P2 | Breeders KPI filter | Click "Reprodutoras" KPI | URL has `stage=breeders`; list count equals the KPI value |
| HERD-05 | P1 | Open a pen | Click pen "Maternidade A" | Pen page with heading, "Ocupação" KPI and "Animais no curral" |
| HERD-06 | P1 | Open an animal | Open `/herd/animals/S-009` | Heading S-009, "Porca", "Dados do animal" |
| HERD-07 | P3 | Unknown animal | Open `/herd/animals/NOPE-1` | "Animal não encontrado" |
| HERD-08 | P3 | `@future` Export the herd list | Herd list view → "Exportar" | A CSV of the animals is downloaded |
| HERD-09 | P2 | Farm layout | `/herd` → "Esquema da granja"; open Engorda A | "Localização na granja" with Engorda A highlighted |

## Quick log (field events) — `features/quicklog.feature`

| ID | P | Title | Steps | Expected result |
| --- | --- | --- | --- | --- |
| LOG-01 | P1 | Quick log menu | Owner clicks "Novo" | Sheet "Registar" lists Parto, Doença, Transferência, Cobertura, Tratamento, Peso, Morte, Venda, Despesa, Actividade |
| LOG-02 | P1 | Record a weight | G-101 → Registar → Peso → 45 → Guardar | Toast "Peso registado · G-101"; animal shows 45 kg |
| LOG-03 | P2 | Weight is required | G-101 → Peso → Guardar with empty value | Error "Indique um peso válido" |
| LOG-04 | P3 | `@future` Implausible weight is rejected | G-104 (Recria, ~36 kg) → Peso 5000 | The form refuses an implausible value; nothing is saved |
| LOG-05 | P1 | Record a treatment | G-103 → Tratamento → Guardar | Toast "Tratamento registado" |
| LOG-06 | P2 | Record a mating | S-021 → Cobertura → Guardar | Toast "Cobertura registada · S-021" |
| LOG-07 | P1 | Record a farrowing | S-009 → Parto → Guardar (default 11 live) | Toast "Parto registado · S-009 · 11 vivos" |
| LOG-08 | P2 | Transfer an animal | G-114 → Transferir → destination Engorda B | Toast "Transferência registada"; animal breadcrumb shows Engorda B |
| LOG-09 | P1 | Record a death | Quick log → Morte → animal N-218, cause → "Registar morte" | Toast "Morte registada · N-218"; animal shows "Morto" and has no Registar action |
| LOG-10 | P1 | Sale blocked during withdrawal | F-066 (in withdrawal) → Vender | "venda bloqueada" is shown and the sale is not saved |
| LOG-11 | P1 | Sell an animal | F-061 (97 kg) → Vender | Total shows 6 790 MT (97 × 70); toast "Venda registada · F-061"; animal shows "Vendido" |
| LOG-12 | P2 | Activity needs a title | Novo → Actividade → Guardar empty | "Indique o título da actividade." |
| LOG-13 | P1 | Caretaker quick log has no money entries | Caretaker → Registo rápido | Venda and Despesa are not offered |
| LOG-14 | P2 | Saving offline gives a clear error | G-105 → Peso → go offline → Guardar | "Sem ligação à internet" |
| LOG-15 | P2 | `@future` Record a death from the animal page | N-217 → Registar menu → Morte | The animal page menu offers "Morte" (today only the global quick log does) |
| LOG-16 | P1 | Record another kind of sale | Novo → Venda → Outra venda → Estrume, 800 MT, buyer → Guardar | Toast "Venda registada · Estrume E2E" |

## Animal management — `features/animals.feature`

| ID | P | Title | Steps | Expected result |
| --- | --- | --- | --- | --- |
| ANI-01 | P1 | Buy animals into a pen | Pen Gestação → note occupancy → Adicionar animais (origem Compra) → 2 Leitoa, 120 kg, 30000 MT | Toast "2 animais registados · Gestação"; occupancy grows by 2 |
| ANI-02 | P2 | Buying over capacity is refused | Pen Varrasco (1/2) → Comprar 5 | Error "Varrasco só tem 1 lugar livre." |
| ANI-03 | P2 | Edit animal notes | G-102 → Editar → Notas → Guardar alterações | Toast "Animal actualizado"; notes shown under "Dados do animal" |
| ANI-04 | P2 | Duplicate ear tag is refused | G-106 → Editar → Brinco "G-107" | Error "O brinco G-107 já existe." |
| ANI-05 | P1 | Register existing animals | Engorda B → Adicionar animais → origem Já na granja → E2E-701, Macho, Engorda, 64 kg → Registar 1 animal | "1 animal registado · Engorda B"; occupancy +1 |
| ANI-06 | P2 | Dated animal photo | G-104 → Fotos → add photo, date 2026-10-05 → Guardar foto | "Foto adicionada"; listed as "5 Out 2026" |
| ANI-07 | P1 | Transfer chosen animals | Recria → Transferir → Guardar without choosing → pick G-112 → Engorda B | Error "Seleccione os animais a transferir.", then "Transferência registada · G-112 → Engorda B" |
| LOG-17 | P2 | Pen treatment needs a choice | Engorda A → Tratar curral → Guardar → Seleccionar todos | Error "Seleccione pelo menos um animal.", then "12 seleccionados" |

## Expenses (Despesas) — `features/money.feature`

| ID | P | Title | Steps | Expected result |
| --- | --- | --- | --- | --- |
| MON-01 | P1 | Expenses page | Owner opens `/expenses` | Heading "Despesas", "Compromissos", "Nova despesa"; no "Resultado" or "Receita vs despesas" |
| MON-02 | P1 | Record an expense | Nova despesa → Veterinário → 1500 → description → Registar despesa | Toast "Despesa registada"; found by searching the movements |
| MON-03 | P2 | Expense needs a positive amount | Nova despesa → Veterinário → 0 → Registar despesa | "Indique um valor numérico maior que zero." |
| MON-04 | P1 | Investor is read-only | Investor opens `/expenses` | Expenses are visible; no "Nova despesa" button |
| MON-05 | P2 | Expense-only sheet | Nova despesa | Sheet "Nova despesa" with "Registar despesa"; no "Receita" option (income comes from Venda) |
| MON-06 | P2 | Money date presets | Open `/expenses` → "Este mês" by default → Mês passado → Desde o início até hoje | URL `period=last-month`, then `period=all-time` |
| MON-07 | P1 | Stock category needs an item | Nova despesa → Ração → 2 sacos → Registar despesa | "Escolha o artigo de stock desta despesa, ou crie um novo." |
| MON-08 | P1 | Create the item while buying it | Nova despesa → Ração → + Criar novo artigo → name, 3 sacos × 700 → Registar despesa | "Despesa registada"; `/stock` lists the item with 3 sacos |

## Reports — `features/reports.feature`

| ID | P | Title | Steps | Expected result |
| --- | --- | --- | --- | --- |
| REP-01 | P1 | Summary statement | Owner opens `/reports` | "Demonstração de resultados" |
| REP-02 | P2 | Change period | Click "Este ano" | URL has `period=this-year` |
| REP-03 | P2 | Export CSV | Click "Exportar" → "Excel" | A `relatorio-*.csv` file is downloaded |
| REP-04 | P1 | Stock section | Open `/reports` (single page, no tabs) | "Compras e consumo ao longo do tempo" chart and "Movimento por artigo" table |
| REP-05 | P2 | Export the stock report | Exportar → Stock (Excel) | File `relatorio-stock-….csv` |
| REP-06 | P2 | Date presets | Pick Mês passado, Mês antepassado, Este semestre, Ano passado, Desde o início até hoje | URL `period=` last-month, two-months-ago, this-half, last-year, all-time |

## Stock — `features/stock.feature`

| ID | P | Title | Steps | Expected result |
| --- | --- | --- | --- | --- |
| STK-01 | P1 | Stock page in the main navigation | Owner → nav "Stock" → `/stock` | Heading "Stock", items listed, "Registar artigo" and "Registar movimento" buttons |
| STK-02 | P1 | Caretaker records movements only | Caretaker opens `/stock` | "Registar movimento" shown, "Registar artigo" hidden |
| STK-03 | P2 | Record an entry | Registar movimento → Desinfectante, 3 L, Doação → Registar | "Entrada registada" toast |
| STK-04 | P2 | Exit above the stock is refused | Registar movimento → Saída → Ivermectina 99999 → Registar | Sheet shows an error |
| STK-05 | P2 | Movement history | Open `/stock?tab=moves` | Opening balances ("Stock inicial") listed |
| STK-06 | P1 | Purchase entry records the expense | Registar movimento → Desinfectante, 2 L, Compra → default 150 MT/L shown → change to 175 → Agro-Teste → Registar | Total −350 MT; "Compra registada"; `/expenses` lists "Desinfectante · 2 L · Agro-Teste" |
| STK-07 | P1 | Register an item | Registar artigo → no Código/Nota fields → Farelo E2E, Ração · sacos, 1, 60 days → Guardar | Unit shown read-only ("saco"); "Artigo registado"; listed as "1 saco" |

## Help — `features/help.feature`

| ID | P | Title | Steps | Expected result |
| --- | --- | --- | --- | --- |
| HELP-01 | P1 | Help library | Open `/help` | "Como podemos ajudar?", "Guias práticos", "Base de conhecimento" |
| HELP-02 | P1 | Search for a topic | Search "cio" | The "Cio" guide is listed |
| HELP-03 | P2 | Search without results | Search "xyzzy" | "Nada encontrado. Tente outra palavra." |
| HELP-04 | P2 | Open a guide | Click "Peste Suína Africana" | Guide page with that heading |
| HELP-05 | P3 | Search ignores accents | Search "carencia" | "Período de carência: o que é e como respeitar" is listed |

## Settings — `features/settings.feature`

| ID | P | Title | Steps | Expected result |
| --- | --- | --- | --- | --- |
| SET-01 | P1 | Owner settings tabs | Owner opens `/settings` | Tabs Geral, Currais, Contas, Parâmetros (cost types and catalogs live in the admin area) |
| SET-02 | P1 | Caretaker settings tabs | Caretaker opens `/settings` | No Contas or Tipos de custo tab (cost types live in the admin area) |
| SET-03 | P2 | Create a funding account | Contas → Nova conta → name → Guardar | Toast "Conta criada"; the account is listed |
| SET-04 | P2 | Invite with an invalid email | Geral → Equipa → Convidar → bad email | "Indique o nome e um email válido." |
| SET-05 | P2 | Invite a team member | Convidar → name, email, role → Convidar | Toast "Convite enviado a …" |
| SET-06 | P1 | Register a pen | Currais → Novo curral → name, Quarentena, Vedado + motivo → Guardar | "Curral criado"; listed as "Quarentena · Obras" with the Vedado chip |
| SET-07 | P2 | Caretaker pen layout is read-only | Caretaker opens Currais | Layout shown; no "Novo curral" |

**Totals:** 78 cases: 74 core, 4 `@future` (NAV-06, HERD-08, LOG-04, LOG-15).

Counts that other scenarios change (herd size, pen occupancy) are asserted either as a before/after change or against the database. This keeps scenarios independent of execution order.
