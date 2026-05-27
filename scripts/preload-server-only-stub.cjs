"use strict";

const Module = require("module");
const path = require("path");

const emptyPath = path.join(__dirname, "server-only-empty.cjs");
const origResolve = Module._resolveFilename;

Module._resolveFilename = function (request, parent, isMain, options) {
  if (request === "server-only") {
    return emptyPath;
  }
  return origResolve.call(this, request, parent, isMain, options);
};
