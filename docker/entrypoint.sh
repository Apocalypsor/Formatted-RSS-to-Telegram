#!/usr/bin/env sh

bun run prisma:migrate:deploy
bun run start
