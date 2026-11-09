// The elevator model's angle-of-attack and stall vectors (decision 17). The
// model lives in elevator.html's <script id="model">, its C++ copy in
// elevator.hpp (tail_flow, elevator_moments, elevator_rest_rad), and
// workbench_tests.cpp checks the C++ against this file: the model's rest and
// its force across the travel at each tail angle and stalled share (as X-Plane
// would report them), air from behind running to a stop, the tail's own stall
// along the travel, the page's flight chain (airspeed, load factor and power
// to the tail's angle) and the tail panels' weighting, gate and clamp. Each
// case also carries the page's solve at several yoke positions: the rest a
// free elevator reaches from the yoke, the stiffness there and the drive's
// registers, which workbench_tests.cpp compares with solve_pitch's.
// elevator_vectors.json still pins the solver and the model without an angle;
// this script also checks that every one of its cases is unchanged, bit for
// bit, when the angle is zero and nothing is stalled.
//   node elevator_alpha_vectors.mjs          check elevator_alpha_vectors.json against the page
//   node elevator_alpha_vectors.mjs --write  regenerate it after changing the model
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';

const here=dirname(fileURLToPath(import.meta.url));
const page=readFileSync(join(here,'elevator.html'),'utf8');
const found=page.match(/<script id="model">([\s\S]*?)<\/script>/);
if (!found) throw new Error('elevator.html has no <script id="model">');
const {Elevator:E,TailAir:T,Flight:Fl}=new Function(`${found[1]}\nreturn {Elevator,TailAir,Flight};`)();
const P=E.P,DEG=E.DEG,TRAVEL=12000;
const fail=m=>{console.error(m);process.exit(1);};
const round=(v,places)=>Number(v.toFixed(places));
const angle=c=>{const x=E.clamp(c,-TRAVEL,TRAVEL)/TRAVEL;return x>=0?x*P.down:x*P.up;};
const exact=d=>E.clamp(d>=0?d/P.down:d/P.up,-1,1)*TRAVEL;

// 1. With no angle, nothing stalled and no surface the model is exactly the one
// elevator_vectors.json pins: every case, every output, compared with ===.
const base=JSON.parse(readFileSync(join(here,'elevator_vectors.json'),'utf8'));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b)&&Object.keys(a).every(k=>Object.is(a[k],b[k])||a[k]===b[k]);
let compared=0;
for (const v of base.vectors) {
  const s={q:E.tailQ(v.kt,v.throttle),trim:E.trimFloat(v.trim),g:v.g,unbalance:v.unbalance};
  for (const extra of [{alpha:0,stalled:0},{alpha:0,stalled:0,cha:0.5,keep:0.1},{alpha:-0,stalled:0,cha:-0.1,keep:1,kRev:0.5}]) {
    const t={...s,...extra};
    if (!same(E.drive(s),E.drive(t))) fail(`${v.name}: the model's drive changed with ${JSON.stringify(extra)}`);
    if (!Object.is(E.rest(s),E.rest(t))) fail(`${v.name}: the rest changed with ${JSON.stringify(extra)}`);
    for (const c of [-12000,-3000,0,3000,12000]) {
      const a=E.moments(s,angle(c)),b=E.moments(t,angle(c));
      if (!Object.is(a.net,b.net)||!Object.is(a.air,b.air)||!Object.is(a.weight,b.weight)) fail(`${v.name}: the moments changed at ${c} with ${JSON.stringify(extra)}`);
    }
    for (const sol of v.solutions) {
      const a=E.solve(s,sol.x0===null?NaN:sol.x0,sol.units_per_lb,sol.firmest_percent),b=E.solve(t,sol.x0===null?NaN:sol.x0,sol.units_per_lb,sol.firmest_percent);
      if (!same(a,b)) fail(`${v.name}: the solution at ${sol.x0} changed with ${JSON.stringify(extra)}`);
      compared++;
    }
  }
}

