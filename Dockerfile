# Etapa de build
FROM node:24-alpine3.21 AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build -- --configuration "docker"

# Etapa final
FROM httpd:alpine3.18

WORKDIR /usr/local/apache2/htdocs/
COPY --from=build /app/dist/*/browser/ /usr/local/apache2/htdocs/
EXPOSE 80
