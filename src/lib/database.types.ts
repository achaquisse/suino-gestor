export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Role = 'owner' | 'caretaker' | 'vet' | 'investor'
export type Stage = 'Leitão' | 'Desmamado' | 'Recria' | 'Engorda' | 'Leitoa' | 'Porca' | 'Varrasco'
export type Sex = 'Fêmea' | 'Macho'
export type Tone = 'neutral' | 'accent' | 'red' | 'amber'
export type EventKind = 'task' | 'health' | 'breeding' | 'money'
export type AccountKind = 'Operacional' | 'Investimento' | 'Caixa'
export type CategoryGroup = 'Investimento' | 'Operacional' | 'Receita' | 'Dívida'
export type TxKind = 'Venda' | 'Injeção de capital' | 'Investimento' | 'Recorrente' | 'Pontual' | 'Receita' | 'Dívida'
export type Frequency = 'Semanal' | 'Mensal' | 'Trimestral' | 'Anual'
export type ParamGroup = 'Reprodução' | 'Crescimento' | 'Vendas' | 'Stock' | 'Saúde' | 'Finanças'
export type Split = { account_id: string; pct: number }
export type MemberPrefs = { lang?: string; notif?: { tasks?: boolean; stock?: boolean; weekly?: boolean } }

export type Profile = { id: string; full_name: string; email: string; avatar_url: string | null; created_at: string; disabled_at: string | null }
export type Farm = { id: string; name: string; currency: string; units: string; created_by: string | null; created_at: string }
export type AdminFarm = {
  id: string; name: string; created_at: string; created_by_name: string
  owners: string; members: number; pending_invites: number; pens: number; animals: number
}
export type AdminUser = {
  id: string; name: string; email: string; created_at: string; last_sign_in_at: string | null
  is_super_admin: boolean; disabled_at: string | null; farms: { farm_id: string; name: string; role: Role }[]
}
export type AuditAction = 'insert' | 'update' | 'delete'
/** One change made by a user (activity log). `changes`: the row for insert/delete, {column: [old, new]} for update. */
export type AuditEntry = {
  id: number; at: string; farm_id: string | null; farm_name: string; action: AuditAction
  entity: string; row_id: string | null; label: string; changes: { [key: string]: Json | undefined }
}
export type AuditLogRow = AuditEntry & { user_id: string | null; user_email: string; user_name: string }
export type FarmMember = { farm_id: string; user_id: string; role: Role; display_name: string; prefs: MemberPrefs; created_at: string }
export type FarmInvite = { id: string; farm_id: string; email: string; name: string; role: Role; invited_by: string | null; accepted_at: string | null; created_at: string }
export type PenRole = 'maternidade' | 'gestacao' | 'creche' | 'recria' | 'engorda' | 'varrasco' | 'quarentena' | 'enfermaria' | 'outro'
export type Pen = {
  id: string; farm_id: string; name: string; kind: string
  /** Optional: null means no limit. */
  capacity: number | null
  sort: number; created_at: string
  role: PenRole
  /** Overrides of the role's colour/icon. */
  color: string | null; icon: string | null
  /** Place and size on the farm layout, in grid units. */
  x: number; y: number; w: number; h: number
  /** "Vedado": not available for use; takes no animals. */
  blocked: boolean; blocked_reason: string
}
export type Animal = {
  id: string; farm_id: string; tag: string; pen_id: string | null; sex: Sex; stage: Stage; breed: string; born_on: string | null
  weight_kg: number; status: string; tone: Tone; parents: string; notes: string; photo_path: string | null
  withdrawal_until: string | null; removed_at: string | null; removed_reason: 'death' | 'sale' | null; created_at: string
}
export type FarmEvent = {
  id: string; farm_id: string; event_date: string; kind: EventKind; title: string; detail: string; animal_id: string | null
  pen_id: string | null; meta: Json; show_in_calendar: boolean; created_by: string | null; created_by_name: string; created_at: string
}
export type AnimalPhoto = {
  id: string; farm_id: string; animal_id: string; path: string; taken_on: string; note: string; created_by: string | null; created_at: string
}
export type Weight = { id: string; farm_id: string; animal_id: string; measured_on: string; kg: number; created_at: string }
export type Task = {
  id: string; farm_id: string; title: string; location: string; pen_id: string | null; due_date: string; due_time: string | null
  assignee: string; action: string | null; done_at: string | null; done_by: string | null; created_at: string
}
export type NotificationResolution = { farm_id: string; user_id: string; alert_key: string; resolved_at: string }
export type StockItem = {
  id: string; farm_id: string; code: string; name: string; unit: string; qty: number; max_qty: number; low_qty: number
  note: string; expires_on: string | null; category: string; unit_price: number | null; active: boolean; created_at: string
  /** Unit names come from the category (plural in `unit`). */
  unit_singular: string
  /** Validity in days after each purchase; `expires_on` is derived from it. */
  shelf_life_days: number | null
}
export type StockMovement = {
  id: string; farm_id: string; item_id: string; moved_on: string; reason: string; delta: number; qty_after: number
  note: string; created_by: string | null; created_by_name: string; created_at: string
}
export type TreatmentProduct = {
  id: string; farm_id: string; code: string; name: string; dose_ml: number | null; per_kg: number | null
  dose_text: string; route: string; withdrawal_days: number; stock_code: string | null
  help_kind: 'art' | 'pb'; help_slug: string; active: boolean; created_at: string
}
export type Breed = { id: string; farm_id: string; name: string; active: boolean; created_at: string }
export type Symptom = { id: string; farm_id: string; name: string; icon: string; active: boolean; created_at: string }
export type Account = { id: string; farm_id: string; name: string; kind: AccountKind; holder: string; initial_balance: number; color: string; active: boolean; created_at: string }
export type Category = { id: string; farm_id: string; name: string; grp: CategoryGroup; color: string; description: string; item_type: 'Serviço' | 'Produto'; quantity_unit: string; quantity_unit_singular: string; baseline_price: number | null; active: boolean; created_at: string }
export type Batch = {
  id: string; farm_id: string; code: string; phase: string; head_count: number; active: boolean
  opening_cost: number; opening_revenue: number; started_on: string | null; created_at: string
}
export type Transaction = {
  id: string; farm_id: string; tx_date: string; title: string; account_id: string; kind: TxKind; category: string; amount: number
  quantity: number | null; quantity_unit: string | null; unit_price: number | null
  batch_id: string | null; batch_ids: string[]; batch_allocations: Json; stock_quantity: number | null
  notes: string; source: string | null; source_id: string | null; created_by: string | null
  created_by_name: string; created_at: string
}
export type TransactionFile = { id: string; farm_id: string; transaction_id: string; path: string; name: string; size_bytes: number; mime: string; created_at: string }
export type RecurringExpense = {
  id: string; farm_id: string; name: string; cost_type: 'Fixo' | 'Variável'; category: string; account_id: string; splits: Split[]
  amount: number; frequency: Frequency; next_due: string; active: boolean; created_at: string
}
export type Debt = {
  id: string; farm_id: string; creditor: string; description: string; total: number; paid: number; installment: number
  next_due: string | null; account_id: string; splits: Split[]; created_at: string
}
export type Parameter = { id: string; farm_id: string; key: string; name: string; grp: ParamGroup; value: number; unit: string; description: string; created_at: string }
export type HelpCategory = 'Saúde' | 'Reprodução' | 'Alimentação' | 'Maneio' | 'Usar o Suino Gestor'
export type HelpCtaTarget = 'birth' | 'illness' | 'transfer' | 'mating' | 'treatment' | 'weight' | 'death' | 'sale' | 'expense' | 'purchase' | 'buyAnimals' | 'activity' | 'settings' | 'reports'
export type HelpImage = { src: string; caption: string; credit: string; source: string }
export type HelpSection = { h: string; p?: string[]; list?: string[]; steps?: [string, string][]; tip?: string; img?: HelpImage }
export type HelpExample = { title: string; intro: string; steps: [string, string][] }
export type HelpDoc = {
  id: string; kind: 'guide' | 'article'; cat: HelpCategory; title: string; blurb: string; icon: string; mins: number; lead: string
  facts: [string, string][]; sections: HelpSection[]; example: HelpExample | null; warn: string[]
  cta_label: string | null; cta_target: HelpCtaTarget | null; hero_url: string | null; hero_alt: string; hero_credit: string; hero_source: string | null
  sort: number; published: boolean; search_text: string; updated_at: string
}
export type AccountBalance = { id: string; farm_id: string; name: string; initial_balance: number; balance: number; tx_count: number }
export type BatchResult = { id: string; farm_id: string; code: string; phase: string; head_count: number; active: boolean; cost: number; revenue: number }

