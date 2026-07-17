#!/usr/bin/env node
import { App } from "aws-cdk-lib";
import { GWLearnStack } from "../gwlearn-stack.ts";

const app = new App();
const allowedOrigin =
  app.node.tryGetContext("allowedOrigin") ??
  process.env.GWLEARN_ALLOWED_ORIGIN ??
  "http://localhost:3000";

new GWLearnStack(app, "GWLearnDevelopment", {
  allowedOrigin,
  description: "GWLearn authenticated video upload foundation",
});
