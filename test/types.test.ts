import * as slowRedact from "../index";

// should return redactFn
slowRedact(); // $ExpectType redactFn
slowRedact({ paths: [] }); // $ExpectType redactFn
slowRedact({ paths: ["some.path"] }); // $ExpectType redactFn
slowRedact({ paths: [], censor: "[REDACTED]" }); // $ExpectType redactFn
slowRedact({ paths: [], strict: true }); // $ExpectType redactFn
slowRedact({ paths: [], serialize: JSON.stringify }); // $ExpectType redactFn
slowRedact({ paths: [], serialize: true }); // $ExpectType redactFn
slowRedact({ paths: [], serialize: false }); // $ExpectType redactFnNoSerialize
slowRedact({ paths: [], remove: true }); // $ExpectType redactFn

// should return string
slowRedact()(""); // $ExpectType string

// should return string or T
slowRedact()({ someField: "someValue" }); // $ExpectType string | { someField: string; }
