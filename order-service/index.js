const express = require("express");
const app = express();
const PORT = process.env.PORT || 3002;
const amqp = require("amqplib");
const Order = require("./models/Order");
const connectDB = require("./config/database")

connectDB()
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
var channel, connection;

// mongoose
//   .connect("mongodb://0.0.0.0:27017/scan-order-service", {
//     useNewUrlParser: true,
//     useUnifiedTopology: true,
//   })
//   .then(() => console.log("Order-Service Connected to MongoDB"))
//   .catch((e) => console.log(e));

// RabbitMQ connection
async function connectToRabbitMQ() {
  const amqpServer = "amqp://guest:guest@rabbitmq:5672";
  connection = await amqp.connect(amqpServer);
  channel = await connection.createChannel();
  await channel.assertQueue("order-service-queue");
  await channel.assertQueue("orders-queue");
}

// Create an order
createOrder = (products) => {
  let total = 0;
  products.forEach((product) => {
    total += product.price;
  });

  const order = new Order({
    products,
    total,
  });
  order.save();
  return order;
};


connectToRabbitMQ().then(() => {
  channel.consume("order-service-queue", (data) => {
    // order service queue listens to this queue
    const { products } = JSON.parse(data.content);
    console.log(products);
    const newOrder = createOrder(products);
    console.log(newOrder);
    channel.ack(data);
    channel.sendToQueue(
      "product-service-queue",
      Buffer.from(JSON.stringify(newOrder))
    );
  });

  channel.consume("orders-queue", async (data) => {
    const { productId } = JSON.parse(data.content);
    console.log("Product ID:", productId);
    const orders = await Order.find();
    console.log("Orders:", orders);
    channel.ack(data);
    channel.sendToQueue(
      "product-orders-queue",
      Buffer.from(JSON.stringify(orders))
    );
  });
});

app.listen(PORT, () => {
  console.log(`Order-Service listening on port ${PORT}`);
});