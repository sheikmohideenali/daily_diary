import React, { useEffect, useMemo, useRef, useState } from 'react'
import SeatTracker from './SeatTracker'
import { motion, AnimatePresence } from 'framer-motion'
import { Activity, AlertTriangle, Archive, ArrowDownLeft, ArrowUpRight, BookOpen, Calculator, CalendarDays, Check, CheckCircle2, ChevronLeft, ChevronRight, Cloud, CloudOff, Download, FileImage, FileText, Home, Lock, LogOut, Menu, Plus, RefreshCw, Search, Settings, ShieldCheck, Trash2, Unlock, Wallet, X, Pencil, Users, TrendingUp, Armchair } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie, Cell } from 'recharts'
import { format, parseISO } from 'date-fns'
import { addTransaction, commissionSummary, deleteTransaction, diaryTransactions, ensureDiary, money, recalculate, todayKey, updateTransaction } from './lib/accounting'
import { exportBackup, hasPin, importBackup, loadData, saveData, setPin, verifyPin } from './lib/db'
import { cloudEnabled } from './lib/supabase'
import { exportDailyPdf, exportDiaryPng, exportMonthlyPdf } from './lib/export'

const nav = [
  { id:'dashboard', label:'Dashboard', icon:Home },
  { id:'diary', label:'Daily Diary', icon:BookOpen },
  { id:'commission', label:'Commission', icon:Users },
  { id:'archive', label:'Diary Archive', icon:Archive },
  { id:'seats', label:'My Seat', icon:Armchair },
  { id:'settings', label:'Settings', icon:Settings }
]
const COLORS = ['#169b70','#e36a6a','#6289d8','#e2a74d','#9274c7']
const today = todayKey()

function PinScreen({ onUnlock, firstSetup }) {
  const [pin,setValue] = useState(''), [confirm,setConfirm] = useState(''), [stage,setStage] = useState('create'), [error,setError] = useState('')
  const setup = async () => {
    if (pin.length !== 4) return setError('Enter a four-digit PIN.')
    if (stage === 'create') { setStage('confirm'); setConfirm(pin); setValue(''); setError(''); return }
    if (pin !== confirm) { setStage('create'); setConfirm(''); setValue(''); return setError('PINs did not match. Please try again.') }
    await setPin(pin); onUnlock()
  }
  const submit = async () => {
    if (firstSetup) return setup()
    if (pin.length !== 4) return
    if (await verifyPin(pin)) onUnlock()
    else { setValue(''); setError('Incorrect PIN. Try again.') }
  }
  const value = firstSetup && stage === 'confirm' ? pin : undefined
  const current = firstSetup && stage === 'confirm' ? '' : pin
  return <div className="pin-screen"><div className="pin-card"><div className="brand-mark large"><BookOpen size={27}/></div><div className="eyebrow">THAKOS INDUSTRIES</div><h1>{firstSetup ? 'Secure your diary' : 'Welcome back'}</h1><p>{firstSetup ? (stage === 'create' ? 'Create a 4-digit PIN to protect your accounts.' : 'Enter your PIN once more to confirm.') : 'Enter your PIN to open your account diary.'}</p><div className="pin-dots">{Array.from({length:4},(_,i)=><span key={i} className={(firstSetup && stage==='confirm' ? pin : current).length>i?'filled':''}/>)}</div><input aria-label="Four digit PIN" className="pin-input" type="password" inputMode="numeric" maxLength="4" value={pin} onChange={e=>{setValue(e.target.value.replace(/\D/g,'').slice(0,4));setError('')}} onKeyDown={e=>e.key==='Enter'&&submit()} autoFocus/><div className="pin-pad">{['1','2','3','4','5','6','7','8','9','clear','0','back'].map(k=><button key={k} onClick={()=>{if(k==='clear')setValue('');else if(k==='back')setValue(pin.slice(0,-1));else setValue((pin+k).slice(0,4))}}>{k==='clear'?'Clear':k==='back'?'⌫':k}</button>)}</div>{error&&<div className="error-text">{error}</div>}<button className="btn primary full" onClick={submit}>{firstSetup ? (stage==='create'?'Continue':'Confirm PIN') : 'Unlock diary'} <ChevronRight size={17}/></button><small><ShieldCheck size={13}/> Your PIN is stored as a local hash on this device.</small></div></div>
}

