require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(
  cors({
    origin: "*", // Allow requests from any origin
  })
);

// Set these values from your environment or direct assignment
const QUICKPAY_USER_KEY = process.env.QUICKPAY_USER_KEY;
const BASE_URL = process.env.BASE_URL;

const authHeader = `Basic ${Buffer.from(`:${QUICKPAY_USER_KEY}`).toString(
  "base64"
)}`;

// Create Payment Link Function
async function createPaymentLink(orderId, amount, currency) {
  try {
    // Step 1: Create a payment
    const response = await axios.post(
      BASE_URL,
      { order_id: orderId, currency: currency },
      {
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
          "Accept-Version": "v10",
        },
      }
    );

    const paymentId = response.data.id;

    // Step 2: Generate a payment link
    const linkResponse = await axios.put(
      `${BASE_URL}/${paymentId}/link`,
      { amount: amount }, // Amount in cents (100 = $1.00)
      {
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
          "Accept-Version": "v10",
        },
      }
    );

    return linkResponse.data.url;
  } catch (error) {
    console.error(
      "Error creating payment link:",
      error.response?.data || error.message
    );
    throw new Error(
      error.response?.data?.message || "Failed to create QuickPay payment link"
    );
  }
}

// Verify Payment Function
async function verifyPayment(orderId) {
  try {
    const response = await axios.get(`${BASE_URL}?order_id=${orderId}`, {
      headers: {
        Authorization: authHeader,
        "Accept-Version": "v10",
      },
    });

    if (!response.data || response.data.length === 0) {
      throw new Error("No payment found for this order ID");
    }

    const payment = response.data[0];
    return {
      status: payment.accepted ? "Paid" : "Pending",
      transactionId: payment.id,
      amount: payment.operations.reduce((sum, op) => sum + (op.amount || 0), 0),
      currency: payment.currency,
    };
  } catch (error) {
    console.error(
      "Error verifying payment:",
      error.response?.data || error.message
    );
    throw new Error(
      error.response?.data?.message || "Failed to verify payment"
    );
  }
}

// Endpoint to Create a Payment Link
app.post("/create-quickpay-link", async (req, res) => {
  try {
    const { orderId, amount, currency } = req.body;
    if (!orderId || !amount || !currency) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const paymentUrl = await createPaymentLink(orderId, amount, currency);
    res.json({ paymentUrl });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to Verify Payment
app.get("/verify-payment/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;
    if (!orderId) {
      return res.status(400).json({ error: "Order ID is required" });
    }

    const paymentStatus = await verifyPayment(orderId);
    res.json(paymentStatus);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000, () => console.log("Server running on port 3000"));
