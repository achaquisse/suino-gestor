import { migratedDb } from './migrated-db.mjs';

const db = await migratedDb({ log: true });
const uid = '11111111-1111-1111-1111-111111111111';
await db.exec(`insert into auth.users values ('${uid}', 'owner@example.com', '{"full_name":"Américo Chaquisse"}');
grant usage on schema public to authenticated; grant all on all tables in schema public to authenticated;
grant usage on schema auth to authenticated; grant execute on all functions in schema auth to authenticated;
set request.jwt.claim.sub = '${uid}'; set request.jwt.claim.email = 'owner@example.com'; set role authenticated;`);
const farm = (await db.query(`select public.create_farm('Granja Boane', true) as id`)).rows[0].id;
const q = async (sql, p = []) => (await db.query(sql, p)).rows;
console.log(await q(`select (select count(*) from animals) animals, (select count(*) from events) events, (select count(*) from transactions) txs, (select count(*) from tasks) tasks, (select count(*) from stock_items) stock`));
console.log(await q(`select name, balance from account_balances order by name`));
console.log(await q(`select code, cost, revenue from batch_results limit 6`));
const pen = (await q(`select id from pens where name='Maternidade A'`))[0].id;
const id = async (tag) => (await q(`select id from animals where tag=$1`, [tag]))[0].id;
const pid = async (n) => (await q(`select id from pens where name=$1`, [n]))[0].id;
const acct = (await q(`select id from accounts where name='Vendas'`))[0].id;
const stockId = (await q(`select id from stock_items where code='iver'`))[0].id;
const recur = (await q(`select id from recurring_expenses limit 1`))[0].id;
const debt = (await q(`select id from debts where paid < total limit 1`))[0].id;
const tests = [
  [`select public.log_treatment($1, array(select id from animals where tag like 'L14-%'), 'ferro', 'Ferro dextrano 200 mg', 0, 'iron')`, [farm]],
  [`select public.log_illness($1, $2, array['Tosse'], 'Ligeira', true, 'obs')`, [farm, await id('G-103')]],
  [`select public.log_weight($1, $2, 40.5)`, [farm, await id('G-101')]],
  [`select public.log_transfer($1, $2, $3, $4)`, [farm, await id('S-021'), await pid('Gestação'), await pid('Maternidade B')]],
  [`select public.log_birth($1, $2, 9, 1)`, [farm, await id('S-009')]],
  [`select public.log_mating($1, $2, 'Monta natural', 'B-001')`, [farm, await id('S-022')]],
  [`select public.log_death($1, $2, 'Esmagamento')`, [farm, await id('L14-10')]],
  [`select public.log_sale($1, $2, 95, 70, 'Talho Central', $3)`, [farm, await id('F-061'), acct]],
  [`select public.buy_animals($1, 3, 'Desmamado', 'Macho', 'Landrace', 12, $2, current_date - 40, 'Fornecedor', 7500, $3)`, [farm, await pid('Creche'), acct]],
  [`select public.log_stock_purchase($1, $2, 4, 1800, 'Agro-Moz', $3)`, [farm, stockId, acct]],
  [`select public.pay_recurring($1)`, [recur]],
  [`select public.pay_debt($1)`, [debt]],
  [`select public.update_my_membership($1, '{"lang":"pt"}'::jsonb, 'Américo')`, [farm]],
  [`select public.accept_invites()`, []],
];
for (const [sql, p] of tests) { try { await q(sql, p); console.log('ok rpc'); } catch (e) { console.error('RPC FAIL', sql.slice(0, 60), e.message); } }
console.log(await q(`select status, count(*) from animals where tag like 'L14-%' group by 1`));
console.log(await q(`select tag, stage, status from animals where tag like 'L09-%' or tag like 'C-%' limit 4`));
console.log(await q(`select name, balance from account_balances order by name`));
console.log(await q(`select title, done_at is not null done from tasks order by due_date limit 2`));
await db.exec(`reset role; insert into auth.users values ('22222222-2222-2222-2222-222222222222','joao.mabunda@example.com','{}'); set request.jwt.claim.sub='22222222-2222-2222-2222-222222222222'; set request.jwt.claim.email='joao.mabunda@example.com'; set role authenticated;`);
console.log('accept', await q(`select public.accept_invites()`));
console.log('caretaker sees txs:', (await q(`select count(*) from transactions`))[0], 'animals:', (await q(`select count(*) from animals`))[0]);
try { await q(`select public.log_sale($1, $2, 95, 70, 'x', $3)`, [farm, await id('F-062'), acct]); console.log('BAD: caretaker sale allowed'); } catch (e) { console.log('caretaker sale blocked:', e.message); }

// Hardening checks (20261029000000_hardening.sql)
const expectFail = async (label, sql, p = []) => {
  try { await q(sql, p); console.log('BAD:', label, 'allowed'); } catch (e) { console.log(label, 'blocked:', e.message); }
};
await db.exec(`reset role; insert into auth.users values ('33333333-3333-3333-3333-333333333333','marta.sitoe@example.com','{}', null); set request.jwt.claim.sub='33333333-3333-3333-3333-333333333333'; set request.jwt.claim.email='marta.sitoe@example.com'; set role authenticated;`);
console.log('unconfirmed email accepts', await q(`select public.accept_invites()`), '(expect 0)');
await db.exec(`reset role; set request.jwt.claim.sub = '${uid}'; set request.jwt.claim.email = 'owner@example.com'; set role authenticated;`);
await expectFail('last owner demote', `update farm_members set role = 'caretaker' where farm_id = $1 and user_id = $2`, [farm, uid]);
await expectFail('last owner leave', `delete from farm_members where farm_id = $1 and user_id = $2`, [farm, uid]);
await q(`update farm_members set role = 'owner' where farm_id = $1 and user_id = '22222222-2222-2222-2222-222222222222'`, [farm]);
await q(`update farm_members set role = 'caretaker' where farm_id = $1 and user_id = $2`, [farm, uid]);
console.log('demote with co-owner: ok');
await db.exec(`reset role; set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222'; set role authenticated;`);
await q(`delete from farms where id = $1`, [farm]);
console.log('farm delete cascades past owner guard:', (await q(`select count(*) from farm_members where farm_id = $1`, [farm]))[0]);

await db.exec(`reset role; set request.jwt.claim.sub = '${uid}'; set role authenticated;`);
console.log('help docs:', (await q(`select kind, count(*) from help_docs group by kind order by kind`)));
for (const [query, cat] of [['', null], ['carência', null], ['CARENCIA', null], ['ferro', null], ['cio', 'Reprodução'], ['peste suina', null], ['xyzzy', null]]) {
  const r = (await q(`select public.search_help($1, $2) as r`, [query, cat]))[0].r;
  console.log(`search_help(${JSON.stringify(query)}, ${cat}):`, r.total, JSON.stringify(r.counts), r.items.slice(0, 3).map((i) => i.id).join(','));
}
console.log('help_docs rows updated by member (expect 0):', (await q(`with u as (update help_docs set title = 'x' returning 1) select count(*) from u`))[0]);
