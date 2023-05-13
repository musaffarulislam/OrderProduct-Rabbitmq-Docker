const mongoose = require("mongoose");

const connectDB = () => {
    const uri = "mongodb://product-db:27017/rabbitmq"
    console.log("product DB uri :", uri)
    mongoose.set("strictQuery", false);

    mongoose.connect(uri).then(() => {
        console.log("Database connected successfully")
    }).catch((error) => {
        console.log(`Database connection failed : ${error}`);

    })
}

module.exports = connectDB;