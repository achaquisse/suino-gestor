import assert from 'node:assert/strict';
import { migratedDb } from './migrated-db.mjs';

const db = await migratedDb({ log: true });
const uid = '11111111-1111-1111-1111-111111111111';
const adminUid = '44444444-4444-4444-4444-444444444444';
const asAdmin = `reset role; set request.jwt.claim.sub = '${adminUid}'; set request.jwt.claim.email = 'admin@example.com'; set role authenticated;`;
const asOwner = `reset role; set request.jwt.claim.sub = '${uid}'; set request.jwt.claim.email = 'owner@example.com'; set role authenticated;`;
await db.exec(`insert into auth.users values ('${uid}', 'owner@example.com', '{"full_name":"Américo Chaquisse"}');
insert into auth.users values ('${adminUid}', 'admin@example.com', '{"full_name":"Super Admin"}');
select public.set_super_admins(array['Admin@Example.com ']);
grant usage on schema public to authenticated; grant all on all tables in schema public to authenticated;
grant usage on schema auth to authenticated; grant execute on all functions in schema auth to authenticated;
${asAdmin}`);
// Only the super admin creates farms; the owner is added by email.
const farm = (await db.query(`select public.admin_create_farm('Granja Boane', 'owner@example.com', true) as id`)).rows[0].id;
await db.exec(asOwner);
const q = async (sql, p = []) => (await db.query(sql, p)).rows;
await q(`insert into notification_resolutions (farm_id, user_id, alert_key) values ($1, $2, 'farrow-test')`, [farm, uid]);
assert.equal((await q(`select alert_key from notification_resolutions where farm_id = $1`, [farm]))[0].alert_key, 'farrow-test');
assert.equal(Number((await q(`select count(*) from treatment_products where farm_id = $1`, [farm]))[0].count), 7);
assert.equal(Number((await q(`select count(*) from breeds where farm_id = $1`, [farm]))[0].count), 7);
assert.equal(Number((await q(`select count(*) from symptoms where farm_id = $1`, [farm]))[0].count), 7);
assert.equal((await q(`select stock_code from treatment_products where farm_id = $1 and code = 'ferro'`, [farm]))[0].stock_code, 'iron');
await assert.rejects(q(`insert into stock_items (farm_id, code, name, category) values ($1, 'invalid', 'Inválido', 'Não existe')`, [farm]));
// Cost types are written by the super admin only (20261119000200_admin_cost_types.sql).
await assert.rejects(q(`insert into categories (farm_id, name, grp) values ($1, 'Pelo dono', 'Operacional')`, [farm]));
assert.equal(Number((await q(`with u as (update categories set description = 'x' where farm_id = $1 returning 1) select count(*) from u`, [farm]))[0].count), 0, 'owners do not edit cost types');
await db.exec(asAdmin);
await q(`insert into categories (farm_id, name, grp) values ($1, 'Nova categoria', 'Operacional')`, [farm]);
await db.exec(asOwner);
await q(`insert into stock_items (farm_id, code, name, category, unit, unit_price) values ($1, 'custom', 'Artigo próprio', 'Nova categoria', 'un', 15)`, [farm]);
await db.exec(asAdmin);
await q(`update categories set name = 'Categoria actualizada' where farm_id = $1 and name = 'Nova categoria'`, [farm]);
await db.exec(asOwner);
assert.equal((await q(`select category from stock_items where farm_id = $1 and code = 'custom'`, [farm]))[0].category, 'Categoria actualizada');
// Catalogs are written by the super admin only (20261119000300_admin_catalogs.sql).
await assert.rejects(q(`insert into breeds (farm_id, name) values ($1, 'Pelo dono')`, [farm]));
await assert.rejects(q(`insert into symptoms (farm_id, name) values ($1, 'Pelo dono')`, [farm]));
await assert.rejects(q(`insert into treatment_products (farm_id, code, name) values ($1, 'dono', 'Pelo dono')`, [farm]));
assert.equal(Number((await q(`with u as (update breeds set name = name || '!' where farm_id = $1 returning 1) select count(*) from u`, [farm]))[0].count), 0, 'owners do not edit catalogs');
await db.exec(asAdmin);
await q(`insert into treatment_products (farm_id, code, name, stock_code) values ($1, 'custom', 'Tratamento próprio', 'custom')`, [farm]);
await q(`insert into breeds (farm_id, name) values ($1, 'Raça própria')`, [farm]);
await q(`insert into symptoms (farm_id, name) values ($1, 'Sintoma próprio')`, [farm]);
await db.exec(asOwner);
console.log(await q(`select (select count(*) from animals) animals, (select count(*) from events) events, (select count(*) from transactions) txs, (select count(*) from tasks) tasks, (select count(*) from stock_items) stock`));
console.log(await q(`select name, balance from account_balances order by name`));
console.log(await q(`select code, cost, revenue from batch_results limit 6`));
const pen = (await q(`select id from pens where name='Maternidade A'`))[0].id;
const id = async (tag) => (await q(`select id from animals where tag=$1`, [tag]))[0].id;
const pid = async (n) => (await q(`select id from pens where name=$1`, [n]))[0].id;
const acct = (await q(`select id from accounts where name='Vendas'`))[0].id;
await db.exec(asAdmin);
await q(`update categories set item_type = 'Produto', quantity_unit = 'kg', baseline_price = 25 where farm_id = $1 and name = 'Ração'`, [farm]);
const [feed] = await q(`select item_type, quantity_unit, baseline_price from categories where farm_id = $1 and name = 'Ração'`, [farm]);
assert.equal(feed.item_type, 'Produto');
assert.equal(feed.quantity_unit, 'kg');
assert.equal(Number(feed.baseline_price), 25);
await assert.rejects(q(`update categories set baseline_price = null where farm_id = $1 and name = 'Ração'`, [farm]));
await db.exec(asOwner);
const [productTx] = await q(`insert into transactions (farm_id, tx_date, title, account_id, kind, category, amount, quantity, quantity_unit, unit_price)
  values ($1, current_date, 'Ração', $2, 'Pontual', 'Ração', -250, 10, 'kg', 25)
  returning quantity, quantity_unit, unit_price, amount`, [farm, acct]);
