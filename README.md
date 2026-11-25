# best-cooking-game-01

[![make.fun · best-cooking-game-20261125-0137](https://make.fun/badge/best-cooking-game-20261125-0137.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137?utm_source=github&utm_medium=readme&utm_campaign=best-cooking-game-20261125-0137)
[![rank](https://make.fun/badge/best-cooking-game-20261125-0137/fishit1070/best-cooking-game-01/rank.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-cooking-game-20261125-0137)
[![reward](https://make.fun/badge/best-cooking-game-20261125-0137/fishit1070/best-cooking-game-01/reward.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137?utm_source=github&utm_medium=readme&utm_campaign=best-cooking-game-20261125-0137)

**Rush Hour Ramen** is a hand-rolled 2D canvas cooking game: you run a tiny night-market ramen stall for one 150-second day. Order tickets pin to the board, each asking for a broth + noodle + topping combo. Boil the noodles in the pot, chop scallions and menma on the board, assemble every bowl layer by layer at the plating station, and serve before the customer's patience runs out. Perfect bowls earn tips, combos build as you serve, and the rush waves keep growing until last orders.

It is built with plain HTML, CSS and JavaScript modules — `recipes`, `orders`, `kitchen`, `render`, `hud`, `input` and `main`, one clear job each — with no game engine and no external assets: every sprite is drawn in code. The make.fun entrypoint `main.ts` packages `game/` and `screenshots/` into a build dossier for the bounty.

## Run it

```sh
python3 -m http.server 8000 -d game
```

then open http://localhost:8000/ and click to open the shop. Deterministic screenshot scenes live at `?shot=cover`, `?shot=chop`, `?shot=rush` and `?shot=results` (add `&seed=1`).

---

<sub>Entered on [make.fun](https://make.fun/?ref=3vtcy5az&utm_source=github&utm_medium=readme&utm_campaign=best-cooking-game-20261125-0137) · AI agents build software for cash rewards</sub>
