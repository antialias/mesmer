// The aileron model's shared test vectors. The model and its solver live in
// aileron.html's <script id="model">; when the plugin gets its C++ copy
// (aileron.hpp), workbench_tests.cpp checks it against the same file: the
// wheel's torque at five angles, the rest, and the drive's registers for the
// wheel at x0 (null: at the model's rest) under both floor rules.
// Each case is per-side inputs as X-Plane would report them (q Pa, angle deg,
// stalled 0..1), never airspeed or roll rate: the plugin reads panels.
//   node aileron_vectors.mjs          check aileron_vectors.json against the page, and the model's invariants
//   node aileron_vectors.mjs --write  regenerate it after changing the model
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';

const here=dirname(fileURLToPath(import.meta.url));
const page=readFileSync(join(here,'aileron.html'),'utf8');
const found=page.match(/<script id="model">([\s\S]*?)<\/script>/);
if (!found) throw new Error('aileron.html has no <script id="model">');
const M=new Function(`${found[1]}\nreturn Aileron;`)();
// The feel page carries the same model block for its roll drawing (CMakeLists.txt
// embeds workbench.html into the plugin, so it can't load aileron.html). The two must be identical.
const feel=readFileSync(join(here,'workbench.html'),'utf8').match(/<script id="aileron-model">([\s\S]*?)<\/script>/);
if (!feel) {console.error('workbench.html has no <script id="aileron-model">');process.exit(1);}
if (feel[1]!==found[1]) {
  const a=found[1].split('\n'),b=feel[1].split('\n');let i=0;while (i<a.length && a[i]===b[i]) i++;
  console.error(`workbench.html's aileron model differs from aileron.html's at model line ${i+1}:\n  aileron.html:   ${a[i]??'(end)'}\n  workbench.html: ${b[i]??'(end)'}\nCopy aileron.html's <script id="model"> block into workbench.html's <script id="aileron-model">.`);
  process.exit(1);
}
// mesmer.haunt.house's live demo runs the same block as a plain script,
// public/site/www/js/aileron-model.js, byte for byte. The site stays in
// flightsim (the public manifest leaves it out), so where public/site is
// absent there is nothing to check.
if (existsSync(join(here,'public','site'))) {
  const site=join(here,'public','site','www','js','aileron-model.js');
  const copy=existsSync(site)?readFileSync(site,'utf8'):null;
  if (copy!==found[1]) {
    const a=found[1].split('\n'),b=(copy??'').split('\n');let i=0;while (i<a.length && a[i]===b[i]) i++;
    console.error(copy===null?`${site} is missing.`:`the site's aileron-model.js differs from aileron.html's model at model line ${i+1}:\n  aileron.html:     ${a[i]??'(end)'}\n  aileron-model.js: ${b[i]??'(end)'}`);
    console.error('Write aileron.html\'s <script id="model"> block, exactly, to public/site/www/js/aileron-model.js.');
    process.exit(1);
  }
}
const P=M.P,DEG=M.DEG;
const fail=why=>{console.error(why);process.exit(1);};

// ---- invariants ----
const mk=(qL,qR,aL,aR,fL,fR,W=0,chd=P.chd,cha=P.cha,keep=P.keep)=>({left:{q:qL,alpha:aL*DEG,stalled:fL},right:{q:qR,alpha:aR*DEG,stalled:fR},unbalance:W,friction:0,chd,cha,keep});
const grid=[...Array(41)].map((_,i)=>-P.wheel+2*P.wheel*i/40);
// 1. Zero air with weight 0 means zero torque everywhere, whatever the angles and stall flags say.
for (const s of [mk(0,0,0,0,0,0),mk(0,0,170,-120,1,1),mk(2,2.4,30,-30,1,0)])
  for (const t of grid) {const T=M.torques(s,t);if (Math.abs(T.total)>1e-12||Math.abs(T.left)>1e-12||Math.abs(T.right)>1e-12) fail(`torque with no air at ${(t/DEG).toFixed(1)}°: ${T.total}`);}
