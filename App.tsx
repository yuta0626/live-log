import { useEffect, useMemo, useState } from 'react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CalendarDays, Music2, Wallet, MapPin, Plus, Search, Trash2, Download, Upload, LayoutDashboard, Disc3 } from 'lucide-react';

type Song = { id:string; title:string };
type Show = { id:string; date:string; artist:string; tour:string; venue:string; prefecture:string; ticket:number; transport:number; hotel:number; other:number; notes:string; songs:Song[] };
const KEY='live-log-v1';
const envUrl=import.meta.env.VITE_SUPABASE_URL as string|undefined;
const envKey=import.meta.env.VITE_SUPABASE_ANON_KEY as string|undefined;
const supabase:SupabaseClient|null = envUrl && envKey ? createClient(envUrl,envKey) : null;
const yen=(n:number)=>new Intl.NumberFormat('ja-JP').format(n||0)+'円';
const empty:Show={id:'',date:new Date().toISOString().slice(0,10),artist:'',tour:'',venue:'',prefecture:'',ticket:0,transport:0,hotel:0,other:0,notes:'',songs:[]};
const demo:Show[]=[
 {id:'demo-1',date:'2025-02-15',artist:'BUMP OF CHICKEN',tour:'ホームシック衛星2024',venue:'広島グリーンアリーナ',prefecture:'広島県',ticket:11000,transport:2500,hotel:0,other:1500,notes:'デモデータ（編集・削除できます）',songs:[{id:'s1',title:'天体観測'},{id:'s2',title:'ray'}]},
 {id:'demo-2',date:'2025-06-21',artist:'乃木坂46',tour:'真夏の全国ツアー',venue:'明治神宮野球場',prefecture:'東京都',ticket:12000,transport:18000,hotel:9000,other:3000,notes:'デモデータ（編集・削除できます）',songs:[{id:'s3',title:'インフルエンサー'},{id:'s4',title:'シンクロニシティ'}]}
];
function App(){
 const [shows,setShows]=useState<Show[]>(()=>{try{return JSON.parse(localStorage.getItem(KEY)||'null')||demo}catch{return demo}});
 const [tab,setTab]=useState('home'); const [editing,setEditing]=useState<Show|null>(null); const [query,setQuery]=useState(''); const [artistFilter,setArtistFilter]=useState('すべて'); const [status,setStatus]=useState('この端末に保存中');
 useEffect(()=>{localStorage.setItem(KEY,JSON.stringify(shows));},[shows]);
 useEffect(()=>{if(!supabase)return; setStatus('Supabase接続設定あり（同期テーブル準備待ち）');},[]);
 const total=useMemo(()=>shows.reduce((a,s)=>a+s.ticket+s.transport+s.hotel+s.other,0),[shows]);
 const songs=useMemo(()=>Array.from(new Set(shows.flatMap(s=>s.songs.map(x=>x.title)))).sort(),[shows]);
 const artists=useMemo(()=>Array.from(new Set(shows.map(s=>s.artist).filter(Boolean))),[shows]);
 const filtered=shows.filter(s=>(artistFilter==='すべて'||s.artist===artistFilter)&&`${s.artist} ${s.tour} ${s.venue} ${s.prefecture}`.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>b.date.localeCompare(a.date));
 const save=(s:Show)=>{setShows(old=>{const found=old.some(x=>x.id===s.id);return found?old.map(x=>x.id===s.id?s:x):[...old,{...s,id:crypto.randomUUID()}]});setEditing(null);setTab('shows')};
 const remove=(id:string)=>{if(confirm('このライブ記録を削除しますか？'))setShows(x=>x.filter(s=>s.id!==id))};
 const exportData=()=>{const blob=new Blob([JSON.stringify(shows,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='live-log-backup.json';a.click();URL.revokeObjectURL(a.href)};
 const importData=(f:File)=>{const r=new FileReader();r.onload=()=>{try{const v=JSON.parse(String(r.result));if(Array.isArray(v)){setShows(v);alert('読み込みました')}else alert('JSON形式を確認してください')}catch{alert('読み込みに失敗しました')}};r.readAsText(f)};
 return <div className="app"><header><div className="brand"><Disc3/><div><b>LIVE LOG</b><small>MY CONCERT ARCHIVE</small></div></div><span className="save-state">{status}</span></header>
 <nav>{[['home','ホーム',LayoutDashboard],['shows','ライブ実績',CalendarDays],['songs','楽曲管理',Music2],['stats','統計・費用',Wallet]] .map(([id,label,Icon]:any)=><button className={tab===id?'active':''} onClick={()=>{setTab(id);setEditing(null)}} key={id}><Icon size={17}/><span>{label}</span></button>)}</nav>
 <main>
 {tab==='home'&&<><section className="hero"><p>YOUR LIVE HISTORY</p><h1>ライブの思い出を、<br/>ひとつに。</h1><span>参加記録・セットリスト・費用をまとめて管理。</span><button className="primary" onClick={()=>{setEditing({...empty,id:''});setTab('shows')}}><Plus size={17}/>ライブを記録する</button></section>
 <div className="metrics"><Metric icon={<CalendarDays/>} label="参加ライブ" value={`${shows.length}公演`}/><Metric icon={<Music2/>} label="登録楽曲" value={`${songs.length}曲`}/><Metric icon={<Wallet/>} label="累計費用" value={yen(total)}/><Metric icon={<MapPin/>} label="訪問都道府県" value={`${new Set(shows.map(s=>s.prefecture).filter(Boolean)).size}県`}/></div>
 <Section title="最近のライブ" action="すべて見る" onClick={()=>setTab('shows')}/><div className="show-list">{shows.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,3).map(s=><ShowCard key={s.id} s={s} onClick={()=>{setEditing(s);setTab('shows')}}/>)}</div></>}
 {tab==='shows'&&<><div className="page-head"><div><p className="eyebrow">CONCERT ARCHIVE</p><h1>ライブ実績</h1></div><button className="primary" onClick={()=>setEditing({...empty,id:''})}><Plus size={17}/>追加</button></div>
 {editing?<ShowForm initial={editing} onSave={save} onCancel={()=>setEditing(null)}/>:<><div className="filters"><div className="search"><Search size={16}/><input placeholder="アーティスト・会場・ツアーを検索" value={query} onChange={e=>setQuery(e.target.value)}/></div><select value={artistFilter} onChange={e=>setArtistFilter(e.target.value)}><option>すべて</option>{artists.map(a=><option key={a}>{a}</option>)}</select></div><div className="show-list">{filtered.map(s=><div className="record-wrap" key={s.id}><ShowCard s={s} onClick={()=>setEditing(s)}/><button className="delete" onClick={()=>remove(s.id)} aria-label="削除"><Trash2 size={16}/></button></div>)}{!filtered.length&&<p className="empty">該当するライブがありません。</p>}</div></>}</>}
 {tab==='songs'&&<><div className="page-head"><div><p className="eyebrow">SETLIST LIBRARY</p><h1>楽曲管理</h1></div></div><p className="muted">登録済みのセットリストから楽曲を自動集計します。</p><div className="song-list">{songs.map(song=>{const count=shows.filter(s=>s.songs.some(x=>x.title===song)).length;return <div className="song-row" key={song}><Music2/><b>{song}</b><span>{count}公演</span></div>})}{!songs.length&&<p className="empty">ライブ実績にセットリストを登録すると、ここに表示されます。</p>}</div></>}
 {tab==='stats'&&<><div className="page-head"><div><p className="eyebrow">YOUR NUMBERS</p><h1>統計・費用</h1></div></div><div className="metrics"><Metric icon={<CalendarDays/>} label="参加ライブ" value={`${shows.length}公演`}/><Metric icon={<Wallet/>} label="累計費用" value={yen(total)}/><Metric icon={<Music2/>} label="披露楽曲種類" value={`${songs.length}曲`}/></div><h2>アーティスト別</h2>{artists.map(a=><div className="stat-row" key={a}><b>{a}</b><span>{shows.filter(s=>s.artist===a).length}公演</span><span>{yen(shows.filter(s=>s.artist===a).reduce((n,s)=>n+s.ticket+s.transport+s.hotel+s.other,0))}</span></div>)}<h2>費用内訳</h2>{[['チケット',shows.reduce((n,s)=>n+s.ticket,0)],['交通費',shows.reduce((n,s)=>n+s.transport,0)],['ホテル',shows.reduce((n,s)=>n+s.hotel,0)],['その他',shows.reduce((n,s)=>n+s.other,0)]].map(([k,v]:any)=><div className="stat-row" key={k}><b>{k}</b><span>{yen(v)}</span></div>)}</>}
 <footer><div className="data-tools"><button onClick={exportData}><Download size={15}/>バックアップを書き出す</button><label><Upload size={15}/>バックアップを読み込む<input type="file" accept="application/json" onChange={e=>e.target.files?.[0]&&importData(e.target.files[0])}/></label></div><small>LIVE LOG · 初期プロトタイプ · データは現在このブラウザ内に保存されます</small></footer>
 </main></div>
}
function Metric({icon,label,value}:any){return <div className="metric"><span>{icon}</span><small>{label}</small><b>{value}</b></div>}
function Section({title,action,onClick}:any){return <div className="section-head"><h2>{title}</h2><button onClick={onClick}>{action} →</button></div>}
function ShowCard({s,onClick}:any){return <button className="show-card" onClick={onClick}><div className="date">{s.date?.replaceAll('-','.')}</div><div className="show-info"><b>{s.artist||'アーティスト未設定'}</b><span>{s.tour||'公演名未設定'}</span><small><MapPin size={13}/>{s.venue||'会場未設定'} {s.prefecture}</small></div><div className="cost">{yen(s.ticket+s.transport+s.hotel+s.other)}<small>{s.songs.length}曲</small></div></button>}
function ShowForm({initial,onSave,onCancel}:any){
 const [s,setS]=useState<Show>({...initial,songs:initial.songs||[]}); const [songText,setSongText]=useState((initial.songs||[]).map((x:Song)=>x.title).join('\n'));
 const set=(k:keyof Show,v:any)=>setS(old=>({...old,[k]:v}));
 return <form className="form" onSubmit={e=>{e.preventDefault();onSave({...s,songs:songText.split('\n').map((title:string)=>title.trim()).filter(Boolean).map((title:string)=>({id:crypto.randomUUID(),title}))})}}><div className="form-title"><h2>{s.id?'ライブを編集':'ライブを追加'}</h2><button type="button" className="ghost" onClick={onCancel}>閉じる</button></div>
 <div className="form-grid"><Field label="開催日"><input required type="date" value={s.date} onChange={e=>set('date',e.target.value)}/></Field><Field label="アーティスト"><input required placeholder="例：BUMP OF CHICKEN" value={s.artist} onChange={e=>set('artist',e.target.value)}/></Field><Field label="ツアー・公演名"><input value={s.tour} onChange={e=>set('tour',e.target.value)}/></Field><Field label="会場"><input value={s.venue} onChange={e=>set('venue',e.target.value)}/></Field><Field label="都道府県"><input value={s.prefecture} onChange={e=>set('prefecture',e.target.value)}/></Field><Field label="チケット代（円）"><input type="number" min="0" value={s.ticket} onChange={e=>set('ticket',Number(e.target.value))}/></Field><Field label="交通費（円）"><input type="number" min="0" value={s.transport} onChange={e=>set('transport',Number(e.target.value))}/></Field><Field label="ホテル代（円）"><input type="number" min="0" value={s.hotel} onChange={e=>set('hotel',Number(e.target.value))}/></Field><Field label="その他（円）"><input type="number" min="0" value={s.other} onChange={e=>set('other',Number(e.target.value))}/></Field></div>
 <Field label="セットリスト（1行に1曲）"><textarea rows={7} placeholder={'天体観測\nray\nアカシア'} value={songText} onChange={e=>setSongText(e.target.value)}/></Field><Field label="感想・メモ"><textarea rows={3} value={s.notes} onChange={e=>set('notes',e.target.value)}/></Field><div className="form-total">この公演の合計 <b>{yen(s.ticket+s.transport+s.hotel+s.other)}</b></div><button className="primary wide" type="submit">保存する</button></form>
}
function Field({label,children}:any){return <label className="field"><span>{label}</span>{children}</label>}
export default App;