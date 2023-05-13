FROM node:14
WORKDIR /app
COPY package*.json ./
RUN npm install
# Install RabbitMQ client library
RUN npm install amqplib
COPY . .
EXPOSE 3002
CMD [ "npm", "start" ]
