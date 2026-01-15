FROM node:24-bullseye
WORKDIR /app
COPY package.json .
ENV ROLLUP_SKIP_NATIVE=true
RUN npm install --no-package-lock
COPY . .
EXPOSE 5001
CMD ["npm", "run", "dev", "--", "--host"]