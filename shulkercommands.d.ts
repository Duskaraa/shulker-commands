import type {
  Block,
  BlockType,
  CustomCommandOrigin,
  CustomCommandResult,
  Dimension,
  Entity,
  EntityType,
  ItemType,
  Player,
  RawMessage,
  Vector3,
} from "@minecraft/server";

type scalar = {
  string: string;
  int: number;
  float: number;
  bool: boolean;
  location: Vector3;
  player: Player;
  players: Player[];
  entity: Entity;
  entities: Entity[];
  block: BlockType;
  item: ItemType;
  entitytype: EntityType;
};

type param =
  | keyof scalar
  | readonly string[]
  | { type: keyof scalar; min?: number; max?: number }
  | { enum?: string; values: readonly string[] };

type value<p> = p extends keyof scalar
  ? scalar[p]
  : p extends readonly (infer v)[]
    ? v
    : p extends { values: readonly (infer v)[] }
      ? v
      : p extends { type: infer t extends keyof scalar }
        ? scalar[t]
        : never;

type args<p> = { [k in keyof p as k extends `${string}?` ? never : k]: value<p[k]> } & {
  [k in keyof p as k extends `${infer n}?` ? n : never]?: value<p[k]>;
};

export type source = "player" | "entity" | "block" | "server";
export type permission = "any" | "gamedirectors" | "admin" | "host" | "owner";
export type out = void | null | boolean | string | CustomCommandResult;

export interface context<f = unknown> {
  origin: CustomCommandOrigin;
  source: source | "npc";
  trusted: boolean;
  player: [f] extends ["player"] ? Player : Player | undefined;
  entity?: Entity;
  block?: Block;
  dimension: Dimension;
  location: Vector3;
  name: string;
  sub?: string;
  tell(message: string | RawMessage): void;
  defer(fn: () => unknown): void;
}

interface body<p, f> {
  params?: p;
  from?: f;
  tags?: string | readonly string[];
  aliases?: string[];
  run?(args: args<p>, c: context<f>): out;
  apply?(args: args<p>, c: context<f>): unknown;
}

export interface define<base> {
  <const p extends Record<string, param> = {}, const f extends source | readonly source[] = source[]>(
    name: string,
    def: base & body<p, f>
  ): define<{ description?: string; inline?: boolean }>;
}

export interface messages {
  player: string;
  source: string;
  tags: string;
  error: string;
  usage: string;
  range: string;
  min: string;
  max: string;
  one: string;
  none: string;
  bad: string;
}

export interface defaults {
  permission?: permission;
  cheats?: boolean;
  from?: source | readonly source[];
  tags?: string | readonly string[];
  messages?: Partial<messages>;
}

export interface specparam {
  name: string;
  type: keyof scalar | "enum";
  optional?: boolean;
  enum?: string;
  min?: number;
  max?: number;
}

export interface speccommand {
  name: string;
  description?: string;
  permission?: permission;
  cheats?: boolean;
  from?: source[];
  tags?: string[];
  aliases?: string[];
  help?: boolean;
  inline?: boolean;
  label?: string;
  slots?: string[];
  params?: specparam[];
  subs?: speccommand[];
  code?: { run?: string; apply?: string };
}

export interface spec {
  v: 1;
  namespace: string;
  defaults?: { permission?: permission; cheats?: boolean; from?: source[]; tags?: string[] };
  enums?: Record<string, string[]>;
  commands: speccommand[];
}

type handler =
  | ((args: any, c: context) => out)
  | { run?: (args: any, c: context) => out; apply?: (args: any, c: context) => unknown };

export interface group extends define<{
  description: string;
  permission?: permission;
  cheats?: boolean;
  help?: boolean;
  label?: string;
  slots?: string[];
}> {
  help(name: string): void;
  usage(name: string, sub?: string): string | undefined;
  spec(): spec;
  load(spec: spec, handlers?: Record<string, handler | Record<string, handler>>): void;
}

export function commands(namespace: string, defaults?: defaults): group;
export function fail(message?: string): CustomCommandResult;
export function ok(message?: string): CustomCommandResult;
