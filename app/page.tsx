"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const ACCENT = "#6378ff";
const ACCENT_MID = "#4f63e8";
const BG = "#0a0a0f";

/* ─────────── SVG Icons ─────────── */
const Icons = {
  users: (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>),
  mail: (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>),
  box: (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>),
  barChart: (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="20" y2="10"/><line x1="18" x2="18" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="16"/><line x1="2" x2="22" y1="20" y2="20"/></svg>),
  store: (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/></svg>),
  shield: (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>),
  checkCircle: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>),
  arrowUp: (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>),
  chevronDown: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>),
  spark: (<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>),
  xMark: (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>),
  play: (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>),
};

/* ─────────── CSS ─────────── */
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,700;0,9..40,900;1,9..40,300&family=DM+Mono:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; }
  body { font-family: 'DM Sans', system-ui, sans-serif; background: ${BG}; color: rgba(238,238,245,0.92); overflow-x: hidden; }
  a { text-decoration: none; color: inherit; }

  @keyframes fadeUp    { from { opacity:0; transform:translateY(28px); } to { opacity:1; transform:translateY(0); } }
  @keyframes fadeIn    { from { opacity:0; } to { opacity:1; } }
  @keyframes floatA    { 0%,100% { transform:translateY(0) scale(1); } 50% { transform:translateY(-24px) scale(1.04); } }
  @keyframes floatB    { 0%,100% { transform:translateY(0) rotate(0deg); } 50% { transform:translateY(16px) rotate(4deg); } }
  @keyframes floatC    { 0%,100% { transform:translateY(0) scale(1); } 33% { transform:translateY(-14px) scale(0.97); } 66% { transform:translateY(10px) scale(1.02); } }
  @keyframes pulse-glow { 0%,100% { box-shadow:0 0 60px rgba(99,120,255,0.35),0 0 120px rgba(99,120,255,0.15),inset 0 1px 0 rgba(99,120,255,0.15); } 50% { box-shadow:0 0 100px rgba(99,120,255,0.55),0 0 200px rgba(99,120,255,0.25),inset 0 1px 0 rgba(99,120,255,0.25); } }
  @keyframes shimmer   { 0% { background-position:-200% center; } 100% { background-position:200% center; } }
  @keyframes gridPan   { from { transform:translateY(0); } to { transform:translateY(40px); } }
  @keyframes notifPulse { 0%,100% { box-shadow:0 8px 32px rgba(0,0,0,0.45),0 0 0 0 rgba(80,210,140,0.50); } 60% { box-shadow:0 8px 32px rgba(0,0,0,0.45),0 0 0 10px rgba(80,210,140,0); } }
  @keyframes scrollBtnIn { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }

  /* ── Aurora ── */
  @keyframes aurora { 0% { background-position:0% 50%; } 50% { background-position:100% 50%; } 100% { background-position:0% 50%; } }

  /* ── Button shimmer ── */
  @keyframes btnShimmer { from { transform:translateX(-120%) skewX(-20deg); } to { transform:translateX(320%) skewX(-20deg); } }

  /* ── Marquee ── */
  @keyframes marquee { from { transform:translateX(0); } to { transform:translateX(-50%); } }
  @keyframes marqueeReverse { from { transform:translateX(-50%); } to { transform:translateX(0); } }
  .lp-marquee-outer { overflow:hidden; -webkit-mask-image:linear-gradient(90deg,transparent,black 12%,black 88%,transparent); mask-image:linear-gradient(90deg,transparent,black 12%,black 88%,transparent); }
  .lp-marquee-track { display:flex; animation:marquee 28s linear infinite; width:max-content; }
  .lp-marquee-track:hover { animation-play-state:paused; }

  /* ── Testimonials ticker ── */
  .lp-ticker-wrapper { overflow:hidden; -webkit-mask-image:linear-gradient(90deg,transparent,black 4%,black 96%,transparent); mask-image:linear-gradient(90deg,transparent,black 4%,black 96%,transparent); }
  .lp-ticker-track { display:flex; width:max-content; }
  .lp-ticker-fwd { animation:marquee 55s linear infinite; }
  .lp-ticker-rev { animation:marqueeReverse 55s linear infinite; }
  .lp-ticker-wrapper:hover .lp-ticker-track { animation-play-state:paused; }

  /* ── Nav live badge ── */
  @keyframes navDotPulse { 0%,100% { box-shadow:0 0 7px rgba(80,210,140,0.70); } 50% { box-shadow:0 0 13px rgba(80,210,140,1); } }
  @keyframes countFade { from { opacity:0; transform:translateY(-4px); } to { opacity:1; transform:translateY(0); } }
  .lp-nav-count { animation:countFade 0.35s ease; }
  .lp-nav-live-badge { display:flex; align-items:center; gap:8px; padding:4px 13px; border-radius:999px; background:rgba(80,210,140,0.07); border:1px solid rgba(80,210,140,0.20); cursor:default; }

  /* ── CTA pulse ── */
  @keyframes ctaPulse { 0%,100% { box-shadow:0 8px 32px rgba(99,120,255,0.35); } 50% { box-shadow:0 8px 32px rgba(99,120,255,0.35),0 0 0 10px rgba(99,120,255,0.09); } }
  .lp-btn-pulse { animation:ctaPulse 2.8s ease-in-out infinite; }
  .lp-btn-pulse:hover { animation:none; }

  /* ── Announcement bar ── */
  @keyframes announcePan { 0%,100% { opacity:1; } 50% { opacity:0.82; } }
  .lp-announcement-bar {
    position:fixed; top:0; left:0; right:0; z-index:1001; height:40px;
    display:flex; align-items:center; justify-content:center; gap:14px; padding:0 16px;
    background:linear-gradient(90deg,rgba(58,28,135,0.98),rgba(90,50,200,0.98),rgba(99,120,255,0.98),rgba(80,40,175,0.98));
    border-bottom:1px solid rgba(99,120,255,0.28); font-size:12.5px; color:rgba(255,255,255,0.92); font-weight:600;
  }
  .lp-announcement-bar a { color:rgba(255,255,255,0.95); font-weight:800; text-decoration:none; display:inline-flex; align-items:center; gap:4px; padding:3px 11px; border-radius:8px; background:rgba(255,255,255,0.14); transition:background 0.15s; border:1px solid rgba(255,255,255,0.18); font-size:11.5px; white-space:nowrap; }
  .lp-announcement-bar a:hover { background:rgba(255,255,255,0.22); }
  .lp-announce-dismiss { display:flex; align-items:center; justify-content:center; width:22px; height:22px; border-radius:6px; background:rgba(255,255,255,0.10); border:none; cursor:pointer; color:rgba(255,255,255,0.70); font-size:14px; line-height:1; margin-left:8px; transition:background 0.15s; flex-shrink:0; }
  .lp-announce-dismiss:hover { background:rgba(255,255,255,0.20); color:#fff; }

  /* ── Scroll reveal ── */
  .lp-reveal { opacity:0; transform:translateY(28px); transition:opacity 0.65s ease, transform 0.65s ease; }
  .lp-reveal.is-visible { opacity:1; transform:translateY(0); }
  .lp-reveal-d1 { transition-delay:0.08s; }
  .lp-reveal-d2 { transition-delay:0.17s; }
  .lp-reveal-d3 { transition-delay:0.26s; }
  .lp-reveal-d4 { transition-delay:0.35s; }
  .lp-reveal-d5 { transition-delay:0.44s; }
  .lp-reveal-d6 { transition-delay:0.53s; }

  .lp-hero-fadeup { animation:fadeUp 0.75s ease both; }
  .lp-hero-fade   { animation:fadeIn 1.2s ease both; }
  .lp-delay-1 { animation-delay:0.10s; }
  .lp-delay-2 { animation-delay:0.22s; }
  .lp-delay-3 { animation-delay:0.36s; }
  .lp-delay-4 { animation-delay:0.52s; }

  .lp-feature-card {
    background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.07); border-radius:20px; padding:28px;
    position:relative;
    transition:border-color 0.28s ease, background 0.28s ease, transform 0.25s ease, box-shadow 0.25s ease; cursor:default;
  }
  .lp-feature-card::before {
    content:''; position:absolute; inset:0; border-radius:20px; padding:1px;
    background:linear-gradient(135deg,rgba(99,120,255,0),rgba(192,132,252,0));
    -webkit-mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);
    -webkit-mask-composite:xor; mask-composite:exclude;
    transition:background 0.35s ease; pointer-events:none;
  }
  .lp-feature-card:hover { border-color:transparent; background:rgba(99,120,255,0.05); transform:translateY(-4px); box-shadow:0 20px 60px rgba(0,0,0,0.4),0 0 40px rgba(99,120,255,0.10); }
  .lp-feature-card:hover::before { background:linear-gradient(135deg,rgba(99,120,255,0.75),rgba(192,132,252,0.55),rgba(80,210,200,0.35)); }

  .lp-pricing-card { animation:pulse-glow 3.5s ease-in-out infinite; }

  /* ── Primary button + shimmer ── */
  .lp-btn-primary {
    display:inline-flex; align-items:center; justify-content:center; gap:8px;
    height:52px; padding:0 28px; border-radius:14px;
    background:linear-gradient(135deg,${ACCENT} 0%,${ACCENT_MID} 100%);
    color:#fff; font-size:15px; font-weight:800; border:none; cursor:pointer;
    transition:opacity 0.2s, transform 0.2s, box-shadow 0.2s;
    box-shadow:0 8px 32px rgba(99,120,255,0.35);
    text-decoration:none; font-family:inherit;
    position:relative; overflow:hidden;
  }
  .lp-btn-primary::after {
    content:''; position:absolute; top:0; bottom:0; left:0; width:45%;
    background:linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent);
    transform:translateX(-200%) skewX(-20deg); pointer-events:none;
  }
  .lp-btn-primary:hover { opacity:0.9; transform:translateY(-2px); box-shadow:0 12px 40px rgba(99,120,255,0.50); }
  .lp-btn-primary:hover::after { animation:btnShimmer 0.60s ease forwards; }
  .lp-btn-primary:active { transform:translateY(0); }

  .lp-btn-ghost {
    display:inline-flex; align-items:center; justify-content:center; gap:8px;
    height:52px; padding:0 26px; border-radius:14px;
    background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.14);
    color:rgba(255,255,255,0.85); font-size:15px; font-weight:700; cursor:pointer;
    transition:background 0.2s, border-color 0.2s, transform 0.2s; text-decoration:none; font-family:inherit;
  }
  .lp-btn-ghost:hover { background:rgba(255,255,255,0.07); border-color:rgba(255,255,255,0.22); transform:translateY(-2px); }

  .lp-nav-btn-connect {
    display:inline-flex; align-items:center; padding:9px 20px; border-radius:8px;
    background:transparent; border:1px solid rgba(255,255,255,0.20);
    color:rgba(255,255,255,0.72); font-size:13.5px; font-weight:600; cursor:pointer;
    transition:border-color 0.15s, color 0.15s, background 0.15s; text-decoration:none; font-family:inherit;
    white-space:nowrap; line-height:1;
  }
  .lp-nav-btn-connect:hover { border-color:rgba(255,255,255,0.40); color:rgba(255,255,255,0.95); background:rgba(255,255,255,0.04); }

  .lp-nav-btn-start {
    display:inline-flex; align-items:center; padding:9px 24px; border-radius:8px;
    background:linear-gradient(135deg,#6378ff 0%,#8b5cf6 100%);
    color:#fff; font-size:13.5px; font-weight:800; border:none; cursor:pointer;
    transition:opacity 0.15s, transform 0.15s, box-shadow 0.15s; box-shadow:0 4px 18px rgba(99,120,255,0.38);
    text-decoration:none; font-family:inherit; white-space:nowrap; line-height:1;
  }
  .lp-nav-btn-start:hover { opacity:0.9; transform:translateY(-1px); box-shadow:0 6px 24px rgba(99,120,255,0.55); }

  .lp-testimonial {
    position:relative; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08);
    border-radius:20px; padding:36px 32px 32px;
    backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px);
    box-shadow:0 8px 32px rgba(0,0,0,0.22);
    transition:border-color 0.28s ease, box-shadow 0.28s ease, transform 0.25s ease;
    overflow:hidden; display:flex; flex-direction:column;
  }
  .lp-testimonial:hover {
    border-color:rgba(99,120,255,0.40); transform:translateY(-6px);
    box-shadow:0 24px 64px rgba(0,0,0,0.38), 0 0 0 1px rgba(99,120,255,0.18);
  }

  .lp-gradient-text {
    background:linear-gradient(135deg, #a0b4ff 0%, ${ACCENT} 40%, #c084fc 100%);
    -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent;
    background-size:200% auto; animation:shimmer 6s linear infinite;
  }

  .lp-tag {
    display:inline-flex; align-items:center; gap:6px; height:28px; padding:0 12px; border-radius:999px;
    background:rgba(99,120,255,0.12); border:1px solid rgba(99,120,255,0.28);
    color:rgba(160,180,255,0.95); font-size:12px; font-weight:700; letter-spacing:0.5px; font-family:'DM Mono',monospace;
  }

  .lp-orb { position:absolute; border-radius:50%; pointer-events:none; filter:blur(80px); }

  .lp-grid-bg {
    position:absolute; inset:0; pointer-events:none; overflow:hidden;
    background-image:linear-gradient(rgba(99,120,255,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(99,120,255,0.04) 1px,transparent 1px);
    background-size:60px 60px; mask-image:radial-gradient(ellipse 80% 80% at 50% 50%,black,transparent);
    animation:gridPan 8s linear infinite alternate;
  }

  .lp-divider { height:1px; background:linear-gradient(90deg,transparent,rgba(99,120,255,0.20),transparent); margin:0 auto; max-width:800px; }

  .lp-hero-section { position:relative; min-height:100vh; display:flex; align-items:center; overflow:hidden; padding-top:64px; }
  .lp-hero-pad { max-width:1140px; margin:0 auto; padding:80px 24px 100px; width:100%; }
  .lp-hero-grid { display:grid; grid-template-columns:1fr 1fr; gap:60px; align-items:center; }

  .lp-section-features   { padding:100px 24px; }
  .lp-section-ba         { padding:80px 24px; }
  .lp-section-howitworks { padding:100px 24px; }
  .lp-section-pricing    { padding:100px 24px; }
  .lp-section-testi      { padding:100px 24px; position:relative; overflow:hidden; }
  .lp-section-faq        { padding:80px 24px; }
  .lp-section-cta        { padding:0 24px 100px; }

  .lp-pricing-inner { width:100%; max-width:560px; border-radius:28px; padding:48px 44px; position:relative; overflow:hidden; }
  .lp-pricing-check-item {
    display:flex; align-items:center; gap:12px; padding:10px 14px; border-radius:10px;
    background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.04);
    transition:background 0.2s, border-color 0.2s;
  }
  .lp-pricing-check-item:hover { background:rgba(99,120,255,0.06); border-color:rgba(99,120,255,0.14); }

  .lp-cta-inner { border-radius:24px; padding:60px 48px; text-align:center; position:relative; overflow:hidden; }

  .lp-footer-grid { display:grid; grid-template-columns:2fr 1fr 1fr 1fr; gap:40px; margin-bottom:48px; }

  .lp-hiw-step { display:flex; flex-direction:column; align-items:center; text-align:center; flex:1; position:relative; z-index:1; }
  .lp-hiw-connector { flex:1; height:1px; margin-top:-46px; position:relative; z-index:0; }

  .lp-faq-item { border-bottom:1px solid rgba(255,255,255,0.06); overflow:hidden; }
  .lp-faq-question { display:flex; align-items:center; justify-content:space-between; padding:22px 0; cursor:pointer; gap:16px; transition:color 0.2s; }
  .lp-faq-question:hover { color:rgba(160,180,255,0.95); }
  .lp-faq-answer { font-size:14.5px; color:rgba(255,255,255,0.50); line-height:1.75; padding-bottom:22px; font-weight:400; max-width:680px; }
  .lp-faq-chevron { flex-shrink:0; transition:transform 0.3s ease; color:rgba(99,120,255,0.7); }
  .lp-faq-chevron.open { transform:rotate(180deg); }

  .lp-scroll-top {
    position:fixed; bottom:32px; right:32px; z-index:999; width:46px; height:46px; border-radius:14px;
    background:rgba(18,20,36,0.92); border:1px solid rgba(99,120,255,0.30);
    display:flex; align-items:center; justify-content:center; cursor:pointer; color:rgba(160,180,255,0.9);
    box-shadow:0 8px 32px rgba(0,0,0,0.50),0 0 20px rgba(99,120,255,0.12); backdrop-filter:blur(12px);
    transition:opacity 0.3s, transform 0.25s, border-color 0.2s, box-shadow 0.2s;
    animation:scrollBtnIn 0.3s ease both;
  }
  .lp-scroll-top:hover { border-color:rgba(99,120,255,0.55); box-shadow:0 12px 40px rgba(0,0,0,0.5),0 0 30px rgba(99,120,255,0.22); transform:translateY(-3px); }

  .lp-popular-badge {
    display:inline-flex; align-items:center; gap:6px; padding:5px 14px; border-radius:999px;
    background:linear-gradient(135deg,rgba(99,120,255,0.30),rgba(192,132,252,0.20)); border:1px solid rgba(99,120,255,0.40);
    color:rgba(200,210,255,0.95); font-size:12px; font-weight:800; letter-spacing:0.4px; font-family:'DM Mono',monospace;
    box-shadow:0 0 20px rgba(99,120,255,0.25); position:absolute; top:-16px; left:50%; transform:translateX(-50%); white-space:nowrap;
  }

  /* ── Before/After ── */
  .lp-ba-grid { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
  .lp-ba-card { border-radius:20px; padding:32px; border:1px solid; }

  /* ── Mobile sticky CTA ── */
  .lp-sticky-cta {
    display:none; position:fixed; bottom:0; left:0; right:0; z-index:990;
    padding:12px 16px 20px; background:rgba(8,8,16,0.97);
    border-top:1px solid rgba(99,120,255,0.16); backdrop-filter:blur(20px);
  }

  /* ── Testimonials carousel ── */
  .lp-testi-carousel { display:none; }

  /* ── Hamburger ── */
  .lp-hamburger {
    display:none; flex-direction:column; justify-content:center; gap:5px;
    cursor:pointer; padding:6px 4px; border:none; background:transparent; z-index:1010;
  }
  .lp-hamburger span {
    display:block; width:22px; height:2px; background:rgba(255,255,255,0.80); border-radius:2px;
    transition:transform 0.25s ease, opacity 0.2s ease;
  }
  .lp-hamburger.open span:nth-child(1) { transform:translateY(7px) rotate(45deg); }
  .lp-hamburger.open span:nth-child(2) { opacity:0; transform:scaleX(0); }
  .lp-hamburger.open span:nth-child(3) { transform:translateY(-7px) rotate(-45deg); }

  /* ── Mobile drawer overlay ── */
  .lp-drawer-overlay {
    display:none; position:fixed; inset:0; z-index:1004;
    background:rgba(0,0,0,0.60);
  }
  .lp-drawer-overlay.open { display:block; }

  /* ── Mobile side drawer (slide from left) ── */
  .lp-drawer {
    position:fixed; top:0; left:0; bottom:0; z-index:1006;
    width:280px; max-width:82vw;
    background:rgba(10,10,20,0.55); backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px);
    border-right:1px solid rgba(255,255,255,0.10);
    display:flex; flex-direction:column;
    transform:translateX(-100%); transition:transform 0.32s cubic-bezier(0.4,0,0.2,1);
    box-shadow:4px 0 48px rgba(0,0,0,0.65);
  }
  .lp-drawer.open { transform:translateX(0); }
  .lp-drawer-link {
    display:flex; align-items:center; gap:14px;
    padding:14px 24px; font-size:15px; font-weight:600;
    color:rgba(255,255,255,0.68); border-bottom:1px solid rgba(255,255,255,0.05);
    text-decoration:none; transition:background 0.15s, color 0.15s;
  }
  .lp-drawer-link:hover { color:rgba(255,255,255,0.97); background:rgba(255,255,255,0.03); }
  .lp-drawer-link-icon { width:18px; height:18px; flex-shrink:0; opacity:0.55; }

  /* ── Announce short text (mobile only) ── */
  .lp-announce-short { display:none; }

  /* ════ MOBILE ════ */
  @media (max-width:768px) {
    /* Navbar */
    .lp-nav-links      { display:none !important; }
    .lp-nav-live-badge { display:none !important; }
    .lp-nav-btn-connect { display:inline-flex !important; padding:6px 12px !important; font-size:12px !important; height:auto !important; line-height:1 !important; border-radius:6px !important; }
    .lp-nav-btn-start  { padding:6px 14px !important; font-size:12px !important; height:auto !important; line-height:1 !important; border-radius:6px !important; }
    .lp-hamburger      { display:flex; }
    .lp-nav-inner      { padding:0 14px !important; justify-content:space-between !important; }
    .lp-nav-logo       { display:none !important; }
    .lp-nav-right      { gap:8px !important; padding-right:0 !important; }

    /* Announcement bar */
    .lp-announcement-bar { font-size:12px !important; gap:8px !important; padding:0 12px !important; }
    .lp-announce-long  { display:none !important; }
    .lp-announce-short { display:inline !important; }
    .lp-announce-dismiss { margin-left:0 !important; }

    /* Hero */
    .lp-hero-section { min-height:auto; align-items:flex-start; }
    .lp-hero-pad     { padding:32px 20px 56px; }
    .lp-hero-grid    { grid-template-columns:1fr; gap:36px; }
    .lp-hero-title   { font-size:clamp(32px,8vw,72px) !important; letter-spacing:-1.2px !important; }
    .lp-hero-ctas    { flex-direction:column !important; align-items:stretch !important; gap:10px !important; }
    .lp-hero-ctas a  { width:100% !important; justify-content:center !important; }
    .lp-hero-stats   { display:grid !important; grid-template-columns:repeat(3,1fr) !important; gap:0 8px !important; margin-top:28px !important; }

    /* Features */
    .lp-section-features { padding:56px 20px; }
    .lp-features-grid  { grid-template-columns:1fr !important; gap:10px !important; }
    .lp-feature-card   { padding:16px 18px !important; }

    /* How it works */
    .lp-section-howitworks { padding:56px 20px; }
    .lp-hiw-steps { flex-direction:column !important; align-items:center !important; gap:0 !important; padding:0 8px; }
    .lp-hiw-step  { width:100% !important; max-width:none !important; padding:0 16px; }
    .lp-hiw-connector { display:block !important; flex:none !important; width:2px !important; height:44px !important; margin:4px auto !important; background:repeating-linear-gradient(to bottom,rgba(99,120,255,0.60) 0,rgba(99,120,255,0.60) 4px,transparent 4px,transparent 9px) !important; }
    .lp-hiw-connector svg { display:none !important; }

    /* Pricing */
    .lp-section-pricing { padding:56px 20px; }
    .lp-pricing-inner   { padding:28px 20px !important; border-radius:20px !important; max-width:100% !important; }

    /* Testimonials carousel */
    .lp-testimonials-grid { display:none !important; }
    .lp-testi-carousel { display:block; }
    .lp-section-testi  { padding:56px 0; }
    .lp-ticker-row-2   { display:none !important; }
    .lp-testi-ccard    { width:280px !important; }

    /* Before/After */
    .lp-section-ba { padding:48px 20px; }
    .lp-ba-grid    { grid-template-columns:1fr !important; }

    /* FAQ */
    .lp-section-faq { padding:48px 20px; }

    /* CTA band */
    .lp-section-cta { padding:0 20px 56px; }
    .lp-cta-inner   { padding:32px 20px !important; border-radius:18px !important; }

    /* Footer */
    .lp-footer-grid  { grid-template-columns:1fr !important; gap:24px; }
    .lp-footer-brand { grid-column:auto !important; }

    /* Sticky CTA — always visible on mobile */
    .lp-sticky-cta { display:flex !important; opacity:1 !important; transform:none !important; pointer-events:auto !important; }

    /* Scroll top */
    .lp-scroll-top { bottom:84px !important; right:16px !important; }
    footer { padding-bottom:88px !important; }
  }
`;

/* ─────────── Data ─────────── */
const STAT_TARGETS = [1284, 8420, 34];
const STAT_META = [
  { label: "Clients",    color: "rgba(99,120,255,0.9)" },
  { label: "CA ce mois", color: "rgba(80,210,140,0.9)" },
  { label: "Relances",   color: "rgba(255,180,60,0.9)" },
];
const ROW_NAMES   = ["Marie Dupont","Lucas Martin","Sophie Girard","Thomas Bernard","Emma Leroy"];
const ROW_AMOUNTS = [340, 180, 90, 520, 75];

const FEATURES = [
  { icon: Icons.users,    title: "Gestion clients",         desc: "Fiches complètes, historique des achats, tags automatiques VIP / régulier / inactif / nouveau. Filtres et recherche instantanée.",                                         color: "rgba(99,120,255,0.9)",  bg: "rgba(99,120,255,0.10)"  },
  { icon: Icons.mail,     title: "Relances email ciblées",   desc: "Campagnes par segment (VIP, inactifs, sans achat…) avec templates HTML personnalisables. Envoi via Resend en un clic.",                                                    color: "rgba(80,210,200,0.9)",  bg: "rgba(80,210,200,0.10)"  },
  { icon: Icons.box,      title: "Inventaire & stock",       desc: "Suivi des stocks en temps réel, alertes de rupture, mouvements d'entrée/sortie liés aux ventes. Jamais en rupture surprise.",                                              color: "rgba(255,180,60,0.9)",  bg: "rgba(255,180,60,0.10)"  },
  { icon: Icons.barChart, title: "Analytiques avancées",     desc: "Dashboard revenus, performances par vendeur, tendances mensuelles. Réservé au propriétaire pour une vision 360° de votre boutique.",                                        color: "rgba(160,120,255,0.9)", bg: "rgba(160,120,255,0.10)" },
  { icon: Icons.store,    title: "Multi-boutiques",          desc: "Gérez plusieurs points de vente depuis une seule interface. Données 100% isolées par boutique, basculement en un clic.",                                                    color: "rgba(255,120,120,0.9)", bg: "rgba(255,120,120,0.10)" },
  { icon: Icons.shield,   title: "Système de rôles",         desc: "Trois niveaux d'accès : Owner, Admin, Vendeur. Permissions granulaires, fermeture de boutique à distance, invitations par email.",                                         color: "rgba(80,210,140,0.9)",  bg: "rgba(80,210,140,0.10)"  },
];

const TESTIMONIALS = [
  { name: "Camille Renard",  role: "Gérante — Boutique Lumière, Lyon",        avatar: "CR", avatarColor: "#6378ff", stars: 5, text: "ClientFlow a transformé la gestion de ma boutique. Avant, je perdais des heures à chercher les infos clients dans des fichiers Excel. Maintenant, tout est là, structuré, et mes relances email font revenir les inactifs chaque mois." },
  { name: "Thomas Vasseur",  role: "Propriétaire — Galerie Essence, Bordeaux", avatar: "TV", avatarColor: "#4ecdc4", stars: 5, text: "Le système multi-boutiques est exactement ce dont j'avais besoin pour mes deux points de vente. Les analytiques m'ont permis de réaliser que 80% de mon CA venait de 20% de mes clients. Game changer." },
  { name: "Nadia Ouali",     role: "Co-gérante — Studio Naïa, Paris",          avatar: "NO", avatarColor: "#c084fc", stars: 5, text: "L'outil est beau, rapide, et vraiment pensé pour les commerçants physiques. Le système de rôles nous permet de déléguer à nos vendeuses sans stress. Support très réactif." },
  { name: "Marc Bonnet",     role: "Gérant — L'Atelier du Cuir, Montpellier", avatar: "MB", avatarColor: "#f59e0b", stars: 5, text: "En trois semaines, j'ai récupéré plus de 40 clients inactifs grâce aux relances ciblées. Le tableau de bord analytiques m'a clairement montré où concentrer mes efforts. ROI immédiat." },
  { name: "Léa Fontaine",    role: "Fondatrice — Maison Cloé, Toulouse",       avatar: "LF", avatarColor: "#ec4899", stars: 5, text: "J'avais peur que ce soit compliqué à prendre en main, mais l'import CSV m'a pris 8 minutes chrono. Mes vendeuses ont adopté l'outil en une journée. Je recommande les yeux fermés." },
  { name: "Sophie Martin",   role: "Gérante — La Perle Rose, Nice",             avatar: "SM", avatarColor: "#38bdf8", stars: 5, text: "Avant ClientFlow, je n'avais aucune visibilité sur mes clients fidèles. Maintenant je sais exactement qui relancer, quand et pourquoi. Mon taux de retour a augmenté de 35%." },
  { name: "Antoine Duval",   role: "Fondateur — Galerie Côté Jardin, Nantes",   avatar: "AD", avatarColor: "#34d399", stars: 5, text: "Le système de rôles est parfait pour notre organisation. Ma gérante a accès à tout, mes vendeurs voient juste ce qu'il faut. Simple, puissant, sans friction." },
  { name: "Emma Petit",      role: "Co-gérante — L'Instant Mode, Strasbourg",   avatar: "EP", avatarColor: "#fb923c", stars: 5, text: "J'utilise ClientFlow depuis 4 mois et je ne reviens pas en arrière. Les relances automatisées m'ont économisé facilement 3h par semaine. Pour ce prix, c'est imbattable." },
  { name: "Julien Moreau",   role: "Propriétaire — Le Vestiaire, Rennes",       avatar: "JM", avatarColor: "#a78bfa", stars: 5, text: "Le dashboard analytiques m'a révélé que mes 50 meilleurs clients représentaient 70% de mon CA. J'ai pu adapter toute ma stratégie en conséquence. Une vraie révélation." },
];

const FAQ_ITEMS = [
  { q: "Quel est le modèle de prix exact ?",                              a: "450 € de setup unique, puis 20 €/mois. Le setup couvre la configuration complète de votre boutique, l'import de vos données existantes et la formation initiale. L'abonnement mensuel couvre l'hébergement, les sauvegardes, les mises à jour et le support." },
  { q: "Y a-t-il un engagement minimum ?",                               a: "Non. L'abonnement à 20 €/mois est sans engagement, résiliable à tout moment depuis vos paramètres. Vos données vous restent accessibles pendant 30 jours après résiliation pour export." },
  { q: "Comment migrer mes données existantes (Excel, tableur) ?",       a: "Très simplement : ClientFlow accepte les fichiers CSV et Excel. Sur la page Import, vous mappez vos colonnes (prénom, nom, email, téléphone…) et l'outil importe en dédupliquant automatiquement. La plupart des migrations prennent moins de 10 minutes. Pour des volumes importants ou des données complexes, notre équipe vous accompagne gratuitement lors du setup." },
  { q: "Comment fonctionnent les relances email avec Resend ?",          a: "ClientFlow s'intègre directement avec Resend pour l'envoi transactionnel. Vous configurez votre propre clé API Resend (offre gratuite jusqu'à 3 000 emails/mois), puis composez vos campagnes depuis l'interface. Vous gardez le contrôle total sur l'envoi et les coûts." },
  { q: "Puis-je gérer plusieurs boutiques avec un seul compte ?",        a: "Oui, le multi-boutiques est inclus sans surcoût. Chaque boutique a ses propres données, équipe, rôles et paramètres. Vous basculez entre vos espaces en un clic depuis la barre de navigation." },
  { q: "Où sont hébergées mes données ?",                                a: "Toutes les données sont hébergées sur Supabase (infrastructure PostgreSQL sur AWS eu-west, région Europe). Les accès sont sécurisés par Row Level Security — chaque workspace est strictement isolé. Aucune donnée n'est partagée entre clients." },
  { q: "Quel support est inclus ?",                                      a: "Support par email avec réponse sous 24h en semaine. Les abonnés bénéficient d'un accès prioritaire et d'une session d'onboarding vidéo. Les mises à jour produit sont incluses et déployées automatiquement." },
];

const HIW_STEPS = [
  { num: "01", title: "Créez votre boutique",       desc: "Inscrivez-vous, nommez votre espace, invitez votre équipe avec les bons rôles. Prêt en moins de 5 minutes.",                                              color: "rgba(99,120,255,0.9)",  bg: "rgba(99,120,255,0.10)",  border: "rgba(99,120,255,0.25)"  },
  { num: "02", title: "Importez vos clients",        desc: "Uploadez votre fichier CSV existant. ClientFlow analyse, déduplique et enrichit automatiquement chaque fiche client.",                                   color: "rgba(80,210,200,0.9)",  bg: "rgba(80,210,200,0.08)",  border: "rgba(80,210,200,0.22)"  },
  { num: "03", title: "Automatisez vos relances",    desc: "Choisissez un segment (VIP, inactifs, nouveaux…), personnalisez le template, envoyez. Vos clients reviennent.",                                         color: "rgba(192,132,252,0.9)", bg: "rgba(192,132,252,0.08)", border: "rgba(192,132,252,0.22)" },
];

const TYPED_PHRASES = [
  "gestion clients intelligente",
  "relances email automatiques",
  "analytiques en temps réel",
];

/* ─────────── Utility ─────────── */
function fmtCount(val: number, i: number) {
  if (i === 0) return val.toLocaleString("fr-FR");
  if (i === 1) return val.toLocaleString("fr-FR") + " €";
  return val + " env.";
}

/* ─────────── useReveal hook ─────────── */
function useReveal() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add("is-visible"); observer.unobserve(e.target); }
      }),
      { threshold: 0.15 }
    );
    document.querySelectorAll(".lp-reveal").forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

/* ─────────── ParticlesCanvas ─────────── */
function ParticlesCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = (canvas.width  = canvas.offsetWidth);
    let h = (canvas.height = canvas.offsetHeight);

    const pts = Array.from({ length: 55 }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.28, vy: (Math.random() - 0.5) * 0.28,
      r: Math.random() * 1.4 + 0.4, op: Math.random() * 0.32 + 0.08,
    }));

    let raf: number;
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const p of pts) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(160,180,255,${p.op})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    draw();

    const onResize = () => {
      w = canvas.width  = canvas.offsetWidth;
      h = canvas.height = canvas.offsetHeight;
    };
    window.addEventListener("resize", onResize, { passive: true });
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); };
  }, []);
  return <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", opacity: 0.7 }} />;
}

/* ─────────── TypewriterText ─────────── */
function TypewriterText() {
  const [phraseIdx, setPhraseIdx] = useState(0);
  const [displayed,  setDisplayed]  = useState("");
  const [deleting,   setDeleting]   = useState(false);
  const [cursor,     setCursor]     = useState(true);

  useEffect(() => {
    const phrase = TYPED_PHRASES[phraseIdx];
    let t: ReturnType<typeof setTimeout>;
    if (!deleting && displayed.length < phrase.length) {
      t = setTimeout(() => setDisplayed(phrase.slice(0, displayed.length + 1)), 55);
    } else if (!deleting && displayed.length === phrase.length) {
      t = setTimeout(() => setDeleting(true), 2200);
    } else if (deleting && displayed.length > 0) {
      t = setTimeout(() => setDisplayed(displayed.slice(0, -1)), 28);
    } else if (deleting && displayed.length === 0) {
      setDeleting(false);
      setPhraseIdx((phraseIdx + 1) % TYPED_PHRASES.length);
    }
    return () => clearTimeout(t);
  }, [displayed, deleting, phraseIdx]);

  useEffect(() => {
    const t = setInterval(() => setCursor(v => !v), 530);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{ marginBottom: 20, height: 22 }}>
      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, color: "rgba(160,180,255,0.75)", letterSpacing: 0.4 }}>
        {">"} {displayed}<span style={{ opacity: cursor ? 1 : 0, color: ACCENT, fontWeight: 900, marginLeft: 1 }}>|</span>
      </span>
    </div>
  );
}

/* ─────────── HeroStats ─────────── */
function HeroStats() {
  const ref = useRef<HTMLDivElement>(null);
  const [vals, setVals] = useState([0, 0]);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setStarted(true); obs.disconnect(); }
    }, { threshold: 0.5 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!started) return;
    const dur = 1400; const t0 = performance.now(); let raf: number;
    const tick = (now: number) => {
      const p = Math.min((now - t0) / dur, 1); const e = 1 - Math.pow(1 - p, 3);
      setVals([Math.round(1200 * e), Math.round(98 * e)]);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [started]);

  return (
    <div ref={ref} className="lp-hero-fadeup lp-delay-4 lp-hero-stats" style={{ marginTop: 40, display: "flex", gap: 32, flexWrap: "wrap" }}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 900, color: "rgba(255,255,255,0.95)", fontFamily: "'DM Mono',monospace" }}>
          {vals[0] >= 1200 ? "1 200+" : vals[0].toLocaleString("fr-FR")}
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.38)", marginTop: 2, fontWeight: 600, letterSpacing: 0.3 }}>Clients gérés</div>
      </div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 900, color: "rgba(255,255,255,0.95)", fontFamily: "'DM Mono',monospace" }}>
          {vals[1] >= 98 ? "98%" : vals[1] + "%"}
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.38)", marginTop: 2, fontWeight: 600, letterSpacing: 0.3 }}>Satisfaction</div>
      </div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 900, color: "rgba(255,255,255,0.95)", fontFamily: "'DM Mono',monospace" }}>{"< 2 min"}</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.38)", marginTop: 2, fontWeight: 600, letterSpacing: 0.3 }}>Prise en main</div>
      </div>
    </div>
  );
}

/* ─────────── DashboardMockup ─────────── */
function DashboardMockup() {
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef       = useRef<number | null>(null);
  const targetTilt   = useRef({ x: 0, y: 0 });
  const currentTilt  = useRef({ x: 0, y: 0 });

  const [tilt,        setTilt]        = useState({ x: 0, y: 0 });
  const [isMobile,    setIsMobile]    = useState(false);
  const [counts,      setCounts]      = useState([0, 0, 0]);
  const [rowsVisible, setRowsVisible] = useState([false, false, false, false, false]);
  const [notifVis,    setNotifVis]    = useState(false);

  useEffect(() => { setIsMobile(window.matchMedia("(max-width:768px)").matches); }, []);

  useEffect(() => {
    const dur = 1500; let t0: number | null = null; let raf: number;
    const tick = (now: number) => {
      if (t0 === null) t0 = now;
      const p = Math.min((now - t0) / dur, 1); const e = 1 - Math.pow(1 - p, 3);
      setCounts(STAT_TARGETS.map(v => Math.round(v * e)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const ts = ROW_NAMES.map((_, i) =>
      setTimeout(() => setRowsVisible(prev => { const n = [...prev]; n[i] = true; return n; }), 650 + i * 160)
    );
    return () => ts.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    let active = true; const ts: ReturnType<typeof setTimeout>[] = [];
    const cycle = () => {
      if (!active) return; setNotifVis(true);
      ts.push(setTimeout(() => { if (!active) return; setNotifVis(false); ts.push(setTimeout(() => cycle(), 2200)); }, 3000));
    };
    ts.push(setTimeout(cycle, 1000));
    return () => { active = false; ts.forEach(clearTimeout); };
  }, []);

  useEffect(() => {
    if (isMobile) return;
    const onMouse = (e: MouseEvent) => {
      const el = containerRef.current; if (!el) return;
      const r = el.getBoundingClientRect();
      targetTilt.current = { x: ((e.clientX - r.left - r.width/2) / (r.width/2)) * 15, y: ((e.clientY - r.top - r.height/2) / (r.height/2)) * 15 };
    };
    window.addEventListener("mousemove", onMouse, { passive: true });
    const animate = () => {
      const lf = 0.07;
      currentTilt.current.x += (targetTilt.current.x - currentTilt.current.x) * lf;
      currentTilt.current.y += (targetTilt.current.y - currentTilt.current.y) * lf;
      setTilt({ ...currentTilt.current }); rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { window.removeEventListener("mousemove", onMouse); if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [isMobile]);

  useEffect(() => {
    if (!isMobile) return;
    const onOri = (e: DeviceOrientationEvent) => {
      targetTilt.current = { x: Math.max(-15, Math.min(15, e.gamma ?? 0)), y: Math.max(-10, Math.min(10, (e.beta ?? 45) - 45)) };
    };
    window.addEventListener("deviceorientation", onOri, { passive: true });
    const animate = () => {
      const lf = 0.05;
      currentTilt.current.x += (targetTilt.current.x - currentTilt.current.x) * lf;
      currentTilt.current.y += (targetTilt.current.y - currentTilt.current.y) * lf;
      setTilt({ ...currentTilt.current }); rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { window.removeEventListener("deviceorientation", onOri); if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [isMobile]);

  const tx = tilt.x; const ty = tilt.y;

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%", maxWidth: 540, margin: "0 auto" }}>
      <div style={{ position: "absolute", inset: -40, borderRadius: "50%", background: "radial-gradient(circle, rgba(99,120,255,0.18) 0%, transparent 70%)", pointerEvents: "none", transform: `translate(${tx * 0.4}px, ${ty * 0.4}px)` }} />

      <div style={{ animation: "floatA 7s ease-in-out infinite" }}>
        <div style={{ transform: `perspective(1100px) rotateX(${-ty * 0.25}deg) rotateY(${tx * 0.25}deg)`, willChange: "transform" }}>
          <div style={{ borderRadius: 20, overflow: "hidden", background: "linear-gradient(180deg,rgba(18,18,30,0.95),rgba(10,10,18,0.98))", border: "1px solid rgba(99,120,255,0.22)", boxShadow: "0 40px 120px rgba(0,0,0,0.7),0 0 0 1px rgba(99,120,255,0.08)" }}>
            <div style={{ height: 44, background: "rgba(12,12,22,0.9)", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", padding: "0 16px", gap: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "rgba(255,80,80,0.7)"   }} />
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "rgba(255,180,50,0.7)" }} />
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "rgba(80,210,100,0.7)" }} />
              <div style={{ flex: 1 }} />
              <div style={{ height: 24, width: 120, borderRadius: 6, background: "rgba(99,120,255,0.12)", border: "1px solid rgba(99,120,255,0.20)" }} />
            </div>
            <div style={{ display: "flex", minHeight: 300 }}>
              <div style={{ width: 52, background: "rgba(8,8,18,0.6)", borderRight: "1px solid rgba(255,255,255,0.05)", padding: "14px 8px", display: "flex", flexDirection: "column", gap: 8 }}>
                {[0,1,2,3,4,5].map(i => (
                  <div key={i} style={{ width: 36, height: 36, borderRadius: 9, background: i===0?"rgba(99,120,255,0.18)":"transparent", border: i===0?"1px solid rgba(99,120,255,0.30)":"1px solid transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ width: 16, height: 2, borderRadius: 2, background: i===0?"rgba(99,120,255,0.9)":"rgba(255,255,255,0.18)" }} />
                  </div>
                ))}
              </div>
              <div style={{ flex: 1, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                  {STAT_META.map((s, i) => (
                    <div key={i} style={{ borderRadius: 10, padding: "10px 12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <div style={{ fontSize: 9, opacity: 0.5, marginBottom: 4, fontFamily: "'DM Mono',monospace", letterSpacing: 0.5 }}>{s.label}</div>
                      <div style={{ fontSize: 13, fontWeight: 900, color: s.color, fontFamily: "'DM Mono',monospace" }}>{fmtCount(counts[i], i)}</div>
                    </div>
                  ))}
                </div>
                <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid rgba(255,255,255,0.05)" }}>
                  {ROW_NAMES.map((name, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: i%2===0?"rgba(255,255,255,0.015)":"transparent", borderBottom: i<4?"1px solid rgba(255,255,255,0.04)":"none", opacity: rowsVisible[i]?1:0, transform: rowsVisible[i]?"translateX(0)":"translateX(-10px)", transition: `opacity 0.35s ease ${i*0.04}s, transform 0.35s ease ${i*0.04}s` }}>
                      <div style={{ width: 22, height: 22, borderRadius: "50%", background: `hsl(${220+i*30},60%,55%)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, color: "#fff", flexShrink: 0 }}>{name[0]}</div>
                      <div style={{ flex: 1, fontSize: 11, fontWeight: 600, opacity: 0.85 }}>{name}</div>
                      <div style={{ fontSize: 9, padding: "2px 7px", borderRadius: 999, background: i===0?"rgba(255,200,50,0.12)":i===2?"rgba(99,120,255,0.12)":"rgba(255,255,255,0.05)", border: `1px solid ${i===0?"rgba(255,200,50,0.25)":i===2?"rgba(99,120,255,0.25)":"rgba(255,255,255,0.08)"}`, color: i===0?"rgba(255,210,60,0.95)":i===2?"rgba(99,120,255,0.9)":"rgba(255,255,255,0.5)", fontWeight: 700 }}>
                        {i===0?"VIP":i===2?"Nouveau":"Régulier"}
                      </div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(80,210,140,0.85)", fontFamily: "'DM Mono',monospace" }}>{ROW_AMOUNTS[i]}€</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Notification badge — layer 2.2x */}
      <div style={{ position: "absolute", top: 20, right: -20, zIndex: 10, transform: `translate(${tx*2.2}px,${ty*1.8}px)` }}>
        <div style={{ opacity: notifVis?1:0, transform: `scale(${notifVis?1:0.84})`, transition: "opacity 0.38s ease, transform 0.38s ease" }}>
          <div style={{ background: "linear-gradient(135deg,rgba(80,210,140,0.16),rgba(60,200,120,0.08))", border: "1px solid rgba(80,210,140,0.32)", borderRadius: 12, padding: "10px 16px", backdropFilter: "blur(12px)", boxShadow: "0 8px 32px rgba(0,0,0,0.4)", animation: notifVis?"notifPulse 2s ease-in-out infinite":"none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(80,210,140,0.9)", flexShrink: 0, boxShadow: "0 0 6px rgba(80,210,140,0.8)" }} />
              <div style={{ fontSize: 10, color: "rgba(80,210,140,0.9)", fontWeight: 800, fontFamily: "'DM Mono',monospace" }}>Relance envoyée</div>
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", marginTop: 4 }}>34 clients inactifs</div>
          </div>
        </div>
      </div>

      {/* Stats badge — layer 1.4x */}
      <div style={{ position: "absolute", bottom: 24, left: -16, zIndex: 10, transform: `translate(${tx*1.4}px,${ty*1.2}px)` }}>
        <div style={{ animation: "floatC 6s ease-in-out infinite" }}>
          <div style={{ background: "linear-gradient(135deg,rgba(99,120,255,0.15),rgba(79,99,232,0.08))", border: "1px solid rgba(99,120,255,0.28)", borderRadius: 12, padding: "10px 16px", backdropFilter: "blur(12px)", boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>
            <div style={{ fontSize: 10, color: "rgba(160,180,255,0.95)", fontWeight: 800, fontFamily: "'DM Mono',monospace" }}>+18% ce mois</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", marginTop: 2 }}>Chiffre d'affaires</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────── FaqItem ─────────── */
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="lp-faq-item">
      <div className="lp-faq-question" onClick={() => setOpen(!open)} role="button" aria-expanded={open}>
        <span style={{ fontSize: 15.5, fontWeight: 700, color: open?"rgba(200,210,255,0.95)":"rgba(255,255,255,0.82)", transition: "color 0.2s", flex: 1 }}>{q}</span>
        <span className={`lp-faq-chevron${open?" open":""}`}>{Icons.chevronDown}</span>
      </div>
      {open && <div className="lp-faq-answer" style={{ animation: "fadeUp 0.22s ease both" }}>{a}</div>}
    </div>
  );
}

