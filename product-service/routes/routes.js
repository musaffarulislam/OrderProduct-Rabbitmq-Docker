const Router = require("express").Router;
const router = new Router();
const Product = require("../models/Product");
const amqp = require("amqplib");

let order, channel, connection;

// Connect to RabbitMQ
async function connectToRabbitMQ() {
  const amqpServer = "amqp://guest:guest@rabbitmq:5672";
  const maxRetries = 5;
  let retryCount = 0;
  
  while (retryCount < maxRetries) {
    try {
      connection = await amqp.connect(amqpServer);
      channel = await connection.createChannel();
      await channel.assertQueue("product-service-queue");
      await channel.assertQueue("product-order-queue");
      break; // Connection successful, exit the loop
    } catch (error) {
      console.error("Failed to connect to RabbitMQ. Retrying...");
      retryCount++;
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait for 2 seconds before retrying
    }
  }
  
  if (retryCount === maxRetries) {
    console.error("Failed to connect to RabbitMQ after maximum retries.");
    // Handle the failure scenario accordingly
  }
}

connectToRabbitMQ();

// Create a new product
router.post("/", async (req, res) => {
  const { name, price, description } = req.body;
  if (!name || !price || !description) {
    return res.status(400).json({
      message: "Please provide name, price and description",
    });
  }
  const product = await new Product({ ...req.body });
  await product.save();
  return res.status(201).json({
    message: "Product created successfully",
    product,
  });
});

// Buy a product
router.post("/buy", async (req, res) => {
  const { productIds } = req.body;
  const products = await Product.find({ _id: { $in: productIds } });
  if (!connection || !channel) {
    await connectToRabbitMQ();
  }
  // Send order to RabbitMQ order queue
  channel.sendToQueue(
    "order-service-queue",
    Buffer.from(
      JSON.stringify({
        products
      })
    )
  );

  // Consume previously placed order from RabbitMQ & acknowledge the transaction
  channel.consume("product-service-queue", (data) => {
    console.log("Consumed from product-service-queue");
    order = JSON.parse(data.content);
    console.log("Order: ",order);
    channel.ack(data);
  });

  // Return a success message
  return res.status(201).json({
    message: "Order placed successfully",
    order: order,
  });
});


router.get("/productOrders", async (req, res)=>{
  const {productId } = req.body;
  if (!connection || !channel) {
    await connectToRabbitMQ();
  }
  channel.sendToQueue(
    'order-product-queue',
    Buffer.from(
      JSON.stringify({
        productId
      })
    )
  );
  channel.consume("product-order-queue", (data) =>{
    console.log("Consumed from product-order-queue");
    order = JSON.parse(data.content);
    channel.ack(data);
  })

  return res.status(201).json({
    message: "Order return successfully",
    order
  })
})

module.exports = router;
