FROM node:lts-alpine3.23


WORKDIR /app

COPY package.json /app/
RUN npm install

COPY src/ /app/src/
COPY vite.config.ts /app/
COPY tsconfig.json /app/
COPY tsconfig.node.json /app/
COPY index.html /app/


EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "--port", "5173"]
