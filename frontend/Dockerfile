FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/package.json
RUN npm ci
COPY frontend/ frontend/
COPY photos/ photos/
ARG VITE_API_URL=http://localhost:8000
ARG VITE_GA_ID=
ARG VITE_ADSENSE_CLIENT_ID=
ARG VITE_ADSENSE_SLOT_ID=
ENV VITE_API_URL=$VITE_API_URL \
    VITE_GA_ID=$VITE_GA_ID \
    VITE_ADSENSE_CLIENT_ID=$VITE_ADSENSE_CLIENT_ID \
    VITE_ADSENSE_SLOT_ID=$VITE_ADSENSE_SLOT_ID
RUN npm --workspace frontend run build

FROM nginx:1.27-alpine
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
