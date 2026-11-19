# Shulker Commands

Custom slash commands for Minecraft Bedrock add-ons, on the stable Script API.

You describe each command as one object. The library registers it, along with its enums, permissions and subcommands, and gives your handler typed arguments.

```js
import { commands } from "./shulkercommands.js";

export const sz = commands("sz", { permission: "any" });

sz("heal", {
  description: "Heal players",
  params: { "target?": "players", "amount?": { type: "int", min: 1, max: 20 } },
  apply: ({ target, amount }, c) => {
    for (const p of target ?? [c.player]) p.addEffect("instant_health", 1, { amplifier: amount ?? 1 });
  },
});

const zone = sz("zone", { description: "Manage zones" });

zone("list", {
  description: "List zones",
  run: (_, c) => "no zones yet",
});

zone("flag", {
  description: "Change a flag",
  params: { zone: "string", flag: ["build", "pvp"], on: "bool" },
  run: ({ zone, flag, on }) => `${zone}: ${flag} = ${on}`,
});
```

In game this gives you `/sz:heal`, and `/sz:zone list` / `/sz:zone flag` with autocomplete.

## Install

1. Download `shulkercommands.js` and `shulkercommands.d.ts` from the [latest release](https://github.com/Duskaraa/shulker-commands/releases/latest).
2. Put both files in your behavior pack, for example `scripts/shulkercommands.js`.
3. Add the stable script module to your `manifest.json`, version `2.1.0` or newer:

   ```json
   "dependencies": [{ "module_name": "@minecraft/server", "version": "2.1.0" }]
   ```

4. Import it from your scripts and declare your commands at load time (top level, not inside an event).

The `.d.ts` file is optional. With it, your editor knows the parameters of every command. The library needs no Beta APIs and nothing else to install.

## Builder

Don't want to write it by hand? The [builder page](https://duskaraa.github.io/shulker-commands/) lets you fill in your commands, checks them against the game's limits as you type, and writes the code for you. Paste its output next to the two files above.

## What it does

- **One object per command.** Name, description, permission, cheats, sources, parameters and handler in one place. Enums are registered for you, in the right order.
- **run and apply.** `run` answers right away and its return value is the command's result (a string, `ok()`, `fail()`, or nothing). `apply` runs a tick later and is allowed to change the world.
- **Subcommands.** Calling the returned function again adds subcommands. They are dispatched through one command with an enum, so they share autocomplete.
- **Parameter types.** `string`, `int`, `float`, `bool`, `location`, `player`, `players`, `entity`, `entities`, `block`, `item`, `entitytype`, and enums as an array of values. Add `?` to the name for optional. `min` / `max` on numbers are checked for you.
- **Permissions and tags.** `permission` (`any`, `gamedirectors`, `admin`, `host`, `owner`), `cheats`, `from` (player, entity, block, server) and `tags`: the player needs at least one of them (`tags: ["staff"]`, set `permission: "any"` so they don't need operator).
- **Context.** Handlers get `c` with `c.player`, `c.entity`, `c.block`, `c.dimension`, `c.location`, `c.source` and `c.tell(message)`.
- **Help.** `group.help("help")` adds a help command that only lists the commands the player can use.

## Game limits

Bedrock sets these rules for custom commands. The library and the builder check them for you, so you find out before you load the world.

| Limit | What it means |
|---|---|
| 8 parameter slots | Each command takes at most 8 parameters, enums included. |
| Lowercase names | Command, enum and namespace names are lowercase. |
| Quoted strings | A string parameter rejects a bare number, so a numeric subcommand needs an alias. |
| Restart to apply | Changing a command's parameters needs a world restart; `/reload` is not enough. |

## License

MIT, see [LICENSE](LICENSE).
