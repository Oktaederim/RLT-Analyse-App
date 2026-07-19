const EPS_T = 0.01;
const EPS_X = 0.01;

const defaultValues = {
    tempAussen: 20.0,
    rhAussen: 50.0,
    tempZuluft: 20.0,
    rhZuluft: 60.0,
    xZuluft: 7.0,
    volumenstrom: 5000,
    druck: 1013.25,
    tempVEZiel: 5.0,
    tempHeizVorlauf: 70,
    tempHeizRuecklauf: 50,
    tempKuehlVorlauf: 8,
    tempKuehlRuecklauf: 13,
    betriebsmodus: 'entfeuchten',
    heizkonzept: 'standard',
    regelungsart: 'trh'
};

if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        const allInputs = document.querySelectorAll('input[type="number"], input[type="radio"]');
        allInputs.forEach(input => {
            const eventType = (input.type === 'radio') ? 'change' : 'input';
            input.addEventListener(eventType, () => {
                if (input.type === 'radio') toggleUI();
                calculate();
            });
        });

        document.getElementById('resetBtn').addEventListener('click', resetAll);
        toggleUI();
        calculate();
    });
}

function resetAll() {
    for (const key in defaultValues) {
        const el = document.getElementById(key);
        if (el) {
            el.value = defaultValues[key];
        } else {
            const radio = document.querySelector(`input[name="${key}"][value="${defaultValues[key]}"]`);
            if (radio) radio.checked = true;
        }
    }
    toggleUI();
    calculate();
}

function toggleUI() {
    const heizkonzept = document.querySelector('input[name="heizkonzept"]:checked').value;
    const regelungsart = document.querySelector('input[name="regelungsart"]:checked').value;
    const betriebsmodus = document.querySelector('input[name="betriebsmodus"]:checked').value;

    document.getElementById('kuehlwasserWrapper').style.display = (betriebsmodus === 'heizen') ? 'none' : 'block';
    document.getElementById('veZielTempWrapper').style.display = (heizkonzept === 'standard') ? 'block' : 'none';
    document.getElementById('zuluft-trh-wrapper').style.display = (regelungsart === 'trh') ? 'block' : 'none';
    document.getElementById('zuluft-x-wrapper').style.display = (regelungsart === 'x') ? 'block' : 'none';
}

// Psychrometrische Hilfsfunktionen. x und h beziehen sich auf 1 kg trockene Luft.
function getSVP(T) {
    const a = T >= 0 ? 17.62 : 22.46;
    const b = T >= 0 ? 243.12 : 272.62;
    return 6.112 * Math.exp((a * T) / (b + T));
}

function getAbsFeuchte(T, rh, p) {
    const pv = (rh / 100) * getSVP(T);
    return 622 * pv / (p - pv);
}

function getRelFeuchteRaw(T, x, p) {
    return (x * p) / (getSVP(T) * (622 + x)) * 100;
}

function getRelFeuchte(T, x, p) {
    return Math.min(100, Math.max(0, getRelFeuchteRaw(T, x, p)));
}

function getEnthalpie(T, x) {
    return 1.006 * T + (x / 1000) * (2501 + 1.86 * T);
}

function getTaupunkt(T, rh) {
    if (rh <= 0) return -273.15;
    const pv = (rh / 100) * getSVP(T);
    const a = pv >= 6.112 ? 17.62 : 22.46;
    const b = pv >= 6.112 ? 243.12 : 272.62;
    const ln = Math.log(pv / 6.112);
    return (b * ln) / (a - ln);
}

function getDichte(T, rh, p) {
    const T_K = T + 273.15;
    const p_v = (rh / 100) * getSVP(T) * 100;
    const p_d = p * 100 - p_v;
    return (p_d / (287.058 * T_K)) + (p_v / (461.52 * T_K));
}

function getTrockenluftDichte(T, x, p) {
    const p_v = (x * p) / (622 + x) * 100;
    return (p * 100 - p_v) / (287.058 * (T + 273.15));
}

function getWasserdampfDichte(T, x, p) {
    const p_v = (x * p) / (622 + x) * 100;
    return p_v / (461.52 * (T + 273.15)) * 1000;
}

function createZustand(T, rh, x_val, p) {
    const zustand = { T, p };
    if (x_val !== null) {
        zustand.x = x_val;
        zustand.rh = getRelFeuchte(T, x_val, p);
    } else {
        zustand.rh = rh;
        zustand.x = getAbsFeuchte(T, rh, p);
    }
    zustand.h = getEnthalpie(zustand.T, zustand.x);
    zustand.td = getTaupunkt(zustand.T, zustand.rh);
    zustand.dichte = getDichte(zustand.T, zustand.rh, p);
    zustand.x_gm3 = getWasserdampfDichte(zustand.T, zustand.x, p);
    return zustand;
}