assert.equal(Number(productTx.quantity), 10);
assert.equal(Number(productTx.amount), -250);
const [revenueTx] = await q(`insert into transactions (farm_id, tx_date, title, account_id, kind, category, amount, quantity, quantity_unit, unit_price)
  values ($1, current_date, 'Venda de ovos', $2, 'Receita', 'Outras receitas', 300, 12, 'un', 25)
  returning quantity, amount`, [farm, acct]);
assert.equal(Number(revenueTx.quantity), 12);
assert.equal(Number(revenueTx.amount), 300);
await assert.rejects(q(`insert into transactions (farm_id, tx_date, title, account_id, kind, category, amount, quantity, unit_price)
  values ($1, current_date, 'Ração', $2, 'Pontual', 'Ração', -250, 10, 25)`, [farm, acct]));
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
const [saleTx] = await q(`select quantity, quantity_unit, unit_price from transactions where farm_id = $1 and source = 'sale' order by created_at desc limit 1`, [farm]);
assert.equal(Number(saleTx.quantity), 95);
assert.equal(saleTx.quantity_unit, 'kg');
assert.equal(Number(saleTx.unit_price), 70);
const [stockTx] = await q(`select quantity, quantity_unit, unit_price from transactions where farm_id = $1 and source = 'stock' order by created_at desc limit 1`, [farm]);
assert.equal(Number(stockTx.quantity), 4);
assert.ok(stockTx.quantity_unit);
assert.equal(Number(stockTx.unit_price), 450);
const [itemBefore] = await q(`select qty, category, unit from stock_items where id = $1`, [stockId]);
const batchRows = await q(`select id, cost, revenue from batch_results where farm_id = $1 order by code limit 2`, [farm]);
const ids = batchRows.map((b) => b.id);
const [manual] = await q(`insert into transactions (farm_id, tx_date, title, account_id, kind, category, amount, quantity, quantity_unit, unit_price, batch_ids, stock_quantity, source, source_id)
  values ($1, current_date, 'Compra unificada', $2, 'Pontual', $3, -120, 2, $4, 60, $5, 2, 'stock', $6) returning id`,
  [farm, acct, itemBefore.category, itemBefore.unit, ids, stockId]);
