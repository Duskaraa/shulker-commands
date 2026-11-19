import {
  CommandPermissionLevel,
  CustomCommandParamType,
  CustomCommandSource,
  CustomCommandStatus,
  system,
  world
} from "@minecraft/server";

var vanilla = new Set([
  "---",
  "aimassist",
  "allowlist",
  "whitelist",
  "camera",
  "camerashake",
  "changesetting",
  "clear",
  "clearspawnpoint",
  "clone",
  "controlscheme",
  "damage",
  "daylock",
  "alwaysday",
  "deop",
  "dialogue",
  "difficulty",
  "editor-allowlist",
  "effect",
  "enchant",
  "event",
  "execute",
  "fill",
  "fog",
  "function",
  "gamemode",
  "gamerule",
  "gametest",
  "give",
  "help",
  "?",
  "hud",
  "inputpermission",
  "kick",
  "kill",
  "list",
  "locate",
  "loot",
  "me",
  "mobevent",
  "music",
  "op",
  "packstack",
  "particle",
  "permission",
  "ops",
  "place",
  "playanimation",
  "playsound",
  "project",
  "recipe",
  "reload",
  "reloadconfig",
  "reloadpacketlimitconfig",
  "replaceitem",
  "ride",
  "save",
  "say",
  "schedule",
  "scoreboard",
  "script",
  "scriptevent",
  "sendshowstoreoffer",
  "serveridentity",
  "setblock",
  "setmaxplayers",
  "setworldspawn",
  "spawnpoint",
  "spreadplayers",
  "stop",
  "stopsound",
  "structure",
  "summon",
  "tag",
  "teleport",
  "tp",
  "tell",
  "w",
  "msg",
  "tellraw",
  "testfor",
  "testforblock",
  "testforblocks",
  "tickingarea",
  "time",
  "title",
  "titleraw",
  "toggledownfall",
  "transfer",
  "weather",
  "wsserver",
  "connect",
  "xp"
]);

