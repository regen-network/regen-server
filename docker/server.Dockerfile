FROM golang:1.19-bullseye AS build
# RUN apk -U upgrade
# RUN apk add build-base git linux-headers

# Build regen
WORKDIR /work
RUN git clone https://github.com/regen-network/regen-ledger.git
RUN cd regen-ledger && git checkout v5.1.2 && LEDGER_ENABLED=false make clean build

FROM node:18-bullseye 

# Configure regen
# Copy regen binary
COPY --from=build /work/regen-ledger/build/regen /usr/local/bin/
VOLUME /regen
ENV REGEN_HOME=/regen

RUN apt-get update && apt-get upgrade -y
RUN apt-get install jq -y
WORKDIR /app
COPY yarn.lock .
COPY package.json .
COPY lerna.json .
COPY common/package.json common/package.json
COPY iri-gen/package.json iri-gen/package.json
COPY server/package.json server/package.json
RUN yarn
COPY . .
CMD (cd server && yarn build && yarn start)
