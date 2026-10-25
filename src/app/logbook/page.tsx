'use client';
import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { IBM_Plex_Mono } from 'next/font/google';
import { ArrowRight, Search } from 'lucide-react';
import { useDashData, useToast } from '@/hooks';
import { StaffShell } from '@/components/layout/StaffShell';
import { PageLoading } from '@/components/ui/Spinner';
import { TicketDrawer } from '@/components/dashboard/TicketDrawer';
import { CaseDocButton } from '@/components/CaseDocs';
import { SURVEY_KPI_THRESHOLD } from '@/lib/constants';
import {
  JOURNEY, NEXT_STEP, STATIONS, SURVEY_Q, buildRows, dayStrip, departmentsOf, fmtB, journeyIndex, matches, monthLabel, monthShortLabel,
  monthsOf, rank, summarize, thShort, todayBkk, type LogRow, type StationKey,
} from '@/lib/analytics/logbook';
import s from './logbook.module.css';

const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-plex-mono', display: 'swap' });
const STAR_KEY = 'ict-logbook-stars';
const STATION_COLOR: Record<StationKey, string> = { NEW: 'var(--s1)', ICO_WORK: 'var(--s2)', ITL_WAIT: 'var(--s3)', ITM_WAIT: 'var(--s4)', ICO_FINAL: 'var(--s5)' };
const stationOf = (k: StationKey | null) => STATIONS.find((x) => x.key === k);

function readStars(): Record<string, true> {
  try { return JSON.parse(localStorage.getItem(STAR_KEY) || '{}') as Record<string, true>; } catch { return {}; }
}

