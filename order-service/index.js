const express = require("express");
const app = express();
const PORT = process.env.PORT || 3002;
const amqp = require("amqplib");
const Order = require("./models/Order");
const connectDB = require("./config/database");

connectDB();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
let channel, connection;

async function connectToRabbitMQ() {
  try {
    const amqpServer = "amqp://guest:guest@rabbitmq:5672";
    connection = await amqp.connect(amqpServer);
    channel = await connection.createChannel();
    await channel.assertQueue("order-service-queue");
    await channel.assertQueue("order-product-queue");
    console.log("Order Service RabbitMQ connected");
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1); // Terminate the application if the RabbitMQ connection fails
  }
}

async function createOrder(products) {
  let total = 0;
  products.forEach((product) => {
    total += product.price;
  });

  const order = new Order({
    products,
    total,
  });
  await order.save();
  return order;
}

async function productOrders(productId) {
  const orders = await Order.find();
  const ordersWithProduct = orders.filter((order) =>
    order.productIds.includes(productId)
  );
  console.log("Order Service:", orders);
  return orders;
}

// Move the connection logic inside an async IIFE
(async () => {
  try {
    await connectToRabbitMQ();

    channel.consume("order-service-queue", async (data) => {
      const { products } = JSON.parse(data.content);
      console.log("Products:", products);
      const newOrder = await createOrder(products);
      channel.ack(data);
      channel.sendToQueue(
        "product-service-queue",
        Buffer.from(JSON.stringify(newOrder))
      );
    });

    channel.consume("order-product-queue", async (data) => {
      const { product } = JSON.parse(data.content);
      console.log("Product ID:", product);
      const orders = await productOrders(product);
      console.log("Orders:", orders);
      channel.ack(data);
      channel.sendToQueue(
        "product-order-queue",
        Buffer.from(JSON.stringify(orders))
      );
    });

    app.listen(PORT, () => {
      console.log(`Order-Service listening on port ${PORT}`);
    });
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1); // Terminate the application if an error occurs
  }
})();
