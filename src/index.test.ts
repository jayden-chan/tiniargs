import {
  DuplicateFlagError,
  FlagParseError,
  SchemaValidationError,
  UnknownFlagError,
  tiniargs,
} from "./index";

test("simple", () => {
  const { positionals, flags } = tiniargs([
    "server",
    "--testflag",
    "--testing=test",
    "--something_else=128",
    "--flag_with_spaces=this is a flag value with spaces in it",
    "asdf123",
    "-f",
    "-l",
    "final positional",
  ]);

  expect(positionals).toStrictEqual(["server", "asdf123", "final positional"]);
  expect(flags).toStrictEqual({
    testflag: true,
    testing: "test",
    something_else: 128,
    flag_with_spaces: "this is a flag value with spaces in it",
    f: true,
    l: true,
  });
});

test("simple duplicate flag", () => {
  const fn = () => tiniargs(["server", "--testflag", "--testflag=false"]);
  expect(fn).toThrow(new DuplicateFlagError(`testflag`, "true", "false"));
});

test("schema duplicate flag (1)", () => {
  const fn = () => {
    tiniargs(
      ["server", "--testflag=false", "--testflag"],
      [{ long: "testflag", short: "l", valueType: "boolean" }]
    );
  };

  expect(fn).toThrow(new DuplicateFlagError(`testflag`, "false", "true"));
});

test("schema duplicate flag (2)", () => {
  const fn = () => {
    tiniargs(
      ["server", "--testflag", "-l"],
      [{ long: "testflag", short: "l", valueType: "boolean" }]
    );
  };

  expect(fn).toThrow(new DuplicateFlagError(`testflag`, "true", "true"));
});

test("schema duplicate flag (3)", () => {
  const fn = () => {
    tiniargs(
      ["server", "-l", "-l"],
      [{ long: "testflag", short: "l", valueType: "boolean" }]
    );
  };

  expect(fn).toThrow(new DuplicateFlagError(`testflag`, "true", "true"));
});

test("schema duplicate flag (4)", () => {
  const fn = () => {
    tiniargs(
      ["server", "-ll"],
      [{ long: "testflag", short: "l", valueType: "boolean" }]
    );
  };

  expect(fn).toThrow(new DuplicateFlagError(`testflag`, "true", "true"));
});

test("schema simple string", () => {
  const { positionals, flags } = tiniargs(
    ["server", "--testflag=testing"],
    [{ long: "testflag", short: "l", valueType: "string" }]
  );

  expect(positionals).toStrictEqual(["server"]);
  expect(flags).toStrictEqual({ testflag: "testing" });
});

test("schema simple boolean", () => {
  const { positionals, flags } = tiniargs(
    ["server", "--testflag"],
    [{ long: "testflag", short: "l", valueType: "boolean" }]
  );

  expect(positionals).toStrictEqual(["server"]);
  expect(flags).toStrictEqual({ testflag: true });
});

test("schema simple numeric", () => {
  const { positionals, flags } = tiniargs(
    ["server", "--testflag=28621"],
    [{ long: "testflag", short: "l", valueType: "number" }]
  );

  expect(positionals).toStrictEqual(["server"]);
  expect(flags).toStrictEqual({ testflag: 28621 });
});

test("schema invalid string (1)", () => {
  const { positionals, flags } = tiniargs(
    ["server", "--testflag=194"],
    [{ long: "testflag", short: "l", valueType: "string" }]
  );

  expect(positionals).toStrictEqual(["server"]);
  expect(flags).toStrictEqual({ testflag: "194" });
});

test("schema invalid string (2)", () => {
  const fn = () => {
    tiniargs(
      ["server", "--testflag"],
      [{ long: "testflag", short: "l", valueType: "string" }]
    );
  };

  expect(fn).toThrow(
    new FlagParseError(
      `Expected flag "testflag" to be a string but got nothing`,
      "",
      ""
    )
  );
});

test("schema invalid boolean (1)", () => {
  const fn = () => {
    tiniargs(
      ["server", "--testflag=4334"],
      [{ long: "testflag", short: "l", valueType: "boolean" }]
    );
  };

  expect(fn).toThrow(
    new FlagParseError(
      `Invalid value "4334" for boolean flag "testflag". Expected true or false`,
      "",
      ""
    )
  );
});

test("schema invalid boolean (2)", () => {
  const fn = () => {
    tiniargs(
      ["server", "--testflag=testflagval"],
      [{ long: "testflag", short: "l", valueType: "boolean" }]
    );
  };

  expect(fn).toThrow(
    new FlagParseError(
      `Invalid value "testflagval" for boolean flag "testflag". Expected true or false`,
      "",
      ""
    )
  );
});