// 2. The cases, the tail's angle and stall as X-Plane would report them:
// [name, kt, throttle, trim, g, unbalance, tail angle deg, stalled share, Ch_alpha, stall factor, Ch_delta, tail Pa, k_rev, surface].
// null for Ch_alpha, the stall factor, Ch_delta or k_rev: the page's default; for the tail's Pa, the airspeed and throttle's.
// surface: the page's own tail stall along the travel ({tau, stall deg, width deg}), or null (the aircraft's way: X-Plane's flags).
// The angle is X-Plane's, before the gate and clamp.
const SURF={tau:T.P.tau,stall:T.P.stall/DEG,width:T.P.width/DEG};
const cases=[
  ['cruise, no angle',110,0.75,0.15,1,30,0,0,null,null],
  ['cruise, tail at -2°',110,0.75,0.15,1,30,-2,0,null,null],
  ['slow flight, tail at +3°',55,0.55,0.15,1,30,3,0,null,null],
  ['slow flight, no angle',55,0.55,0.15,1,30,0,0,null,null],
  ['approach to the stall',52,0.1,0.3,1,30,5,0,null,null],
  ['stall, power off',47,0,0.3,1,30,6,0,null,null],
  ['stall, power on',42,1,0.3,1,30,4,0.25,null,null],
  ['tail half stalled at a steep angle',40,0,0.3,1,30,20,0.7,null,null],
  ['tail fully stalled, factor 0.4',60,0.3,0.15,1,30,12,1,null,null],
  ['tail fully stalled, factor 0',60,0.3,0.15,1,30,12,1,null,0],
  ['tail fully stalled, factor 0, no angle',60,0.3,0.15,1,30,0,1,null,0],
  ['tail fully stalled, factor 0, no weight',60,0.3,0.15,1,0,8,1,null,0],
  ['no centring, float against weight: a stop',60,0.3,0.15,1,30,-6,0,null,null,0],
  ['no centring, float beats weight: the other stop',60,0.3,0.15,1,30,6,0,null,null,0],
  ['no centring, float and weight cancel inside',60,0.3,0.15,1,30,2.7,0,null,null,0],
  ['large Ch_alpha, full nose-up trim, 30°',100,0.6,1,1,30,30,0,0.6,null],
  ['clamped: 45° counts as 30°',90,0.5,0,1,30,45,0,null,null],
  ['clamped: -45° counts as -30°',90,0.5,0,1,30,-45,0,null,null],
  // Air from behind: the deflection's moment turns over and the elevator runs to a stop.
  ['reversed flow, tailwind: the forward stop',15,0,0,1,30,179,0,null,null],
  ['reversed flow, the other side: the forward stop',15,0,0,1,30,-179,0,null,null],
  ['reversed flow, no weight, the float tips it aft from nose-up trim: the aft stop',15,0,0.5,1,0,179,0,null,null],
  ['reversed flow, no weight, the float tips it forward from nose-down trim: the forward stop',15,0,-0.5,1,0,-179,0,null,null],
  ['reversed flow, k_rev 0: weight and float alone',15,0,0,1,30,179,0,null,null,null,null,0],
  ['reversed flow just past 90°: a stop',60,0.3,0,1,30,90.5,0.5,null,null],
  ['90° is not reversed: clamped to 30°',60,0.3,0,1,30,90,0,null,null],
  ['air under the gate, a large angle and a stall',3,0,0,1,30,25,1,null,null],
  ['exactly at the gate: counted',0,0,0,1,30,10,0.5,null,null,null,2.5],
  ['just under the gate: not counted',0,0,0,1,30,10,0.5,null,null,null,2.49],
  ['under the gate: parked, noise',0,0,0,1,30,170,1,null,null],
  ['negative Ch_alpha floats against the flow',80,0.5,0,1,30,6,0,-0.1,null],
  ['large Ch_alpha',80,0.5,0,1,30,6,0,0.6,null],
  ['pull-up at the stall, 2 g',60,0.6,0.3,2,30,8,0.3,null,null],
  ['full nose-down trim, tail at +10°',90,0.5,-1,1,30,10,0,null,null],
  // The tail's own stall along the travel: angle plus tau times the deflection past the section's stall.
  ['surface: cruise, tail at -2°',110,0.75,0.15,1,30,-2,0,null,null,null,null,null,SURF],
  ['surface: on its wheels, full power',0,1,0,1,30,-2.5,0,null,null,null,null,null,SURF],
  ['surface: tail at +12°, stalls forward of neutral',75,0.6,0.15,1.5,30,12,0,null,null,null,null,null,SURF],
  ['surface: a flag beats a smaller share',75,0.6,0.15,1,30,0,0.9,null,null,null,null,null,SURF],
  ['surface: air from behind, no surface stall',15,0,0,1,30,179,0,null,null,null,null,null,SURF],
  // Two balances, from the elevator's own stall: each yoke keeps to the one on
  // its side of the unstable point between them; just under 55 Pa the inner one goes.
  ['surface: two balances, each yoke keeps to its own',0,0,0,1,30,8,0,null,null,null,55,null,SURF],
  ['surface: the inner balance gone, every yoke to the forward stop',0,0,0,1,30,8,0,null,null,null,54.38,null,SURF],
  // Air from behind at 120°: from trim the stop flips between 56.1 and 56.3 Pa
  // as the float passes the weight; from a yoke at either stop it does not.
  ['reversed flow at 120°, trim neutral, 56.1 Pa',0,0,0,1,30,120,0,null,null,null,56.1],
  ['reversed flow at 120°, trim neutral, 56.3 Pa',0,0,0,1,30,120,0,null,null,null,56.3],
];
const at=[-12000,-6000,-3000,0,3000,6000,12000];
// The yoke positions each case is solved at (null: from trim, at the rest).
const SOLVE_AT=[null,-12000,-3000,0,4500,12000];
// Where the page scans (its own stall set, or air past the clamp), the rest
// is the balance a free elevator reaches from the yoke: from x0 the net
// moment pushes toward the rest all the way there.
const reached=(name,s,x0,restCounts)=>{
  const from=x0===null?exact(E.clamp(s.trim,-P.up,P.down)):E.clamp(x0,-TRAVEL,TRAVEL),way=Math.sign(restCounts-from);
  if (way===0) return;
  for (let i=1;i<40;i++) {const c=from+(restCounts-from)*i/40,n=E.moments(s,angle(c)).net;
    if (Math.abs(n)>1e-9&&Math.sign(n)!==way) fail(`${name}: from ${x0} the net moment turns back at ${c.toFixed(0)}, before the rest at ${restCounts.toFixed(0)}`);}
};
const vectors=cases.map(([name,kt,throttle,trim,g,unbalance,alphaDeg,stalled,cha,keep,slope=null,pa=null,kRev=null,surface=null])=>{
  const pageSlope=P.slope;if (slope!==null) P.slope=slope;
  try {
  const s={q:pa===null?E.tailQ(kt,throttle):pa,trim:E.trimFloat(trim),g,unbalance,alpha:alphaDeg*DEG,stalled};
  if (cha!==null) s.cha=cha;
  if (keep!==null) s.keep=keep;
  if (kRev!==null) s.kRev=kRev;
  if (surface!==null) s.surface={tau:surface.tau,stall:surface.stall*DEG,width:surface.width*DEG};
  const a=T.of(s),r=E.rest(s);
  // Solved as the plugin reads the case: its pressure to 1e-6 Pa, as written.
  const sq={...s,q:round(s.q,6)};
  const solutions=SOLVE_AT.map(x0=>{
    const sol=E.solve(sq,x0===null?NaN:x0,222),d=E.drive(sq,x0===null?NaN:angle(x0));
    if (sq.surface||T.of(sq).beyond) reached(name,sq,x0,sol.restCounts); // the scan's; elsewhere the rest is found as it always was
    return {x0,rest_counts:round(sol.restCounts,6),stiffness_lb_per_in:round(d.stiffnessLbPerIn,9),ceiling:sol.ceiling,strength:sol.strength,
      centre:sol.centre,bias:sol.bias,force_lb:round(sol.forceLb,9),drive_force_lb:round(sol.driveForceLb,9),slope_lb_per_count:round(sol.slopeLbPerCount,12),
      saturated:sol.saturated,floored:sol.floored,bias_limited:sol.biasLimited};
  });
  return {name,kt,throttle,trim,g,unbalance,alpha_deg:alphaDeg,stalled,
    hinge_slope_per_rad:P.slope,alpha_slope_per_rad:a.cha,stall_factor:a.keep,k_rev:a.kRev,surface,tail_pa:round(s.q,6),
    alpha_used_deg:round(a.alpha/DEG,9),stalled_used:a.stalled,kept:round(a.eff,12),reversed:a.reversed,
    float_lb:round(E.lb(E.moments(s,0).float),9),
    rest_deg:round(r/DEG,9),rest_counts:round(exact(r),6),
    force_lb:at.map(c=>round(E.lb(E.moments(s,angle(c)).net),9)),
    stalled_at:at.map(c=>round(T.of(s,angle(c)).stalled,12)),solutions};
  } finally {P.slope=pageSlope;}
});