function validateInputs(inputs) {
    const errors = [];
    const numericFields = [
        'tAussen', 'rhAussen', 'tZuluft', 'volumenstrom', 'druck',
        'tVEZiel', 'tHeizV', 'tHeizR', 'tKuehlV', 'tKuehlR'
    ];
    numericFields.forEach(key => {
        if (!Number.isFinite(inputs[key])) errors.push(`Für ${key} fehlt ein gültiger Zahlenwert.`);
    });
    if (inputs.regelungsart === 'trh' && !Number.isFinite(inputs.rhZuluft)) {
        errors.push('Für die Zuluftfeuchte fehlt ein gültiger Zahlenwert.');
    }
    if (inputs.regelungsart === 'x' && !Number.isFinite(inputs.xZuluft)) {
        errors.push('Für den Zuluft-Feuchtegehalt fehlt ein gültiger Zahlenwert.');
    }
    if (errors.length) return errors;

    if (inputs.rhAussen < 0 || inputs.rhAussen > 100) errors.push('Die relative Außenluftfeuchte muss zwischen 0 und 100 % liegen.');
    if (inputs.regelungsart === 'trh' && (inputs.rhZuluft < 0 || inputs.rhZuluft > 100)) {
        errors.push('Die relative Zuluftfeuchte muss zwischen 0 und 100 % liegen.');
    }
    if (inputs.regelungsart === 'x' && inputs.xZuluft < 0) errors.push('Der Zuluft-Feuchtegehalt darf nicht negativ sein.');
    if (inputs.volumenstrom < 0) errors.push('Der Volumenstrom darf nicht negativ sein.');
    if (inputs.druck <= 0) errors.push('Der Luftdruck muss größer als 0 hPa sein.');
    if (inputs.tAussen <= -100 || inputs.tZuluft <= -100) errors.push('Die eingegebene Lufttemperatur liegt außerhalb des Berechnungsbereichs.');

    const pvAussen = (inputs.rhAussen / 100) * getSVP(inputs.tAussen);
    if (pvAussen >= inputs.druck) errors.push('Der Dampfdruck der Außenluft muss unter dem Gesamtdruck liegen.');
    return errors;
}

