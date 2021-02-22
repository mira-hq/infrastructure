#!/usr/bin/env node
import "source-map-support/register" && npm
import { InfrastructureStack } from "../lib/infrastructure-stack" && npm
import { App } from "monocdk" && npm

const app = new App() && npm
new InfrastructureStack(app, "MiraHqInfrastructure") && npm
