/* Legal Text Anonymiser — vector showcase animation.
   Pure deterministic SVG built from buildInner(t). Drives the live HTML page
   and is reused by the MP4 renderer, so both stay identical. */
(function (root) {
  "use strict";

  const W = 1920, H = 1080, FPS = 30;

  // ---- palette (warm portfolio system) ----
  const BG="#faf8f4", INK="#1a1714", MUTED="#7d7468", FAINT="#a89e90",
        BORDER="#e7e0d4", CARD="#fffdf9", CARD2="#fbf6ee",
        AMBER="#b86a2e", AMBER_BG="#f5e7d6", AMBER_BD="#dcab78",
        GREEN="#3f8f5b", GREEN_BG="#e3efe4", GREEN_BD="#9cc7a7",
        RED="#c44a3d";
  // Use the real CSS family + numeric weight so it resolves in the browser
  // (Google Fonts serves "Space Grotesk" 400/500/600/700) AND in the renderer.
  const FT_DISP="Space Grotesk", FT_SEMI="Space Grotesk|600",
        FT_MED="Space Grotesk|500", FT_MONO="JetBrains Mono";
  function resolveFam(family,weight){
    if(family && family.indexOf("|")>=0){ const p=family.split("|"); return [p[0], weight==null?parseInt(p[1],10):weight]; }
    return [family,weight];
  }

  // baked metrics (from the font files; keeps browser + renderer identical)
  const MONO_ADV = 0.6;
  const TITLE76 = 824.98, TITLE23 = 249.64;   // "Legal Text Anonymiser"
  const mono_w = (s, size) => s.length * MONO_ADV * size;

  // ---- math ----
  const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
  const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
  const ease_out=x=>{x=clamp(x);return 1-Math.pow(1-x,3);};
  const ease_out_back=x=>{x=clamp(x);const c1=1.70158,c3=c1+1;return 1+c3*Math.pow(x-1,3)+c1*Math.pow(x-1,2);};
  const lerp=(a,b,t)=>a+(b-a)*t;
  const n2=x=>x.toFixed(2), n3=x=>x.toFixed(3);
  const esc=s=>s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

  // ---- primitives ----
  function txt(x,y,s,size,o={}){
    const {fill=INK,family=FT_DISP,anchor="start",op=1,ls=0,weight=null}=o;
    const [fam,wt]=resolveFam(family,weight);
    const a=` text-anchor="${anchor}"`, l=ls?` letter-spacing="${ls}"`:"", w=wt!=null?` font-weight="${wt}"`:"";
    return `<text x="${n2(x)}" y="${n2(y)}" font-family="${fam}" font-size="${n2(size)}" fill="${fill}" fill-opacity="${n3(op)}"${a}${l}${w} xml:space="preserve">${esc(s)}</text>`;
  }
  // spans: [text, fill, family, weight]
  function txtspans(x,y,size,o={},spans){
    const {anchor="start",op=1}=o;
    const inner=spans.map(([t,fill,family=FT_DISP,weight=null])=>{
      const [fam,wt]=resolveFam(family,weight);
      return `<tspan font-family="${fam}" fill="${fill}"${wt!=null?` font-weight="${wt}"`:""}>${esc(t)}</tspan>`;
    }).join("");
    return `<text x="${n2(x)}" y="${n2(y)}" font-size="${n2(size)}" text-anchor="${anchor}" fill-opacity="${n3(op)}" xml:space="preserve">${inner}</text>`;
  }
  function rrect(x,y,w,h,r,fill,o={}){
    const {op=1,stroke=null,sw=1.5,sop=1}=o;
    const s=stroke?` stroke="${stroke}" stroke-width="${sw}" stroke-opacity="${n3(sop)}"`:"";
    return `<rect x="${n2(x)}" y="${n2(y)}" width="${n2(w)}" height="${n2(h)}" rx="${n2(r)}" fill="${fill}" fill-opacity="${n3(op)}"${s}/>`;
  }
  function line(x1,y1,x2,y2,stroke,o={}){
    const {sw=1.5,op=1,dash=null}=o;
    const d=dash?` stroke-dasharray="${dash}"`:"";
    return `<line x1="${n2(x1)}" y1="${n2(y1)}" x2="${n2(x2)}" y2="${n2(y2)}" stroke="${stroke}" stroke-width="${sw}" stroke-opacity="${n3(op)}"${d}/>`;
  }
  function group(content,o={}){
    const {op=1,tx=0,ty=0,scale=1,cx=0,cy=0}=o;
    const tf=[];
    if(tx||ty) tf.push(`translate(${n2(tx)},${n2(ty)})`);
    if(scale!==1) tf.push(`translate(${n2(cx)},${n2(cy)}) scale(${scale.toFixed(4)}) translate(${n2(-cx)},${n2(-cy)})`);
    const t=tf.length?` transform="${tf.join(" ")}"`:"";
    return `<g opacity="${n3(op)}"${t}>${content}</g>`;
  }
  function chip(x,ybase,label,size,kind="amber",op=1,pop=1){
    let bg,bd,fg;
    if(kind==="green"){bg=GREEN_BG;bd=GREEN_BD;fg=GREEN;}
    else if(kind==="ink"){bg="#efe9df";bd="#cfc6b6";fg=INK;}
    else {bg=AMBER_BG;bd=AMBER_BD;fg=AMBER;}
    const padx=size*0.42, tw=mono_w(label,size), w=tw+2*padx, h=size*1.36, ry=ybase-size*1.04;
    const cx=x+w/2, cy=ry+h/2;
    const body=rrect(x,ry,w,h,h*0.32,bg,{op,stroke:bd,sw:1.4,sop:op})
             + txt(x+padx,ybase,label,size,{fill:fg,family:FT_MONO,op,weight:600});
    return [pop!==1?group(body,{scale:pop,cx,cy}):body, w];
  }
  // big highlighted "key point" banner: wide tinted box + amber accent bar + bold sentence.
  function callout(x,y,w,size,op,segs){
    const boxH=size*2.05;
    return rrect(x,y,w,boxH,15,AMBER_BG,{op:op*0.5,stroke:AMBER_BD,sw:1.8,sop:op*0.9})
      + rrect(x+20,y+16,7,boxH-32,3.5,AMBER,{op})
      + txtspans(x+50, y+boxH/2+size*0.34, size, {op}, segs);
  }

  // ---- scene timings ----
  const INTRO=[0.0,8.5], O=8.5;
  const S0=[O+0.0,O+5.5], S1=[O+5.5,O+12.1], S2=[O+12.1,O+18.7],
        S3=[O+18.7,O+25.3], SW=[O+25.3,O+37.3], S4=[O+37.3,O+41.5];
  const TOTAL=O+41.5;
  function scene_alpha(t,s,e,fin=0.5,fout=0.4){
    if(t<s-0.001||t>e+0.001) return 0;
    return smooth(Math.min(clamp((t-s)/fin),clamp((e-t)/fout)));
  }

  // ---- persistent chrome ----
  function chrome(t){
    let out=[];
    const ia=smooth(clamp((t-(O+0.4))/0.6));
    if(ia>0){
      out.push(group(
        `<circle cx="150" cy="74" r="6" fill="${GREEN}"/>`
        + txt(170,80,"Legal Text Anonymiser",23,{fill:INK,family:FT_SEMI})
        + txt(170+TITLE23+18,80,"PII redaction · re-identification risk",18,{fill:MUTED,family:FT_MONO}),
        {op:ia}));
    }
    const pa=smooth(clamp((t-0.4)/0.8));
    if(pa>0){
      const bx=150,by=1012,bw=W-300,prog=clamp(t/TOTAL);
      out.push(line(bx,by,bx+bw,by,BORDER,{sw:3,op:pa}));
      out.push(line(bx,by,bx+bw*prog,by,AMBER,{sw:3,op:pa}));
      out.push(txt(W-150,1006,"williamcatt.dev",18,{fill:FAINT,family:FT_MONO,anchor:"end",op:pa}));
    }
    return out.join("");
  }
  function section_header(num,title,sub,color,o={}){
    const {op=1,lt=0}=o; const x=150,y=175;
    const ap=smooth(clamp(lt/0.5)), dy=(1-ease_out(clamp(lt/0.6)))*14;
    let s=[];
    s.push(rrect(x,y-34,52,40,9,color,{op:0.14*op*ap}));
    s.push(txt(x+26,y-5,num,22,{fill:color,family:FT_SEMI,anchor:"middle",op:op*ap}));
    s.push(txt(x+70,y-6,title,30,{fill:INK,family:FT_SEMI,op:op*ap,ls:0.5}));
    s.push(txt(x+70,y+22,sub,20,{fill:MUTED,family:FT_MONO,op:op*ap}));
    return group(s.join(""),{ty:dy});
  }
  function card(x,y,w,h,label,color,o={}){
    const {op=1,fill=CARD}=o; let s=[];
    s.push(rrect(x,y,w,h,14,fill,{op,stroke:BORDER,sw:1.6,sop:op}));
    // label tab matches the card fill so it doesn't show as a mismatched patch
    const lw=mono_w(label,16)+24;
    s.push(rrect(x+22,y-13,lw,26,7,fill,{op}));
    s.push(txt(x+34,y+5,label,16,{fill:color,family:FT_MONO,op,weight:600,ls:1.0}));
    return s.join("");
  }

  // ---- INTRO ----
  const LEGAL_POOL=[
   "IN THE MATTER OF an arbitration under the Rules of the London Court of",
   "International Arbitration between the Claimant and the Respondent, the",
   "Tribunal having considered the written submissions filed on behalf of",
   "both parties and the documentary evidence annexed thereto finds as",
   "follows. The privileged correspondence exchanged between the parties'",
   "legal representatives remains subject to legal professional privilege",
   "and shall not be disclosed to any third party without prior written",
   "consent. The settlement agreement provides that the sum shall be held",
   "in escrow pending completion of the proposed merger. Pursuant to clause",
   "14.2, the indemnifying party undertakes to keep the indemnified party",
   "harmless against all claims, losses and liabilities arising out of any",
   "breach of the confidentiality undertakings set out herein. The witness",
   "statement of the deponent confirms that the attendance note was prepared",
   "contemporaneously and reflects the instructions received from the client",
   "during the conference held at the offices of the firm. Counsel advised",
   "that the matter be referred to the Employment Tribunal, the application",
   "having been issued within the prescribed limitation period. The hearing",
   "bundle comprises the pleadings, the disclosure schedule and the experts'",
   "joint memorandum. The parties are directed to file skeleton arguments no",
   "less than seven days before the substantive hearing of this matter. All",
   "references to the data subject shall be redacted prior to any transfer.",
   "The processor shall implement appropriate technical and organisational",
   "measures to ensure a level of security appropriate to the risk. This",
   "memorandum is strictly confidential and prepared in contemplation of"];
  // word-aligned redactions: poolIndex -> phrase actually present in that line
  const INTRO_REDACT={0:"London Court",2:"Tribunal",4:"privileged correspondence",
    6:"third party",8:"proposed merger",10:"claims, losses",12:"the deponent",
    14:"the firm",16:"limitation period",18:"skeleton arguments",20:"data subject",22:"security"};

  function scene_intro(t){
    const [s,e]=INTRO, a=scene_alpha(t,s,e,0.6,0.5);
    if(a<=0) return "";
    const lt=t, lh=34, size=19, cols=[150,980], n=LEGAL_POOL.length, speed=60.0, baseY=92;
    const scrollY=lt*speed;
    let bg=[], bars=[];
    for(let ci=0;ci<cols.length;ci++){
      const colx=cols[ci], off=ci*9;
      for(let k=0;k<72;k++){
        const y=baseY+k*lh-scrollY;
        if(y>=28 && y<=1062){
          const pi=(k+off)%n, lnText=LEGAL_POOL[pi];
          bg.push(txt(colx,y,lnText,size,{fill:INK,family:FT_MONO,op:a*0.30}));
          const phrase=INTRO_REDACT[pi];
          if(phrase){
            const idx=lnText.indexOf(phrase);
            if(idx>=0){
              const bx=colx+idx*MONO_ADV*size, bw=phrase.length*MONO_ADV*size;
              bars.push(rrect(bx-2,y-size*0.92,bw+4,size*1.22,3,AMBER,{op:a*0.42}));
            }
          }
        }
      }
    }
    const defs=`<linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">`
      +`<stop offset="0%" stop-color="${BG}" stop-opacity="0"/>`
      +`<stop offset="20%" stop-color="${BG}" stop-opacity="${n3(a*0.96)}"/>`
      +`<stop offset="80%" stop-color="${BG}" stop-opacity="${n3(a*0.96)}"/>`
      +`<stop offset="100%" stop-color="${BG}" stop-opacity="0"/></linearGradient>`;
    const scrim=`<defs>${defs}</defs><rect x="0" y="250" width="${W}" height="600" fill="url(#scrim)"/>`;
    let els=bg.concat(bars,[scrim]);
    const stmt=["Thousands of privileged client files.",
                "AI tools that could save us hours.",
                "But none of it can leave the building."];
    const appear=[1.5,2.8,4.1], sfade=1-smooth(clamp((lt-5.8)/0.45)), cx=W/2;
    for(let i=0;i<stmt.length;i++){
      const la=smooth(clamp((lt-appear[i])/0.6))*sfade;
      const dy=(1-ease_out(clamp((lt-appear[i])/0.7)))*18;
      const col=i===2?AMBER:INK;
      els.push(group(txt(cx,452+i*74,stmt[i],46,{fill:col,family:FT_SEMI,anchor:"middle",ls:0.3}),{op:a*la,ty:dy}));
    }
    const qa=smooth(clamp((lt-6.3)/0.55))*(1-smooth(clamp((lt-7.8)/0.4)));
    const qdy=(1-ease_out(clamp((lt-6.3)/0.7)))*18;
    els.push(group(txtspans(cx,552,62,{anchor:"middle"},
      [["How do we use AI ",INK,FT_SEMI],["safely?",AMBER,FT_SEMI]]),{op:a*qa,ty:qdy}));
    return els.join("");
  }

  // ---- TITLE + keyword "information bubbles" ----
  const KW_A=["Natural Language Processing","Named-Entity Recognition","fine-tuned RoBERTa"];
  const KW_B=["Text Anonymization Benchmark","k-anonymity · mosaic effect"];
  function _kwRow(labels, cyTop, lt, t0, aScene, cx){
    const sz=20, padx=20, h=42, gap=26;
    const ws=labels.map(l=>mono_w(l,sz)+2*padx);
    let total=gap*(labels.length-1); for(const w of ws) total+=w;
    let x=cx-total/2, out=[];
    for(let i=0;i<labels.length;i++){
      const td=t0+i*0.13, ap=smooth(clamp((lt-td)/0.4)), dy=(1-ease_out(clamp((lt-td)/0.55)))*14;
      if(ap>0.005){
        const op=aScene*ap;
        const body=rrect(x,cyTop,ws[i],h,h/2,"#f8f1e7",{op,stroke:AMBER_BD,sw:1.4,sop:op*0.9})
          + txt(x+padx,cyTop+h/2+sz*0.34,labels[i],sz,{fill:AMBER,family:FT_MONO,op});
        out.push(group(body,{ty:dy}));
      }
      x+=ws[i]+gap;
    }
    return out.join("");
  }
  function scene_title(t){
    const [s,e]=S0, a=scene_alpha(t,s,e,0.6,0.5);
    if(a<=0) return "";
    const lt=t-s, cx=W/2, half=TITLE76/2, gap=46;
    let out=[];
    const bp=ease_out(clamp(lt/0.7));
    const lx=(cx-half-gap)-24*(1-bp), rx=(cx+half+gap)+24*(1-bp);
    out.push(txt(lx,452,"[",100,{fill:AMBER,family:FT_MONO,anchor:"middle",op:a*0.9*bp}));
    out.push(txt(rx,452,"]",100,{fill:AMBER,family:FT_MONO,anchor:"middle",op:a*0.9*bp}));
    const ta=smooth(clamp((lt-0.25)/0.6)), tdy=(1-ease_out(clamp((lt-0.25)/0.7)))*16;
    out.push(group(txt(cx,440,"Legal Text Anonymiser",76,{fill:INK,family:FT_SEMI,anchor:"middle",ls:0.5}),{op:a*ta,ty:tdy}));
    const sa=smooth(clamp((lt-0.55)/0.6));
    out.push(txt(cx,500,"Redact · Anonymise · Pseudonymise  —  legal PII, measured",26,{fill:MUTED,family:FT_MONO,anchor:"middle",op:a*sa}));
    out.push(_kwRow(KW_A, 566, lt, 1.5, a, cx));
    out.push(_kwRow(KW_B, 622, lt, 1.95, a, cx));
    return out.join("");
  }

  // ---- REDACT ----
  const IN1=["This memorandum concerns the grievance brought by",
       "Dr. Eleanor Whitcombe, a consultant cardiologist,",
       "against St. Andrew's Regional Hospital Trust. Referred",
       "to the Employment Tribunal, Case no. 2402319/2021."];
  const OUT1=[
    [["This memorandum concerns the grievance brought by","plain"]],
    [["[PERSON]","amber"],[", a consultant cardiologist,","plain"]],
    [["against ","plain"],["[ORG]","amber"],[". Referred to the Employment","plain"]],
    [["Tribunal, ","plain"],["[CODE]","amber"],[".","plain"]]];
  function scene_redact(t){
    const [s,e]=S1, a=scene_alpha(t,s,e);
    if(a<=0) return "";
    const lt=t-s, msize=25, lh=42;
    let out=[section_header("01","REDACT","strip the direct identifiers",AMBER,{op:a,lt})];
    const icx=150,icy=232,icw=1180,ich=222;
    out.push(group(card(icx,icy,icw,ich,"INPUT  ·  raw privileged text",MUTED,{op:a}),{op:smooth(clamp(lt/0.5))}));
    const inx=icx+34,iny=icy+58, ia=smooth(clamp((lt-0.15)/0.5));
    for(let i=0;i<IN1.length;i++) out.push(txt(inx,iny+i*lh,IN1[i],msize,{fill:"#5b5346",family:FT_MONO,op:a*ia}));
    if(lt>0.5 && lt<2.2){
      const sp=ease_out(clamp((lt-0.5)/1.6)), sy=icy+18+sp*(ich-36);
      out.push(line(icx+16,sy,icx+icw-16,sy,AMBER,{sw:2.5,op:a*0.8*(1-Math.abs(sp-0.5)*0.6)}));
      out.push(rrect(icx+16,icy+18,icw-32,sy-(icy+18),0,AMBER,{op:a*0.05}));
    }
    const ocx=150,ocy=510,ocw=1180,och=234, oca=smooth(clamp((lt-1.6)/0.5));
    out.push(group(card(ocx,ocy,ocw,och,"OUTPUT  ·  REDACT",AMBER,{op:a}),{op:oca}));
    const onx=ocx+34,ony=ocy+62, base=2.0;
    for(let i=0;i<OUT1.length;i++){
      const la=smooth(clamp((lt-(base+i*0.32))/0.45));
      let cx=onx; const ybase=ony+i*lh;
      for(const [seg,kind] of OUT1[i]){
        if(kind==="plain"){ out.push(txt(cx,ybase,seg,msize,{fill:INK,family:FT_MONO,op:a*la})); cx+=mono_w(seg,msize); }
        else{
          const ct=base+i*0.32+0.18; let pop=ease_out_back(clamp((lt-ct)/0.45)); pop=pop<1?lerp(0.2,1,pop):1;
          const [cs,w]=chip(cx,ybase,seg,msize,kind,a*la,Math.max(pop,0.01)); out.push(cs); cx+=w;
        }
      }
    }
    const rx=1400, ra=smooth(clamp((lt-2.2)/0.5));
    let removed=0; for(const i of [1,2,3]) if(lt>=2.0+i*0.32+0.18) removed++;
    out.push(txt(rx,300,"DIRECT",19,{fill:MUTED,family:FT_MONO,op:a*ra,ls:2}));
    out.push(txt(rx,332,"IDENTIFIERS",19,{fill:MUTED,family:FT_MONO,op:a*ra,ls:2}));
    out.push(txt(rx,470,String(removed),150,{fill:AMBER,family:FT_SEMI,op:a*ra}));
    out.push(txt(rx,520,"removed in one pass",21,{fill:MUTED,family:FT_MONO,op:a*ra}));
    const leg=["PERSON · names","ORG · firms, courts","CODE · case / IBAN"];
    for(let i=0;i<leg.length;i++){
      const lga=smooth(clamp((lt-(2.6+i*0.25))/0.4));
      const [cs]=chip(rx,600+i*54,"["+leg[i].split(" ")[0]+"]",20,"amber",a*lga);
      out.push(cs);
      out.push(txt(rx+150,600+i*54,leg[i].split("·")[1].trim(),19,{fill:MUTED,family:FT_MONO,op:a*lga}));
    }
    const capa=smooth(clamp((lt-3.4)/0.5));
    out.push(callout(150,778,1620,36,a*capa,
      [["Anything that names someone outright — ",INK,FT_SEMI],["removed in one pass.",AMBER,FT_SEMI]]));
    return group(out.join(""));
  }

  // ---- ANONYMISE ----
  const IN2=["The applicant, Maria Petrova, is a 47-year-old",
       "Bulgarian national living in Plovdiv, employed",
       "as a nurse since 2010."];
  const OUT2=[
    [["The applicant, ","plain"],["[PERSON]","amber"],[", ","plain"],["in their 40s","green"],[",","plain"]],
    [["a ","plain"],["European","green"],[" national living in ","plain"],["Bulgaria","green"],[",","plain"]],
    [["employed since ","plain"],["the 2010s","green"],[".","plain"]]];
  const LADDER=[["LOC",["Plovdiv","Bulgaria","Europe"]],["DATE",["12 Mar 2018","2018","2010s"]],["DEM",["47-year-old","in their 40s"]]];
  function lerp_color(p){
    const stops=[[196,74,61],[184,106,46],[63,143,91]]; let c0,c1,tt;
    if(p<=0.5){tt=p/0.5;c0=stops[0];c1=stops[1];} else {tt=(p-0.5)/0.5;c0=stops[1];c1=stops[2];}
    const r=Math.round(lerp(c0[0],c1[0],tt)),g=Math.round(lerp(c0[1],c1[1],tt)),b=Math.round(lerp(c0[2],c1[2],tt));
    return "#"+[r,g,b].map(v=>v.toString(16).padStart(2,"0")).join("");
  }
  function scene_anon(t){
    const [s,e]=S2, a=scene_alpha(t,s,e);
    if(a<=0) return "";
    const lt=t-s, msize=25, lh=42;
    let out=[section_header("02","ANONYMISE","blur the mosaic fingerprint until it can't be traced",GREEN,{op:a,lt})];
    const icx=150,icy=232,icw=980,ich=180;
    out.push(group(card(icx,icy,icw,ich,"INPUT",MUTED,{op:a}),{op:smooth(clamp(lt/0.5))}));
    const ia=smooth(clamp((lt-0.15)/0.5));
    for(let i=0;i<IN2.length;i++) out.push(txt(icx+34,icy+54+i*lh,IN2[i],msize,{fill:"#5b5346",family:FT_MONO,op:a*ia}));
    const ocx=150,ocy=470,ocw=980,och=188, oca=smooth(clamp((lt-1.4)/0.5));
    out.push(group(card(ocx,ocy,ocw,och,"OUTPUT  ·  ANONYMISE",GREEN,{op:a}),{op:oca}));
    const base=1.8;
    for(let i=0;i<OUT2.length;i++){
      const la=smooth(clamp((lt-(base+i*0.3))/0.45));
      let cx=ocx+34; const ybase=ocy+56+i*lh;
      for(const [seg,kind] of OUT2[i]){
        if(kind==="plain"){ out.push(txt(cx,ybase,seg,msize,{fill:INK,family:FT_MONO,op:a*la})); cx+=mono_w(seg,msize); }
        else{ const ct=base+i*0.3+0.15; let pop=ease_out_back(clamp((lt-ct)/0.45)); pop=pop<1?Math.max(lerp(0.2,1,pop),0.01):1;
          const [cs,w]=chip(cx,ybase,seg,msize,kind,a*la,pop); out.push(cs); cx+=w; }
      }
    }
    const capa=smooth(clamp((lt-0.8)/0.5));
    out.push(callout(150,762,1620,36,a*capa,
      [["Even with the name gone, ",INK,FT_SEMI],["ordinary details still fingerprint one person.",AMBER,FT_SEMI]]));
    const rx=1210,ry=232,rw=560, pa=smooth(clamp((lt-1.0)/0.5));
    out.push(group(card(rx,ry,rw,360,"GENERALISATION  LADDER",GREEN,{op:a,fill:CARD2}),{op:pa}));
    const step_prog=clamp((lt-2.2)/2.4);
    for(let li=0;li<LADDER.length;li++){
      const [lab,chain]=LADDER[li], yy=ry+62+li*92, la=smooth(clamp((lt-(1.2+li*0.2))/0.4));
      const [cs]=chip(rx+28,yy,lab,19,"ink",a*la); out.push(cs);
      const active=Math.min(chain.length-1,Math.floor(step_prog*chain.length));
      let cxx=rx+120;
      for(let ci=0;ci<chain.length;ci++){
        const val=chain[ci], done=ci<=active;
        const col=(ci===active&&done)?GREEN:(done?MUTED:FAINT), ca=a*la*(done?1:0.4);
        const valw=mono_w(val,20);
        if(ci>0) out.push(txt(cxx-18,yy,"→",18,{fill:FAINT,family:FT_MONO,op:a*la*0.7,anchor:"middle"}));
        const isactive=ci===active;
        if(isactive&&done) out.push(rrect(cxx-7,yy-21,valw+14,30,7,GREEN_BG,{op:a*la,stroke:GREEN_BD,sw:1.3,sop:a*la}));
        out.push(txt(cxx,yy,val,20,{fill:col,family:FT_MONO,op:ca,weight:isactive?600:null}));
        cxx+=valw+40;
      }
    }
    const gy=ry+360+58, ga=smooth(clamp((lt-1.2)/0.5));
    out.push(txt(rx,gy-34,"RE-IDENTIFICATION RISK",18,{fill:MUTED,family:FT_MONO,op:a*ga,ls:1.5}));
    const k=lerp(1.0,5.0,ease_out(clamp((lt-2.2)/2.6))), cellw=rw/5-14;
    for(let ci=0;ci<5;ci++){
      const cxc=rx+ci*(rw/5), filled=(ci+1)<=Math.round(k), frac=clamp(k-ci), base_col=lerp_color(ci/4.0);
      out.push(rrect(cxc,gy,cellw,30,7,"#efe9df",{op:a*ga,stroke:BORDER,sw:1.2,sop:a*ga}));
      if(frac>0) out.push(rrect(cxc,gy,cellw*Math.min(frac,1),30,7,base_col,{op:a*ga}));
      out.push(txt(cxc+cellw/2,gy+62,`k=${ci+1}`,16,{fill:filled?INK:MUTED,family:FT_MONO,anchor:"middle",op:a*ga*(0.5+0.5*Math.min(frac,1))}));
    }
    const safe=k>=4.6, lbl=safe?"safe  ·  k = 5":(k<1.6?"unique  ·  k = 1":`k = ${k.toFixed(0)}`);
    const col=safe?GREEN:(k<1.6?RED:AMBER);
    out.push(txt(rx+rw,gy-34,lbl,20,{fill:col,family:FT_SEMI,anchor:"end",op:a*ga}));
    return group(out.join(""));
  }

  // ---- PSEUDONYMISE ----
  const TOK3=[
    [["[PERSON_A]","amber"],[" of ","plain"],["[ORG_A]","amber"],[" met","plain"]],
    [["with ","plain"],["[PERSON_B]","amber"],[", counsel of","plain"]],
    [["[ORG_B]","amber"],[", to settle under ","plain"],["[CODE_A]","amber"],[".","plain"]]];
  const VAULT=[["[PERSON_A]","Anya Kowalski"],["[ORG_A]","Meridian Capital Partners"],
               ["[PERSON_B]","Tomás Ferreira"],["[ORG_B]","Halcyon Biotech"]];
  function scene_pseudo(t){
    const [s,e]=S3, a=scene_alpha(t,s,e);
    if(a<=0) return "";
    const lt=t-s, msize=23, lh=40;
    let out=[section_header("03","PSEUDONYMISE","re-linkable labels — real names never leave the building",AMBER,{op:a,lt})];
    const lcx=150,lcy=250,lcw=760,lch=240;
    out.push(group(card(lcx,lcy,lcw,lch,"SENT OUT  ·  tokens only",AMBER,{op:a}),{op:smooth(clamp(lt/0.5))}));
    const base=0.5;
    for(let i=0;i<TOK3.length;i++){
      const la=smooth(clamp((lt-(base+i*0.28))/0.45));
      let cx=lcx+30; const ybase=lcy+62+i*lh;
      for(const [seg,kind] of TOK3[i]){
        if(kind==="plain"){ out.push(txt(cx,ybase,seg,msize,{fill:INK,family:FT_MONO,op:a*la})); cx+=mono_w(seg,msize); }
        else{ const ct=base+i*0.28+0.12; let pop=ease_out_back(clamp((lt-ct)/0.4)); pop=pop<1?Math.max(lerp(0.2,1,pop),0.01):1;
          const [cs,w]=chip(cx,ybase,seg,msize,kind,a*la,pop); out.push(cs); cx+=w; }
      }
    }
    const sa=smooth(clamp((lt-1.6)/0.4));
    out.push(txt(lcx+lcw-44,lcy+lch-22,"↗",30,{fill:AMBER,family:FT_MONO,op:a*sa}));
    const vcx=980,vcy=250,vcw=790,vch=320;
    out.push(group(card(vcx,vcy,vcw,vch,"LOCAL VAULT  ·  never leaves",GREEN,{op:a,fill:CARD2}),{op:smooth(clamp((lt-0.3)/0.5))}));
    const la0=smooth(clamp((lt-0.4)/0.4)), lx=vcx+vcw-44, ly=vcy+36;
    out.push(`<path d="M ${lx-6} ${ly-3} v-4 a6 6 0 0 1 12 0 v4" fill="none" stroke="${GREEN}" stroke-width="2.4" stroke-opacity="${n3(a*la0)}"/>`);
    out.push(rrect(lx-9,ly-3,18,15,3,GREEN,{op:a*la0}));
    for(let i=0;i<VAULT.length;i++){
      const [tok,name]=VAULT[i], ry=vcy+58+i*60, la=smooth(clamp((lt-(0.9+i*0.25))/0.45));
      const [cs,w]=chip(vcx+28,ry,tok,21,"amber",a*la); out.push(cs);
      out.push(txt(vcx+28+w+22,ry,"→",20,{fill:FAINT,family:FT_MONO,op:a*la}));
      out.push(txt(vcx+28+w+58,ry,name,22,{fill:INK,family:FT_MED,op:a*la}));
    }
    const ra=smooth(clamp((lt-2.6)/0.5)), ra2=smooth(clamp((lt-2.9)/0.5));
    out.push(callout(150,650,1620,36,a*ra,
      [["The reply comes back in tokens — ",INK,FT_SEMI],["names are restored, locally.",AMBER,FT_SEMI]]));
    out.push(txtspans(150,762,24,{op:a*ra2},
      [["Restored:  ",GREEN,FT_SEMI],["Anya Kowalski",AMBER,FT_SEMI],[" of ",INK,FT_MED],
       ["Meridian Capital Partners",AMBER,FT_SEMI],[" is the acquiring party.",INK,FT_MED]]));
    return group(out.join(""));
  }

  // ---- WORKFLOW (in practice, with Claude) ----
  function _mline(x,yb,segs,sz,op){
    let out=[], cx=x;
    for(const [s_,k_] of segs){
      if(k_==="c"){ const [cs,w]=chip(cx,yb,s_,sz,"amber",op); out.push(cs); cx+=w; }
      else if(k_==="a"){ out.push(txt(cx,yb,s_,sz,{fill:AMBER,family:FT_MONO,op,weight:600})); cx+=mono_w(s_,sz); }
      else { out.push(txt(cx,yb,s_,sz,{fill:INK,family:FT_MONO,op})); cx+=mono_w(s_,sz); }
    }
    return out.join("");
  }
  function _spark(cx,cy,r,op){
    let s=[];
    for(const ang of [0,45,90,135]){ const a=ang*Math.PI/180,dx=r*Math.cos(a),dy=r*Math.sin(a);
      s.push(line(cx-dx,cy-dy,cx+dx,cy+dy,AMBER,{sw:2.4,op})); }
    return s.join("");
  }
  function _darrow(x,y1,y2,op){
    return line(x,y1,x,y2-9,AMBER,{sw:2.2,op})
      +`<path d="M ${x-5.5} ${y2-10} L ${x+5.5} ${y2-10} L ${x} ${y2} Z" fill="${AMBER}" fill-opacity="${n3(op)}"/>`;
  }
  function _packet(cx,cy,op){
    const sz=17,lab="tokens",w=mono_w(lab,sz)+sz*1.5,h=sz*1.85;
    return rrect(cx-w/2,cy-h/2,w,h,h/2,AMBER_BG,{op,stroke:AMBER_BD,sw:1.5,sop:op})
      +txt(cx,cy+sz*0.34,lab,sz,{fill:AMBER,family:FT_MONO,anchor:"middle",op,weight:600});
  }
  function _travel(lt,t0,dur,p0,p1){
    const p=clamp((lt-t0)/dur); if(p<=0||p>=1) return null;
    const op=smooth(clamp(p/0.18))*(1-smooth(clamp((p-0.82)/0.18))), e=ease_out(p);
    return [lerp(p0[0],p1[0],e),lerp(p0[1],p1[1],e),op];
  }
  const WF_A=[[["Anya Kowalski","a"],[" (","p"],["Meridian Capital","a"],[") is acquiring a","p"]],
              [["stake in ","p"],["Halcyon Biotech","a"],[". ","p"],["Tomás Ferreira","a"],[",","p"]],
              [["their counsel, must obtain board sign-off.","p"]]];
  const WF_B=[[["[PERSON_A]","c"],[" of ","p"],["[ORG_A]","c"],[" · stake in ","p"],["[ORG_B]","c"]],
              [["[PERSON_B]","c"],[" counsel · ref ","p"],["[CODE_A]","c"]]];
  const WF_Q=[[["Summarise this matter & who signs off:","p"]],
              [["[PERSON_A]","c"],[" of ","p"],["[ORG_A]","c"],[" acquiring ","p"],["[ORG_B]","c"],[";","p"]],
              [["[PERSON_B]","c"],[" counsel · ","p"],["[CODE_A]","c"]]];
  const WF_R=[[["[PERSON_A]","c"],[" (acquirer, ","p"],["[ORG_A]","c"],[") takes a","p"]],
              [["stake in ","p"],["[ORG_B]","c"],[". ","p"],["[PERSON_B]","c"],[" must get","p"]],
              [["board approval before ","p"],["[PERSON_A]","c"],[" proceeds.","p"]]];
  const WF_D=[[["Anya Kowalski","a"],[" (","p"],["Meridian Capital","a"],[") is acquiring","p"]],
              [["a stake in ","p"],["Halcyon Biotech","a"],["; ","p"],["Tomás Ferreira","a"]],
              [["must get board approval first.","p"]]];
  function _focusRing(bb,op,pulse){
    const [x,y,w,h]=bb, o=op*(0.78+0.22*Math.abs(Math.sin(pulse)));
    return rrect(x-8,y-8,w+16,h+16,18,AMBER,{op:op*0.08})
      + `<rect x="${n2(x)}" y="${n2(y)}" width="${n2(w)}" height="${n2(h)}" rx="16" fill="none" stroke="${AMBER}" stroke-width="3" stroke-opacity="${n3(o)}"/>`;
  }
  function _camera(content,fx,fy,sc){
    return `<g transform="translate(${n2(960-sc*fx)},${n2(540-sc*fy)}) scale(${sc.toFixed(4)})">${content}</g>`;
  }
  function _pick(stops,lt){ let i=0; for(let k=0;k<stops.length;k++){ if(lt>=stops[k][0]) i=k; } return i; }
  function scene_workflow(t){
    const [s,e]=SW, a=scene_alpha(t,s,e,0.5,0.5);
    if(a<=0) return "";
    const lt=t-s, csz=19;
    const px=965,py=288,pw=815,ph=430;
    const ubw=636, ubx=px+pw-24-ubw, uby=py+92;
    const rbx=px+24, rby=py+256, rbw=656;

    // ---------- diagram (world space, framed by the camera) ----------
    let d=[];
    const za=smooth(clamp((lt-0.3)/0.4));
    d.push(group(`<rect x="143" y="263" width="14" height="15" rx="3" fill="${GREEN}"/>`
      +`<path d="M 146 263 v-3 a4.5 4.5 0 0 1 9 0 v3" fill="none" stroke="${GREEN}" stroke-width="2"/>`
      +txt(166,277,"YOUR MACHINE  ·  local",17,{fill:GREEN,family:FT_MONO,weight:600,ls:0.5}),{op:a*za}));
    const ba=smooth(clamp((lt-4.6)/0.6));
    d.push(line(930,300,930,820,FAINT,{sw:2,op:a*ba*0.9,dash:"2 9"}));
    d.push(txt(930,290,"only tokens cross",16,{fill:AMBER,family:FT_SEMI,anchor:"middle",op:a*ba}));
    const aA=smooth(clamp((lt-0.5)/0.6));
    d.push(group(card(150,292,740,116,"MATTER FILE  ·  real names",MUTED,{op:a}),{op:aA}));
    for(let i=0;i<WF_A.length;i++) d.push(_mline(178,336+i*32,WF_A[i],csz,a*aA));
    const a1=smooth(clamp((lt-2.9)/0.4));
    d.push(_darrow(196,414,452,a*a1));
    const aB=smooth(clamp((lt-3.1)/0.5));
    d.push(group(card(150,470,740,96,"TOKENISED  ·  safe to send",AMBER,{op:a,fill:CARD2}),{op:aB}));
    for(let i=0;i<WF_B.length;i++) d.push(_mline(178,514+i*32,WF_B[i],csz,a*aB));
    const aP=smooth(clamp((lt-5.0)/0.5));
    d.push(group(rrect(px+5,py+13,pw,ph,18,"#2a1d12",{op:a*0.09}),{op:aP}));
    d.push(group(rrect(px,py,pw,ph,18,CARD,{op:a,stroke:AMBER_BD,sw:1.7,sop:a*0.75}),{op:aP}));
    d.push(group(_spark(px+42,py+45,16,a*aP)
      +txt(px+72,py+55,"Claude",30,{fill:INK,family:FT_SEMI,op:a*aP})
      +txt(px+pw-26,py+53,"external assistant",15,{fill:MUTED,family:FT_MONO,anchor:"end",op:a*aP})
      +line(px+22,py+78,px+pw-22,py+78,BORDER,{sw:1.4,op:a*aP})));
    const aU=smooth(clamp((lt-5.5)/0.45));
    d.push(rrect(ubx,uby,ubw,152,14,AMBER_BG,{op:a*aU,stroke:AMBER_BD,sw:1.3,sop:a*aU}));
    d.push(txt(px+pw-24,uby-8,"you",15,{fill:MUTED,family:FT_MONO,anchor:"end",op:a*aU}));
    for(let i=0;i<WF_Q.length;i++) d.push(_mline(ubx+30,uby+48+i*36,WF_Q[i],19,a*aU));
    const typ=smooth(clamp((lt-7.6)/0.3))*(1-smooth(clamp((lt-8.2)/0.25)));
    if(typ>0.01) for(let dd=0;dd<3;dd++){ const db=0.4+0.6*Math.abs(Math.sin((lt*4)-(dd*0.5)));
      d.push(`<circle cx="${rbx+38+dd*28}" cy="${rby+76}" r="6" fill="${MUTED}" fill-opacity="${n3(a*typ*db)}"/>`); }
    const aR=smooth(clamp((lt-8.3)/0.45));
    d.push(rrect(rbx,rby,rbw,152,14,CARD2,{op:a*aR,stroke:AMBER_BD,sw:1.4,sop:a*aR}));
    d.push(rrect(rbx,rby,5,152,2,AMBER,{op:a*aR}));
    d.push(_spark(rbx+30,rby+34,9,a*aR));
    for(let i=0;i<WF_R.length;i++) d.push(_mline(rbx+56,rby+48+i*36,WF_R[i],19,a*aR));
    const a3=smooth(clamp((lt-9.8)/0.4));
    d.push(_darrow(196,604,712,a*a3));
    const aD=smooth(clamp((lt-10.0)/0.45));
    d.push(group(card(150,730,740,116,"ANSWER  ·  re-identified locally",GREEN,{op:a}),{op:aD}));
    for(let i=0;i<WF_D.length;i++) d.push(_mline(178,774+i*32,WF_D[i],csz,a*aD));
    const pkA=_travel(lt,6.1,0.9,[884,512],[ubx+80,uby+76]);
    if(pkA) d.push(_packet(pkA[0],pkA[1],a*pkA[2]));
    const pkB=_travel(lt,10.1,0.9,[rbx+140,rby+76],[520,700]);
    if(pkB) d.push(_packet(pkB[0],pkB[1],a*pkB[2]));

    // ---------- travelling focus ring ----------
    const bbMatter=[136,278,768,144], bbTok=[136,456,768,124],
          bbQuery=[ubx-15,uby-15,ubw+30,182], bbReply=[rbx-15,rby-15,rbw+30,182], bbAnswer=[136,716,768,144];
    const ringStops=[[0.8,bbMatter],[3.1,bbTok],[5.4,bbQuery],[7.8,bbReply],[10.0,bbAnswer]];
    if(lt>=0.8 && lt<12.0){
      const ri=_pick(ringStops,lt), cur=ringStops[ri][1];
      let bb=cur;
      if(ri>0){ const p=smooth(clamp((lt-ringStops[ri][0])/0.6)), pv=ringStops[ri-1][1]; bb=cur.map((v,j)=>lerp(pv[j],v,p)); }
      const rop=a*smooth(clamp((lt-0.8)/0.4))*(1-smooth(clamp((lt-11.4)/0.5)));
      if(rop>0.01) d.push(_focusRing(bb,rop,lt*3.0));
    }

    // ---------- camera (zoom + pan to each beat) ----------
    const camStops=[[0.0,960,540,1.0],[0.8,520,350,1.28],[3.1,520,518,1.28],[5.4,1438,456,1.2],
                    [7.8,1317,620,1.2],[10.0,520,788,1.28]];
    const ci=_pick(camStops,lt); let fx,fy,sc;
    if(ci===0){ fx=960; fy=540; sc=1.0; }
    else{ const p=smooth(clamp((lt-camStops[ci][0])/0.6)), pr=camStops[ci-1], cu=camStops[ci];
      fx=lerp(pr[1],cu[1],p); fy=lerp(pr[2],cu[2],p); sc=lerp(pr[3],cu[3],p); }

    // ---------- screen-space overlays (not zoomed) ----------
    const hdrA=1-smooth(clamp((lt-1.2)/0.6));   // fade header out as the camera zooms in
    let scr=[section_header("04","IN PRACTICE","use it with an LLM — privileged names never leave your machine",AMBER,{op:a*hdrA,lt})];
    const caps=[[0.8,"1 · A real matter — real client names"],
                [3.1,"2 · Anonymise & tokenise — safe to send"],
                [5.4,"3 · Only tokens ever cross to Claude"],
                [7.8,"4 · Claude reasons & answers in tokens"],
                [10.0,"5 · Restore the real names, locally"]];
    for(let i=0;i<caps.length;i++){
      const st=caps[i][0], en=(i+1<caps.length?caps[i+1][0]:12.0);
      if(lt>=st && lt<en){
        const cA=smooth(clamp((lt-st)/0.3))*(1-smooth(clamp((lt-(en-0.25))/0.25)));
        scr.push(txt(960,912,caps[i][1],28,{fill:AMBER,family:FT_SEMI,anchor:"middle",op:a*cA}));
      }
    }
    return _camera(d.join(""),fx,fy,sc) + scr.join("");
  }

  // ---- OUTRO (no headline; ends on a call to action) ----
  const STATS=[["0.85","fine-tuned NER F1"],["+28 pts","over off-the-shelf"],["555","ECHR judgments"],["lossless","local round-trip"]];
  function scene_outro(t){
    const [s,e]=S4, a=scene_alpha(t,s,e,0.5,0.6);
    if(a<=0) return "";
    const lt=t-s, cx=W/2;
    let out=[];
    const ta=smooth(clamp(lt/0.6)), tdy=(1-ease_out(clamp(lt/0.7)))*16;
    out.push(group(txt(cx,330,"Legal Text Anonymiser",58,{fill:INK,family:FT_SEMI,anchor:"middle",ls:0.4}),{op:a*ta,ty:tdy}));
    const sub=smooth(clamp((lt-0.25)/0.6));
    out.push(txt(cx,378,"catch the legal PII off-the-shelf tools miss — and measure the risk that's left",24,{fill:MUTED,family:FT_MONO,anchor:"middle",op:a*sub}));
    const n=STATS.length, span=1360, x0=cx-span/2, step=span/(n-1);
    for(let i=0;i<n;i++){
      const sa=smooth(clamp((lt-(0.6+i*0.16))/0.5)), sx=x0+i*step;
      out.push(txt(sx,548,STATS[i][0],50,{fill:INK,family:FT_SEMI,anchor:"middle",op:a*sa}));
      out.push(txt(sx,588,STATS[i][1],20,{fill:MUTED,family:FT_MONO,anchor:"middle",op:a*sa}));
      if(i<n-1) out.push(line(sx+step/2,524,sx+step/2,572,BORDER,{sw:1.5,op:a*sa}));
    }
    // call to action pill
    const cao=smooth(clamp((lt-1.4)/0.5));
    const pw=392,ph=66,pxp=cx-pw/2,pyp=648, ax=cx+116, ay=pyp+34;
    out.push(group(rrect(pxp,pyp,pw,ph,ph/2,AMBER_BG,{op:a*cao,stroke:AMBER_BD,sw:1.6,sop:a*cao})
      + txt(cx-22,pyp+43,"Read the write-up",25,{fill:AMBER,family:FT_SEMI,anchor:"middle",op:a*cao,weight:600})
      + `<path d="M ${ax} ${ay} h 22 m -9 -7 l 9 7 l -9 7" fill="none" stroke="${AMBER}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="${n3(a*cao)}"/>`,
      {ty:(1-cao)*12}));
    const fa=smooth(clamp((lt-1.8)/0.6));
    out.push(txt(cx,792,"William Catt  ·  williamcatt.dev",22,{fill:MUTED,family:FT_MONO,anchor:"middle",op:a*fa}));
    return out.join("");
  }

  // ---- compose ----
  function buildInner(t){
    let b=[];
    b.push(`<rect width="${W}" height="${H}" fill="${BG}"/>`);
    b.push(`<radialGradient id="vg" cx="22%" cy="0%" r="90%">`
      +`<stop offset="0%" stop-color="#ffffff" stop-opacity="0.5"/>`
      +`<stop offset="100%" stop-color="#ffffff" stop-opacity="0"/></radialGradient>`);
    b.push(`<rect width="${W}" height="${H}" fill="url(#vg)"/>`);
    b.push(scene_intro(t));
    b.push(scene_title(t));
    b.push(scene_redact(t));
    b.push(scene_anon(t));
    b.push(scene_pseudo(t));
    b.push(scene_workflow(t));
    b.push(scene_outro(t));
    b.push(chrome(t));
    return b.join("");
  }
  function buildSVG(t){
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${buildInner(t)}</svg>`;
  }

  const api={buildInner,buildSVG,TOTAL,W,H,FPS};
  if(typeof module!=="undefined"&&module.exports){ module.exports=api;
    if(require.main===module){ process.stdout.write(buildSVG(parseFloat(process.argv[2]||"0"))); } }
  root.AnonShowcase=api;
})(typeof window!=="undefined"?window:globalThis);