test("schema invalid number (1)", () => {
  const fn = () => {
    tiniargs(
      ["server", "--testflag=testflagval"],
      [{ long: "testflag", short: "l", valueType: "number" }]
    );
  };

  expect(fn).toThrow(
    new FlagParseError(
      `Failed to parse numeric flag "testflag" (given value "testflagval")`,
      "",
      ""
    )
  );
});

test("schema invalid number (2)", () => {
  const fn = () => {
    tiniargs(
      ["server", "--testflag"],
      [{ long: "testflag", short: "l", valueType: "number" }]
    );
  };

  expect(fn).toThrow(
    new FlagParseError(
      `Failed to parse numeric flag "testflag" (given value "undefined")`,
      "",
      ""
    )
  );
});

test("schema unknown flag", () => {
  const fn = () => {
    tiniargs(
      ["server", "--testflag", "--unknown"],
      [{ long: "testflag", short: "l", valueType: "boolean" }]
    );
  };

  expect(fn).toThrow(UnknownFlagError);
});

test("schema short flag stacking", () => {
  const { positionals, flags } = tiniargs(
    ["server", "-face"],
    [
      { long: "fake", short: "f", valueType: "boolean" },
      { long: "aaa", short: "a", valueType: "boolean" },
      { long: "ccc", short: "c", valueType: "boolean" },
      { long: "eee", short: "e", valueType: "boolean" },
    ]
  );

  expect(positionals).toStrictEqual(["server"]);
  expect(flags).toStrictEqual({
    fake: true,
    aaa: true,
    ccc: true,
    eee: true,
  });
});

test("schema short flag long key given", () => {
  const fn = () => {
    tiniargs(
      ["server", "-testflag"],
      [{ long: "testflag", short: "l", valueType: "boolean" }]
    );
  };

  expect(fn).toThrow(UnknownFlagError);
});

test("schema long flag short key stack given", () => {
  const fn = () => {
    tiniargs(
      ["server", "--testflag"],
      [
        { long: "ff", short: "f", valueType: "boolean" },
        { long: "aa", short: "a", valueType: "boolean" },
        { long: "kk", short: "k", valueType: "boolean" },
        { long: "ee", short: "e", valueType: "boolean" },
      ]
    );
  };

  expect(fn).toThrow(UnknownFlagError);
});

test("invalid schema (1)", () => {
  const fn = () => {
    tiniargs(
      ["server", "--testflag"],
      [{ long: "l", short: "l", valueType: "boolean" }]
    );
  };

  expect(fn).toThrow(
    new SchemaValidationError(
      `Invalid long flag "l": flag must be greater than 1 character`
    )
  );
});

test("invalid schema (2)", () => {
  const fn = () => {
    tiniargs(
      ["server", "--testflag"],
      [{ long: "long", short: "ll", valueType: "boolean" }]
    );
  };

  expect(fn).toThrow(
    new SchemaValidationError(
      `Invalid flag "long": short flag must be exactly 1 character`
    )
  );
});

test("invalid schema (3)", () => {
  const fn = () => {
    tiniargs(
      ["server", "--testflag"],
      [{ long: "long", short: "", valueType: "boolean" }]
    );
  };

  expect(fn).toThrow(
    new SchemaValidationError(
      `Invalid flag "long": short flag must be exactly 1 character`
    )
  );
});

test("invalid schema (4)", () => {
  const fn = () => {
    tiniargs(
      ["server", "--testflag"],
      [
        { long: "long", short: "l", valueType: "boolean" },
        { long: "long", short: "q", valueType: "boolean" },
      ]
    );
  };

  expect(fn).toThrow(new SchemaValidationError(`Duplicate long flag "long"`));
});

test("invalid schema (5)", () => {
  const fn = () => {
    tiniargs(
      ["server", "--testflag"],
      [
        { long: "long", short: "l", valueType: "boolean" },
        { long: "longer", short: "l", valueType: "boolean" },
      ]
    );
  };

  expect(fn).toThrow(new SchemaValidationError(`Duplicate short flag "l"`));
});

test("invalid schema (6)", () => {
  const fn = () => {
    tiniargs(
      ["server", "--testflag"],
      // @ts-ignore
      [{ long: "long", short: "l", valueType: "flagval" }]
    );
  };

  expect(fn).toThrow(
    new SchemaValidationError(`Invalid value type for flag "long": "flagval"`)
  );
});
