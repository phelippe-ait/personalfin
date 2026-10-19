export const defaultCategories = [
  "Food",
  "Transport",
  "Shopping",
  "Home",
  "Health",
  "Fun",
  "Salary",
  "Other",
]

export const categoryIcons: Record<string, string> = {
  Food: "fork",
  Transport: "arrow",
  Shopping: "bag",
  Home: "home",
  Health: "plus",
  Fun: "spark",
  Salary: "briefcase",
  Other: "circle",
}

export const getToday = () => {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date())
  const part = (type: string) => parts.find((item) => item.type === type)?.value
  return `${part("year")}-${part("month")}-${part("day")}`
}

export const formatMoney = (amount: number) =>
  new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
  }).format(amount)

export const formatDay = (date: string) =>
  new Intl.DateTimeFormat("en-AU", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "Australia/Sydney",
  }).format(new Date(`${date}T12:00:00`))

export const formatMonth = (month: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "Australia/Sydney",
  }).format(new Date(`${month}-01T12:00:00`))
