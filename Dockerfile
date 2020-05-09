FROM node:alpine
RUN apk add --update-cache python build-base p7zip

WORKDIR /usr/src/app
COPY package*.json ./

COPY . .
RUN npm install 
VOLUME /data

EXPOSE 8080
EXPOSE 3000
CMD [ "npm", "run","dev" ]