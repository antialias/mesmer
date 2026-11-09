// The elevator model's shared test vectors (decision 15). The model and its
// solver live in elevator.html's <script id="model">; the plugin's copy is
// elevator.hpp's solve_pitch, which workbench_tests.cpp checks against the
// same file: the model's outputs per case, and the drive's registers for the
// yoke at x0 (null: at the model's rest).
// The feel page, workbench.html, and the stall simulator, stall.html, carry
// identical copies of the block, and so does the website's live demo
// (public/site/www/js/elevator-model.js); this checks them.
//   node elevator_vectors.mjs          check elevator_vectors.json against the page
//   node elevator_vectors.mjs --write  regenerate it after changing the model
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';

const here=dirname(fileURLToPath(import.meta.url));
const page=readFileSync(join(here,'elevator.html'),'utf8');
const found=page.match(/<script id="model">([\s\S]*?)<\/script>/);
if (!found) throw new Error('elevator.html has no <script id="model">');
const E=new Function(`${found[1]}\nreturn Elevator;`)();

// The feel page carries the same model block (CMakeLists.txt embeds workbench.html
// into the plugin, so it can't load elevator.html), and so does the stall
// simulator (it loads from file://, so it can't fetch it). Each must be identical.
for (const name of ['workbench.html','stall.html']) {
  const copy=readFileSync(join(here,name),'utf8').match(/<script id="model">([\s\S]*?)<\/script>/);
  if (!copy) {console.error(`${name} has no <script id="model">`);process.exit(1);}
  if (copy[1]!==found[1]) {
    const a=found[1].split('\n'),b=copy[1].split('\n');let i=0;while (i<a.length && a[i]===b[i]) i++;
    console.error(`${name}'s model differs from elevator.html's at model line ${i+1}:\n  elevator.html:  ${a[i]??'(end)'}\n  ${name}: ${b[i]??'(end)'}\nCopy elevator.html's <script id="model"> block into ${name}.`);
    process.exit(1);
  }
}
// mesmer.haunt.house's live demo runs the same block as a plain script,
// public/site/www/js/elevator-model.js, byte for byte. The site stays in
// flightsim (the public manifest leaves it out), so where public/site is
// absent there is nothing to check.
if (existsSync(join(here,'public','site'))) {
  const site=join(here,'public','site','www','js','elevator-model.js');
  const copy=existsSync(site)?readFileSync(site,'utf8'):null;
  if (copy!==found[1]) {
    const a=found[1].split('\n'),b=(copy??'').split('\n');let i=0;while (i<a.length && a[i]===b[i]) i++;
    console.error(copy===null?`${site} is missing.`:`the site's elevator-model.js differs from elevator.html's model at model line ${i+1}:\n  elevator.html:     ${a[i]??'(end)'}\n  elevator-model.js: ${b[i]??'(end)'}`);
    console.error('Write elevator.html\'s <script id="model"> block, exactly, to public/site/www/js/elevator-model.js.');
    process.exit(1);
  }
}

// The page's presets, plus the ends of trim, load factor and unbalance.
// trim and throttle as the page's model takes them: -1..1 and 0..1.
const cases=[
  ['parked, engine off',0,0,0,1,30],
  ['idle',0,0.15,0,1,30],
  ['full power, brakes on',0,1,0,1,30],
  ['takeoff roll',40,1,0,1,30],
  ['cruise',110,0.75,0.15,1,30],
  ['2 g pull-up',100,0.75,0.15,2,30],
  ['lift-off from the forward stop',14,0,0,1,30],
  ['taxi, full nose-up trim',20,0.3,1,1,30],
  ['approach, full nose-down trim',65,0.2,-1,1,30],
  ['cruise, no weight',110,0.75,0.15,1,0],
  ['cruise, heaviest elevator',110,0.75,0.15,1,43],
  ['negative g',90,0.5,0,-1,30],
  ['parked, no weight, nose-up trim',0,0,0.5,1,0],
  ['parked, weight aft of the hinge',0,0,0,1,-15],
  ['parked, heaviest unbalance',0,0,0,1,200],
  // Held at the forward stop by a constant force with air enough to want
  // more than 100 %: the strength stays where the firmware keeps the
  // constant force (0x211f's cut-off).
  ['taxi, full nose-down trim',15,0.1,-1,1,30],
];
const round=(v,places)=>Number(v.toFixed(places));
// The yoke's positions and the drive's knobs each case is solved at:
// [x0, units per lb]; the strength is held to the drive's ceiling (decision
// 16). The last asks more constant force than the drive's 2250 units
// wherever the rest is at a stop.
const solves=[[null,222],[-12000,222],[-3000,222],[0,222],[3000,222],[12000,222],
  [-3000,444],[3000,1000]];
