# Development notes

How the page is put together, and how to build, check and change it.

## What you need

- Python 3 (standard library only) for the build script.
- Node.js, optional, for the syntax check and the kernel self-check.
- A current browser. The page loads Three.js r128 from cdnjs, so it needs an internet connection.
- Pillow, optional, only for the picture tools of the pitch deck.

## How the page is assembled

`index.html` is one HTML shell plus nine script parts, joined in this order inside one function:

| Part | What it holds |
|---|---|
| `data.js` | The four data packs as constants: `TRACK`, `RACE`, `EXTRA`, `CITY`. Generated, do not edit by hand. |
| `kernel.js` | The replay kernel: the whole race as a function of race time. |
| `p1_engine.js` | Shared rendering helpers: merged geometry batches, materials, text decals. |
| `p2_world.js` | The stage: track, pit lane, grandstands, city, marina. Joined from the pieces in `stage_src/`. |
| `p3_actors.js` | Cars, pit crews, safety car, marshals, fireworks. |
| `p4_env.js` | Sky, sun, night lighting, water. |
| `p5_cam.js` | The four cameras, see-through structures, the director's shot list. |
| `p6_ui.js` | Dashboard: timing table, panels, timeline, search. |
| `p7_boot.js` | Start-up, the main loop and the test hook. |

`shell.html` holds the markup and CSS. All of these are in `source/build/`. The comment at the top of each part says what it exports and what it needs.

## Build

```bash
cd source/build
python3 tools/build.py ../../index.html shell.html data.js kernel.js p1_engine.js p2_world.js p3_actors.js p4_env.js p5_cam.js p6_ui.js p7_boot.js
```

The script also writes the joined script to `source/build/_check/index.js`, so it can be syntax-checked:

```bash
node --check _check/index.js
```

The build has no timestamps or random parts: the same inputs give the same file, byte for byte.

## Checks

**Kernel self-check**, without a browser:

```bash
cd source/build
node tools/ktest.js val
```

It reports the error at the finish line for every crossing, order mismatches against the lap chart, overlaps between cars, and the pit stop table. `tools/ktest.js` has more modes; they are listed at the top of the file.

**In the browser**, the page exposes a test hook, `window.__yas`:

| Call | Effect |
|---|---|
| `seek(t)`, `play()`, `pause()`, `setSpeed(n)` | Move in race time (seconds; 0 is lights out) |
| `step(n, dt)` | Advance n frames of dt seconds without waiting for the screen |
| `finalLap()`, `highlights()`, `restart()` | The three modes |
| `setCam(name)`, `view(name)`, `orbit(yaw, pitch, dist)`, `nudge(step)` | Cameras: `map`, `chase`, `tv`, `director`; chase views; camera pad steps |
| `select(code)`, `flyTo(area)` | Select a driver by three-letter code; fly to an area |
| `state()`, `validate()`, `errors` | Current state, the kernel self-check, errors caught so far |
| `K`, `UI` | The kernel and the dashboard objects |

**Page scan** for outside links, images and sponsor words:

```bash
python3 source/scripts/final_scan.py index.html
```

## Changing things

- **Any part:** edit the file in `source/build/`, rebuild, reload the page.
- **The stage:** edit the pieces in `source/build/stage_src/`, then join them before building:

  ```bash
  cd source/build
  cat stage_src/w1_base.js stage_src/w2_track.js stage_src/w3_pit.js stage_src/w4_stands.js stage_src/w5_city.js stage_src/w5b_marina.js stage_src/w5c_decor.js stage_src/w6_end.js > p2_world.js
  ```

- **The data:** edit or regenerate the packs in `source/out/`, then rebuild `data.js`:

  ```bash
  cd source/build
  python3 tools/mkdata.py ../out data.js
  ```

The small stub and boot files in `source/build/` (`stub_stage.js`, `stub_show.js`, `boot_min.js`, `shell_min.html`, `stage_boot.js`, `show_boot.js`, `show_los.js`, `cars_test.js`, `cam2_test.js`) let one part be built and tested without the others. They are not part of the delivered page.

## Where the data packs came from

The scripts in `source/scripts/` are the record of how the packs in `source/out/` were made. They have not been re-run from this folder.

| Step | Script and arguments |
|---|---|
| Download the timing data | `fetch_race.py <out_dir>` |
| Build the race pack | `race_pack.py <dl_dir> <out_json>` |
| Download map data | `fetch_osm.py <query_file> <out_file>`, with `q_circuit.txt` for the circuit and `q_city.txt` for the surroundings |
| Build the centreline | `track_build.py <osm_circuit.json> <out_dir>` |
| Build the track pack | `track_pack.py <osm_circuit.json> <track_raw.json> <out_dir> <S0>`, where S0 is the distance of the finish line along the raw centreline in metres |
| Build the scenery pack | `city_pack.py <osm_city.json> <track_pack.json> <out_dir>` |

Notes:

- The raw surroundings download (about 24 MB) is not kept in the repository. `q_city.txt` is the query that produced it.
- `race_extra.json` was compiled by hand from race reports. Each entry says whether it is data, a report, an estimate or an assumption.
- On a machine where Python cannot verify certificates, download the same addresses with `curl` instead of the fetch scripts.
- The other scripts (`city_info.py`, `osm_circuit_info.py`, `pit_probe.py`, `straight_probe.py`) only print summaries that were used while building the packs.

## The pitch deck

`source/deck/` holds the source of a slide deck about the project: one HTML file per slide in `project/slides/`, the shared look in `project/deck.css`, the order in `project/deck.json`, and the pictures in `img/final/`. The slides were written for a hosted slide viewer and refer to their pictures by upload references, listed in `assets.txt`. The tools in `tools/` stitched and cropped the screenshots and drew the circuit outline for the final-lap slide.
