import assert from "node:assert/strict";
import {
  canSchoolPortalRoleSignUp,
  readSchoolPortalRole,
  schoolAuthHref,
} from "./schoolAuth";

assert.equal(readSchoolPortalRole("chain_head"), "chain_head");
assert.equal(readSchoolPortalRole("principal"), "principal");
assert.equal(readSchoolPortalRole("teacher"), "teacher");
assert.equal(readSchoolPortalRole("student"), "teacher");
assert.equal(readSchoolPortalRole(null), "teacher");

assert.equal(canSchoolPortalRoleSignUp("chain_head"), false);
assert.equal(canSchoolPortalRoleSignUp("principal"), false);
assert.equal(canSchoolPortalRoleSignUp("teacher"), true);

assert.equal(schoolAuthHref(), "/auth?portal=schools");
assert.equal(
  schoolAuthHref("principal", "signup"),
  "/auth?portal=schools&role=principal",
  "principal links must never expose signup mode",
);
assert.equal(
  schoolAuthHref("teacher", "signup"),
  "/auth?portal=schools&role=teacher&mode=signup",
);

console.log("School authentication tests passed");