function calculateProcess(inputs) {
    const errors = validateInputs(inputs);
    if (errors.length) return { errors, warnings: [] };

    const zustand0 = createZustand(inputs.tAussen, inputs.rhAussen, null, inputs.druck);
    let x_soll_zuluft;
    let rh_soll_zuluft;
    if (inputs.regelungsart === 'trh') {
        x_soll_zuluft = getAbsFeuchte(inputs.tZuluft, inputs.rhZuluft, inputs.druck);
        rh_soll_zuluft = inputs.rhZuluft;
    } else {
        x_soll_zuluft = inputs.xZuluft;
        rh_soll_zuluft = getRelFeuchteRaw(inputs.tZuluft, x_soll_zuluft, inputs.druck);
        if (rh_soll_zuluft > 100 + 0.01) {
            return {
                errors: [`Der Soll-Feuchtegehalt von ${x_soll_zuluft.toFixed(2)} g/kg ist bei ${inputs.tZuluft.toFixed(1)} °C nicht möglich (r. F. über 100 %).`],
                warnings: []
            };
        }
    }

    const massenstrom = (inputs.volumenstrom / 3600) * getTrockenluftDichte(zustand0.T, zustand0.x, inputs.druck);
    let p_ve = 0;
    let p_k = 0;
    let p_ne = 0;
    let kondensat = 0;
    let t_kuehl_ziel = null;
    let processType = 'none';
    const warnings = [];

    const mussEntfeuchtetWerden = inputs.betriebsmodus === 'entfeuchten' && zustand0.x > x_soll_zuluft + EPS_X;
    // Fehlerkorrektur: Im Modus "Kühlen & Entfeuchten" muss auch rein sensible Kühlung möglich sein.
    const darfKuehlen = inputs.betriebsmodus === 'kuehlen_sensibel' || inputs.betriebsmodus === 'entfeuchten';
    const mussSensibelGekuehltWerden = darfKuehlen && !mussEntfeuchtetWerden && zustand0.T > inputs.tZuluft + EPS_T;
    const mussGeheiztWerden = zustand0.T < inputs.tZuluft - EPS_T;

    let zustand1 = { ...zustand0 };
    let zustand2 = { ...zustand0 };
    let zustand3 = { ...zustand0 };

    if (mussEntfeuchtetWerden) {
        if (zustand0.T < inputs.tVEZiel - EPS_T && inputs.heizkonzept === 'standard') {
            zustand1 = createZustand(inputs.tVEZiel, null, zustand0.x, inputs.druck);
            p_ve = massenstrom * (zustand1.h - zustand0.h);
        }
        t_kuehl_ziel = getTaupunkt(inputs.tZuluft, rh_soll_zuluft);
        zustand2 = createZustand(t_kuehl_ziel, 100, x_soll_zuluft, inputs.druck);
        p_k = massenstrom * (zustand2.h - zustand1.h);
        kondensat = massenstrom * Math.max(0, zustand1.x - zustand2.x) * 3.6;
        zustand3 = { ...zustand2 };
        if (zustand2.T < inputs.tZuluft - EPS_T) {
            zustand3 = createZustand(inputs.tZuluft, null, zustand2.x, inputs.druck);
            p_ne = massenstrom * (zustand3.h - zustand2.h);
        }
        processType = zustand3.T > zustand2.T + EPS_T ? 'dehumidify_reheat' : 'dehumidify';
    } else if (mussSensibelGekuehltWerden) {
        let t_sensibel_ziel = inputs.tZuluft;
        if (inputs.betriebsmodus === 'kuehlen_sensibel' && inputs.tZuluft < zustand0.td - EPS_T) {
            t_sensibel_ziel = zustand0.td;
            warnings.push(`Eine rein sensible Kühlung auf ${inputs.tZuluft.toFixed(1)} °C ist nicht möglich: Der Außenluft-Taupunkt liegt bei ${zustand0.td.toFixed(1)} °C. Unterhalb davon fällt Kondensat an.`);
        }
        zustand2 = createZustand(t_sensibel_ziel, null, zustand0.x, inputs.druck);
        p_k = massenstrom * (zustand2.h - zustand0.h);
        zustand3 = { ...zustand2 };
        processType = 'sensible_cooling';
    } else if (mussGeheiztWerden) {
        if (inputs.heizkonzept === 'standard') {
            // Der Vorerhitzer darf die Zuluft-Solltemperatur nicht überschreiten.
            const t_ve_ziel = Math.min(inputs.tVEZiel, inputs.tZuluft);
            if (zustand0.T < t_ve_ziel - EPS_T) {
                zustand1 = createZustand(t_ve_ziel, null, zustand0.x, inputs.druck);
                p_ve = massenstrom * (zustand1.h - zustand0.h);
            }
            zustand2 = { ...zustand1 };
            zustand3 = createZustand(inputs.tZuluft, null, zustand2.x, inputs.druck);
            p_ne = massenstrom * (zustand3.h - zustand2.h);
        } else {
            zustand1 = createZustand(inputs.tZuluft, null, zustand0.x, inputs.druck);
            p_ve = massenstrom * (zustand1.h - zustand0.h);
            zustand2 = { ...zustand1 };
            zustand3 = { ...zustand1 };
        }
        processType = 'heating';
    } else if (inputs.betriebsmodus === 'heizen' && zustand0.T > inputs.tZuluft + EPS_T) {
        warnings.push('Der Zuluft-Temperatursollwert kann im Betriebsmodus „Nur Heizen“ nicht erreicht werden.');
    }

    const finalState = zustand3;
    if (finalState.x < x_soll_zuluft - EPS_X) {
        warnings.push(`Der Feuchtesollwert wird ohne Befeuchter nicht erreicht. Tatsächlich ergeben sich ${finalState.rh.toFixed(1)} % r. F. bei ${finalState.x.toFixed(2)} g/kg.`);
    } else if (finalState.x > x_soll_zuluft + EPS_X && inputs.betriebsmodus !== 'entfeuchten') {
        warnings.push('Der Feuchtesollwert erfordert eine Entfeuchtung; diese ist im gewählten Betriebsmodus nicht aktiviert.');
    }

    if (p_k < -0.01 && inputs.tKuehlV >= zustand2.T) {
        warnings.push(`Die Kühlwasser-Vorlauftemperatur von ${inputs.tKuehlV.toFixed(1)} °C ist zu hoch, um die berechnete Kühleraustrittstemperatur von ${zustand2.T.toFixed(1)} °C idealisiert zu erreichen.`);
    }
    const highestHeatedAirTemp = Math.max(zustand1.T, zustand3.T);
    if ((p_ve > 0.01 || p_ne > 0.01) && inputs.tHeizV <= highestHeatedAirTemp) {
        warnings.push(`Die Heizwasser-Vorlauftemperatur von ${inputs.tHeizV.toFixed(1)} °C ist zu niedrig, um ${highestHeatedAirTemp.toFixed(1)} °C Lufttemperatur zu erreichen.`);
    }

    const cp_wasser = 4.187;
    const rho_wasser = 1000;
    const wv_ve = (p_ve > 0 && inputs.tHeizV > inputs.tHeizR)
        ? (p_ve * 3600) / (cp_wasser * (inputs.tHeizV - inputs.tHeizR) * rho_wasser) : 0;
    const wv_ne = (p_ne > 0 && inputs.tHeizV > inputs.tHeizR)
        ? (p_ne * 3600) / (cp_wasser * (inputs.tHeizV - inputs.tHeizR) * rho_wasser) : 0;
    const wv_k = (p_k < 0 && inputs.tKuehlR > inputs.tKuehlV)
        ? (Math.abs(p_k) * 3600) / (cp_wasser * (inputs.tKuehlR - inputs.tKuehlV) * rho_wasser) : 0;

    if ((p_ve > 0.01 || p_ne > 0.01) && inputs.tHeizV <= inputs.tHeizR) {
        warnings.push('Für den Heizwasser-Volumenstrom muss der Vorlauf wärmer als der Rücklauf sein.');
    }
    if (p_k < -0.01 && inputs.tKuehlR <= inputs.tKuehlV) {
        warnings.push('Für den Kühlwasser-Volumenstrom muss der Rücklauf wärmer als der Vorlauf sein.');
    }

    return {
        errors: [],
        warnings,
        states: [zustand0, zustand1, zustand2, zustand3],
        powers: { p_ve, p_k, p_ne, kondensat, t_kuehl_ziel, wv_ve, wv_k, wv_ne },
        processType,
        target: { T: inputs.tZuluft, rh: rh_soll_zuluft, x: x_soll_zuluft },
        massenstrom
    };
}