const P=E.P,DEG=E.DEG;
// The page's figures under the profile's keys; the weight moment is each case's.
const figures={area_m2:P.area,chord_m:P.chord,hinge_slope_per_rad:P.slope,up_deg:round(P.up/DEG,9),down_deg:round(P.down/DEG,9),
  gearing_rad_per_in:P.gearing,tab_ratio:P.tabRatio,tab_up_deg:round(P.tabUp/DEG,9),tab_down_deg:round(P.tabDown/DEG,9),
  inertia_kgm2:P.inertia,wash_mps:P.wash,damping_ratio:P.zeta};
const vectors=cases.map(([name,kt,throttle,trim,g,unbalance])=>{
  const q=E.tailQ(kt,throttle);
  const s={q,trim:E.trimFloat(trim),g,unbalance};
  const d=E.drive(s);
  const solutions=solves.map(([x0,units])=>{
    const r=E.solve(s,x0===null?NaN:x0,units);
    return {x0,units_per_lb:units,ceiling:r.ceiling,strength:r.strength,centre:r.centre,bias:r.bias,
      force_lb:round(r.forceLb,6),drive_force_lb:round(r.driveForceLb,6),slope_lb_per_count:round(r.slopeLbPerCount,9),
      saturated:r.saturated,floored:r.floored,bias_limited:r.biasLimited};
  });
  return {name,kt,throttle,trim,g,unbalance,tail_pa:round(q,6),
    weight_lb:round(d.weightLb,6),centre_counts:d.centreCounts,stiffness_lb_per_in:round(d.stiffnessLbPerIn,6),rest_counts:d.restCounts,solutions};
});
const text=JSON.stringify({
  about:'Generated by elevator_vectors.mjs from elevator.html\'s model; checked by it and by workbench_tests.cpp. Do not edit by hand.',
  units:{tail_pa:'Pa',weight_lb:'lb at the grip, forward positive',centre_counts:'drive counts, 12000 at either stop, forward positive',
    stiffness_lb_per_in:'lb per inch of yoke',rest_counts:'drive counts',x0:'the yoke, drive counts forward positive; null at the model\'s rest',
    ceiling:'the drive\'s ceiling, percent: the strongest spring within its margin',strength:'0x2114, percent',centre:'0x2116, counts forward positive',bias:'0x211a, drive units, negative forward',
    force_lb:'the model at x0, lb forward positive',drive_force_lb:'the drive\'s line at x0, lb forward positive',
    slope_lb_per_count:'the model\'s secant from its rest to x0'},
  figures,vectors},null,1)+'\n';
// The cases must reach both ends the solver handles specially.
const flat=vectors.flatMap(v=>v.solutions);
if (!vectors.some(v=>v.rest_counts<=-12000) || !vectors.some(v=>v.rest_counts>=12000)) {console.error('the cases must rest at both stops');process.exit(1);}
if (!flat.some(r=>r.bias_limited && r.units_per_lb===222) || !flat.some(r=>!r.bias_limited)) {console.error('the cases must reach the drive\'s constant-force limit at the default units');process.exit(1);}
if (!flat.some(r=>r.saturated) || !flat.some(r=>r.ceiling<400)) {console.error('the cases must reach the drive\'s ceiling, and a ceiling below its strongest');process.exit(1);}
const file=join(here,'elevator_vectors.json');
if (process.argv.includes('--write')) {writeFileSync(file,text);console.log(`wrote ${vectors.length} vectors`);}
else if (readFileSync(file,'utf8')!==text) {
  console.error('elevator_vectors.json does not match elevator.html\'s model; run node elevator_vectors.mjs --write and check the C++ side');
  process.exit(1);
} else console.log(`elevator_vectors.json matches elevator.html's model (${vectors.length} vectors); workbench.html, stall.html and the site carry the same model`);