assert.equal(Number((await q(`select qty from stock_items where id = $1`, [stockId]))[0].qty), Number(itemBefore.qty) + 2);
const unallocated = await q(`select cost, revenue from batch_results where id = any($1::uuid[]) order by code`, [ids]);
assert.deepEqual(unallocated.map((b) => Number(b.cost)), batchRows.map((b) => Number(b.cost)));
await q(`delete from transactions where id = $1`, [manual.id]);
assert.equal(Number((await q(`select qty from stock_items where id = $1`, [stockId]))[0].qty), Number(itemBefore.qty));

// Stock ledger (20261119000100_stock_movements.sql)
const reasons = (await q(`select reason from stock_movements where item_id = $1 order by created_at`, [stockId])).map((r) => r.reason);
assert.ok(['Stock inicial', 'Compra', 'Compra anulada'].every((r) => reasons.includes(r)), `iver ledger: ${reasons}`);
const qtyNow = async () => Number((await q(`select qty from stock_items where id = $1`, [stockId]))[0].qty);
const q0 = await qtyNow();
assert.equal(Number((await q(`select public.move_stock($1, $2, 'in', 5, 'Doação', 'Vizinho') as v`, [farm, stockId]))[0].v), q0 + 5);
assert.equal(Number((await q(`select public.move_stock($1, $2, 'out', 2, 'Consumo') as v`, [farm, stockId]))[0].v), q0 + 3);
await assert.rejects(q(`select public.move_stock($1, $2, 'out', 99999, 'Consumo')`, [farm, stockId]), /insuficiente/);
await assert.rejects(q(`select public.move_stock($1, $2, 'in', 1, 'Consumo')`, [farm, stockId]), /motivo/);
await assert.rejects(q(`select public.move_stock($1, $2, 'in', 0, 'Doação')`, [farm, stockId]), /quantidade/);
await assert.rejects(q(`select public.move_stock($1, $2, 'in', 1, 'Doação', '', current_date + 1)`, [farm, stockId]), /futuro/);
// A purchase entry also records the expense (20261119000400_stock_entry_purchase.sql).
const txBefore = Number((await q(`select count(*) from transactions where farm_id = $1`, [farm]))[0].count);
await assert.rejects(q(`select public.move_stock($1, $2, 'in', 1, 'Compra')`, [farm, stockId]), /preço/);
await assert.rejects(q(`select public.move_stock($1, $2, 'in', 1, 'Compra', '', current_date, null, 100, null)`, [farm, stockId]), /conta/);
await assert.rejects(q(`select public.move_stock($1, $2, 'in', 1, 'Entrada')`, [farm, stockId]), /motivo/);
assert.equal(Number((await q(`select public.move_stock($1, $2, 'in', 4, 'Compra', 'Factura 12', current_date, null, 1000, $3, 'Agro-Moz') as v`, [farm, stockId, acct]))[0].v), q0 + 7);
const [buy] = await q(`select title, amount, quantity, unit_price, stock_quantity, notes, source, source_id from transactions where farm_id = $1 order by created_at desc limit 1`, [farm]);
assert.equal(Number((await q(`select count(*) from transactions where farm_id = $1`, [farm]))[0].count), txBefore + 1);
assert.deepEqual({ amount: Number(buy.amount), quantity: Number(buy.quantity), unit_price: Number(buy.unit_price), stock_quantity: Number(buy.stock_quantity), notes: buy.notes, source: buy.source, source_id: buy.source_id },
  { amount: -1000, quantity: 4, unit_price: 250, stock_quantity: 4, notes: 'Factura 12', source: 'stock', source_id: stockId });
