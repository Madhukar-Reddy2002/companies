/* Kapitus small business loans landing page: script.js
   One file, one block per section (same numbers as index.html and styles.css).
   00 core | 04 fit check | 05 reviews | 06 questions | 08 floating UI | 09 application form | 10 nudges */

/* ============ 00 CORE: config, state, dynamic CTA, analytics ============
   EDIT HERE: phone numbers, amount limits, qualification thresholds, storage and form options. */
window.KAP = (function(){
  var cfg = {
    phoneSales: "(646) 630-7618", phoneSalesTel: "+16466307618",
    amountMin: 5000, amountMax: 5000000, defaultAmount: 100000,
    typical: {years: 2, revenue: 250000, credit: 650},   /* qualifications used by the fit check and the Ask box */
    resumeDays: 7,             /* how long a started request is remembered in this browser */
    storageKey: "kap_blhp_v2",
    analytics: true,           /* pushes events to window.dataLayer (GTM) */
    theme: {storageKey: "kap_theme"},   /* the default theme is set in index.html (data-default-theme on <html>) */
    nudges: {enabled: true, autoCloseMs: 5200, delayMs: 380},   /* motivating pop-ups while filling the form (section 10) */
    form: {
      autoAdvance: true,       /* single-choice screens move on by themselves after a tap */
      autoAdvanceDelay: 260,   /* ms */
      maxFileMB: 10,           /* per bank statement. Must match the real upload limit on the server */
      minFiles: 1,             /* statements needed to continue (3 expected, 4 in CA and NY) */
      allowUploadLater: true,  /* "email me a link to upload later" option on the documents screen */
      submitUrl: ""            /* WIRE-UP: endpoint that receives the finished application (JSON). Empty = preview only */
    }
  };
  var reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  function $(s,r){ return (r||document).querySelector(s); }
  function $$(s,r){ return Array.prototype.slice.call((r||document).querySelectorAll(s)); }
  function el(tag, cls, txt){ var n = document.createElement(tag); if(cls) n.className = cls; if(txt!=null) n.textContent = txt; return n; }
  function digits(v){ return (v||"").replace(/[^0-9]/g,""); }
  function fmt(n){ return n ? Number(n).toLocaleString("en-US") : ""; }

  /* analytics: events are prefixed blhp_. No free text or personal data is ever sent. */
  function track(name, data){
    if(!cfg.analytics) return;
    try{ (window.dataLayer = window.dataLayer || []).push(Object.assign({event:"blhp_" + name}, data || {})); }catch(e){}
  }

  /* progress state. Only non-personal answers (amount, use of funds, industry, ...) and the step are kept,
     in this browser only. Names, contact details, DOB, SSN, EIN, addresses and files are never stored. */
  var state = {started:false, step:0, data:{}, resumed:false};
  function store(){ try{ return window.localStorage; }catch(e){ return null; } }
  function load(){
    var s = store(); if(!s) return;
    try{
      var raw = s.getItem(cfg.storageKey); if(!raw) return;
      var d = JSON.parse(raw);
      if(!d || !d.ts || Date.now() - d.ts > cfg.resumeDays * 864e5){ s.removeItem(cfg.storageKey); return; }
      if(d.started){ state.started = true; state.step = d.step|0; state.data = d.data || {}; state.resumed = true; }
    }catch(e){}
  }
  function save(){
    var s = store(); if(!s) return;
    try{ s.setItem(cfg.storageKey, JSON.stringify({started:state.started, step:state.step, data:state.data, ts:Date.now()})); }catch(e){}
  }
  function clear(){ var s = store(); try{ s && s.removeItem(cfg.storageKey); }catch(e){} state.started=false; state.step=0; state.data={}; state.resumed=false; refreshCta(); }
  function set(patch){ Object.keys(patch).forEach(function(k){ state[k] = patch[k]; }); if(state.started) save(); refreshCta(); }

  /* dynamic CTA: every [data-cta] switches to "continue" once the visitor has started */
  function refreshCta(){
    $$("[data-cta]").forEach(function(a){ a.textContent = state.started ? a.dataset["continue"] : a.dataset.start; });
  }
  function goToCard(){
    var card = $("#card"); if(card) card.scrollIntoView({behavior: reduce ? "auto" : "smooth", block:"center"});
  }
  /* theme: "purple" (default) or "light". The header button switches it and the choice is remembered in this browser. */
  function currentTheme(){ return document.documentElement.getAttribute("data-theme") || "purple"; }
  function applyTheme(t){
    document.documentElement.setAttribute("data-theme", t);
    var m = $('meta[name="theme-color"]'); if(m) m.setAttribute("content", t==="light" ? "#ffffff" : "#3C1B50");
    var b = $("#themeToggle");
    if(b){ var nxt = t==="light" ? "purple" : "light"; b.setAttribute("aria-label","Switch to the " + nxt + " theme"); b.setAttribute("title","Switch to the " + nxt + " theme"); }
  }
  function toggleTheme(){
    var t = currentTheme()==="light" ? "purple" : "light"; applyTheme(t);
    try{ window.localStorage.setItem(cfg.theme.storageKey, t); }catch(e){}
    track("theme", {theme:t});
  }
  applyTheme(currentTheme());
  var tt = $("#themeToggle"); if(tt) tt.addEventListener("click", toggleTheme);

  var api = {cfg:cfg, state:state, $:$, $$:$$, el:el, digits:digits, fmt:fmt, track:track, set:set, clear:clear, save:save, refreshCta:refreshCta, goToCard:goToCard, reduce:reduce};
  document.addEventListener("click", function(e){
    var a = e.target.closest ? e.target.closest("[data-cta]") : null;
    if(!a) return;
    e.preventDefault();
    track("cta_click", {location:a.dataset.loc || "", mode: state.started ? "continue" : "start"});
    if(typeof api.openForm === "function") api.openForm(); else goToCard();   /* openForm comes from section 09 */
  });

  load();
  refreshCta();
  document.addEventListener("DOMContentLoaded", refreshCta);
  return api;
})();

/* ============ 04 FIT CHECK: slider + revenue + credit chips, live result ============
   EDIT HERE: the rules in verdict() and the messages.
   Credit follows Kapitus's published minimum (650). Time and revenue thresholds are the stated qualifications
   (2+ years, $250K+); the "likely" exceptions for newer businesses are placeholders until the client confirms them. */
(function(){
  var K = window.KAP, $ = K.$, $$ = K.$$;
  var res = $("#fitResult"); if(!res) return;
  var TIME = [
    {label:"6 months",  key:"lt1"},
    {label:"1 year",    key:"1to2"},
    {label:"1.5 years", key:"1to2"},
    {label:"2 years",   key:"2plus"},
    {label:"2+ years",  key:"2plus"}
  ];
  var MIN_CREDIT = K.cfg.typical.credit;
  var fit = {t:null, rev:null, c:null}, lastState = null;
  var tRange=$("#tRange"), tWrap=$("#tWrap"), tVal=$("#tVal"), revIn=$("#revIn"), rVal=$("#rVal"), cChips=$$("#cChips .chip");
  var segs=$$(".seg i", res), fTitle=$("#fTitle"), fBody=$("#fBody");

  function revBand(n){ return n<100000?0 : n<250000?1 : n<500000?2 : n<1000000?3 : 4; }
  function setRes(state, title, body){ res.dataset.state = state; fTitle.textContent = title; fBody.textContent = body; }

  /* full read: t = time key, r = revenue band 0-4, c = credit band 0-3 (2 and up = 650+) */
  function verdict(t, r, c){
    if(c<2) return ["review","Let’s take a closer look","Our minimum credit score requirement is " + MIN_CREDIT + ". If your score is close or has recently improved, a financing specialist can talk through where you stand."];
    if(t==="2plus" && r>=2) return ["strong","You look like a strong fit","Your time in business, revenue and credit line up well with our qualifications. Start your application whenever you’re ready."];
    var why = null;
    if(t!=="2plus" && r>=3) why = "Newer businesses with strong revenue and solid credit are often a good fit. Your revenue carries a lot of weight here.";
    else if(t==="1to2" && r>=2 && c>=3) why = "Strong credit and healthy revenue can offset a shorter time in business.";
    if(why) return ["likely","You may still be a great fit", why + " A specialist will review your application individually."];
    return ["review","Let’s take a closer look","A few details fall outside our usual range, but you can still apply. A specialist will walk through what may be possible and what to work toward."];
  }
  /* encouragement while only some inputs are filled */
  function partial(hasT, hasR, hasC, t, r, c){
    var body = "Keep going. Your next answer fills in the picture.";
    if(hasC && c<2){ return ["idle","Keep going","Our minimum credit score requirement is " + MIN_CREDIT + "."]; }
    if(hasT && !hasR && !hasC){
      body = t==="2plus" ? "Two or more years in business is a strong start." : (t==="1to2" ? "Under 2 years can still work. Your next answers matter." : "Newer businesses can still apply. Revenue tells us a lot.");
    } else if(hasT && hasR && !hasC){
      if(t!=="2plus" && r>=3) body = "Strong revenue carries real weight for a newer business.";
      else if(t==="2plus" && r>=2) body = "Steady revenue and time in business is a solid combination.";
      else if(r>=2) body = "Healthy revenue helps balance a shorter time in business.";
      else body = "Revenue is under our usual range. One more answer to go.";
    } else if(!hasT && hasR && !hasC){
      body = r>=2 ? "Your revenue is in a strong range. Tell us how long you’ve been in business." : "Revenue is under our usual range. Your other answers matter.";
    } else if(!hasT && !hasR && hasC){
      body = "Your credit score meets our " + MIN_CREDIT + " minimum.";
    } else if(hasT && !hasR && hasC){
      body = "Add your revenue to complete the picture.";
    } else if(!hasT && hasR && hasC){
      body = "One more: move the slider to show how long you’ve been in business.";
    }
    return ["idle","Keep going",body];
  }
  function update(){
    var hasT = fit.t!==null, hasR = fit.rev!==null && fit.rev>0, hasC = fit.c!==null;
    var n = (hasT?1:0) + (hasR?1:0) + (hasC?1:0);
    segs.forEach(function(s,i){ s.classList.toggle("on", i<n); });
    if(n===0){ setRes("idle","Let’s see where you stand","Move the slider, enter your revenue and pick a credit range."); return; }
    var t = hasT ? TIME[fit.t].key : null, r = hasR ? revBand(fit.rev) : null, c = hasC ? fit.c : null;
    var out = (n===3) ? verdict(t,r,c) : partial(hasT,hasR,hasC,t,r,c);
    setRes(out[0], out[1], out[2]);
    if(n===3 && out[0]!==lastState){ lastState = out[0]; K.track("fit_result", {state:out[0]}); }
  }
  function setT(i){
    fit.t = i; tRange.value = i; tWrap.style.setProperty("--p", String(i/4));
    tVal.textContent = TIME[i].label; tVal.classList.remove("idle"); tRange.setAttribute("aria-valuetext", TIME[i].label);
  }
  tRange.addEventListener("input", function(){ setT(Number(tRange.value)); update(); });
  tRange.addEventListener("change", function(){ K.track("fit_time", {value:TIME[Number(tRange.value)].label}); });
  revIn.addEventListener("input", function(){
    revIn.value = K.fmt(K.digits(revIn.value));
    var n = Number(K.digits(revIn.value));
    fit.rev = n>0 ? n : null;
    if(n>0){ rVal.textContent = "$" + revIn.value; rVal.classList.remove("idle"); }
    else { rVal.textContent = "Enter an amount"; rVal.classList.add("idle"); }
    update();
  });
  revIn.addEventListener("change", function(){ if(fit.rev) K.track("fit_revenue", {band:revBand(fit.rev)}); });
  cChips.forEach(function(b){
    b.addEventListener("click", function(){
      var on = b.getAttribute("aria-pressed")==="true";
      cChips.forEach(function(x){ x.setAttribute("aria-pressed","false"); });
      if(on){ fit.c = null; } else { b.setAttribute("aria-pressed","true"); fit.c = Number(b.dataset.v); K.track("fit_credit", {band:fit.c}); }
      update();
    });
  });
  tWrap.style.setProperty("--p","0");
  update();
})();

/* ============ 05 REVIEWS: carousel (autoplay pauses on hover, focus, touch and with the pause button) ============
   EDIT HERE: the REVIEWS list. alt:true gives a card the dark purple style. */