// 2b. The page's flight chain, airspeed, load factor and power to the tail:
// [name, {kt, throttle, n, ground, pitchRate deg/s, tailwind kt}, trim]. The
// model's state from it is the page's: the reached load factor for g, the
// reported angle, the default figures and the surface stall.
const chainCases=[
  ['parked, engine off',{kt:0,throttle:0,ground:true},0],
  ['full power, brakes on',{kt:0,throttle:1,ground:true},0],
  ['takeoff roll',{kt:40,throttle:1,ground:true},0],
  ['tailwind taxi: 15 kt from behind at 5 kt',{kt:5,throttle:0.1,ground:true,tailwind:15},0],
  ['tailwind, full power: the wash wins',{kt:0,throttle:1,ground:true,tailwind:15},0],
  ['cruise',{kt:110,throttle:0.75,n:1},0.15],
  ['2 g pull-up',{kt:100,throttle:0.75,n:2},0.15],
  ['slow flight',{kt:55,throttle:0.55,n:1},0.15],
  ['power-off stall',{kt:51,throttle:0,n:1},0.3],
  ['power-on stall',{kt:49,throttle:1,n:1},0.3],
  ['accelerated stall',{kt:75,throttle:0.6,n:2.3},0.15],
  ['accelerated, just short of the break',{kt:75,throttle:0.6,n:1.9},0.15],
  ['sudden full-aft pull in cruise',{kt:110,throttle:0.75,n:1,pitchRate:20},0.15],
  ['deep in the stall: the angle held at its cap',{kt:35,throttle:0,n:1},0.3],
];
const chainState=(f,trim)=>({q:f.q,trim:E.trimFloat(trim),g:f.n,unbalance:30,alpha:f.reported,
  surface:{tau:T.P.tau,stall:T.P.stall,width:T.P.width}});
