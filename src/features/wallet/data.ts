import { defaultCategories, getToday } from "./utils"
import { getSupabase } from "../../lib/supabase"
import type { Entry } from "./types"

type EntryRow = {
  id: string
  amount: number
  type: Entry["type"]
  entry_date: string
  category: string
  confirmed: boolean
}

const migrationKey = "mono-supabase-migrated"

function readLegacy<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key)
    return value ? JSON.parse(value) as T : fallback
  } catch {
    return fallback
  }
}

export async function migrateLegacyData(userId: string) {
  if (localStorage.getItem(migrationKey)) return

  const categories = readLegacy<unknown>("mono-categories", defaultCategories)
  if (
    Array.isArray(categories) &&
    categories.every((item) => typeof item === "string") &&
    categories.length > 0
  ) {
    const { error } = await getSupabase().from("wallet_categories").upsert(
      categories.map((name) => ({ user_id: userId, name: name.trim() })),
      { onConflict: "user_id,name", ignoreDuplicates: true },
    )
    if (error) throw error
  }

  const legacyEntries = readLegacy<unknown>("mono-entries", [])
  if (Array.isArray(legacyEntries)) {
    const entries = legacyEntries.filter(isEntry).map((entry) => ({
      id: isUuid(entry.id) ? entry.id : crypto.randomUUID(),
      user_id: userId,
      amount: entry.amount,
      type: entry.type,
      entry_date: entry.date,
      category: entry.category,
      confirmed: entry.confirmed ?? entry.date <= getToday(),
    }))
    if (entries.length) {
      const { error } = await getSupabase()
        .from("wallet_entries")
        .upsert(entries, { onConflict: "id" })
      if (error) throw error
    }
  }

  localStorage.setItem(migrationKey, userId)
}

function isEntry(value: unknown): value is Entry {
  if (!value || typeof value !== "object") return false
  const entry = value as Partial<Entry>
  return (
    typeof entry.id === "string" &&
    typeof entry.amount === "number" &&
    Number.isFinite(entry.amount) &&
    entry.amount > 0 &&
    (entry.type === "expense" || entry.type === "income") &&
    typeof entry.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(entry.date) &&
    typeof entry.category === "string"
  )
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  )
}

export async function loadWalletData(userId: string) {
  const [entriesResult, categoriesResult] = await Promise.all([
    getSupabase()
      .from("wallet_entries")
      .select("id, amount, type, entry_date, category, confirmed")
      .eq("user_id", userId)
      .order("entry_date", { ascending: false }),
    getSupabase()
      .from("wallet_categories")
      .select("name")
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
  ])
  if (entriesResult.error) throw entriesResult.error
  if (categoriesResult.error) throw categoriesResult.error

  let categories = categoriesResult.data.map((row) => row.name)
  if (categories.length === 0) {
    const { data, error } = await getSupabase()
      .from("wallet_categories")
      .upsert(
        defaultCategories.map((name) => ({ user_id: userId, name })),
        { onConflict: "user_id,name", ignoreDuplicates: true },
      )
      .select("name")
      .order("created_at", { ascending: true })
    if (error) throw error
    categories = data.map((row) => row.name)
  }

  return {
    entries: (entriesResult.data as EntryRow[]).map(
      (row) =>
        ({
          id: row.id,
          amount: Number(row.amount),
          type: row.type,
          date: row.entry_date,
          category: row.category,
          confirmed: row.confirmed,
        }) satisfies Entry,
    ),
    categories,
  }
}

export async function saveWalletEntry(userId: string, entry: Entry) {
  const { error } = await getSupabase().from("wallet_entries").upsert({
    id: entry.id,
    user_id: userId,
    amount: entry.amount,
    type: entry.type,
    entry_date: entry.date,
    category: entry.category,
    confirmed: entry.confirmed ?? false,
  })
  if (error) throw error
}

export async function deleteWalletEntry(userId: string, id: string) {
  const { error } = await getSupabase()
    .from("wallet_entries")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
  if (error) throw error
}

export async function saveWalletCategory(userId: string, name: string) {
  const { error } = await getSupabase()
    .from("wallet_categories")
    .upsert({ user_id: userId, name }, { onConflict: "user_id,name" })
  if (error) throw error
}

export async function renameWalletCategory(
  userId: string,
  oldName: string,
  newName: string,
) {
  const { error: categoryError } = await getSupabase()
    .from("wallet_categories")
    .update({ name: newName })
    .eq("user_id", userId)
    .eq("name", oldName)
  if (categoryError) throw categoryError

  const { error: entriesError } = await getSupabase()
    .from("wallet_entries")
    .update({ category: newName })
    .eq("user_id", userId)
    .eq("category", oldName)
  if (entriesError) throw entriesError
}
