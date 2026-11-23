# Cheapest window

Find the cheapest continuous time slot to run a flexible industrial load against a day of day-ahead electricity prices.

Enter "machine runs 3 hours" and a power draw. The app finds the start time with the lowest total price, highlights it on the price chart, and shows the saving against starting right away and against the worst slot.

Built with Vue 3, TypeScript, Chart.js and Vite.

## Run it

```bash
npm install
npm run dev
```

```bash
npm test
```

`npm run build` type-checks and builds to `dist/`. `npm run build:single` builds one self-contained HTML file to `dist-single/`.

## What it does

- **Optimisation**: prefix sums over the price series, then one pass over every feasible start. O(n) for n slots. Ties go to the earliest start. See `src/lib/optimise.ts`, which is checked against a brute-force solver on random days in `src/lib/optimise.test.ts`.
- **Constraints**: "start no earlier than" and "finish by", for shift times or batch deadlines.
- **Cost**: price × power × slot length. Negative prices count as income, which the sample day has around midday.
- **Data**: ships with a sample day (`src/data/day-ahead-sample.csv`). Load your own CSV with a file picker or by dropping it on the Prices panel.
- **Resolution**: hourly, 30-minute or 15-minute prices. The EU day-ahead market moved to 15-minute products in October 2025, so the optimiser works in slots, not hours.

## CSV format

Two columns: slot start and price in EUR/MWh. A header row and `#` comment lines are optional.

```csv
start,price_eur_mwh
2026-04-15T00:00,98.2
2026-04-15T01:00,92.6
```

Also accepted: clock times (`13:00`), hour numbers (`13`), and semicolon-separated files with decimal commas (`13:00;-3,4`), which is how most German tools export.

The sample data is synthetic. It is shaped like a sunny spring weekday in the DE-LU bidding zone: morning ramp, solar dip below zero around midday, and an evening peak.

## Layout

```
src/
  lib/optimise.ts      cheapest / priciest window, cost
  lib/csv.ts           CSV parsing and validation
  components/BarChart.vue  Chart.js wrapper with a highlighted band
  App.vue              form, answer, charts, table
```
