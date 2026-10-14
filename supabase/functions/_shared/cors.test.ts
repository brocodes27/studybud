import assert from "node:assert/strict";
import { it } from "node:test";
import { getCors } from "./cors.ts";

it("echoes the Curve browser origin on authenticated preflight requests", () => {
  for (const origin of [
    "https://www.curveapp.tech",
    "https://curveapp.tech",
    "https://elevenfolks.com",
    "http://localhost:5173",
  ]) {
    const cors = getCors(
      new Request("https://example.com/material-study", {
        method: "OPTIONS",
        headers: {
          Origin: origin,
          "Access-Control-Request-Headers":
            "authorization,apikey,content-type,x-client-info",
        },
      }),
    );
    assert.equal(cors.allowed, true);
    assert.equal(cors.headers["Access-Control-Allow-Origin"], origin);
    assert.match(cors.headers["Access-Control-Allow-Headers"], /authorization/);
    assert.match(cors.headers["Access-Control-Allow-Methods"], /POST/);
    assert.equal(cors.headers.Vary, "Origin");
  }
});

it("allows HTTP and HTTPS local development origins with any port or no port", () => {
  for (const scheme of ["http", "https"]) {
    for (const host of ["localhost", "127.0.0.1", "0.0.0.0", "[::1]"]) {
      for (const port of ["", ":3000", ":5173", ":8080"]) {
        const origin = `${scheme}://${host}${port}`;
        const cors = getCors(new Request("https://example.com", {
          method: "OPTIONS", headers: { Origin: origin },
        }));
        assert.equal(cors.allowed, true, origin);
        assert.equal(cors.headers["Access-Control-Allow-Origin"], origin);
      }
    }
  }
});

it("rejects unrelated origins and lookalike domains", () => {
  for (const origin of [
    "https://www.curveapp.tech.evil.com",
    "https://evilcurveapp.tech",
    "https://unrelated.example",
    "http://localhost.evil.com:5173",
    "http://localhost:5173@evil.com",
    "http://127.0.0.1:5173@evil.com",
    "http://localhost:5173/path",
    "ftp://localhost:5173",
    "ftp://curveapp.tech",
    "null",
  ]) {
    const cors = getCors(
      new Request("https://example.com", { headers: { Origin: origin } }),
    );
    assert.equal(cors.allowed, false);
    assert.equal(cors.headers["Access-Control-Allow-Origin"], "null");
  }
});