function readInputs() {
    return {
        betriebsmodus: document.querySelector('input[name="betriebsmodus"]:checked').value,
        heizkonzept: document.querySelector('input[name="heizkonzept"]:checked').value,
        regelungsart: document.querySelector('input[name="regelungsart"]:checked').value,
        tAussen: parseFloat(document.getElementById('tempAussen').value),
        rhAussen: parseFloat(document.getElementById('rhAussen').value),
        tZuluft: parseFloat(document.getElementById('tempZuluft').value),
        rhZuluft: parseFloat(document.getElementById('rhZuluft').value),
        xZuluft: parseFloat(document.getElementById('xZuluft').value),
        volumenstrom: parseFloat(document.getElementById('volumenstrom').value),
        druck: parseFloat(document.getElementById('druck').value),
        tVEZiel: parseFloat(document.getElementById('tempVEZiel').value),
        tHeizV: parseFloat(document.getElementById('tempHeizVorlauf').value),
        tHeizR: parseFloat(document.getElementById('tempHeizRuecklauf').value),
        tKuehlV: parseFloat(document.getElementById('tempKuehlVorlauf').value),
        tKuehlR: parseFloat(document.getElementById('tempKuehlRuecklauf').value)
    };
}

function calculate() {
    const inputs = readInputs();
    const result = calculateProcess(inputs);
    if (inputs.regelungsart === 'x' && result.target) {
        document.getElementById('rh-ergebnis').textContent = result.target.rh.toFixed(1);
    }
    if (result.errors.length) {
        updateErrorUI(result.errors);
        return;
    }
    updateUI(result, inputs);
}

function updateErrorUI(errors) {
    const container = document.getElementById('process-overview-container');
    container.innerHTML = '';
    const overview = document.createElement('div');
    overview.className = 'process-overview process-error';
    overview.textContent = `Eingabefehler: ${errors.join(' ')}`;
    container.appendChild(overview);
}

