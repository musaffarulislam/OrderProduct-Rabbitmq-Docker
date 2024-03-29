const Router = require("express").Router;
const router = new Router();
const Product = require("../models/Product");
const amqp = require("amqplib");

let order, orders, channel, connection;

// Connect to RabbitMQ

async function connectToRabbitMQ() {
    const amqpServer = "amqp://guest:guest@rabbitmq:5672";
    connection = await amqp.connect(amqpServer);
    channel = await connection.createChannel();
    await channel.assertQueue("product-service-queue");
    await channel.assertQueue("product-orders-queue");
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
  // 645f852f4e40f3950f439dbe
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
    channel.ack(data);
  });

  // Return a success message
  return res.status(201).json({
    message: "Order placed successfully",
    order,
  });
});


router.get("/productOrders", async (req, res)=>{
  try{
    const {productId } = req.body;
    channel.sendToQueue(
      'orders-queue',
      Buffer.from(
        JSON.stringify({
          productId
        })
      )
    );
    
    channel.consume("product-orders-queue", (data) =>{
      console.log("Consumed from product-orders-queue");
      orders = JSON.parse(data.content);
      console.log("Orders: ",orders);
      channel.ack(data);
    })
  
    return res.status(201).json({
      message: "Order return successfully",
      orders: orders,
    })
    
  }catch(err){
    console.error("Error : ", err.message);
    res.status(400).json({
      message: "Product Orders Error",
    });
  }
})

module.exports = router;