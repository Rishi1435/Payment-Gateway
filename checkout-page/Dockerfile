FROM node:18-alpine
WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
EXPOSE 3001
# We use a trick to run on port 3001 because Create-React-App defaults to 3000
ENV PORT=3001
CMD ["npm", "start"]