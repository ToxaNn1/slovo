# The Recordings generator runs on two threads, and a run that hits its time limit is stuck

Owner decision of 2026-11-17, after the `recordings` crash report. This ADR amends ADR 0169 (when the Recordings job stops) and ADR 0099 (the Recordings service).

**What it cost.** After #1969 the job made files again, but every hourly run hit the generator's 25-minute time limit (`GENERATOR_TIMEOUT_MS`) after 16–24 of about 200 requests: 60–90 seconds per request where the engine should take one or two, on 9–10 vCPU of the 8 the service had. About $0.11 an hour, $80 a month, for 4–6 Words an hour. ADR 0169's rule never fired, since each run made some file. The likely cause is thread oversubscription: torch and its maths libraries take one thread per core of the whole Railway host by default, far more than the container may run. Only a real run confirms it.

**The generator runs on two threads.** `scriptGenerator` starts `generate.py` with `OMP_NUM_THREADS`, `MKL_NUM_THREADS` and `OPENBLAS_NUM_THREADS` at `GENERATOR_THREADS` (2), and the script calls `torch.set_num_threads` with it (2 unless set, so a run on the Mac is the same) and one inter-op thread. The `recordings` service is sized to it in `.railway/railway.ts`: 2 vCPU and 5 GB (`limitOverride`), over the generator's 3–4 GB peak. At about 2 seconds a request, 200 requests take about 7 minutes: about $0.013 a run instead of $0.11.

**The script's lines reach the log.** The script prints the seconds each request took and the engine its `RTF` line, line by line; `scriptGenerator` passes on every line of its output as it comes, so a run killed at its time limit still shows how slow it was.

**A run that hits its time limit is stuck.** ADR 0169's count now takes a stuck run: one whose generator made no file of the Words it had (`nothing-made`) or hit its time limit (`time-limit`), though it made files. After `STALL_RUNS` (2) stuck runs in a row the job tells the owner in Telegram (`recordings-stalled`, now with its `cause`, the last run's) and skips the Edition until its content version or the Railway deployment changes, as before. The Words a run made before its time limit are kept and saved; the count keeps the content version as the run left it, so the job's own save does not start it again. A run that made a file in time starts the count again. A slow generator now costs at most two runs, about $0.22, then seconds an hour.

Consequences:

- `RecordingGenerator.record` returns a batch: the outcomes and whether the run hit its time limit.
- The Telegram text says which: «не записали жодного слова» or «не встигли записати все до ліміту часу».
- The table `recording_stalls` keeps its columns; its `empty_runs` counts stuck runs.