assert.match(buy.title, /Agro-Moz$/);
assert.equal((await q(`select reason from stock_movements where item_id = $1 order by created_at desc limit 1`, [stockId]))[0].reason, 'Compra');
assert.equal(Number((await q(`select public.count_stock($1, $2, 1, 'Inventário') as v`, [farm, stockId]))[0].v), 1);
await assert.rejects(q(`select public.count_stock($1, $2, 1)`, [farm, stockId]), /coincide/);
const [last] = await q(`select reason, delta, qty_after, note, created_by_name from stock_movements where item_id = $1 order by created_at desc limit 1`, [stockId]);
assert.deepEqual({ ...last, delta: Number(last.delta), qty_after: Number(last.qty_after) },
  { reason: 'Contagem', delta: 1 - (q0 + 7), qty_after: 1, note: 'Inventário', created_by_name: 'Américo' });
await q(`update stock_items set qty = 4 where id = $1`, [stockId]);
assert.equal((await q(`select reason from stock_movements where item_id = $1 order by created_at desc limit 1`, [stockId]))[0].reason, 'Ajuste');
await assert.rejects(q(`insert into stock_movements (farm_id, item_id, reason, delta, qty_after) values ($1, $2, 'Entrada', 1, 1)`, [farm, stockId]));
const unbalanced = await q(`select s.code from stock_items s where s.qty <> coalesce((select sum(m.delta) from stock_movements m where m.item_id = s.id), 0)`);
assert.deepEqual(unbalanced, [], 'every item quantity equals the sum of its movements');
console.log('stock ledger: ok');

// "Aporte" is now "Injeção de capital" (20261119000600_capital_injection.sql).
assert.equal(Number((await q(`select count(*) from categories where farm_id = $1 and name = 'Aporte'`, [farm]))[0].count), 0);
assert.equal(Number((await q(`select count(*) from categories where farm_id = $1 and name = 'Injeção de capital'`, [farm]))[0].count), 1);
assert.ok(Number((await q(`select count(*) from transactions where farm_id = $1 and kind = 'Injeção de capital' and category = 'Injeção de capital'`, [farm]))[0].count) > 0, 'demo capital injections');
await assert.rejects(q(`insert into transactions (farm_id, tx_date, title, account_id, kind, category, amount) values ($1, current_date, 'x', $2, 'Aporte', 'Injeção de capital', 10)`, [farm, acct]));
console.log('capital injection: ok');

// Stock items: code from the name, unit from the category, expiry from the shelf life (20261119000700).
const meds = await q(`select quantity_unit, quantity_unit_singular from categories where farm_id = $1 and name = 'Medicamentos'`, [farm]);
assert.deepEqual(meds[0], { quantity_unit: 'frascos', quantity_unit_singular: 'frasco' });
const [auto] = await q(`insert into stock_items (farm_id, name, category, qty, shelf_life_days) values ($1, 'Ivermectina', 'Medicamentos', 5, 90)
  returning code, unit, unit_singular, expires_on, current_date + 90 as expected`, [farm]);
assert.equal(auto.code, 'ivermectina', 'code from the name');
assert.deepEqual([auto.unit, auto.unit_singular], ['frascos', 'frasco']);
assert.equal(String(auto.expires_on), String(auto.expected));
const [auto2] = await q(`insert into stock_items (farm_id, name, category) values ($1, 'Ivermectina', 'Medicamentos') returning code`, [farm]);
assert.equal(auto2.code, 'ivermectina-2', 'codes stay unique per farm');
await assert.rejects(q(`insert into stock_items (farm_id, name, category) values ($1, 'Sem unidade', 'Veterinário')`, [farm]), /unidade/);
await db.exec(asAdmin);
await q(`update categories set quantity_unit = 'caixas', quantity_unit_singular = 'caixa' where farm_id = $1 and name = 'Medicamentos'`, [farm]);
await db.exec(asOwner);
const units = Object.fromEntries((await q(`select code, unit from stock_items where farm_id = $1 and category = 'Medicamentos'`, [farm])).map((r) => [r.code, r.unit]));
assert.equal(units.ivermectina, 'caixas', 'items follow their category unit');
assert.equal(units.parvo, 'doses', 'an item with its own unit keeps it');
// Expiry after a purchase into an empty item.
const autoId = (await q(`select id from stock_items where farm_id = $1 and code = 'ivermectina-2'`, [farm]))[0].id;
await q(`update stock_items set shelf_life_days = 30 where id = $1`, [autoId]);
await q(`select public.move_stock($1, $2, 'in', 2, 'Compra', '', current_date - 3, null, 100, $3)`, [farm, autoId, acct]);
const [exp] = await q(`select expires_on, current_date + 27 as expected from stock_items where id = $1`, [autoId]);
assert.equal(String(exp.expires_on), String(exp.expected), 'expires 30 days after the purchase date');
console.log('stock item units: ok');
await q(`insert into transactions (farm_id, tx_date, title, account_id, kind, category, amount, batch_ids, batch_allocations)
  values ($1, current_date, 'Despesa distribuída', $2, 'Pontual', 'Veterinário', -100, $3, $4::jsonb)`,
  [farm, acct, ids, JSON.stringify(ids.map((batch_id) => ({ batch_id, amount: -50 })))]);
