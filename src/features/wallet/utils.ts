export const defaultCategories = [
  "Food",
  "Transport",
  "Shopping",
  "Home",
  "Health",
  "Fun",
  "Salary",
  "Other",
];

export const categoryIcons: Record<string, string> = {
  Food: "fork",
  Transport: "arrow",
  Shopping: "bag",
  Home: "home",
  Health: "plus",
  Fun: "spark",
  Salary: "briefcase",
  Other: "circle",
};

export const getToday = () => new Date().toISOString().slice(0, 10);

export const formatMoney = (amount: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);

export const formatDay = (date: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));

export const formatMonth = (month: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date(`${month}-01T12:00:00`));