/* ─────────── TestiCarouselCard ─────────── */
function TestiCarouselCard({ t }: { t: typeof TESTIMONIALS[0] }) {
  return (
    <div className="lp-testi-ccard" style={{
      width: 340, flexShrink: 0, marginRight: 20,
      background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 18, padding: "22px 22px 18px",
      backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
      position: "relative", display: "flex", flexDirection: "column",
      transition: "border-color 0.25s ease, box-shadow 0.25s ease",
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(99,120,255,0.35)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 16px 48px rgba(0,0,0,0.32)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
    >
      {/* Decorative quote SVG */}
      <svg width="26" height="26" viewBox="0 0 32 32" fill="none" style={{ position: "absolute", top: 16, left: 16, opacity: 0.10, pointerEvents: "none" }}>
        <path d="M4 20c0-5.523 4.477-10 10-10V4C7.373 4 2 9.373 2 16v10h12V16H4v4zm18-10V4c-6.627 0-12 5.373-12 12v10h12V16h-10v4c0-3.314 2.686-6 6-6z" fill="#a0b4ff"/>
      </svg>

      {/* Stars top-right */}
      <div style={{ position: "absolute", top: 18, right: 18, display: "flex", gap: 2 }}>
        {Array.from({ length: t.stars }).map((_, i) => (
          <svg key={i} width="12" height="12" viewBox="0 0 24 24" fill="rgba(245,183,50,0.88)">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
        ))}
      </div>

      {/* Quote */}
      <p style={{ fontSize: 14, fontStyle: "italic", lineHeight: 1.68, color: "rgba(255,255,255,0.82)", fontWeight: 400, paddingTop: 14, paddingRight: 36, flexGrow: 1, marginBottom: 18 }}>{t.text}</p>

      {/* Separator */}
      <div style={{ height: 1, background: "linear-gradient(90deg, rgba(99,120,255,0.30), rgba(192,132,252,0.15), transparent)", marginBottom: 14 }} />

      {/* Author */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
          background: `linear-gradient(135deg, ${t.avatarColor} 0%, ${t.avatarColor}88 100%)`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 900, color: "#fff",
          boxShadow: `0 0 0 2px rgba(10,10,15,0.9), 0 0 0 3px ${t.avatarColor}40`,
        }}>{t.avatar}</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: "rgba(255,255,255,0.95)" }}>{t.name}</div>
          <div style={{ fontSize: 11.5, color: "rgba(160,180,255,0.60)", marginTop: 2, fontWeight: 500 }}>{t.role}</div>
        </div>
      </div>
    </div>
  );
}