function Modal({ title, children, onClose, wide=false }) {
  return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><motion.div initial={{opacity:0,y:12,scale:.98}} animate={{opacity:1,y:0,scale:1}} className={`modal ${wide?'wide':''}`}><div className="modal-head"><h3>{title}</h3><button className="icon-btn" onClick={onClose}><X size={18}/></button></div>{children}</motion.div></div>
}

function CalculatorWidget({onClose,onUse}) {
  const [display,setDisplay]=useState('0'), [stored,setStored]=useState(null), [op,setOp]=useState(null), [fresh,setFresh]=useState(true)
  const press = v => {
    if (/^\d$/.test(v) || v==='.') { setDisplay(d=>fresh?(v==='.'?'0.':v):v==='.'&&d.includes('.')?d:d==='0'&&v!=='.'?v:d+v); setFresh(false); return }
    if (v==='AC') {setDisplay('0');setStored(null);setOp(null);setFresh(true);return}
    if (v==='DEL') {setDisplay(d=>d.length>1?d.slice(0,-1):'0');return}
    if (v==='=') { if(stored!==null&&op){const a=stored,b=Number(display);let n=op==='+'?a+b:op==='−'?a-b:op==='×'?a*b:b===0?NaN:a/b;setDisplay(Number.isFinite(n)?String(Math.round(n*100)/100):'Error');setStored(null);setOp(null);setFresh(true)} return}
    if (v==='%') {setDisplay(String(Number(display)/100));setFresh(true);return}
    setStored(Number(display));setOp(v);setFresh(true)
  }
  return <div className="calc-widget"><div className="calc-top"><span>QUICK CALCULATOR</span><button className="icon-btn" onClick={onClose}><X size={16}/></button></div><div className="calc-display">{display}</div><div className="calc-grid">{['AC','DEL','%','÷','7','8','9','×','4','5','6','−','1','2','3','+','0','.','='].map(v=><button key={v} className={['÷','×','−','+','='].includes(v)?'calc-op':''} onClick={()=>press(v)}>{v}</button>)}</div><button className="btn primary full" onClick={()=>onUse(Number(display))} disabled={!Number.isFinite(Number(display))}>Use this amount</button></div>
}

function TransactionForm({ initial, onSave, onCancel }) {
  const [particulars,setParticulars]=useState(initial?.particulars||'')
  const [amount,setAmount]=useState(initial?.amount??'')
  const [type,setType]=useState(initial?.type||'debit')
  const [notes,setNotes]=useState(initial?.notes||'')
  const [error,setError]=useState('')
  const submit=e=>{e.preventDefault();try{onSave({particulars,amount,type,notes});}catch(err){setError(err.message)}}
  return <form onSubmit={submit} className="form-stack"><label>Particulars<input autoFocus placeholder="e.g. Petrol, Customer payment, CM_Rahim" value={particulars} onChange={e=>setParticulars(e.target.value)} /></label><label>Amount (₹)<input type="number" min="0.01" step="0.01" inputMode="decimal" placeholder="0.00" value={amount} onChange={e=>setAmount(e.target.value)} /></label><div className="type-switch"><button type="button" className={type==='credit'?'selected credit':''} onClick={()=>setType('credit')}><ArrowDownLeft size={16}/> Credit / Received</button><button type="button" className={type==='debit'?'selected debit':''} onClick={()=>setType('debit')}><ArrowUpRight size={16}/> Debit / Paid</button></div><label>Notes (optional)<textarea rows="2" placeholder="Additional details..." value={notes} onChange={e=>setNotes(e.target.value)}/></label>{/^CM_.+/i.test(particulars.trim())&&<div className="hint success"><Users size={15}/> Commission member detected: {particulars.trim().slice(3)}</div>}{error&&<div className="error-text">{error}</div>}<div className="modal-actions"><button type="button" className="btn secondary" onClick={onCancel}>Cancel</button><button className="btn primary" type="submit"><Check size={16}/> Save transaction</button></div></form>
}

