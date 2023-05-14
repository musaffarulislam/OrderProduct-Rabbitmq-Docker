const Router = require("express").Router;
const router = new Router();
const Product = require("../models/Product");
const amqp = require("amqplib");

let order, channel, connection;

// Connect to RabbitMQ

async function connectToRabbitMQ() {
  try{
    const amqpServer = "amqp://guest:guest@rabbitmq:5672";
    connection = await amqp.connect(amqpServer);
    channel = await connection.createChannel();
    await channel.assertQueue("product-service-queue");
    await channel.assertQueue("product-order-queue");
    console.log("Product Service Rabbitmq connect");
  }catch(err){
    console.error("Error : ", err.message);
  }
}

connectToRabbitMQ();

// Create a new product
router.post("/", async (req, res) => {
  try{
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
  }catch(err){
    console.error("Error : ", err.message);
    res.status(400).json({
      message: "Product created Error",
    });
  }
});

// Buy a product
router.post("/buy", async (req, res) => {
  try{
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
  }catch(err){
    console.error("Error : ", err.message);
    res.status(400).json({
      message: "Product buy Error",
    });
  }
});


router.get("/productOrders", async (req, res)=>{
  try{
    const {productId } = req.body;
    if (!connection || !channel) {
      await connectToRabbitMQ();
      console.log("connect Rabbitmq");
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
      console.log("Order: ",order);
      channel.ack(data);
    })
  
    return res.status(201).json({
      message: "Order return successfully",
      order: order
    })
  }catch(err){
    console.error("Error : ", err.message);
    res.status(400).json({
      message: "Product Orders Error",
    });
  }
})

module.exports = router;