await q(`insert into transactions (farm_id, tx_date, title, account_id, kind, category, amount, batch_ids, batch_allocations)
  values ($1, current_date, 'Receita distribuída', $2, 'Receita', 'Outras receitas', 40, $3, $4::jsonb)`,
  [farm, acct, ids, JSON.stringify(ids.map((batch_id) => ({ batch_id, amount: 20 })))]);
const allocatedRows = await q(`select cost, revenue from batch_results where id = any($1::uuid[]) order by code`, [ids]);
allocatedRows.forEach((b, i) => {
  assert.equal(Number(b.cost), Number(batchRows[i].cost) + 50);
  assert.equal(Number(b.revenue), Number(batchRows[i].revenue) + 20);
});
await assert.rejects(q(`insert into transactions (farm_id, tx_date, title, account_id, kind, category, amount, batch_ids, batch_allocations)
  values ($1, current_date, 'Distribuição inválida', $2, 'Pontual', 'Veterinário', -100, $3, $4::jsonb)`,
  [farm, acct, ids, JSON.stringify([{ batch_id: ids[0], amount: -30 }])]));
console.log(await q(`select status, count(*) from animals where tag like 'L14-%' group by 1`));
console.log(await q(`select tag, stage, status from animals where tag like 'L09-%' or tag like 'C-%' limit 4`));
console.log(await q(`select name, balance from account_balances order by name`));
console.log(await q(`select title, done_at is not null done from tasks order by due_date limit 2`));
await db.exec(`reset role; insert into auth.users values ('22222222-2222-2222-2222-222222222222','joao.mabunda@example.com','{}'); set request.jwt.claim.sub='22222222-2222-2222-2222-222222222222'; set request.jwt.claim.email='joao.mabunda@example.com'; set role authenticated;`);
console.log('accept', await q(`select public.accept_invites()`));
console.log('caretaker sees txs:', (await q(`select count(*) from transactions`))[0], 'animals:', (await q(`select count(*) from animals`))[0]);
assert.equal(Number((await q(`select count(*) from notification_resolutions where farm_id = $1`, [farm]))[0].count), 0);
await assert.rejects(q(`insert into notification_resolutions (farm_id, user_id, alert_key) values ($1, $2, 'other-user')`, [farm, uid]));
await q(`insert into notification_resolutions (farm_id, user_id, alert_key) values ($1, '22222222-2222-2222-2222-222222222222', 'farrow-test')`, [farm]);
assert.equal(Number((await q(`select count(*) from notification_resolutions where farm_id = $1`, [farm]))[0].count), 1);
assert.equal(Number((await q(`select count(*) from treatment_products where farm_id = $1`, [farm]))[0].count), 8);
assert.equal(Number((await q(`select count(*) from breeds where farm_id = $1`, [farm]))[0].count), 8);
assert.equal(Number((await q(`select count(*) from symptoms where farm_id = $1`, [farm]))[0].count), 8);
await assert.rejects(q(`insert into symptoms (farm_id, name) values ($1, 'Sem permissão') returning id`, [farm]));
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

