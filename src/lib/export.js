import { jsPDF } from 'jspdf'
import { toPng } from 'html-to-image'
import { money } from './accounting'

export function exportDailyPdf(diary, transactions, company) {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  pdf.setFont('helvetica','bold'); pdf.setFontSize(17); pdf.text(company, 14, 17)
  pdf.setFontSize(10); pdf.setFont('helvetica','normal')
  pdf.text('DAILY ACCOUNT BOOK', 14, 24)
  pdf.text(`Date: ${diary.date}    Page: ${diary.pageNumber}`, 14, 31)
  pdf.text(`Opening Balance: ${money(diary.openingBalance)}`, 14, 39)
  let y = 49
  pdf.setFont('helvetica','bold'); pdf.text('No.',14,y); pdf.text('Particulars',25,y); pdf.text('Type',112,y); pdf.text('Amount',145,y); pdf.text('Running Balance',177,y)
  y += 5; pdf.line(14,y,196,y); y += 7
  pdf.setFont('helvetica','normal')
  transactions.forEach((tx,i) => {
    if (y > 275) { pdf.addPage(); y = 20 }
    pdf.text(String(i+1),14,y)
    pdf.text(String(tx.particulars).slice(0,48),25,y)
    pdf.text(tx.type.toUpperCase(),112,y)
    pdf.text(money(tx.amount),145,y)
    pdf.text(money(tx.runningBalance),177,y)
    y += 7
  })
  y += 5; pdf.line(14,y,196,y); y += 9
  pdf.setFont('helvetica','bold')
  pdf.text(`Total Credit: ${money(diary.totalCredit)}`,14,y); y += 7
  pdf.text(`Total Debit: ${money(diary.totalDebit)}`,14,y); y += 7
  pdf.setFontSize(13); pdf.text(`Closing Balance: ${money(diary.closingBalance)}`,14,y)
  pdf.save(`THAKOS-diary-${diary.date}.pdf`)
}
export async function exportDiaryPng(element, date) {
  if (!element) throw new Error('Diary preview is not available.')
  const dataUrl = await toPng(element, { pixelRatio: 2, backgroundColor: '#ffffff' })
  const a = document.createElement('a'); a.href = dataUrl; a.download = `THAKOS-diary-${date}.png`; a.click()
}
export function exportMonthlyPdf(month, diaries, transactions, company) {
  const pdf = new jsPDF()
  pdf.setFontSize(17); pdf.text(company, 14, 17)
  pdf.setFontSize(11); pdf.text(`Monthly Account Report — ${month}`,14,25)
  let y = 36
  for (const d of diaries) {
    if (y > 260) { pdf.addPage(); y = 18 }
    pdf.setFontSize(11); pdf.text(`${d.date} | Opening ${money(d.openingBalance)} | Credit ${money(d.totalCredit)} | Debit ${money(d.totalDebit)} | Closing ${money(d.closingBalance)}`,14,y)
    y += 7
    for (const t of transactions.filter(x => x.diaryId === d.id)) {
      if (y > 275) { pdf.addPage(); y = 18 }
      pdf.setFontSize(9); pdf.text(`   ${t.particulars} — ${t.type.toUpperCase()} ${money(t.amount)}`,17,y); y += 5
    }
    y += 3
  }
  const credit = diaries.reduce((s,d)=>s+d.totalCredit,0), debit = diaries.reduce((s,d)=>s+d.totalDebit,0)
  if (y > 260) { pdf.addPage(); y = 18 }
  pdf.setFontSize(12); pdf.text(`Monthly Credit: ${money(credit)}    Monthly Debit: ${money(debit)}`,14,y+5)
  pdf.save(`THAKOS-monthly-${month}.pdf`)
}