var limits = {
  params: 8,
  name: /^[a-z0-9_]+$/,
  namespace: /^[a-z0-9_]+$/,
  enumvalue: /^[^\s"]+$/
};
var types = [
  "string",
  "int",
  "float",
  "bool",
  "location",
  "player",
  "players",
  "entity",
  "entities",
  "block",
  "item",
  "entitytype"
];
var natives = {
  string: "String",
  int: "Integer",
  float: "Float",
  bool: "Boolean",
  location: "Location",
  player: "PlayerSelector",
  players: "PlayerSelector",
  entity: "EntitySelector",
  entities: "EntitySelector",
  block: "BlockType",
  item: "ItemType",
  entitytype: "EntityType",
  enum: "Enum"
};
var levels = {
  any: "Any",
  gamedirectors: "GameDirectors",
  admin: "Admin",
  host: "Host",
  owner: "Owner"
};
var sources = ["player", "entity", "block", "server"];
var degradable = ["string", "int", "float", "bool", "enum"];
var list = (v) => v === void 0 ? void 0 : Array.isArray(v) ? v : [v];
var put = (o, k, v) => {
  if (v !== void 0) o[k] = v;
};
var same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function normparams(params, ctx, path) {
  return (Array.isArray(params) ? params.map((e) => [e.optional ? e.name + "?" : e.name, e]) : Object.entries(params ?? {})).map(([key, raw]) => {
    const optional = key.endsWith("?");
    const name = optional ? key.slice(0, -1) : key;
    const v = typeof raw === "string" ? { type: raw } : Array.isArray(raw) ? { type: "enum", values: raw } : { ...raw };
    if (v.values && !v.type) v.type = "enum";
    const p = { name, type: String(v.type) };
    if (optional) p.optional = true;
    if (v.type === "enum") {
      p.enum = v.enum ?? name;
      if (v.values) {
        const have = ctx.enums[p.enum];
        if (have && !same(have, v.values))
          ctx.issues.push({
            level: "error",
            code: "enum-clash",
            path,
            message: `enum "${p.enum}" already exists with other values; give this one its own name with { enum: "other", values: [...] }`
          });
        else ctx.enums[p.enum] = [...v.values];
      }
    }
    put(p, "min", v.min);
    put(p, "max", v.max);
    return p;
  });
}
function command(def, ctx, path = []) {
  const c = { name: def.name };
  put(c, "description", def.description);
  put(c, "permission", def.permission);
  put(c, "cheats", def.cheats);
  put(c, "from", list(def.from));
  put(c, "tags", list(def.tags));
  put(c, "aliases", def.aliases?.length ? [...def.aliases] : void 0);
  put(c, "help", def.help || void 0);
  put(c, "inline", def.inline === false ? false : void 0);
  put(c, "label", def.label);
  put(c, "slots", def.slots);
  const params = normparams(def.params, ctx, path);
  if (params.length) c.params = params;
  if (def.subs?.length) c.subs = def.subs.map((s, i) => command(s, ctx, [...path, "subs", i]));
  put(c, "code", def.code);
  return c;
}
function normdefaults(d = {}) {
  const o = {};
  put(o, "permission", d.permission);
  put(o, "cheats", d.cheats);
  put(o, "from", list(d.from));
  put(o, "tags", list(d.tags));
  return o;
}
function resolve(spec, cmd) {
  const d = spec.defaults ?? {};
  return {
    permission: cmd.permission ?? d.permission ?? "admin",
    cheats: cmd.cheats ?? d.cheats ?? false,
    from: cmd.from ?? d.from,
    tags: cmd.tags ?? d.tags ?? []
  };
}
function nativename(ns, p) {
  return p.type === "enum" ? `${ns}:${p.enum}` : p.name;
}
function validate(spec, has) {
  const issues = [];
  const add = (level2, code, path, message) => issues.push({ level: level2, code, path, message });
  const err = (code, path, message) => add("error", code, path, message);
  const enums = spec.enums ?? {};
  const names = new Set();
  const ns = spec.namespace;
  if (typeof ns !== "string" || !limits.namespace.test(ns))
    err("ns", ["namespace"], "namespace must be lowercase letters, digits or _");
  const name = (n, path, what) => {
    if (typeof n !== "string" || !limits.name.test(n)) err("name", path, `${what} "${n}" must match ${limits.name}`);
  };
  const cheats = (v, path) => {
    if (v !== void 0 && typeof v !== "boolean") err("cheats", path, `cheats must be true or false`);
  };
  for (const [k, v] of Object.entries(enums)) {
    name(k, ["enums", k], "enum");
    if (!v.length) err("enum-empty", ["enums", k], `enum "${k}" has no values`);
    if (new Set(v).size !== v.length) err("enum-dup", ["enums", k], `enum "${k}" has repeated values`);
    for (const x of v)
      if (typeof x !== "string" || !limits.enumvalue.test(x))
        err("enum-value", ["enums", k], `enum "${k}" value "${x}" is empty or has spaces or quotes`);
  }
  const level = (v, path) => {
    if (v !== void 0 && !(v in levels)) err("perm", path, `unknown permission "${v}"`);
  };
  const from = (v, path) => {
    for (const s of v ?? []) if (!sources.includes(s)) err("from", path, `unknown source "${s}"`);
  };
  const tags = (v, path) => {
    for (const t of v ?? [])
      if (typeof t !== "string" || !/^\S+$/.test(t)) err("tag", path, `tag "${t}" must be a word without spaces`);
  };
  const reserve = (n, path) => {
    if (names.has(n)) err("dup", path, `name "${n}" is already used in this group`);
    names.add(n);
    if (vanilla.has(n))
      add("warn", "shadow", path, `"${n}" is a vanilla command or alias; players must type /${ns}:${n}`);
  };
  const params = (list2 = [], path) => {
    const seen = new Set();
    let opt = false;
    if (list2.length > limits.params) err("limit", path, `more than ${limits.params} parameters`);
    list2.forEach((p, i) => {
      const at = [...path, "params", i];
      name(p.name, at, "parameter");
      if (p.type !== "enum" && !types.includes(p.type)) err("ptype", at, `unknown parameter type "${p.type}"`);
      if (p.type === "enum") {
        if (!enums[p.enum]) err("ptype", at, `enum "${p.enum}" is not defined`);
        name(p.enum, at, "enum");
      }
      const n = nativename(ns, p);
      if (seen.has(n)) err("pname", at, `parameter name "${n}" is repeated`);
      seen.add(n);
      if (p.optional) opt = true;
      else if (opt) err("order", at, `required parameter "${p.name}" after an optional one`);
      for (const k of ["min", "max"])
        if (p[k] !== void 0 && typeof p[k] !== "number") err("range", at, `${k} must be a number`);
      if (p.min !== void 0 || p.max !== void 0) {
        if (p.type !== "int" && p.type !== "float") err("range", at, `min/max only apply to int and float`);
        else if (p.min > p.max) err("range", at, `min ${p.min} is greater than max ${p.max}`);
      }
    });
  };
  const node = (c, path, root) => {
    name(c.name, [...path, "name"], root ? "command" : "subcommand");
    if (root && (typeof c.description !== "string" || !c.description))
      err("desc", [...path, "description"], "description is required");
    if (root) level(c.permission, [...path, "permission"]);
    cheats(c.cheats, [...path, "cheats"]);
    if (c.label !== void 0) name(c.label, [...path, "label"], "label");
    if (c.slots !== void 0 && !Array.isArray(c.slots))
      err("name", [...path, "slots"], "slots must be a list of names");
    else c.slots?.forEach((n, i) => name(n, [...path, "slots", i], "slot"));
    from(c.from, [...path, "from"]);
    tags(c.tags, [...path, "tags"]);
    params(c.params, path);
    c.aliases?.forEach((a, i) => {
      name(a, [...path, "aliases", i], "alias");
      reserve(a, [...path, "aliases", i]);
    });
  };
  level(spec.defaults?.permission, ["defaults", "permission"]);
  cheats(spec.defaults?.cheats, ["defaults", "cheats"]);
  from(spec.defaults?.from, ["defaults", "from"]);
  tags(spec.defaults?.tags, ["defaults", "tags"]);
  spec.commands.forEach((c, i) => {
    const path = ["commands", i];
    node(c, path, true);
    reserve(c.name, [...path, "name"]);
    const r = resolve(spec, c);
    if (["admin", "host", "owner"].includes(r.permission))
      add("warn", "block", path, `"${c.name}" needs ${r.permission}: command blocks and functions can't run it`);
    const subs = c.subs ?? [];
    if (subs.length && c.params?.length) err("handler", path, `"${c.name}" has subcommands and its own params`);
    if (c.help && !subs.length) err("sub-empty", path, `"${c.name}" has help but no subcommands`);
    const seen = new Set();
    subs.forEach((s, j) => {
      const sp = [...path, "subs", j];
      node(s, sp, false);
      if (seen.has(s.name)) err("dup", sp, `subcommand "${s.name}" is repeated in "${c.name}"`);
      seen.add(s.name);
      if (c.help && s.name === "help") err("dup", sp, `subcommand "help" collides with help: true in "${c.name}"`);
      if (s.subs?.length) err("handler", sp, "only one level of subcommands is supported");
      if (s.inline === false && !s.aliases?.length)
        err("sub-empty", sp, `"${s.name}" is inline:false and has no aliases, so it can't be called`);
      if (has && !has(c, s)?.run && !has(c, s)?.apply) err("handler", sp, `"${s.name}" needs run or apply`);
    });
    if (has) {
      const h = has(c);
      if (!subs.length && !h?.run && !h?.apply) err("handler", path, `"${c.name}" needs run, apply or subcommands`);
      if (r.permission === "any" && !r.from && !r.tags.length && h?.apply)
        add("warn", "open", path, `"${c.name}" is open to everyone and changes the world`);
    }
  });
  return issues;
}

var same2 = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
var slot = (p, enums, mode, i) => ({
  key: p.name,
  type: p.type,
  optional: !!p.optional,
  min: p.min,
  max: p.max,
  values: p.type === "enum" ? enums[p.enum] : void 0,
  slot: i,
  mode
});
var nativeof = (cmdname, ns, description, level, cheats, slots) => ({
  name: `${ns}:${cmdname}`,
  description,
  permissionLevel: levels[level],
  cheatsRequired: cheats,
  mandatoryParameters: slots.filter((s) => !s.optional).map((s) => ({ name: s.native, type: s.ntype })),
  optionalParameters: slots.filter((s) => s.optional).map((s) => ({ name: s.native, type: s.ntype }))
});
var pick = (names) => {
  const count = new Map();
  for (const n of names) count.set(n, (count.get(n) ?? 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1])[0][0];
};
function merge(spec, cmd, subs, issues, path) {
  const ns = spec.namespace;
  const enums = spec.enums ?? {};
  const width = Math.max(0, ...subs.map((s) => s.params?.length ?? 0));
  if (1 + width > limits.params) {
    issues.push({
      level: "error",
      code: "limit",
      path,
      message: `"${cmd.name}" needs ${1 + width} slots; the limit is ${limits.params}. Use inline:false with aliases for the widest subcommands`
    });
    return;
  }
  const label = cmd.label ?? `${cmd.name}_action`;
  const slots = [{ native: `${ns}:${label}`, ntype: natives.enum, optional: false }];
  const unions = [[label, [...subs.map((s) => s.name), ...cmd.help ? ["help"] : []]]];
  const cols = [];
  for (let i = 0; i < width; i++) {
    const ps = subs.map((s) => s.params?.[i]).filter(Boolean);
    const named = cmd.slots?.[i];
    let col;
    if (new Set(ps.map((p) => natives[p.type])).size === 1) {
      const vals = ps.map((p) => enums[p.enum]);
      if (ps[0].type === "enum" && vals.every((v) => same2(v, vals[0])))
        col = { mode: "native", native: `${ns}:${ps[0].enum}`, ntype: natives.enum };
      else if (ps[0].type === "enum") {
        col = { mode: "member", native: `${ns}:${cmd.name}_${i + 1}`, ntype: natives.enum };
        unions.push([`${cmd.name}_${i + 1}`, [...new Set(vals.flat())]]);
      } else col = { mode: "native", native: named ?? pick(ps.map((p) => p.name)), ntype: natives[ps[0].type] };
    } else if (ps.every((p) => p.type === "int" || p.type === "float")) {
      col = { mode: "num", native: named ?? pick(ps.map((p) => p.name)), ntype: natives.float };
    } else if (ps.every((p) => degradable.includes(p.type))) {
      col = { mode: "coerce", native: named ?? pick(ps.map((p) => p.name)), ntype: natives.string };
      const num = subs.filter((s) => ["int", "float"].includes(s.params?.[i]?.type) && !s.aliases?.length);
      if (num.length) {
        issues.push({
          level: "error",
          code: "quote",
          path,
          message: `"${cmd.name}" slot ${i + 1} mixes numbers and words; bedrock rejects a bare number in a String slot. give ${num.map((s) => `"${s.name}"`).join(", ")} an alias, or move the number to another slot`
        });
        return;
      }
    } else {
      issues.push({
        level: "error",
        code: "sub-merge",
        path,
        message: `"${cmd.name}" slot ${i + 1} mixes ${[...new Set(ps.map((p) => p.type))].join(", ")}; move the parameter or use inline:false with an alias`
      });
      return;
    }
    col.optional = !subs.every((s) => s.params?.[i] && !s.params[i].optional);
    cols.push(col);
    slots.push(col);
  }
  const taken = new Set();
  for (const s of slots) {
    let n = s.native;
    for (let k = 2; taken.has(n); k++) n = `${s.native}_${k}`;
    s.native = n;
    taken.add(n);
  }
  const plans = [
    ...subs.map((s) => {
      const params = (s.params ?? []).map((p, i) => slot(p, enums, cols[i].mode, i + 1));
      return { name: s.name, params, need: params.filter((p) => !p.optional).length, max: params.length };
    }),
    ...cmd.help ? [{ name: "help", params: [], need: 0, max: 0, builtin: true }] : []
  ];
  return {
    slots: [slots[0], ...slots.slice(1).filter((s) => !s.optional), ...slots.slice(1).filter((s) => s.optional)],
    plans,
    unions,
    degraded: cols.map((c, i) => c.mode === "coerce" ? i + 1 : 0).filter(Boolean)
  };
}
function plan(spec, has) {
  const issues = validate(spec, has);
  const bad = new Set(issues.filter((i) => i.level === "error" && i.path[0] === "commands").map((i) => i.path[1]));
  const ns = spec.namespace;
  const enums = spec.enums ?? {};
  const out = { enums: [], commands: [], issues };
  const seen = new Set();
  const addenum = (name, values) => {
    if (seen.has(name)) return;
    seen.add(name);
    out.enums.push([`${ns}:${name}`, values]);
  };
  const direct = (name, description, r, params, cmd, sub) => {
    const slots = params.map((p, i) => ({
      ...slot(p, enums, "native", i),
      native: nativename(ns, p),
      ntype: natives[p.type]
    }));
    for (const p of params) if (p.type === "enum") addenum(p.enum, enums[p.enum]);
    out.commands.push({
      name,
      mode: "direct",
      cmd,
      sub,
      native: nativeof(name, ns, description, r.permission, r.cheats, slots),
      params: slots.map(({ native, ntype, ...rest }) => rest)
    });
  };
  spec.commands.forEach((c, i) => {
    if (bad.has(i)) return;
    const path = ["commands", i];
    const r = resolve(spec, c);
    const inline = (c.subs ?? []).filter((s) => s.inline !== false);
    if (!c.subs?.length) {
      direct(c.name, c.description, r, c.params ?? [], c.name);
      for (const a of c.aliases ?? []) direct(a, c.description, r, c.params ?? [], c.name);
      return;
    }
    if (inline.length) {
      const m = merge(spec, c, inline, issues, path);
      if (!m) return;
      for (const [n, v] of m.unions) addenum(n, v);
      for (const k of m.degraded)
        issues.push({
          level: "warn",
          code: "degrade",
          path,
          message: `"${c.name}" slot ${k} is a String (conversion per subcommand); add an alias for full autocomplete`
        });
      const dispatch = (name) => ({
        name,
        mode: "dispatch",
        cmd: c.name,
        subs: m.plans,
        native: nativeof(name, ns, c.description, r.permission, r.cheats, m.slots)
      });
      for (const s of inline) for (const p of s.params ?? []) if (p.type === "enum") addenum(p.enum, enums[p.enum]);
      out.commands.push(dispatch(c.name));
      for (const a of c.aliases ?? []) out.commands.push(dispatch(a));
    }
    for (const s of c.subs)
      for (const a of s.aliases ?? []) direct(a, s.description ?? c.description, r, s.params ?? [], c.name, s.name);
  });
  return out;
}

var isplayer = (e) => e?.typeId === "minecraft:player";
var context = class {
  #env;
  #source;
  #player;
  #dimension;
  constructor(origin, name, sub, env) {
    this.origin = origin;
    this.name = name;
    this.sub = sub;
    this.#env = env;
  }
  get source() {
    if (this.#source) return this.#source;
    const s = this.#env.sources;
    const t = this.origin.sourceType;
    return this.#source = t === s.Block ? "block" : t === s.Server ? "server" : t === s.NPCDialogue ? "npc" : isplayer(this.origin.sourceEntity) ? "player" : "entity";
  }
  get player() {
    if (this.#player !== void 0) return this.#player || void 0;
    const p = this.origin.initiator ?? this.origin.sourceEntity;
    this.#player = isplayer(p) ? p : null;
    return this.#player || void 0;
  }
  get entity() {
    return this.origin.sourceEntity;
  }
  get block() {
    return this.origin.sourceBlock;
  }
  get trusted() {
    return this.source === "block" || this.source === "server";
  }
  get dimension() {
    return this.#dimension ??= (this.player ?? this.entity ?? this.block)?.dimension ?? this.#env.overworld();
  }
  get location() {
    return (this.player ?? this.entity ?? this.block)?.location ?? { x: 0, y: 0, z: 0 };
  }
  tell(message) {
    const p = this.player;
    if (p) p.sendMessage(message);
    else console.log(typeof message === "string" ? message : JSON.stringify(message));
  }
  defer(fn) {
    const who = this.player ?? this.entity;
    const label = `${this.name}${this.sub ? " " + this.sub : ""}`;
    this.#env.system.run(() => {
      if (who && who.isValid === false) return;
      try {
        const r = fn();
        if (r && typeof r.then === "function")
          r.then(void 0, (e) => console.error(`[${this.#env.ns}:${label}] apply rejected`, e));
      } catch (e) {
        console.error(`[${this.#env.ns}:${label}] apply failed`, e);
      }
    });
  }
};

var show = (p) => p.optional ? `[${p.name}]` : `<${p.name}>`;
function find(spec, name, sub) {
  for (const c of spec.commands) {
    if (c.name === name || c.aliases?.includes(name))
      return { cmd: c, sub: sub ? c.subs?.find((s) => s.name === sub) : void 0, alias: c.name !== name };
    for (const s of c.subs ?? []) if (s.aliases?.includes(name)) return { cmd: c, sub: s, alias: true };
  }
}
function usage(spec, name, sub) {
  const f = find(spec, name, sub);
  if (!f || sub && !f.sub && sub !== "help") return void 0;
  const { cmd, sub: s } = f;
  if (s) return `/${name} ${f.alias && !sub ? "" : s.name + " "}${(s.params ?? []).map(show).join(" ")}`.trim();
  if (sub === "help") return `/${name} help`;
  if (cmd.subs?.length) {
    return `/${name} <${[...cmd.subs.filter((x) => x.inline !== false).map((x) => x.name), ...cmd.help ? ["help"] : []].join("|")}>`;
  }
  return `/${name} ${(cmd.params ?? []).map(show).join(" ")}`.trim();
}
function lines(spec, name) {
  const out = [];
  for (const c of spec.commands) {
    if (name && c.name !== name) continue;
    if (!name || !c.subs?.length) {
      out.push({ cmd: c.name, text: usage(spec, c.name), description: c.description });
      continue;
    }
    for (const s of c.subs)
      if (s.inline !== false)
        out.push({ cmd: c.name, sub: s.name, text: usage(spec, c.name, s.name), description: s.description });
    if (c.help)
      out.push({ cmd: c.name, sub: "help", text: usage(spec, c.name, "help"), description: "Show this list" });
  }
  return out;
}

var messages = {
  player: "Run this as a player.",
  source: "This command can't be run from here.",
  tags: "You need one of these tags: {tags}.",
  error: "Command failed. Check the server log.",
  usage: "Usage: ",
  range: "{name} must be between {min} and {max}.",
  min: "{name} must be at least {min}.",
  max: "{name} must be at most {max}.",
  one: "Select exactly one {name}.",
  none: "No matching targets.",
  bad: "Invalid value for {name}."
};
var nope = {};
var text = {
  string: (v) => v,
  int: (v) => /^-?\d+$/.test(v) ? Number(v) : nope,
  float: (v) => /^-?(\d+\.?\d*|\.\d+)$/.test(v) ? Number(v) : nope,
  bool: (v) => v === "true" ? true : v === "false" ? false : nope,
  enum: (v, p) => p.values.includes(v) ? v : nope
};
function value(p, v) {
  if (p.mode === "coerce") v = text[p.type](v, p);
  else if (p.mode === "num" && p.type === "int" && !Number.isInteger(v)) return nope;
  else if (p.type === "enum" && !p.values.includes(v)) return nope;
  if (v === nope) return nope;
  if (p.type === "player" || p.type === "entity") return v.length === 1 ? v[0] : nope;
  if (p.type === "players" || p.type === "entities") return v.length ? v : nope;
  if (p.min !== void 0 && v < p.min || p.max !== void 0 && v > p.max) return nope;
  return v;
}
var fill = (s, o) => s.replace(/\{(\w+)\}/g, (_, k) => o[k]);
function why(p, v, msg) {
  const o = { name: p.key, min: p.min, max: p.max };
  if (p.type === "player" || p.type === "entity") return fill(v.length ? msg.one : msg.none, o);
  if (p.type === "players" || p.type === "entities") return fill(msg.none, o);
  if (p.min !== void 0 || p.max !== void 0)
    return fill(
      typeof v !== "number" ? msg.bad : p.min === void 0 ? msg.max : p.max === void 0 ? msg.min : msg.range,
      o
    );
  return fill(msg.bad, o);
}
function build(p, tree, env) {
  const msg = { ...messages, ...env.messages };
  const fail2 = (message) => ({ status: env.failure, message });
  const from = (list2, c) => list2.includes(c.source) || c.source === "npc" && (c.player ? list2.includes("player") : list2.includes("entity"));
  const check = (e, c) => {
    if (e.from && !from(e.from, c)) return e.from.length === 1 && e.from[0] === "player" ? msg.player : msg.source;
    if (e.tags.length && !e.tags.some((t) => c.entity?.hasTag(t))) return fill(msg.tags, { tags: e.tags.join(", ") });
  };
  const page = (args, c) => {
    const spec = env.spec();
    if (args.command) {
      return lines(spec, args.command).filter((l) => !l.sub || ok2(spec, l, c)).map((l) => l.description ? `${l.text} - ${l.description}` : l.text).join("\n");
    }
    const all = spec.commands.filter((x) => ok2(spec, { cmd: x.name }, c)).map((x) => ({ text: usage(spec, x.name), description: x.description }));
    const size = 8;
    const pages = Math.max(1, Math.ceil(all.length / size));
    const n = Math.min(Math.max(args.page ?? 1, 1), pages);
    return [
      `Commands (${n}/${pages})`,
      ...all.slice((n - 1) * size, n * size).map((l) => `${l.text} - ${l.description}`)
    ].join("\n");
  };
  const ok2 = (spec, l, c) => {
    const e = tree[l.cmd];
    if (!e) return true;
    const level = c.player?.commandPermissionLevel;
    if (level !== void 0 && level < env.levels[levels[resolve(
      spec,
      spec.commands.find((x) => x.name === l.cmd)
    ).permission]])
      return false;
    if (check(e, c)) return false;
    const s = l.sub && e.subs[l.sub];
    return !s || !check(s, c);
  };
  const result = (r) => {
    if (r === void 0 || r === null || r === true) return { status: env.success };
    if (r === false) return { status: env.failure };
    if (typeof r === "string") return { status: env.success, message: r };
    if (typeof r !== "object") return { status: env.success };
    return typeof r.status === "number" ? r : { ...r, status: env.success };
  };
  const read = (params, raw, state) => {
    const args = {};
    for (const p2 of params) {
      const v = raw[p2.slot];
      if (v === void 0) {
        if (p2.optional) continue;
        state.err = fill(msg.bad, { name: p2.key });
        return;
      }
      const x = value(p2, v);
      if (x === nope) {
        state.err = why(p2, v, msg);
        return;
      }
      args[p2.key] = x;
    }
    return args;
  };
  return p.commands.map((pc) => {
    const h = tree[pc.cmd];
    const subs = pc.mode === "dispatch" ? new Map(pc.subs.map((s) => [s.name, s])) : void 0;
    const label = `${env.ns}:${pc.name}`;
    const callback = (origin, ...raw) => {
      const c = new context(origin, pc.name, pc.sub, env);
      try {
        let denied = check(h, c);
        if (denied) return fail2(denied);
        let entry = pc.sub ? h.subs[pc.sub] : h;
        let params = pc.params;
        let shown = usage(env.spec(), pc.name, pc.sub);
        if (subs) {
          const s = subs.get(raw[0]);
          if (!s) return fail2(`${msg.usage}${shown}`);
          c.sub = s.name;
          entry = s.builtin ? { run: "help" } : h.subs[s.name];
          if (!s.builtin) {
            denied = check(entry, c);
            if (denied) return fail2(denied);
          }
          params = s.params;
          shown = usage(env.spec(), pc.name, s.name);
          for (let i = 1 + s.max; i < raw.length; i++) if (raw[i] !== void 0) return fail2(`${msg.usage}${shown}`);
        } else if (pc.sub) {
          denied = check(entry, c);
          if (denied) return fail2(denied);
        }
        const state = {};
        const args = read(params, raw, state);
        if (!args) return fail2(`${state.err} ${msg.usage}${shown}`);
        const out = entry.run === "help" ? page({ command: pc.cmd }, c) : entry.run === "globalhelp" ? page(args, c) : entry.run?.(args, c);
        if (out && typeof out.then === "function") {
          console.error(`[${label}] run can't be async, use apply`);
          return fail2(msg.error);
        }
        const r = result(out);
        if (r.status === env.success && entry.apply) c.defer(() => entry.apply(args, c));
        return r;
      } catch (e) {
        const hint = /privilege|read-only|restricted/i.test(String(e?.message)) ? " (writes go in apply)" : "";
        console.error(`[${label}] ${e?.stack ?? e}${hint}`);
        return fail2(msg.error);
      }
    };
    return { native: pc.native, callback };
  });
}

var local = new Set([
  "name",
  "desc",
  "ptype",
  "pname",
  "order",
  "range",
  "perm",
  "from",
  "tag",
  "enum-empty",
  "enum-dup",
  "enum-value",
  "limit",
  "cheats"
]);
var reasons = {
  AlreadyRegistered: (n) => `${n} already exists (another pack or a double import)`,
  RegistryReadOnly: (n) => `${n} changed its parameters: restart the world (/reload only swaps handlers)`,
  EnumDependencyMissing: (n) => `${n} framework bug: an enum was registered too late`,
  NamespaceMismatch: (n) => `${n} uses another namespace than the rest of the pack`,
  ParameterLimit: (n) => `${n} hit the real parameter limit, lower limits.params`,
  RegistryInvalid: (n) => `${n} was registered outside startup`
};
var hof = (x) => typeof x === "function" ? { run: x } : { run: x?.run, apply: x?.apply };
var namespace;
var fail = (message) => ({ status: CustomCommandStatus.Failure, message });
var ok = (message) => ({ status: CustomCommandStatus.Success, message });
var attempt = (name, fn) => {
  try {
    fn();
  } catch (e) {
    console.error(`[shulkercommands] ${(reasons[e.reason] ?? ((n) => `${n}: ${e.message}`))(name)}`);
  }
};
function commands(ns, defaults = {}) {
  if (namespace && namespace !== ns)
    throw new Error(`shulkercommands: namespace "${ns}" differs from "${namespace}"; a pack has one namespace`);
  namespace = ns;
  const g = { defs: [], enums: {}, loaded: {}, sealed: false };
  const specof = () => {
    const d = { ...g.loaded, ...normdefaults(defaults) };
    const s = { v: 1, namespace: ns };
    if (Object.keys(d).length) s.defaults = d;
    if (Object.keys(g.enums).length) s.enums = JSON.parse(JSON.stringify(g.enums));
    s.commands = g.defs.map((e) => e.spec);
    return s;
  };
  const guard = (cmd, parent) => {
    const bad = validate({
      v: 1,
      namespace: ns,
      enums: g.enums,
      defaults: normdefaults(defaults),
      commands: [parent ? { name: parent.name, description: parent.description || "-", subs: [cmd] } : cmd]
    }).filter((i) => i.level === "error" && local.has(i.code));
    if (bad.length) throw new Error(`[${ns}:${cmd.name}] ${bad.map((i) => `${i.code}: ${i.message}`).join("; ")}`);
  };
  const add = (parent) => (name, def) => {
    if (g.sealed) throw new Error(`shulkercommands: "${name}" defined after startup; define commands at import time`);
    if (parent && (parent.root === false || parent.h.run || parent.h.apply || parent.spec.params))
      throw new Error(
        `[${ns}:${parent.spec.name}] handler: a command with run, apply or params can't have subcommands, and subcommands can't nest`
      );
    const ctx = { enums: g.enums, issues: [] };
    const spec = command({ ...def, name }, ctx);
    const clash = ctx.issues.find((i) => i.level === "error");
    if (clash) throw new Error(`[${ns}:${name}] ${clash.code}: ${clash.message}`);
    guard(spec, parent?.spec);
    const entry = { spec, h: { run: def.run, apply: def.apply, tags: list(def.tags), subs: {} }, root: !parent };
    if (parent) {
      (parent.spec.subs ??= []).push(spec);
      parent.h.subs[name] = entry.h;
    } else g.defs.push(entry);
    return add(entry);
  };
  const seal = (registry) => {
    g.sealed = true;
    const s = specof();
    const tree = {};
    const node = (e, spec, root) => ({
      from: spec.from ?? (root ? s.defaults?.from : void 0),
      tags: e.tags ?? spec.tags ?? (root ? s.defaults?.tags : void 0) ?? [],
      run: e.run,
      apply: e.apply,
      subs: Object.fromEntries((spec.subs ?? []).map((x) => [x.name, node(e.subs[x.name] ?? {}, x, false)]))
    });
    for (const e of g.defs) tree[e.spec.name] = node(e.h, e.spec, true);
    if (g.help && s.commands.flatMap((c) => [c.name, ...c.aliases ?? []]).includes(g.help))
      console.error(`[${ns}] help: "${g.help}" is already a command name`);
    else if (g.help) {
      const ctx = { enums: s.enums ?? {}, issues: [] };
      s.commands = [
        ...s.commands,
        command(
          {
            name: g.help,
            description: "Show command help",
            permission: "any",
            params: {
              "command?": { enum: `${g.help}_command`, values: s.commands.map((c) => c.name) },
              "page?": { type: "int", min: 1 }
            }
          },
          ctx
        )
      ];
      s.enums = ctx.enums;
      tree[g.help] = { tags: [], subs: {}, run: "globalhelp" };
    }
    const p = plan(s, (c, sub) => {
      const e = sub ? tree[c.name]?.subs[sub.name] : tree[c.name];
      return e && { run: !!e.run, apply: !!e.apply };
    });
    for (const i of p.issues)
      console[i.level === "error" ? "error" : "warn"](`[${ns}] ${i.code} ${i.path.join(".")}: ${i.message}`);
    const env = {
      ns,
      system,
      sources: CustomCommandSource,
      success: CustomCommandStatus.Success,
      failure: CustomCommandStatus.Failure,
      levels: CommandPermissionLevel,
      messages: defaults.messages,
      spec: () => s,
      overworld: () => world.getDimension("overworld")
    };
    const q = (x) => ({ name: x.name, type: CustomCommandParamType[x.type] });
    for (const [name, values] of p.enums) attempt(name, () => registry.registerEnum(name, values));
    for (const b of build(p, tree, env)) {
      const n = b.native;
      attempt(
        n.name,
        () => registry.registerCommand(
          {
            ...n,
            permissionLevel: CommandPermissionLevel[n.permissionLevel],
            mandatoryParameters: n.mandatoryParameters.map(q),
            optionalParameters: n.optionalParameters.map(q)
          },
          b.callback
        )
      );
    }
  };
  system.beforeEvents.startup.subscribe((e) => seal(e.customCommandRegistry));
  const group = add(void 0);
  group.help = (name) => {
    if (g.sealed) throw new Error("shulkercommands: help() after startup");
    g.help = name;
  };
  group.usage = (name, sub) => usage(specof(), name, sub);
  group.spec = specof;
  group.load = (input, handlers = {}) => {
    if (g.sealed) throw new Error("shulkercommands: load() after startup");
    if (input.namespace !== ns)
      throw new Error(`shulkercommands: spec namespace "${input.namespace}" differs from "${ns}"`);
    const ctx = { enums: g.enums, issues: [] };
    for (const [k, v] of Object.entries(input.enums ?? {})) ctx.enums[k] ??= [...v];
    const cmds = (input.commands ?? []).map((c, i) => command(c, ctx, ["commands", i]));
    const bad = ctx.issues.find((i) => i.level === "error");
    if (bad) throw new Error(`[${ns}] ${bad.code}: ${bad.message}`);
    g.loaded = { ...g.loaded, ...normdefaults(input.defaults) };
    for (const c of cmds) {
      const hh = handlers[c.name];
      g.defs.push({
        spec: c,
        root: true,
        h: {
          ...c.subs?.length ? {} : hof(hh),
          subs: Object.fromEntries((c.subs ?? []).map((x) => [x.name, hof(hh?.[x.name])]))
        }
      });
    }
  };
  return group;
}
export {
  commands,
  fail,
  ok
};
