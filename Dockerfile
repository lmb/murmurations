FROM node:23-alpine

WORKDIR /work

COPY package*.json /work
RUN npm install

COPY . /work
RUN node prod.mjs
