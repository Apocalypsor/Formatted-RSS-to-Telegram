FROM node:18-alpine

ENV NODE_ENV=production

WORKDIR /app

COPY . /app

RUN apk --no-cache --virtual .build-deps add git build-base libffi-dev libxml2-dev libxslt-dev python3-dev \
    && apk add --no-cache python3 py3-pip \
    && pip install morss --break-system-packages \
    && yarn install --production=false \
    && yarn build \
    && yarn install --production --frozen-lockfile \
    && yarn cache clean \
    && chmod +x /app/docker/entrypoint.sh \
    && apk del .build-deps \
    && rm -rf /tmp/* /var/tmp/* /var/cache/apk/* /var/cache/distfiles/*

ENTRYPOINT ["/app/docker/entrypoint.sh"]
