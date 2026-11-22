
import { format, parseISO, addDays } from 'date-fns'

export const todayKey = () => format(new Date(), 'yyyy-MM-dd')

export const money = value =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  }).format(Number(value || 0))

export const safeNumber = value => {
  const n = Number(String(value).replace(/,/g, '').trim())
  return Number.isFinite(n) && n >= 0
    ? Math.round(n * 100) / 100
    : 0
}

export function recalculate(data) {
  const diaries = [...data.diaries]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(diary => ({ ...diary }))

  let carry = Number(data.settings.startingBalance || 0)

  for (const diary of diaries) {
    diary.openingBalance = carry

    const txs = data.transactions
      .filter(t => t.diaryId === diary.id)
      .sort((a, b) =>
        String(a.createdAt || '').localeCompare(String(b.createdAt || ''))
      )

    let running = carry
    let credit = 0
    let debit = 0

    for (const tx of txs) {
      if (tx.type === 'credit') {
        credit += Number(tx.amount || 0)
        running += Number(tx.amount || 0)
      } else {
        debit += Number(tx.amount || 0)
        running -= Number(tx.amount || 0)
      }

      tx.runningBalance = Math.round(running * 100) / 100
    }

    diary.totalCredit = Math.round(credit * 100) / 100
    diary.totalDebit = Math.round(debit * 100) / 100
    diary.closingBalance = Math.round(running * 100) / 100

    carry = diary.closingBalance
  }

  return { ...data, diaries, transactions: data.transactions }
}

export function ensureDiary(data, date = todayKey()) {
  const found = data.diaries.find(d => d.date === date)

  if (found) return { data, diary: found }

  const pageNumber = data.diaries.length
    ? Math.max(...data.diaries.map(d => d.pageNumber || 0)) + 1
    : 1

  const now = new Date().toISOString()

  const diary = {
    id: crypto.randomUUID(),
    date,
    pageNumber,
    status: 'open',
    openingBalance: 0,
    totalCredit: 0,
    totalDebit: 0,
    closingBalance: 0,
    createdAt: now,
    updatedAt: now
  }

  const next = recalculate({
    ...data,
    diaries: [...data.diaries, diary]
  })

  return {
    data: next,
    diary: next.diaries.find(d => d.id === diary.id)
  }
}

export function addTransaction(data, diaryId, payload) {
  const diary = data.diaries.find(d => d.id === diaryId)

  if (!diary) throw new Error('Diary not found.')

  if (diary.status === 'closed') {
    throw new Error('This diary is closed. Reopen it before making changes.')
  }

  const particulars = payload.particulars.trim()

  if (!particulars) throw new Error('Enter transaction particulars.')

  const amount = safeNumber(payload.amount)

  if (amount <= 0) throw new Error('Enter an amount greater than zero.')

  const now = new Date().toISOString()
  const commission = /^CM_(.+)$/i.exec(particulars)

  const tx = {
    id: crypto.randomUUID(),
    diaryId,
    particulars,
    amount,
    type: payload.type,
    category: commission
      ? 'commission'
      : (payload.category || 'general'),
    commissionMember: commission ? commission[1].trim() : '',
    notes: payload.notes || '',
    createdAt: now,
    updatedAt: now
  }

  const next = recalculate({
    ...data,
    transactions: [...data.transactions, tx],
    diaries: data.diaries.map(d =>
      d.id === diaryId ? { ...d, updatedAt: now } : d
    )
  })

  return { data: next, transaction: tx }
}

export function updateTransaction(data, id, payload) {
  const old = data.transactions.find(t => t.id === id)

  if (!old) throw new Error('Transaction not found.')

  const diary = data.diaries.find(d => d.id === old.diaryId)

  if (diary?.status === 'closed') {
    throw new Error('Reopen this diary before editing.')
  }

  const particulars = payload.particulars.trim()
  const amount = safeNumber(payload.amount)

  if (!particulars || amount <= 0) {
    throw new Error('Enter valid particulars and amount.')
  }

  const now = new Date().toISOString()
  const cm = /^CM_(.+)$/i.exec(particulars)

  const transactions = data.transactions.map(t =>
    t.id === id
      ? {
          ...t,
          ...payload,
          particulars,
          amount,
          category: cm
            ? 'commission'
            : (payload.category || 'general'),
          commissionMember: cm ? cm[1].trim() : '',
          updatedAt: now
        }
      : t
  )

  const diaries = data.diaries.map(d =>
    d.id === old.diaryId ? { ...d, updatedAt: now } : d
  )

  return recalculate({ ...data, transactions, diaries })
}

export function deleteTransaction(data, id) {
  const tx = data.transactions.find(t => t.id === id)

  if (!tx) throw new Error('Transaction not found.')

  const diary = data.diaries.find(d => d.id === tx.diaryId)

  if (diary?.status === 'closed') {
    throw new Error('Reopen this diary before deleting.')
  }

  const now = new Date().toISOString()

  const deletedTransactionIds = [
    ...new Set([
      ...(data.deletedTransactionIds || []),
      id
    ])
  ]

  const transactions = data.transactions.filter(t => t.id !== id)

  const diaries = data.diaries.map(d =>
    d.id === tx.diaryId ? { ...d, updatedAt: now } : d
  )

  return recalculate({
    ...data,
    transactions,
    diaries,
    deletedTransactionIds
  })
}

export function commissionSummary(data) {
  const map = new Map()

  for (const tx of data.transactions.filter(
    t => t.category === 'commission'
  )) {
    const name = tx.commissionMember || 'Unknown'

    const item = map.get(name) || {
      name,
      total: 0,
      count: 0,
      transactions: []
    }

    item.total += tx.amount
    item.count++
    item.transactions.push(tx)

    map.set(name, item)
  }

  return [...map.values()]
    .map(x => ({
      ...x,
      total: Math.round(x.total * 100) / 100
    }))
    .sort((a, b) => b.total - a.total)
}

export function diaryTransactions(data, diaryId) {
  return data.transactions
    .filter(t => t.diaryId === diaryId)
    .sort((a, b) =>
      String(a.createdAt || '').localeCompare(String(b.createdAt || ''))
    )
}

export function getPreviousDate(date) {
  return format(addDays(parseISO(date), -1), 'yyyy-MM-dd')
}
