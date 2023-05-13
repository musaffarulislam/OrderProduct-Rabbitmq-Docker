const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const OrderSchema = new Schema({
    products: [
      { product_id: String },
    ],
    total: {
      type: Number,
      required: true,
    },},
  { timestamps: true }
);

module.exports = mongoose.model("Order", OrderSchema);