const chain=chainCases.map(([name,c,trim])=>{
  const f=Fl.of(c),s=chainState(f,trim),r=E.rest(s),a=T.of(s,r);
  return {name,flight:c,trim,wing_alpha_deg:round(f.alphaW/DEG,9),wing_stalled:round(f.wingStalled,12),lift_coefficient:round(f.cl,9),
    load_factor:round(f.n,9),downwash_deg:round(f.epsilon/DEG,9),pitch_share_deg:round(f.pitchShare/DEG,9),
    tail_alpha_deg:round(f.alphaT/DEG,9),reported_deg:round(f.reported/DEG,9),reversed:a.reversed,tail_pa:round(f.q,6),
    rest_deg:round(r/DEG,9),rest_counts:round(exact(r),6),effective_at_rest_deg:round(a.effective/DEG,9),
    force_lb:at.map(x=>round(E.lb(E.moments(s,angle(x)).net),9)),
    stalled_at:at.map(x=>round(T.of(s,angle(x)).stalled,12))};
});

// 3. The tail panels as X-Plane reports them (float32-exact values, so the C++
// side reads the same numbers): speed m/s, area m², angle deg, stall flag.
const pc=(speed,area,alphaDeg,stalled)=>({speed,area,alphaDeg,stalled});
const even=[...Array(18)].map((_,i)=>pc(40,0.125,2.5,0));
const panelCases=[
  ['even air, one angle',even],
  ['parked: no air, noisy angles and flags',[...Array(18)].map((_,i)=>pc(0,0.125,i%2?170:-160,i%3?1:0))],
  ['idle: half the panels under the gate',[...Array(18)].map((_,i)=>pc(i<9?1.5:3,0.125,i<9?-150:4,i<9?1:0))],
  ['outer panels faster and steeper',[...Array(18)].map((_,i)=>pc(30+(i%9),0.0625+0.0078125*(i%9),1+(i%9)*0.5,0))],
  ['half the tail stalled',[...Array(18)].map((_,i)=>pc(35,0.125,i<9?14:9,i<9?1:0))],
  ['a flag below 0.5 is not stalled',[...Array(18)].map((_,i)=>pc(35,0.125,8,i<9?0.25:0.75))],
  // Non-finite values (NaN, written as null): empty at or above the gate, ignored below it.
  ['no angle on a panel with air: empty',[...Array(18)].map((_,i)=>pc(35,0.125,i===4?NaN:8,0))],
  ['no stall flag on a panel with air: empty',[...Array(18)].map((_,i)=>pc(35,0.125,8,i===13?NaN:0))],
  ['no angle or flag on a panel under the gate: accepted',[...Array(18)].map((_,i)=>pc(i===4?1:35,0.125,i===4?NaN:8,i===4?NaN:0))],
  ['no speed on a panel: empty',[...Array(18)].map((_,i)=>pc(i===4?NaN:35,0.125,8,0))],
  // rho 1.25 and 2 m/s make exactly 2.5 Pa, which counts (>=).
  ['exactly at the gate: counted',[...Array(18)].map((_,i)=>pc(i<9?2:1.9375,0.125,i<9?6:-20,0)),1.25],
  // Air from behind astride ±180° at 39 Pa (8 m/s): the angles unwrap about
  // their circular mean, so all read near 180°, never the plain mean's 0°.
  ['from behind astride 180°: 18 at +179°, 0 at -179°',[...Array(18)].map(()=>pc(8,0.125,179,0))],
  ['from behind astride 180°: 10 at +179°, 8 at -179°',[...Array(18)].map((_,i)=>pc(8,0.125,i<10?179:-179,0))],
  ['from behind astride 180°: 9 at +179°, 9 at -179°',[...Array(18)].map((_,i)=>pc(8,0.125,i<9?179:-179,0))],
  ['from behind astride 180°: 0 at +179°, 18 at -179°',[...Array(18)].map(()=>pc(8,0.125,-179,0))],
  ['across the tail, one panel past 90°',[...Array(18)].map((_,i)=>pc(8,0.125,i===0?91:80,0))],
  ['no density: empty',even,0],
  ['a non-finite density: empty',even,NaN],
];
const panels=panelCases.map(([name,list,rho=1.225])=>{
  const r=T.panels(rho,list);
  return {name,rho,panels:list.map(p=>[p.speed,p.area,p.alphaDeg,p.stalled]),
    tail_pa:r&&round(r.q,9),alpha_deg:r&&round(r.alphaDeg,9),stalled:r&&round(r.stalled,12)};
});

