---
title: "The C660's battery: what you can measure without a fuel gauge"
date: 2026-11-02
description: "The LG C660 has no battery-metering chip: every voltage reading comes filtered over RPC from the modem, in 17 mV steps. This is how far that limitation lets you go, and where it doesn't."
tags: [android, battery, c660]
draft: false
---

When you suspect a worn battery, the right tool is a multimeter. What I had on hand was the LG C660 and [QApp]({{< relref "qapp-probar-sin-adivinar.md" >}}), so this is how far software alone can take you, and where it has to stop.

## The phone has no {{< g "pmic" >}} with a cell meter

The C660 ships with no dedicated battery-metering chip (neither `bq27x00` nor `max17040`; both are off in the kernel). Everything Android sees — voltage, capacity, temperature — arrives through a remote call to the modem (`msm_battery` over RPC), which itself filters the ADC signal. The practical consequence: voltage moves in **steps of about 17 mV**, not a continuous curve, and that has to be accounted for when reading any number.

## Three tests, three different results

The battery stress test measures idle voltage, puts the CPU and GPU under load for 30 seconds, and measures how far it drops and how fast it recovers.

| Test | Idle | Minimum under load | Drop | Recovered | Verdict |
|---|---|---|---|---|---|
| 1 | 4,227 mV | 3,882 mV | 345 mV | 4,174 mV | AGING |
| 2 (rebooted 8 s into the load phase) | 4,141 mV | 3,779 mV* | — | — | interrupted |
| 3 | 4,364 mV | 4,038 mV | 326 mV | 4,296 mV | AGING |

*Last value saved before the reboot, not that run's real minimum.

Three runs, three different idle readings (4,227, 4,141 and 4,364 mV) with the battery supposedly in the same state. That alone says no single reading is enough for a diagnosis.

## Why "idle" lies a little

Idle is measured right after unplugging the charger. In run 3, the voltage hit **4,382 mV for a few seconds**, above the manufacturer's design maximum (4,300 mV). That is surface charge: the tension that builds up on the cell's surface while charging and dissipates on its own in the first seconds without current. If I instead use the **recovery** voltage (the one that settles after the test's load, not before) as the reference, run 3's drop comes out to about 258 mV, not 326, and that flips the verdict from "AGING" to "GOOD" under the program's own threshold (drop ≤ 300 mV with a minimum ≥ 3,650 mV).

It isn't a bug in the test: "idle voltage" is just ambiguous when measured a few seconds after unplugging the charger.

## The one thing that does matter: a real reboot

Run 2 is the only one that gives something that doesn't depend on interpretation: the phone **rebooted on its own 8 seconds** into the test's load phase, with voltage dropping from 4,141 to 3,779 mV in that window. A reboot under CPU load is consistent with a cell that can't sustain peak current, but one occurrence, with no way to repeat it, isn't proof: it could be the battery, or it could be something else that happened to coincide that one time.

## What this leaves

- **Without a fuel gauge, any single voltage reading is unreliable.** The test needs repeating several times, at different moments (right after charging, after a while at rest), before trusting a number.
- **Recovery voltage is a better reference than immediate idle**, because it doesn't carry the surface charge.
- **A single reboot under load is a clue, not a conclusion.** To confirm a truly worn battery on a phone with no fuel gauge, the honest alternative is still a multimeter or, as a last resort, trying another battery.

I'm not concluding this C660's battery is bad. I'm concluding that, with the tools I had, I can't say it is with the confidence it would take to recommend replacing it.