await db.exec(asOwner);
await assert.rejects(q(`select public.create_farm('Granja do dono', false)`), /administrador/);
await db.exec(asAdmin);
const freshFarm = (await q(`select public.create_farm('Nova granja', false) as id`))[0].id;
assert.equal(Number((await q(`select count(*) from treatment_products where farm_id = $1`, [freshFarm]))[0].count), 7);
assert.equal(Number((await q(`select count(*) from breeds where farm_id = $1`, [freshFarm]))[0].count), 7);
assert.equal(Number((await q(`select count(*) from symptoms where farm_id = $1`, [freshFarm]))[0].count), 7);
console.log('help docs:', (await q(`select kind, count(*) from help_docs group by kind order by kind`)));
for (const [query, cat] of [['', null], ['carência', null], ['CARENCIA', null], ['ferro', null], ['cio', 'Reprodução'], ['peste suina', null], ['xyzzy', null]]) {
  const r = (await q(`select public.search_help($1, $2) as r`, [query, cat]))[0].r;
  console.log(`search_help(${JSON.stringify(query)}, ${cat}):`, r.total, JSON.stringify(r.counts), r.items.slice(0, 3).map((i) => i.id).join(','));
}
console.log('help_docs rows updated by member (expect 0):', (await q(`with u as (update help_docs set title = 'x' returning 1) select count(*) from u`))[0]);

// Super admin (20261119000000_super_admin.sql)
await db.exec(asOwner);
assert.equal((await q(`select public.is_super_admin() as v`))[0].v, false);
await assert.rejects(q(`select * from public.admin_farms()`), /administrador/);
await assert.rejects(q(`select * from public.admin_users()`), /administrador/);
await assert.rejects(q(`select public.admin_create_farm('X', null, false)`), /administrador/);
await assert.rejects(q(`select public.set_super_admins(array['owner@example.com'])`));
assert.equal(Number((await q(`select count(*) from farms where id = $1`, [freshFarm]))[0].count), 0, 'owner must not see a farm they do not belong to');
await db.exec(asAdmin);
assert.equal((await q(`select public.is_super_admin() as v`))[0].v, true);
const adminFarms = await q(`select * from public.admin_farms()`);
assert.ok(adminFarms.some((f) => f.id === freshFarm && f.owners === 'Super Admin' && f.members === 1));
const invited = (await q(`select public.admin_create_farm('Granja convidada', 'Novo.Dono@Example.com', false) as id`))[0].id;
const [inv] = await q(`select email, role from farm_invites where farm_id = $1`, [invited]);
assert.deepEqual(inv, { email: 'novo.dono@example.com', role: 'owner' });
assert.equal((await q(`select owners from public.admin_farms() where id = $1`, [invited]))[0].owners, 'novo.dono@example.com (convite)');
await assert.rejects(q(`select public.admin_create_farm('Y', 'not-an-email', false)`), /email/);
// Acts as an owner in any farm without a membership row.
const ownerFarm = (await q(`select public.admin_create_farm('Granja do dono', 'owner@example.com', false) as id`))[0].id;
assert.equal(Number((await q(`select count(*) from farm_members where farm_id = $1 and user_id = $2`, [ownerFarm, adminUid]))[0].count), 0);
await q(`update farms set name = 'Granja renomeada' where id = $1`, [ownerFarm]);
assert.equal((await q(`select name from farms where id = $1`, [ownerFarm]))[0].name, 'Granja renomeada');
await db.exec(asOwner);
assert.equal(Number((await q(`with u as (update farms set name = 'Pelo dono' where id = $1 returning 1) select count(*) from u`, [ownerFarm]))[0].count), 0, 'only the super admin renames farms');
await db.exec(asAdmin);
await q(`insert into pens (farm_id, name) values ($1, 'Curral admin')`, [ownerFarm]);
assert.equal((await q(`select public.my_name($1) as n`, [ownerFarm]))[0].n, 'Super Admin');
const users = await q(`select * from public.admin_users()`);
assert.ok(users.find((u) => u.email === 'admin@example.com').is_super_admin);
assert.ok(users.find((u) => u.email === 'owner@example.com').farms.some((f) => f.farm_id === ownerFarm && f.role === 'owner'));
await q(`delete from farms where id = $1`, [invited]);
await db.exec(`reset role; select public.set_super_admins(array[]::text[]);`);
await db.exec(asAdmin);
assert.equal((await q(`select public.is_super_admin() as v`))[0].v, false, 'removed from SUPER_ADMIN_EMAIL → no longer admin');
console.log('super admin: ok');