// 4. What the cases must show.
// 2d. Sweeps across the air's direction (decision 17's air from behind, made
// continuous): the tail's angle in quarter degrees through ±90° (across the
// tail), ±30° (the clamp) and ±150° (wholly from behind), at 40 and 300 Pa,
// the page's figures, trim neutral, 1 g. Each step may move the rest, the
// force at half travel either way and the stiffness only a little: before,
// the deflection's moment turned over across a hair's width at ±90°, and at
// 40 Pa the force at half travel jumped some 5 lb.
const SWEEP_AT=[-6000,6000],SWEEP_STEP=0.25,SWEEP_REST=250,SWEEP_PER_PA=1/400;
const sweepRanges=[[80,100],[-80,-100],[20,40],[-20,-40],[140,160],[-140,-160]];
const sweeps=[40,300].flatMap(pa=>sweepRanges.map(([from,to])=>{
  const n=Math.round(Math.abs(to-from)/SWEEP_STEP),way=Math.sign(to-from),rest=[],stiffness=[],force=[];
  for (let i=0;i<=n;i++) {
    const s={q:pa,trim:E.trimFloat(0),g:1,unbalance:30,alpha:(from+way*i*SWEEP_STEP)*DEG,stalled:0,
      surface:{tau:SURF.tau,stall:SURF.stall*DEG,width:SURF.width*DEG}};
    rest.push(round(exact(E.rest(s)),6));stiffness.push(round(E.drive(s).stiffnessLbPerIn,9));
    force.push(SWEEP_AT.map(c=>round(E.lb(E.moments(s,angle(c)).net),9)));
  }
  return {tail_pa:pa,from_deg:from,to_deg:to,rest_counts:rest,stiffness_lb_per_in:stiffness,force_lb:force};
}));
for (const w of sweeps) {
  const most=w.tail_pa*SWEEP_PER_PA,at=i=>`${w.tail_pa} Pa, ${w.from_deg+Math.sign(w.to_deg-w.from_deg)*i*SWEEP_STEP}°`;
  for (let i=1;i<w.rest_counts.length;i++) {
    if (Math.abs(w.rest_counts[i]-w.rest_counts[i-1])>SWEEP_REST) fail(`the rest jumps at ${at(i)}`);
    if (Math.abs(w.stiffness_lb_per_in[i]-w.stiffness_lb_per_in[i-1])>most) fail(`the stiffness jumps at ${at(i)}`);
    for (let k=0;k<SWEEP_AT.length;k++) if (Math.abs(w.force_lb[i][k]-w.force_lb[i-1][k])>most) fail(`the force at ${SWEEP_AT[k]} jumps at ${at(i)}`);
  }
  if (Math.abs(w.from_deg)===80) {const mid=w.stiffness_lb_per_in[40];
    if (!(Math.abs(mid)<1e-9&&w.stiffness_lb_per_in[0]>0&&w.stiffness_lb_per_in.at(-1)<0)) fail(`the stiffness must pass through 0 at ±90° (${w.tail_pa} Pa)`);}
}
// 2e. Across the gate: air from behind (176°) as the pressure rises from 2
// to 6 Pa in 0.05 Pa steps. The turn's departure from 1 fades in from 2.5 to
// 5 Pa, so no step moves the force at half travel more than GATE_FORCE lb
// (it stepped about 1.4 lb at the stop before).
const GATE_STEP=0.05,GATE_FORCE=0.05;
const gate=(()=>{const rest=[],force=[];
  for (let i=0;i<=80;i++) {const s={q:2+i*GATE_STEP,trim:E.trimFloat(0),g:1,unbalance:30,alpha:176*DEG,stalled:0};
    rest.push(round(exact(E.rest(s)),6));force.push(SWEEP_AT.map(c=>round(E.lb(E.moments(s,angle(c)).net),9)));}
  return {alpha_deg:176,from_pa:2,step_pa:GATE_STEP,most_force_lb:GATE_FORCE,rest_counts:rest,force_lb:force};})();
for (let i=1;i<gate.force_lb.length;i++) for (let k=0;k<SWEEP_AT.length;k++)
  if (Math.abs(gate.force_lb[i][k]-gate.force_lb[i-1][k])>GATE_FORCE) fail(`air from behind steps in at ${(2+i*GATE_STEP).toFixed(2)} Pa`);
const pb=n=>panels.find(p=>p.name===n);
const by=n=>{const v=vectors.find(v=>v.name===n);if (!v) fail(`no case ${n}`);return v;};
const ch=n=>{const v=chain.find(v=>v.name===n);if (!v) fail(`no chain case ${n}`);return v;};
const rc=n=>by(n).rest_counts;
if (!(rc('cruise, tail at -2°')>rc('cruise, no angle'))) fail('a negative tail angle must move the rest forward');
if (!(rc('slow flight, tail at +3°')<rc('slow flight, no angle'))) fail('a positive tail angle must move the rest aft');
if (!(rc('negative Ch_alpha floats against the flow')>rc('large Ch_alpha'))) fail('a larger float slope must move the rest further aft');
const span=v=>v.force_lb[0]-v.force_lb[6];
if (!(span(by('tail fully stalled, factor 0.4'))<span(by('slow flight, no angle')))) fail('a stalled tail must centre less');
if (by('under the gate: parked, noise').alpha_used_deg!==0||by('under the gate: parked, noise').stalled_used!==0) fail('under the gate the angle and stall must say nothing');
if (by('clamped: 45° counts as 30°').alpha_used_deg!==30||by('clamped: -45° counts as -30°').alpha_used_deg!==-30) fail('the angle must be clamped to ±30°');
// Air from behind runs to a stop: the weight takes it forward; with no weight the float picks the side.
if (!by('reversed flow just past 90°: a stop').reversed||Math.abs(rc('reversed flow just past 90°: a stop'))<TRAVEL) fail('just past 90° the air is from behind and the elevator must rest at a stop');
for (const n of ['reversed flow, tailwind: the forward stop','reversed flow, the other side: the forward stop','reversed flow, no weight, the float tips it forward from nose-down trim: the forward stop'])
  if (!by(n).reversed||by(n).rest_counts<TRAVEL) fail(`${n}: air from behind must take the elevator to the forward stop`);
