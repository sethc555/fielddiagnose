// fieldapp engine — manifold's field diagnostics, ported dependency-free.
// Inputs are what a tech reads off ANALOG GAUGES (pressures) + a line thermometer + a MULTIMETER
// (amps, volts, capacitor µF) + the nameplate. Refrigerant physics comes from refrigerant_pt.json
// (manifold/CoolProp, precomputed) so the phone needs no CoolProp. Pure functions, no DOM — the
// browser UI and the node test both call diagnose(). Thresholds mirror manifold (target SH/SC 10°F,
// amp RLA bands 1.10/1.20/0.55, condenser split 35/45); charge bands are the standard ±3°F field
// rule (reconcile with manifold's DiagnosticTree for exact parity — see README).

function _interp(rows, psig, idx) {        // rows: [[psig, bubbleF, dewF], …] sorted; idx 1=bubble 2=dew
  if (!rows || !rows.length) return null;
  if (psig <= rows[0][0]) return rows[0][idx];
  if (psig >= rows[rows.length - 1][0]) return rows[rows.length - 1][idx];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] >= psig) {
      const a = rows[i - 1], b = rows[i], f = (psig - a[0]) / (b[0] - a[0]);
      return Math.round((a[idx] + f * (b[idx] - a[idx])) * 10) / 10;
    }
  }
  return null;
}

function satFromP(pt, refrigerant, psig, point) {   // point: 'dew' (superheat) | 'bubble' (subcool)
  return _interp((pt.refrigerants || {})[refrigerant], +psig, point === 'bubble' ? 1 : 2);
}

const _num = v => (v === '' || v == null || isNaN(+v)) ? null : +v;

// psychrometrics — wet-bulb (°F) from dry-bulb (°F) + RH (%), Stull (2011) approximation.
function wetBulbF(dbF, rh) {
  if (dbF == null || rh == null || rh <= 0 || rh > 100) return null;
  const T = (dbF - 32) * 5 / 9;
  const wb = T * Math.atan(0.151977 * Math.sqrt(rh + 8.313659)) + Math.atan(T + rh)
    - Math.atan(rh - 1.676331) + 0.00391838 * Math.pow(rh, 1.5) * Math.atan(0.023101 * rh) - 4.686035;
  return Math.round((wb * 9 / 5 + 32) * 10) / 10;
}
// field charging-chart approximation: target superheat for a fixed-orifice / cap-tube system
// from indoor return-air wet-bulb + outdoor dry-bulb (both °F).
function targetSuperheatFixed(wbF, odbF) {
  return (wbF == null || odbF == null) ? null : (3 * wbF - 80 - odbF) / 2;
}

// saturation vapor pressure over water (psia) from temperature °F — Arden Buck equation.
function _pws(tF) {
  const Tc = (tF - 32) * 5 / 9;
  const kPa = 0.61121 * Math.exp((18.678 - Tc / 234.5) * (Tc / (257.14 + Tc)));
  return kPa * 0.145038;
}
// moist-air properties from dry-bulb + wet-bulb (°F), IP units (ASHRAE): humidity ratio W (lb/lb),
// enthalpy h (BTU/lb dry air), RH (%), grains (gr/lb). Used for delivered-capacity (Δh) calcs.
function psychro(dbF, wbF) {
  if (dbF == null || wbF == null || wbF > dbF + 0.5) return null;
  const Pws_wb = _pws(wbF);
  const Ws = 0.621945 * Pws_wb / (14.696 - Pws_wb);
  const W = Math.max(0, ((1093 - 0.556 * wbF) * Ws - 0.240 * (dbF - wbF)) / (1093 + 0.444 * dbF - wbF));
  const h = 0.240 * dbF + W * (1061 + 0.444 * dbF);
  const Pw = 14.696 * W / (0.621945 + W);
  const rh = Math.max(0, Math.min(100, 100 * Pw / _pws(dbF)));
  return { W, h: Math.round(h * 100) / 100, rh: Math.round(rh), grains: Math.round(W * 7000) };
}

