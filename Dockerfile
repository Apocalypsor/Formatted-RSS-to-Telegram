FROM node:18-alpine

ENV NODE_ENV=production

WORKDIR /app

COPY . /app

RUN apk --no-cache --virtual .build-deps add git build-base libffi-dev libxml2-dev libxslt-dev python-dev \
    && apk add --no-cache python3 py3-pip \
    && pip install morss \
    && yarn install \
    && yarn cache clean \
    && apk del .build-deps \
    && rm -rf /tmp/* /var/tmp/* /var/cache/apk/* /var/cache/distfiles/*

CMD ["yarn", "start"]