(function(){
  var K = window.KAP, $ = K.$, $$ = K.$$, el = K.el;
  var track = $("#carTrack"); if(!track) return;
  var REVIEWS = [
    {t:"Very quick and painless procedure to obtain working capital loan for the third time! Efficient and friendly!", n:"Karen C.", s:"Kapitus customer", alt:true},
    {t:"Nick and the Kapitus team got me funded quickly and had a great streamlined process.", n:"Matthew", s:"Google review"},
    {t:"As good as it gets! You truly feel like you have a teammate that cares about your business.", n:"Kyle Flowers", s:"Google review"},
    {t:"Kind, supportive and easy to work with.", n:"Dawn Lepore", s:"Google review", alt:true},
    {t:"Great Company, Great People!", n:"Sean Lowery", s:"Google review"},
    {t:"Excellent service! great platform and customer services 5 stars", n:"Joan Efres Nazario", s:"Google review"}
  ];
  var dotsEl = $("#dots"), pauseBtn = $("#carPause"), carEl = $("#car"), reduce = K.reduce;
  REVIEWS.forEach(function(r,i){
    var c = el("figure","rcard" + (r.alt?" alt":""));
    c.setAttribute("role","group"); c.setAttribute("aria-label",(i+1)+" of "+REVIEWS.length);
    var st = el("div","stars","\u2605\u2605\u2605\u2605\u2605"); st.setAttribute("aria-label","5 stars");
    var w = el("div"); w.appendChild(el("div","who",r.n)); w.appendChild(el("div","src",r.s));
    c.appendChild(st); c.appendChild(el("blockquote",null,r.t)); c.appendChild(w); track.appendChild(c);
    var d = el("button"); d.type = "button"; d.setAttribute("aria-label","Go to review "+(i+1));
    d.addEventListener("click", function(){ go(i); hold(); });
    dotsEl.appendChild(d);
  });
  function gapPx(){ var cs = getComputedStyle(track); return parseFloat(cs.columnGap || cs.gap) || 20; }
  function stepPx(){ return track.children[0].getBoundingClientRect().width + gapPx(); }
  function maxScroll(){ return track.scrollWidth - track.clientWidth; }
  function curIdx(){ return Math.min(REVIEWS.length-1, Math.round(track.scrollLeft / stepPx())); }
  function go(i){
    i = Math.max(0, Math.min(REVIEWS.length-1, i));
    track.scrollTo({left: Math.min(i*stepPx(), maxScroll()), behavior: reduce ? "auto" : "smooth"});
  }
  function next(){ if(track.scrollLeft >= maxScroll()-4){ go(0); } else { go(curIdx()+1); } }
  function prev(){ if(track.scrollLeft <= 4){ track.scrollTo({left:maxScroll(), behavior: reduce?"auto":"smooth"}); } else { go(curIdx()-1); } }
  function paintDots(){
    var i = (track.scrollLeft >= maxScroll()-4) ? REVIEWS.length-1 : curIdx();
    $$("button", dotsEl).forEach(function(d,k){ d.setAttribute("aria-current", String(k===i)); });
  }
  var raf = 0;
  track.addEventListener("scroll", function(){ cancelAnimationFrame(raf); raf = requestAnimationFrame(paintDots); }, {passive:true});
  $("#carNext").addEventListener("click", function(){ next(); hold(); K.track("review_nav",{dir:"next"}); });
  $("#carPrev").addEventListener("click", function(){ prev(); hold(); K.track("review_nav",{dir:"prev"}); });
  track.addEventListener("keydown", function(e){ if(e.key==="ArrowRight"){ next(); e.preventDefault(); } if(e.key==="ArrowLeft"){ prev(); e.preventDefault(); } });

  var timer=null, hover=false, focused=false, held=false, userPaused=false, visible=false, holdT=null;
  function stop(){ if(timer){ clearInterval(timer); timer=null; } }
  function sync(){ stop(); if(reduce || userPaused || hover || focused || held || !visible || document.hidden) return; timer = setInterval(next, 3800); }
  function hold(){ held = true; sync(); clearTimeout(holdT); holdT = setTimeout(function(){ held=false; sync(); }, 8000); }
  carEl.addEventListener("mouseenter", function(){ hover=true; sync(); });
  carEl.addEventListener("mouseleave", function(){ hover=false; sync(); });
  carEl.addEventListener("focusin", function(){ focused=true; sync(); });
  carEl.addEventListener("focusout", function(){ focused=false; sync(); });
  track.addEventListener("touchstart", function(){ held=true; sync(); clearTimeout(holdT); }, {passive:true});
  track.addEventListener("touchend", function(){ clearTimeout(holdT); holdT = setTimeout(function(){ held=false; sync(); }, 6000); }, {passive:true});
  document.addEventListener("visibilitychange", sync);
  pauseBtn.addEventListener("click", function(){
    userPaused = !userPaused;
    pauseBtn.setAttribute("aria-pressed", String(userPaused));
    pauseBtn.setAttribute("aria-label", userPaused ? "Resume automatic scrolling" : "Pause automatic scrolling");
    $("#pauseIco").innerHTML = userPaused ? '<path d="M7 5l12 7-12 7z"/>' : '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>';
    sync();
  });
  if("IntersectionObserver" in window){
    new IntersectionObserver(function(en){ visible = en[0].isIntersecting; sync(); },{threshold:0.35}).observe(carEl);
  } else { visible = true; sync(); }
  if(reduce){ pauseBtn.hidden = true; }
  paintDots();
})();

/* ============ 06 QUESTIONS (a): ASK BOX knowledge base ============
   Answers may only use Kapitus pages: the flexible-terms page, the /simple/ application, and the Business Loans page.
   check:true = needs Kapitus / compliance confirmation before launch (not shown to visitors).
   link:{text,href} adds a link under the answer. */
var DISCLOSURE = "Product availability is subject to confirmation of eligibility and underwriting. Products may vary based on credit profile and the state in which your business is located. Certain products may not be available in all states or to all customers. SBA loans, business lines of credit, invoice factoring, and purchase order financing are offered only by members of Kapitus\u2019s financing network and not by Kapitus directly.";
var KB = [
 {id:"qualify", q:"What do I need to qualify?",
  a:["Our qualifications are 2+ years in business, a 650+ credit score and $250K+ in revenue.","A financing specialist can tell you where you stand."],
  src:"flexible-terms page", kw:"qualify qualification requirement eligible eligibility need minimum criteria", rx:/(what (do|does) i need|qualif|eligib|requirement|criteria)/},
 {id:"credit", q:"What is the minimum credit score?",
  a:["At this time, the minimum credit score requirement for our small business financing is 650."],
  src:"flexible-terms page FAQ", kw:"credit score fico minimum", rx:/(credit score|fico|minimum score|bad credit|low credit)/, not:/(affect|hurt|impact|ding|pull|inquir|check)/},
 {id:"time", q:"How long do I need to be in business?",
  a:["2+ years in business is one of our qualifications, along with a 650+ credit score and $250K+ in revenue.","If you have less time in business, a financing specialist can look at your full picture and tell you where you stand."],
  src:"flexible-terms page", kw:"business years year long time established startup new", rx:/(how long.*(business|operat)|time in business|years in business|new business|start-?up)/},
 {id:"revenue", q:"How much revenue do I need?",
  a:["$250K+ in revenue is one of our qualifications. In the application you’ll choose your annual revenue range."],
  src:"flexible-terms page", kw:"revenue sales income annual minimum", rx:/(how much revenue|minimum revenue|annual revenue|sales)/},
 {id:"coowner", q:"What if I own less than 50% of the business?",
  a:["If your ownership is under 50%, we’ll ask for co-owner details to assess eligibility."],
  src:"application", kw:"own ownership percent partner coowner co-owner partners owners", rx:/(\bown(ership)?\b|\bpartners?\b|co-?owner|percent|%)/},
 {id:"amount", check:true, q:"How much funding can I get?",
  a:["We provide $5K to $5M in financing. The amount you’re offered depends on your business profile, so not every business qualifies for the full range."],
  src:"application and Business Loans page (the flexible-terms form shows a $100,000 minimum, so confirm the floor)", kw:"amount much funding borrow maximum max loan largest biggest smallest", rx:/(how much (can|could|will).*(get|borrow|fund|loan|approv)|maximum|max loan|loan amount|borrow)/},
 {id:"speed", q:"How fast can I get funded?",
  a:["Decisions can come in as little as 4 hours.","You can apply online in minutes, get approved in as little as 24 hours, and receive funding quickly."],
  src:"Kapitus landing pages (4-hour decisions) and flexible-terms page (24-hour approval)", kw:"fast quick speed days hours funded funding approval approved decision time when", rx:/(how (fast|quick|soon)|how long.*(fund|approv|get (the )?money|decision)|decision|turnaround|same day|24 hours|4 hours)/},
 {id:"offers", q:"Can I compare offers?",
  a:["Yes. You can compare up to 6 offers."],
  src:"Kapitus landing pages", kw:"compare offer offers multiple several options six", rx:/((multiple|more than one|several|compare).*(offer|option)|(how many|any) offers?|compare)/},
 {id:"terms", q:"What are the repayment terms?",
  a:["Business loan terms run from 6 to 24 months, with daily, weekly or monthly payment options."],
  src:"Business Loans page", kw:"term terms repayment repay payment payments monthly weekly daily months", rx:/(repay|payment (options|schedule|terms|frequency)|(daily|weekly|monthly) payments?|\bterms?\b|how long (to|do i) pay)/, not:/(terms (of|and)|conditions)/},
 {id:"fees", q:"Are there any hidden fees?",
  a:["No hidden fees. Our terms are transparent, with no surprises.","A financing specialist will walk you through the details of your offer."],
  src:"flexible-terms page", kw:"hidden fee fees surprise surprises transparent", rx:/(hidden|\bfees?\b|surprise|transparent)/},
 {id:"specialist", q:"How does a financing specialist help?",
  a:["Kapitus financing specialists take a consultative approach. We get to know you and your business to help you weigh your options and choose the best financing option for your current needs, without over-extending your business."],
  src:"flexible-terms page", kw:"specialist consultative advice advise guide options help works", rx:/(specialist|consultative|advis|how (do|does).*help)/},
 {id:"apply", q:"How do I apply?",
  a:["You apply online in minutes, one question at a time, and you can go back at any step.","A financing specialist may call to guide you personally."],
  src:"flexible-terms page and application", kw:"apply application process steps long minutes how", rx:/(how (do|can) i apply|how long.*(appl|take)|application process|how many (steps|questions)|minutes)/},
 {id:"docs", q:"Which documents do I need?",
  a:["Your 3 most recent, complete business bank statements. If your business is in California or New York, you’ll upload 4."],
  src:"application", kw:"document documents bank statement statements upload paperwork papers need", rx:/(document|bank statement|statements|paperwork|upload)/},
 {id:"later", check:true, q:"Can I apply without my bank statements handy?",
  a:["Yes. You can submit your application first, and we’ll email you a secure link to upload your statements later."],
  src:"Proposed feature: confirm before launch", kw:"later handy statements skip without proceed submit email link", rx:/(don.?t have.*(statement|document)|without.*(statement|document)|upload.*later|later)/},
 {id:"ssn", q:"Is my Social Security number safe?",
  a:["Your SSN is encrypted and securely protected."],
  src:"application", kw:"ssn social security number safe secure privacy protected encrypted", rx:/(ssn|social security|secure|safe|privacy|encrypt)/},
 {id:"creditpull", q:"Will applying affect my credit score?",
  a:["Kapitus’s request for your credit report doesn’t affect your personal credit score.","If your application is shared with other lenders, they may run their own checks, which can include hard credit pulls. This is explained in the application terms."],
  src:"application terms", kw:"credit pull inquiry hard soft affect hurt impact check report", rx:/(hard (pull|inquiry|check)|soft (pull|inquiry|check)|(affect|hurt|impact|ding).*credit|credit (check|pull|inquiry))/},
 {id:"banks", q:"How is working with an online lender different from a traditional bank?",
  a:["There are a variety of reasons that business owners will choose one type of provider over another, and each has its advantages and disadvantages."],
  link:{text:"Read: Traditional Bank vs. Alternative Lender", href:"https://kapitus.com/blog/manage-your-money/financing/traditional-bank-vs-alternative-lender-which-is-better-for-your-small-business-kapitus/"},
  src:"flexible-terms page FAQ", kw:"bank banks traditional online alternative lender difference different", rx:/(bank|traditional|alternative lender|online lender)/},
 {id:"options", q:"What other financing options can I access?",
  a:["Kapitus can help you explore a full suite of financing products and all your options at the same time. Additional options include a business line of credit, revenue-based financing, equipment financing, invoice factoring and purchase order financing."],
  disclosure:DISCLOSURE,
  src:"flexible-terms page FAQ", kw:"other financing options products sba line credit equipment factoring invoice purchase order revenue-based types", rx:/(sba|line of credit|equipment|factoring|invoice|purchase order|other (products|types|financing|options))/},
 {id:"person", q:"Can I talk to a person?",
  a:["Yes. Financing specialists are at (646) 630-7618. Customer service is at (800) 780-7133."],
  src:"Kapitus site", kw:"talk speak call person human phone representative contact agent", rx:/(talk|speak|call|phone|human|person|representative|contact)/},
 {id:"about", q:"How long has Kapitus been around?",
  a:["Kapitus has been providing financing solutions for small businesses since 2006. We’ve provided $10 billion in capital to 69,000 businesses, and Google reviewers rate us 4.6 out of 5 across 881 reviews."],
  src:"flexible-terms page and landing page", kw:"kapitus legit trust reputable founded since experience company about reviews", rx:/(legit|trust|reputable|scam|since|founded|experience|how old|reviews)/}
];

