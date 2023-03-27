FROM node:16-bullseye 
RUN apt-get update && apt-get upgrade -y
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