if (!(rc('reversed flow, no weight, the float tips it aft from nose-up trim: the aft stop')<=-TRAVEL)) fail('with no weight and the float aft, air from behind must take it to the aft stop');
if (Math.abs(by('reversed flow, tailwind: the forward stop').alpha_used_deg-1)>1e-9||Math.abs(by('reversed flow, the other side: the forward stop').alpha_used_deg+1)>1e-9) fail('179° from behind is 1° against the reversed stream, -179° is -1°');
{const v=by('reversed flow, tailwind: the forward stop'),d=v.force_lb;
  if (!(d[6]-d[0]>0)) fail('air from behind must push harder the further the elevator goes: the force must rise toward the forward stop');}
{const v=by('reversed flow, k_rev 0: weight and float alone'),d=v.force_lb;
  if (!(Math.abs(d[6]-d[0])<Math.abs(by('reversed flow, tailwind: the forward stop').force_lb[6]-by('reversed flow, tailwind: the forward stop').force_lb[0]))) fail('k_rev 0 must take the air off the deflection');}
if (by('90° is not reversed: clamped to 30°').reversed||by('90° is not reversed: clamped to 30°').alpha_used_deg!==30) fail('90° is not reversed');
if (by('air under the gate, a large angle and a stall').alpha_used_deg!==0||by('air under the gate, a large angle and a stall').stalled_used!==0||!(by('air under the gate, a large angle and a stall').tail_pa>0)) fail('under the gate, with some air, the angle and stall must say nothing');
if (by('exactly at the gate: counted').alpha_used_deg!==10||by('just under the gate: not counted').alpha_used_deg!==0) fail('the gate is 2.5 Pa or more');
// The tail's own stall along the travel.
{const v=by('surface: cruise, tail at -2°');if (!(v.stalled_at[0]>0&&v.stalled_at[3]===0)) fail('in cruise the tail must stall at the aft stop and not at neutral');
  if (!(span(v)<span(by('cruise, tail at -2°')))) fail('a tail stalled at the stops must centre less across the travel');}
{const v=by('surface: tail at +12°, stalls forward of neutral');if (!(v.stalled_at[6]>0&&v.stalled_at[0]===0)) fail('a tail at +12° must stall toward the forward stop, not the aft');}
if (!by('surface: a flag beats a smaller share').stalled_at.every(x=>x>=0.9)) fail('X-Plane\'s share stands when the surface stall is smaller');
if (by('surface: air from behind, no surface stall').stalled_at.some(x=>x!==0)||!by('surface: air from behind, no surface stall').reversed) fail('with air from behind the surface stall says nothing');
// The chain.
const close=(v,want,tol,what)=>{if (!(Math.abs(v-want)<=tol)) fail(`${what}: ${v}, want ${want} ± ${tol}`);};
close(ch('cruise').tail_alpha_deg,-2,0.25,'cruise\'s tail angle');
if (!(ch('2 g pull-up').tail_alpha_deg>0)) fail('a 2 g pull-up must put the tail\'s angle positive');
if (ch('slow flight').wing_stalled!==0||ch('cruise').wing_stalled!==0) fail('cruise and slow flight must not stall the wing');
for (const n of ['power-off stall','power-on stall','accelerated stall'])
  if (!(ch(n).wing_stalled>0&&ch(n).load_factor<ch(n).flight.n)) fail(`${n}: the wing must be past its break, the load factor short of the one asked`);