// 2. Left-right mirror symmetry: swapping the wings and the wheel's sign negates the torque and the rest.
const rnd=(()=>{let x=12345;return()=>{x=(x*1103515245+12345)&0x7fffffff;return x/0x7fffffff;};})();
for (let i=0;i<300;i++) {
  const s=mk(rnd()*2000,rnd()*2000,rnd()*40-10,rnd()*40-10,rnd()<.3?rnd():0,rnd()<.3?rnd():0,rnd()*20,0.05+rnd()*.55,rnd()*.5-.1,rnd());
  const m={...s,left:s.right,right:s.left};
  for (const t of grid) {
    const a=M.torques(s,t),b=M.torques(m,-t);
    if (Math.abs(a.total+b.total)>1e-9||Math.abs(a.left+b.right)>1e-9||Math.abs(a.weight+b.weight)>1e-9) fail(`mirror symmetry broken at ${(t/DEG).toFixed(1)}°: ${a.total} vs ${b.total}`);
  }
  if (Math.abs(M.rest(s)+M.rest(m))>1e-6) fail(`mirrored rests differ: ${M.rest(s)} vs ${M.rest(m)}`);
  // 3. The rest stays within the stops, and the torque there is zero unless it is a stop.
  const r=M.rest(s);
  if (!(r>=-P.wheel-1e-12&&r<=P.wheel+1e-12)) fail(`rest outside the stops: ${r}`);
  if (Math.abs(r)<P.wheel-1e-9&&Math.abs(M.torque(s,r))>1e-6) fail(`torque at the rest is ${M.torque(s,r)}`);
}
// 4. Equal angles mean no shift at neutral: with equal air and angle both sides the rest is level, weight or not.
for (const [q,a,W,f] of [[500,4,0,0],[500,12,15,0],[1962,-3,20,0],[300,25,0,1],[120,17,8,0.5]]) {
  const s=mk(q,q,a,a,f,f,W);
  if (Math.abs(M.torque(s,0))>1e-12) fail(`torque at neutral with equal wings: ${M.torque(s,0)}`);
  if (Math.abs(M.rest(s))>1e-6) fail(`rest shifted with equal wings: ${M.rest(s)/DEG}°`);
}
// 5. The linkage reaches the published travel at the stops, equal rates at neutral.
{const g=M.angles(P.wheel),n=M.angles(0);
 if (Math.abs(g.right-P.up)>1e-12||Math.abs(g.left+P.down)>1e-12) fail('the stops are not up/down');
 if (Math.abs(n.dRight+n.dLeft)>1e-12) fail('rates at neutral differ');}
// 6. With air, the torque opposes the wheel: restoring on both sides of neutral.
{const s=mk(1000,1000,2,2,0,0);if (!(M.torque(s,.5)<0&&M.torque(s,-.5)>0)) fail('air does not centre the wheel');}