/* ============ 06 QUESTIONS (b): Ask engine (retrieves only from KB; never invents an answer) ============ */
(function(){
  var K = window.KAP, $ = K.$, $$ = K.$$, el = K.el, cfg = K.cfg;
  if(!$("#askForm")) return;
  var T = cfg.typical;

  /* original FAQ (static HTML in section 06): just track which questions people open */
  $$("#faqList details").forEach(function(d, i){ d.addEventListener("toggle", function(){ if(d.open) K.track("faq_open", {index:i}); }); });

  var STOP = new Set("the and for you your can are but not with have has had this that from what when how will would could should about any get got does did its into our out all one who why where than then them they there their been being was were just only also very more most some such like want need".split(" "));
  function stem(w){ return w.length>4 && /s$/.test(w) && !/ss$/.test(w) ? w.slice(0,-1) : w; }
  function tokens(s){ return String(s).toLowerCase().replace(/[^a-z0-9\s-]/g," ").split(/\s+/).filter(function(w){return w.length>2 && !STOP.has(w)}).map(stem); }
  KB.forEach(function(e){ e.kwSet = new Set(tokens(e.kw)); });
  function retrieve(q){
    var tk = tokens(q), low = q.toLowerCase();
    return KB.map(function(e){
      var s = 0; tk.forEach(function(t){ if(e.kwSet.has(t)) s += 2; });
      if(e.rx && e.rx.test(low)) s += 4;
      if(e.not && e.not.test(low)) s -= 6;
      return {e:e, s:s};
    }).sort(function(a,b){return b.s-a.s});
  }

  /* reads numbers people type about their own business: years, months, revenue (annual or monthly), credit score */
  var WORDNUM = {one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10};
  function parseProfile(raw){
    var text = " " + raw.toLowerCase().replace(/\bone and a half\b/g,"1.5").replace(/\ba year and a half\b/g,"1.5") + " ";
    text = text.replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\s+(years?|yrs?|months?)\b/g,function(m,w,u){return WORDNUM[w]+" "+u});
    text = text.replace(/\b(for|in business|about|almost|over|nearly)\s+a\s+year\b/g,function(m,w){return w+" 1 year"});
    var out = {}, m;
    if((m = text.match(/(?:credit|fico|score)[^0-9]{0,25}(\d{3})\b/)) || (m = text.match(/\b(\d{3})\s*(?:credit|fico|score)/))){
      var c = parseInt(m[1],10);
      if(c>=300 && c<=850){ out.credit = c; text = text.replace(m[0]," "); }
    }
    if((m = text.match(/(\d+(?:\.\d+)?)\s*(?:years?|yrs?)\b/))){
      out.years = parseFloat(m[1]); out.yearsLabel = m[1] + (parseFloat(m[1])===1 ? " year" : " years");
      text = text.replace(m[0]," ");
      var mm = text.match(/(\d+)\s*months?\b/);
      if(mm){ out.years += parseInt(mm[1],10)/12; text = text.replace(mm[0]," "); }
    } else if((m = text.match(/(\d+)\s*months?\b/))){
      var mo = parseInt(m[1],10);
      out.years = mo/12; out.yearsLabel = mo + (mo===1 ? " month" : " months");
      text = text.replace(m[0]," ");
    } else if(/(less than|under|not even|just under)\s+(a\s+|1\s+)?year|just started|recently started|brand new/.test(text)){
      out.years = 0.5; out.yearsLabel = "under 1 year";
    }
    var re = /(\$)?\s?(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(k|m|mm|thousand|million)?\b/g, cand;
    var revRx = /(revenue|sales|income|earn\w*|making|make|turnover|gross|annual|per year|a year)/g;
    var amtRx = /(need|loan|fund\w*|borrow\w*|looking for|amount|request\w*)/g;
    function last(rx, str){ var m2, pos = -1; rx.lastIndex = 0; while((m2 = rx.exec(str))){ pos = m2.index; } return pos; }
    function first(rx, str){ rx.lastIndex = 0; var m3 = rx.exec(str); return m3 ? m3.index : -1; }
    while((cand = re.exec(text))){
      var val = parseFloat(cand[2].replace(/,/g,"")), suf = cand[3];
      if(suf==="k"||suf==="thousand") val*=1e3; else if(suf==="m"||suf==="mm"||suf==="million") val*=1e6;
      if(!(cand[1] || suf || val>=10000)) continue;
      var end = cand.index + cand[0].length;
      var before = text.slice(Math.max(0,cand.index-30), cand.index), after = text.slice(end, end+20);
      var rb = last(revRx, before), ab = last(amtRx, before), label = null;
      if(rb>=0 || ab>=0){ label = rb > ab ? "rev" : "amt"; }
      else { var ra = first(revRx, after), aa = first(amtRx, after); if(ra>=0 && (aa<0 || ra<aa)) label = "rev"; else if(aa>=0) label = "amt"; }
      if(label==="rev" && out.revenue==null){
        var monthly = /(per month|a month|monthly|\/mo\b|each month|every month)/.test(after + " " + before.slice(-12));
        out.revenue = monthly ? val*12 : val; out.monthly = monthly;
      } else if(label==="amt" && out.amount==null){ out.amount = val; }
      else if(label===null && out.revenue==null){ out.revenue = val; }
    }
    return out;
  }
  function money(n){ if(n>=1e6) return "$" + (Math.round(n/1e5)/10) + "M"; if(n>=1e3) return "$" + Math.round(n/1e3) + "K"; return "$" + Math.round(n); }
  function profileAnswer(p){
    var rows = [], soft = [], creditLow = false;
    if(p.years!=null){ var ok = p.years >= T.years; rows.push({label:"Time in business", val:p.yearsLabel, note:"qualification "+T.years+"+ years", ok:ok, yes:"Meets", no:"Below"}); if(!ok) soft.push("time in business"); }
    if(p.revenue!=null){ var ok2 = p.revenue >= T.revenue; rows.push({label:"Annual revenue", val:money(p.revenue) + (p.monthly ? " (from monthly)" : ""), note:"qualification $"+Math.round(T.revenue/1000)+"K+", ok:ok2, yes:"Meets", no:"Below"}); if(!ok2) soft.push("annual revenue"); }
    if(p.credit!=null){ var ok3 = p.credit >= T.credit; creditLow = !ok3; rows.push({label:"Credit score", val:String(p.credit), note:"minimum "+T.credit, ok:ok3, yes:"Meets minimum", no:"Below minimum"}); }
    var paras = [];
    if(!creditLow && soft.length===0){
      paras.push("On the points you shared, you line up with our qualifications. Start an application and a specialist will take it from there.");
    } else {
      if(creditLow) paras.push("Our minimum credit score requirement is " + T.credit + ".");
      if(soft.length) paras.push("You’re under our usual range on " + soft.join(" and ") + ". A financing specialist can look at your full profile, and you can apply to find out where you stand.");
      else paras.push("If your score is close or has recently improved, a financing specialist can talk through where you stand.");
    }
    var missing = [];
    if(p.years==null) missing.push("time in business");
    if(p.revenue==null) missing.push("annual revenue");
    if(p.credit==null) missing.push("credit score");
    if(missing.length) paras.push("Add your " + missing.join(" and ") + " and I’ll compare those too.");
    return {rows:rows, paras:paras};
  }

  var answerEl = $("#answer"), input = $("#askInput");
  function actions(parent){
    var row = el("div","a-actions");
    var go = el("a","btn btn-primary btn-sm"); go.href = "#apply";
    go.setAttribute("data-cta",""); go.dataset.loc = "ask"; go.dataset.start = "Start my application"; go.dataset["continue"] = "Continue your application";
    go.textContent = K.state.started ? go.dataset["continue"] : go.dataset.start;
    var call = el("a","btn btn-ghost btn-sm","Call a specialist: " + cfg.phoneSales); call.href = "tel:" + cfg.phoneSalesTel;
    row.appendChild(go); row.appendChild(call); parent.appendChild(row);
  }
  function render(q){
    var card = el("div","a-card");
    card.appendChild(el("p","a-q","You asked: " + q));
    var body = el("div","a-body");
    var prof = parseProfile(q), hasProfile = prof.years!=null || prof.revenue!=null || prof.credit!=null;
    var ranked = retrieve(q), matched = "none";
    if(hasProfile){
      matched = "profile";
      var pa = profileAnswer(prof);
      body.appendChild(el("p",null,"Here’s how what you shared compares with our qualifications:"));
      var ul = el("ul","cmp");
      pa.rows.forEach(function(r){
        var li = el("li"); li.appendChild(el("span",null, r.label + ": " + r.val + " (" + r.note + ")"));
        li.appendChild(el("span","tag " + (r.ok?"meets":"below"), r.ok ? r.yes : r.no));
        ul.appendChild(li);
      });
      body.appendChild(ul);
      pa.paras.forEach(function(t){ body.appendChild(el("p",null,t)); });
      card.appendChild(body); actions(card);
    } else if(ranked[0].s >= 3){
      var e0 = ranked[0].e; matched = e0.id;
      e0.a.forEach(function(t){ body.appendChild(el("p",null,t)); });
      if(e0.link){ var p = el("p"); var a = el("a",null,e0.link.text); a.href = e0.link.href; a.target = "_blank"; a.rel = "noopener"; p.appendChild(a); body.appendChild(p); }
      if(e0.disclosure){ body.appendChild(el("p","disclosure",e0.disclosure)); }
      card.appendChild(body);
      if(["person","qualify","credit","time","specialist"].indexOf(matched)>-1) actions(card);
    } else {
      body.appendChild(el("p",null,"I don’t have an answer to that in the Kapitus information I can use, and I won’t guess."));
      body.appendChild(el("p",null,"A financing specialist can help at " + cfg.phoneSales + ", or try rephrasing your question."));
      card.appendChild(body); actions(card);
    }
    var rel = (hasProfile || ranked[0].s>=3) ? ranked.filter(function(x,i){ return x.s>=2 && (hasProfile || i>0); }).slice(0,2) : [];
    if(rel.length){
      var rb = el("div","related"); rb.appendChild(el("b",null,"You might also ask"));
      rel.forEach(function(x){
        var b = el("button","linkbtn",x.e.q); b.type = "button";
        b.addEventListener("click", function(){ input.value = x.e.q; submit(x.e.q); });
        rb.appendChild(b);
      });
      card.appendChild(rb);
    }
    answerEl.innerHTML = ""; answerEl.appendChild(card);
    K.track("ask_submit", {matched:matched});   /* only the matched topic id is sent, never the typed text */
  }
  function submit(q){
    q = (q||"").trim();
    if(!q){ input.focus(); return; }
    render(q);
    answerEl.scrollIntoView({behavior: K.reduce ? "auto" : "smooth", block:"nearest"});
  }
  $("#askForm").addEventListener("submit", function(e){ e.preventDefault(); submit(input.value); });
  input.addEventListener("keydown", function(e){ if(e.key==="Enter" && !e.shiftKey){ e.preventDefault(); submit(input.value); } });
})();

/* ============ 08 FLOATING UI: slim mobile CTA bar + scroll to top (shows after ~50% scroll) ============ */
(function(){
  var K = window.KAP, $ = K.$;
  var bar = $("#stickyCta"), top = $("#toTop"); if(!bar || !top) return;
  var inCard=false, inFoot=false, typing=false;
  var mqMobile = window.matchMedia ? window.matchMedia("(max-width: 960px)") : {matches:false};
  function update(){
    var y = window.scrollY || window.pageYOffset;
    var inForm = document.body.classList.contains("form-mode");
    var showBar = mqMobile.matches && !inCard && !inFoot && !typing && !inForm && y > 200;
    bar.classList.toggle("show", showBar);
    document.body.classList.toggle("has-bar", showBar);
    var max = document.documentElement.scrollHeight - window.innerHeight;
    var showTop = !inForm && max > 0 && (y / max) >= 0.5;
    top.classList.toggle("show", showTop);
    top.tabIndex = showTop ? 0 : -1;
  }
  if("IntersectionObserver" in window){
    new IntersectionObserver(function(en){ inCard = en[0].isIntersecting; update(); },{threshold:0.05}).observe($("#card"));
    new IntersectionObserver(function(en){ inFoot = en[0].isIntersecting; update(); },{threshold:0.01}).observe($("#fFoot"));
  }
  /* hide the bar while someone is typing so the on-screen keyboard keeps the whole view */
  document.addEventListener("focusin", function(e){ var t = e.target; typing = !!(t && (t.tagName==="TEXTAREA" || (t.tagName==="INPUT" && t.type!=="range"))); update(); });
  document.addEventListener("focusout", function(){ typing = false; setTimeout(update, 50); });
  window.addEventListener("scroll", update, {passive:true});
  window.addEventListener("resize", update);
  top.addEventListener("click", function(){
    K.track("scroll_top");
    window.scrollTo({top:0, behavior: K.reduce ? "auto" : "smooth"});
    var h = $("#top"); if(h){ h.setAttribute("tabindex","-1"); h.focus({preventScroll:true}); }
  });
  update();
})();

