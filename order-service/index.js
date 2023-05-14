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
  await channel.assertQueue("order-product-queue");
}

// Create an order
createOrder = async (products) => {
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
};

productOrders = async (productId) =>{
  const orders = await Order.find({})
  const ordersWithProduct = orders.filter(order => order.productIds.includes(productId));
  console.log("Order Service: ", ordersWithProduct);
  return ordersWithProduct;
}

connectToRabbitMQ().then(() => {
  channel.consume("order-service-queue", (data) => {
    // order service queue listens to this queue
    const { products } = JSON.parse(data.content);
    console.log(products);
    const newOrder = createOrder(products);
    channel.ack(data);
    channel.sendToQueue(
      "product-service-queue",
      Buffer.from(JSON.stringify(newOrder))
    );
  });

  channel.consume('order-product-queue', (data)=>{
    const {product } = JSON.parse(data.content);
    const orders = productOrders(product);
    channel.ack(data);
    channel.sendToQueue(
      'product-order-queue',
      Buffer.from(JSON.stringify(orders))
    )
  })
});

app.listen(PORT, () => {
  console.log(`Order-Service listening on port ${PORT}`);
});
