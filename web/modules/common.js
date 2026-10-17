// Shared helpers, constants and storage compatibility. No application state or API calls.
export const storage = (() => {try {const key='bijons-check';localStorage.setItem(key,'1');localStorage.removeItem(key);return localStorage;} catch {const mem=new Map();return {getItem:k=>mem.get(k)||null,setItem:(k,v)=>mem.set(k,String(v))};}})();
export const $ = (s, root = document) => root.querySelector(s);
export const $$ = (s, root = document) => [...root.querySelectorAll(s)];
export const mkid = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const attr = esc;
export const ico = (name, cls = '') => `<svg aria-hidden="true" class="icon ${cls}"><use href="#ico-${name}"></use></svg>`;
export const cleanImg = url => {
  const u = String(url || '').trim();
  if (/^https:\/\//i.test(u) && u.length < 1700) return u;
  if (/^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(u) && u.length < 180000) return u;
  return '';
};
export const first = name => [...String(name || '?').trim()][0]?.toUpperCase() || '?';
export const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
export const addDays = (date, n) => { const d = new Date(`${date}T12:00:00`); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10); };
export const nextRepeat = (date, repeat) => {
  const d = new Date(`${date || today()}T12:00:00`);
  if (repeat === 'daily') d.setDate(d.getDate()+1);
  else if (repeat === 'weekly') d.setDate(d.getDate()+7);
  else if (repeat === 'monthly') d.setMonth(d.getMonth()+1);
  return d.toISOString().slice(0,10);
};
export const formatDate = raw => {
  if (!raw) return '';
  if (raw === today()) return 'Vandaag';
  if (raw === addDays(today(),1)) return 'Morgen';
  if (raw === addDays(today(),-1)) return 'Gisteren';
  return new Intl.DateTimeFormat('nl-NL',{day:'numeric',month:'short'}).format(new Date(`${raw}T12:00:00`));
};
export const timeAgo = iso => {
  if (!iso) return '';
  const days = Math.floor((Date.now()-Date.parse(iso))/86400000);
  if (days <= 0) return 'vandaag';
  if (days === 1) return 'gisteren';
  return new Intl.DateTimeFormat('nl-NL',{day:'numeric',month:'short'}).format(new Date(iso));
};
export const THEMES = [{id:'sage',name:'Salie',color:'#74917b'},{id:'rose',name:'Rozen',color:'#bb8390'},{id:'denim',name:'Denim',color:'#6787a1'},{id:'honey',name:'Honing',color:'#b28d55'},{id:'lilac',name:'Sering',color:'#9b88a8'},{id:'pine',name:'Dennen',color:'#628a80'}];
export const STORE_PRESETS = [{id:'supermarkt',name:'Supermarkt'},{id:'drogist',name:'Drogist'},{id:'bouwmarkt',name:'Bouwmarkt'},{id:'action',name:'Action'}];