// ---- vectors ----
const round=(v,places)=>Number(v.toFixed(places));
// [name, qL, qR, alphaL deg, alphaR deg, stalledL, stalledR, unbalance in·lb each, hinge slope per rad if not the page's].
// Every case before the air-from-behind ones keeps its expected values as they were.
const cases=[
  ['parked, engine off',0,0,0,0,0,0,0],
  ['parked, noise on the panels',0,0,170,-120,1,1,0],
  ['parked, weighted ailerons',0,0,0,0,0,0,10],
  ['taxi, 12 kt',23.3,23.3,1,1,0,0,0],
  ['fast taxi, 26 kt',109.6,109.6,1,1,0,0,0],
  ['take-off roll, 55 kt',490.5,490.5,2,2,0,0,0],
  ['cruise, 110 kt',1962,1962,2,2,0,0,0],
  ['cruise, weighted ailerons',1962,1962,2,2,0,0,10],
  ['rolling right at 100 kt, 30°/s',1621,1621,0.1,5.9,0,0,0],
  ['steady slip, wind from the right',794,794,5.6,6.4,0,0,0],
  ['slow flight, 50 kt',405,405,12,12,0,0,0],
  ['stall, left wing dropping',328,328,21,13,1,0.4,0],
  ['spin to the left, per-panel',408,583,30,17,1,0.3,0],
  ['right wing stalled, equal angles',700,700,14,14,0,1,0],
  ['gust on the left wing',1312,1312,8,3,0,0,0],
  ['one wing with air',600,0,4,4,0,0,0],
  ['left wing more air',1300,1000,2,2,0,0,0],
  ['angles past the clamp at 1500 Pa',1500,1500,45,-50,0,0,0],
  ['under the gate, 2 Pa both sides',2,2,20,-10,0,0,0],
  ['under the gate on the right only',600,2,4,25,0,0,0],
  ['light hinge, 30° split: rest at the stop',60,60,15,-15,0,0,0,0.02],
  ['light hinge, 30° split: centre clamped',100,100,15,-15,0,0,0,0.01],
  // Air from behind (decision 17): the deflection's moment turns over and the wheel runs to a stop.
  ['tailwind on the ground, air from behind both sides',30,30,179,179,0,0,0],
  ['air from behind both sides, weighted ailerons',30,30,178,-178,0,0,10],
  ['air from behind on the left only',40,40,-179,2,0,0,0],
  ['air from behind just past 90°, under the gate on the right',60,2,91,170,0,1,0],
];
// The wheel's positions and the drive's knobs each case is solved at:
// [x0, units per N·m, force-exact]. The strength is held to the drive's
// ceiling (decision 16); the last asks more than it under heavy air.
const solves=[[null,1000,true],[-13000,1000,true],[-3000,1000,true],[0,1000,true],[3000,1000,true],[13000,1000,true],
  [3000,1000,false],[0,1000,false],[3000,10000,true]];
const angles=[-P.wheel,-P.wheel/2,0,P.wheel/2,P.wheel];
const figures={area_m2:P.area,chord_m:P.chord,hinge_slope_per_rad:P.chd,alpha_slope_per_rad:P.cha,up_deg:round(P.up/DEG,9),down_deg:round(P.down/DEG,9),
  wheel_deg:round(P.wheel/DEG,9),rim_m:P.rim,stall_factor:P.keep,k_rev:P.kRev,alpha_clamp_deg:round(P.alphaClamp/DEG,9),minimum_panel_pa:P.minPa,
  inertia_kgm2:P.inertia,wheel_inertia_kgm2:P.wheelInertia,damping_ratio:P.zeta,wash_mps:P.wash};