export default function LogbookPage() {
  const { data, loading, error } = useDashData();
  const toast = useToast();
  const today = useMemo(() => todayBkk(), []);
  const rows = useMemo(() => (data ? buildRows(data, today) : []), [data, today]);
  const months = useMemo(() => monthsOf(rows, today), [rows, today]);

  const [month, setMonth] = useState(today.slice(0, 7));
  const [dept, setDept] = useState('');
  const [q, setQ] = useState('');
  const [station, setStation] = useState<StationKey | null>(null);
  const [onlyStar, setOnlyStar] = useState(false);
  const [view, setView] = useState<'map' | 'list'>('map');
  const [sel, setSel] = useState<string | null>(null);
  const [full, setFull] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [lSort, setLSort] = useState<{ k: 'no' | 'age'; dir: 1 | -1 }>({ k: 'age', dir: -1 });
  const [cSort, setCSort] = useState<'date' | 'amt'>('date');
  const [stars, setStars] = useState<Record<string, true>>({});
  useEffect(() => { setStars(readStars()); }, []);
  const toggleStar = (no: string) => setStars((x) => {
    const n = { ...x }; if (n[no]) delete n[no]; else n[no] = true;
    try { localStorage.setItem(STAR_KEY, JSON.stringify(n)); } catch { /* ไม่มี storage ก็ใช้ได้ในหน้านี้ */ }
    return n;
  });

  const sum = useMemo(() => summarize({ rows, month, dept, today }), [rows, month, dept, today]);
  const days = useMemo(() => dayStrip(rows, month, dept), [rows, month, dept]);
  const maxAge = Math.max(1, ...sum.openAll.map((r) => r.age));
  const pool = sum.openAll.filter((r) => !onlyStar || stars[r.no]);
  const listRows = pool.filter((r) => (!station || r.station === station) && matches(r, q))
    .sort((a, b) => (lSort.k === 'no' ? (a.month + String(a.seq).padStart(4, '0')).localeCompare(b.month + String(b.seq).padStart(4, '0')) : a.age - b.age) * lSort.dir);
  const visible = view === 'map' ? pool.filter((r) => !station || r.station === station).length : listRows.length;
  const selRow = sel ? rows.find((r) => r.no === sel) ?? null : null;
  const starCount = Object.keys(stars).length;
  const ledger = [...sum.costRows].sort((a, b) => (cSort === 'amt' ? (b.cost ?? 0) - (a.cost ?? 0) : a.seq - b.seq));
  const deptRank = rank(rows.filter((r) => r.month === month), (r) => r.t.department);
  const catRank = rank(sum.cur, (r) => r.t.job_category === 'Other' ? 'อื่นๆ' : r.t.job_category);
  const dayItems = day ? rows.filter((r) => (!dept || r.t.department === dept) && (r.req === day || (r.done && r.closed === day))) : [];

  const copyNo = async (no: string) => {
    try { await navigator.clipboard.writeText(no); toast.success(`คัดลอก ${no} แล้ว`); } catch { toast.error('คัดลอกไม่ได้ในเบราว์เซอร์นี้'); }
  };
  const sortList = (k: 'no' | 'age') => setLSort((x) => ({ k, dir: x.k === k ? (x.dir === 1 ? -1 : 1) : k === 'no' ? 1 : -1 }));
  const arrow = (k: 'no' | 'age') => (lSort.k === k ? (lSort.dir === 1 ? '↑' : '↓') : '↕');
  const ariaSort = (k: 'no' | 'age') => (lSort.k === k ? (lSort.dir === 1 ? 'ascending' : 'descending') : 'none') as 'ascending' | 'descending' | 'none';

  return (
    <StaffShell roles={['ICO', 'ITL', 'ITM']} title="สมุดงาน" subtitle="งานเข้า–ออก เส้นทางงาน และค่าใช้จ่าย ในหน้าเดียว" wide>
      {error && <p role="alert" className="mb-3 rounded-xl border border-err/40 bg-[var(--err-bg)] p-3 text-sm text-err">โหลดข้อมูลไม่สำเร็จ: {error}</p>}
      {loading || !data ? <PageLoading /> : (
        <div className={clsx(s.root, mono.variable)} data-testid="logbook">

          {/* ───── Toolbar ───── */}
          <div className={s.bar}>
            <div className={s.word}><b>สมุดงานประจำเดือน</b>{dept ? `แผนก ${dept}` : 'ทุกแผนก'}</div>
            <div className={s.months} role="group" aria-label="เลือกเดือน">
              {months.slice(0, 6).reverse().map((m) => (
                <button key={m} type="button" aria-pressed={m === month} onClick={() => { setMonth(m); setDay(null); }}>{monthShortLabel(m)}</button>
              ))}
            </div>
            <label className={s.fld}>แผนก
              <select value={dept} onChange={(e) => setDept(e.target.value)} data-testid="lb-dept">
                <option value="">ทุกแผนก</option>{departmentsOf(rows).map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>
            <label className={clsx(s.fld, s.search)}>
              <Search className="size-4" aria-hidden /><span className={s.sr}>ค้นหางาน</span>
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นเลขที่ เรื่อง ผู้แจ้ง Asset" data-testid="lb-search" />
            </label>
          </div>

          {/* ───── Headline ───── */}
          <section className={s.head} aria-labelledby="lb-title">
            <div>
              <p className={s.kicker}>{monthLabel(month)} · {dept ? `แผนก ${dept}` : 'ทุกแผนก'} · ข้อมูล ณ {thShort(today)}</p>
              <h2 id="lb-title" className={s.title}>{sum.headline.a} {sum.headline.b && <em>{sum.headline.b}</em>}</h2>
              <p className={s.lede}>{sum.lede}</p>
            </div>
            <div className={s.figs}>
              <a className={s.fig} href="#lb-days"><span className={s.k}>รับเข้า</span><span className={clsx(s.v, s.mono)}>{sum.figs.received.v}</span><span className={s.d}>{sum.figs.received.d}</span></a>
              <a className={s.fig} href="#lb-days"><span className={s.k}>ปิดแล้ว</span><span className={clsx(s.v, s.mono)} style={sum.figs.closed.v ? { color: 'var(--ok)' } : undefined}>{sum.figs.closed.v}</span><span className={s.d}>ในเดือนนี้</span></a>
              <a className={s.fig} href="#lb-work"><span className={s.k}>เปิดอยู่ (ทั้งระบบ)</span><span className={clsx(s.v, s.mono)}>{sum.figs.open.v}</span><span className={s.d}>ดูเส้นทางงาน ↓</span></a>
              <a className={s.fig} href="#lb-work"><span className={s.k}>งานด่วน</span><span className={clsx(s.v, s.mono)} style={sum.figs.urgent.v ? { color: 'var(--signal)' } : undefined}>{sum.figs.urgent.v}</span><span className={s.d}>{sum.figs.urgent.v ? 'ต้องทำก่อน' : 'ไม่มีงานด่วนค้าง'}</span></a>
              <a className={s.fig} href="#lb-cost"><span className={s.k}>ค่าใช้จ่ายรวม</span><span className={clsx(s.v, s.mono)}>{fmtB(sum.figs.cost.v)}</span><span className={s.d}>{sum.figs.cost.n} เคส</span></a>
              <a className={s.fig} href="#lb-sat"><span className={s.k}>ความพึงพอใจ</span><span className={clsx(s.v, s.mono)} style={sum.avg == null ? { color: 'var(--ink3)' } : undefined}>{sum.avg == null ? '—' : sum.avg.toFixed(1)}</span><span className={s.d}>{sum.avg == null ? 'ยังไม่มีแบบประเมินเดือนนี้' : `เป้า ${SURVEY_KPI_THRESHOLD}`}</span></a>
            </div>
          </section>

          {/* ───── Work line ───── */}
          <section className={s.sec} id="lb-work" aria-labelledby="lb-work-h">
            <div className={s.sech}>
              <h2 id="lb-work-h">งานที่ยังเปิดอยู่</h2>
              <p>{dept ? `แผนก ${dept}` : 'ทุกแผนก'} · {pool.length} งาน{q && ` · ค้นหา "${q}"`} · เรียงจากค้างนานสุด</p>
              <div className={s.tools}>
                {station && <button type="button" className={s.chip} onClick={() => setStation(null)}>ขั้น: {stationOf(station)?.label} <span aria-hidden>×</span></button>}
                <div className={s.tog} role="group" aria-label="แสดงเฉพาะ">
                  <button type="button" aria-pressed={!onlyStar} onClick={() => setOnlyStar(false)}>ทั้งหมด</button>
                  <button type="button" aria-pressed={onlyStar} onClick={() => setOnlyStar(true)}>ที่ติดตาม ({starCount})</button>
                </div>
                <div className={s.tog} role="group" aria-label="มุมมอง">
                  <button type="button" aria-pressed={view === 'map'} onClick={() => setView('map')}>เส้นทางงาน</button>
                  <button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')} data-testid="lb-view-list">ตาราง</button>
                </div>
              </div>
            </div>

            <div className={s.split}>
              <div className={s.mapcol}>
                {visible === 0 ? (
                  <div className={s.empty} style={{ textAlign: 'center' }}>
                    <b>{onlyStar ? 'ยังไม่ได้ติดตามงานใด' : 'ไม่พบงาน'}</b>
                    <p style={{ margin: '6px 0 12px' }}>{onlyStar ? 'เปิดตั๋วงานแล้วกด "ติดตาม" เพื่อเก็บไว้ที่นี่' : 'ไม่มีงานที่ตรงกับตัวกรองนี้'}</p>
                    <button type="button" className={s.btn} onClick={() => { setStation(null); setOnlyStar(false); setQ(''); }}>ล้างตัวกรอง</button>
                  </div>
                ) : view === 'map' ? (
                  <>
                    <div className={s.scrollx}>
                      <div className={s.line} role="group" aria-label="ขั้นตอนงาน คลิกเพื่อกรอง">
                        {STATIONS.map((st) => {
                          const n = pool.filter((r) => r.station === st.key).length;
                          return (
                            <button key={st.key} type="button" className={s.stn} aria-pressed={station === st.key} onClick={() => setStation(station === st.key ? null : st.key)} data-testid={`lb-stn-${st.key}`}>
                              <span className={clsx(s.pin, s.mono)} style={{ background: STATION_COLOR[st.key] }}>{n}</span>
                              <span className={s.stnLabel}>{st.label}</span><span className={s.stnWho}>รอ {st.who}</span>
                            </button>
                          );
                        })}
                      </div>
                      <div className={s.lanes}>
                        {STATIONS.map((st) => {
                          const items = pool.filter((r) => r.station === st.key).sort((a, b) => b.age - a.age);
                          return (
                            <div key={st.key} className={clsx(s.lane, station && station !== st.key && s.laneDim)}>
                              {items.map((r) => <Stub key={r.no} r={r} dim={!matches(r, q)} on={sel === r.no} star={!!stars[r.no]} maxAge={maxAge} onOpen={() => setSel(r.no)} />)}
                              {!items.length && <span className={s.none}>ว่าง</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <p className={s.note}>แถบใต้ตั๋ว = จำนวนวันนับจากวันที่แจ้ง (ยิ่งยาวยิ่งค้างนาน) · ตัวเลขในวงกลม = จำนวนงานในขั้นนั้น</p>
                  </>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className={s.tbl} style={{ minWidth: 680 }}>
                      <thead><tr>
                        <th scope="col" aria-sort={ariaSort('no')}><button type="button" className={s.sortb} onClick={() => sortList('no')}>เลขที่ {arrow('no')}</button></th>
                        <th scope="col">เรื่อง</th><th scope="col">ขั้นตอน</th>
                        <th scope="col" aria-sort={ariaSort('age')}><button type="button" className={s.sortb} onClick={() => sortList('age')}>ค้างมา {arrow('age')}</button></th>
                        <th scope="col" className={s.r}>ค่าใช้จ่าย</th>
                      </tr></thead>
                      <tbody>
                        {listRows.map((r) => (
                          <tr key={r.no} className={clsx(sel === r.no && s.rowOn)} onClick={() => setSel(r.no)}>
                            <td className={clsx(s.mono, s.nowrap)}><button type="button" className={s.sortb} style={{ color: 'var(--ink)' }} onClick={(e) => { e.stopPropagation(); setSel(r.no); }}>{r.no}</button>{stars[r.no] && <span className={s.star}> ★</span>}</td>
                            <td>{r.t.issue_detail}<span className={s.sub}>{r.t.department} · {r.t.requester_name}</span></td>
                            <td className={s.nowrap}><span className={s.dot} style={{ background: r.station ? STATION_COLOR[r.station] : 'var(--rule)' }} />{stationOf(r.station)?.label}</td>
                            <td className={clsx(s.mono, s.nowrap)}>{r.age} วัน</td>
                            <td className={clsx(s.mono, s.r)}>{fmtB(r.cost)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Detail */}
              <aside className={s.side} aria-label="รายละเอียดงาน">
                {selRow ? <Detail r={selRow} star={!!stars[selRow.no]} onStar={() => toggleStar(selRow.no)} onCopy={() => copyNo(selRow.no)} onFull={() => setFull(selRow.no)} onClose={() => setSel(null)} svc={data.svcMap.get(selRow.no)} /> : (
                  <div className={s.empty}><b>เลือกตั๋วงานเพื่อดูรายละเอียด</b><p style={{ margin: '6px 0 0' }}>จะเห็นว่างานรอใครอยู่ ผ่านมาแล้วกี่ขั้น ใครรับผิดชอบ และค่าใช้จ่าย</p></div>
                )}
              </aside>
            </div>
          </section>

          {/* ───── Days ───── */}
          <section className={s.sec} id="lb-days" aria-labelledby="lb-days-h">
            <div className={s.sech}><h2 id="lb-days-h">งานเข้า–ออก รายวัน</h2><p>■ 1 ช่อง = 1 งานที่รับเข้า · □ = งานที่ปิดในวันนั้น · คลิกวันเพื่อดูงานของวันนั้น</p></div>
            <div className={s.daysWrap}>
              <div className={s.days} role="group" aria-label={`งานรายวัน ${monthLabel(month)}`}>
                {days.map((d) => (
                  <button key={d.key} type="button" className={s.day} aria-pressed={day === d.key} onClick={() => setDay(day === d.key ? null : d.key)} aria-label={`${d.day} · รับเข้า ${d.ins.length} · ปิด ${d.outs.length}`}>
                    {d.ins.map((r) => <span key={'i' + r.no} className={s.sq} />)}
                    {d.outs.map((r) => <span key={'o' + r.no} className={clsx(s.sq, s.sqC)} />)}
                  </button>
                ))}
              </div>
              <div className={clsx(s.dlab, s.mono)} aria-hidden>{days.map((d) => <span key={d.key} className={clsx(d.weekend && s.wkend, d.key === today && s.todayLab)}>{d.day}</span>)}</div>
            </div>
            {day && (
              <div className={s.dayPick}>
                <b>{thShort(day)} :</b>
                {dayItems.map((r) => <button key={r.no} type="button" className={s.btn} style={{ fontWeight: 400 }} onClick={() => setSel(r.no)}><span className={s.mono} style={{ fontWeight: 600 }}>{r.no}</span> {r.closed === day && r.done ? '(ปิด) ' : ''}{r.t.issue_detail}</button>)}
                {!dayItems.length && <span className={s.muted}>ไม่มีงานเข้าหรือปิดในวันนี้</span>}
              </div>
            )}
          </section>

          {/* ───── Cost + context ───── */}
          <section className={s.sec} id="lb-cost" aria-labelledby="lb-cost-h">
            <div className={s.cols}>
              <div className={s.wide}>
                <div className={s.sech}><h2 id="lb-cost-h">บัญชีค่าใช้จ่าย</h2><p>รวมทุกผู้ดำเนินการ · {monthLabel(month)}</p>
                  <div className={s.tools}><div className={s.tog} role="group" aria-label="เรียงตาม">
                    <button type="button" aria-pressed={cSort === 'date'} onClick={() => setCSort('date')}>ตามลำดับงาน</button>
                    <button type="button" aria-pressed={cSort === 'amt'} onClick={() => setCSort('amt')}>ยอดสูงสุดก่อน</button>
                  </div></div>
                </div>
                {ledger.length ? (
                  <div style={{ overflowX: 'auto' }}>
                    <table className={s.tbl} style={{ minWidth: 620 }} data-testid="lb-ledger">
                      <thead><tr><th scope="col">เลขที่</th><th scope="col">รายละเอียดเคส</th><th scope="col">แผนก</th><th scope="col" className={s.r}>จำนวนเงิน</th><th scope="col" className={s.r}>ยอดสะสม</th></tr></thead>
                      <tbody>
                        {ledger.reduce<{ el: React.ReactNode[]; run: number }>((acc, r) => {
                          acc.run += r.cost ?? 0;
                          acc.el.push(
                            <tr key={r.no} onClick={() => setSel(r.no)}>
                              <td className={clsx(s.mono, s.nowrap)} style={{ fontWeight: 600 }}>{r.no}</td>
                              <td>{r.t.issue_detail}<span className={s.sub}>{r.t.job_category || 'ไม่ระบุประเภท'} · {r.t.staff_name || '—'} · {r.station ? stationOf(r.station)?.label : r.done ? 'เสร็จ' : '—'}</span></td>
                              <td>{r.t.department}</td>
                              <td className={clsx(s.mono, s.r)}>{fmtB(r.cost)}</td>
                              <td className={clsx(s.mono, s.r, s.muted)}>{fmtB(acc.run)}</td>
                            </tr>,
                          );
                          return acc;
                        }, { el: [], run: 0 }).el}
                      </tbody>
                      <tfoot><tr><td colSpan={3}>รวม {ledger.length} เคส</td><td className={clsx(s.mono, s.r)} style={{ fontSize: 16 }}>{fmtB(sum.cost)}</td><td /></tr></tfoot>
                    </table>
                  </div>
                ) : <p className={s.muted}>ไม่มีค่าใช้จ่ายในเดือนนี้</p>}
              </div>

              <div id="lb-sat" style={{ scrollMarginTop: 80 }}>
                <div className={s.sech}><h2>ความพึงพอใจ</h2><p>เป้า {SURVEY_KPI_THRESHOLD} คะแนน</p></div>
                {sum.scored.length ? (
                  <>
                    <p style={{ margin: 0 }}><span className={clsx(s.big, s.mono)}>{sum.avg?.toFixed(1)}</span><span className={s.muted}> / 100 · {sum.scored.length} แบบประเมิน</span></p>
                    <p style={{ margin: '2px 0 14px', fontWeight: 600, color: (sum.avg ?? 0) >= SURVEY_KPI_THRESHOLD ? 'var(--ok)' : 'var(--signal)' }}>{(sum.avg ?? 0) >= SURVEY_KPI_THRESHOLD ? 'ผ่านเป้า' : 'ต่ำกว่าเป้า'}</p>
                    <div className={s.rank}>
                      {SURVEY_Q.map((x) => {
                        const vals = sum.scored.map((r) => Number(r.survey?.[x.key] ?? 0));
                        const v = vals.reduce((a, b) => a + b, 0) / Math.max(1, vals.length);
                        return <div key={x.label} className={s.rankRow}><span>{x.label}</span><span className={clsx(s.b, s.bOk)}><span style={{ width: `${(v / x.max) * 100}%` }} /></span><span className={s.mono} style={{ textAlign: 'right' }}>{v.toFixed(1)}</span></div>;
                      })}
                    </div>
                  </>
                ) : <p style={{ margin: 0, color: 'var(--ink2)' }}>ยังไม่มีแบบประเมินของเดือนนี้{sum.figs.closed.v ? '' : ' เพราะยังไม่มีงานที่ปิดแล้ว'}</p>}
                <p style={{ margin: '14px 0 0', paddingTop: 10, borderTop: '1px solid var(--rule2)', fontSize: 13, color: 'var(--ink2)' }}>
                  {sum.waitSurvey ? `รอผู้แจ้งประเมินอีก ${sum.waitSurvey} งาน · ` : ''}
                  {!sum.scored.length && sum.latestAvg != null ? `คะแนนล่าสุดที่มี: ${sum.latestAvg.toFixed(1)} (${monthShortLabel(sum.latestMonthScored)})` : 'คะแนนเต็ม 100 จาก 5 ข้อ'}
                </p>
              </div>

              <div>
                <div className={s.sech}><h2>มาจากแผนกไหน</h2><p>{monthLabel(month)} · คลิกเพื่อกรอง</p></div>
                <div className={s.rank}>
                  {deptRank.map((x) => (
                    <button key={x.label} type="button" className={clsx(s.rankRow, dept === x.label && s.rankOn)} aria-pressed={dept === x.label} onClick={() => setDept(dept === x.label ? '' : x.label)}>
                      <span>{x.label}</span><span className={clsx(s.b, dept && dept !== x.label && s.bMute)}><span style={{ width: `${x.pct}%` }} /></span><span className={s.mono} style={{ textAlign: 'right' }}>{x.n}</span>
                    </button>
                  ))}
                  {!deptRank.length && <p className={s.muted}>ไม่มีงานในเดือนนี้</p>}
                </div>
                <div className={s.sech} style={{ margin: '22px 0 12px' }}><h2>ประเภทงาน</h2></div>
                <div className={s.rank}>
                  {catRank.map((x) => (
                    <div key={x.label} className={s.rankRow}><span className={clsx(x.unknown && s.muted)}>{x.label}</span><span className={clsx(s.b, x.unknown && s.bMute)}><span style={{ width: `${x.pct}%` }} /></span><span className={s.mono} style={{ textAlign: 'right' }}>{x.n}</span></div>
                  ))}
                  {!catRank.length && <p className={s.muted}>ไม่มีงานในเดือนนี้</p>}
                </div>
              </div>
            </div>
          </section>

          <footer className={s.foot}><span>ข้อมูลจากระบบ ICT Service Desk ณ {thShort(today)}</span><span>นับวันจากวันที่แจ้ง · ไม่ได้วัดตามเป้าเวลาให้บริการ</span></footer>
        </div>
      )}
      <TicketDrawer ticketNo={full} onClose={() => setFull(null)} />
    </StaffShell>
  );
}

function Stub({ r, dim, on, star, maxAge, onOpen }: { r: LogRow; dim: boolean; on: boolean; star: boolean; maxAge: number; onOpen: () => void }) {
  return (
    <button type="button" className={clsx(s.stub, dim && s.stubDim)} aria-current={on} onClick={onOpen} aria-label={`${r.no} ${r.t.issue_detail} ค้างมา ${r.age} วัน`} data-testid={`lb-stub-${r.no}`}>
      <span className={s.notch} /><span className={clsx(s.notch, s.notchR)} />
      <span className={s.stubTop}>
        <span className={clsx(s.stubNo, s.mono)}>{r.no}</span>
        {star && <span className={s.star} aria-hidden>★</span>}
        {r.t.priority === 'URGENT' && <span className={s.urg}>ด่วน</span>}
        <span className={clsx(s.stubAge, s.mono)}>{r.age} วัน</span>
      </span>
      <span className={s.stubBody}><span className={s.stubIss}>{r.t.issue_detail}</span><span className={s.stubMeta}>{r.t.department} · {r.t.requester_name}</span></span>
      <span className={s.ageBar}><span style={{ width: `${Math.max(4, (r.age / maxAge) * 100)}%` }} /></span>
    </button>
  );
}

function Detail({ r, star, svc, onStar, onCopy, onFull, onClose }: {
  r: LogRow; star: boolean; svc: Parameters<typeof CaseDocButton>[0]['svc']; onStar: () => void; onCopy: () => void; onFull: () => void; onClose: () => void;
}) {
  const [title, text] = NEXT_STEP[r.t.status];
  const ji = journeyIndex(r.t.status);
  const facts: [string, string][] = [
    ['ผู้รับผิดชอบ', r.t.staff_name || 'ยังไม่มี'],
    ['ดำเนินการโดย', r.t.work_owner ? (r.t.work_owner === 'ITL' ? 'Direct ITL' : 'ICO') : '—'],
    ['ประเภทงาน', r.t.job_category ? (r.t.job_category === 'Other' ? 'อื่นๆ' : r.t.job_category) : 'ยังไม่ระบุ'],
    ['ความเร่งด่วน', r.t.priority === 'URGENT' ? 'ด่วน' : r.t.priority ? 'ปกติ' : 'ยังไม่ระบุ'],
    ['รหัสทรัพย์สิน', r.t.asset_id || '—'],
    ['ค่าใช้จ่าย', fmtB(r.cost)],
    ['ปิดงาน', r.closed ? thShort(r.closed) : 'ยังไม่ปิด'],
  ];
  return (
    <div className={s.panel} data-testid="lb-detail">
      <div className={s.ph}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className={s.mono} style={{ fontWeight: 600 }}>{r.no}</span><span className={s.muted} style={{ fontSize: 12 }}>แจ้ง {thShort(r.req)}</span>
          <button type="button" className={s.x} onClick={onClose} aria-label="ปิดรายละเอียด">×</button>
        </div>
        <h3>{r.t.issue_detail}</h3>
        <p style={{ margin: '4px 0 0', color: 'var(--ink2)' }}>{r.t.requester_name} · {r.t.department} · {r.t.location}</p>
      </div>
      <div className={clsx(s.next, !r.open && s.nextDone)}>
        <ArrowRight className="size-[18px]" style={{ flex: 'none', marginTop: 2 }} aria-hidden />
        <span><b style={{ display: 'block' }}>{title}</b><span style={{ color: 'var(--ink2)', fontSize: 13 }}>{r.open ? text : r.score != null ? `ผู้แจ้งประเมิน ${r.score} คะแนน` : r.done ? 'รอผู้แจ้งทำแบบประเมิน' : text}</span></span>
        <span className={s.mono} style={{ marginLeft: 'auto', textAlign: 'right', whiteSpace: 'nowrap' }}><b style={{ fontSize: 20 }}>{r.age} วัน</b><span className={s.muted} style={{ display: 'block', fontSize: 11 }}>{r.open ? 'นับจากวันที่แจ้ง' : 'ใช้เวลาทั้งหมด'}</span></span>
      </div>
      {ji >= 0 && (
        <div className={s.journey} aria-label="เส้นทางของงานนี้">
          {JOURNEY.map((j, i) => <span key={j} className={clsx(s.jp, (i < ji || r.done) && s.jpDone, i === ji && !r.done && s.jpNow)}><i />{j}</span>)}
        </div>
      )}
      <dl className={s.facts}>{facts.map(([k, v]) => <div key={k} style={{ display: 'contents' }}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      <div className={s.pact}>
        <button type="button" className={s.btn} onClick={onStar} aria-pressed={star}>{star ? '★ ติดตามอยู่' : '☆ ติดตาม'}</button>
        <button type="button" className={s.btn} onClick={onCopy}>คัดลอกเลขที่</button>
        <button type="button" className={s.btn} onClick={onFull}>ดูรายละเอียดเต็ม</button>
        <CaseDocButton t={r.t} svc={svc} label="PDF ใบงาน" />
      </div>
    </div>
  );
}