type Auto = 'id' | 'created_at'
type Table<R, Optional extends keyof R = never> = {
  Row: R
  Insert: Omit<R, Auto | Optional> & Partial<Pick<R, Extract<Auto, keyof R> | Optional>>
  Update: Partial<R>
  Relationships: []
}
type View<R> = { Row: R; Relationships: [] }
type Fn<A, R> = { Args: A; Returns: R }
type By = { p_date?: string; p_by?: string }

export type Database = {
  public: {
    Tables: {
      profiles: Table<Profile, 'full_name' | 'email' | 'avatar_url' | 'disabled_at'>
      audit_log: Table<AuditLogRow, 'id' | 'at' | 'user_id' | 'user_email' | 'user_name' | 'farm_id' | 'farm_name' | 'row_id' | 'label' | 'changes'>
      farms: Table<Farm, 'currency' | 'units' | 'created_by'>
      farm_members: Table<FarmMember, 'display_name' | 'prefs'>
      farm_invites: Table<FarmInvite, 'name' | 'invited_by' | 'accepted_at'>
      pens: Table<Pen, 'kind' | 'capacity' | 'sort' | 'role' | 'color' | 'icon' | 'x' | 'y' | 'w' | 'h' | 'blocked' | 'blocked_reason'>
      animals: Table<Animal, 'pen_id' | 'sex' | 'breed' | 'born_on' | 'weight_kg' | 'status' | 'tone' | 'parents' | 'notes' | 'photo_path' | 'withdrawal_until' | 'removed_at' | 'removed_reason'>
      events: Table<FarmEvent, 'detail' | 'animal_id' | 'pen_id' | 'meta' | 'show_in_calendar' | 'created_by' | 'created_by_name'>
      weights: Table<Weight>
      animal_photos: Table<AnimalPhoto, 'taken_on' | 'note' | 'created_by'>
      tasks: Table<Task, 'location' | 'pen_id' | 'due_time' | 'assignee' | 'action' | 'done_at' | 'done_by'>
      notification_resolutions: Table<NotificationResolution, 'resolved_at'>
      stock_items: Table<StockItem, 'code' | 'unit' | 'unit_singular' | 'shelf_life_days' | 'qty' | 'max_qty' | 'low_qty' | 'note' | 'expires_on' | 'category' | 'unit_price' | 'active'>
      stock_movements: Table<StockMovement, 'moved_on' | 'note' | 'created_by' | 'created_by_name'>
      treatment_products: Table<TreatmentProduct, 'dose_ml' | 'per_kg' | 'dose_text' | 'route' | 'withdrawal_days' | 'stock_code' | 'help_kind' | 'help_slug' | 'active'>
      breeds: Table<Breed, 'active'>
      symptoms: Table<Symptom, 'icon' | 'active'>
      accounts: Table<Account, 'holder' | 'initial_balance' | 'color' | 'active'>
      categories: Table<Category, 'color' | 'description' | 'item_type' | 'quantity_unit' | 'quantity_unit_singular' | 'baseline_price' | 'active'>
      batches: Table<Batch, 'phase' | 'head_count' | 'active' | 'opening_cost' | 'opening_revenue' | 'started_on'>
      transactions: Table<Transaction, 'quantity' | 'quantity_unit' | 'unit_price' | 'batch_id' | 'batch_ids' | 'batch_allocations' | 'stock_quantity' | 'notes' | 'source' | 'source_id' | 'created_by' | 'created_by_name'>
      transaction_files: Table<TransactionFile, 'size_bytes' | 'mime'>
      recurring_expenses: Table<RecurringExpense, 'cost_type' | 'splits' | 'active'>
      debts: Table<Debt, 'description' | 'paid' | 'next_due' | 'splits'>
      parameters: Table<Parameter, 'unit' | 'description'>
      help_docs: Table<HelpDoc, 'id' | 'blurb' | 'icon' | 'mins' | 'lead' | 'facts' | 'sections' | 'example' | 'warn' | 'cta_label' | 'cta_target' | 'hero_url' | 'hero_alt' | 'hero_credit' | 'hero_source' | 'sort' | 'published' | 'search_text' | 'updated_at'>
    }
    Views: {
      account_balances: View<AccountBalance>
      batch_results: View<BatchResult>
    }
    Functions: {
      create_farm: Fn<{ p_name: string; p_demo?: boolean }, string>
      is_super_admin: Fn<Record<string, never>, boolean>
      admin_create_farm: Fn<{ p_name: string; p_owner_email?: string | null; p_demo?: boolean }, string>
      admin_farms: Fn<Record<string, never>, AdminFarm[]>
      admin_users: Fn<Record<string, never>, AdminUser[]>
      admin_set_user_active: Fn<{ p_user: string; p_active: boolean }, undefined>
      admin_delete_user: Fn<{ p_user: string }, undefined>
      admin_user_activity: Fn<{ p_user: string; p_query?: string; p_action?: AuditAction | null; p_entity?: string | null; p_sort?: 'new' | 'old' | 'entity'; p_offset?: number; p_limit?: number }, (AuditEntry & { total: number })[]>
      accept_invites: Fn<Record<string, never>, number>
      update_my_membership: Fn<{ p_farm: string; p_prefs?: Json; p_display_name?: string }, undefined>
      log_treatment: Fn<{ p_farm: string; p_animal_ids: string[]; p_product: string; p_product_name: string; p_withdrawal_days?: number; p_stock_code?: string } & By, number>
      log_illness: Fn<{ p_farm: string; p_animal: string; p_symptoms: string[]; p_severity?: string; p_isolate?: boolean; p_notes?: string } & By, undefined>
      register_animals: Fn<{ p_farm: string; p_pen: string; p_animals: Json } & By, string[]>
      log_weight: Fn<{ p_farm: string; p_animal: string; p_kg: number } & By, undefined>
      log_transfer: Fn<{ p_farm: string; p_animal: string | null; p_from: string | null; p_to: string; p_animals?: string[] | null } & By, number>
      log_birth: Fn<{ p_farm: string; p_sow: string; p_live: number; p_dead?: number } & By, number>
      log_mating: Fn<{ p_farm: string; p_sow: string; p_method?: string; p_boar?: string } & By, string>
      log_death: Fn<{ p_farm: string; p_animal: string; p_cause?: string } & By, undefined>
      log_sale: Fn<{ p_farm: string; p_animal: string; p_kg: number; p_price_per_kg: number; p_buyer: string; p_account: string; p_batch?: string } & By, number>
      buy_animals: Fn<{ p_farm: string; p_qty: number; p_stage: string; p_sex: string; p_breed: string; p_kg: number; p_pen: string; p_born: string; p_supplier: string; p_price: number; p_account: string } & By, string[]>
      log_stock_purchase: Fn<{ p_farm: string; p_item: string; p_qty: number; p_price: number; p_supplier: string; p_account: string } & By, number>
      move_stock: Fn<{ p_farm: string; p_item: string; p_kind: 'in' | 'out'; p_qty: number; p_reason: string; p_note?: string; p_price?: number | null; p_account?: string | null; p_supplier?: string } & By, number>
      count_stock: Fn<{ p_farm: string; p_item: string; p_count: number; p_note?: string } & By, number>
      pay_recurring: Fn<{ p_id: string; p_date?: string }, string>
      pay_debt: Fn<{ p_id: string; p_amount?: number; p_date?: string }, number>
      search_help: Fn<{ p_query?: string; p_cat?: string | null }, Json>
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type RpcName = keyof Database['public']['Functions']
export type RpcArgs<N extends RpcName> = Database['public']['Functions'][N]['Args']
