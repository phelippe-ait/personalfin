import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "../../components/Icon";
import {
  categoryIcons,
  defaultCategories,
  formatDay,
  formatMoney,
  formatMonth,
  getToday,
} from "./utils";
import type { Entry, EntryType, Page } from "./types";
import {
  deleteWalletEntry,
  loadWalletData,
  migrateLegacyData,
  renameWalletCategory,
  saveWalletCategory,
  saveWalletEntry,
  saveWalletEntries,
} from "./data";

type WalletAppProps = {
  userId: string;
  userEmail: string;
  onSignOut: () => Promise<unknown>;
};

type RepeatFrequency = "weekly" | "fortnightly" | "monthly";
const fixedExpenseOccurrences = 12;

function getRepeatDate(startDate: string, frequency: RepeatFrequency, index: number) {
  const [year, month, day] = startDate.split("-").map(Number);
  if (frequency === "monthly") {
    const monthIndex = month - 1 + index;
    const targetYear = year + Math.floor(monthIndex / 12);
    const targetMonth = monthIndex % 12;
    const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
    return `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
  }

  const interval = frequency === "weekly" ? 7 : 14;
  const nextDate = new Date(Date.UTC(year, month - 1, day + interval * index));
  return `${nextDate.getUTCFullYear()}-${String(nextDate.getUTCMonth() + 1).padStart(2, "0")}-${String(nextDate.getUTCDate()).padStart(2, "0")}`;
}

function walletErrorMessage(error: unknown, fallback: string) {
  const details =
    error && typeof error === "object"
      ? (error as { code?: unknown; message?: unknown }).message
      : undefined;
  const code =
    error && typeof error === "object"
      ? (error as { code?: unknown }).code
      : undefined;
  const message =
    typeof details === "string"
      ? details
      : error instanceof Error
        ? error.message
        : "";

  if (
    code === "42P01" ||
    code === "PGRST205" ||
    /wallet_(entries|categories).*(does not exist|not find|schema cache)/i.test(
      message,
    )
  ) {
    return "Wallet database tables are missing. Run supabase/migrations/0005_wallet_tables.sql in your Supabase SQL Editor, then reload the app.";
  }
  if (
    code === "42703" ||
    code === "PGRST204" ||
    /column .*details.*(does not exist|schema cache)/i.test(message)
  ) {
    return "The wallet details field is missing from the database. Run supabase/migrations/0006_wallet_entry_details.sql in your Supabase SQL Editor, then reload the app.";
  }

  return message || fallback;
}

export default function WalletApp({
  userId,
  userEmail,
  onSignOut,
}: WalletAppProps) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [categoryOptions, setCategoryOptions] =
    useState<string[]>(defaultCategories);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [page, setPage] = useState<Page>("home");
  const [amount, setAmount] = useState("");
  const [details, setDetails] = useState("");
  const [type, setType] = useState<EntryType>("expense");
  const [fixedExpenseEnabled, setFixedExpenseEnabled] = useState(false);
  const [fixedExpenseFrequency, setFixedExpenseFrequency] = useState<RepeatFrequency>("monthly");
  const [instalmentsEnabled, setInstalmentsEnabled] = useState(false);
  const [instalmentFrequency, setInstalmentFrequency] = useState<"weekly" | "fortnightly" | "monthly">("weekly");
  const [instalmentCount, setInstalmentCount] = useState("3");
  const [date, setDate] = useState(getToday());
  const [category, setCategory] = useState("Food");
  const [newCategory, setNewCategory] = useState("");
  const [settingsCategory, setSettingsCategory] = useState("");
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [categoryDraft, setCategoryDraft] = useState("");
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const numericAmount = Number.parseFloat(amount);
  const numberOfInstalments = Number.parseInt(instalmentCount, 10);

  useEffect(() => {
    let cancelled = false;
    const initialize = async () => {
      setLoading(true);
      setDataError("");
      try {
        await migrateLegacyData(userId);
        const data = await loadWalletData(userId);
        if (!cancelled) {
          setEntries(data.entries);
          setCategoryOptions(data.categories);
        }
      } catch (error) {
        if (!cancelled) {
          setDataError(walletErrorMessage(error, "Could not load wallet data."));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void initialize();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    document.body.style.overflow =
      sheetOpen || selectedEntryId ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [sheetOpen, selectedEntryId]);

  const postedEntries = useMemo(
    () =>
      entries.filter(
        (entry) =>
          entry.confirmed === true ||
          (entry.confirmed !== false && entry.date <= getToday()),
      ),
    [entries],
  );

  const upcomingEntries = useMemo(
    () =>
      entries
        .filter(
          (entry) =>
            entry.confirmed === false ||
            (entry.confirmed !== true && entry.date > getToday()),
        )
        .slice()
        .sort((a, b) => a.date.localeCompare(b.date)),
    [entries],
  );

  const selectedEntry =
    entries.find((entry) => entry.id === selectedEntryId) || null;
  const selectedEntryIsUpcoming = selectedEntry
    ? upcomingEntries.some((entry) => entry.id === selectedEntry.id)
    : false;

  const totals = useMemo(
    () =>
      postedEntries.reduce(
        (sum, entry) => {
          sum[entry.type] += entry.amount;
          return sum;
        },
        { expense: 0, income: 0 },
      ),
    [postedEntries],
  );

  const groupedEntries = useMemo(() => {
    return postedEntries
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date))
      .reduce<Record<string, Entry[]>>((groups, entry) => {
        (groups[entry.date] ||= []).push(entry);
        return groups;
      }, {});
  }, [postedEntries]);

  const monthlyCategories = useMemo(() => {
    const months = postedEntries.reduce<
      Record<
        string,
        {
          categories: Record<
            string,
            { count: number; expense: number; income: number }
          >;
          expense: number;
          income: number;
        }
      >
    >((groups, entry) => {
      const month = entry.date.slice(0, 7);
      groups[month] ||= { categories: {}, expense: 0, income: 0 };
      groups[month].categories[entry.category] ||= {
        count: 0,
        expense: 0,
        income: 0,
      };
      groups[month][entry.type] += entry.amount;
      groups[month].categories[entry.category][entry.type] += entry.amount;
      groups[month].categories[entry.category].count += 1;
      return groups;
    }, {});

    return Object.entries(months)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([month, summary]) => ({
        month,
        ...summary,
        categories: Object.entries(summary.categories).sort(
          ([, a], [, b]) =>
            b.expense + b.income - (a.expense + a.income),
        ),
      }));
  }, [postedEntries]);

  const openSheet = () => {
    setEditingEntryId(null);
    setAmount("");
    setDetails("");
    setType("expense");
    setFixedExpenseEnabled(false);
    setFixedExpenseFrequency("monthly");
    setInstalmentsEnabled(false);
    setInstalmentFrequency("weekly");
    setInstalmentCount("3");
    setDate(getToday());
    setCategory(categoryOptions[0] || "Other");
    setNewCategory("");
    setSheetOpen(true);
  };

  const addCategory = async (value: string) => {
    const name = value.trim();
    if (
      !name ||
      categoryOptions.some(
        (option) => option.toLocaleLowerCase() === name.toLocaleLowerCase(),
      )
    ) {
      return false;
    }
    try {
      await saveWalletCategory(userId, name);
      setCategoryOptions((current) => [...current, name]);
      setDataError("");
      return true;
    } catch (error) {
      setDataError(walletErrorMessage(error, "Could not save category."));
      return false;
    }
  };

  const saveCategoryName = async () => {
    if (!editingCategory) return;
    const name = categoryDraft.trim();
    if (
      !name ||
      categoryOptions.some(
        (option) =>
          option !== editingCategory &&
          option.toLocaleLowerCase() === name.toLocaleLowerCase(),
      )
    ) {
      return;
    }
    try {
      await renameWalletCategory(userId, editingCategory, name);
    } catch (error) {
      setDataError(walletErrorMessage(error, "Could not rename category."));
      return;
    }
    setCategoryOptions((current) =>
      current.map((option) => (option === editingCategory ? name : option)),
    );
    setEntries((current) =>
      current.map((entry) =>
        entry.category === editingCategory
          ? { ...entry, category: name }
          : entry,
      ),
    );
    if (category === editingCategory) setCategory(name);
    setEditingCategory(null);
    setCategoryDraft("");
  };

  const openEditSheet = (entry: Entry) => {
    setEditingEntryId(entry.id);
    setAmount(entry.amount.toFixed(2));
    setDetails(entry.details ?? "");
    setType(entry.type);
    setFixedExpenseEnabled(false);
    setInstalmentsEnabled(false);
    setDate(entry.date);
    setCategory(entry.category);
    setSelectedEntryId(null);
    setSheetOpen(true);
  };

  const saveEntry = async () => {
    if (!numericAmount || numericAmount <= 0) return;

    if (
      instalmentsEnabled &&
      (type !== "expense" || !Number.isInteger(numberOfInstalments) || numberOfInstalments < 2 || numberOfInstalments > 60)
    ) return;

    if (fixedExpenseEnabled && type !== "expense") return;

    const entriesToSave: Entry[] = fixedExpenseEnabled
      ? Array.from({ length: fixedExpenseOccurrences }, (_, index) => {
          const occurrenceDate = getRepeatDate(date, fixedExpenseFrequency, index);
          return {
            id: crypto.randomUUID(),
            amount: numericAmount,
            type: "expense",
            date: occurrenceDate,
            category,
            confirmed: occurrenceDate <= getToday(),
            details,
          };
        })
      : instalmentsEnabled
      ? (() => {
          const totalCents = Math.round(numericAmount * 100);
          const baseCents = Math.floor(totalCents / numberOfInstalments);
          const extraCents = totalCents % numberOfInstalments;
          return Array.from({ length: numberOfInstalments }, (_, index) => {
            const installmentDate = getRepeatDate(date, instalmentFrequency, index);
            return {
              id: crypto.randomUUID(),
              amount: (baseCents + (index < extraCents ? 1 : 0)) / 100,
              type: "expense" as const,
              date: installmentDate,
              category,
              confirmed: installmentDate <= getToday(),
              details,
            };
          });
        })()
      : [{
          ...(editingEntryId
            ? entries.find((entry) => entry.id === editingEntryId)
            : undefined),
          id: editingEntryId || crypto.randomUUID(),
          amount: numericAmount,
          type,
          date,
          category,
          details,
          confirmed: date <= getToday(),
        }];

    try {
      if (instalmentsEnabled || fixedExpenseEnabled) {
        await saveWalletEntries(userId, entriesToSave);
      } else {
        await saveWalletEntry(userId, entriesToSave[0]);
      }
      setEntries((current) =>
        editingEntryId
          ? current.map((entry) =>
              entry.id === editingEntryId ? entriesToSave[0] : entry,
            )
          : [...current, ...entriesToSave],
      );
      setDataError("");
    } catch (error) {
      setDataError(walletErrorMessage(error, "Could not save transaction."));
      return;
    }
    setEditingEntryId(null);
    setSheetOpen(false);
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    if (!touchStart.current || sheetOpen || selectedEntryId) return;
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - touchStart.current.x;
    const deltaY = touch.clientY - touchStart.current.y;
    if (Math.abs(deltaX) > 65 && Math.abs(deltaX) > Math.abs(deltaY) * 1.3) {
      if (page === "home") {
        setPage(deltaX > 0 ? "history" : "categories");
      } else if (
        (page === "history" && deltaX < 0) ||
        (page === "categories" && deltaX > 0) ||
        (page === "settings" && deltaX < 0)
      ) {
        setPage("home");
      }
    } else if (
      Math.abs(deltaY) > 65 &&
      Math.abs(deltaY) > Math.abs(deltaX) * 1.3
    ) {
      if (page === "home" && deltaY < 0) setPage("upcoming");
      if (page === "upcoming" && deltaY > 0) setPage("home");
    }
    touchStart.current = null;
  };

  const pageClass = (target: Page) => {
    if (page === target) return "page-active";
    if (target === "upcoming") return "page-down";
    if (page === "upcoming") return "page-up";
    const positions: Record<Page, number> = {
      history: -1,
      home: 0,
      categories: 1,
      settings: -1,
      upcoming: 0,
    };
    return positions[target] < positions[page] ? "page-right" : "page-left";
  };

  if (loading) {
    return (
      <main className="grid min-h-[100dvh] place-items-center bg-[#e8e8e4] text-sm text-[#777772]">
        Loading your wallet…
      </main>
    );
  }

  return (
    <main
      className="app-shell"
      onTouchEnd={handleTouchEnd}
      onTouchStart={(event) => {
        const touch = event.touches[0];
        touchStart.current = { x: touch.clientX, y: touch.clientY };
      }}
    >
      <div className="noise" />
      {dataError && (
        <div
          className="fixed top-3 right-3 left-3 z-50 mx-auto max-w-lg rounded-xl border border-red-200 bg-white px-4 py-3 text-sm text-red-800 shadow-lg"
          role="alert"
        >
          {dataError}
        </div>
      )}

      <section
        aria-hidden={page !== "home"}
        className={`page home-page ${pageClass("home")}`}
      >
        <header className="topbar">
          <div>
            <p className="eyebrow">My wallet</p>
            <h1>Overview</h1>
          </div>
          <button
            aria-label="Open settings"
            className="round-button"
            onClick={() => setPage("settings")}
            type="button"
          >
            <Icon name="settings" />
          </button>
        </header>

        <div className="relative isolate mt-6 mb-6 flex min-h-[42dvh] flex-col items-center justify-center overflow-hidden rounded-[34px] border border-black/[0.07] bg-white/55 px-6 py-10 text-center shadow-[0_24px_60px_rgba(20,20,18,0.09),inset_0_1px_rgba(255,255,255,0.9)] backdrop-blur-2xl">
          <span className="pointer-events-none absolute -top-20 left-1/2 -z-10 h-64 w-64 -translate-x-1/2 rounded-full bg-white blur-3xl" />
          <p className="mb-3 text-[0.65rem] font-bold tracking-[0.15em] text-[#777772] uppercase">
            Available balance
          </p>
          <p className="mb-9 text-[clamp(2.8rem,14vw,4.25rem)] leading-none font-semibold tracking-[-0.07em] text-[#10100f]">
            {formatMoney(totals.income - totals.expense)}
          </p>
          <button
            className="group flex min-w-44 items-center gap-3 rounded-full bg-[#10100f] py-3 pr-6 pl-3 text-left text-white shadow-[0_16px_32px_rgba(16,16,15,0.22),inset_0_1px_rgba(255,255,255,0.16)] transition-transform duration-200 active:scale-[0.96]"
            onClick={openSheet}
            type="button"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-2xl font-normal text-[#10100f]">
              +
            </span>
            <span className="flex flex-col">
              <small className="mb-0.5 text-[0.58rem] font-semibold tracking-[0.1em] text-white/55 uppercase">
                Quick add
              </small>
              <strong className="text-xl leading-none font-semibold tracking-[-0.04em]">
                $0.00
              </strong>
            </span>
          </button>
          <p className="mt-5 flex items-center gap-2 text-[0.68rem] font-semibold text-[#777772]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#10100f]" />
            {upcomingEntries.length
              ? `${upcomingEntries.length} ${
                  upcomingEntries.length === 1 ? "transaction" : "transactions"
                } upcoming`
              : "You're all caught up"}
          </p>
        </div>

        <div className="summary-card">
          <div className="summary-heading">
            <div>
              <p className="eyebrow">This month</p>
              <h2>Cash flow</h2>
            </div>
            <span className="entry-count">
              {postedEntries.length}{" "}
              {postedEntries.length === 1 ? "entry" : "entries"}
            </span>
          </div>
          <div className="summary-grid">
            <div className="summary-cell">
              <span className="summary-mark">↙</span>
              <div>
                <p>Income</p>
                <strong>{formatMoney(totals.income)}</strong>
              </div>
            </div>
            <div className="summary-cell">
              <span className="summary-mark dark">↗</span>
              <div>
                <p>Spent</p>
                <strong>{formatMoney(totals.expense)}</strong>
              </div>
            </div>
          </div>
        </div>

        <button
          className="upcoming-cue"
          onClick={() => setPage("upcoming")}
          type="button"
        >
          <span className="upcoming-arrow">
            <Icon name="arrow-right" size={16} />
          </span>
          <span>
            <strong>Upcoming</strong>
            <small>
              {upcomingEntries.length
                ? `${upcomingEntries.length} scheduled`
                : "Swipe up to view"}
            </small>
          </span>
          <span className="upcoming-count">{upcomingEntries.length}</span>
        </button>

        <nav aria-label="Overview pages" className="swipe-nav">
          <button onClick={() => setPage("categories")} type="button">
            <Icon name="arrow-left" size={15} />
            <span>Categories</span>
          </button>
          <span className="swipe-divider" />
          <button onClick={() => setPage("history")} type="button">
            <span>History</span>
            <Icon name="arrow-right" size={15} />
          </button>
        </nav>
      </section>

      <section
        aria-hidden={page !== "history"}
        className={`page history-page ${pageClass("history")}`}
      >
        <header className="topbar">
          <button
            aria-label="Back to overview"
            className="round-button"
            onClick={() => setPage("home")}
            type="button"
          >
            <Icon name="arrow-left" />
          </button>
          <button className="text-button" onClick={openSheet} type="button">
            Add new
          </button>
        </header>

        <div className="history-title">
          <p className="eyebrow">Your activity</p>
          <h1>All entries</h1>
          <p>
            {postedEntries.length
              ? `${postedEntries.length} transactions, ordered by date.`
              : "Your transactions will live here."}
          </p>
        </div>

        <div className="history-list">
          {postedEntries.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <Icon name="arrow" size={26} />
              </div>
              <h2>Nothing here yet</h2>
              <p>Add your first expense or income to start your timeline.</p>
              <button onClick={openSheet} type="button">
                Add a transaction
              </button>
            </div>
          ) : (
            Object.entries(groupedEntries).map(([groupDate, group]) => (
              <div className="date-group" key={groupDate}>
                <div className="date-heading">
                  <span>{formatDay(groupDate)}</span>
                  <span>
                    {formatMoney(
                      group.reduce(
                        (sum, entry) =>
                          sum +
                          (entry.type === "income"
                            ? entry.amount
                            : -entry.amount),
                        0,
                      ),
                    )}
                  </span>
                </div>
                <div className="entries-card">
                  {group.map((entry) => (
                    <button
                      className="entry-row history-entry"
                      key={entry.id}
                      onClick={() => setSelectedEntryId(entry.id)}
                      type="button"
                    >
                      <span className="category-icon">
                        <Icon
                          name={categoryIcons[entry.category] || "circle"}
                          size={20}
                        />
                      </span>
                      <div className="entry-copy">
                        <strong>{entry.category}</strong>
                        <span>
                          {entry.type === "income" ? "Income" : "Expense"}
                        </span>
                      </div>
                      <strong
                        className={`entry-amount ${entry.type === "income" ? "income" : ""}`}
                      >
                        {entry.type === "income" ? "+" : "−"}
                        {formatMoney(entry.amount)}
                      </strong>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section
        aria-hidden={page !== "categories"}
        className={`page categories-page ${pageClass("categories")}`}
      >
        <header className="topbar">
          <button
            aria-label="Back to overview"
            className="round-button"
            onClick={() => setPage("home")}
            type="button"
          >
            <Icon name="arrow-right" />
          </button>
          <button className="text-button" onClick={openSheet} type="button">
            Add new
          </button>
        </header>

        <div className="history-title">
          <p className="eyebrow">Monthly view</p>
          <h1>Categories</h1>
          <p>See where your money goes, month by month.</p>
        </div>

        <div className="category-history">
          {monthlyCategories.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <Icon name="circle" size={26} />
              </div>
              <h2>No category totals yet</h2>
              <p>Add a transaction to start building your monthly overview.</p>
              <button onClick={openSheet} type="button">
                Add a transaction
              </button>
            </div>
          ) : (
            monthlyCategories.map((summary) => (
              <div className="month-group" key={summary.month}>
                <div className="month-heading">
                  <div>
                    <p className="eyebrow">Monthly breakdown</p>
                    <h2>{formatMonth(summary.month)}</h2>
                  </div>
                  <div className="month-totals">
                    <span>Spent {formatMoney(summary.expense)}</span>
                    <span>In {formatMoney(summary.income)}</span>
                  </div>
                </div>
                <div className="entries-card">
                  {summary.categories.map(([name, categorySummary]) => (
                    <div className="entry-row category-total-row" key={name}>
                      <span className="category-icon">
                        <Icon
                          name={categoryIcons[name] || "circle"}
                          size={20}
                        />
                      </span>
                      <div className="entry-copy">
                        <strong>{name}</strong>
                        <span>
                          {categorySummary.count}{" "}
                          {categorySummary.count === 1
                            ? "transaction"
                            : "transactions"}
                        </span>
                      </div>
                      <div className="category-sums">
                        {categorySummary.expense > 0 && (
                          <strong>
                            −{formatMoney(categorySummary.expense)}
                          </strong>
                        )}
                        {categorySummary.income > 0 && (
                          <span>+{formatMoney(categorySummary.income)}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section
        aria-hidden={page !== "settings"}
        className={`page settings-page ${pageClass("settings")}`}
      >
        <header className="topbar">
          <button
            aria-label="Back to overview"
            className="round-button"
            onClick={() => setPage("home")}
            type="button"
          >
            <Icon name="arrow-left" />
          </button>
          <div className="flex items-center gap-3">
            <span className="settings-count">
              {categoryOptions.length} categories
            </span>
            <button
              className="text-button"
              onClick={() => void onSignOut()}
              title={userEmail}
              type="button"
            >
              Sign out
            </button>
          </div>
        </header>

        <div className="history-title">
          <p className="eyebrow">Preferences</p>
          <h1>Settings</h1>
          <p>Personalize the categories used across your wallet.</p>
        </div>

        <div className="settings-card">
          <div className="settings-card-heading">
            <div>
              <p className="eyebrow">Your list</p>
              <h2>Categories</h2>
            </div>
            <span>Tap edit to rename</span>
          </div>

          <div className="settings-category-list">
            {categoryOptions.map((item) => (
              <div className="settings-category-row" key={item}>
                <span className="category-icon">
                  <Icon
                    name={categoryIcons[item] || "circle"}
                    size={19}
                  />
                </span>
                {editingCategory === item ? (
                  <>
                    <input
                      aria-label={`Rename ${item}`}
                      autoFocus
                      maxLength={24}
                      onChange={(event) => setCategoryDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") saveCategoryName();
                        if (event.key === "Escape") setEditingCategory(null);
                      }}
                      value={categoryDraft}
                    />
                    <button onClick={saveCategoryName} type="button">
                      Save
                    </button>
                  </>
                ) : (
                  <>
                    <strong>{item}</strong>
                    <button
                      onClick={() => {
                        setEditingCategory(item);
                        setCategoryDraft(item);
                      }}
                      type="button"
                    >
                      Edit
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        <form
          className="add-category-card"
          onSubmit={(event) => {
            event.preventDefault();
            void addCategory(settingsCategory).then((added) => {
              if (added) setSettingsCategory("");
            });
          }}
        >
          <div>
            <p className="eyebrow">New category</p>
            <h2>Add your own</h2>
          </div>
          <div className="add-category-field">
            <input
              aria-label="New category name"
              maxLength={24}
              onChange={(event) => setSettingsCategory(event.target.value)}
              placeholder="e.g. Subscriptions"
              value={settingsCategory}
            />
            <button disabled={!settingsCategory.trim()} type="submit">
              Add
            </button>
          </div>
        </form>
      </section>

      <section
        aria-hidden={page !== "upcoming"}
        className={`page upcoming-page ${pageClass("upcoming")}`}
      >
        <header className="topbar">
          <button
            aria-label="Back to overview"
            className="round-button down-button"
            onClick={() => setPage("home")}
            type="button"
          >
            <Icon name="arrow-right" />
          </button>
          <button className="text-button" onClick={openSheet} type="button">
            Schedule
          </button>
        </header>

        <div className="history-title">
          <p className="eyebrow">Scheduled activity</p>
          <h1>Upcoming</h1>
          <p>
            Review what is due next, then confirm it when the payment arrives
            or leaves.
          </p>
        </div>

        <div className="upcoming-list">
          {upcomingEntries.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon upcoming-empty-icon">
                <Icon name="calendar" size={25} />
              </div>
              <h2>Nothing scheduled</h2>
              <p>
                Add a transaction with a future date and it will appear here.
              </p>
              <button onClick={openSheet} type="button">
                Schedule a transaction
              </button>
            </div>
          ) : (
            upcomingEntries.map((entry) => (
              <button
                className="upcoming-entry"
                key={entry.id}
                onClick={() => setSelectedEntryId(entry.id)}
                type="button"
              >
                <span className="upcoming-date">
                  <small>
                    {new Intl.DateTimeFormat("en-US", {
                      month: "short",
                    }).format(new Date(`${entry.date}T12:00:00`))}
                  </small>
                  <strong>
                    {new Date(`${entry.date}T12:00:00`).getDate()}
                  </strong>
                </span>
                <span className="category-icon">
                  <Icon
                    name={categoryIcons[entry.category] || "circle"}
                    size={20}
                  />
                </span>
                <span className="upcoming-copy">
                  <strong>{entry.category}</strong>
                  <small>
                    {entry.type === "income" ? "Expected income" : "Payment due"}
                  </small>
                </span>
                <strong className="upcoming-amount">
                  {entry.type === "income" ? "+" : "−"}
                  {formatMoney(entry.amount)}
                </strong>
              </button>
            ))
          )}
        </div>

        <button
          className="down-hint"
          onClick={() => setPage("home")}
          type="button"
        >
          Swipe down for overview
        </button>
      </section>

      {sheetOpen && (
        <div
          aria-label="Add transaction"
          aria-modal="true"
          className="sheet-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSheetOpen(false);
          }}
          role="dialog"
        >
          <div className="sheet">
            <div className="sheet-grabber" />
            <div className="sheet-header">
              <div>
                <p className="eyebrow">
                  {editingEntryId ? "Edit transaction" : "New transaction"}
                </p>
                <h2>{editingEntryId ? "Update entry" : "Add an entry"}</h2>
              </div>
              <button
                aria-label="Close"
                className="close-button"
                onClick={() => {
                  setSheetOpen(false);
                  setEditingEntryId(null);
                }}
                type="button"
              >
                <Icon name="close" />
              </button>
            </div>

            <div className="amount-field">
              <span>$</span>
              <input
                autoFocus
                inputMode="decimal"
                onChange={(event) => {
                  const value = event.target.value;
                  if (/^\d*\.?\d{0,2}$/.test(value)) setAmount(value);
                }}
                placeholder="0.00"
                value={amount}
              />
            </div>

            <label className="details-field">
              <span>Details</span>
              <textarea
                maxLength={160}
                onChange={(event) => setDetails(event.target.value)}
                placeholder="Add a note (optional)"
                rows={2}
                value={details}
              />
            </label>

            <div className="segmented-control grid-cols-3">
              <button
                className={type === "expense" ? "selected" : ""}
                onClick={() => setType("expense")}
                type="button"
              >
                Expense
              </button>
              <button
                className={type === "income" ? "selected" : ""}
                onClick={() => {
                  setType("income");
                  setInstalmentsEnabled(false);
                  setFixedExpenseEnabled(false);
                }}
                type="button"
              >
                Income
              </button>
            </div>

            {!editingEntryId && type === "expense" && (
              <div className="mt-5 rounded-2xl border border-black/[0.08] bg-white/55 p-4">
                <label className="flex cursor-pointer items-center justify-between gap-4">
                  <span>
                    <strong className="block text-sm font-semibold text-[#171715]">
                      Pay in instalments
                    </strong>
                    <small className="mt-1 block text-xs text-[#777772]">
                      Split the total into scheduled expenses
                    </small>
                  </span>
                  <input
                    aria-label="Pay in instalments"
                    checked={instalmentsEnabled}
                    className="h-5 w-5 accent-[#171715]"
                    onChange={(event) => {
                      setInstalmentsEnabled(event.target.checked);
                      if (event.target.checked) setFixedExpenseEnabled(false);
                    }}
                    type="checkbox"
                  />
                </label>
                {instalmentsEnabled && (
                  <div className="mt-4 border-t border-black/[0.08] pt-4">
                    <p className="mb-2 text-xs font-semibold text-[#777772]">
                      Payment frequency
                    </p>
                    <div className="segmented-control">
                      {(["weekly", "fortnightly", "monthly"] as const).map((frequency) => (
                        <button
                          className={instalmentFrequency === frequency ? "selected" : ""}
                          key={frequency}
                          onClick={() => setInstalmentFrequency(frequency)}
                          type="button"
                        >
                          {frequency[0].toUpperCase() + frequency.slice(1)}
                        </button>
                      ))}
                    </div>
                    <label className="mt-4 flex items-center justify-between gap-4 text-sm">
                      <span className="font-medium text-[#171715]">Number of instalments</span>
                      <input
                        aria-label="Number of instalments"
                        className="w-20 rounded-xl border border-black/[0.12] bg-white px-3 py-2 text-center"
                        max={60}
                        min={2}
                        onChange={(event) => setInstalmentCount(event.target.value)}
                        type="number"
                        value={instalmentCount}
                      />
                    </label>
                    <p className="mt-3 text-xs text-[#777772]">
                      {Number.isInteger(numberOfInstalments) && numberOfInstalments >= 2 && numberOfInstalments <= 60
                        ? `${numberOfInstalments} payments of about ${formatMoney(Math.round((Number.parseFloat(amount || "0") * 100) / numberOfInstalments) / 100)}. The first is on the selected date.`
                        : "Choose between 2 and 60 instalments."}
                    </p>
                  </div>
                )}
                <div className="mt-4 border-t border-black/[0.08] pt-4">
                  <label className="flex cursor-pointer items-center justify-between gap-4">
                    <span>
                      <strong className="block text-sm font-semibold text-[#171715]">
                        Fixed expense
                      </strong>
                      <small className="mt-1 block text-xs text-[#777772]">
                        Repeat the same amount on a schedule
                      </small>
                    </span>
                    <input
                      aria-label="Fixed expense"
                      checked={fixedExpenseEnabled}
                      className="h-5 w-5 accent-[#171715]"
                      onChange={(event) => {
                        setFixedExpenseEnabled(event.target.checked);
                        if (event.target.checked) setInstalmentsEnabled(false);
                      }}
                      type="checkbox"
                    />
                  </label>
                  {fixedExpenseEnabled && (
                    <div className="mt-4">
                      <p className="mb-2 text-xs font-semibold text-[#777772]">
                        Repeat frequency
                      </p>
                      <div className="segmented-control">
                        {(["weekly", "fortnightly", "monthly"] as const).map((frequency) => (
                          <button
                            className={fixedExpenseFrequency === frequency ? "selected" : ""}
                            key={frequency}
                            onClick={() => setFixedExpenseFrequency(frequency)}
                            type="button"
                          >
                            {frequency[0].toUpperCase() + frequency.slice(1)}
                          </button>
                        ))}
                      </div>
                      <p className="mt-3 text-xs text-[#777772]">
                        {`Creates ${fixedExpenseOccurrences} scheduled expenses at ${formatMoney(numericAmount || 0)} each.`}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <label className="field-row date-field">
              <span className="field-icon">
                <Icon name="calendar" />
              </span>
              <span className="date-field-copy">
                <small>Date</small>
                <strong>Select transaction date</strong>
              </span>
              <input
                aria-label="Transaction date"
                onChange={(event) => setDate(event.target.value)}
                type="date"
                value={date}
              />
            </label>

            <div className="category-section">
              <p>Category</p>
              <div className="category-grid">
                {categoryOptions.map((item) => (
                  <button
                    className={category === item ? "selected" : ""}
                    key={item}
                    onClick={() => setCategory(item)}
                    type="button"
                  >
                    <span>
                      <Icon name={categoryIcons[item]} size={19} />
                    </span>
                    {item}
                    {category === item && (
                      <i>
                        <Icon name="check" size={12} strokeWidth={2.6} />
                      </i>
                    )}
                  </button>
                ))}
              </div>
              <form
                className="quick-category-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  const name = newCategory.trim();
                  void addCategory(name).then((added) => {
                    if (!added) return;
                    setCategory(name);
                    setNewCategory("");
                  });
                }}
              >
                <input
                  aria-label="Add a new category"
                  maxLength={24}
                  onChange={(event) => setNewCategory(event.target.value)}
                  placeholder="Add a new category"
                  value={newCategory}
                />
                <button disabled={!newCategory.trim()} type="submit">
                  Add
                </button>
              </form>
            </div>

            <button
              className="save-button"
              disabled={
                !Number.parseFloat(amount) ||
                (instalmentsEnabled &&
                  (!Number.isInteger(numberOfInstalments) || numberOfInstalments < 2 || numberOfInstalments > 60))
              }
              onClick={saveEntry}
              type="button"
            >
              {editingEntryId ? "Update transaction" : "Save transaction"}
              <Icon name="arrow-right" />
            </button>
          </div>
        </div>
      )}

      {selectedEntry && (
        <div
          aria-label="Transaction details"
          aria-modal="true"
          className="sheet-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedEntryId(null);
          }}
          role="dialog"
        >
          <div className="sheet detail-sheet">
            <div className="sheet-grabber" />
            <div className="sheet-header">
              <div>
                <p className="eyebrow">
                  {selectedEntryIsUpcoming
                    ? "Confirm transaction"
                    : "Transaction details"}
                </p>
                <h2>{selectedEntry.category}</h2>
              </div>
              <button
                aria-label="Close"
                className="close-button"
                onClick={() => setSelectedEntryId(null)}
                type="button"
              >
                <Icon name="close" />
              </button>
            </div>

            <div className="detail-amount">
              <span>
                {selectedEntry.type === "income" ? "Expected income" : "Expense"}
              </span>
              <strong>{formatMoney(selectedEntry.amount)}</strong>
            </div>

            <div className="detail-card">
              <div>
                <span>Type</span>
                <strong>
                  {selectedEntry.type === "income" ? "Income" : "Expense"}
                </strong>
              </div>
              <div>
                <span>Due date</span>
                <strong>{formatDay(selectedEntry.date)}</strong>
              </div>
              <div>
                <span>Category</span>
                <strong>{selectedEntry.category}</strong>
              </div>
              {selectedEntry.details?.trim() && (
                <div>
                  <span>Details</span>
                  <strong>{selectedEntry.details}</strong>
                </div>
              )}
            </div>

            {selectedEntryIsUpcoming && (
              <p className="confirm-note">
                Confirming will move this transaction into your history and
                include it in your balance.
              </p>
            )}
            <div className="detail-actions">
              <button
                className="edit-button"
                onClick={() => openEditSheet(selectedEntry)}
                type="button"
              >
                Edit transaction
              </button>
              <button
                className="delete-button"
                onClick={async () => {
                  if (
                    window.confirm(
                      "Delete this transaction? This cannot be undone.",
                    )
                  ) {
                    try {
                      await deleteWalletEntry(userId, selectedEntry.id);
                      setEntries((current) =>
                        current.filter((entry) => entry.id !== selectedEntry.id),
                      );
                      setSelectedEntryId(null);
                      setDataError("");
                    } catch (error) {
                      setDataError(walletErrorMessage(error, "Could not delete transaction."));
                    }
                  }
                }}
                type="button"
              >
                Delete
              </button>
            </div>
            {selectedEntryIsUpcoming && (
              <button
                className="save-button"
                onClick={async () => {
                  const confirmedEntry = {
                    ...selectedEntry,
                    confirmed: true,
                    date: getToday(),
                  };
                  try {
                    await saveWalletEntry(userId, confirmedEntry);
                    setEntries((current) =>
                      current.map((entry) =>
                        entry.id === selectedEntry.id ? confirmedEntry : entry,
                      ),
                    );
                    setSelectedEntryId(null);
                    setDataError("");
                  } catch (error) {
                    setDataError(walletErrorMessage(error, "Could not confirm transaction."));
                  }
                }}
                type="button"
              >
                Confirm{" "}
                {selectedEntry.type === "income"
                  ? "income received"
                  : "payment"}
                <Icon name="check" />
              </button>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
