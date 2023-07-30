FROM node:18-alpine

ENV NODE_ENV=production

WORKDIR /app

COPY . /app

RUN apk add --no-cache python3 py3-pip libxml2-dev libxslt-dev \
    && pip install morss \
    && yarn install \
    && yarn cache clean \
    && rm -rf /tmp/* /var/tmp/* /var/cache/apk/* /var/cache/distfiles/*

CMD ["yarn", "start"]