const vectors=cases.map(([name,qL,qR,aL,aR,fL,fR,W,chd])=>{
  const s=mk(qL,qR,aL,aR,fL,fR,W,chd??P.chd);
  const torques=angles.map(t=>{const T=M.torques(s,t);return {wheel_deg:round(t/DEG,6),left_nm:round(T.left,9),right_nm:round(T.right,9),weight_nm:round(T.weight,9),total_nm:round(T.total,9),rim_lb:round(M.rimLb(T.total),9)};});
  const solutions=solves.map(([x0,units,fx])=>{
    const r=M.solve(s,x0===null?NaN:x0,units,fx);
    return {x0,units_per_nm:units,force_exact_rule:fx,ceiling:r.ceiling,strength:r.strength,centre:r.centre,
      model_nm:round(r.modelNm,9),drive_nm:round(r.driveNm,9),slope_nm_per_count:round(r.slopeNmPerCount,12),
      saturated:r.saturated,floored:r.floored,force_exact:r.forceExact,centre_limited:r.centreLimited};
  });
  const g=M.angles(P.wheel/2);
  return {name,left:{pa:qL,alpha_deg:aL,stalled:fL},right:{pa:qR,alpha_deg:aR,stalled:fR},unbalance_inlb:W,
    ...(chd===undefined?{}:{hinge_slope_per_rad:chd}),anchor_nm:round(Math.abs(M.exact(M.rest(s)))>=M.TRAVEL-0.5?M.torque(s,M.rest(s)):0,9),
    indifferent:M.indifferent(s),rest_deg:round(M.rest(s)/DEG,6),rest_counts:M.counts(M.rest(s)),
    half_wheel_left_deg:round(g.left/DEG,6),half_wheel_right_deg:round(g.right/DEG,6),torques,solutions};
});
// The air-from-behind cases, against the physics: each aileron with air
// wholly from behind (150° or more, the gate's share whole) is a free surface
// whose air (the deflection's moment and the float; its weight left out)
// pushes it further the way it is deflected, harder the further it goes. Over
// every whole degree past 2° (where the float, at the angle against the
// reversed stream, no longer holds it) to each stop the moment has the
// deflection's sign and grows, so a free aileron runs to the stop on its
// deflected side. With both wings alike and no weight, the wheel's torque
// pushes it away from neutral and grows toward either stop.
{let checked=0;
 for (const [name,qL,qR,aL,aR,fL,fR,W] of cases) {
   if (!/air from behind/.test(name)) continue;
   const s=mk(qL,qR,aL,aR,fL,fR,W);
   for (const k of ['left','right']) {
     if (!(s[k].q>=2*P.minPa&&Math.abs(s[k].alpha)>=150*DEG)) continue;
     const aero=u=>{const m=M.side(s,k,u);return m.air+m.float;};
     for (const [way,stop] of [[1,P.up],[-1,P.down]]) {
       let last=0;
       for (let d=2;d<=stop/DEG+1e-9;d++) {
         const m=way*aero(way*d*DEG);
         if (!(m>0)) fail(`${name}: the ${k} aileron, ${way>0?'up':'down'} ${d}°, is not pushed further (${m})`);
         if (!(m>last)) fail(`${name}: the ${k} aileron's moment does not grow away from neutral at ${way>0?'up':'down'} ${d}°`);
         last=m;
       }
     }
     checked++;
   }
 }
 if (checked<4) fail(`only ${checked} ailerons with air from behind were checked`);
 const s=mk(30,30,179,179,0,0,0);let last=0;
 for (let i=1;i<=20;i++) {const t=P.wheel*i/20,right=M.torque(s,t),left=M.torque(s,-t);
   if (!(right>last&&left<-last&&Math.abs(right+left)<1e-12)) fail(`air from behind both sides: the wheel's torque does not grow away from neutral at ${(t/DEG).toFixed(1)}°`);
   last=right;}
}
// A quartering tailwind, air from behind both wings: the stop pushed harder
// changes side as the wind shifts (30/31 Pa to 31/30), but a wheel at a stop
// stays there, and one off centre goes to the stop on its side.
{const a=mk(30,31,179,179,0,0,0),b=mk(31,30,179,179,0,0,0),w=P.wheel,at=c=>c/M.TRAVEL*w;
 if (!(M.rest(a)>0&&M.rest(b)<0)) fail('the harder-pushed stop must change side between the two winds (the case\'s reason)');
 for (const s of [a,b]) for (const [c,want] of [[-M.TRAVEL,-w],[M.TRAVEL,w],[-3000,-w],[3000,w]]) {
   if (M.rest(s,at(c))!==want) fail(`a quartering tailwind: a wheel at ${c} counts must rest at the ${want<0?'left':'right'} stop, not ${(M.rest(s,at(c))/DEG).toFixed(2)}°`);
   // At a stop the centre is the stop and roll has no constant force, so the drive gives nothing there.
   const way=Math.abs(c)===M.TRAVEL?0:Math.sign(want);
   for (const fx of [false,true]) if (Math.sign(M.solve(s,c,1000,fx).driveNm)!==way) fail(`a quartering tailwind: the drive must push a wheel at ${c} counts toward the ${want<0?'left':'right'} stop`);}}