function App() {
  const [data,setData]=useState(()=>loadData())
  const [unlocked,setUnlocked]=useState(false)
  const [page,setPage]=useState('dashboard')
  const [selectedDate,setSelectedDate]=useState(today)
  const [modal,setModal]=useState(null)
  const [toast,setToast]=useState('')
  const [search,setSearch]=useState('')
  const [calc,setCalc]=useState(false)
  const [mobileNav,setMobileNav]=useState(false)
  const [sync,setSync]=useState(cloudEnabled?'Not configured':'Local only')
  const [editTx,setEditTx]=useState(null)
  const diaryRef=useRef(null)

  useEffect(()=>{const handler=()=>setData(loadData());window.addEventListener('thakos-data-changed',handler);return()=>window.removeEventListener('thakos-data-changed',handler)},[])
  useEffect(()=>{if(unlocked){const result=ensureDiary(data,today);if(result.data!==data){setData(result.data);saveData(result.data)}}},[unlocked])
  useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(''),3000);return()=>clearTimeout(t)},[toast])
  const currentData=useMemo(()=>recalculate(data),[data])
  const currentDiary=currentData.diaries.find(d=>d.date===selectedDate)
  const txs=currentDiary?diaryTransactions(currentData,currentDiary.id):[]
  const commissions=useMemo(()=>commissionSummary(currentData),[currentData])
  const allCredit=currentData.transactions.filter(t=>t.type==='credit').reduce((s,t)=>s+t.amount,0)
  const allDebit=currentData.transactions.filter(t=>t.type==='debit').reduce((s,t)=>s+t.amount,0)
  const balance=currentData.diaries.length?currentData.diaries.slice().sort((a,b)=>a.date.localeCompare(b.date)).at(-1).closingBalance:Number(currentData.settings.startingBalance||0)
  const month=selectedDate.slice(0,7)
  const monthDiaries=currentData.diaries.filter(d=>d.date.startsWith(month)).sort((a,b)=>a.date.localeCompare(b.date))
  const monthTx=currentData.transactions.filter(t=>t.diaryId && monthDiaries.some(d=>d.id===t.diaryId))
  const chartData=monthDiaries.map(d=>({date:d.date.slice(8),Credit:d.totalCredit,Debit:d.totalDebit}))
  const expenseCats=[{name:'Commission',value:currentData.transactions.filter(t=>t.category==='commission'&&t.type==='debit').reduce((s,t)=>s+t.amount,0)},{name:'Other expenses',value:currentData.transactions.filter(t=>t.category!=='commission'&&t.type==='debit').reduce((s,t)=>s+t.amount,0)}].filter(x=>x.value>0)
  const persist=next=>{const fixed=recalculate(next);saveData(fixed);setData(fixed)}
  const openDiary=()=>{const result=ensureDiary(currentData,selectedDate);persist(result.data);setPage('diary')}
  const addTx=payload=>{const result=ensureDiary(currentData,selectedDate);const made=addTransaction(result.data,result.diary.id,payload);persist(made.data);setModal(null);setToast('Transaction saved successfully.')}
  const saveEdit=payload=>{persist(updateTransaction(currentData,editTx.id,payload));setEditTx(null);setModal(null);setToast('Transaction updated.')}
  const removeTx=id=>{if(!confirm('Delete this transaction? This will recalculate the diary balance.'))return;try{persist(deleteTransaction(currentData,id));setToast('Transaction deleted.')}catch(e){setToast(e.message)}}
  const selectedDiary=currentDiary || {date:selectedDate,pageNumber:'—',openingBalance:0,totalCredit:0,totalDebit:0,closingBalance:0,status:'open'}
  const pageTitle=nav.find(n=>n.id===page)?.label||'Dashboard'
  const showAdd=()=>{const d=currentData.diaries.find(x=>x.date===selectedDate);if(d?.status==='closed'){setToast('This diary is closed. Reopen it before adding entries.');return}setEditTx(null);setModal('transaction')}
  const changeDiaryStatus=()=>{if(!currentDiary)return;const now=new Date().toISOString();const next={...currentData,diaries:currentData.diaries.map(d=>d.id===currentDiary.id?{...d,status:d.status==='closed'?'open':'closed',updatedAt:now}:d)};persist(next);setToast(currentDiary.status==='closed'?'Diary reopened.':'Diary closed successfully.')}
  const downloadDaily=()=>{if(!currentDiary)return setToast('No diary exists for this date.');exportDailyPdf(currentDiary,txs,currentData.settings.companyName)}
  const dailyImage=()=>exportDiaryPng(diaryRef.current,selectedDate).catch(e=>setToast(e.message))
  const changePage=id=>{setPage(id);setMobileNav(false)}
  const filteredTransactions=currentData.transactions.filter(t=>`${t.particulars} ${t.commissionMember||''}`.toLowerCase().includes(search.toLowerCase())).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))
  const monthLabel=format(parseISO(`${month}-01`),'MMMM yyyy')

  if(!unlocked) return <PinScreen firstSetup={!hasPin()} onUnlock={()=>setUnlocked(true)}/>

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav?'open':''}`}><div className="sidebar-brand"><div className="brand-mark"><BookOpen size={21}/></div><div><b>THAKOS</b><small>INDUSTRIES</small></div><button className="mobile-close icon-btn" onClick={()=>setMobileNav(false)}><X/></button></div><div className="workspace-label">WORKSPACE</div><nav>{nav.map(item=><button key={item.id} className={`nav-item ${page===item.id?'active':''}`} onClick={()=>changePage(item.id)}><item.icon size={18}/><span>{item.label}</span>{item.id==='diary'&&<span className="nav-date">{format(new Date(),'dd')}</span>}</button>)}</nav><div className="sidebar-bottom"><div className="sync-card"><span className={`sync-dot ${cloudEnabled?'online':'offline'}`}/><div><b>{cloudEnabled?'Cloud sync configured':'Local device storage'}</b><small>{cloudEnabled?'Cloud connection needs setup':'Connect cloud to share across devices'}</small></div></div><button className="nav-item" onClick={()=>setUnlocked(false)}><Lock size={18}/> Lock application</button><div className="sidebar-foot">THAKOS DIGITAL ACCOUNT DIARY<br/>Version 1.0.0</div></div></aside>
    {mobileNav&&<div className="mobile-scrim" onClick={()=>setMobileNav(false)}/>}
    <main className="main-area"><header className="topbar"><div className="topbar-left"><button className="icon-btn menu-btn" onClick={()=>setMobileNav(true)}><Menu/></button><div><div className="eyebrow">THAKOS INDUSTRIES</div><h2>{pageTitle}</h2></div></div><div className="top-actions"><span className="date-pill"><CalendarDays size={15}/>{format(new Date(),'dd MMM yyyy')}</span><button className="icon-btn" title="Calculator" onClick={()=>setCalc(!calc)}><Calculator size={19}/></button><button className="avatar" title="Lock app" onClick={()=>setUnlocked(false)}>T</button></div></header>
    <div className="content">
      {page==='dashboard'&&<motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className="page-stack">
        <div className="welcome-row"><div><div className="eyebrow">FINANCIAL OVERVIEW</div><h1>Your accounts, at a glance.</h1><p>Here’s what’s happening with your company finances.</p></div><button className="btn primary" onClick={()=>{setSelectedDate(today);showAdd()}}><Plus size={17}/> Add transaction</button></div>
        <div className="stat-grid">
          <StatCard label="Total Credit" value={money(allCredit)} icon={ArrowDownLeft} tone="green" hint="All recorded credits"/>
          <StatCard label="Total Expenses" value={money(allDebit)} icon={ArrowUpRight} tone="red" hint="All recorded debits"/>
          <StatCard label="Current Balance" value={money(balance)} icon={Wallet} tone="blue" hint="Latest closing balance"/>
          <StatCard label="Total Commission" value={money(commissions.reduce((s,c)=>s+c.total,0))} icon={Users} tone="purple" hint={`${commissions.length} commission members`}/>
        </div>
        <div className="dashboard-grid"><section className="panel chart-panel"><div className="panel-heading"><div><h3>Cash flow activity</h3><p>Daily credit and debit · {monthLabel}</p></div><span className="subtle-chip">This month</span></div>{chartData.length?<div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf0f4"/><XAxis dataKey="date" tickLine={false} axisLine={false}/><YAxis tickLine={false} axisLine={false} width={48}/><Tooltip formatter={v=>money(v)}/><Legend/><Bar dataKey="Credit" fill="#169b70" radius={[5,5,0,0]}/><Bar dataKey="Debit" fill="#e36a6a" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer></div>:<EmptyState icon={Activity} title="No activity to chart yet" text="Add a few transactions to see your cash flow here."/>}</section>
        <section className="panel attention-panel"><div className="panel-heading"><div><h3>Attention status</h3><p>Things that may need a look</p></div><span className="attention-icon"><AlertTriangle size={17}/></span></div><div className="attention-list">{!currentData.diaries.some(d=>d.date===today)&&<Attention tone="warning" title="Today's diary has not started" detail="Open today's diary to begin recording."/>}{currentData.diaries.some(d=>d.date===today&&d.status==='open')&&<Attention tone="success" title="Today's diary is open" detail="Remember to close it when the day is complete."/>}{currentData.diaries.some(d=>d.date===today&&d.status==='closed')&&<Attention tone="success" title="Today's diary is closed" detail="Your daily accounts are marked complete."/>}{!cloudEnabled&&<Attention tone="info" title="Cloud sync not connected" detail="Records currently stay on this device. Configure Supabase for multiple devices."/>}{currentData.transactions.length===0&&<Attention tone="info" title="No transactions recorded" detail="Your diary is ready when you are."/>}</div></section></div>
        <section className="panel"><div className="panel-heading"><div><h3>Recent transactions</h3><p>Your latest account activity</p></div><button className="text-btn" onClick={()=>changePage('archive')}>View all <ChevronRight size={15}/></button></div><TransactionTable transactions={currentData.transactions.slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,5)} diaries={currentData.diaries} onEdit={id=>{setEditTx(currentData.transactions.find(t=>t.id===id));setModal('edit')}} onDelete={removeTx}/></section>
      </motion.div>}

      {page==='diary'&&<motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className="page-stack">
        <div className="welcome-row"><div><div className="eyebrow">DAILY ACCOUNT BOOK</div><h1>Your daily ledger.</h1><p>Record every amount received and paid.</p></div><button className="btn primary" onClick={showAdd} disabled={currentDiary?.status==='closed'}><Plus size={17}/> Add entry</button></div>
        <div className="diary-toolbar"><div className="date-control"><button className="icon-btn" onClick={()=>{const d=new Date(selectedDate+'T12:00:00');d.setDate(d.getDate()-1);setSelectedDate(todayKeyFrom(d))}}><ChevronLeft/></button><input type="date" value={selectedDate} onChange={e=>setSelectedDate(e.target.value)}/><button className="icon-btn" onClick={()=>{const d=new Date(selectedDate+'T12:00:00');d.setDate(d.getDate()+1);setSelectedDate(todayKeyFrom(d))}}><ChevronRight/></button></div><div className="toolbar-actions"><span className={`status-pill ${currentDiary?.status==='closed'?'closed':'open'}`}>{currentDiary?.status==='closed'?'Closed':'Open'}</span><button className="btn secondary small" onClick={changeDiaryStatus} disabled={!currentDiary}>{currentDiary?.status==='closed'?<Unlock size={15}/>:<CheckCircle2 size={15}/>} {currentDiary?.status==='closed'?'Reopen':'Close day'}</button><button className="btn secondary small" onClick={downloadDaily}><FileText size={15}/> PDF</button><button className="btn secondary small" onClick={dailyImage}><FileImage size={15}/> Image</button></div></div>
        {currentDiary?<div className="diary-paper" ref={diaryRef}><div className="paper-header"><div><div className="paper-company">THAKOS INDUSTRIES</div><div className="paper-subtitle">DAILY ACCOUNT BOOK</div></div><div className="paper-date"><b>{format(parseISO(selectedDate),'dd MMMM yyyy')}</b><span>PAGE NO. {String(currentDiary.pageNumber).padStart(3,'0')}</span></div></div><div className="paper-balance-grid"><PaperStat label="Opening Balance" value={currentDiary.openingBalance} tone="neutral"/><PaperStat label="Total Credit" value={currentDiary.totalCredit} tone="green"/><PaperStat label="Total Debit / Expenses" value={currentDiary.totalDebit} tone="red"/><PaperStat label="Closing Balance" value={currentDiary.closingBalance} tone="blue"/></div><div className="ledger-wrap"><table className="ledger-table"><thead><tr><th>No.</th><th>Particulars</th><th>Credit</th><th>Debit</th><th>Running Balance</th><th></th></tr></thead><tbody>{Array.from({length:40},(_,i)=>{const t=txs[i];return <tr key={i} className={t?'filled-row':''}><td>{String(i+1).padStart(2,'0')}</td><td>{t?<><b>{t.particulars}</b>{t.category==='commission'&&<span className="mini-tag">CM</span>}</>:' '}</td><td className="credit-cell">{t?.type==='credit'?money(t.amount):'—'}</td><td className="debit-cell">{t?.type==='debit'?money(t.amount):'—'}</td><td className="balance-cell">{t?money(t.runningBalance):'—'}</td><td className="row-actions">{t&&<><button title="Edit" onClick={()=>{setEditTx(t);setModal('edit')}}><Pencil size={13}/></button><button title="Delete" onClick={()=>removeTx(t.id)}><Trash2 size={13}/></button></>}</td></tr>})}</tbody></table></div><div className="paper-footer"><span>Transactions recorded: {txs.length} / 40</span><b>Closing Balance: {money(currentDiary.closingBalance)}</b></div></div>:<EmptyState icon={BookOpen} title="No diary for this date" text="Create a diary to start recording transactions." action={<button className="btn primary" onClick={openDiary}>Create daily diary</button>}/>}
        {txs.length>=40&&<div className="hint warning"><AlertTriangle size={15}/> This diary has reached 40 entries. The current version keeps all entries in the same date record; a second physical-style sheet is not yet implemented.</div>}
      </motion.div>}

      {page==='commission'&&<motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className="page-stack"><div className="welcome-row"><div><div className="eyebrow">COMMISSION MANAGEMENT</div><h1>Commission book.</h1><p>All CM_ transactions, automatically grouped by member.</p></div><div className="total-chip"><span>Total commission</span><b>{money(commissions.reduce((s,c)=>s+c.total,0))}</b></div></div><div className="stat-grid three"><StatCard label="Commission paid" value={money(commissions.reduce((s,c)=>s+c.total,0))} icon={Wallet} tone="purple" hint="All recorded commission entries"/><StatCard label="Members" value={String(commissions.length)} icon={Users} tone="blue" hint="Unique commission members"/><StatCard label="Transactions" value={String(currentData.transactions.filter(t=>t.category==='commission').length)} icon={Activity} tone="green" hint="Commission records"/></div><div className="member-grid">{commissions.map(c=><div className="panel member-card" key={c.name}><div className="member-avatar">{c.name.slice(0,1).toUpperCase()}</div><div className="member-main"><b>{c.name}</b><small>{c.count} transaction{c.count===1?'':'s'}</small></div><strong>{money(c.total)}</strong><details><summary>View history</summary><div className="member-history">{c.transactions.map(t=><div key={t.id}><span>{t.particulars} · {currentData.diaries.find(d=>d.id===t.diaryId)?.date}</span><b>{money(t.amount)}</b></div>)}</div></details></div>)}</div>{!commissions.length&&<EmptyState icon={Users} title="No commission entries yet" text="Add a transaction with particulars like CM_Rahim to see it here."/>}</motion.div>}

      {page==='archive'&&<motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className="page-stack"><div className="welcome-row"><div><div className="eyebrow">ACCOUNT HISTORY</div><h1>Diary archive.</h1><p>Find and revisit your previous daily records.</p></div><button className="btn secondary" onClick={()=>exportMonthlyPdf(month,monthDiaries,currentData.transactions,currentData.settings.companyName)}><Download size={16}/> Export {monthLabel}</button></div><div className="archive-filters"><div className="search-field"><Search size={17}/><input placeholder="Search transactions or members..." value={search} onChange={e=>setSearch(e.target.value)}/></div><input type="month" value={month} onChange={e=>setSelectedDate(`${e.target.value}-01`)}/></div><div className="panel"><div className="panel-heading"><div><h3>Daily records</h3><p>{monthDiaries.length} diary page(s) in {monthLabel}</p></div></div>{monthDiaries.length?monthDiaries.map(d=><div className="archive-row" key={d.id}><div className="archive-date"><b>{format(parseISO(d.date),'dd')}</b><span>{format(parseISO(d.date),'MMM yyyy')}</span></div><div className="archive-info"><b>{format(parseISO(d.date),'EEEE')}</b><small>{currentData.transactions.filter(t=>t.diaryId===d.id).length} transactions · Page {d.pageNumber}</small></div><div className="archive-money"><span>Credit <b className="green-text">{money(d.totalCredit)}</b></span><span>Debit <b className="red-text">{money(d.totalDebit)}</b></span></div><div className="archive-close"><small>Closing balance</small><b>{money(d.closingBalance)}</b></div><button className="btn secondary small" onClick={()=>{setSelectedDate(d.date);setPage('diary')}}>Preview <ChevronRight size={14}/></button></div>):<EmptyState icon={Archive} title="No records for this month" text="Your daily diaries will appear here."/>}</div><div className="panel"><div className="panel-heading"><div><h3>Matching transactions</h3><p>Search across all saved transactions</p></div></div><TransactionTable transactions={filteredTransactions.slice(0,30)} diaries={currentData.diaries} onEdit={id=>{setEditTx(currentData.transactions.find(t=>t.id===id));setModal('edit')}} onDelete={removeTx}/></div></motion.div>}

      {page==='seats'&&<motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className="page-stack"><SeatTracker/></motion.div>}

      {page==='settings'&&<motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className="page-stack"><div className="welcome-row"><div><div className="eyebrow">PREFERENCES & SECURITY</div><h1>Settings.</h1><p>Manage your company details and protect your records.</p></div></div><div className="settings-grid"><section className="panel settings-panel"><div className="panel-heading"><div><h3><Settings size={17}/> Company settings</h3><p>Basic information for your account book</p></div></div><label>Company name<input value={data.settings.companyName} onChange={e=>persist({...data,settings:{...data.settings,companyName:e.target.value}})}/></label><label>Starting balance (₹)<input type="number" value={data.settings.startingBalance} onChange={e=>persist({...data,settings:{...data.settings,startingBalance:Number(e.target.value)||0}})}/></label><div className="hint">Changing the starting balance recalculates all diary balances. Use this only when setting up or correcting the ledger.</div></section><section className="panel settings-panel"><div className="panel-heading"><div><h3><ShieldCheck size={17}/> Security</h3><p>Lock and protect your diary</p></div></div><button className="btn secondary full" onClick={()=>{setUnlocked(false);localStorage.removeItem('thakos-pin-hash-v1');setToast('Create a new PIN when you reopen the app.')}}><Lock size={16}/> Reset application PIN</button><button className="btn secondary full" onClick={()=>setUnlocked(false)}><LogOut size={16}/> Lock now</button><p className="muted-note">The PIN protects this browser profile. It is not a replacement for device security or encrypted cloud authentication.</p></section><section className="panel settings-panel"><div className="panel-heading"><div><h3><Archive size={17}/> Backup & restore</h3><p>Keep a safe copy of your company records</p></div></div><button className="btn primary full" onClick={()=>exportBackup(currentData)}><Download size={16}/> Download full backup</button><label className="file-button">Restore from backup<input type="file" accept="application/json" onChange={async e=>{try{const d=await importBackup(e.target.files[0]);setData(d);setToast('Backup restored successfully.')}catch(err){setToast(err.message)}}}/></label><div className="hint warning"><AlertTriangle size={15}/> Keep backups somewhere safe. Browser data can be lost if site storage is cleared.</div></section><section className="panel settings-panel"><div className="panel-heading"><div><h3><Cloud size={17}/> Multi-device sync</h3><p>Cloud configuration status</p></div></div><div className="sync-status"><span className={`sync-dot ${cloudEnabled?'online':'offline'}`}/><b>{cloudEnabled?'Supabase credentials detected':'Cloud sync is not configured'}</b></div><p className="muted-note">This starter stores records locally. To synchronize between your father's phone and computer, configure Supabase and complete the cloud sync integration described in SETUP.md. Do not assume records are shared until sync is tested.</p></section></div></motion.div>}
    </div>
    <footer className="app-footer"><span>© {new Date().getFullYear()} THAKOS INDUSTRIES</span><span>Every Rupee, Accounted For.</span></footer>
    </main>
    <AnimatePresence>{calc&&<motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} exit={{opacity:0,y:20}} className="calculator-float"><CalculatorWidget onClose={()=>setCalc(false)} onUse={v=>{setCalc(false);setModal('transaction');setTimeout(()=>{const input=document.querySelector('input[placeholder="0.00"]');if(input){input.value=String(v);input.dispatchEvent(new Event('input',{bubbles:true}))}},100)}}/></motion.div>}</AnimatePresence>
    {modal==='transaction'&&<Modal title="Add transaction" onClose={()=>setModal(null)}><TransactionForm onSave={addTx} onCancel={()=>setModal(null)}/></Modal>}
    {modal==='edit'&&editTx&&<Modal title="Edit transaction" onClose={()=>{setModal(null);setEditTx(null)}}><TransactionForm initial={editTx} onSave={saveEdit} onCancel={()=>{setModal(null);setEditTx(null)}}/></Modal>}
    {toast&&<div className="toast"><CheckCircle2 size={17}/>{toast}</div>}
    <nav className="mobile-bottom">{nav.map(n=><button key={n.id} className={page===n.id?'active':''} onClick={()=>changePage(n.id)}><n.icon size={19}/><span>{n.label==='Daily Diary'?'Diary':n.label==='Commission'?'CM':n.label==='Diary Archive'?'Archive':n.label}</span></button>)}</nav>
  </div>
}

function todayKeyFrom(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function StatCard({label,value,icon:Icon,tone,hint}){return <div className="stat-card"><div className={`stat-icon ${tone}`}><Icon size={19}/></div><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-hint">{hint}</div></div>}
function PaperStat({label,value,tone}){return <div className={`paper-stat ${tone}`}><span>{label}</span><b>{money(value)}</b></div>}
function Attention({tone,title,detail}){return <div className="attention-item"><span className={`attention-dot ${tone}`}/><div><b>{title}</b><small>{detail}</small></div></div>}
function EmptyState({icon:Icon,title,text,action}){return <div className="empty-state"><div className="empty-icon"><Icon size={23}/></div><b>{title}</b><p>{text}</p>{action}</div>}
function TransactionTable({transactions,diaries,onEdit,onDelete}){if(!transactions.length)return <div className="table-empty">No transactions recorded yet.</div>;return <div className="responsive-table"><table className="data-table"><thead><tr><th>Particulars</th><th>Date</th><th>Type</th><th>Amount</th><th></th></tr></thead><tbody>{transactions.map(t=><tr key={t.id}><td><b>{t.particulars}</b>{t.category==='commission'&&<span className="mini-tag">COMMISSION</span>}</td><td>{diaries.find(d=>d.id===t.diaryId)?.date||'—'}</td><td><span className={`type-label ${t.type}`}>{t.type}</span></td><td className={t.type==='credit'?'green-text':'red-text'}>{money(t.amount)}</td><td><div className="table-actions"><button onClick={()=>onEdit(t.id)} title="Edit"><Pencil size={14}/></button><button onClick={()=>onDelete(t.id)} title="Delete"><Trash2 size={14}/></button></div></td></tr>)}</tbody></table></div>}
export default App