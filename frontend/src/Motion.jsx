import {useEffect,useRef} from 'react';
export default function Motion({path}){
 const dot=useRef(null),ring=useRef(null);
 useEffect(()=>{
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  if(reduced.matches||!('IntersectionObserver' in window))return;
  const items=document.querySelectorAll('.ref-section-intro,.ref-problem>div,.ref-flow-card,.ref-event-card,.ref-ticket-composition,.ref-stack-line>div,.page-head,.event-card,.premium-ticket');
  const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('revealed');observer.unobserve(entry.target)}}),{threshold:.08,rootMargin:'0px 0px -25px 0px'});
  items.forEach((el,i)=>{if(el.getBoundingClientRect().top>innerHeight*.9){el.classList.add('scroll-reveal');el.style.setProperty('--reveal-delay',`${Math.min(i%5,3)*65}ms`);observer.observe(el)}});
  return()=>{observer.disconnect();items.forEach(el=>el.classList.remove('scroll-reveal','revealed'))};
 },[path]);
 useEffect(()=>{
  const media=matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
  let frame=0,x=-100,y=-100,rx=-100,ry=-100,active=false;
  const update=()=>{rx+=(x-rx)*.22;ry+=(y-ry)*.22;if(dot.current)dot.current.style.transform=`translate3d(${x}px,${y}px,0)`;if(ring.current)ring.current.style.transform=`translate3d(${rx}px,${ry}px,0)`;frame=requestAnimationFrame(update)};
  const move=e=>{if(!media.matches||e.pointerType==='touch')return;x=e.clientX;y=e.clientY;if(!active){rx=x;ry=y;active=true;document.documentElement.classList.add('custom-cursor-active');frame=requestAnimationFrame(update)};const control=e.target.closest('a,button,summary,input,textarea,select,[role="button"]');document.documentElement.classList.toggle('cursor-hover',!!control);document.documentElement.classList.toggle('cursor-text',!!e.target.closest('input,textarea'))};
  const leave=()=>{active=false;cancelAnimationFrame(frame);document.documentElement.classList.remove('custom-cursor-active','cursor-hover','cursor-down','cursor-text')};
  const down=()=>document.documentElement.classList.add('cursor-down');const up=()=>document.documentElement.classList.remove('cursor-down');
  window.addEventListener('pointermove',move,{passive:true});document.addEventListener('pointerleave',leave);window.addEventListener('blur',leave);window.addEventListener('pointerdown',down);window.addEventListener('pointerup',up);media.addEventListener('change',leave);
  return()=>{leave();window.removeEventListener('pointermove',move);document.removeEventListener('pointerleave',leave);window.removeEventListener('blur',leave);window.removeEventListener('pointerdown',down);window.removeEventListener('pointerup',up);media.removeEventListener('change',leave)};
 },[]);
 return <><div ref={dot} className="cursor-dot" aria-hidden="true"/><div ref={ring} className="cursor-ring" aria-hidden="true"/></>;
}
