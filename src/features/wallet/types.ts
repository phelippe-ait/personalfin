export type EntryType = "expense" | "income";
export type Page = "categories" | "home" | "history" | "settings" | "upcoming";

export type Entry = {
  id: string;
  amount: number;
  type: EntryType;
  date: string;
  category: string;
  confirmed?: boolean;
};
