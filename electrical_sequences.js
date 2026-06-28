// Electrical troubleshooting read-sequences — the common HVAC faults, as guided multimeter steps.
// Data-driven (like the P-T table): each step is measure -> meter setting -> expect -> if-fail. The
// UI renders them; the same shape can drive an interactive pass/fail wizard later. Reference for
// QUALIFIED techs — not a substitute for training. Sourced from standard HVAC practice (acservicetech,
// HVAC Laboratory, York tech talk, et al.), verified 2026-06.
window.ELEC_SEQ = {
  safety: "Qualified techs only. De-energize and VERIFY 0 V with a CAT III meter before touching terminals; DISCHARGE the run/start capacitor (20 kΩ 5 W resistor across the terminals, ~5 s) before any test. Never bypass a safety, limit, or rollout switch during live testing.",
  sequences: [
    {
      id: "outdoor-dead",
      title: "Outdoor unit won't start (condenser dead)",
      symptom: "Stat calling cool, indoor blower runs, outdoor unit silent.",
      steps: [
        { set: "VAC", measure: "Line voltage L1–L2 at the disconnect", expect: "208–240 V", fail: "Breaker / disconnect / fuses (ohm them for continuity) / utility. Stop here." },
        { set: "VAC", measure: "24 V across the contactor coil (with a call)", expect: "~24 VAC", fail: "No 24 V → transformer, low-voltage fuse, a tripped safety (float / high-limit), or the Y/C wiring." },
        { set: "Ω", measure: "Contactor coil resistance (power OFF)", expect: "10–20 Ω", fail: "Open or shorted coil → replace the contactor." },
        { set: "—", measure: "Energize — does the contactor pull in?", expect: "Pulls in (clicks closed)", fail: "24 V present but no pull-in → bad contactor (or mechanically stuck)." },
        { set: "VAC", measure: "Contactor closed: voltage at compressor + fan", expect: "Line voltage present", fail: "Voltage in but no run → capacitor or motor (see those sequences)." },
        { set: "µF", measure: "Run capacitor vs rating (discharge first)", expect: "within ±10 % of rated µF", fail: "Out of spec / bulged → replace. (Use the Multimeter µF field above.)" },
        { set: "A", measure: "If it hums/trips: running amps vs LRA/RLA", expect: "settles near RLA after start", fail: "Held at LRA → locked rotor, weak cap, or low voltage; consider a hard-start kit." }
      ]
    },
    {
      id: "capacitor-test",
      title: "Capacitor test (run / start)",
      symptom: "Motor hums, won't start, or trips; fan/compressor sluggish.",
      steps: [
        { set: "—", measure: "Power OFF, verify 0 V, discharge (20 kΩ 5 W, ~5 s)", expect: "safe to touch", fail: "—" },
        { set: "µF", measure: "Capacitance across the terminals vs the label", expect: "run ±10 % · start ±20 %", fail: "Below ~90 % of rating → replace. Bulged top or leaked oil → replace on sight." },
        { set: "Ω", measure: "No µF mode? Resistance across the terminals", expect: "low, rising toward OL (charging)", fail: "0 Ω = shorted; jumps to OL instantly = open. Either → replace." }
      ]
    },
    {
      id: "compressor-wont-start",
      title: "Compressor won't start / hums / trips",
      symptom: "Contactor closes, compressor buzzes a few seconds, trips on internal overload.",
      steps: [
        { set: "VAC", measure: "Voltage at the compressor while it tries to start", expect: "within 10 % of nameplate", fail: ">10 % drop → supply / wiring / loose connections; low voltage stalls the start." },
        { set: "µF", measure: "Run (and start) capacitor vs rating", expect: "in spec", fail: "Replace; verify/add a hard-start kit on a TXV or long-line-set system." },
        { set: "Ω", measure: "Windings: C–S, C–R, S–R (power OFF, leads off)", expect: "C–S + C–R = S–R; all show continuity", fail: "A winding reading OL = open → compressor." },
        { set: "Ω", measure: "Ground test: each terminal → clean copper", expect: "OL (no continuity)", fail: "ANY reading = shorted to ground → compressor." },
        { set: "A", measure: "Running amps vs LRA", expect: "drops to ~RLA after start", fail: "Held at LRA = locked rotor — kill power; mechanical seizure or a stalled start." }
      ]
    },
    {
      id: "fan-wont-run",
      title: "Fan / blower motor won't run",
      symptom: "Compressor runs but the fan doesn't (or vice-versa); motor hot or humming.",
      steps: [
        { set: "µF", measure: "Motor run capacitor vs rating", expect: "in spec", fail: "Replace — the #1 dead-fan cause." },
        { set: "VAC", measure: "Voltage to the motor with a call", expect: "line voltage present", fail: "No voltage → relay / board / contactor / wiring upstream." },
        { set: "—", measure: "Power OFF — spin the blade by hand", expect: "spins freely", fail: "Stiff or seized → bad bearing; replace the motor." },
        { set: "Ω", measure: "Windings + ground test (leads off)", expect: "continuity windings, OL to ground", fail: "Open / shorted / grounded → replace the motor." }
      ]
    },
    {
      id: "no-24v",
      title: "No 24 V control voltage",
      symptom: "High voltage is present, but nothing energizes; thermostat dead.",
      steps: [
        { set: "VAC", measure: "Transformer secondary (R–C)", expect: "24–28 VAC", fail: "No output with good primary → transformer. Check the low-voltage fuse on the board." },
        { set: "VAC", measure: "Across each safety in series (float, high-limit, door)", expect: "0 V across a closed switch", fail: "24 V across one = it's open (tripped) → clear that fault (e.g. condensate float full)." },
        { set: "Ω", measure: "Control wiring for a short (power OFF)", expect: "no short R–C", fail: "A shorted thermostat wire blows the fuse repeatedly → find and replace it." }
      ]
    },
    {
      id: "breaker-tripping",
      title: "Breaker tripping / high amp draw",
      symptom: "Breaker trips on a call, or the unit runs then trips.",
      steps: [
        { set: "A", measure: "Running amps vs nameplate RLA (and MCA/MOCP)", expect: "≤ RLA; breaker sized to MOCP", fail: "Over RLA → high head (dirty coil/airflow), failing bearing, or low voltage; cross-check the condenser split." },
        { set: "Ω", measure: "Compressor/motor ground test (power OFF)", expect: "OL to ground", fail: "Reading to ground = a grounded winding shorting → component is dead." },
        { set: "µF", measure: "Run capacitor vs rating", expect: "in spec", fail: "A failing cap overloads the motor → replace." }
      ]
    },
    {
      id: "reversing-valve",
      title: "Heat pump won't switch (wrong-temp air)",
      symptom: "Heat pump runs but reversing valve isn't shifting heat↔cool.",
      steps: [
        { set: "—", measure: "Know the valve: O = energized in COOL, B = energized in HEAT (most are O)", expect: "identify O or B at the stat", fail: "O/B mis-wired swaps heat & cool — fix at the thermostat." },
        { set: "VAC", measure: "24 V at the reversing-valve solenoid in the mode that energizes it", expect: "~24 VAC present", fail: "No 24 V → stat O/B output or wiring; valve never commanded." },
        { set: "Ω", measure: "Solenoid coil resistance (power OFF)", expect: "continuity (not open)", fail: "Open coil → replace the solenoid." },
        { set: "—", measure: "Energized: feel/listen for the shift; line temps swap", expect: "valve clicks, lines reverse", fail: "Coil good + powered but no shift → stuck valve → replace." }
      ]
    },
    {
      id: "defrost",
      title: "Outdoor coil iced / no defrost",
      symptom: "Heat-pump outdoor coil iced solid in heating.",
      steps: [
        { set: "Ω", measure: "Defrost (coil) sensor resistance vs coil temp", expect: "tracks temp; closes when cold", fail: "Open/out-of-spec → board never starts defrost → replace sensor." },
        { set: "—", measure: "Force/await a defrost (jumper the board test pins per the label)", expect: "board initiates defrost", fail: "No defrost output on a cold coil → defrost board." },
        { set: "—", measure: "In defrost: reversing valve flips + outdoor fan stops", expect: "valve to cool, outdoor fan OFF", fail: "Valve not flipping → reversing valve; fan still on → board relay." }
      ]
    },
    {
      id: "furnace-no-ignite",
      title: "Gas furnace won't ignite",
      symptom: "Call for heat, no burner flame.",
      safety: "GAS + COMBUSTION — smell for gas (leave if strong); NEVER bypass a rollout, limit, or pressure switch; verify venting / CO. Qualified techs only.",
      steps: [
        { set: "VAC", measure: "24 V to the board on a heat call (W)", expect: "~24 VAC", fail: "No call → stat / safeties / transformer (see No-24V)." },
        { set: "—", measure: "Inducer runs, then the pressure switch should close", expect: "inducer spins, switch closes", fail: "Inducer dead → inducer/board; switch won't close → blocked vent/condensate or weak inducer." },
        { set: "Ω", measure: "Hot-surface igniter resistance (power OFF)", expect: "~40–90 Ω (cracked = open)", fail: "Open/cracked HSI → replace." },
        { set: "VAC", measure: "Pressure proven → igniter energizes (120 V HSI / spark)", expect: "igniter glows or sparks", fail: "No igniter voltage → board." },
        { set: "VAC", measure: "Igniter hot → 24 V at the gas valve, gas flows", expect: "~24 VAC at the valve, flame", fail: "24 V but no gas → gas valve / supply; no 24 V → board / flame-sense lockout." }
      ]
    },
    {
      id: "furnace-flame-dropout",
      title: "Furnace lights then drops out",
      symptom: "Burners light a few seconds, then shut off / re-try / lock out.",
      safety: "GAS + COMBUSTION — qualified techs only; verify chassis ground and venting.",
      steps: [
        { set: "µA", measure: "Flame-sense microamps, burner lit (meter in series)", expect: "~2–6 µA (above board min, often ~0.5–1 µA)", fail: "Low/zero → clean the flame sensor (light abrasive); confirm it sits in the flame." },
        { set: "—", measure: "Burner ground + line polarity (hot/neutral not reversed)", expect: "good ground, correct polarity", fail: "Poor ground / reversed polarity kills flame rectification → fix wiring." },
        { set: "Ω", measure: "Flame-rod insulator for a crack / short to ground (OFF)", expect: "no short to ground", fail: "Cracked insulator shorting → replace the flame sensor." }
      ]
    },
    {
      id: "ecm-blower",
      title: "ECM / variable-speed blower won't run",
      symptom: "Indoor blower dead (note: ECM motors have NO run capacitor).",
      steps: [
        { set: "VAC", measure: "Line voltage at the motor 5-pin power plug", expect: "120/240 V present", fail: "No power → board / relay / wiring upstream." },
        { set: "VDC", measure: "Control signal at the 16-pin (PWM or 24 V taps on a call)", expect: "a signal present on a call", fail: "No signal → control board; signal present but dead → ECM module/motor." },
        { set: "—", measure: "Power OFF — spin the blower by hand", expect: "spins freely", fail: "Seized bearing → motor." },
        { set: "—", measure: "Do NOT hunt for a run cap (ECM has none)", expect: "n/a", fail: "If it's actually a PSC motor → test the cap (Capacitor test)." }
      ]
    },
    {
      id: "heat-strips",
      title: "Electric heat strips not heating",
      symptom: "Aux/emergency heat called, no warm air.",
      steps: [
        { set: "VAC", measure: "24 V to the sequencer/heat relay on a W2/aux call", expect: "~24 VAC", fail: "No call → stat aux output / outdoor-thermostat lockout / wiring." },
        { set: "VAC", measure: "After the sequencer delay, line voltage across the element", expect: "240 V (staged on)", fail: "No voltage → sequencer/relay or contactor not closing." },
        { set: "Ω", measure: "Element continuity + the high-limit (power OFF)", expect: "low-Ω element, closed limit", fail: "Open element or tripped limit → replace element / reset + fix low airflow." },
        { set: "A", measure: "Amps per element running (~21 A per 5 kW @ 240 V)", expect: "rated amps", fail: "Voltage present, no amps → open element." }
      ]
    },
    {
      id: "thermostat-dead",
      title: "Thermostat — system dead at the stat",
      symptom: "Nothing runs; suspect the thermostat or its wiring.",
      steps: [
        { set: "—", measure: "Batteries / power (a C wire powers most modern stats)", expect: "display on", fail: "Dead display → batteries or no C-wire power." },
        { set: "VAC", measure: "24 V R–C at the stat (call removed)", expect: "~24 VAC", fail: "No 24 V → transformer / control fuse / wiring (see No-24V)." },
        { set: "—", measure: "Stat removed, jumper R→Y (cool) or R→W (heat)", expect: "equipment energizes", fail: "Jumper works → bad thermostat; jumper doesn't → wiring/equipment." }
      ]
    }
  ]
};
