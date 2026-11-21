# chess-buddy

Some tools that leverage the chess.com API to help me learn openings and mating skills.

## Opening missions

You get a mission for one opening per colour, play your normal chess.com games, and the app
counts the ones that actually reached that opening. Finish a mission and the next opening on
the map comes out of the fog.

```
npm install
npm start          # builds the front end, then serves http://localhost:3210
npm test
```

Everything the app remembers is in `data/`:

- `data/tree.json` – the opening flowchart
- `data/progress.json` – settings, missions and what you have uncovered
- `data/games/YYYY-MM.json` – your games, trimmed to the first 30 plies

Commit and push `data/` (or use **Save to GitHub** in the app) to back up your progress.
