import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { createMintToInstruction, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from "@solana/spl-token";
import { SwapClient, createTestTokens } from "../src/client";
import { SolanaSwapSmartcontract } from "../target/types/solana_swap_smartcontract";
import { before, describe, it } from "node:test";

describe("Solana Swap Smart Contract", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SolanaSwapSmartcontract as Program<SolanaSwapSmartcontract>;
  const authority = Keypair.generate();
  const user = Keypair.generate();
  let swapClient: SwapClient;
  let solMint: anchor.web3.PublicKey;
  let usdtMint: anchor.web3.PublicKey;

  before(async () => {
    // Airdrop SOL to accounts
    await provider.connection.requestAirdrop(authority.publicKey, 10 * LAMPORTS_PER_SOL);
    await provider.connection.requestAirdrop(user.publicKey, 10 * LAMPORTS_PER_SOL);
    
    // Wait for airdrop
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Create test tokens
    const tokens = await createTestTokens(provider.connection, authority);
    solMint = tokens.solMint;
    usdtMint = tokens.usdtMint;

    // Initialize swap client
    swapClient = new SwapClient(
      provider.connection,
      provider.wallet as anchor.Wallet,
      program.programId
    );

    // Mint tokens to user accounts
    const userSolAccount = await getAssociatedTokenAddress(solMint, user.publicKey);
    const userUsdtAccount = await getAssociatedTokenAddress(usdtMint, user.publicKey);

    // Create associated token accounts and mint tokens
    const createSolAccountTx = new anchor.web3.Transaction().add(
      createAssociatedTokenAccountInstruction(
        user.publicKey,
        userSolAccount,
        user.publicKey,
        solMint
      ),
      createMintToInstruction(
        solMint,
        userSolAccount,
        authority.publicKey,
        100 * LAMPORTS_PER_SOL // 100 SOL
      )
    );

    const createUsdtAccountTx = new anchor.web3.Transaction().add(
      createAssociatedTokenAccountInstruction(
        user.publicKey,
        userUsdtAccount,
        user.publicKey,
        usdtMint
      ),
      createMintToInstruction(
        usdtMint,
        userUsdtAccount,
        authority.publicKey,
        10000 * 1_000_000 // 10,000 USDT
      )
    );

    await provider.connection.sendTransaction(createSolAccountTx, [user, authority]);
    await provider.connection.sendTransaction(createUsdtAccountTx, [user, authority]);
  });

  it("Initialize liquidity pool", async () => {
    const tx = await swapClient.initializePool(
      authority,
      solMint,
      usdtMint,
      50, // 50 SOL
      5000 // 5,000 USDT (1 SOL = 100 USDT initial price)
    );

    console.log("Pool initialized:", tx);

    // Check pool info
    const poolInfo = await swapClient.getPoolInfo(solMint, usdtMint);
    console.log("Pool SOL reserve:", poolInfo.solReserve.toNumber() / LAMPORTS_PER_SOL);
    console.log("Pool USDT reserve:", poolInfo.usdtReserve.toNumber() / 1_000_000);
  });

  it("Swap SOL to USDT", async () => {
    const amountIn = 1; // 1 SOL
    const minimumAmountOut = 95; // Minimum 95 USDT (5% slippage)

    console.log("Current price:", await swapClient.getCurrentPrice(solMint, usdtMint), "USDT per SOL");

    const tx = await swapClient.swapSolToUsdt(
      user,
      solMint,
      usdtMint,
      amountIn,
      minimumAmountOut
    );

    console.log("Swap SOL to USDT transaction:", tx);

    // Check pool info after swap
    const poolInfo = await swapClient.getPoolInfo(solMint, usdtMint);
    console.log("Pool SOL reserve after:", poolInfo.solReserve.toNumber() / LAMPORTS_PER_SOL);
    console.log("Pool USDT reserve after:", poolInfo.usdtReserve.toNumber() / 1_000_000);
    console.log("New price:", await swapClient.getCurrentPrice(solMint, usdtMint), "USDT per SOL");
  });

  it("Swap USDT to SOL", async () => {
    const amountIn = 100; // 100 USDT
    const minimumAmountOut = 0.9; // Minimum 0.9 SOL

    const tx = await swapClient.swapUsdtToSol(
      user,
      solMint,
      usdtMint,
      amountIn,
      minimumAmountOut
    );

    console.log("Swap USDT to SOL transaction:", tx);

    // Check pool info after swap
    const poolInfo = await swapClient.getPoolInfo(solMint, usdtMint);
    console.log("Final pool SOL reserve:", poolInfo.solReserve.toNumber() / LAMPORTS_PER_SOL);
    console.log("Final pool USDT reserve:", poolInfo.usdtReserve.toNumber() / 1_000_000);
    console.log("Final price:", await swapClient.getCurrentPrice(solMint, usdtMint), "USDT per SOL");
  });

  it("Calculate swap output", () => {
    // Test swap calculation
    const reserveSOL = 50;
    const reserveUSDT = 5000;
    const amountIn = 1;

    const expectedOut = swapClient.calculateSwapOutput(amountIn, reserveSOL, reserveUSDT);
    console.log(`Swapping ${amountIn} SOL should give approximately ${expectedOut.toFixed(2)} USDT`);
  });
});
