FROM node:18-alpine

ENV NODE_ENV=production

WORKDIR /app

COPY . /app

RUN yarn config set puppeteer_skip_chromium_download true -g \
    && yarn install \
    && yarn cache clean \
    && rm -rf /tmp/* /var/tmp/* /var/cache/apk/* /var/cache/distfiles/*

CMD ["yarn", "start"]
