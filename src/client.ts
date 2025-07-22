import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Connection, PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { 
  TOKEN_PROGRAM_ID, 
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  createInitializeMintInstruction,
  MINT_SIZE,
  getMinimumBalanceForRentExemptMint,
} from "@solana/spl-token";
import { SolanaSwapSmartcontract } from "../target/types/solana_swap_smartcontract";
import idl from "../target/idl/solana_swap_smartcontract.json";

export class SwapClient {
  private program: Program<any>;
  private connection: Connection;
  private provider: anchor.AnchorProvider;

  constructor(connection: Connection, wallet: anchor.Wallet, programId: PublicKey) {
    this.connection = connection;
    this.provider = new anchor.AnchorProvider(connection, wallet, {});
    anchor.setProvider(this.provider);
    this.program = new Program(
      idl as any,
      programId,
      this.provider
    );
  }

  // Get pool PDA
  async getPoolPDA(solMint: PublicKey, usdtMint: PublicKey): Promise<[PublicKey, number]> {
    return await PublicKey.findProgramAddressSync(
      [Buffer.from("pool"), solMint.toBuffer(), usdtMint.toBuffer()],
      this.program.programId
    );
  }

  // Initialize liquidity pool
  async initializePool(
    authority: Keypair,
    solMint: PublicKey,
    usdtMint: PublicKey,
    initialSolAmount: number,
    initialUsdtAmount: number
  ): Promise<string> {
    const [poolPDA, bump] = await this.getPoolPDA(solMint, usdtMint);
    
    const poolSolAccount = await getAssociatedTokenAddress(solMint, poolPDA, true);
    const poolUsdtAccount = await getAssociatedTokenAddress(usdtMint, poolPDA, true);

    const tx = await this.program.methods
      .initializePool(
        new anchor.BN(initialSolAmount * LAMPORTS_PER_SOL),
        new anchor.BN(initialUsdtAmount * 1_000_000) // USDT has 6 decimals
      )
      .accounts({
        authority: authority.publicKey,
        pool: poolPDA,
        solMint: solMint,
        usdtMint: usdtMint,
        poolSolAccount: poolSolAccount,
        poolUsdtAccount: poolUsdtAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([authority])
      .rpc();

    return tx;
  }

  // Swap SOL to USDT
  async swapSolToUsdt(
    user: Keypair,
    solMint: PublicKey,
    usdtMint: PublicKey,
    amountIn: number, // SOL amount
    minimumAmountOut: number // Minimum USDT amount
  ): Promise<string> {
    const [poolPDA] = await this.getPoolPDA(solMint, usdtMint);
    
    const userSolAccount = await getAssociatedTokenAddress(solMint, user.publicKey);
    const userUsdtAccount = await getAssociatedTokenAddress(usdtMint, user.publicKey);
    const poolSolAccount = await getAssociatedTokenAddress(solMint, poolPDA, true);
    const poolUsdtAccount = await getAssociatedTokenAddress(usdtMint, poolPDA, true);

    // Create user USDT account if it doesn't exist
    const usdtAccountInfo = await this.connection.getAccountInfo(userUsdtAccount);
    const instructions = [];
    
    if (!usdtAccountInfo) {
      instructions.push(
        createAssociatedTokenAccountInstruction(
          user.publicKey,
          userUsdtAccount,
          user.publicKey,
          usdtMint
        )
      );
    }

    const tx = await this.program.methods
      .swapSolToUsdt(
        new anchor.BN(amountIn * LAMPORTS_PER_SOL),
        new anchor.BN(minimumAmountOut * 1_000_000)
      )
      .accounts({
        user: user.publicKey,
        pool: poolPDA,
        solMint: solMint,
        usdtMint: usdtMint,
        userSolAccount: userSolAccount,
        userUsdtAccount: userUsdtAccount,
        poolSolAccount: poolSolAccount,
        poolUsdtAccount: poolUsdtAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .preInstructions(instructions)
      .signers([user])
      .rpc();

    return tx;
  }

  // Swap USDT to SOL
  async swapUsdtToSol(
    user: Keypair,
    solMint: PublicKey,
    usdtMint: PublicKey,
    amountIn: number, // USDT amount
    minimumAmountOut: number // Minimum SOL amount
  ): Promise<string> {
    const [poolPDA] = await this.getPoolPDA(solMint, usdtMint);
    
    const userSolAccount = await getAssociatedTokenAddress(solMint, user.publicKey);
    const userUsdtAccount = await getAssociatedTokenAddress(usdtMint, user.publicKey);
    const poolSolAccount = await getAssociatedTokenAddress(solMint, poolPDA, true);
    const poolUsdtAccount = await getAssociatedTokenAddress(usdtMint, poolPDA, true);

    const tx = await this.program.methods
      .swapUsdtToSol(
        new anchor.BN(amountIn * 1_000_000),
        new anchor.BN(minimumAmountOut * LAMPORTS_PER_SOL)
      )
      .accounts({
        user: user.publicKey,
        pool: poolPDA,
        solMint: solMint,
        usdtMint: usdtMint,
        userSolAccount: userSolAccount,
        userUsdtAccount: userUsdtAccount,
        poolSolAccount: poolSolAccount,
        poolUsdtAccount: poolUsdtAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([user])
      .rpc();

    return tx;
  }

  // Get pool info
  async getPoolInfo(solMint: PublicKey, usdtMint: PublicKey) {
    const [poolPDA] = await this.getPoolPDA(solMint, usdtMint);
    return await (this.program.account as any).liquidityPool.fetch(poolPDA);
  }

  // Calculate swap output
  calculateSwapOutput(amountIn: number, reserveIn: number, reserveOut: number): number {
    const amountInWithFee = amountIn * 0.997; // 0.3% fee
    return (amountInWithFee * reserveOut) / (reserveIn + amountInWithFee);
  }

  // Get current price
  async getCurrentPrice(solMint: PublicKey, usdtMint: PublicKey): Promise<number> {
    const poolInfo = await this.getPoolInfo(solMint, usdtMint);
    const solReserve = poolInfo.solReserve.toNumber() / LAMPORTS_PER_SOL;
    const usdtReserve = poolInfo.usdtReserve.toNumber() / 1_000_000;
    
    return usdtReserve / solReserve; // Price of 1 SOL in USDT
  }
}

// Helper function to create test tokens
export async function createTestTokens(
  connection: Connection,
  payer: Keypair
): Promise<{ solMint: PublicKey; usdtMint: PublicKey }> {
  // Create SOL mint (wrapped SOL)
  const solMint = Keypair.generate();
  const usdtMint = Keypair.generate();

  const lamports = await getMinimumBalanceForRentExemptMint(connection);

  // Create SOL mint
  const createSolMintTx = new anchor.web3.Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: solMint.publicKey,
      space: MINT_SIZE,
      lamports,
      programId: TOKEN_PROGRAM_ID,
    }),
    createInitializeMintInstruction(
      solMint.publicKey,
      9, // SOL decimals
      payer.publicKey,
      null
    )
  );

  // Create USDT mint
  const createUsdtMintTx = new anchor.web3.Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: usdtMint.publicKey,
      space: MINT_SIZE,
      lamports,
      programId: TOKEN_PROGRAM_ID,
    }),
    createInitializeMintInstruction(
      usdtMint.publicKey,
      6, // USDT decimals
      payer.publicKey,
      null
    )
  );

  await connection.sendTransaction(createSolMintTx, [payer, solMint]);
  await connection.sendTransaction(createUsdtMintTx, [payer, usdtMint]);

  return {
    solMint: solMint.publicKey,
    usdtMint: usdtMint.publicKey,
  };
}