/* ─────────── TestimonialsSection ─────────── */
function TestimonialsSection() {
  const row1 = TESTIMONIALS.slice(0, 5);
  const row2 = TESTIMONIALS.slice(5);

  return (
    <section id="testimonials" className="lp-section-testi">
      {/* Radial violet glow */}
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 80% 60% at 50% 40%, rgba(99,120,255,0.09) 0%, transparent 70%)", pointerEvents: "none" }} />

      {/* Header — constrained */}
      <div style={{ maxWidth: 1140, margin: "0 auto", padding: "0 24px 60px", position: "relative" }}>
        <div className="lp-reveal" style={{ textAlign: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 18, padding: "6px 16px", borderRadius: 999, background: "rgba(245,183,50,0.08)", border: "1px solid rgba(245,183,50,0.20)" }}>
            <div style={{ display: "flex", gap: 2 }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <svg key={i} width="12" height="12" viewBox="0 0 24 24" fill="rgba(245,183,50,0.90)">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
              ))}
            </div>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: "rgba(245,183,50,0.90)", fontFamily: "'DM Mono',monospace" }}>4.9/5 · 47 avis vérifiés</span>
          </div>
          <div><span className="lp-tag" style={{ marginBottom: 18, display: "inline-flex" }}>{Icons.spark} Témoignages</span></div>
          <h2 style={{ fontSize: "clamp(28px,4vw,46px)", fontWeight: 900, letterSpacing: "-1px", color: "rgba(255,255,255,0.95)", marginTop: 16 }}>Ils ont adopté ClientFlow</h2>
        </div>
      </div>

      {/* Row 1 — scroll left */}
      <div className="lp-ticker-wrapper" style={{ marginBottom: 20 }}>
        <div className="lp-ticker-track lp-ticker-fwd">
          {[...row1, ...row1].map((t, i) => <TestiCarouselCard key={i} t={t} />)}
        </div>
      </div>

      {/* Row 2 — scroll right (hidden on mobile) */}
      <div className="lp-ticker-wrapper lp-ticker-row-2">
        <div className="lp-ticker-track lp-ticker-rev">
          {[...row2, ...row2].map((t, i) => <TestiCarouselCard key={i} t={t} />)}
        </div>
      </div>
    </section>
  );
}

