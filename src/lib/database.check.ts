// Compile-time drift check: the hand-written types in database.types.ts (narrower: literal unions,
// typed jsonb) must match the schema generated from the migrations. A mismatch fails `tsc` with a
// message like "transactions.amount: nullability". Regenerate with `npm run gen:types`.
import type { Database as Generated, Json } from './database.generated'
import type { Database as Hand } from './database.types'

type G = Generated['public']
type H = Hand['public']

type IsNullable<T> = null extends T ? true : false
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
type RequiredKeys<T> = { [K in keyof T]-?: object extends Pick<T, K> ? never : K }[keyof T]

type ColumnIssues<Rel extends string, HR, GR, CheckNull extends boolean> =
  | { [K in Exclude<keyof GR, keyof HR> & string]: `${Rel}.${K}: missing in database.types.ts` }[Exclude<keyof GR, keyof HR> & string]
  | { [K in Exclude<keyof HR, keyof GR> & string]: `${Rel}.${K}: not in the schema` }[Exclude<keyof HR, keyof GR> & string]
  | {
      [K in keyof HR & keyof GR & string]:
        | ([NonNullable<HR[K]>] extends [NonNullable<GR[K]>] ? never : `${Rel}.${K}: type`)
        | (CheckNull extends true ? ([Json] extends [GR[K]] ? never : Same<IsNullable<HR[K]>, IsNullable<GR[K]>> extends true ? never : `${Rel}.${K}: nullability`) : never)
    }[keyof HR & keyof GR & string]

type TableIssues = { [T in keyof G['Tables'] & string]: T extends keyof H['Tables']
  ? ColumnIssues<T, H['Tables'][T]['Row'], G['Tables'][T]['Row'], true>
  : `${T}: table missing in database.types.ts` }[keyof G['Tables'] & string]

type ViewIssues = { [V in keyof G['Views'] & string]: V extends keyof H['Views']
  ? ColumnIssues<V, H['Views'][V]['Row'], G['Views'][V]['Row'], false>
  : `${V}: view missing in database.types.ts` }[keyof G['Views'] & string]

// Only RPCs the app declares are checked (helpers like has_role are callable but unused).
type FunctionIssues = { [F in keyof H['Functions'] & string]: F extends keyof G['Functions']
  ? | (Same<keyof H['Functions'][F]['Args'], keyof G['Functions'][F]['Args']> extends true ? never : `${F}(): argument names`)
    | (Same<RequiredKeys<H['Functions'][F]['Args']>, RequiredKeys<G['Functions'][F]['Args']>> extends true ? never : `${F}(): required arguments`)
  : `${F}(): not in the schema` }[keyof H['Functions'] & string]

type NoIssues<T extends never> = T
export type SchemaInSync = NoIssues<TableIssues | ViewIssues | FunctionIssues>
