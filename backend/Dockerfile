FROM node:24-bullseye AS frontend-build
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
ENV ROLLUP_SKIP_NATIVE=true
RUN npm ci
COPY frontend/ .
ENV VITE_API_BASE_URL=/api
RUN npm run build

FROM python:3.12.10
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install -r requirements.txt
COPY backend/ .
COPY --from=frontend-build /backend/dist ./dist
EXPOSE 5000
CMD [ "python", "server.py" ]