/* ─────────── FeaturesSection (accordion on mobile) ─────────── */
function FeaturesSection() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width:768px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const toggle = (i: number) => setOpenIdx(prev => prev === i ? null : i);

  return (
    <section id="features" className="lp-section-features">
      <div style={{ maxWidth: 1140, margin: "0 auto" }}>
        <div className="lp-reveal" style={{ textAlign: "center", marginBottom: 64 }}>
          <span className="lp-tag" style={{ marginBottom: 20, display: "inline-flex" }}>{Icons.spark} Fonctionnalités</span>
          <h2 style={{ fontSize: "clamp(28px,4vw,46px)", fontWeight: 900, letterSpacing: "-1px", color: "rgba(255,255,255,0.95)", marginTop: 16, marginBottom: 16 }}>Tout ce dont votre boutique a besoin</h2>
          <p style={{ fontSize: 16, color: "rgba(255,255,255,0.45)", maxWidth: 520, margin: "0 auto", lineHeight: 1.7 }}>Un seul outil pour remplacer vos fichiers Excel, vos SMS manuels et vos tableurs de stock.</p>
        </div>
        <div className="lp-features-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 18 }}>
          {FEATURES.map((f, i) => {
            const isOpen = openIdx === i;
            return (
              <div
                key={f.title}
                className={`lp-feature-card lp-reveal lp-reveal-d${i + 1}`}
                onClick={() => { if (isMobile) toggle(i); }}
                style={{ cursor: isMobile ? "pointer" : "default" }}
              >
                {isMobile ? (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 11, background: f.bg, color: f.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{f.icon}</div>
                      <h3 style={{ fontSize: 15, fontWeight: 800, color: "rgba(255,255,255,0.95)", flex: 1, margin: 0 }}>{f.title}</h3>
                      <span style={{ color: "rgba(160,180,255,0.55)", fontSize: 20, fontWeight: 300, transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 0.4s cubic-bezier(0.4,0,0.2,1)", flexShrink: 0, lineHeight: 1, display: "block" }}>›</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateRows: isOpen ? "1fr" : "0fr", transition: "grid-template-rows 0.4s cubic-bezier(0.4,0,0.2,1)", overflow: "hidden" }}>
                      <div style={{ minHeight: 0, opacity: isOpen ? 1 : 0, transition: `opacity ${isOpen ? "0.35s" : "0.2s"} ease`, transitionDelay: isOpen ? "50ms" : "0ms" }}>
                        <p style={{ fontSize: 13.5, color: "rgba(255,255,255,0.45)", lineHeight: 1.68, fontWeight: 400, paddingTop: 12 }}>{f.desc}</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ width: 46, height: 46, borderRadius: 13, background: f.bg, color: f.color, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18, flexShrink: 0 }}>{f.icon}</div>
                    <h3 style={{ fontSize: 17, fontWeight: 800, color: "rgba(255,255,255,0.95)", marginBottom: 10 }}>{f.title}</h3>
                    <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.68, fontWeight: 400 }}>{f.desc}</p>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─────────── MAIN ─────────── */
export default function LandingPage() {
  const [scrolled,           setScrolled]           = useState(false);
  const [showScrollTop,      setShowScrollTop]      = useState(false);
  const [showSticky,         setShowSticky]         = useState(false);
  const [urgencyCount,       setUrgencyCount]       = useState(12);
  const [announcementDismissed, setAnnouncementDismissed] = useState(false);
  const [navActiveCount,     setNavActiveCount]     = useState(14);
  const [demoEmail,          setDemoEmail]          = useState("");
  const [demoSubmitted,      setDemoSubmitted]      = useState(false);
  const [drawerOpen,         setDrawerOpen]         = useState(false);

  useReveal();

  useEffect(() => {
    setUrgencyCount(Math.floor(Math.random() * 9) + 7);
    setNavActiveCount(Math.floor(Math.random() * 11) + 10);
    let navTimer: ReturnType<typeof setTimeout>;
    const scheduleNext = () => {
      const delay = Math.floor(Math.random() * 60_000) + 60_000; // 1–2 min
      navTimer = setTimeout(() => {
        setNavActiveCount(Math.floor(Math.random() * 11) + 10);
        scheduleNext();
      }, delay);
    };
    scheduleNext();
    return () => clearTimeout(navTimer);
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 24);
      setShowScrollTop(y > 300);
      setShowSticky(y > 500);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <div style={{ background: BG, minHeight: "100vh", overflowX: "hidden" }}>
      <style>{CSS}</style>

      {/* ══════════ ANNOUNCEMENT BAR ══════════ */}
      {!announcementDismissed && (
        <div className="lp-announcement-bar">
          <span className="lp-announce-long" style={{ whiteSpace: "nowrap" }}>🎉 Offre de lancement — <strong>450€ au lieu de 800€</strong> · Places limitées</span>
          <span className="lp-announce-short">🎉 <strong>-44%</strong> · Offre lancement</span>
          <a href="#pricing" style={{ flexShrink: 0 }}>En profiter →</a>
          <button className="lp-announce-dismiss" onClick={() => setAnnouncementDismissed(true)} aria-label="Fermer">✕</button>
        </div>
      )}

      {/* ══════════ NAVBAR ══════════ */}
      <header style={{ position: "fixed", top: announcementDismissed ? 0 : 40, left: 0, right: 0, zIndex: 1000, height: 64, background: scrolled?"rgba(10,10,15,0.90)":"transparent", backdropFilter: scrolled?"blur(20px)":"none", borderBottom: scrolled?"1px solid rgba(99,120,255,0.10)":"1px solid transparent", transition: "background 0.3s, backdrop-filter 0.3s, border-color 0.3s, top 0.3s" }}>
        <div className="lp-nav-inner" style={{ maxWidth: 1200, margin: "0 auto", height: "100%", padding: "0 32px", display: "flex", alignItems: "center" }}>

          {/* Hamburger — affiché à gauche sur mobile uniquement */}
          <button
            className={`lp-hamburger${drawerOpen ? " open" : ""}`}
            onClick={() => setDrawerOpen(v => !v)}
            aria-label={drawerOpen ? "Fermer le menu" : "Ouvrir le menu"}
          >
            <span /><span /><span />
          </button>

          {/* Zone gauche — logo */}
          <div className="lp-nav-logo" style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 10, marginLeft: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: `linear-gradient(135deg,${ACCENT},${ACCENT_MID})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff", fontFamily: "'DM Mono',monospace", boxShadow: "0 0 16px rgba(99,120,255,0.40)" }}>CF</div>
            <span style={{ fontFamily: "'DM Mono',monospace", fontWeight: 600, fontSize: 13, letterSpacing: 2, color: "rgba(255,255,255,0.92)", whiteSpace: "nowrap" }}>CLIENTFLOW</span>
          </div>

          {/* Zone centre — liens nav */}
          <nav className="lp-nav-links" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 44 }}>
            {[["Fonctionnalités","#features"],["Comment ça marche","#how-it-works"],["Tarif","#pricing"],["Témoignages","#testimonials"]].map(([label, href]) => (
              <a key={href} href={href} style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.58)", transition: "color 0.15s", whiteSpace: "nowrap" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.95)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.58)"; }}>
                {label}
              </a>
            ))}
          </nav>

          {/* Zone droite — boutons */}
          <div className="lp-nav-right" style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 12, paddingRight: 8 }}>
            <Link href="/login" className="lp-nav-btn-connect">Connexion</Link>
            <a href="#stripe-placeholder" className="lp-nav-btn-start">Démarrer</a>
          </div>

        </div>
      </header>

      {/* ══════════ DRAWER OVERLAY ══════════ */}
      <div className={`lp-drawer-overlay${drawerOpen ? " open" : ""}`} onClick={() => setDrawerOpen(false)} />

      {/* ══════════ MOBILE DRAWER (slide from left) ══════════ */}
      <div className={`lp-drawer${drawerOpen ? " open" : ""}`}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px", borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: `linear-gradient(135deg,${ACCENT},${ACCENT_MID})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#fff", fontFamily: "'DM Mono',monospace", boxShadow: "0 0 12px rgba(99,120,255,0.40)" }}>CF</div>
            <span style={{ fontFamily: "'DM Mono',monospace", fontWeight: 600, fontSize: 11, letterSpacing: 1.5, color: "rgba(255,255,255,0.90)", whiteSpace: "nowrap" }}>CLIENTFLOW</span>
          </div>
          <button onClick={() => setDrawerOpen(false)} style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.70)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, lineHeight: 1, fontFamily: "inherit" }}>✕</button>
        </div>

        {/* Nav links */}
        <nav style={{ flex: 1, overflowY: "auto" }}>
          {[
            { label: "Fonctionnalités",    href: "#features",      icon: <svg className="lp-drawer-link-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg> },
            { label: "Comment ça marche",  href: "#how-it-works",  icon: <svg className="lp-drawer-link-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg> },
            { label: "Tarif",              href: "#pricing",       icon: <svg className="lp-drawer-link-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg> },
            { label: "Témoignages",        href: "#testimonials",  icon: <svg className="lp-drawer-link-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg> },
          ].map(({ label, href, icon }) => (
            <a key={href} href={href} className="lp-drawer-link" onClick={() => setDrawerOpen(false)}>
              {icon}
              {label}
            </a>
          ))}
        </nav>

        {/* Bottom buttons */}
        <div style={{ padding: "20px", borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", flexDirection: "column", gap: 10, flexShrink: 0 }}>
          <Link href="/login" onClick={() => setDrawerOpen(false)} style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 46, borderRadius: 10, border: "1px solid rgba(255,255,255,0.18)", color: "rgba(255,255,255,0.78)", fontWeight: 700, fontSize: 14, textDecoration: "none" }}>Connexion</Link>
          <a href="#stripe-placeholder" className="lp-btn-primary" onClick={() => setDrawerOpen(false)} style={{ height: 46, fontSize: 14, borderRadius: 10, justifyContent: "center" }}>Démarrer →</a>
        </div>

      </div>

      {/* ══════════ HERO ══════════ */}
      <section className="lp-hero-section" style={{ paddingTop: announcementDismissed ? 64 : 104 }}>
        {/* Aurora overlay */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "linear-gradient(-45deg,rgba(99,120,255,0.06),rgba(192,132,252,0.04),rgba(80,210,200,0.03),rgba(99,120,255,0.07))", backgroundSize: "400% 400%", animation: "aurora 25s ease infinite" }} />
        {/* Particles */}
        <ParticlesCanvas />
        {/* Orbs */}
        <div className="lp-orb" style={{ width: 700, height: 700, top: -200, left: -200, background: "radial-gradient(circle,rgba(99,120,255,0.18) 0%,transparent 70%)", animation: "floatA 12s ease-in-out infinite" }} />
        <div className="lp-orb" style={{ width: 500, height: 500, top: 100, right: -100, background: "radial-gradient(circle,rgba(192,132,252,0.12) 0%,transparent 70%)", animation: "floatB 10s ease-in-out infinite" }} />
        <div className="lp-orb" style={{ width: 400, height: 400, bottom: 0, left: "30%", background: "radial-gradient(circle,rgba(99,120,255,0.10) 0%,transparent 70%)", animation: "floatC 14s ease-in-out infinite" }} />
        <div className="lp-grid-bg" />

        <div className="lp-hero-pad">
          <div className="lp-hero-grid">
            <div>
              <div className="lp-hero-fadeup lp-delay-1" style={{ marginBottom: 16 }}>
                <span className="lp-tag">{Icons.spark} CRM pour commerçants physiques</span>
              </div>
              <h1 className="lp-hero-fadeup lp-delay-2 lp-hero-title" style={{ fontSize: "clamp(38px,5vw,62px)", fontWeight: 900, lineHeight: 1.08, letterSpacing: "-1.5px", color: "rgba(255,255,255,0.97)", marginBottom: 16 }}>
                Gérez votre boutique.{" "}
                <span className="lp-gradient-text">Fidélisez vos clients.</span>
              </h1>
              <div className="lp-hero-fadeup lp-delay-2"><TypewriterText /></div>
              <p className="lp-hero-fadeup lp-delay-3" style={{ fontSize: 17, color: "rgba(255,255,255,0.52)", lineHeight: 1.72, marginBottom: 38, maxWidth: 500, fontWeight: 400 }}>
                ClientFlow est le CRM tout-en-un pensé pour les boutiques physiques — gestion clients, relances email automatiques, suivi des stocks et analytiques en temps réel.
              </p>
              <div className="lp-hero-fadeup lp-delay-4 lp-hero-ctas" style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
                <a href="#stripe-placeholder" className="lp-btn-primary lp-btn-pulse">Commencer maintenant →</a>
                <a href="#features" className="lp-btn-ghost">{Icons.play} Voir les fonctionnalités</a>
              </div>
              <HeroStats />
            </div>
            <div className="lp-hero-fade lp-delay-2" style={{ position: "relative" }}>
              <DashboardMockup />
            </div>
          </div>
        </div>

        <div style={{ position: "absolute", bottom: 32, left: "50%", transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, opacity: 0.3, animation: "floatA 2.5s ease-in-out infinite" }}>
          <div style={{ fontSize: 11, fontFamily: "'DM Mono',monospace", letterSpacing: 1 }}>SCROLL</div>
          <div style={{ width: 1, height: 32, background: "linear-gradient(to bottom,rgba(255,255,255,0.4),transparent)" }} />
        </div>
      </section>

      {/* ══════════ BEFORE / AFTER ══════════ */}
      <section className="lp-section-ba">
        <div style={{ maxWidth: 1140, margin: "0 auto" }}>
          <div className="lp-reveal" style={{ textAlign: "center", marginBottom: 52 }}>
            <span className="lp-tag" style={{ marginBottom: 20, display: "inline-flex" }}>{Icons.spark} Transformation</span>
            <h2 style={{ fontSize: "clamp(26px,4vw,42px)", fontWeight: 900, letterSpacing: "-1px", color: "rgba(255,255,255,0.95)", marginTop: 16, marginBottom: 12 }}>Avant ClientFlow. Après ClientFlow.</h2>
            <p style={{ fontSize: 16, color: "rgba(255,255,255,0.40)", maxWidth: 440, margin: "0 auto", lineHeight: 1.65 }}>La différence entre subir sa gestion et la maîtriser.</p>
          </div>

          <div className="lp-ba-grid lp-reveal lp-reveal-d1">
            {/* AVANT */}
            <div className="lp-ba-card" style={{ borderColor: "rgba(255,80,80,0.20)", background: "rgba(255,40,40,0.03)" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 24, padding: "6px 14px", borderRadius: 10, background: "rgba(255,80,80,0.10)", border: "1px solid rgba(255,80,80,0.20)" }}>
                <span style={{ fontSize: 13, fontWeight: 900, color: "rgba(255,100,100,0.90)", fontFamily: "'DM Mono',monospace", letterSpacing: 1 }}>AVANT</span>
                <span style={{ fontSize: 15 }}>😓</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {["Fichiers Excel éparpillés","Clients perdus de vue après l'achat","Relances manuelles, une par une","Stock géré dans un carnet papier","Aucune vision chiffrée de votre CA"].map(item => (
                  <div key={item} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 22, height: 22, borderRadius: 6, background: "rgba(255,80,80,0.12)", border: "1px solid rgba(255,80,80,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "rgba(255,100,100,0.85)" }}>{Icons.xMark}</div>
                    <span style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", fontWeight: 500 }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* APRÈS */}
            <div className="lp-ba-card" style={{ borderColor: "rgba(80,210,140,0.22)", background: "rgba(80,210,140,0.03)" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 24, padding: "6px 14px", borderRadius: 10, background: "rgba(80,210,140,0.10)", border: "1px solid rgba(80,210,140,0.22)" }}>
                <span style={{ fontSize: 13, fontWeight: 900, color: "rgba(80,210,140,0.90)", fontFamily: "'DM Mono',monospace", letterSpacing: 1 }}>APRÈS</span>
                <span style={{ fontSize: 15 }}>✨</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {["Base clients centralisée & segmentée","Alertes clients inactifs automatiques","Campagnes email ciblées en 2 clics","Stocks en temps réel avec alertes rupture","Analytiques & rapports par vendeur"].map(item => (
                  <div key={item} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 22, height: 22, borderRadius: 6, background: "rgba(80,210,140,0.12)", border: "1px solid rgba(80,210,140,0.28)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "rgba(80,210,140,0.9)" }}>{Icons.checkCircle}</div>
                    <span style={{ fontSize: 14, color: "rgba(255,255,255,0.80)", fontWeight: 600 }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="lp-divider" />

      {/* ══════════ FEATURES ══════════ */}
      <FeaturesSection />

      <div className="lp-divider" />

      {/* ══════════ HOW IT WORKS ══════════ */}
      <section id="how-it-works" className="lp-section-howitworks">
        <div style={{ maxWidth: 1140, margin: "0 auto" }}>
          <div className="lp-reveal" style={{ textAlign: "center", marginBottom: 64 }}>
            <span className="lp-tag" style={{ marginBottom: 20, display: "inline-flex" }}>{Icons.spark} Mise en route</span>
            <h2 style={{ fontSize: "clamp(28px,4vw,46px)", fontWeight: 900, letterSpacing: "-1px", color: "rgba(255,255,255,0.95)", marginTop: 16, marginBottom: 16 }}>Comment ça marche ?</h2>
            <p style={{ fontSize: 16, color: "rgba(255,255,255,0.45)", maxWidth: 460, margin: "0 auto", lineHeight: 1.7 }}>Trois étapes pour transformer la gestion de votre boutique.</p>
          </div>
          <div className="lp-hiw-steps" style={{ display: "flex", alignItems: "flex-start", gap: 0 }}>
            {HIW_STEPS.map((step, i) => (
              <>
                <div key={step.num} className={`lp-hiw-step lp-reveal lp-reveal-d${i + 1}`} style={{ maxWidth: 300 }}>
                  <div style={{ width: 72, height: 72, borderRadius: "50%", background: step.bg, border: `1px solid ${step.border}`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24, boxShadow: `0 0 32px ${step.bg}` }}>
                    <span style={{ fontFamily: "'DM Mono',monospace", fontWeight: 900, fontSize: 22, color: step.color }}>{step.num}</span>
                  </div>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: "rgba(255,255,255,0.95)", marginBottom: 12 }}>{step.title}</h3>
                  <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.7, fontWeight: 400, maxWidth: 240, margin: "0 auto" }}>{step.desc}</p>
                </div>
                {i < HIW_STEPS.length - 1 && (
                  <div key={`conn-${i}`} className="lp-hiw-connector" style={{ marginTop: 36 }}>
                    <svg width="100%" height="2" viewBox="0 0 100 2" preserveAspectRatio="none">
                      <line x1="0" y1="1" x2="100" y2="1" stroke="url(#connGrad)" strokeWidth="1" strokeDasharray="4 4"/>
                      <defs><linearGradient id="connGrad" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="rgba(99,120,255,0.6)"/><stop offset="100%" stopColor="rgba(99,120,255,0.15)"/></linearGradient></defs>
                    </svg>
                  </div>
                )}
              </>
            ))}
          </div>
        </div>
      </section>

      <div className="lp-divider" />

      {/* ══════════ PRICING ══════════ */}
      <section id="pricing" className="lp-section-pricing">
        <div style={{ maxWidth: 1140, margin: "0 auto" }}>
          <div className="lp-reveal" style={{ textAlign: "center", marginBottom: 72 }}>
            <span className="lp-tag" style={{ marginBottom: 20, display: "inline-flex" }}>{Icons.spark} Tarif</span>
            <h2 style={{ fontSize: "clamp(28px,4vw,46px)", fontWeight: 900, letterSpacing: "-1px", color: "rgba(255,255,255,0.95)", marginTop: 16, marginBottom: 16 }}>Simple et transparent</h2>
            <p style={{ fontSize: 16, color: "rgba(255,255,255,0.45)", maxWidth: 460, margin: "0 auto", lineHeight: 1.7 }}>Une seule offre — tout inclus. Pas de surprises, pas de niveaux à déchiffrer.</p>
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div style={{ position: "relative", paddingTop: 20 }} className="lp-reveal">
              <div className="lp-popular-badge">{Icons.spark} Le plus populaire</div>
              <div className="lp-pricing-card lp-pricing-inner" style={{ background: "linear-gradient(145deg,rgba(22,24,44,0.98),rgba(10,11,22,0.99))", border: "1px solid rgba(99,120,255,0.38)" }}>
                <div style={{ position: "absolute", top: -100, right: -100, width: 360, height: 360, borderRadius: "50%", background: "radial-gradient(circle,rgba(99,120,255,0.18) 0%,transparent 70%)", pointerEvents: "none" }} />
                <div style={{ position: "absolute", bottom: -80, left: -80, width: 280, height: 280, borderRadius: "50%", background: "radial-gradient(circle,rgba(192,132,252,0.12) 0%,transparent 70%)", pointerEvents: "none" }} />
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg,transparent,rgba(99,120,255,0.50),transparent)", pointerEvents: "none" }} />

                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 28, padding: "0 14px", borderRadius: 999, background: "rgba(99,120,255,0.16)", border: "1px solid rgba(99,120,255,0.35)", color: "rgba(160,180,255,0.95)", fontSize: 11, fontWeight: 800, letterSpacing: 0.5, marginBottom: 16, fontFamily: "'DM Mono',monospace" }}>⚡ OFFRE UNIQUE</div>

                {/* Urgency social proof */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24, padding: "8px 12px", borderRadius: 10, background: "rgba(80,210,140,0.06)", border: "1px solid rgba(80,210,140,0.14)" }}>
                  <div style={{ display: "flex", flexShrink: 0 }}>
                    {["#6378ff","#4ecdc4","#c084fc"].map((c, i) => (
                      <div key={i} style={{ width: 20, height: 20, borderRadius: "50%", background: c, border: "2px solid rgba(10,11,22,0.99)", marginLeft: i>0?-7:0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, fontWeight: 800, color: "#fff" }}>{["CR","TV","NO"][i]}</div>
                    ))}
                  </div>
                  <span style={{ fontSize: 12.5, color: "rgba(255,255,255,0.50)", lineHeight: 1.3 }}>
                    <span style={{ color: "rgba(80,210,140,0.95)", fontWeight: 800 }}>+{urgencyCount}</span> boutiques ont rejoint cette semaine
                  </span>
                </div>

                <div style={{ marginBottom: 8 }}>
                  <span style={{ fontSize: 62, fontWeight: 900, color: "rgba(255,255,255,0.97)", letterSpacing: "-2px", fontFamily: "'DM Mono',monospace" }}>450€</span>
                  <span style={{ fontSize: 16, color: "rgba(255,255,255,0.45)", marginLeft: 8, fontWeight: 500 }}>une fois</span>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 12 }}>
                  <span style={{ fontSize: 30, fontWeight: 900, color: "rgba(99,120,255,0.95)", fontFamily: "'DM Mono',monospace" }}>+ 20€</span>
                  <span style={{ fontSize: 14, color: "rgba(255,255,255,0.40)", fontWeight: 500 }}>/mois ensuite</span>
                </div>
                <p style={{ fontSize: 14, color: "rgba(255,255,255,0.38)", marginBottom: 36, lineHeight: 1.65 }}>Setup complet + accès permanent à la plateforme. L'abonnement mensuel couvre l'hébergement, les mises à jour et le support.</p>

                <div style={{ height: 1, background: "linear-gradient(90deg,transparent,rgba(99,120,255,0.25),transparent)", marginBottom: 28 }} />

                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 36 }}>
                  {["Clients & ventes illimités","Boutiques multiples illimitées","Relances email HTML (Resend)","Gestion des stocks & alertes","Analytiques & rapports complets","Système de rôles & équipe","Support prioritaire","Mises à jour incluses à vie"].map(item => (
                    <div key={item} className="lp-pricing-check-item">
                      <span style={{ color: "rgba(80,210,140,0.9)", flexShrink: 0 }}>{Icons.checkCircle}</span>
                      <span style={{ fontSize: 14, color: "rgba(255,255,255,0.78)", fontWeight: 500, lineHeight: 1.4 }}>{item}</span>
                    </div>
                  ))}
                </div>

                <a href="#stripe-placeholder" className="lp-btn-primary lp-btn-pulse" style={{ width: "100%", justifyContent: "center", height: 56, fontSize: 16 }}>Commencer maintenant →</a>
                <p style={{ textAlign: "center", fontSize: 13, color: "rgba(80,210,140,0.80)", marginTop: 16, fontWeight: 700 }}>✓ Satisfait ou remboursé 30 jours sur l'abonnement — Frais d'installation non remboursables</p>
                <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 9 }}>
                  {[["🔒","Paiement sécurisé Stripe"],["⚡","Accès immédiat après paiement"],["💬","Support réactif sous 24h"]].map(([icon, text]) => (
                    <div key={text} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 15, flexShrink: 0 }}>{icon}</span>
                      <span style={{ fontSize: 13, color: "rgba(255,255,255,0.42)", fontWeight: 500 }}>{text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="lp-divider" />

      {/* ══════════ TESTIMONIALS ══════════ */}
      <TestimonialsSection />

      <div className="lp-divider" />

      {/* ══════════ FAQ ══════════ */}
      <section className="lp-section-faq">
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <div className="lp-reveal" style={{ textAlign: "center", marginBottom: 56 }}>
            <span className="lp-tag" style={{ marginBottom: 20, display: "inline-flex" }}>{Icons.spark} FAQ</span>
            <h2 style={{ fontSize: "clamp(26px,4vw,42px)", fontWeight: 900, letterSpacing: "-1px", color: "rgba(255,255,255,0.95)", marginTop: 16 }}>Questions fréquentes</h2>
          </div>
          <div className="lp-reveal lp-reveal-d1" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            {FAQ_ITEMS.map(item => <FaqItem key={item.q} q={item.q} a={item.a} />)}
          </div>
        </div>
      </section>

      {/* ══════════ CTA BAND ══════════ */}
      <section className="lp-section-cta">
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div className="lp-cta-inner lp-reveal" style={{ background: "linear-gradient(135deg,rgba(99,120,255,0.12) 0%,rgba(192,132,252,0.08) 100%)", border: "1px solid rgba(99,120,255,0.22)" }}>
            <div style={{ position: "absolute", top: -60, right: -60, width: 250, height: 250, borderRadius: "50%", background: "radial-gradient(circle,rgba(99,120,255,0.20) 0%,transparent 70%)", pointerEvents: "none" }} />
            <div style={{ position: "absolute", bottom: -50, left: -50, width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle,rgba(192,132,252,0.15) 0%,transparent 70%)", pointerEvents: "none" }} />
            <h2 style={{ fontSize: "clamp(24px,3.5vw,38px)", fontWeight: 900, letterSpacing: "-0.8px", color: "rgba(255,255,255,0.97)", marginBottom: 14 }}>Prêt à moderniser votre boutique ?</h2>
            <p style={{ fontSize: 16, color: "rgba(255,255,255,0.45)", marginBottom: 36, maxWidth: 440, margin: "0 auto 36px", lineHeight: 1.65 }}>Rejoignez les commerçants qui ont déjà optimisé leur relation client avec ClientFlow.</p>
            <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
              <a href="#stripe-placeholder" className="lp-btn-primary">Commencer maintenant →</a>
              <Link href="/login" className="lp-btn-ghost">Se connecter</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ FOOTER ══════════ */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "48px 24px 36px" }}>
        <div className="lp-footer-grid" style={{ maxWidth: 1140, margin: "0 auto" }}>
          <div className="lp-footer-brand">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: `linear-gradient(135deg,${ACCENT},${ACCENT_MID})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#fff", fontFamily: "'DM Mono',monospace" }}>CF</div>
              <span style={{ fontFamily: "'DM Mono',monospace", fontWeight: 600, fontSize: 12, letterSpacing: 2, color: "rgba(255,255,255,0.85)" }}>CLIENTFLOW</span>
            </div>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", lineHeight: 1.7, maxWidth: 260, fontWeight: 400, marginBottom: 24 }}>Le CRM pensé pour les commerçants physiques. Gérez votre clientèle, automatisez vos relances, développez votre boutique.</p>
            {!demoSubmitted ? (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.45)", marginBottom: 10, letterSpacing: 0.3 }}>Recevoir une démo</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="email" value={demoEmail} onChange={e => setDemoEmail(e.target.value)}
                    placeholder="votre@email.fr"
                    style={{ flex: 1, height: 36, borderRadius: 9, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.85)", fontSize: 13, padding: "0 12px", outline: "none", fontFamily: "inherit", minWidth: 0 }}
                    onFocus={e => { (e.target as HTMLInputElement).style.borderColor = "rgba(99,120,255,0.45)"; }}
                    onBlur={e => { (e.target as HTMLInputElement).style.borderColor = "rgba(255,255,255,0.12)"; }}
                  />
                  <button
                    onClick={() => { if (demoEmail.includes("@")) setDemoSubmitted(true); }}
                    style={{ height: 36, padding: "0 14px", borderRadius: 9, background: `linear-gradient(135deg,${ACCENT},${ACCENT_MID})`, color: "#fff", fontSize: 12, fontWeight: 800, border: "none", cursor: "pointer", flexShrink: 0, fontFamily: "inherit" }}>
                    Envoyer
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 13, color: "rgba(80,210,140,0.85)", fontWeight: 700, padding: "10px 14px", borderRadius: 9, background: "rgba(80,210,140,0.08)", border: "1px solid rgba(80,210,140,0.20)" }}>
                ✓ Demande envoyée — on revient vers vous sous 24h !
              </div>
            )}
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.5, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", marginBottom: 16 }}>Produit</div>
            {[["Fonctionnalités","#features"],["Comment ça marche","#how-it-works"],["Tarif","#pricing"],["Connexion","/login"]].map(([label, href]) => (
              <div key={label} style={{ marginBottom: 10 }}>
                <Link href={href} style={{ fontSize: 14, color: "rgba(255,255,255,0.50)", fontWeight: 500, transition: "color 0.15s" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.85)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.50)"; }}>{label}</Link>
              </div>
            ))}
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.5, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", marginBottom: 16 }}>Légal</div>
            {["Mentions légales","CGU","Politique de confidentialité"].map(label => (
              <div key={label} style={{ marginBottom: 10 }}><span style={{ fontSize: 14, color: "rgba(255,255,255,0.50)", fontWeight: 500, cursor: "pointer" }}>{label}</span></div>
            ))}
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.5, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", marginBottom: 16 }}>Contact</div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.50)", fontWeight: 500, marginBottom: 10 }}>contact@clientflow.fr</div>
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              {["𝕏","in","ig"].map(s => (
                <div key={s} style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "rgba(255,255,255,0.40)", cursor: "pointer" }}>{s}</div>
              ))}
            </div>
          </div>
        </div>
        <div style={{ height: 1, background: "rgba(255,255,255,0.05)", marginBottom: 28 }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.25)", fontFamily: "'DM Mono',monospace" }}>© {new Date().getFullYear()} ClientFlow · Tous droits réservés</span>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.18)", fontFamily: "'DM Mono',monospace" }}>v1.0 · BETA</span>
        </div>
      </footer>

      {/* ══════════ SCROLL TO TOP ══════════ */}
      {showScrollTop && (
        <button className="lp-scroll-top" onClick={scrollToTop} aria-label="Retour en haut">{Icons.arrowUp}</button>
      )}

      {/* ══════════ MOBILE STICKY CTA ══════════ */}
      <div className="lp-sticky-cta" style={{ flexDirection: "column", gap: 0 }}>
        <a href="#stripe-placeholder" className="lp-btn-primary" style={{ width: "100%", height: 48, fontSize: 15, borderRadius: 12, justifyContent: "center" }}>Démarrer maintenant →</a>
        <div style={{ textAlign: "center", marginTop: 8, fontSize: 11, color: "rgba(255,255,255,0.30)", fontFamily: "'DM Mono',monospace" }}>Sans engagement · 30j satisfait ou remboursé</div>
      </div>
    </div>
  );
}
