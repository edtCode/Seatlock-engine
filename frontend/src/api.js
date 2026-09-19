export const newId=()=>typeof crypto.randomUUID==='function'?crypto.randomUUID():Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,'0')).join('');
export const events=[
{id:'blue-hour',title:'The Blue Hour',category:'Concerts',tag:'LIVE MUSIC · INDIE / SOUL',date:'24 OCT 2026',time:'7:00 PM',venue:'The Royal Opera House',city:'Mumbai',price:1200,color:'#233e59',description:'An intimate evening of independent sound. Discover a new wave of soulful artists in one of the city’s most beautiful rooms.'},
{id:'interstellar',title:'Beyond the Frame',category:'Movies',tag:'CINEMA · SCIENCE FICTION',date:'25 OCT 2026',time:'6:30 PM',venue:'PVR Maison',city:'Mumbai',price:450,color:'#6b6250',description:'An original science-fiction showcase on the big screen. Experience new worlds with immersive sound and a carefully curated selection of independent films.'},
{id:'courtside',title:'Boundary Sundays',category:'Sports',tag:'SPORTS · CRICKET',date:'01 NOV 2026',time:'4:00 PM',venue:'City Cricket Ground',city:'Delhi',price:800,color:'#456251',description:'Feel every play, every cheer, every moment. A friendly exhibition game bringing local teams and their communities together.'},
{id:'good-company',title:'In Good Company',category:'Comedy',tag:'COMEDY · CLEAN STAND-UP',date:'07 NOV 2026',time:'7:30 PM',venue:'The Studio Theatre',city:'Bengaluru',price:600,color:'#745d58',description:'Good stories. Better company. An all-ages evening of clean comedy with a fresh lineup of independent performers.'}
];
const read=(k,f)=>{try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}};
const write=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const pause=()=>new Promise(r=>setTimeout(r,400));
const url=import.meta.env?.VITE_API_URL;
async function request(path,method='GET',body,key){const r=await fetch(url+path,{method,headers:{'Content-Type':'application/json',...(key?{'Idempotency-Key':key}:{})},credentials:'include',...(body?{body:JSON.stringify(body)}:{})});if(!r.ok)throw new Error((await r.json().catch(()=>({}))).message||'The request could not be completed. Please try again.');return r.json()}
export const priceFor=(id,event)=>event.price*(id[0]==='A'?2:['B','C'].includes(id[0])?1.5:1);
export const api={
async events(){return url?request('/events'):(await pause(),events)},
async seats(show){if(url)return request('/shows/'+show+'/seats');await pause();const b=read('sl-bookings',[]).filter(b=>b.showId===show&&b.status==='Booked').flatMap(b=>b.seats);const h=read('sl-hold',null);return Array.from({length:108},(_,i)=>{const id=String.fromCharCode(65+Math.floor(i/12))+(i%12+1);return {id,tier:id[0]==='A'?'VIP':['B','C'].includes(id[0])?'Premium':'Regular',status:b.includes(id)||[7,18,19,36,40,49,62,73,74,85,89,96,101].includes(i)?'Booked':h?.showId===show&&h.expiresAt>Date.now()&&h.seats.includes(id)?'Held':[10,27,58].includes(i)?'Held':'Available'}})},
async hold(showId,seats,key){if(url)return request('/holds','POST',{showId,seats},key);const states=await this.seats(showId);if(seats.some(s=>states.find(x=>x.id===s)?.status!=='Available'))throw new Error('A seat is no longer available. Refresh your selection.');const h={id:key,showId,seats,expiresAt:Date.now()+300000};write('sl-hold',h);return h},
async pay(hold,contact,key,fail=false){if(url)return request('/payments','POST',{holdId:hold.id,contact},key);await pause();const existing=read('sl-bookings',[]);if(existing.find(b=>b.paymentKey===key))return existing.find(b=>b.paymentKey===key);if(fail)throw new Error('Payment declined. Your reservation hold remains until expiry; try again or cancel your reservation.');const active=read('sl-hold',null);if(!active||active.id!==hold.id)throw new Error('This reservation was replaced. Please choose your seats again.');if(hold.expiresAt<=Date.now())throw new Error('Your hold has expired. Please choose seats again.');const b={...hold,id:'SL-'+newId().slice(0,8).toUpperCase(),status:'Booked',contact,paymentKey:key,createdAt:Date.now()};write('sl-bookings',[b,...existing]);localStorage.removeItem('sl-hold');return b},
async bookings(){return url?request('/bookings'):read('sl-bookings',[])},
async cancel(id){if(url)return request('/bookings/'+id,'DELETE');write('sl-bookings',read('sl-bookings',[]).map(b=>b.id===id?{...b,status:'Cancelled'}:b))},
async release(){if(url){const h=read('sl-hold',null);if(h)await request('/holds/'+h.id,'DELETE')}localStorage.removeItem('sl-hold')}
};
export const loadLocal=read;