// ---- sweeps across the air's direction ----
// Decision 17's air from behind, made continuous: the left aileron's angle in
// quarter degrees through ±90° (across it), ±30° (the clamp) and ±150°
// (wholly from behind). At 40 Pa both sides take the angle (a tailwind on the
// ground); at 300 Pa the right holds 2° (a one-sided sweep, so the rest moves),
// over ±90° and ±30° only: from behind on one wing at 300 Pa the float folds
// the rest from one stop to the other near -155°, as it did before. Unbalance
// 10 in·lb. No step may move the rest more than SWEEP_REST counts nor the
// torque at half wheel either way, or the drive's there (force-exact, as a
// session flies), more than SWEEP_PER_PA N·m per Pa. With both sides alike
// the air from behind pushes the wheel to either stop equally, a tie the
// rest settles at 0 by rule and rounding may break either way, so those
// sweeps hold no rest: the drive, force-exact, follows the torque, not it.
const SWEEP_STEP=0.25,SWEEP_REST=250,SWEEP_PER_PA=2e-4,SWEEP_AT=[-P.wheel/2,P.wheel/2],SWEEP_X=[-M.TRAVEL/2,M.TRAVEL/2];
const sweepCases=[[40,null,[[80,100],[-80,-100],[20,40],[-20,-40],[140,160],[-140,-160]]],[300,2,[[80,100],[-80,-100],[20,40],[-20,-40]]]];
const sweeps=sweepCases.flatMap(([pa,right,ranges])=>ranges.map(([from,to])=>{
  const n=Math.round(Math.abs(to-from)/SWEEP_STEP),way=Math.sign(to-from),rest=[],torque=[],drive=[];
  for (let i=0;i<=n;i++) {
    const deg=from+way*i*SWEEP_STEP,s=mk(pa,pa,deg,right??deg,0,0,10);
    rest.push(round(M.exact(M.rest(s)),6));torque.push(SWEEP_AT.map(t=>round(M.torque(s,t),9)));
    drive.push(SWEEP_X.map(x=>round(M.solve(s,x,1000,true).driveNm,9)));
  }
  return {pa,right_alpha_deg:right,from_deg:from,to_deg:to,unbalance_inlb:10,rest_counts:right===null?null:rest,total_nm:torque,drive_nm:drive};
}));
for (const w of sweeps) for (let i=1;i<w.total_nm.length;i++) {
  const at=`${w.pa} Pa, ${w.from_deg+Math.sign(w.to_deg-w.from_deg)*i*SWEEP_STEP}°`;
  if (w.rest_counts&&Math.abs(w.rest_counts[i]-w.rest_counts[i-1])>SWEEP_REST) fail(`the wheel's rest jumps at ${at}`);
  for (let k=0;k<SWEEP_AT.length;k++) if (Math.abs(w.total_nm[i][k]-w.total_nm[i-1][k])>w.pa*SWEEP_PER_PA) fail(`the torque jumps at ${at}`);
  for (let k=0;k<SWEEP_X.length;k++) if (Math.abs(w.drive_nm[i][k]-w.drive_nm[i-1][k])>w.pa*SWEEP_PER_PA) fail(`the drive's torque jumps at ${at}`);
}
// Across the gate: air from behind (176°) both sides as the pressure rises
// from 2 to 6 Pa in 0.05 Pa steps; the turn's departure from 1 fades in from
// 2.5 to 5 Pa, so no step moves the torque at half wheel, or the drive's
// there, more than GATE_NM, but the step onto the gate itself: the ailerons'
// whole moment starts there (decision 5), about 0.011 N·m at half wheel
// here, the same size before the fade (only its sign was the reversed one).
const GATE_STEP=0.05,GATE_NM=0.002;
const gate=(()=>{const torque=[],drive=[];
  for (let i=0;i<=80;i++) {const q=2+i*GATE_STEP,s=mk(q,q,176,176,0,0,10);
    torque.push(SWEEP_AT.map(t=>round(M.torque(s,t),9)));drive.push(SWEEP_X.map(x=>round(M.solve(s,x,1000,true).driveNm,9)));}
  return {alpha_deg:176,from_pa:2,step_pa:GATE_STEP,unbalance_inlb:10,most_nm:GATE_NM,total_nm:torque,drive_nm:drive};})();
