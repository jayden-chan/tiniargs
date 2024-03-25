export type FlagValue = string | boolean | number;
export type TypeofFlagValue = "string" | "boolean" | "number";
export type LongFlag = string;
export type ShortFlag = string;

export type FlagsRecord = Record<string, FlagValue>;
export type ParsedArgs<T extends FlagsRecord> = {
  positionals: string[];
  flags: T;
};

export type FlagSchema = {
  long: LongFlag;
  short?: ShortFlag;
  required?: boolean;
  defaultValue?: FlagValue;
  valueType: TypeofFlagValue;
};

export class UnknownFlagError extends Error {
  public readonly key: string;
  constructor(key: string, short: boolean) {
    super(`Unknown ${short ? "short flag" : "flag"} "${key}"`);
    this.key = key;
  }
}

export class DuplicateFlagError extends Error {
  public readonly key: string;
  public readonly first: FlagValue;
  public readonly second: FlagValue;
  constructor(key: string, first: FlagValue, second: FlagValue) {
    super(`Flag "${key}" specified twice: "${first}", "${second}"`);
    this.key = key;
    this.first = first;
    this.second = second;
  }
}

export class FlagParseError extends Error {
  public readonly key: string;
  public readonly givenValue: string;
  constructor(msg: string, key: string, givenValue: string) {
    super(msg);
    this.key = key;
    this.givenValue = givenValue;
  }
}

export class SchemaValidationError extends Error {
  constructor(msg: string) {
    super(msg);
  }
}

export class MissingRequiredFlagError extends Error {
  public readonly key: string;
  constructor(key: string) {
    super(`Flag "${key}" is required but was not provided`);
    this.key = key;
  }
}

export class InvalidDefaultValueError extends Error {
  public readonly key: string;
  public readonly valueType: TypeofFlagValue;
  public readonly defaultValueType: string;
  constructor(
    key: string,
    valueType: TypeofFlagValue,
    defaultValueType: string
  ) {
    super(
      `Default value for flag "${key}" is invalid: expected "${valueType}" but got "${defaultValueType}"`
    );
    this.key = key;
    this.valueType = valueType;
    this.defaultValueType = defaultValueType;
  }
}

export function tiniargs<T extends FlagsRecord = FlagsRecord>(
  args: string[],
  schema?: FlagSchema[]
): ParsedArgs<T> {
  const positionals = args.filter((a) => !a.startsWith("-"));

  const flagParseFn =
    schema === undefined
      ? parseFlagNoSchema
      : parseFlagWithShema(validateSchema(schema));

  const parsedFlags = args
    .map(flagParseFn)
    .flat()
    .filter((f): f is [LongFlag, FlagValue] => f !== undefined);

  const flags: FlagsRecord = {};
  parsedFlags.forEach(([key, val]) => {
    if (flags[key] === undefined) {
      flags[key] = val;
    } else {
      throw new DuplicateFlagError(key, flags[key], val);
    }
  });

  if (schema !== undefined) {
    schema
      .filter((s) => s.required === true)
      .forEach((s) => {
        if (flags[s.long] === undefined) {
          throw new MissingRequiredFlagError(s.long);
        }
      });

    schema
      .filter((s) => !s.required && s.defaultValue !== undefined)
      .forEach((s) => {
        if (flags[s.long] === undefined) {
          flags[s.long] = s.defaultValue!;
        }
      });
  }

  return { positionals, flags: flags as T };
}

const FLAG_REGEX = /--?(\w+)(?:=(.*))?/;
const NUMBER_REGEX = /^\d+$/;

const parseFlagNoSchema = (
  arg: string
): ([LongFlag | ShortFlag, FlagValue] | undefined)[] => {
  const [didMatch, key, val] = arg.match(FLAG_REGEX) ?? [];
  if (!didMatch) {
    return [undefined];
  }

  if (NUMBER_REGEX.test(val) && !Number.isNaN(parseInt(val, 10))) {
    return [[key, parseInt(val, 10)]];
  }

  return [[key, val ?? true]];
};

const parseFlagWithShema =
  (schemas: FlagSchema[]) =>
  (arg: string): ([LongFlag, FlagValue] | undefined)[] => {
    const [didMatch, key, val] = arg.match(FLAG_REGEX) ?? [];
    if (!didMatch) {
      return [undefined];
    }

    if (!arg.startsWith("--")) {
      const shortFlags: [ShortFlag, FlagValue][] = [];
      key.split("").forEach((char) => {
        const flagSchema = schemas.find((s) => s.short === char);
        if (flagSchema === undefined) {
          throw new UnknownFlagError(char, true);
        }

        if (flagSchema.valueType !== "boolean") {
          throw new FlagParseError(
            `Cannot specify ${flagSchema.valueType} flag "${flagSchema.long}" in short form`,
            char,
            val
          );
        }

        shortFlags.push([flagSchema.long, true]);
      });

      return shortFlags;
    }

    const flagSchema = schemas.find((s) => s.long === key);
    if (flagSchema === undefined) {
      throw new UnknownFlagError(key, false);
    }

    const { long, valueType } = flagSchema;

    switch (valueType) {
      case "number": {
        const parsed = parseInt(val, 10);
        if (Number.isNaN(parsed)) {
          throw new FlagParseError(
            `Failed to parse numeric flag "${key}" (given value "${val}")`,
            key,
            val
          );
        } else {
          return [[long, parseInt(val, 10)]];
        }
      }

      case "boolean": {
        if (val && val !== "true" && val !== "false") {
          throw new FlagParseError(
            `Invalid value "${val}" for boolean flag "${key}". Expected true or false`,
            key,
            val
          );
        } else {
          return [[long, !val || val === "true"]];
        }
      }

      case "string": {
        if (!val) {
          throw new FlagParseError(
            `Expected flag "${key}" to be a string but got nothing`,
            key,
            val
          );
        } else {
          return [[long, val]];
        }
      }
    }
  };

const validateSchema = (schemas: FlagSchema[]): FlagSchema[] => {
  const longFlags = new Set<LongFlag>();
  const shortFlags = new Set<ShortFlag>();

  schemas.forEach((s) => {
    const { long, short, defaultValue, valueType } = s;

    if (long.length <= 1) {
      throw new SchemaValidationError(
        `Invalid long flag "${long}": flag must be greater than 1 character`
      );
    }

    if (longFlags.has(long)) {
      throw new SchemaValidationError(`Duplicate long flag "${long}"`);
    }

    if (short !== undefined && short.length !== 1) {
      throw new SchemaValidationError(
        `Invalid flag "${long}": short flag must be exactly 1 character`
      );
    }

    if (short !== undefined && shortFlags.has(short)) {
      throw new SchemaValidationError(`Duplicate short flag "${short}"`);
    }

    if (defaultValue !== undefined && typeof defaultValue !== valueType) {
      throw new InvalidDefaultValueError(long, valueType, typeof defaultValue);
    }

    if (!["string", "number", "boolean"].includes(valueType)) {
      throw new SchemaValidationError(
        `Invalid value type for flag "${long}": "${valueType}"`
      );
    }

    longFlags.add(long);

    if (short !== undefined) {
      shortFlags.add(short);
    }
  });

  return schemas;
};