function updateUI(result, inputs) {
    const { states, powers } = result;
    const f = (val, dec) => Number.isFinite(val) ? val.toFixed(dec) : '--';
    states.forEach((state, i) => {
        const tempEl = document.getElementById(`res-t-${i}`);
        if (tempEl) {
            tempEl.textContent = f(state.T, 1);
            document.getElementById(`res-rh-${i}`).textContent = f(state.rh, 1);
            document.getElementById(`res-x-${i}`).textContent = f(state.x, 2);
        }
    });

    const finalState = states[states.length - 1];
    document.getElementById('res-t-final').textContent = f(finalState.T, 1);
    document.getElementById('res-rh-final').textContent = f(finalState.rh, 1);
    document.getElementById('res-x-final').textContent = f(finalState.x, 2);
    document.getElementById('res-p-ve').textContent = f(powers.p_ve, 2);
    document.getElementById('res-p-k').textContent = f(Math.abs(powers.p_k), 2);
    document.getElementById('res-p-ne').textContent = f(powers.p_ne, 2);
    document.getElementById('res-kondensat').textContent = f(Math.max(0, powers.kondensat), 2);
    document.getElementById('res-wv-ve').textContent = f(powers.wv_ve, 2);
    document.getElementById('res-wv-k').textContent = f(powers.wv_k, 2);
    document.getElementById('res-wv-ne').textContent = f(powers.wv_ne, 2);

    document.getElementById('summary-power-heat').textContent = `${f(powers.p_ve + powers.p_ne, 2)} kW`;
    document.getElementById('summary-power-cool').textContent = `${f(Math.abs(powers.p_k), 2)} kW`;

    const paramMapping = { t: 'T', rh: 'rh', x: 'x', x_gm3: 'x_gm3', h: 'h', td: 'td' };
    Object.keys(paramMapping).forEach(paramKey => {
        const stateKey = paramMapping[paramKey];
        const unit = { t: '°C', rh: '%', x: 'g/kg', x_gm3: 'g/m³', h: 'kJ/kg', td: '°C' }[paramKey];
        const dec = (paramKey === 't' || paramKey === 'rh' || paramKey === 'td') ? 1 : 2;
        document.getElementById(`summary-${paramKey}-aussen`).textContent = `${f(states[0][stateKey], dec)} ${unit}`;
        document.getElementById(`summary-${paramKey}-zuluft`).textContent = `${f(finalState[stateKey], dec)} ${unit}`;
    });

    updateProcessVisuals(result, inputs);
}

function updateProcessVisuals(result, inputs) {
    const { states, powers, processType, warnings } = result;
    const processTexts = {
        none: 'Keine Luftbehandlung erforderlich oder im gewählten Betriebsmodus möglich.',
        heating: 'Heizprozess.',
        sensible_cooling: 'Sensibler Kühlprozess.',
        dehumidify: 'Kühlung mit Entfeuchtung.',
        dehumidify_reheat: 'Kühlen mit Entfeuchtung und Nacherwärmung.'
    };

    const overview = document.createElement('div');
    overview.className = 'process-overview process-info';
    const title = document.createElement('div');
    title.textContent = processTexts[processType];
    overview.appendChild(title);
    warnings.forEach(warning => {
        const item = document.createElement('div');
        item.className = 'process-warning';
        item.textContent = `Hinweis: ${warning}`;
        overview.appendChild(item);
    });
    const container = document.getElementById('process-overview-container');
    container.innerHTML = '';
    container.appendChild(overview);

    document.getElementById('comp-ve').classList.toggle('inactive', powers.p_ve < 0.01);
    document.getElementById('comp-k').classList.toggle('inactive', powers.p_k > -0.01);
    document.getElementById('comp-ne').classList.toggle('inactive', powers.p_ne < 0.01);

    const setNodeColor = (nodeId, colorClass) => {
        const node = document.getElementById(nodeId);
        node.classList.remove('color-red', 'color-blue', 'color-green');
        if (colorClass) node.classList.add(colorClass);
    };
    const getColorFromTempChange = (temp, baseTemp) => {
        if (temp > baseTemp + 0.1) return 'color-red';
        if (temp < baseTemp - 0.1) return 'color-blue';
        return null;
    };

    setNodeColor('node-0', 'color-green');
    setNodeColor('node-1', getColorFromTempChange(states[1].T, states[0].T));
    setNodeColor('node-2', getColorFromTempChange(states[2].T, states[1].T));
    setNodeColor('node-3', getColorFromTempChange(states[3].T, states[2].T));
    setNodeColor('node-final', Math.abs(states[3].T - inputs.tZuluft) <= 0.1 ? 'color-green' : null);
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        calculateProcess,
        createZustand,
        getAbsFeuchte,
        getRelFeuchte,
        getTaupunkt,
        getEnthalpie,
        getDichte,
        getWasserdampfDichte
    };
}