if (ch('accelerated, just short of the break').wing_stalled!==0) fail('1.9 g at 75 kt is just short of the break');
if (!(ch('power-off stall').tail_alpha_deg>ch('slow flight').tail_alpha_deg)) fail('the stall must raise the tail\'s angle');
if (!(ch('sudden full-aft pull in cruise').stalled_at[0]>0)) fail('a sudden full-aft pull in cruise must stall the tail at the aft stop');
if (!(ch('sudden full-aft pull in cruise').tail_alpha_deg>ch('cruise').tail_alpha_deg)) fail('the pitch rate must raise the tail\'s angle');
{const v=ch('tailwind taxi: 15 kt from behind at 5 kt');if (!v.reversed||v.rest_counts<TRAVEL) fail('a 15 kt tailwind taxi must rest at the forward stop with air from behind');}
if (ch('tailwind, full power: the wash wins').reversed) fail('full power\'s wash must beat a 15 kt tailwind');
close(Fl.of({kt:53,throttle:0,n:1}).alphaW/DEG,Fl.critical/DEG,1e-6,'the wing must reach its critical angle at the POH\'s 53 KCAS');
if (!(Fl.of({kt:53.2,throttle:0,n:1}).wingStalled===0&&Fl.of({kt:52.8,throttle:0,n:1}).wingStalled>0)) fail('the 1 g stall must come at 53 KCAS');
{const e=a=>2*Fl.P.downwash*Fl.lift(a)/(Math.PI*Fl.AR),slope=(e(6*DEG)-e(2*DEG))/(4*DEG);
  if (!(slope>=0.4&&slope<=0.45)) fail(`dε/dα ${slope} must be within 0.4..0.45`);}
for (const n of ['no angle on a panel with air: empty','no stall flag on a panel with air: empty','no speed on a panel: empty','no density: empty','a non-finite density: empty'])
  if (pb(n).tail_pa!==null) fail(`${n}: must be empty`);
if (pb('no angle or flag on a panel under the gate: accepted').alpha_deg!==8) fail('a non-finite value under the gate must be accepted');
if (pb('exactly at the gate: counted').alpha_deg!==6) fail('a panel at exactly 2.5 Pa counts, one under it does not');
if (!vectors.some(v=>v.rest_counts<=-TRAVEL)||!vectors.some(v=>v.rest_counts>=TRAVEL)) fail('the cases must rest at both stops');
if (pb('parked: no air, noisy angles and flags').alpha_deg!==0||pb('parked: no air, noisy angles and flags').stalled!==0) fail('panels with no air must say nothing');
if (pb('idle: half the panels under the gate').alpha_deg!==4) fail('a panel under the gate must not weigh in');
if (pb('half the tail stalled').stalled!==0.5) fail('half the q*area stalled is a share of 0.5');
for (const n of ['from behind astride 180°: 18 at +179°, 0 at -179°','from behind astride 180°: 10 at +179°, 8 at -179°','from behind astride 180°: 9 at +179°, 9 at -179°','from behind astride 180°: 0 at +179°, 18 at -179°'])
  if (!(Math.abs(pb(n).alpha_deg)>=178.99)) fail(`${n}: air from behind must read near 180°, not ${pb(n).alpha_deg}`);
if (Math.abs(pb('across the tail, one panel past 90°').alpha_deg-(91+17*80)/18)>1e-9) fail('panels just either side of 90° must average plainly');

// The rest reached from the yoke (the solver's): two balances keep each yoke
// to its own; air from behind keeps a yoke at a stop there.
const solAt=(v,x0)=>{const r=v.solutions.find(s=>s.x0===x0);if (!r) fail(`${v.name}: no solution at ${x0}`);return r;};
{const v=by('surface: two balances, each yoke keeps to its own');
  if (!(solAt(v,12000).rest_counts>=TRAVEL&&Math.abs(solAt(v,0).rest_counts)<TRAVEL&&solAt(v,-12000).rest_counts===solAt(v,0).rest_counts&&solAt(v,null).rest_counts===solAt(v,0).rest_counts))
    fail('with two balances a yoke at the forward stop must stay there, and one from neutral or aft must rest at the inner balance');
  if (Math.abs(solAt(v,12000).drive_force_lb-solAt(v,12000).force_lb)>0.01) fail('at the forward stop the drive must give the model\'s force');}
if (!by('surface: the inner balance gone, every yoke to the forward stop').solutions.every(s=>s.rest_counts>=TRAVEL)) fail('with the inner balance gone every yoke must rest at the forward stop');
{const a=by('reversed flow at 120°, trim neutral, 56.1 Pa'),b=by('reversed flow at 120°, trim neutral, 56.3 Pa');
  if (!(a.reversed&&b.reversed&&a.rest_counts>=TRAVEL&&b.rest_counts<=-TRAVEL)) fail('from trim the stop must flip between 56.1 and 56.3 Pa (the cases\' reason)');
  for (const x of [12000,-12000]) {
    if (solAt(a,x).rest_counts!==x||solAt(b,x).rest_counts!==x) fail(`air from behind: a yoke at ${x} must rest at that stop at both pressures`);
    for (const v of [a,b]) if (Math.abs(solAt(v,x).drive_force_lb-solAt(v,x).force_lb)>0.01) fail(`${v.name}: the drive's force at ${x} must be the model's`);
    if (Math.sign(solAt(a,x).drive_force_lb)!==Math.sign(solAt(b,x).drive_force_lb)) fail(`air from behind: the drive's force at ${x} must not flip between 56.1 and 56.3 Pa`);}}

