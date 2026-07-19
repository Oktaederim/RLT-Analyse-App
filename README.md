# RLT-Rechner Analyse

Statischer Rechner zur überschlägigen Analyse von Luftzuständen und Anlagenprozessen in raumlufttechnischen Anlagen.

## Abgebildete Prozesse

- Heizen mit Vor- und Nacherhitzer
- sensible Kühlung
- Kühlung mit Entfeuchtung und Nacherwärmung
- Regelung nach Temperatur und relativer Feuchte oder nach Feuchtegehalt `x`
- überschlägige Luft- und Wasserleistungen sowie Kondensatmenge

Die Zustandsgrößen `x` und `h` sind auf 1 kg trockene Luft bezogen. Der Trockenluftmassenstrom wird aus dem eingegebenen Volumenstrom, Druck und Außenluftzustand berechnet.

## Fachliche Grenzen

Der Rechner bildet idealisierte stationäre Prozesse ab. Er berücksichtigt unter anderem keine Ventilatorerwärmung, Wärmebrücken, Register-Bypässe, Teillastkennlinien, Verschmutzung oder realen Temperaturabstand zwischen Wasser und Luft. Eine Befeuchtung ist nicht vorhanden; liegt der Feuchtegehalt der Außenluft unter dem Sollwert, wird deshalb der tatsächlich erreichbare niedrigere Feuchtewert angezeigt.

Der Rechner dient der Analyse und Plausibilitätsprüfung. Er ersetzt keine normgerechte Auslegung oder Herstellerberechnung.

## Tests

Voraussetzung ist eine aktuelle Node.js-Version.

```bash
npm test
```

Die Tests decken den gemeldeten Kühlfall, Entfeuchtung mit Nacherwärmung, Taupunktgrenzen, Eingabeprüfung, Vorerhitzerlogik und ein Raster typischer Luftzustände ab.