/* ============ 09 APPLICATION FORM: focus mode + 20 screens ============
   Follows the live /simple/ form (same questions, options, helper text and rules). Co-owner screens are skipped for now.
   Order: Business details (10) > Profile information (7) > Documents (3).
   EDIT HERE: STEPS (order, copy, options), the validators, TERMS_HTML. Options for the form live in cfg.form (section 00).
   PRIVACY: personal answers stay in memory only. Nothing is stored or sent unless cfg.form.submitUrl is set. */
(function(){
  var K = window.KAP, $ = K.$, $$ = K.$$, el = K.el, cfg = K.cfg, F = cfg.form, st = K.state;
  var card = $("#card"); if(!card) return;
  var body=$("#fbody"), bar=$("#bar"), prog=$("#fprog"), meta=$("#fmeta"), catEl=$("#fcat"), cntEl=$("#fcount"),
      nav=$("#fnav"), backBtn=$("#fback"), nextBtn=$("#fnext"), closeBtn=$("#fclose");
  var reduce = K.reduce, formMode = false, finished = false, idx = 0, ctrl = null, leaving = false, advTimer = null;
  var A = {};                                   /* all answers (personal ones never leave memory) */
  var SAFE = ["amount","uses","usesOther","industry","industryOther","entity","entityOther","startMonth","startYear","ownership","revenue","loans","loanBalance"];
  SAFE.forEach(function(k){ if(st.data && st.data[k]!=null) A[k] = st.data[k]; });
  function safeData(){ var o = {}; SAFE.forEach(function(k){ if(A[k]!=null) o[k] = A[k]; }); return o; }

  /* ---------- options (from the /simple/ form) ---------- */
  var CATS = ["Business details","Profile information","Documents"];
  var USES = ["Cash flow","Inventory","Payroll","Repairs or equipment","Expansion or new hires","Emergency"];
  var INDUSTRY = ["Construction","Business / IT","Health Care","Personal Services","Transportation","Education","Automotive","Real Estate","Food / Hospitality"];
  var ENTITY = ["Professional LLC","S Corporation / C Corporation","Professional Corporation (PC)","Sole Proprietorship"];
  var OWN = ["Less than 25%","25% to 50%","51% to 99%","100%"];
  var REV = ["$0 to $100K","$100K to $250K","$250K to $500K","$500K to $750K","$750K to $1M","$1M to $3M","$3M+"];
  var BAL = ["Below $10K","$10K to $50K","$50K to $100K","$100K to $500K","$500K+"];
  var CREDIT = ["599 and below","600 to 649","650 to 679","680 to 699","700 to 719","720 to 739","740 and above"];
  var REFERRAL = ["Internet search","ChatGPT or similar","Radio or Podcast","Social Media","Digital ads","TV or Streaming","Direct Mail","Referral / word of mouth"];
  var STATES = "Alabama,Alaska,American Samoa,Arizona,Arkansas,California,Colorado,Connecticut,Delaware,District of Columbia,Florida,Georgia,Hawaii,Idaho,Illinois,Indiana,Iowa,Kansas,Kentucky,Louisiana,Maine,Maryland,Massachusetts,Michigan,Minnesota,Mississippi,Missouri,Montana,Nebraska,Nevada,New Hampshire,New Jersey,New Mexico,New York,North Carolina,North Dakota,Ohio,Oklahoma,Oregon,Pennsylvania,Puerto Rico,Rhode Island,South Carolina,South Dakota,Tennessee,Texas,Utah,Vermont,Virginia,Washington,West Virginia,Wisconsin,Wyoming".split(",");
  var MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  function opt(list){ return list.map(function(x){ return {v:x, t:x}; }); }
  var NOW = new Date(), CY = NOW.getFullYear(), CM = NOW.getMonth()+1;
  function range(from, to){ var o = [], i; if(from<=to){ for(i=from;i<=to;i++) o.push({v:String(i),t:String(i)}); } else { for(i=from;i>=to;i--) o.push({v:String(i),t:String(i)}); } return o; }
  var MONTH_OPTS = MONTHS.map(function(m,i){ return {v:String(i+1), t:m}; });

  /* ---------- masks and validators ---------- */
  function fmtPhone(d){ d = d.slice(0,10); if(d.length<4) return d ? "("+d : ""; if(d.length<7) return "("+d.slice(0,3)+") "+d.slice(3); return "("+d.slice(0,3)+") "+d.slice(3,6)+"-"+d.slice(6); }
  function fmtEIN(d){ d = d.slice(0,9); return d.length<3 ? d : d.slice(0,2)+"-"+d.slice(2); }
  function fmtSSN(d){ d = d.slice(0,9); if(d.length<4) return d; if(d.length<6) return d.slice(0,3)+"-"+d.slice(3); return d.slice(0,3)+"-"+d.slice(3,5)+"-"+d.slice(5); }
  function attachMask(input, fmtFn){
    var prev = input.value;
    input.addEventListener("input", function(e){
      var d = K.digits(input.value);
      if(e.inputType==="deleteContentBackward" && fmtFn(d)===prev) d = d.slice(0,-1);   /* deleting a separator removes the digit before it */
      var out = fmtFn(d); input.value = out; prev = out;
    });
  }
  var vName = function(label){ return function(v){ return (v.length>=2 && /^[A-Za-z][A-Za-z\s'.-]*$/.test(v)) ? "" : "Enter your " + label + "."; }; };
  var vText = function(msg){ return function(v){ return v.length>=2 ? "" : msg; }; };
  function vPhone(v){ var d = K.digits(v); return (d.length===10 && !/^(\d)\1{9}$/.test(d)) ? "" : "Please enter a valid phone number."; }
  function vEmail(v){ return (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) && !/\.\./.test(v)) ? "" : "Please enter a valid email address."; }
  function vZip(v){ return (/^\d{5}$/.test(v) && !/^(\d)\1{4}$/.test(v)) ? "" : "Please enter a valid 5-digit ZIP code."; }
  function vEIN(v){ return K.digits(v).length===9 ? "" : "Please enter your business’s 9-digit EIN."; }
  function vSSN(v){ return K.digits(v).length===9 ? "" : "Please enter a valid Social Security Number."; }
  function vStreet(v){ return v.length>=3 ? "" : "Please enter a valid street address."; }
  function vCity(v){ return (v.length>=2 && !/\d/.test(v)) ? "" : "Please enter a valid city."; }
  function vState(v){ return v ? "" : "Select your state."; }
  function vWeb(v){ return (!v || /^(https?:\/\/)?[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+(\/\S*)?$/.test(v)) ? "" : "Please enter a valid website, or leave this blank."; }

  /* ---------- small UI helpers ---------- */
  function icon(kind){
    return kind==="lock"
      ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>'
      : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.500 1 2.500h6c0-1 .2-1.700 1-2.500A6 6 0 0 0 12 3z"/></svg>';
  }
  function hintPill(text, kind){ var d = el("div","hintpill"); d.innerHTML = icon(kind); d.appendChild(el("span",null,text)); return d; }
  function field(def){
    var id = "f_" + def.key, w = el("div","ff"), l = el("label",null,def.label); l.setAttribute("for", id); w.appendChild(l);
    var i;
    if(def.options){
      i = document.createElement("select");
      var ph = document.createElement("option"); ph.value = ""; ph.textContent = def.placeholder || "Select"; i.appendChild(ph);
      def.options.forEach(function(o){ var op = document.createElement("option"); op.value = o.v; op.textContent = o.t; i.appendChild(op); });
    } else {
      i = document.createElement("input"); i.type = def.type || "text";
      if(def.inputmode) i.setAttribute("inputmode", def.inputmode);
      if(def.maxlength) i.maxLength = def.maxlength;
      if(def.placeholder) i.placeholder = def.placeholder;
    }
    i.id = id; i.name = def.key; i.setAttribute("autocomplete", def.autocomplete || "off");
    if(def.value!=null) i.value = def.value;
    if(def.prefix){ var pw = el("div","pfx"); pw.appendChild(el("span","pfx-s",def.prefix)); pw.appendChild(i); w.appendChild(pw); } else { w.appendChild(i); }
    var h = null; if(def.help){ h = el("div","ft",def.help); h.id = id+"_h"; w.appendChild(h); }
    var e = el("div","ferr"); e.id = id+"_e"; w.appendChild(e);
    i.setAttribute("aria-describedby", (h ? id+"_h " : "") + id+"_e");
    if(def.mask) attachMask(i, def.mask);
    var api = {wrap:w, el:i,
      get:function(){ return i.value.trim(); }, set:function(v){ i.value = v==null ? "" : v; },
      show:function(m){ e.textContent = m || ""; i.setAttribute("aria-invalid", m ? "true" : "false"); w.classList.toggle("bad", !!m); },
      check:function(){ var m = def.validate ? def.validate(api.get()) : ""; api.show(m); return !m; }};
    i.addEventListener("blur", function(){ if(api.get()) api.check(); });
    i.addEventListener(def.options ? "change" : "input", function(){ if(w.classList.contains("bad")) api.check(); });
    return api;
  }
  function validateAll(list, stepId){
    var ok = true, firstBad = null;
    list.forEach(function(f){ if(!f.check()){ ok = false; if(!firstBad) firstBad = f; } });
    if(!ok){ firstBad.el.focus(); K.track("form_error", {step:stepId}); }
    return ok;
  }
  function setNext(show){ nextBtn.hidden = !show; }

  /* ---------- screen builders: each returns {next(): validate + save, hideNext?} ---------- */
  var builders = {};

  builders.amount = function(s, box){
    var intro = !formMode;
    if(intro) box.appendChild(el("p","sub","Enter an amount to start. You can change it anytime."));
    var f = el("div","field"); f.id = "amountField";
    f.appendChild(el("span","cur","$")).setAttribute("aria-hidden","true");
    var inp = document.createElement("input"); inp.id = "amount"; inp.setAttribute("inputmode","numeric"); inp.setAttribute("autocomplete","off");
    inp.setAttribute("aria-label","Funding amount in US dollars"); inp.setAttribute("aria-describedby","amountErr");
    inp.value = K.fmt(A.amount || cfg.defaultAmount); f.appendChild(inp);
    var err = el("div","err"); err.id = "amountErr"; err.setAttribute("role","alert");
    box.appendChild(f); box.appendChild(err);
    inp.addEventListener("input", function(){ inp.value = K.fmt(K.digits(inp.value)); f.dataset.invalid = "false"; err.textContent = ""; });
    inp.addEventListener("focus", function(){ setTimeout(function(){ inp.select(); }, 0); });
    function commit(){
      var n = Number(K.digits(inp.value));
      if(!n || n < cfg.amountMin || n > cfg.amountMax){
        f.dataset.invalid = "true"; err.textContent = "Enter an amount between $" + K.fmt(cfg.amountMin) + " and $" + K.fmt(cfg.amountMax) + ".";
        inp.focus(); return false;
      }
      A.amount = n; return true;
    }
    if(intro){
      var b = el("button","btn btn-primary","Get started"); b.type = "button"; b.id = "start"; box.appendChild(b);
      var rn = el("p","range-note"); rn.innerHTML = "We provide <b>$5K to $5M</b> in financing. The amount depends on your business profile."; box.appendChild(rn);
      var go = function(){
        if(!commit()) return;
        K.track("amount_submit", {amount:A.amount});
        idx = 1; K.set({started:true}); persist(); enter();
      };
      b.addEventListener("click", go);
      inp.addEventListener("keydown", function(e){ if(e.key==="Enter"){ e.preventDefault(); go(); } });
    } else {
      inp.addEventListener("keydown", function(e){ if(e.key==="Enter"){ e.preventDefault(); next(); } });
    }
    return {next:commit, hideNext:intro, focus:function(){ inp.focus(); }};
  };

  /* single choice as chips; optional "Other" with a text field; auto-advance after a tap */
  builders.single = function(s, box){
    var val = A[s.key] || "", err = el("div","ferr"), chips = [];
    var grid = el("div","opts" + (s.cols ? " "+s.cols : "")); grid.setAttribute("role","group"); grid.setAttribute("aria-label", s.title);
    function mk(label){ var b = el("button","chip",label); b.type = "button"; b.setAttribute("aria-pressed", String(val===label)); b.addEventListener("click", function(){ choose(label); }); chips.push(b); grid.appendChild(b); }
    s.options.forEach(mk);
    if(s.other) mk("Other");
    box.appendChild(grid);
    var oi = null;
    if(s.other){
      oi = field({key:s.key+"_other", label:"Please specify", autocomplete:"off", validate:vText("Please describe your answer.")});
      oi.wrap.hidden = val !== "Other"; oi.set(A[s.key+"Other"] || ""); box.appendChild(oi.wrap);
    }
    box.appendChild(err);
    function choose(v){
      val = v; err.textContent = "";
      chips.forEach(function(b){ b.setAttribute("aria-pressed", String(b.textContent===v)); });
      if(oi) oi.wrap.hidden = (v !== "Other");
      if(v === "Other"){ setNext(true); oi.el.focus(); return; }
      A[s.key] = v; delete A[s.key+"Other"];
      if(s.auto && F.autoAdvance){
        setNext(false); clearTimeout(advTimer);
        advTimer = setTimeout(function(){ if(STEPS[idx]===s) next(); }, reduce ? 0 : F.autoAdvanceDelay);
      } else { setNext(true); }
    }
    return {
      next:function(){
        if(!val){ err.textContent = "Please select an option."; return false; }
        if(val==="Other"){ if(!oi.check()){ oi.el.focus(); return false; } A[s.key] = "Other"; A[s.key+"Other"] = oi.get(); }
        else { A[s.key] = val; }
        return true;
      },
      hideNext: !!(s.auto && F.autoAdvance && !A[s.key])
    };
  };

  builders.multi = function(s, box){
    box.appendChild(el("p","sub2","Select all that apply."));
    var vals = (A[s.key] || []).slice(), err = el("div","ferr"), chips = [];
    var grid = el("div","opts"); grid.setAttribute("role","group"); grid.setAttribute("aria-label", s.title);
    function mk(label){ var b = el("button","chip",label); b.type = "button"; b.setAttribute("aria-pressed", String(vals.indexOf(label)>-1)); b.addEventListener("click", function(){ toggle(label); }); chips.push(b); grid.appendChild(b); }
    s.options.forEach(mk); if(s.other) mk("Other");
    box.appendChild(grid);
    var oi = null;
    if(s.other){ oi = field({key:s.key+"_other", label:"Please specify", validate:vText("Please describe your answer.")}); oi.wrap.hidden = vals.indexOf("Other")<0; oi.set(A[s.key+"Other"] || ""); box.appendChild(oi.wrap); }
    box.appendChild(err);
    function toggle(label){
      var i = vals.indexOf(label); if(i>-1) vals.splice(i,1); else vals.push(label);
      chips.forEach(function(b){ if(b.textContent===label) b.setAttribute("aria-pressed", String(vals.indexOf(label)>-1)); });
      if(oi){ oi.wrap.hidden = vals.indexOf("Other")<0; if(label==="Other" && !oi.wrap.hidden) oi.el.focus(); }
      err.textContent = "";
    }
    return {next:function(){
      if(!vals.length){ err.textContent = "Select at least one option."; return false; }
      if(vals.indexOf("Other")>-1){ if(!oi.check()){ oi.el.focus(); return false; } A[s.key+"Other"] = oi.get(); } else { delete A[s.key+"Other"]; }
      A[s.key] = vals.slice(); return true;
    }};
  };

  builders.monthyear = function(s, box){
    var m = field({key:"startMonth", label:"Month", options:MONTH_OPTS, value:A.startMonth, validate:function(v){ return v ? "" : "Please select a month."; }});
    var y = field({key:"startYear", label:"Year", options:range(CY,1920), value:A.startYear, validate:function(v){ return v ? "" : "Please select a year."; }});
    var row = el("div","row2"); row.appendChild(m.wrap); row.appendChild(y.wrap); box.appendChild(row);
    return {next:function(){
      if(!validateAll([m,y], s.id)) return false;
      if(Number(y.get())===CY && Number(m.get())>CM){ m.show("Please choose a date in the past."); m.el.focus(); return false; }
      A.startMonth = m.get(); A.startYear = y.get(); return true;
    }};
  };

  builders.loans = function(s, box){
    var val = A.loans || "", err = el("div","ferr");
    var grid = el("div","opts one"); var chips = [];
    [["No","No, I don’t have existing loans"],["Yes","Yes, I have existing loans"]].forEach(function(o){
      var b = el("button","chip",o[1]); b.type = "button"; b.dataset.v = o[0]; b.setAttribute("aria-pressed", String(val===o[0])); chips.push(b); grid.appendChild(b);
      b.addEventListener("click", function(){ choose(o[0]); });
    });
    box.appendChild(grid);
    var more = el("div","fbox"); more.hidden = val !== "Yes";
    var lender = field({key:"lender", label:"Lender name", autocomplete:"organization", value:A.lender, validate:vText("Please enter your lender’s name.")});
    var balWrap = el("div"); balWrap.appendChild(el("div","sub2","Loan balance"));
    var bal = el("div","opts"); bal.setAttribute("role","group"); bal.setAttribute("aria-label","Loan balance"); var balChips = [];
    var balVal = A.loanBalance || "";
    BAL.forEach(function(x){ var b = el("button","chip",x); b.type = "button"; b.setAttribute("aria-pressed", String(balVal===x)); b.addEventListener("click", function(){ balVal = x; balChips.forEach(function(c){ c.setAttribute("aria-pressed", String(c.textContent===x)); }); err.textContent = ""; }); balChips.push(b); bal.appendChild(b); });
    balWrap.appendChild(bal); more.appendChild(lender.wrap); more.appendChild(balWrap); box.appendChild(more); box.appendChild(err);
    function choose(v){
      val = v; err.textContent = "";
      chips.forEach(function(b){ b.setAttribute("aria-pressed", String(b.dataset.v===v)); });
      more.hidden = (v !== "Yes");
      if(v==="No"){ A.loans = "No"; delete A.lender; delete A.loanBalance;
        if(F.autoAdvance){ setNext(false); clearTimeout(advTimer); advTimer = setTimeout(function(){ if(STEPS[idx]===s) next(); }, reduce ? 0 : F.autoAdvanceDelay); } else setNext(true);
      } else { setNext(true); lender.el.focus(); }
    }
    return {next:function(){
      if(!val){ err.textContent = "Please select an option."; return false; }
      if(val==="Yes"){
        if(!lender.check()){ lender.el.focus(); return false; }
        if(!balVal){ err.textContent = "Please select your loan balance."; return false; }
        A.lender = lender.get(); A.loanBalance = balVal;
      }
      A.loans = val; return true;
    }, hideNext: !!(F.autoAdvance && val !== "Yes")};
  };

  builders.bizname = function(s, box){
    var dba = field({key:"dba", label:"DBA (business name)", autocomplete:"organization", value:A.dba, validate:vText("Please enter your business name.")});
    var legal = field({key:"legal", label:"Legal business name", autocomplete:"organization", value:A.legal, validate:vText("Please enter your legal business name.")});
    var ein = field({key:"ein", label:"EIN / Tax ID", inputmode:"numeric", maxlength:10, mask:fmtEIN, value:A.ein, placeholder:"00-0000000",
      help:"This is your business’s Tax ID. You can find it on your latest business tax return. We use this information to verify your business.", validate:vEIN});
    box.appendChild(dba.wrap); box.appendChild(legal.wrap); box.appendChild(ein.wrap);
    var q = el("div"); q.appendChild(el("div","sub2","Do you own multiple locations or businesses?"));
    var grid = el("div","opts two"); var mv = A.multi || ""; var chips = [];
    ["Yes","No"].forEach(function(x){ var b = el("button","chip",x); b.type = "button"; b.setAttribute("aria-pressed", String(mv===x)); b.addEventListener("click", function(){ mv = x; chips.forEach(function(c){ c.setAttribute("aria-pressed", String(c.textContent===x)); }); err.textContent = ""; }); chips.push(b); grid.appendChild(b); });
    var err = el("div","ferr"); q.appendChild(grid); q.appendChild(err); box.appendChild(q);
    return {next:function(){
      var ok = validateAll([dba,legal,ein], s.id);
      if(!mv){ err.textContent = "Please select an option."; ok = false; }
      if(!ok) return false;
      A.dba = dba.get(); A.legal = legal.get(); A.ein = ein.get(); A.multi = mv; return true;
    }};
  };

  builders.address = function(s, box){
    var p = s.prefix, fs = {};
    var same = null;
    if(s.sameAs){
      var lab = el("label","chk"); same = document.createElement("input"); same.type = "checkbox"; same.checked = !!A.homeSame;
      lab.appendChild(same); lab.appendChild(el("span",null,"Same as business address")); box.appendChild(lab);
    }
    fs.street = field({key:p+"Street", label:"Street address", autocomplete:"address-line1", value:A[p+"Street"], validate:vStreet});
    fs.city = field({key:p+"City", label:"City", autocomplete:"address-level2", value:A[p+"City"], validate:vCity});
    fs.state = field({key:p+"State", label:"State", options:opt(STATES), placeholder:"Select state", autocomplete:"address-level1", value:A[p+"State"], validate:vState});
    fs.zip = field({key:p+"Zip", label:"ZIP code", inputmode:"numeric", maxlength:5, mask:function(d){ return d.slice(0,5); }, autocomplete:"postal-code", value:A[p+"Zip"], validate:vZip});
    box.appendChild(fs.street.wrap);
    var row = el("div","row3"); row.appendChild(fs.city.wrap); row.appendChild(fs.state.wrap); row.appendChild(fs.zip.wrap); box.appendChild(row);
    var web = null;
    if(s.website){ web = field({key:"bizWeb", label:"Website (optional)", inputmode:"url", autocomplete:"url", value:A.bizWeb, validate:vWeb}); box.appendChild(web.wrap); }
    function lock(on){
      ["street","city","state","zip"].forEach(function(k){
        var f = fs[k], map = {street:"bizStreet",city:"bizCity",state:"bizState",zip:"bizZip"};
        if(on){ f.set(A[map[k]] || ""); }
        if(k==="state") f.el.disabled = on; else f.el.readOnly = on;
        f.show("");
      });
    }
    if(same){ lock(same.checked); same.addEventListener("change", function(){ lock(same.checked); if(!same.checked){ ["street","city","state","zip"].forEach(function(k){ fs[k].set(""); }); } }); }
    return {next:function(){
      var list = [fs.street,fs.city,fs.state,fs.zip]; if(web) list.push(web);
      if(!validateAll(list, s.id)) return false;
      A[p+"Street"] = fs.street.get(); A[p+"City"] = fs.city.get(); A[p+"State"] = fs.state.el.value; A[p+"Zip"] = fs.zip.get();
      if(web) A.bizWeb = web.get(); if(same) A.homeSame = same.checked;
      return true;
    }};
  };

  /* fields-only screens (name, contact) */
  builders.fields = function(s, box){
    var list = s.fields.map(function(d){ var o = Object.assign({}, d); o.value = A[d.key]; return field(o); });
    var grid = el(list.length===2 ? "row2" : "fbox");
    list.forEach(function(f){ grid.appendChild(f.wrap); }); box.appendChild(grid);
    return {next:function(){ if(!validateAll(list, s.id)) return false; list.forEach(function(f, i){ A[s.fields[i].key] = f.get(); }); return true; }};
  };

  builders.dob = function(s, box){
    var m = field({key:"dobM", label:"Month", options:MONTH_OPTS, autocomplete:"bday-month", value:A.dobM, validate:function(v){ return v ? "" : "Select a month."; }});
    var d = field({key:"dobD", label:"Day", options:range(1,31), autocomplete:"bday-day", value:A.dobD, validate:function(v){ return v ? "" : "Select a day."; }});
    var y = field({key:"dobY", label:"Year", options:range(CY-18,1920), autocomplete:"bday-year", value:A.dobY, validate:function(v){ return v ? "" : "Select a year."; }});
    var row = el("div","rowdob"); row.appendChild(m.wrap); row.appendChild(d.wrap); row.appendChild(y.wrap); box.appendChild(row);
    var err = el("div","ferr"); box.appendChild(err);
    return {next:function(){
      err.textContent = "";
      if(!validateAll([m,d,y], s.id)) return false;
      var Y = Number(y.get()), M = Number(m.get()), D = Number(d.get()), dt = new Date(Y, M-1, D);
      if(dt.getFullYear()!==Y || dt.getMonth()!==M-1 || dt.getDate()!==D){ err.textContent = "Please enter a valid date."; return false; }
      var age = CY - Y - ((NOW.getMonth()+1 < M || (NOW.getMonth()+1===M && NOW.getDate() < D)) ? 1 : 0);
      if(age < 18){ err.textContent = "You must be at least 18 to apply."; return false; }
      A.dobM = m.get(); A.dobD = d.get(); A.dobY = y.get(); return true;
    }};
  };

  builders.ssn = function(s, box){
    var f = field({key:"ssn", label:"Social Security Number", type:"password", inputmode:"numeric", maxlength:11, mask:fmtSSN, autocomplete:"off", value:A.ssn, placeholder:"000-00-0000", validate:vSSN});
    box.appendChild(f.wrap);
    var t = el("button","tgl","Show"); t.type = "button"; t.setAttribute("aria-pressed","false");
    t.addEventListener("click", function(){ var show = f.el.type==="password"; f.el.type = show ? "text" : "password"; t.textContent = show ? "Hide" : "Show"; t.setAttribute("aria-pressed", String(show)); });
    box.appendChild(t);
    return {next:function(){ if(!validateAll([f], s.id)) return false; A.ssn = f.get(); return true; }};
  };

  /* documents: drag and drop or select, with visible errors (type, size, count) */
  builders.upload = function(s, box){
    var need = (A.bizState==="California" || A.bizState==="New York") ? 4 : 3;
    A.files = A.files || [];
    box.appendChild(el("p","sub2","Please upload your " + need + " most recent, complete bank statements for your business."));
    box.appendChild(el("p","sub2","You can download recent statements from your online banking portal. PDF format preferred."));
    var drop = el("div","drop");
    drop.appendChild(el("p",null,"Choose a file or drag & drop it here"));
    drop.appendChild(el("small",null,"JPEG, PNG and PDF, up to " + F.maxFileMB + " MB each"));
    var pick = el("button","btn btn-ghost btn-sm","Select files"); pick.type = "button";
    var fi = document.createElement("input"); fi.type = "file"; fi.multiple = true; fi.hidden = true;
    fi.accept = ".pdf,.jpg,.jpeg,.png,image/jpeg,image/png,application/pdf";
    drop.appendChild(pick); drop.appendChild(fi); box.appendChild(drop);
    var err = el("div","ferr"); err.setAttribute("role","alert"); box.appendChild(err);
    var list = el("ul","flist"); box.appendChild(list);
    var count = el("div","fcount2"); box.appendChild(count);
    var later = null;
    if(F.allowUploadLater){
      var lab = el("label","chk"); later = document.createElement("input"); later.type = "checkbox"; later.checked = !!A.uploadLater;
      lab.appendChild(later); lab.appendChild(el("span",null,"I don’t have these handy. Email me a secure link to upload them later.")); box.appendChild(lab);
      later.addEventListener("change", function(){ A.uploadLater = later.checked; err.textContent = ""; });
    }
    function size(n){ return n < 1048576 ? Math.max(1,Math.round(n/1024)) + " KB" : (n/1048576).toFixed(1) + " MB"; }
    function paint(){
      list.innerHTML = "";
      A.files.forEach(function(f, i){
        var li = el("li"); var left = el("span","nm",f.name); left.appendChild(el("span","sz",size(f.size)));
        var rm = el("button",null,"Remove"); rm.type = "button"; rm.setAttribute("aria-label","Remove " + f.name);
        rm.addEventListener("click", function(){ A.files.splice(i,1); err.textContent = ""; paint(); });
        li.appendChild(left); li.appendChild(rm); list.appendChild(li);
      });
      count.textContent = A.files.length + " of " + need + " files added";
    }
    function add(fl){
      var msgs = [];
      Array.prototype.forEach.call(fl, function(f){
        var ext = (f.name.split(".").pop() || "").toLowerCase();
        if(["pdf","jpg","jpeg","png"].indexOf(ext) < 0){ msgs.push(f.name + " isn’t a supported type. Use PDF, JPG or PNG."); return; }
        if(f.size > F.maxFileMB * 1048576){ msgs.push(f.name + " is " + size(f.size) + ". The limit is " + F.maxFileMB + " MB per file."); return; }
        if(A.files.some(function(x){ return x.name===f.name && x.size===f.size; })){ return; }
        if(A.files.length >= need){ msgs.push("You can add up to " + need + " files."); return; }
        A.files.push(f);
      });
      err.textContent = msgs.join(" "); paint();
    }
    pick.addEventListener("click", function(){ fi.click(); });
    fi.addEventListener("change", function(){ add(fi.files); fi.value = ""; });
    ["dragenter","dragover"].forEach(function(ev){ drop.addEventListener(ev, function(e){ e.preventDefault(); drop.classList.add("over"); }); });
    ["dragleave","drop"].forEach(function(ev){ drop.addEventListener(ev, function(e){ e.preventDefault(); drop.classList.remove("over"); }); });
    drop.addEventListener("drop", function(e){ if(e.dataTransfer && e.dataTransfer.files) add(e.dataTransfer.files); });
    paint();
    return {next:function(){
      if(A.files.length >= F.minFiles || (later && later.checked)){ return true; }
      err.textContent = "Add at least " + F.minFiles + " statement" + (F.minFiles>1 ? "s" : "") + (later ? ", or choose to upload them later." : "."); return false;
    }};
  };

  /* acknowledgement: terms must be scrolled before the checkbox works */
  var TERMS_HTML = `
<p>The Business and Owner(s) identified above (collectively, the “Applicant”) each represent, acknowledge and agree to the Representations and Acknowledgments set forth below. In processing this application, Kapitus may request credit reports from one or more credit bureaus on the Business and Owner(s) (the Owners(s)’ personal credit score will not be affected by Kapitus’s request). Applicant further represents, acknowledges and agrees to the Consents Relating to the Referral of Application to Third-Parties, the Consent to Use Electronic Records and Signatures, and the Promotions and the Services Notice set forth below. Please note that you are not required to consent to be contacted for marketing or promotional purposes in order to qualify for financing or obtain products or services from Kapitus.</p>
<p><u>Representations and Acknowledgments of Applicant</u></p>
<p>1. All information and documents provided by the Applicant directly or indirectly, in connection with or as part of this application are true, accurate and complete;<br>
2. Applicant will immediately notify Kapitus and/or its subsidiaries, affiliates or agents (collectively, “Kapitus”) of any error or change in such information or in the Applicant’s financial condition;<br>
3. Kapitus is authorized to request and receive consumer or personal, and business or entity, credit reports from one or more credit bureaus, such as TransUnion, Experian or Equifax, investigative reports about the Applicant from third party data aggregators, and other financial information about Applicant, including credit card processor statements and bank statements, directly from credit bureaus, banks, creditors or other third parties, and to verify through third-party sources all information contained, provided, or obtained in connection with the Application;<br>
4. Applicant waives and releases any claims against Kapitus arising from any act or omission relating to Kapitus’s request for, receipt of or release of information as authorized by this Application;<br>
5. Each Owner represents that they are authorized to execute any documents on behalf of the Business and to bind the Business;<br>
6. Applicant agrees to conduct business by electronic means, including without limitation the receipt by email of agreements, communications, notices, authorizations, disclosures (including any and all disclosures and/or notices required to be given by applicable law), and any other records we provide (collectively, “Communications”). Applicant understands and acknowledges that electronic signatures shall have the same legal effect as if signed in ink and will be deemed valid, enforceable, and binding.</p>
<p><u>Consents Relating to the Referral of the Application to Third-Parties for Purposes of Securing Financing</u></p>
<p>1. Applicant authorizes Kapitus to provide the Application, including all information and documents obtained (such as, without limitation, information obtained from credit reports) to third-party financial institutions, lenders, loan servicers, purchasers of accounts receivable, factoring companies, equipment finance or leasing companies, brokers or other similar sources of commercial financing (collectively, “Third-Parties”) in connection with or following the processing of this Application for financing by Kapitus.<br>
2. Applicant authorizes the Third-Parties to whom the Application is provided to, separately and on their own behalf, request and receive consumer or personal, and business or entity, credit reports from one or more credit bureaus, such as TransUnion, Experian or Equifax, investigative reports about the Applicant from third party data aggregators, and other financial information about Applicant, including credit card processor statements and bank statements, directly from credit bureaus, banks, creditors or other third parties, and to verify through third-party sources all information contained, provided, or obtained in connection with the Application. Such inquiries by Third Parties may be “hard credit pulls” that may impact the credit score of the Business and/or the Owner(s).</p>
<p><u>Consent to Use Electronic Records and Signatures</u></p>
<p>Applicant’s consent to use electronic records and signatures. Applicant agrees that Kapitus may provide any Communications electronically (“Electronic Records”) and to the use of electronic signatures. Applicant’s consent applies to all Communications that may be provided during Applicant’s business relationship with Kapitus. For example, this ESIGN Consent and Disclosure, applications, agreements, and notices or disclosures required to be provided by law or that Kapitus chooses to provide in its discretion. Electronic Records shall be delivered to Applicant by email or other electronic means. Even with Applicant’s consent to Electronic Records, Kapitus may, in its sole discretion, provide any Communication on paper. Applicant acknowledges and agrees that all Electronic Records delivered to Applicant by Kapitus (i) shall be given the same legal effect as signed paper Communications, (ii) shall be considered a “writing” or “in writing” and (iii) shall be deemed for all purposes to have been "signed" and to constitute an "original" when printed from electronic files or records established and maintained in the normal course of business. Any notice Applicant is required to provide to Kapitus by law, agreement, or otherwise must be provided to us on paper, unless we specifically communicate in another Communication that it may be delivered to us electronically.</p>
<p>Applicant’s option to receive paper copies. Applicant may request a paper copy of an Electronic Record Kapitus provided at no charge to Applicant by contacting us at (800) 780-7133 or support@kapitus.com.</p>
<p>Changing Applicant’s consent. Applicant may withdraw Applicant’s consent at any time. To withdraw consent, Applicant must contact us at (800) 780-7133 or support@kapitus.com. Applicant’s withdrawal of consent will be effective after Kapitus has a reasonable opportunity to act upon it.</p>
<p>Maintaining Current Email Information on File. It is Applicant’s responsibility to keep Applicant’s primary email address current so Kapitus can communicate with Applicant electronically. Applicant must promptly contact us at (800) 780-7133 or support@kapitus.com to notify us of any changes to Applicant’s email address on file with Kapitus. If Applicant uses a spam filter or similar software that blocks or re-routes emails from senders not listed in Applicant’s email address book, consider adding Kapitus to the email address book.</p>
<p>Necessary Hardware and Software Requirements. For access to and retention of Electronic Records, Applicant must have:</p>
<p>1. A valid email address;<br>2. Sufficient electronic storage capacity;<br>3. An internet browser, with software for viewing documents such as Portable Document Format (PDF);<br>4. Internet connectivity capable of sending, receiving and accessing data, information and communications from us;<br>5. Either a printer, a hard drive, or other storage capabilities.</p>
<p>If Kapitus’s hardware or software requirements change and that change would create a material risk that Applicant would not be able to access or retain Electronic Records, Kapitus will provide notice of the revised hardware or software requirements and a reminder of Applicant’s right to withdraw consent to Electronic Records.<br>By providing consent, Applicant confirms that Applicant has the hardware and software described above, that Applicant is able to receive and review Electronic Records, and that Applicant has provided a valid email account.<br>Applicant’s Acknowledgment and Confirmation of Consent. By signing below, Applicant acknowledges and agrees, among other things that (1) Applicant affirmatively consents to do business electronically and that Applicant and Kapitus both intend that the Electronic Signatures in Global and National Commerce Act apply to the fullest extent possible to validate our ability to conduct business by electronic means; (3) Applicant can access and read the terms and notices set forth herein; (4) Applicant can print on paper this disclosure or save or send the disclosure to a place where Applicant can print it, for future reference and access; and (3) until or unless Applicant notifies Kapitus per instructions above, Applicant consents to receipt of Communications through electronic means.</p>
<p><u>Promotions and Servicing Notice</u></p>
<p>Kapitus may, from time to time, notify Applicant of various promotional offers and other marketing information, or contact Applicant in connection with the servicing of any financing, or in connection with any default under any financing. Applicant expressly consents and authorizes Kapitus to call, e-mail, send text messages, and/or send other electronic messages (including prerecorded or artificial voice messages) using an automatic telephone dialing system to any telephone number provided by Applicant, and any telephone number included in any and all documents or forms submitted, including cellular phone numbers and landlines, regardless of their inclusion on any do not call list, for purposes of servicing, collections, marketing or promoting any product offered by Kapitus. Please note that you are not required to consent to be contacted for marketing or promotional purposes in order to qualify for financing or obtain any other products or services from Kapitus. If you do not agree to be called for marketing or promotional purposes, please call <a href="tel:844-547-9396">(844) 547-9396</a> or email <a href="mailto:DNC@kapitus.com">DNC@kapitus.com</a></p>
<p>IF YOUR APPLICATION FOR BUSINESS CREDIT IS DENIED, YOU HAVE THE RIGHT TO A WRITTEN STATEMENT OF THE SPECIFIC REASONS FOR THE DENIAL. TO OBTAIN THE STATEMENT, PLEASE CONTACT KAPITUS LLC AT 2500 WILSON BOULEVARD, SUITE 350, ARLINGTON, VIRGINIA 22201 OR (844) 547-9396 WITHIN 60 DAYS FROM THE DATE YOU ARE NOTIFIED OF THE CREDIT DECISION. YOU HAVE THE RIGHT TO OBTAIN A WRITTEN STATEMENT OF REASONS FOR THE DENIAL WITHIN 30 DAYS OF RECEIVING YOUR REQUEST FOR THE STATEMENT.</p>
<p><em>The notice below applies to applications processed by Kapitus. If the Application is referred to Third-Parties, they may separately contact you or provide information about your rights in the event your application is denied to the extent required by law.</em></p>
<p>Copyright 2026 • Kapitus • All Rights Reserved. Loans made in California by Strategic Funding Source, Inc. dba Kapitus are issued pursuant to California Finance Lenders License No. 603-G807. By signing below, you agree that you have read and agree to the above terms and notices and our <a href="https://kapitus.com/privacy-policy" target="_blank" rel="noopener">Privacy Policy</a> and our website Terms of Use Agreement (available at <a href="https://kapitus.com" target="_blank" rel="noopener">www.kapitus.com</a>).</p>`;

  builders.terms = function(s, box){
    box.appendChild(el("p","sub2","Scroll and review all terms to enable the checkbox."));
    var t = el("div","terms"); t.tabIndex = 0; t.setAttribute("role","region"); t.setAttribute("aria-label","Terms and notices"); t.innerHTML = TERMS_HTML; box.appendChild(t);
    var scrolled = !!A.termsRead;
    var lab = el("label","chk"); var cb = document.createElement("input"); cb.type = "checkbox"; cb.disabled = !scrolled; cb.checked = !!A.agreed;
    lab.appendChild(cb); lab.appendChild(el("span",null,"By checking here, I certify that I have read and agree to the above terms and notices, Kapitus’s Privacy Policy and Terms of Use.")); box.appendChild(lab);
    var err = el("div","ferr"); err.setAttribute("role","alert"); box.appendChild(err);
    function check(){ if(!scrolled && t.scrollTop + t.clientHeight >= t.scrollHeight - 24){ scrolled = true; A.termsRead = true; cb.disabled = false; err.textContent = ""; } }
    t.addEventListener("scroll", check, {passive:true});
    setTimeout(check, 50);
    lab.addEventListener("click", function(e){ if(!scrolled){ e.preventDefault(); err.textContent = "Please review the terms before accepting."; t.focus(); } });
    cb.addEventListener("change", function(){ A.agreed = cb.checked; if(cb.checked) err.textContent = ""; });
    var x = el("div"); x.appendChild(el("div","sub2","I’m also interested in learning about (optional):"));
    [["Exclusive savings on business insurance","insurance"],["Personal and business credit reports","reports"]].forEach(function(o){
      var l2 = el("label","chk"); var c2 = document.createElement("input"); c2.type = "checkbox"; c2.checked = !!A["opt_"+o[1]];
      c2.addEventListener("change", function(){ A["opt_"+o[1]] = c2.checked; }); l2.appendChild(c2); l2.appendChild(el("span",null,o[0])); x.appendChild(l2);
    });
    box.appendChild(x);
    return {next:function(){
      if(!scrolled){ err.textContent = "Please review the terms before accepting."; t.focus(); return false; }
      if(!cb.checked){ err.textContent = "Please check the box to continue."; cb.focus(); return false; }
      A.agreed = true; return true;
    }};
  };

  /* signature (draw or type) + security check + submit */
  builders.sign = function(s, box){
    var wrap = el("div","sigbox"); var mode = "draw", dirty = !!A.signature, canvas = document.createElement("canvas"), ctx = null, drawing = false;
    canvas.className = "sigcanvas"; canvas.setAttribute("aria-label","Signature pad. Draw your signature here, or choose Type instead.");
    var typed = document.createElement("input"); typed.type = "text"; typed.className = "sigtype"; typed.hidden = true; typed.maxLength = 60; typed.setAttribute("aria-label","Type your full name as your signature"); typed.autocomplete = "off";
    var lblSig = el("div","sub2","Signature");
    var tools = el("div","sigtools"); var clr = el("button","tgl","Clear"); clr.type = "button"; var sw = el("button","tgl","Type instead"); sw.type = "button";
    tools.appendChild(clr); tools.appendChild(sw);
    wrap.appendChild(lblSig); wrap.appendChild(canvas); wrap.appendChild(typed); wrap.appendChild(tools); box.appendChild(wrap);
    function fit(){
      var r = canvas.getBoundingClientRect(); if(!r.width) return; var d = window.devicePixelRatio || 1;
      canvas.width = Math.round(r.width*d); canvas.height = Math.round(r.height*d); ctx = canvas.getContext("2d");
      ctx.scale(d,d); ctx.lineWidth = 2.2; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#111";
    }
    setTimeout(fit, 0);
    function pos(e){ var r = canvas.getBoundingClientRect(); return {x:e.clientX - r.left, y:e.clientY - r.top}; }
    canvas.addEventListener("pointerdown", function(e){ if(!ctx) fit(); drawing = true; var p = pos(e); ctx.beginPath(); ctx.moveTo(p.x,p.y); try{ canvas.setPointerCapture(e.pointerId); }catch(x){} e.preventDefault(); });
    canvas.addEventListener("pointermove", function(e){ if(!drawing) return; var p = pos(e); ctx.lineTo(p.x,p.y); ctx.stroke(); dirty = true; err.textContent = ""; });
    ["pointerup","pointercancel","pointerleave"].forEach(function(ev){ canvas.addEventListener(ev, function(){ drawing = false; }); });
    clr.addEventListener("click", function(){ if(mode==="draw"){ if(ctx) ctx.clearRect(0,0,canvas.width,canvas.height); dirty = false; } else { typed.value = ""; } });
    sw.addEventListener("click", function(){
      mode = mode==="draw" ? "type" : "draw";
      canvas.hidden = mode==="type"; typed.hidden = mode==="draw"; sw.textContent = mode==="draw" ? "Type instead" : "Draw instead";
      if(mode==="draw") setTimeout(fit, 0); else typed.focus();
    });
    var cap = el("label","captcha"); var cc = document.createElement("input"); cc.type = "checkbox";
    /* WIRE-UP: replace this block with the real hCaptcha widget (sitekey) when the form is connected. */
    cap.appendChild(cc); cap.appendChild(el("span",null,"I’m not a robot")); cap.appendChild(el("small",null,"Security check"));
    box.appendChild(cap);
    var err = el("div","ferr"); err.setAttribute("role","alert"); box.appendChild(err);
    return {next:function(){
      var has = mode==="draw" ? dirty : typed.value.trim().length >= 2;
      if(!has){ err.textContent = mode==="draw" ? "Please sign in the box, or choose Type instead." : "Please type your full name."; return false; }
      if(!cc.checked){ err.textContent = "Please complete the security check."; cc.focus(); return false; }
      A.signatureMode = mode; A.signature = mode==="draw" ? "(drawn)" : typed.value.trim(); return true;
    }, nextLabel:"Submit"};
  };

  /* ---------- the 20 screens ---------- */
  var STEPS = [
    {id:"amount",   cat:0, build:"amount",    title:"How much funding do you need?"},
    {id:"uses",     cat:0, build:"multi",     key:"uses", title:"What will this funding help with?", hint:"This helps us match you to the right funding options.", options:USES, other:true},
    {id:"industry", cat:0, build:"single",    key:"industry", title:"What industry is your business in?", hint:"This helps us better match you with available financing options.", options:INDUSTRY, other:true, auto:true},
    {id:"entity",   cat:0, build:"single",    key:"entity", title:"What’s your business entity type?", hint:"This helps us identify financing options that fit your business structure.", options:ENTITY, other:true, auto:true, cols:"one"},
    {id:"start",    cat:0, build:"monthyear", title:"When did you start your business?", hint:"This helps us understand your business maturity level."},
    {id:"ownership",cat:0, build:"single",    key:"ownership", title:"What percentage of the business do you own?", hint:"This helps determine whether co-owner information is required.", options:OWN, auto:true},
    {id:"revenue",  cat:0, build:"single",    key:"revenue", title:"What’s your annual revenue?", hint:"We use this to match you with the most relevant financing options.", options:REV, auto:true},
    {id:"loans",    cat:0, build:"loans",     title:"Do you have any business loans currently?", hint:"This helps us calculate financing amounts."},
    {id:"bizname",  cat:0, build:"bizname",   title:"What is your business name?", hint:"Your business name stays private and protected."},
    {id:"bizaddr",  cat:0, build:"address",   prefix:"biz", website:true, title:"What is your business address?", hint:"This is the address where your business receives mail."},
    {id:"name",     cat:1, build:"fields",    title:"What’s your name?", hint:"Setting up your profile will help speed things along.",
      fields:[{key:"first",label:"First name",autocomplete:"given-name",validate:vName("first name")},{key:"last",label:"Last name",autocomplete:"family-name",validate:vName("last name")}]},
    {id:"contact",  cat:1, build:"fields",    title:"What’s your contact information?", hint:"We’ll only contact you with relevant updates.",
      fields:[{key:"phone",label:"Phone number",type:"tel",inputmode:"tel",autocomplete:"tel",mask:fmtPhone,maxlength:14,placeholder:"(000) 000-0000",validate:vPhone},{key:"email",label:"Email address",type:"email",inputmode:"email",autocomplete:"email",validate:vEmail}]},
    {id:"dob",      cat:1, build:"dob",       title:"What’s your date of birth?", hint:"We take seriously protecting the privacy of personal information."},
    {id:"home",     cat:1, build:"address",   prefix:"home", sameAs:true, title:"What’s your home address?", hint:"This is used to verify your identity and assess eligibility."},
    {id:"credit",   cat:1, build:"single",    key:"credit", title:"What’s your credit score?", hint:"This helps us find the best financing options for you.", options:CREDIT, auto:true},
    {id:"ssn",      cat:1, build:"ssn",       title:"What’s your Social Security Number?", hint:"Your SSN is encrypted and securely protected.", lock:true},
    {id:"referral", cat:1, build:"single",    key:"referral", title:"How did you hear about us?", options:REFERRAL, other:true, auto:true, cols:"one"},
    {id:"docs",     cat:2, build:"upload",    title:"Important documents"},
    {id:"terms",    cat:2, build:"terms",     title:"Acknowledgement"},
    {id:"sign",     cat:2, build:"sign",      title:"Signature", last:true}
  ];
  var CAP = STEPS.map(function(x){ return x.id; }).indexOf("bizname");   /* progress is only restored up to the first personal screen */
  if(st.started) idx = Math.min(st.step || 0, CAP);
  function persist(){ if(st.started) K.set({step:Math.min(idx, CAP), data:safeData()}); }

  /* ---------- rendering ---------- */
  function swap(){ body.classList.remove("step-in"); void body.offsetWidth; if(!reduce) body.classList.add("step-in"); }
  function render(focusTitle){
    clearTimeout(advTimer); ctrl = null; body.innerHTML = ""; swap();
    if(K.nudges) K.nudges.hide();
    if(finished){ return renderThanks(); }
    if(!formMode && st.started){ return renderResume(); }
    var s = STEPS[idx];
    var h = el("h2",null,s.title); h.id = "ftitle"; h.tabIndex = -1; body.appendChild(h);
    if(s.hint) body.appendChild(hintPill(s.hint, s.lock ? "lock" : "bulb"));
    var box = el("div","fbox"); body.appendChild(box);
    ctrl = builders[s.build](s, box) || {};
    var pct = Math.max(5, Math.round(((idx+1) / STEPS.length) * 100));
    bar.style.width = pct + "%"; prog.setAttribute("aria-valuenow", String(pct));
    meta.hidden = !formMode; nav.hidden = !formMode;
    if(formMode){
      catEl.textContent = CATS[s.cat]; cntEl.textContent = "Step " + (idx+1) + " of " + STEPS.length;
      backBtn.textContent = idx===0 ? "Back to overview" : "Go back";
      nextBtn.textContent = ctrl.nextLabel || (s.last ? "Submit" : "Continue"); nextBtn.disabled = false;
      setNext(!ctrl.hideNext);
      K.track("form_step", {step:s.id, index:idx+1});
      if(focusTitle){ h.focus({preventScroll:true}); }
    }
  }
  function renderResume(){
    meta.hidden = true; nav.hidden = true;
    var pct = Math.max(5, Math.round(((idx+1) / STEPS.length) * 100)); bar.style.width = pct + "%"; prog.setAttribute("aria-valuenow", String(pct));
    var h = el("h2",null,"Pick up where you left off"); body.appendChild(h);
    body.appendChild(el("p","sub","Your $" + K.fmt(A.amount || cfg.defaultAmount) + " request is saved. You’re on " + CATS[STEPS[idx].cat].toLowerCase() + ", step " + (idx+1) + " of " + STEPS.length + ". Personal details stay only while this page is open."));
    var box = el("div","resume");
    var go = el("button","btn btn-primary"); go.type = "button"; go.setAttribute("data-cta",""); go.dataset.loc = "resume"; go.dataset.start = "Get started"; go.dataset["continue"] = "Continue your application"; go.textContent = "Continue your application";
    var so = el("button","back","Start over"); so.type = "button";
    so.addEventListener("click", function(){ resetAll(); render(false); });
    box.appendChild(go); box.appendChild(so); body.appendChild(box);
  }
  function renderThanks(){
    meta.hidden = true; nav.hidden = true; bar.style.width = "100%"; prog.setAttribute("aria-valuenow","100");
    var name = A.legal || A.dba || "";
    var tick = el("div","tick"); tick.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'; body.appendChild(tick);
    var h = el("h2",null,"Thank you" + (name ? ", " + name : "")); h.id = "ftitle"; h.tabIndex = -1; body.appendChild(h);
    body.appendChild(el("p","sub","Your application has been received."));
    var ul = el("ul","summary");
    [["Requested amount","$" + K.fmt(A.amount || 0)],["Application status","Received"],["Next step","A financing specialist will contact you shortly"]].forEach(function(r){ var li = el("li"); li.appendChild(el("span",null,r[0])); li.appendChild(el("span",null,r[1])); ul.appendChild(li); });
    body.appendChild(ul);
    if(A.email){ body.appendChild(el("p","sub","A confirmation email will be sent to " + A.email + ".")); }
    if(A.uploadLater){ body.appendChild(el("p","sub","We’ll also email you a secure link to upload your bank statements.")); }
    if(!F.submitUrl){ body.appendChild(el("p","preview-note","Preview only: nothing was submitted or stored.")); }
    var done = el("button","btn btn-ghost","Done"); done.type = "button"; done.style.marginTop = "14px"; done.addEventListener("click", function(){ resetAll(); leave(); });
    body.appendChild(done); h.focus({preventScroll:true});
  }

  /* ---------- navigation ---------- */
  function next(){
    if(!ctrl) return;
    if(ctrl.next && !ctrl.next()) return;
    var s = STEPS[idx];
    if(s.last){ return finish(); }
    idx++; persist(); render(true); toTop();
    if(K.nudges) K.nudges.afterStep(s.id, A, STEPS[idx].id);   /* motivating pop-up after a fresh answer (section 10) */
  }
  function prev(){
    if(idx===0){ exitForm(); return; }
    idx--; persist(); K.track("form_back", {step:STEPS[idx].id}); render(true); toTop();
  }
  function toTop(){ var r = card.getBoundingClientRect(); if(r.top < 0 || r.top > 120){ window.scrollTo({top: Math.max(0, window.scrollY + r.top - 70), behavior: "auto"}); } }
  nextBtn.addEventListener("click", next);
  backBtn.addEventListener("click", prev);
  closeBtn.addEventListener("click", function(){     /* close at any step to read more; everything entered so far is kept */
    K.track("form_close", {step:STEPS[idx].id, index:idx+1});
    persist(); exitForm();
  });
  card.addEventListener("keydown", function(e){
    if(e.key!=="Enter" || !formMode) return;
    var t = e.target; if(!t || t.tagName!=="INPUT" || t.type==="checkbox" || t.type==="file") return;
    if(t.id==="amount") return; e.preventDefault(); next();
  });

  function buildPayload(){
    var p = {}; Object.keys(A).forEach(function(k){ if(k==="files") p.files = A.files.map(function(f){ return {name:f.name, size:f.size}; }); else if(k!=="signature") p[k] = A[k]; });
    p.signature = A.signatureMode; return p;
  }
  function finish(){
    var payload = buildPayload();
    K.track("form_submit", {amount:A.amount});
    function ok(){ finished = true; K.clear(); if(typeof K.onSubmit==="function") K.onSubmit(payload); render(true); }
    if(F.submitUrl){
      nextBtn.disabled = true;
      fetch(F.submitUrl, {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload)})
        .then(function(r){ if(!r.ok) throw new Error("bad status"); ok(); })
        .catch(function(){ nextBtn.disabled = false; var m = el("div","ferr","We couldn’t submit your application. Please try again, or call " + cfg.phoneSales + "."); m.setAttribute("role","alert"); body.appendChild(m); });
    } else { ok(); }
  }
  function resetAll(){ A = {}; finished = false; idx = 0; K.clear(); if(K.nudges) K.nudges.reset(); }

  /* ---------- focus mode ---------- */
  function enter(){
    formMode = true; document.body.classList.add("form-mode");
    if(location.hash !== "#application") location.hash = "application";
    window.scrollTo(0,0); render(true);
  }
  function leave(){
    formMode = false; document.body.classList.remove("form-mode");
    if(finished){ finished = false; }
    render(false); window.scrollTo(0,0);
  }
  function exitForm(){
    if(location.hash === "#application"){ leaving = true; location.hash = ""; }
    leave();
  }
  window.addEventListener("hashchange", function(){
    if(leaving){ leaving = false; return; }
    if(formMode && location.hash !== "#application"){ leave(); }
    else if(!formMode && location.hash === "#application"){ enter(); }
  });
  K.openForm = function(){ if(!formMode){ if(!st.started) idx = 0; enter(); } };

  /* first paint: intro (amount) or the "welcome back" card; open straight into the form if the URL says so */
  render(false);
  if(location.hash === "#application"){ enter(); }
})();

/* ============ 10 NUDGES: small motivating pop-ups while filling the form ============
   WHEN: only right after a fresh answer, on the next screen. Never when going back, never twice for the same answer.
   LOOK: one at a time, bottom-right on desktop, top of the screen on mobile. Auto-closes (pauses on hover, focus, touch), has a close button, Esc closes it.
   EDIT HERE: the copy, the industry table, and the rules below. Numbers must be verified by the client before launch. */
(function(){
  var K = window.KAP, el = K.el, N = K.cfg.nudges;
  if(!N || !N.enabled) return;

  /* industry proof: "count" is shown only when filled in. 120+ for Health Care is the example from the brief, replace with the verified number. */
  var INDUSTRY = {
    "Construction":       {label:"construction",         count:""},
    "Business / IT":      {label:"business and IT",      count:""},
    "Health Care":        {label:"healthcare",           count:"120+"},
    "Personal Services":  {label:"personal services",    count:""},
    "Transportation":     {label:"transportation",       count:""},
    "Education":          {label:"education",            count:""},
    "Automotive":         {label:"automotive",           count:""},
    "Real Estate":        {label:"real estate",          count:""},
    "Food / Hospitality": {label:"food and hospitality", count:""}
  };
  var COPY = {
    industryCount: function(c, l){ return "We’ve helped " + c + " " + l + " businesses. You’re in good company."; },
    industryPlain: function(l){ return "Got it. We work with " + l + " businesses."; },
    yearsStrong:   function(y){ return y + " years in business. That’s a strong foundation."; },
    yearsMid:      "Over a year in business. Your revenue and credit will fill in the picture.",
    yearsNew:      "Newer businesses can apply too. Keep going.",
    revenueStrong: "Your revenue is in a strong range.",
    creditStrong:  "You have a strong credit score. That’s a real advantage.",
    creditOk:      "Your credit score meets our " + K.cfg.typical.credit + " minimum.",
    creditLow:     "Thanks for sharing. A financing specialist will review your full profile.",
    halfway:       "Halfway there. Business details are done.",
    docs:          "Last stretch. Tip: PDF statements from your bank’s online portal work best."
  };
  var REV_STRONG = ["$250K to $500K","$500K to $750K","$750K to $1M","$1M to $3M","$3M+"];
  var CREDIT_STRONG = ["700 to 719","720 to 739","740 and above"], CREDIT_OK = ["650 to 679","680 to 699"];

  function yearsIn(A){ var n = new Date(); return (n.getFullYear() - Number(A.startYear)) + ((n.getMonth()+1) - Number(A.startMonth)) / 12; }
  var RULES = {   /* the answer just given (prevId) decides the message; return null for no message */
    industry: function(A){ var m = INDUSTRY[A.industry]; if(!m) return null; return {key:"industry:" + A.industry, tone:"good", text: m.count ? COPY.industryCount(m.count, m.label) : COPY.industryPlain(m.label)}; },
    start: function(A){
      var y = yearsIn(A); if(isNaN(y)) return null;
      if(y >= 2) return {key:"start:" + Math.floor(y), tone:"good", text:COPY.yearsStrong(Math.floor(y))};
      if(y >= 1) return {key:"start:mid", tone:"info", text:COPY.yearsMid};
      return {key:"start:new", tone:"info", text:COPY.yearsNew};
    },
    revenue: function(A){ return REV_STRONG.indexOf(A.revenue) > -1 ? {key:"revenue:strong", tone:"good", text:COPY.revenueStrong} : null; },
    credit: function(A){
      if(CREDIT_STRONG.indexOf(A.credit) > -1) return {key:"credit:strong", tone:"good", text:COPY.creditStrong};
      if(CREDIT_OK.indexOf(A.credit) > -1) return {key:"credit:ok", tone:"good", text:COPY.creditOk};
      if(A.credit) return {key:"credit:low", tone:"info", text:COPY.creditLow};
      return null;
    }
  };
  var ARRIVE = {  /* milestone or tip shown when a screen opens and the previous answer had no message */
    name: function(){ return {key:"halfway", tone:"good", text:COPY.halfway}; },
    docs: function(){ return {key:"docs", tone:"info", text:COPY.docs}; }
  };

  var ICON_GOOD = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  var ICON_INFO = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z"/></svg>';
  var node = null, ico, txt, timer = null, delayT = null, startedAt = 0, remaining = 0, current = null, shown = {};

  function build(){
    if(node) return;
    node = el("div","nudge"); node.setAttribute("role","status"); node.setAttribute("aria-live","polite");
    ico = el("span","ni"); txt = el("p");
    var x = el("button","nclose"); x.type = "button"; x.setAttribute("aria-label","Close message");
    x.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/></svg>';
    x.addEventListener("click", function(){ close("user"); });
    node.appendChild(ico); node.appendChild(txt); node.appendChild(x); node.appendChild(el("span","nbar"));
    node.addEventListener("mouseenter", pause); node.addEventListener("focusin", pause); node.addEventListener("touchstart", pause, {passive:true});
    node.addEventListener("mouseleave", resume); node.addEventListener("focusout", resume); node.addEventListener("touchend", resume, {passive:true});
    document.body.appendChild(node);
  }
  function pause(){ if(!current) return; clearTimeout(timer); remaining -= Date.now() - startedAt; node.classList.add("hold"); }
  function resume(){ if(!current) return; node.classList.remove("hold"); startedAt = Date.now(); remaining = Math.max(1800, remaining); timer = setTimeout(function(){ close("auto"); }, remaining); }
  function show(n){
    build(); clearTimeout(timer); current = n;
    node.className = "nudge" + (n.tone==="good" ? " good" : "");
    ico.innerHTML = n.tone==="good" ? ICON_GOOD : ICON_INFO; txt.textContent = n.text;
    node.style.setProperty("--nms", N.autoCloseMs + "ms");
    void node.offsetWidth; node.classList.add("show","run");
    remaining = N.autoCloseMs; startedAt = Date.now(); timer = setTimeout(function(){ close("auto"); }, remaining);
    K.track("nudge_show", {key:n.key});
  }
  function close(by){
    if(!node || !current) return;
    clearTimeout(timer); node.classList.remove("show","run","hold");
    K.track("nudge_close", {key:current.key, by:by}); current = null;
  }
  function hide(){ clearTimeout(delayT); if(node && current){ clearTimeout(timer); node.classList.remove("show","run","hold"); current = null; } }
  document.addEventListener("keydown", function(e){ if(e.key==="Escape") close("user"); });

  K.nudges = {
    hide: hide,
    reset: function(){ shown = {}; hide(); },
    afterStep: function(prevId, A, nextId){
      if(!document.body.classList.contains("form-mode")) return;
      var n = (RULES[prevId] && RULES[prevId](A)) || (ARRIVE[nextId] && ARRIVE[nextId](A));
      if(!n || shown[n.key]) return;
      shown[n.key] = true;
      clearTimeout(delayT);
      delayT = setTimeout(function(){ if(document.body.classList.contains("form-mode")) show(n); }, N.delayMs);
    }
  };
})();