const inside=by('no centring, float and weight cancel inside').rest_counts;
if (!(rc('no centring, float against weight: a stop')>=TRAVEL&&rc('no centring, float beats weight: the other stop')<=-TRAVEL&&Math.abs(inside)<TRAVEL)) fail('with no centring the float and the weight must reach both stops and a rest between');
const text=JSON.stringify({
  about:'Generated by elevator_alpha_vectors.mjs from elevator.html\'s model (Flight, TailAir and Elevator); checked by it and, in C++, by workbench_tests.cpp (elevator.hpp, and flight.hpp\'s tail_side for the panels). Do not edit by hand.',
  units:{alpha_deg:'the tail\'s angle as X-Plane reports it, degrees, air from below positive; taken to exclude the elevator\'s own deflection',
    stalled:'the stalled share of the tail\'s q*area, 0..1',alpha_slope_per_rad:'Ch_alpha, the float slope; positive floats the trailing edge up with a positive angle',
    stall_factor:'the share of the air\'s moments a stalled tail keeps',hinge_slope_per_rad:'Ch_delta: the figures\' value except where a case sets it',tail_pa:'Pa',alpha_used_deg:'after the 2.5 Pa gate and the ±30° clamp',
    stalled_used:'after the gate, at neutral',kept:'1 - (1 - stall_factor)*stalled_used',
    reversed:'air from behind, beyond ±90° with air over the gate: the deflection\'s moment turns over (k_rev of it), so the elevator runs to a stop; alpha_used_deg is the angle against the reversed stream',
    k_rev:'the share of the deflection\'s moment that turns over with air from behind',
    surface:'the page\'s tail stall along the travel, {tau, stall deg, width deg}: stalled share ramps from 0 to 1 as |angle + tau*deflection| passes stall over width; null: only X-Plane\'s share',
    stalled_at:'the stalled share at each of force_at_counts',
    solutions:'the page\'s solve at x0 drive counts (null: from trim, at the rest), 222 units per lb, the case\'s pressure as written: the rest reached from x0 (counts), the stiffness at that rest (lb per inch of yoke), the drive\'s ceiling, strength, centre and bias, the model\'s and the drive\'s force at x0 (lb forward positive), the model\'s secant and the flags',
    float_lb:'the float at the grip, lb forward positive',rest_deg:'the elevator at the model\'s rest, trailing edge down positive',
    rest_counts:'the rest in drive counts, 12000 at either stop, forward positive, unrounded',
    force_lb:'the model at the counts in force_at_counts, lb forward positive',
    chain:'the page\'s flight chain: flight {kt, throttle, n asked, ground, pitchRate deg/s beyond a steady pull, tailwind kt}; the model\'s state is the reached load factor, the reported angle, unbalance 30 in·lb, the default figures and the surface stall',
    panels:'[speed m/s, area m², angle deg, stall flag] per element of wings 8 and 9, tips excluded; null is a non-finite value; a case\'s tail_pa, alpha_deg and stalled are null when the read is empty',
    sweeps:'the tail\'s angle from from_deg to to_deg in sweep.step_deg steps at tail_pa, the page\'s figures and surface stall, trim neutral, 1 g, unbalance 30 in·lb: the rest (counts), the stiffness at the rest and the force at sweep.at_counts at each step; no step may move the rest more than sweep.rest_counts nor the stiffness or a force more than sweep.per_pa times tail_pa'},
  figures:{...base.figures,alpha_slope_per_rad:T.P.cha,stall_factor:T.P.keep},
  constants:{minimum_panel_pa:T.P.minPa,alpha_clamp_deg:round(T.P.alphaClamp/DEG,9),k_rev:T.P.kRev,surface:SURF,
    wing:{aspect_ratio:round(Fl.AR,9),lift_slope_per_rad:round(Fl.slope,9),cl_max:round(Fl.clMax,9),critical_deg:round(Fl.critical/DEG,9)}},
  force_at_counts:at,vectors,chain,panels,
  sweep:{step_deg:SWEEP_STEP,at_counts:SWEEP_AT,rest_counts:SWEEP_REST,per_pa:SWEEP_PER_PA},sweeps,gate},null,1)+'\n';
const file=join(here,'elevator_alpha_vectors.json');
if (process.argv.includes('--write')) {writeFileSync(file,text);console.log(`wrote ${vectors.length} vectors, ${chain.length} chain cases, ${panels.length} panel cases and ${sweeps.length} sweeps`);}
else if (readFileSync(file,'utf8')!==text) fail('elevator_alpha_vectors.json does not match elevator.html\'s model; run node elevator_alpha_vectors.mjs --write');
else console.log(`elevator_alpha_vectors.json matches elevator.html's model (${vectors.length} vectors, ${chain.length} chain cases, ${panels.length} panel cases, ${sweeps.length} sweeps with no step past their bounds); with no angle and no stall all ${base.vectors.length} of elevator_vectors.json's cases are unchanged (${compared} solutions compared)`);