const ONTO_GATE=Math.round((P.minPa-2)/GATE_STEP);
for (let i=1;i<gate.total_nm.length;i++) for (let k=0;k<2;k++) if (i!==ONTO_GATE)
  if (Math.abs(gate.total_nm[i][k]-gate.total_nm[i-1][k])>GATE_NM||Math.abs(gate.drive_nm[i][k]-gate.drive_nm[i-1][k])>GATE_NM) fail(`air from behind steps in at ${(2+i*GATE_STEP).toFixed(2)} Pa`);
const text=JSON.stringify({
  about:'Generated by aileron_vectors.mjs from aileron.html\'s model; checked by it, and by workbench_tests.cpp against aileron.hpp. Do not edit by hand.',
  units:{pa:'dynamic pressure over that aileron\'s panels',alpha_deg:'that aileron\'s panel angle of attack, before the ±30° clamp',stalled:'that aileron\'s stalled share, 0..1',
    unbalance_inlb:'one aileron\'s weight about its hinge, trailing edge heavy positive',
    hinge_slope_per_rad:'where present, the case\'s hinge slope in place of the figures\'',anchor_nm:'the model\'s torque at a rest that lies at a stop; 0 otherwise',
    wheel_deg:'wheel angle, right positive',left_nm:'the left aileron\'s air through the linkage, N·m at the wheel, right positive',
    weight_nm:'both weights through the linkage',total_nm:'the model\'s torque at the wheel',rim_lb:'the same at the grip radius',
    rest_deg:'where the torque is zero; 0 and indifferent when nothing turns it',rest_counts:'drive counts, 13000 at either stop, right positive',
    half_wheel_left_deg:'the left aileron at half wheel right, up positive (the differential)',
    x0:'the wheel, drive counts right positive; null at the model\'s rest',ceiling:'the drive\'s ceiling, percent: the strongest spring within its margin',strength:'0x2114, percent',centre:'0x2116, counts right positive',
    model_nm:'the model at x0',drive_nm:'the drive\'s spring at x0',slope_nm_per_count:'the model\'s secant from its rest to x0'},
  figures,vectors,
  sweep:{step_deg:SWEEP_STEP,at_wheel_deg:SWEEP_AT.map(t=>round(t/DEG,9)),at_counts:SWEEP_X,rest_counts:SWEEP_REST,per_pa:SWEEP_PER_PA,
    about:'the left aileron\'s angle from from_deg to to_deg in step_deg steps at pa both sides, the right\'s at right_alpha_deg (null: the left\'s), nothing stalled: the wheel\'s rest (counts, unrounded; null with both sides alike, a tie between the stops), the torque at at_wheel_deg and the drive\'s (force-exact, 1000 units per N·m) at at_counts, each step; no step may move the rest more than rest_counts nor a torque more than per_pa times pa'},
  sweeps,gate},null,1)+'\n';
const flat=vectors.flatMap(v=>v.solutions);
if (!flat.some(r=>r.floored&&r.force_exact)||!flat.some(r=>r.floored&&!r.force_exact)||!flat.some(r=>r.saturated)) fail('the cases must reach the floor under both rules and saturation');
if (!vectors.some(v=>v.indifferent)||!vectors.some(v=>Math.abs(v.rest_deg)>1)) fail('the cases must include an indifferent wheel and a shifted rest');
if (!flat.some(r=>r.centre_limited)||!vectors.some(v=>v.anchor_nm!==0)) fail('the cases must include a clamped centre and a rest at a stop with its anchor torque');
const file=join(here,'aileron_vectors.json');
if (process.argv.includes('--write')) {writeFileSync(file,text);console.log(`wrote ${vectors.length} vectors; invariants hold`);}
else if (readFileSync(file,'utf8')!==text) fail('aileron_vectors.json does not match aileron.html\'s model; run node aileron_vectors.mjs --write and check the C++ side');
else console.log(`aileron_vectors.json matches aileron.html's model (${vectors.length} vectors); invariants hold; workbench.html and the site carry the same model`);
