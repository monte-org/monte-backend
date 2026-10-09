// Stellar blockchain watcher for Monte
// Monitors deposit addresses for incoming payments and updates payment status
// Run with: node frontend/watcher.js

import fs from 'fs'
import path from 'path'
import { Server, TransactionBuilder, Networks, Asset, Operation, Account, BASE_FEE } from 'stellar-sdk'

const DATA_FILE = path.resolve(process.cwd(), 'frontend/data/payments.json')

// Configuration
const HORIZON_URL = process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org'
const NETWORK_PASSPHRASE = process.env.STELLAR_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015'

// Initialize Stellar server
const server = new Server(HORIZON_URL)

// Cache for last cursor to avoid reprocessing
let lastCursor = 'now'

async function checkPayments() {
  if (!fs.existsSync(DATA_FILE)) {
    console.log('No payments file found, skipping check')
    return
  }

  const payments = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
  const pendingPayments = payments.filter(p => p.status === 'PENDING')

  if (pendingPayments.length === 0) {
    console.log('No pending payments to check')
    return
  }

  console.log(`Checking ${pendingPayments.length} pending payments...`)

  // Group payments by deposit address
  const addressMap = new Map()
  for (const payment of pendingPayments) {
    if (!addressMap.has(payment.depositAddress)) {
      addressMap.set(payment.depositAddress, [])
    }
    addressMap.get(payment.depositAddress).push(payment)
  }

  // Check each deposit address for transactions
  for (const [depositAddress, addressPayments] of addressMap) {
    try {
      await checkAddressTransactions(depositAddress, addressPayments, payments)
    } catch (error) {
      console.error(`Error checking address ${depositAddress}:`, error.message)
    }
  }

  // Save updated payments
  fs.writeFileSync(DATA_FILE, JSON.stringify(payments, null, 2))
}

async function checkAddressTransactions(depositAddress, addressPayments, allPayments) {
  console.log(`Checking transactions for address: ${depositAddress}`)

  // Get transactions for this address
  const transactions = await server
    .transactions()
    .forAccount(depositAddress)
    .order('desc')
    .limit(100)
    .call()

  for (const tx of transactions.records) {
    // Skip if we've already processed this transaction
    if (tx.memo && tx.memo === lastCursor) {
      continue
    }

    // Get transaction operations to find payment details
    const ops = await server.operations().forTransaction(tx.id).call()

    for (const op of ops.records) {
      if (op.type === 'payment' && op.asset_type === 'credit_alphanum4' && op.asset_code === 'USDC') {
        // Check if this payment matches any pending payment by memo
        const memo = tx.memo ? tx.memo.toString() : null
        
        if (memo) {
          const matchingPayment = addressPayments.find(p => p.memo === memo)
          
          if (matchingPayment) {
            // Verify amount matches (allow for small rounding differences)
            const txAmount = parseFloat(op.amount)
            const expectedAmount = parseFloat(matchingPayment.amount)
            
            if (Math.abs(txAmount - expectedAmount) < 0.01) {
              // Update payment status
              const paymentIndex = allPayments.findIndex(p => p.id === matchingPayment.id)
              if (paymentIndex !== -1) {
                console.log(`✓ Payment ${matchingPayment.id} confirmed! Amount: ${op.amount}`)
                allPayments[paymentIndex].status = 'PAID'
                allPayments[paymentIndex].txHash = tx.hash
                allPayments[paymentIndex].updatedAt = Date.now()
              }
            } else {
              console.log(`⚠ Payment ${matchingPayment.id} found but amount mismatch: expected ${expectedAmount}, got ${txAmount}`)
            }
          }
        }
      }
    }
  }
}

// Alternative: Manual mark as paid for demo/testing
async function checkManualMark() {
  if (!fs.existsSync(DATA_FILE)) return
  
  const payments = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
  let updated = false

  for (const p of payments) {
    if (p.status === 'PENDING' && p.manualMarkPaid === true) {
      console.log(`✓ Manually marking payment ${p.id} as PAID`)
      p.status = 'PAID'
      p.txHash = 'DEMO_MANUAL_TX_' + Date.now()
      p.updatedAt = Date.now()
      delete p.manualMarkPaid
      updated = true
    }
  }

  if (updated) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(payments, null, 2))
  }
}

// Main check function
async function check() {
  try {
    // Try real blockchain monitoring first
    await checkPayments()
  } catch (error) {
    console.error('Error in blockchain monitoring:', error.message)
    console.log('Falling back to manual mark check...')
    // Fallback to manual mark for demo
    await checkManualMark()
  }
}

// Start the watcher
console.log('Starting Monte blockchain watcher...')
console.log(`Horizon URL: ${HORIZON_URL}`)
console.log(`Checking payments every 10 seconds...`)

check()
setInterval(check, 10000)
