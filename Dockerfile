FROM node:18-alpine

ENV NODE_ENV=production

WORKDIR /app

COPY . /app

RUN yarn install

CMD ["yarn", "start"]