function diagnose(r, pt) {
  const F = [];
  let tSH = _num(r.target_superheat) ?? 10;            // may be replaced by the charging-chart calc below
  const tSC = _num(r.target_subcool) ?? 10, BAND = 3;
  const oat = _num(r.oat_f);
  const metering = (r.metering || '').toLowerCase();
  const bySuperheat = metering === 'fixed_orifice' || metering === 'capillary';
  let SST = null, SCT = null, superheat = null, subcool = null;

  // --- charge: analog gauge pressure -> saturation (the PT table) vs the line thermometer ---
  const suctionP = _num(r.suction_psig), headP = _num(r.head_psig);
  const suctionT = _num(r.suction_line_f), liquidT = _num(r.liquid_line_f);
  if (r.refrigerant && suctionP != null) {
    SST = satFromP(pt, r.refrigerant, suctionP, 'dew');
    if (SST != null && suctionT != null) superheat = Math.round((suctionT - SST) * 10) / 10;
  }
  if (r.refrigerant && headP != null) {
    SCT = satFromP(pt, r.refrigerant, headP, 'bubble');
    if (SCT != null && liquidT != null) subcool = Math.round((SCT - liquidT) * 10) / 10;
  }

  // For a fixed-orifice / cap-tube system there is no single target superheat — it comes from the
  // conditions: indoor return-air wet-bulb + outdoor dry-bulb (the field charging-chart formula).
  // Wet-bulb is used directly if measured, else derived from return-air DB + indoor RH.
  const indoorWB = _num(r.indoor_wb_f) ?? wetBulbF(_num(r.return_air_f), _num(r.indoor_rh));
  let tSHfromChart = false;
  if (bySuperheat && indoorWB != null && oat != null) {
    const t = targetSuperheatFixed(indoorWB, oat);
    if (t != null) {
      tSH = Math.round(t * 10) / 10; tSHfromChart = true;
      if (t < 5) F.push({ severity: 'warn', summary: 'Marginal charging conditions', detail: `chart target superheat ${tSH}°F (<5°F)`, advice: 'Indoor too dry / outdoor too hot for accurate superheat charging — verify by weighing the charge.' });
    }
  }
  if (indoorWB != null) F.push({ severity: 'info', summary: `Indoor wet-bulb ${indoorWB}°F`, detail: _num(r.indoor_wb_f) != null ? 'measured' : `from return ${_num(r.return_air_f)}°F + ${_num(r.indoor_rh)}% RH` });

  const diff = (v, t) => { const d = Math.round((v - t) * 10) / 10; return `${d >= 0 ? '+' : ''}${d}°F`; };
  if (superheat != null) F.push({ severity: 'info', summary: `Superheat ${superheat}°F`, detail: `target ${tSH}°F${tSHfromChart ? ' (chart)' : ''} · ${diff(superheat, tSH)} · SST ${SST}°F` });
  if (subcool != null) F.push({ severity: 'info', summary: `Subcool ${subcool}°F`, detail: `target ${tSC}°F · ${diff(subcool, tSC)} · SCT ${SCT}°F` });
  if (bySuperheat && superheat != null && !tSHfromChart)
    F.push({ severity: 'info', summary: 'Add conditions for a real target superheat', detail: 'fixed-orifice target = f(indoor wet-bulb, outdoor temp)', advice: 'Enter Indoor WB (or RH) + Outdoor air — or tap “Use local weather” — and the target snaps to the chart.' });

  const charge = (summary, detail, advice) => F.push({ severity: 'alarm', summary, detail, advice });
  if (bySuperheat && superheat != null) {
    if (superheat > tSH + BAND) charge('Undercharge', `superheat ${superheat}°F well above ${tSH}°F target${tSHfromChart ? ' (chart)' : ''}`, 'Low refrigerant or a restriction — leak-check, then weigh in to the chart.');
    else if (superheat < tSH - BAND) charge('Overcharge', `superheat ${superheat}°F below ${tSH}°F target${tSHfromChart ? ' (chart)' : ''}`, 'Overcharge or low evaporator airflow — recover to the chart value; check airflow.');
  } else if (!bySuperheat && subcool != null) {
    if (subcool < tSC - BAND) charge('Undercharge', `subcool ${subcool}°F below ${tSC}°F target` + (superheat != null && superheat > tSH + BAND ? ' (high superheat confirms)' : ''), 'Low refrigerant or a liquid-line restriction — leak-check, then weigh in.');
    else if (subcool > tSC + BAND) charge('Overcharge', `subcool ${subcool}°F above ${tSC}°F target`, 'Too much liquid backing up the condenser — recover to target subcool.');
  }

  // --- condenser split: SCT − outdoor temp ---
  if (SCT != null && oat != null) {
    const split = Math.round((SCT - oat) * 10) / 10;
    if (split >= 45) F.push({ severity: 'alarm', summary: 'High condenser split', detail: `SCT−OAT ${split}°F (≥45)`, advice: 'Dirty coil, low condenser airflow, overcharge, or non-condensables. Cross-check subcool.' });
    else if (split >= 35) F.push({ severity: 'warn', summary: 'High condenser split', detail: `SCT−OAT ${split}°F (≥35)`, advice: 'Likely a dirty condenser coil or low airflow — clean it and check the fan.' });
  }

  // --- Delta-T: return − supply air across the evaporator (airflow / load screen) ---
  const ra = _num(r.return_air_f), sa = _num(r.supply_air_f);
  if (ra != null && sa != null) {
    const dt = Math.round((ra - sa) * 10) / 10;
    let sev = 'info', advice;
    if (dt < 14) { sev = 'warn'; advice = 'Low ΔT — low airflow (dirty filter / coil / blower) or low charge. Cross-check superheat & subcool.'; }
    else if (dt > 23) { sev = 'warn'; advice = 'High ΔT — restricted airflow or a low indoor load. With normal charge, suspect airflow.'; }
    F.push({ severity: sev, summary: `Delta-T ${dt}°F`, detail: 'return − supply air (normal ~14–23°F)', advice });
  }

  // --- air-side delivered capacity (psychrometrics): return + supply enthalpy × airflow ---
  const supWB = _num(r.supply_wb_f) ?? wetBulbF(sa, _num(r.supply_rh));
  const tons = _num(r.tons);
  let cfm = _num(r.cfm), cfmEst = false;
  if (cfm == null && tons != null) { cfm = tons * 400; cfmEst = true; }   // nominal 400 CFM/ton
  const psyR = (ra != null && indoorWB != null) ? psychro(ra, indoorWB) : null;
  const psyS = (sa != null && supWB != null) ? psychro(sa, supWB) : null;
  if (psyR) F.push({ severity: 'info', summary: `Return air ${psyR.h} BTU/lb`, detail: `${ra}°F DB / ${indoorWB}°F WB · ${psyR.rh}% RH · ${psyR.grains} gr` });
  if (psyS) F.push({ severity: 'info', summary: `Supply air ${psyS.h} BTU/lb`, detail: `${sa}°F DB / ${supWB}°F WB · ${psyS.rh}% RH · ${psyS.grains} gr` });
  if (cfm != null && ra != null && sa != null && ra > sa) {
    const sensible = 1.08 * cfm * (ra - sa);
    F.push({ severity: 'info', summary: `Sensible capacity ${Math.round(sensible).toLocaleString()} BTU/h`, detail: `1.08 × ${Math.round(cfm)} CFM${cfmEst ? ' (est 400/ton)' : ''} × ${Math.round((ra - sa) * 10) / 10}°F` });
    if (psyR && psyS && psyR.h > psyS.h) {
      const total = 4.5 * cfm * (psyR.h - psyS.h);
      const latent = Math.max(0, total - sensible);
      const shr = total > 0 ? sensible / total : null;
      F.push({ severity: 'info', summary: `Total capacity ${Math.round(total).toLocaleString()} BTU/h`, detail: `Δh ${Math.round((psyR.h - psyS.h) * 100) / 100} · latent ${Math.round(latent).toLocaleString()} · SHR ${shr ? shr.toFixed(2) : '—'}` });
      if (tons != null && tons > 0) {
        const pct = Math.round(total / (tons * 12000) * 100);
        F.push({ severity: pct < 70 ? 'warn' : 'info', summary: `Delivering ${pct}% of nominal`, detail: `${(total / 12000).toFixed(2)} of ${tons} ton (${cfmEst ? 'est CFM' : 'measured CFM'})`, advice: pct < 70 ? 'Delivered capacity well below nominal — suspect airflow, charge, or a fouled coil.' : undefined });
      }
    }
  }

  // --- amps vs nameplate RLA/LRA (multimeter clamp) ---
  const amps = _num(r.amps), rla = _num(r.rla), lra = _num(r.lra);
  if (amps != null) {
    if (lra != null && amps >= lra * 0.85) F.push({ severity: 'alarm', summary: 'Locked-rotor risk', detail: `${amps}A near LRA ${lra}A`, advice: 'Seized bearing, stalled rotor, or a start-cap/contactor fault — kill power and inspect before burnout.', guide: 'compressor-wont-start' });
    else if (rla != null && rla > 0) {
      if (amps >= rla * 1.10) F.push({ severity: amps >= rla * 1.20 ? 'alarm' : 'warn', summary: 'High current draw', detail: `${amps}A vs RLA ${rla}A (+${Math.round((amps / rla - 1) * 100)}%)`, advice: 'High head (dirty coil/airflow loss), a failing bearing/motor, or low voltage. Cross-check the condenser split.', guide: 'breaker-tripping' });
      else if (amps <= rla * 0.55) F.push({ severity: 'warn', summary: 'Low current draw', detail: `${amps}A vs RLA ${rla}A (${Math.round(amps / rla * 100)}%)`, advice: 'Unloaded — lost charge, a slipping belt, or no flow. Cross-check superheat/subcool.' });
    }
  }

  // --- run capacitor µF vs rating (multimeter) ---
  const uf = _num(r.cap_uf), ufRated = _num(r.cap_rated_uf);
  if (uf != null && ufRated != null && ufRated > 0) {
    const pct = uf / ufRated;
    if (pct < 0.70) F.push({ severity: 'alarm', summary: 'Capacitor failed', detail: `${uf}µF vs rated ${ufRated}µF (${Math.round(pct * 100)}%)`, advice: 'Run capacitor well below rating — replace it (one of the most common no-cool causes).', guide: 'capacitor-test' });
    else if (pct < 0.90 || pct > 1.10) F.push({ severity: 'warn', summary: 'Capacitor weak', detail: `${uf}µF vs rated ${ufRated}µF (${Math.round(pct * 100)}%)`, advice: 'Run capacitor outside ±10% of rating — plan to replace.', guide: 'capacitor-test' });
  }

  if (!F.some(f => f.severity !== 'info')) F.push({ severity: 'info', summary: 'No fault flagged', detail: 'Readings sit within bands. (Enter more readings for a fuller picture.)' });

  // system health score: 100 minus a penalty per flagged finding (alarm 25, warn 10). null when
  // there's nothing but the placeholder, so we don't show a misleading "100" with no readings.
  const real = F.filter(f => f.summary !== 'No fault flagged');
  let score = null, band = null;
  if (real.length) {
    score = Math.max(0, 100 - real.reduce((s, f) => s + (f.severity === 'alarm' ? 25 : f.severity === 'warn' ? 10 : 0), 0));
    band = score >= 85 ? 'good' : score >= 60 ? 'fair' : 'poor';
  }
  return { SST, SCT, superheat, subcool, score, band, findings: F };
}

if (typeof module !== 'undefined') module.exports = { diagnose, satFromP, wetBulbF, targetSuperheatFixed, psychro };
