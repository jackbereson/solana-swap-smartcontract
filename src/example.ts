import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { SwapClient, createTestTokens } from "./client";

// Example sử dụng swap contract
async function main() {
  // Kết nối tới localnet
  const connection = new Connection("http://localhost:8899", "confirmed");
  
  // Tạo keypairs
  const authority = Keypair.generate();
  const user = Keypair.generate();
  
  // Airdrop SOL
  console.log("Airdropping SOL...");
  await connection.requestAirdrop(authority.publicKey, 10 * LAMPORTS_PER_SOL);
  await connection.requestAirdrop(user.publicKey, 10 * LAMPORTS_PER_SOL);
  
  // Đợi airdrop
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Tạo test tokens
  console.log("Creating test tokens...");
  const { solMint, usdtMint } = await createTestTokens(connection, authority);
  
  console.log("SOL Mint:", solMint.toString());
  console.log("USDT Mint:", usdtMint.toString());
  
  // Khởi tạo swap client
  const wallet = new anchor.Wallet(authority);
  const programId = new anchor.web3.PublicKey("FP5e6JndLDRFmPS8sNwAwLfoPK8HGkbzspqqDvJRZbnJ"); // Program ID thực tế
  
  const swapClient = new SwapClient(connection, wallet, programId);
  
  try {
    // 1. Khởi tạo liquidity pool
    console.log("\n1. Initializing liquidity pool...");
    const initTx = await swapClient.initializePool(
      authority,
      solMint,
      usdtMint,
      50,    // 50 SOL
      5000   // 5000 USDT (1 SOL = 100 USDT)
    );
    console.log("Pool initialized. TX:", initTx);
    
    // 2. Kiểm tra thông tin pool
    const poolInfo = await swapClient.getPoolInfo(solMint, usdtMint);
    console.log("Pool SOL reserve:", poolInfo.solReserve.toNumber() / LAMPORTS_PER_SOL);
    console.log("Pool USDT reserve:", poolInfo.usdtReserve.toNumber() / 1_000_000);
    
    const currentPrice = await swapClient.getCurrentPrice(solMint, usdtMint);
    console.log("Current price: 1 SOL =", currentPrice.toFixed(2), "USDT");
    
    // 3. Tính toán swap output
    console.log("\n2. Calculating swap output...");
    const swapAmount = 1; // 1 SOL
    const expectedUSDT = swapClient.calculateSwapOutput(
      swapAmount,
      poolInfo.solReserve.toNumber() / LAMPORTS_PER_SOL,
      poolInfo.usdtReserve.toNumber() / 1_000_000
    );
    console.log(`Swapping ${swapAmount} SOL would give approximately ${expectedUSDT.toFixed(2)} USDT`);
    
    // 4. Thực hiện swap SOL -> USDT
    console.log("\n3. Swapping SOL to USDT...");
    const swapTx = await swapClient.swapSolToUsdt(
      user,
      solMint,
      usdtMint,
      swapAmount,
      expectedUSDT * 0.95 // 5% slippage tolerance
    );
    console.log("Swap completed. TX:", swapTx);
    
    // 5. Kiểm tra pool sau swap
    const poolInfoAfter = await swapClient.getPoolInfo(solMint, usdtMint);
    console.log("Pool SOL reserve after:", poolInfoAfter.solReserve.toNumber() / LAMPORTS_PER_SOL);
    console.log("Pool USDT reserve after:", poolInfoAfter.usdtReserve.toNumber() / 1_000_000);
    
    const newPrice = await swapClient.getCurrentPrice(solMint, usdtMint);
    console.log("New price: 1 SOL =", newPrice.toFixed(2), "USDT");
    
    console.log("\n✅ Demo completed successfully!");
    
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

// Chạy demo
if (require.main === module) {
  main().catch(console.error);
}

export { main };
