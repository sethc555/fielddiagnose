// fieldapp engine tests — manual readings -> diagnosis, offline, no CoolProp. Run: node test_engine.js
const assert = require('assert');
const { diagnose, wetBulbF, targetSuperheatFixed, psychro } = require('./engine.js');
const pt = require('./refrigerant_pt.json');

// 1) R-410A TXV undercharge from analog gauges + thermometer
let r = diagnose({ refrigerant: 'R-410A', metering: 'txv', suction_psig: 110, suction_line_f: 60,
                   head_psig: 400, liquid_line_f: 110, oat_f: 90 }, pt);
console.log(`case 1 (R-410A TXV): SST ${r.SST}°F  SCT ${r.SCT}°F  superheat ${r.superheat}°F  subcool ${r.subcool}°F`);
r.findings.forEach(f => console.log(`   [${f.severity}] ${f.summary} — ${f.detail || ''}`));
assert(r.superheat > 15 && r.subcool < 9, 'plausible SH/SC from the PT table');
assert(r.findings.some(f => f.summary === 'Undercharge'), 'should flag undercharge');

// 2) multimeter only (no gauges): high amps + a failed run capacitor
r = diagnose({ amps: 24, rla: 18, cap_uf: 30, cap_rated_uf: 45 }, pt);
console.log('case 2 (multimeter only):');
r.findings.forEach(f => console.log(`   [${f.severity}] ${f.summary} — ${f.detail || ''}`));
assert(r.findings.some(f => f.summary === 'High current draw'), 'high amps');
assert(r.findings.some(f => f.summary === 'Capacitor failed'), 'weak cap');
assert(r.findings.find(f => f.summary === 'Capacitor failed').guide === 'capacitor-test', 'cap finding links its guide');

// 3) a healthy unit -> no fault
r = diagnose({ refrigerant: 'R-410A', metering: 'txv', suction_psig: 120, suction_line_f: 53,
               head_psig: 365, liquid_line_f: 100, oat_f: 95, amps: 14, rla: 18 }, pt);
console.log(`case 3 (healthy): superheat ${r.superheat}°F  subcool ${r.subcool}°F`);
assert(!r.findings.some(f => f.severity === 'alarm' || f.summary.startsWith('Under') || f.summary.startsWith('Over')), 'healthy = no charge fault');

// 4) Delta-T (airflow) + an expanded refrigerant (R-404A) + target/difference shown
r = diagnose({ refrigerant: 'R-404A', metering: 'txv', suction_psig: 60, suction_line_f: 35,
               head_psig: 250, liquid_line_f: 80, return_air_f: 70, supply_air_f: 62 }, pt);
console.log('case 4 (R-404A + Delta-T):');
r.findings.forEach(f => console.log(`   [${f.severity}] ${f.summary} — ${f.detail || ''}`));
assert(r.SST != null, 'R-404A resolves from the expanded table');
assert(r.findings.some(f => f.summary.startsWith('Delta-T')), 'delta-T computed');
assert(r.findings.some(f => f.summary.startsWith('Superheat') && /target/.test(f.detail)), 'target shown in detail');
assert(Object.keys(pt.refrigerants).length >= 20, 'expanded refrigerant set (>=20)');

// 5) fixed-orifice target superheat computed from conditions (indoor WB + outdoor DB)
assert(Math.abs(wetBulbF(80, 50) - 67) < 2, 'wet-bulb ~67°F at 80°F / 50% RH');
assert(targetSuperheatFixed(63, 95) === 7, 'chart target SH (3·63−80−95)/2 = 7');
r = diagnose({ refrigerant: 'R-410A', metering: 'fixed_orifice', suction_psig: 118, suction_line_f: 67,
               oat_f: 95, indoor_wb_f: 63 }, pt);
console.log('case 5 (fixed-orifice chart target):');
r.findings.forEach(f => console.log(`   [${f.severity}] ${f.summary} — ${f.detail || ''}`));
const sh5 = r.findings.find(f => f.summary.startsWith('Superheat'));
assert(sh5 && /chart/.test(sh5.detail), 'target superheat from chart shown in the superheat finding');
assert(r.findings.some(f => f.summary === 'Undercharge'), 'high superheat vs 7°F chart target → undercharge');

// 6) RH path: indoor WB derived from return-air DB + RH when WB not entered directly
r = diagnose({ refrigerant: 'R-410A', metering: 'fixed_orifice', suction_psig: 118, suction_line_f: 50,
               oat_f: 90, return_air_f: 80, indoor_rh: 50 }, pt);
assert(r.findings.some(f => f.summary.startsWith('Indoor wet-bulb')), 'indoor WB derived from return DB + RH');

// 7) psychrometrics + air-side capacity + health score
const p = psychro(80, 67);
assert(p && Math.abs(p.h - 31.4) < 1.5, `enthalpy ~31.4 BTU/lb at 80/67 (got ${p && p.h})`);
assert(Math.abs(p.rh - 51) < 6, `RH ~51% at 80DB/67WB (got ${p && p.rh})`);
r = diagnose({ return_air_f: 80, indoor_rh: 50, supply_air_f: 60, supply_rh: 90, cfm: 1200, tons: 3 }, pt);
console.log('case 7 (capacity + score):');
r.findings.forEach(f => console.log(`   [${f.severity}] ${f.summary} — ${f.detail || ''}`));
assert(r.findings.some(f => f.summary.startsWith('Sensible capacity')), 'sensible capacity computed');
assert(r.findings.some(f => f.summary.startsWith('Total capacity')), 'total capacity computed');
assert(r.score != null && r.score >= 0 && r.score <= 100, `health score present (got ${r.score})`);

// 8) score drops with faults: undercharge (alarm) should pull the score below 100
r = diagnose({ refrigerant: 'R-410A', metering: 'txv', suction_psig: 110, suction_line_f: 60,
               head_psig: 400, liquid_line_f: 110, oat_f: 90 }, pt);
assert(r.score != null && r.score < 100, `faults lower the score (got ${r.score})`);

console.log('OK — fieldapp engine tests pass');
